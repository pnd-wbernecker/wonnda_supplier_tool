/**
 * RESEARCH Step - Perplexity web search for missing data
 * Migrated from wonnda_archive: retrieve_address.txt, create_description.txt
 */

import { createClient } from '@/lib/supabase/server';
import type { ResearchedCompany } from './types';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

interface CompanyForResearch {
  id: string;
  company_hash: string;
  name: string;
  domain: string | null;
  formatted_address: string | null;
  enriched_description: string | null;
  country_name: string | null;
}

/**
 * Get prompts from database
 */
async function getResearchPrompts(): Promise<{ address: string; description: string }> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('prompts')
    .select('step, template')
    .in('step', ['research_address', 'research_description'])
    .eq('is_active', true);
  
  const addressPrompt = data?.find(p => p.step === 'research_address')?.template || getDefaultAddressPrompt();
  const descriptionPrompt = data?.find(p => p.step === 'research_description')?.template || getDefaultDescriptionPrompt();
  
  return { address: addressPrompt, description: descriptionPrompt };
}

function getDefaultAddressPrompt(): string {
  return `Extract only the official, complete address of the company '{company_name}' from the company's website, checking sections like 'Contact Us', 'About Us', or 'Legal Notice'. The address should be formatted for use in Google Maps (e.g., "House Number, Street, City, State, Zip, Country").

If no suitable address is found, leave the output completely blank.

Constrain the search to exclusively the following domain: '{domain}'.

If multiple addresses are listed (e.g., various branches), return only the one located in the company's country of origin: {country}.`;
}

function getDefaultDescriptionPrompt(): string {
  return `Write a unique, friendly, and engaging company description in 150 words or fewer for the company '{company_name}'. Describe what the company offers, its strengths, and what makes it valuable or unique. Avoid generic phrases; focus on specific offerings, products, or services. Use a professional but approachable tone.

Constrain the search to exclusively the following domain: {domain}

Return only the description text, nothing else. If you cannot find enough information, return an empty response.`;
}

/**
 * Call Perplexity API
 */
async function callPerplexity(
  prompt: string,
  searchDomainFilter?: string
): Promise<{ content: string; sources: string[] }> {
  const apiKey = process.env.PERPLEXITY_TOKEN;
  if (!apiKey) throw new Error('PERPLEXITY_TOKEN not configured');
  
  const body: Record<string, unknown> = {
    model: 'sonar',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 500,
  };
  
  // Add domain filter if provided
  if (searchDomainFilter) {
    body.search_domain_filter = [searchDomainFilter];
  }
  
  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity API error: ${error}`);
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const sources = data.citations || [];
  
  return { content: content.trim(), sources };
}

/**
 * Research missing address for a company
 */
async function researchAddress(
  company: CompanyForResearch,
  promptTemplate: string
): Promise<{ address: string | null; sources: string[] }> {
  if (!company.domain) {
    return { address: null, sources: [] };
  }
  
  const prompt = promptTemplate
    .replace('{company_name}', company.name)
    .replace('{domain}', company.domain)
    .replace('{country}', company.country_name || 'unknown');
  
  try {
    const { content, sources } = await callPerplexity(prompt, company.domain);
    
    // If response is too short or contains "not found" type phrases, return null
    if (!content || content.length < 10 || 
        content.toLowerCase().includes('not found') ||
        content.toLowerCase().includes('could not find') ||
        content.toLowerCase().includes('no address')) {
      return { address: null, sources: [] };
    }
    
    return { address: content, sources };
  } catch (error) {
    console.error(`Address research failed for ${company.name}:`, error);
    return { address: null, sources: [] };
  }
}

/**
 * Research missing description for a company
 */
async function researchDescription(
  company: CompanyForResearch,
  promptTemplate: string
): Promise<{ description: string | null; sources: string[] }> {
  if (!company.domain) {
    return { description: null, sources: [] };
  }
  
  const prompt = promptTemplate
    .replace('{company_name}', company.name)
    .replace('{domain}', company.domain);
  
  try {
    const { content, sources } = await callPerplexity(prompt, company.domain);
    
    // Validate response
    if (!content || content.length < 30) {
      return { description: null, sources: [] };
    }
    
    return { description: content, sources };
  } catch (error) {
    console.error(`Description research failed for ${company.name}:`, error);
    return { description: null, sources: [] };
  }
}

/**
 * Run RESEARCH step for an import
 * Only researches companies with missing data
 */
export async function runResearchStep(importId: string): Promise<{
  processed: number;
  errors: string[];
}> {
  const supabase = await createClient();
  const errors: string[] = [];
  let processed = 0;
  
  // Get companies that need research (cleaned but missing address or description)
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, company_hash, name, domain, formatted_address, enriched_description, country_name')
    .eq('import_id', importId)
    .eq('status', 'cleaned')
    .or('formatted_address.is.null,enriched_description.is.null');
  
  if (error) throw new Error(`Failed to fetch companies: ${error.message}`);
  if (!companies || companies.length === 0) {
    return { processed: 0, errors: ['No companies need research'] };
  }
  
  const prompts = await getResearchPrompts();
  
  // Process one at a time to respect rate limits
  for (const company of companies) {
    const updates: Partial<ResearchedCompany> = {};
    const allSources: string[] = [];
    
    try {
      // Research address if missing
      if (!company.formatted_address) {
        const { address, sources } = await researchAddress(company, prompts.address);
        if (address) {
          updates.formatted_address = address;
          allSources.push(...sources);
        }
      }
      
      // Research description if missing
      if (!company.enriched_description) {
        const { description, sources } = await researchDescription(company, prompts.description);
        if (description) {
          updates.enriched_description = description;
          allSources.push(...sources);
        }
      }
      
      // Update company
      if (Object.keys(updates).length > 0 || allSources.length > 0) {
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            ...updates,
            enrichment_sources: allSources.length > 0 ? allSources : undefined,
            status: 'researched',
            updated_at: new Date().toISOString(),
          })
          .eq('id', company.id);
        
        if (updateError) {
          errors.push(`Failed to update ${company.name}: ${updateError.message}`);
        } else {
          processed++;
        }
      } else {
        // No research needed, just update status
        await supabase
          .from('companies')
          .update({ status: 'researched', updated_at: new Date().toISOString() })
          .eq('id', company.id);
        processed++;
      }
      
      // Rate limit: wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (companyError) {
      const errorMsg = companyError instanceof Error ? companyError.message : 'Unknown error';
      errors.push(`Research failed for ${company.name}: ${errorMsg}`);
    }
  }
  
  return { processed, errors };
}
