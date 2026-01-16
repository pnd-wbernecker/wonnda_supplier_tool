// @ts-nocheck
/**
 * Pipeline Runner - Orchestrates all pipeline steps
 */

import { createClient } from '@/lib/supabase/server';
import { runCleanStep } from './clean';
import { runResearchStep } from './research';
import { runValidateStep } from './validate';

export interface PipelineResult {
  importId: string;
  steps: {
    clean: { processed: number; errors: string[] } | null;
    research: { processed: number; errors: string[] } | null;
    validate: { processed: number; valid: number; invalid: number; errors: string[] } | null;
  };
  totalProcessed: number;
  totalErrors: number;
}

/**
 * Run the full pipeline for an import
 */
export async function runFullPipeline(importId: string): Promise<PipelineResult> {
  const supabase = await createClient();
  
  // Update import status to processing
  await supabase
    .from('imports')
    .update({ status: 'processing' })
    .eq('id', importId);
  
  const result: PipelineResult = {
    importId,
    steps: {
      clean: null,
      research: null,
      validate: null,
    },
    totalProcessed: 0,
    totalErrors: 0,
  };
  
  try {
    // Step 1: CLEAN
    console.log(`[Pipeline] Starting CLEAN step for import ${importId}`);
    const cleanResult = await runCleanStep(importId);
    result.steps.clean = cleanResult;
    result.totalProcessed += cleanResult.processed;
    result.totalErrors += cleanResult.errors.length;
    console.log(`[Pipeline] CLEAN completed: ${cleanResult.processed} processed, ${cleanResult.errors.length} errors`);
    
    // Step 2: RESEARCH
    console.log(`[Pipeline] Starting RESEARCH step for import ${importId}`);
    const researchResult = await runResearchStep(importId);
    result.steps.research = researchResult;
    result.totalProcessed += researchResult.processed;
    result.totalErrors += researchResult.errors.length;
    console.log(`[Pipeline] RESEARCH completed: ${researchResult.processed} processed, ${researchResult.errors.length} errors`);
    
    // Step 3: VALIDATE
    console.log(`[Pipeline] Starting VALIDATE step for import ${importId}`);
    const validateResult = await runValidateStep(importId);
    result.steps.validate = validateResult;
    result.totalErrors += validateResult.errors.length;
    console.log(`[Pipeline] VALIDATE completed: ${validateResult.valid} valid, ${validateResult.invalid} invalid`);
    
    // Update import status
    const finalStatus = result.totalErrors > 0 ? 'completed_with_errors' : 'completed';
    await supabase
      .from('imports')
      .update({ status: finalStatus })
      .eq('id', importId);
    
    return result;
    
  } catch (error) {
    // Update import status to failed
    await supabase
      .from('imports')
      .update({ status: 'failed' })
      .eq('id', importId);
    
    throw error;
  }
}

/**
 * Run a single pipeline step
 */
export async function runPipelineStep(
  importId: string,
  step: 'clean' | 'research' | 'validate'
): Promise<{ processed: number; errors: string[] }> {
  switch (step) {
    case 'clean':
      return runCleanStep(importId);
    case 'research':
      return runResearchStep(importId);
    case 'validate':
      const result = await runValidateStep(importId);
      return { processed: result.processed, errors: result.errors };
    default:
      throw new Error(`Unknown step: ${step}`);
  }
}

/**
 * Get pipeline status for an import
 */
export async function getPipelineStatus(importId: string): Promise<{
  import: { status: string; filename: string; row_count: number };
  companies: {
    total: number;
    pending: number;
    cleaned: number;
    researched: number;
    validated: number;
  };
}> {
  const supabase = await createClient();
  
  // Get import info
  const { data: importData } = await supabase
    .from('imports')
    .select('status, filename, row_count')
    .eq('id', importId)
    .single();
  
  if (!importData) {
    throw new Error('Import not found');
  }
  
  // Get company counts by status
  const { count: total } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .eq('import_id', importId);
  
  const { count: pending } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .eq('import_id', importId)
    .eq('status', 'pending');
  
  const { count: cleaned } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .eq('import_id', importId)
    .eq('status', 'cleaned');
  
  const { count: researched } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .eq('import_id', importId)
    .eq('status', 'researched');
  
  const { count: validated } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .eq('import_id', importId)
    .eq('status', 'validated');
  
  return {
    import: importData,
    companies: {
      total: total || 0,
      pending: pending || 0,
      cleaned: cleaned || 0,
      researched: researched || 0,
      validated: validated || 0,
    },
  };
}
