"use client";

import { ArrowRight } from "lucide-react";

const TARGET_COLUMNS = [
  { value: "name", label: "Name", description: "Company name" },
  { value: "website", label: "Website", description: "Company URL" },
  { value: "email", label: "Email", description: "Contact email" },
  { value: "phone", label: "Phone", description: "Phone number" },
  { value: "address", label: "Address", description: "Physical address" },
  { value: "country_code", label: "Country Code", description: "ISO code (DE, US)" },
  { value: "country_name", label: "Country Name", description: "Full country name" },
  { value: "description", label: "Description", description: "Company description" },
  { value: "company_type", label: "Company Type", description: "seller or buyer" },
  { value: "categories", label: "Categories", description: "Product categories (comma-separated)" },
  { value: "tags", label: "Tags", description: "Keywords (comma-separated)" },
  { value: "certifications", label: "Certifications", description: "e.g. bio, fairtrade" },
  { value: "production_types", label: "Production Types", description: "e.g. wholesale, private_label" },
  { value: "accepts_startups", label: "Accepts Startups", description: "Boolean" },
  { value: "external_id", label: "External ID", description: "Original ID from source" },
];

interface SchemaMapperProps {
  sourceColumns: string[];
  mapping: Record<string, string | null>;
  onChange: (mapping: Record<string, string | null>) => void;
}

export function SchemaMapper({ sourceColumns, mapping, onChange }: SchemaMapperProps) {
  const handleMappingChange = (sourceCol: string, targetCol: string | null) => {
    onChange({
      ...mapping,
      [sourceCol]: targetCol || null,
    });
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
      <h2 className="font-semibold mb-4">Map Columns to Target Schema</h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Map your CSV columns to the target database schema. Unmapped columns will be ignored.
      </p>

      <div className="space-y-3">
        {sourceColumns.map((sourceCol) => (
          <div
            key={sourceCol}
            className="flex items-center gap-4 p-3 bg-[var(--color-surface-elevated)] rounded-xl"
          >
            <div className="flex-1 min-w-0">
              <span className="font-mono text-sm truncate block">{sourceCol}</span>
            </div>
            
            <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
            
            <div className="flex-1">
              <select
                value={mapping[sourceCol] || ""}
                onChange={(e) => handleMappingChange(sourceCol, e.target.value || null)}
                className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-accent)]"
              >
                <option value="">— Skip this column —</option>
                {TARGET_COLUMNS.map((target) => {
                  const isUsed = Object.entries(mapping).some(
                    ([key, val]) => val === target.value && key !== sourceCol
                  );
                  return (
                    <option
                      key={target.value}
                      value={target.value}
                      disabled={isUsed}
                    >
                      {target.label} {isUsed ? "(already mapped)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex items-center justify-between text-sm">
        <span className="text-[var(--color-text-secondary)]">
          {Object.values(mapping).filter(Boolean).length} of {sourceColumns.length} columns mapped
        </span>
        <button
          onClick={() => {
            const cleared: Record<string, string | null> = {};
            sourceColumns.forEach((col) => (cleared[col] = null));
            onChange(cleared);
          }}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
