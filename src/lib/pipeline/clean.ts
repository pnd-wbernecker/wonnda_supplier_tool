// @ts-nocheck
/**
 * CLEAN Step - OpenAI formatting and classification
 * Migrated from wonnda_archive: enrich_companies.txt
 */

import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import type { CleanedCompany } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CompanyForCleaning {
  company_hash: string;
  name: string;
  address: string | null;
  description: string | null;
  company_type: string | null;
}

/**
 * Get the CLEAN prompt from database
 * Prompts are stored exclusively in the database - no code fallbacks
 */
async function getCleanPrompt(): Promise<string> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('prompts')
    .select('template')
    .eq('step', 'clean')
    .eq('is_active', true)
    .single();
  
  if (error || !data?.template) {
    throw new Error('No active CLEAN prompt found in database. Please add one via /pipeline/prompts');
  }
  
  return data.template;
}

/**
 * Clean a batch of companies using OpenAI
 */
export async function cleanCompanyBatch(
  companies: CompanyForCleaning[]
): Promise<CleanedCompany[]> {
  const prompt = await getCleanPrompt();
  
  const userMessage = `Process these companies and return as JSON:\n\n${JSON.stringify(companies, null, 2)}`;
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');
    
    const parsed = JSON.parse(content);
    
    // Handle both array and object with 'companies' key
    const results: CleanedCompany[] = Array.isArray(parsed) 
      ? parsed 
      : parsed.companies || parsed.results || [];
    
    return results;
  } catch (error) {
    console.error('OpenAI clean error:', error);
    throw error;
  }
}

/**
 * Run CLEAN step for an import
 * Processes companies in batches
 */
export async function runCleanStep(importId: string): Promise<{
  processed: number;
  errors: string[];
}> {
  const supabase = await createClient();
  const errors: string[] = [];
  let processed = 0;
  
  // Get all pending companies for this import
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, company_hash, name, address, description, company_type')
    .eq('import_id', importId)
    .eq('status', 'pending');
  
  if (error) throw new Error(`Failed to fetch companies: ${error.message}`);
  if (!companies || companies.length === 0) {
    return { processed: 0, errors: ['No pending companies found'] };
  }
  
  // Process in batches of 15
  const batchSize = 15;
  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    
    try {
      const cleaned = await cleanCompanyBatch(batch.map(c => ({
        company_hash: c.company_hash,
        name: c.name,
        address: c.address,
        description: c.description,
        company_type: c.company_type,
      })));
      
      // Update each company with cleaned data
      for (const cleanedCompany of cleaned) {
        const original = batch.find(b => b.company_hash === cleanedCompany.company_hash);
        if (!original) continue;
        
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            formatted_name: cleanedCompany.formatted_name,
            formatted_address: cleanedCompany.formatted_address,
            company_type: cleanedCompany.company_type || original.company_type,
            enriched_description: cleanedCompany.enriched_description,
            status: 'cleaned',
            updated_at: new Date().toISOString(),
          })
          .eq('id', original.id);
        
        if (updateError) {
          errors.push(`Failed to update ${original.name}: ${updateError.message}`);
        } else {
          processed++;
        }
      }
    } catch (batchError) {
      const errorMsg = batchError instanceof Error ? batchError.message : 'Unknown error';
      errors.push(`Batch ${i / batchSize + 1} failed: ${errorMsg}`);
      
      // Try individual processing for failed batch
      for (const company of batch) {
        try {
          const [cleaned] = await cleanCompanyBatch([{
            company_hash: company.company_hash,
            name: company.name,
            address: company.address,
            description: company.description,
            company_type: company.company_type,
          }]);
          
          if (cleaned) {
            await supabase
              .from('companies')
              .update({
                formatted_name: cleaned.formatted_name,
                formatted_address: cleaned.formatted_address,
                company_type: cleaned.company_type || company.company_type,
                enriched_description: cleaned.enriched_description,
                status: 'cleaned',
                updated_at: new Date().toISOString(),
              })
              .eq('id', company.id);
            
            processed++;
          }
        } catch {
          errors.push(`Individual processing failed for: ${company.name}`);
        }
      }
    }
  }
  
  return { processed, errors };
}
