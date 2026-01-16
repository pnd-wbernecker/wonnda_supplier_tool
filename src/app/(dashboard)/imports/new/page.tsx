"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { CSVUploader, CSVPreview } from "@/components/imports";
import { SchemaMapper } from "@/components/imports/SchemaMapper";
import { createClient } from "@/lib/supabase/client";

type Step = "upload" | "map" | "confirm";

interface CSVData {
  filename: string;
  headers: string[];
  rows: Record<string, string>[];
  preview: Record<string, string>[];
}

export default function NewImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const supabase = createClient();

  const handleFileLoaded = (data: CSVData) => {
    setCsvData(data);
    // Auto-detect some mappings
    const autoMapping: Record<string, string | null> = {};
    data.headers.forEach((header) => {
      const lower = header.toLowerCase();
      if (lower.includes("company") && lower.includes("name")) autoMapping[header] = "name";
      else if (lower === "name" || lower === "company") autoMapping[header] = "name";
      else if (lower.includes("website") || lower === "url") autoMapping[header] = "website";
      else if (lower.includes("email")) autoMapping[header] = "email";
      else if (lower.includes("phone")) autoMapping[header] = "phone";
      else if (lower.includes("address")) autoMapping[header] = "address";
      else if (lower.includes("country")) autoMapping[header] = "country_name";
      else if (lower.includes("description")) autoMapping[header] = "description";
      else if (lower.includes("type")) autoMapping[header] = "company_type";
      else if (lower.includes("categor")) autoMapping[header] = "categories";
      else if (lower.includes("tag")) autoMapping[header] = "tags";
      else autoMapping[header] = null;
    });
    setMapping(autoMapping);
    setStep("map");
  };

  const handleStartProcessing = async () => {
    if (!csvData) return;
    
    setIsProcessing(true);
    
    try {
      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from("imports")
        .insert({
          filename: csvData.filename,
          row_count: csvData.rows.length,
          status: "processing",
          mapping_config: mapping,
        })
        .select()
        .single();

      if (importError) throw importError;

      // Process rows and insert companies
      let processed = 0;
      let skipped = 0;
      const batchSize = 100;

      for (let i = 0; i < csvData.rows.length; i += batchSize) {
        const batch = csvData.rows.slice(i, i + batchSize);
        const companies = batch.map((row) => {
          // Extract domain from website
          let domain: string | null = null;
          const websiteCol = Object.entries(mapping).find(([, target]) => target === "website")?.[0];
          if (websiteCol && row[websiteCol]) {
            try {
              const url = row[websiteCol].startsWith("http") 
                ? row[websiteCol] 
                : `https://${row[websiteCol]}`;
              domain = new URL(url).hostname.replace(/^www\./, "");
            } catch {
              domain = row[websiteCol].replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
            }
          }

          // Generate hash for deduplication
          const nameCol = Object.entries(mapping).find(([, target]) => target === "name")?.[0];
          const hashSource = domain || (nameCol ? row[nameCol] : "") || "";
          const companyHash = hashSource.toLowerCase().replace(/[^a-z0-9]/g, "");

          // Build company object based on mapping
          const company: Record<string, unknown> = {
            company_hash: companyHash || `unknown_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            import_id: importRecord.id,
            status: "pending",
          };

          Object.entries(mapping).forEach(([sourceCol, targetCol]) => {
            if (targetCol && row[sourceCol]) {
              if (targetCol === "categories" || targetCol === "tags" || targetCol === "certifications" || targetCol === "production_types") {
                company[targetCol] = row[sourceCol].split(",").map((s) => s.trim()).filter(Boolean);
              } else {
                company[targetCol] = row[sourceCol];
              }
            }
          });

          company.domain = domain;

          return company;
        });

        // Insert with upsert (skip duplicates)
        const { data: inserted, error } = await supabase
          .from("companies")
          .upsert(companies, { 
            onConflict: "company_hash",
            ignoreDuplicates: true,
          })
          .select("id");

        if (error) {
          console.error("Insert error:", error);
        }

        processed += inserted?.length || 0;
        skipped += batch.length - (inserted?.length || 0);
      }

      // Update import record
      await supabase
        .from("imports")
        .update({
          processed_count: processed,
          skipped_count: skipped,
          status: "completed",
        })
        .eq("id", importRecord.id);

      router.push(`/imports/${importRecord.id}`);
    } catch (error) {
      console.error("Processing error:", error);
      setIsProcessing(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/imports"
          className="inline-flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Imports
        </Link>
        <h1 className="text-3xl font-bold mb-2">New Import</h1>
        <p className="text-[var(--color-text-secondary)]">
          Upload a CSV file and map columns to target schema
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-4 mb-8">
        {["upload", "map", "confirm"].map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? "bg-[var(--color-accent)] text-white"
                  : i < ["upload", "map", "confirm"].indexOf(step)
                  ? "bg-green-500 text-white"
                  : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]"
              }`}
            >
              {i + 1}
            </div>
            <span className={`ml-2 font-medium ${step === s ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {i < 2 && <div className="w-12 h-px bg-[var(--color-border)] mx-4" />}
          </div>
        ))}
      </div>

      {/* Content */}
      {step === "upload" && (
        <CSVUploader onFileLoaded={handleFileLoaded} />
      )}

      {step === "map" && csvData && (
        <div className="space-y-6">
          <CSVPreview
            filename={csvData.filename}
            headers={csvData.headers}
            preview={csvData.preview}
            totalRows={csvData.rows.length}
          />
          
          <SchemaMapper
            sourceColumns={csvData.headers}
            mapping={mapping}
            onChange={setMapping}
          />

          <div className="flex justify-between">
            <button
              onClick={() => setStep("upload")}
              className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Back
            </button>
            <button
              onClick={() => setStep("confirm")}
              className="px-6 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium rounded-xl transition-colors flex items-center gap-2"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && csvData && (
        <div className="space-y-6">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Import Summary</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[var(--color-text-secondary)]">File</span>
                <p className="font-medium">{csvData.filename}</p>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)]">Rows</span>
                <p className="font-medium">{csvData.rows.length.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)]">Mapped Columns</span>
                <p className="font-medium">
                  {Object.values(mapping).filter(Boolean).length} / {csvData.headers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep("map")}
              className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Back
            </button>
            <button
              onClick={handleStartProcessing}
              disabled={isProcessing}
              className="px-6 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Start Import
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
