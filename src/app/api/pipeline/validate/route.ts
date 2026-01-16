import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateCompanyData } from "@/lib/llm";

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Common free email providers to blacklist
const FREE_EMAIL_PROVIDERS = [
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
  "icloud.com", "mail.com", "protonmail.com", "gmx.com", "yandex.com",
  "web.de", "gmx.de", "t-online.de", "freenet.de",
];

function validateEmail(email: string | null): { valid: boolean; reason?: string } {
  if (!email) return { valid: true }; // Empty is ok, just not filled

  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, reason: "Invalid email format" };
  }

  const domain = email.split("@")[1]?.toLowerCase();
  if (FREE_EMAIL_PROVIDERS.includes(domain)) {
    return { valid: false, reason: "Free email provider (not business email)" };
  }

  return { valid: true };
}

export async function POST(request: Request) {
  try {
    const { companyIds, useLLM = false } = await request.json();
    
    const supabase = await createClient();

    // Get column rules
    const { data: rules } = await supabase
      .from("column_rules")
      .select("*")
      .eq("is_active", true);

    // Get validate prompt if using LLM
    let validatePrompt: string | null = null;
    if (useLLM) {
      const { data: prompt } = await supabase
        .from("prompts")
        .select("template")
        .eq("step", "validate")
        .eq("is_active", true)
        .single();
      validatePrompt = prompt?.template || null;
    }

    // Get companies to validate
    const { data: companies, error } = await supabase
      .from("companies")
      .select("*")
      .in("id", companyIds);

    if (error) throw error;
    if (!companies || companies.length === 0) {
      return NextResponse.json({ message: "No companies to validate" });
    }

    const results = [];

    for (const company of companies) {
      const issues: string[] = [];

      // Rule-based validation
      if (rules) {
        for (const rule of rules) {
          const value = company[rule.column_name as keyof typeof company];

          switch (rule.rule_type) {
            case "required":
              if (!value || (typeof value === "string" && value.trim() === "")) {
                issues.push(rule.error_message || `${rule.column_name} is required`);
              }
              break;

            case "format":
              if (value && typeof value === "string") {
                const regex = new RegExp(rule.rule_config.pattern as string);
                if (!regex.test(value)) {
                  issues.push(rule.error_message || `${rule.column_name} has invalid format`);
                }
              }
              break;

            case "enum":
              if (value) {
                const allowed = rule.rule_config.values as string[];
                if (!allowed.includes(String(value))) {
                  issues.push(rule.error_message || `${rule.column_name} must be one of: ${allowed.join(", ")}`);
                }
              }
              break;

            case "min_length":
              if (value && typeof value === "string") {
                const min = rule.rule_config.min as number;
                if (value.length < min) {
                  issues.push(rule.error_message || `${rule.column_name} must be at least ${min} characters`);
                }
              }
              break;

            case "max_length":
              if (value && typeof value === "string") {
                const max = rule.rule_config.max as number;
                if (value.length > max) {
                  issues.push(rule.error_message || `${rule.column_name} must be at most ${max} characters`);
                }
              }
              break;
          }
        }
      }

      // Email validation
      const emailValidation = validateEmail(company.email);
      if (!emailValidation.valid) {
        issues.push(`Email: ${emailValidation.reason}`);
      }

      // LLM validation
      let llmValidation = null;
      if (useLLM && validatePrompt) {
        try {
          llmValidation = await validateCompanyData(
            {
              name: company.formatted_name || company.name || undefined,
              domain: company.domain || undefined,
              address: company.formatted_address || company.address || undefined,
              description: company.enriched_description || company.description || undefined,
              company_type: company.company_type || undefined,
            },
            validatePrompt
          );
          if (!llmValidation.is_valid) {
            issues.push(...llmValidation.issues);
          }
        } catch (err) {
          console.error("LLM validation failed:", err);
        }
      }

      const isValid = issues.length === 0;

      // Update company status
      await supabase
        .from("companies")
        .update({
          status: isValid ? "validated" : "failed",
          enrichment_sources: {
            ...((company.enrichment_sources as object) || {}),
            validation_issues: issues,
            validated_at: new Date().toISOString(),
          },
        })
        .eq("id", company.id);

      // Log validation
      await supabase.from("processing_logs").insert({
        company_id: company.id,
        step: "validate",
        input: { company_id: company.id },
        output: { is_valid: isValid, issues, llm_validation: llmValidation },
        llm_model: useLLM ? "gpt-4o-mini" : null,
      });

      results.push({
        id: company.id,
        is_valid: isValid,
        issues,
      });
    }

    return NextResponse.json({
      processed: results.length,
      valid: results.filter((r) => r.is_valid).length,
      invalid: results.filter((r) => !r.is_valid).length,
      results,
    });
  } catch (error) {
    console.error("Validate pipeline error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
