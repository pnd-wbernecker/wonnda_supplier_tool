// @ts-nocheck
/**
 * VALIDATE Step - Check companies against column rules
 */

import { createClient } from '@/lib/supabase/server';

interface ColumnRule {
  id: string;
  column_name: string;
  rule_type: 'required' | 'format' | 'enum' | 'min_length' | 'max_length';
  rule_config: Record<string, unknown>;
  error_message: string;
  is_active: boolean;
}

interface ValidationError {
  column: string;
  rule: string;
  message: string;
}

interface CompanyForValidation {
  id: string;
  company_hash: string;
  name: string;
  [key: string]: unknown;
}

/**
 * Get active validation rules
 */
async function getActiveRules(): Promise<ColumnRule[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('column_rules')
    .select('*')
    .eq('is_active', true);
  
  if (error) throw new Error(`Failed to fetch rules: ${error.message}`);
  return data || [];
}

/**
 * Validate a single value against a rule
 */
function validateValue(
  value: unknown,
  rule: ColumnRule
): ValidationError | null {
  const { column_name, rule_type, rule_config, error_message } = rule;
  
  switch (rule_type) {
    case 'required':
      if (value === null || value === undefined || value === '') {
        return { column: column_name, rule: rule_type, message: error_message };
      }
      break;
      
    case 'format':
      if (value && typeof value === 'string') {
        const pattern = rule_config.pattern as string;
        if (pattern && !new RegExp(pattern).test(value)) {
          return { column: column_name, rule: rule_type, message: error_message };
        }
      }
      break;
      
    case 'enum':
      if (value) {
        const allowedValues = rule_config.values as string[];
        if (allowedValues && !allowedValues.includes(value as string)) {
          return { column: column_name, rule: rule_type, message: error_message };
        }
      }
      break;
      
    case 'min_length':
      if (value && typeof value === 'string') {
        const min = rule_config.min as number;
        if (min && value.length < min) {
          return { column: column_name, rule: rule_type, message: error_message };
        }
      }
      break;
      
    case 'max_length':
      if (value && typeof value === 'string') {
        const max = rule_config.max as number;
        if (max && value.length > max) {
          return { column: column_name, rule: rule_type, message: error_message };
        }
      }
      break;
  }
  
  return null;
}

/**
 * Validate a company against all rules
 */
function validateCompany(
  company: CompanyForValidation,
  rules: ColumnRule[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  for (const rule of rules) {
    const value = company[rule.column_name];
    const error = validateValue(value, rule);
    if (error) {
      errors.push(error);
    }
  }
  
  return errors;
}

/**
 * Run VALIDATE step for an import
 */
export async function runValidateStep(importId: string): Promise<{
  processed: number;
  valid: number;
  invalid: number;
  errors: string[];
}> {
  const supabase = await createClient();
  const stepErrors: string[] = [];
  let processed = 0;
  let valid = 0;
  let invalid = 0;
  
  // Get rules
  const rules = await getActiveRules();
  if (rules.length === 0) {
    // No rules = everything is valid
    const { error } = await supabase
      .from('companies')
      .update({ status: 'validated', updated_at: new Date().toISOString() })
      .eq('import_id', importId)
      .in('status', ['cleaned', 'researched']);
    
    if (error) {
      return { processed: 0, valid: 0, invalid: 0, errors: [error.message] };
    }
    
    const { count } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('import_id', importId)
      .eq('status', 'validated');
    
    return { processed: count || 0, valid: count || 0, invalid: 0, errors: [] };
  }
  
  // Get companies to validate
  const { data: companies, error } = await supabase
    .from('companies')
    .select('*')
    .eq('import_id', importId)
    .in('status', ['cleaned', 'researched']);
  
  if (error) throw new Error(`Failed to fetch companies: ${error.message}`);
  if (!companies || companies.length === 0) {
    return { processed: 0, valid: 0, invalid: 0, errors: ['No companies to validate'] };
  }
  
  // Validate each company
  for (const company of companies) {
    const validationErrors = validateCompany(company as CompanyForValidation, rules);
    
    if (validationErrors.length === 0) {
      // Valid - update status
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          status: 'validated',
          updated_at: new Date().toISOString(),
        })
        .eq('id', company.id);
      
      if (updateError) {
        stepErrors.push(`Failed to update ${company.name}: ${updateError.message}`);
      } else {
        valid++;
      }
    } else {
      // Invalid - log errors and keep in previous status
      invalid++;
      
      // Log validation errors
      await supabase
        .from('processing_logs')
        .insert({
          company_id: company.id,
          import_id: importId,
          step: 'validate',
          input: { company_hash: company.company_hash },
          output: { valid: false, errors: validationErrors },
        });
      
      stepErrors.push(
        `${company.name}: ${validationErrors.map(e => e.message).join(', ')}`
      );
    }
    
    processed++;
  }
  
  return { processed, valid, invalid, errors: stepErrors };
}
