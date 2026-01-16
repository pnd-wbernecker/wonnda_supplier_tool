/**
 * Pipeline types
 */

export interface RawCompanyData {
  [key: string]: string | null | undefined;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
}

export interface MappedCompany {
  // Required fields
  name: string;
  
  // Optional fields from CSV
  external_id?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  country_code?: string;
  country_name?: string;
  description?: string;
  categories?: string[];
  tags?: string[];
  certifications?: string[];
  production_types?: string[];
  accepts_startups?: boolean;
  company_type?: string;
}

export interface ProcessedCompany extends MappedCompany {
  // Computed fields
  company_hash: string;
  domain: string | null;
  validated_email: string | null;
  
  // Status tracking
  status: 'pending' | 'cleaned' | 'researched' | 'validated';
  import_id: string;
}

export interface SkippedCompany {
  name: string;
  domain: string | null;
  company_hash: string;
  reason: 'duplicate_in_db' | 'duplicate_in_csv' | 'missing_name';
}

export interface ImportResult {
  import_id: string;
  total_rows: number;
  processed_count: number;
  skipped_count: number;
  error_count: number;
  skipped_companies: SkippedCompany[];
  errors: Array<{ row: number; error: string }>;
}

export interface PipelineStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  processed: number;
  total: number;
  errors: string[];
}

export interface PipelineProgress {
  step: 'import' | 'clean' | 'research' | 'validate';
  status: 'running' | 'completed' | 'failed';
  current: number;
  total: number;
  message: string;
  logs: string[];
}

// LLM Response types
export interface CleanedCompany {
  company_hash: string;
  formatted_name: string;
  formatted_address: string | null;
  company_type: 'seller' | 'buyer' | null;
  enriched_description: string | null;
}

export interface ResearchedCompany {
  company_hash: string;
  formatted_address?: string | null;
  enriched_description?: string | null;
  enrichment_sources?: string[];
}

// Import Report
export interface ImportReport {
  import_id: string;
  filename: string;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  
  summary: {
    total_rows: number;
    imported: number;
    skipped: number;
    errors: number;
  };
  
  pipeline: {
    clean: { processed: number; errors: number };
    research: { processed: number; errors: number };
    validate: { valid: number; invalid: number };
  };
  
  skipped_companies: SkippedCompany[];
  error_details: Array<{ company: string; error: string }>;
}
