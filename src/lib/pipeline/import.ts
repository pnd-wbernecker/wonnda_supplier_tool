/**
 * Import processing logic
 * CSV → Mapping → Dedupe → Supabase
 */

import { createClient } from '@/lib/supabase/server';
import { extractDomain } from '@/lib/utils/domain';
import { computeCompanyHash } from '@/lib/utils/hash';
import { validateEmail } from '@/lib/utils/email';
import type { 
  RawCompanyData, 
  ColumnMapping, 
  MappedCompany, 
  ProcessedCompany,
  ImportResult 
} from './types';

/**
 * Apply column mapping to raw CSV data
 */
export function applyMapping(
  rawData: RawCompanyData[],
  mappings: ColumnMapping[]
): MappedCompany[] {
  return rawData.map(row => {
    const mapped: Record<string, unknown> = {};
    
    for (const { sourceColumn, targetColumn } of mappings) {
      const value = row[sourceColumn];
      
      if (value !== null && value !== undefined && value !== '') {
        // Handle array fields
        if (['categories', 'tags', 'certifications', 'production_types'].includes(targetColumn)) {
          // Split by comma if string, or use as-is if already array
          mapped[targetColumn] = typeof value === 'string' 
            ? value.split(',').map(v => v.trim()).filter(Boolean)
            : value;
        }
        // Handle boolean
        else if (targetColumn === 'accepts_startups') {
          mapped[targetColumn] = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
        }
        // String fields
        else {
          mapped[targetColumn] = value;
        }
      }
    }
    
    return mapped as MappedCompany;
  }).filter(row => row.name); // Must have name
}

/**
 * Process companies: extract domain, compute hash, validate email
 */
export async function processCompanies(
  companies: MappedCompany[],
  importId: string
): Promise<ProcessedCompany[]> {
  const processed: ProcessedCompany[] = [];
  
  for (const company of companies) {
    const domain = extractDomain(company.website);
    const hash = await computeCompanyHash(domain, company.name);
    const validatedEmail = validateEmail(company.email);
    
    processed.push({
      ...company,
      company_hash: hash,
      domain,
      validated_email: validatedEmail,
      status: 'pending',
      import_id: importId,
    });
  }
  
  return processed;
}

/**
 * Deduplicate against existing companies in Supabase
 * Returns only new companies (not already in DB)
 */
export async function deduplicateCompanies(
  companies: ProcessedCompany[]
): Promise<{ new: ProcessedCompany[]; duplicates: ProcessedCompany[] }> {
  const supabase = await createClient();
  
  // Get all hashes
  const hashes = companies.map(c => c.company_hash);
  
  // Check which already exist
  const { data: existing } = await supabase
    .from('companies')
    .select('company_hash')
    .in('company_hash', hashes);
  
  const existingHashes = new Set(existing?.map(e => e.company_hash) || []);
  
  // Also dedupe within the import (keep first occurrence)
  const seenHashes = new Set<string>();
  const newCompanies: ProcessedCompany[] = [];
  const duplicates: ProcessedCompany[] = [];
  
  for (const company of companies) {
    if (existingHashes.has(company.company_hash) || seenHashes.has(company.company_hash)) {
      duplicates.push(company);
    } else {
      seenHashes.add(company.company_hash);
      newCompanies.push(company);
    }
  }
  
  return { new: newCompanies, duplicates };
}

/**
 * Insert companies into Supabase
 */
export async function insertCompanies(
  companies: ProcessedCompany[]
): Promise<{ success: number; errors: Array<{ hash: string; error: string }> }> {
  if (companies.length === 0) {
    return { success: 0, errors: [] };
  }
  
  const supabase = await createClient();
  const errors: Array<{ hash: string; error: string }> = [];
  let success = 0;
  
  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    
    const insertData = batch.map(c => ({
      company_hash: c.company_hash,
      external_id: c.external_id || null,
      name: c.name,
      website: c.website || null,
      domain: c.domain,
      email: c.validated_email,
      phone: c.phone || null,
      address: c.address || null,
      country_code: c.country_code || null,
      country_name: c.country_name || null,
      description: c.description || null,
      company_type: c.company_type || null,
      categories: c.categories || null,
      tags: c.tags || null,
      certifications: c.certifications || null,
      production_types: c.production_types || null,
      accepts_startups: c.accepts_startups || null,
      status: 'pending',
      import_id: c.import_id,
    }));
    
    const { error } = await supabase
      .from('companies')
      .insert(insertData);
    
    if (error) {
      // Try individual inserts to find which ones failed
      for (const company of batch) {
        const { error: singleError } = await supabase
          .from('companies')
          .insert({
            company_hash: company.company_hash,
            external_id: company.external_id || null,
            name: company.name,
            website: company.website || null,
            domain: company.domain,
            email: company.validated_email,
            phone: company.phone || null,
            address: company.address || null,
            country_code: company.country_code || null,
            country_name: company.country_name || null,
            description: company.description || null,
            company_type: company.company_type || null,
            categories: company.categories || null,
            tags: company.tags || null,
            certifications: company.certifications || null,
            production_types: company.production_types || null,
            accepts_startups: company.accepts_startups || null,
            status: 'pending',
            import_id: company.import_id,
          });
        
        if (singleError) {
          errors.push({ hash: company.company_hash, error: singleError.message });
        } else {
          success++;
        }
      }
    } else {
      success += batch.length;
    }
  }
  
  return { success, errors };
}

/**
 * Create a new import record
 */
export async function createImport(
  filename: string,
  rowCount: number,
  mappingConfig: ColumnMapping[]
): Promise<string> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('imports')
    .insert({
      filename,
      row_count: rowCount,
      processed_count: 0,
      skipped_count: 0,
      status: 'pending',
      mapping_config: mappingConfig,
    })
    .select('id')
    .single();
  
  if (error) throw new Error(`Failed to create import: ${error.message}`);
  return data.id;
}

/**
 * Update import statistics
 */
export async function updateImportStats(
  importId: string,
  stats: { processed_count?: number; skipped_count?: number; status?: string }
): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from('imports')
    .update(stats)
    .eq('id', importId);
}

/**
 * Full import pipeline
 */
export async function runImport(
  rawData: RawCompanyData[],
  mappings: ColumnMapping[],
  filename: string
): Promise<ImportResult> {
  // 1. Create import record
  const importId = await createImport(filename, rawData.length, mappings);
  
  try {
    // 2. Apply mapping
    const mapped = applyMapping(rawData, mappings);
    
    // 3. Process (domain, hash, email validation)
    const processed = await processCompanies(mapped, importId);
    
    // 4. Deduplicate
    const { new: newCompanies, duplicates } = await deduplicateCompanies(processed);
    
    // 5. Insert new companies
    const { success, errors } = await insertCompanies(newCompanies);
    
    // 6. Update import stats
    await updateImportStats(importId, {
      processed_count: success,
      skipped_count: duplicates.length,
      status: errors.length > 0 ? 'completed_with_errors' : 'completed',
    });
    
    return {
      import_id: importId,
      total_rows: rawData.length,
      processed_count: success,
      skipped_count: duplicates.length,
      error_count: errors.length,
      errors: errors.map((e, i) => ({ row: i, error: e.error })),
    };
  } catch (error) {
    await updateImportStats(importId, { status: 'failed' });
    throw error;
  }
}
