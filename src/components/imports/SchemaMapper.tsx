"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Wand2 } from "lucide-react";

const TARGET_COLUMNS = [
  { value: "name", label: "Name", description: "Company name", required: true },
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

// Auto-mapping hints based on common column names
const AUTO_MAP_HINTS: Record<string, string[]> = {
  name: ['name', 'company', 'company_name', 'companyname', 'firma', 'unternehmen'],
  website: ['website', 'url', 'web', 'homepage', 'site'],
  email: ['email', 'e-mail', 'mail', 'contact_email', 'contact'],
  phone: ['phone', 'tel', 'telephone', 'telefon', 'mobile'],
  address: ['address', 'adresse', 'street', 'location', 'anschrift'],
  country_code: ['country_code', 'countrycode', 'iso', 'country_iso'],
  country_name: ['country', 'countryname', 'country_name', 'land'],
  description: ['description', 'beschreibung', 'about', 'bio', 'info'],
  company_type: ['company_type', 'companytype', 'type', 'companytype1'],
  categories: ['categories', 'category', 'kategorie'],
  tags: ['tags', 'keywords', 'schlagworte'],
  external_id: ['id', 'company_id', 'companyid', 'external_id'],
};

interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
}

interface SchemaMapperProps {
  sourceColumns: string[];
  onMappingChange: (mappings: ColumnMapping[]) => void;
}

export function SchemaMapper({ sourceColumns, onMappingChange }: SchemaMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string | null>>({});

  // Auto-map on initial load
  useEffect(() => {
    const autoMapped: Record<string, string | null> = {};
    
    for (const sourceCol of sourceColumns) {
      const lowerCol = sourceCol.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      for (const [targetCol, hints] of Object.entries(AUTO_MAP_HINTS)) {
        if (hints.some(hint => lowerCol.includes(hint.replace(/[^a-z0-9]/g, '')))) {
          // Check if this target is already mapped
          const alreadyMapped = Object.values(autoMapped).includes(targetCol);
          if (!alreadyMapped) {
            autoMapped[sourceCol] = targetCol;
            break;
          }
        }
      }
      
      if (!autoMapped[sourceCol]) {
        autoMapped[sourceCol] = null;
      }
    }
    
    setMapping(autoMapped);
  }, [sourceColumns]);

  // Notify parent of mapping changes
  useEffect(() => {
    const mappings: ColumnMapping[] = Object.entries(mapping)
      .filter(([, target]) => target !== null)
      .map(([source, target]) => ({
        sourceColumn: source,
        targetColumn: target!,
      }));
    
    onMappingChange(mappings);
  }, [mapping, onMappingChange]);

  const handleMappingChange = (sourceCol: string, targetCol: string | null) => {
    setMapping(prev => ({
      ...prev,
      [sourceCol]: targetCol || null,
    }));
  };

  const autoMap = () => {
    const autoMapped: Record<string, string | null> = {};
    
    for (const sourceCol of sourceColumns) {
      const lowerCol = sourceCol.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      for (const [targetCol, hints] of Object.entries(AUTO_MAP_HINTS)) {
        if (hints.some(hint => lowerCol.includes(hint.replace(/[^a-z0-9]/g, '')))) {
          const alreadyMapped = Object.values(autoMapped).includes(targetCol);
          if (!alreadyMapped) {
            autoMapped[sourceCol] = targetCol;
            break;
          }
        }
      }
      
      if (!autoMapped[sourceCol]) {
        autoMapped[sourceCol] = null;
      }
    }
    
    setMapping(autoMapped);
  };

  const hasNameMapping = Object.values(mapping).includes('name');
  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">
          Map your CSV columns to the target schema. The &quot;Name&quot; column is required.
        </p>
        <button
          onClick={autoMap}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 rounded-lg transition"
        >
          <Wand2 size={14} />
          Auto-Map
        </button>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {sourceColumns.map((sourceCol) => (
          <div
            key={sourceCol}
            className="flex items-center gap-4 p-3 bg-gray-700/30 rounded-lg"
          >
            <div className="flex-1 min-w-0">
              <span className="font-mono text-sm truncate block text-gray-300">{sourceCol}</span>
            </div>
            
            <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
            
            <div className="flex-1">
              <select
                value={mapping[sourceCol] || ""}
                onChange={(e) => handleMappingChange(sourceCol, e.target.value || null)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-violet-500"
              >
                <option value="">— Skip —</option>
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
                      {target.label} {target.required ? '*' : ''} {isUsed ? "(mapped)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-gray-700 flex items-center justify-between text-sm">
        <span className="text-gray-400">
          {mappedCount} of {sourceColumns.length} columns mapped
        </span>
        {!hasNameMapping && (
          <span className="text-red-400">⚠ Name column is required</span>
        )}
        <button
          onClick={() => {
            const cleared: Record<string, string | null> = {};
            sourceColumns.forEach((col) => (cleared[col] = null));
            setMapping(cleared);
          }}
          className="text-gray-500 hover:text-gray-300"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
