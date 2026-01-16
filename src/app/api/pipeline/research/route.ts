import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { researchCompanyAddress, researchCompanyDescription } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const { companyIds } = await request.json();
    
    const supabase = await createClient();

    // Get active prompts
    const { data: prompts } = await supabase
      .from("prompts")
      .select("step, template")
      .in("step", ["research_address", "research_description"])
      .eq("is_active", true);

    const addressPrompt = prompts?.find((p) => p.step === "research_address")?.template;
    const descriptionPrompt = prompts?.find((p) => p.step === "research_description")?.template;

    // Get companies to process
    const { data: companies, error } = await supabase
      .from("companies")
      .select("id, name, formatted_name, domain, country_name, formatted_address, enriched_description")
      .in("id", companyIds);

    if (error) throw error;
    if (!companies || companies.length === 0) {
      return NextResponse.json({ message: "No companies to process" });
    }

    const results = [];

    for (const company of companies) {
      const companyName = company.formatted_name || company.name || "";
      const domain = company.domain || "";
      const country = company.country_name || "";

      // Skip if no domain
      if (!domain) {
        results.push({ id: company.id, skipped: true, reason: "no_domain" });
        continue;
      }

      const updates: Record<string, string> = {};
      const startTime = Date.now();

      // Research address if missing
      if (!company.formatted_address && addressPrompt) {
        try {
          const address = await researchCompanyAddress(companyName, domain, country, addressPrompt);
          if (address) {
            updates.formatted_address = address;
          }
        } catch (err) {
          console.error(`Address research failed for ${domain}:`, err);
        }
      }

      // Research description if missing
      if (!company.enriched_description && descriptionPrompt) {
        try {
          const description = await researchCompanyDescription(companyName, domain, descriptionPrompt);
          if (description) {
            updates.enriched_description = description;
          }
        } catch (err) {
          console.error(`Description research failed for ${domain}:`, err);
        }
      }

      const duration = Date.now() - startTime;

      // Update company
      if (Object.keys(updates).length > 0) {
        await supabase
          .from("companies")
          .update({ ...updates, status: "validating" })
          .eq("id", company.id);
      } else {
        await supabase
          .from("companies")
          .update({ status: "validating" })
          .eq("id", company.id);
      }

      // Log processing
      await supabase.from("processing_logs").insert({
        company_id: company.id,
        step: "research",
        input: { domain, name: companyName },
        output: updates,
        llm_model: "perplexity-sonar",
        duration_ms: duration,
      });

      results.push({ id: company.id, updates, duration_ms: duration });
    }

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Research pipeline error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
