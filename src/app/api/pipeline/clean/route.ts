import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanAndEnrichCompanies } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const { companyIds, batchSize = 10 } = await request.json();
    
    const supabase = await createClient();

    // Get active prompt for cleaning
    const { data: prompt } = await supabase
      .from("prompts")
      .select("template")
      .eq("step", "clean")
      .eq("is_active", true)
      .single();

    if (!prompt) {
      return NextResponse.json({ error: "No active clean prompt found" }, { status: 400 });
    }

    // Get companies to process
    const { data: companies, error } = await supabase
      .from("companies")
      .select("id, name, address, description")
      .in("id", companyIds)
      .limit(batchSize);

    if (error) throw error;
    if (!companies || companies.length === 0) {
      return NextResponse.json({ message: "No companies to process" });
    }

    // Update status to cleaning
    await supabase
      .from("companies")
      .update({ status: "cleaning" })
      .in("id", companies.map((c) => c.id));

    // Prepare input for LLM
    const input = companies.map((c) => ({
      company_id: c.id,
      company_name: c.name || "",
      address: c.address || "",
      description: c.description || "",
    }));

    const startTime = Date.now();
    const results = await cleanAndEnrichCompanies(input, prompt.template);
    const duration = Date.now() - startTime;

    // Update companies with cleaned data
    for (const result of results) {
      await supabase
        .from("companies")
        .update({
          formatted_name: result.formatted_company_name,
          formatted_address: result.formatted_address,
          company_type: result.determined_company_type,
          enriched_description: result.enriched_description,
          status: "researching",
        })
        .eq("id", result.company_id);

      // Log processing
      await supabase.from("processing_logs").insert({
        company_id: result.company_id,
        step: "clean",
        input: input.find((i) => i.company_id === result.company_id),
        output: result,
        llm_model: "gpt-4o-mini",
        duration_ms: Math.round(duration / results.length),
      });
    }

    return NextResponse.json({
      processed: results.length,
      duration_ms: duration,
    });
  } catch (error) {
    console.error("Clean pipeline error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
