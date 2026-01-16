export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          company_hash: string;
          external_id: string | null;
          name: string | null;
          formatted_name: string | null;
          website: string | null;
          domain: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          formatted_address: string | null;
          country_code: string | null;
          country_name: string | null;
          description: string | null;
          enriched_description: string | null;
          company_type: "seller" | "buyer" | null;
          categories: string[];
          tags: string[];
          certifications: string[];
          production_types: string[];
          accepts_startups: boolean | null;
          status: "pending" | "cleaning" | "researching" | "validating" | "validated" | "failed";
          import_id: string | null;
          enrichment_sources: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_hash: string;
          external_id?: string | null;
          name?: string | null;
          formatted_name?: string | null;
          website?: string | null;
          domain?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          formatted_address?: string | null;
          country_code?: string | null;
          country_name?: string | null;
          description?: string | null;
          enriched_description?: string | null;
          company_type?: "seller" | "buyer" | null;
          categories?: string[];
          tags?: string[];
          certifications?: string[];
          production_types?: string[];
          accepts_startups?: boolean | null;
          status?: "pending" | "cleaning" | "researching" | "validating" | "validated" | "failed";
          import_id?: string | null;
          enrichment_sources?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_hash?: string;
          external_id?: string | null;
          name?: string | null;
          formatted_name?: string | null;
          website?: string | null;
          domain?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          formatted_address?: string | null;
          country_code?: string | null;
          country_name?: string | null;
          description?: string | null;
          enriched_description?: string | null;
          company_type?: "seller" | "buyer" | null;
          categories?: string[];
          tags?: string[];
          certifications?: string[];
          production_types?: string[];
          accepts_startups?: boolean | null;
          status?: "pending" | "cleaning" | "researching" | "validating" | "validated" | "failed";
          import_id?: string | null;
          enrichment_sources?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      imports: {
        Row: {
          id: string;
          filename: string;
          row_count: number;
          processed_count: number;
          skipped_count: number;
          failed_count: number;
          status: "pending" | "mapping" | "processing" | "completed" | "failed";
          mapping_config: Json | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          filename: string;
          row_count?: number;
          processed_count?: number;
          skipped_count?: number;
          failed_count?: number;
          status?: "pending" | "mapping" | "processing" | "completed" | "failed";
          mapping_config?: Json | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          filename?: string;
          row_count?: number;
          processed_count?: number;
          skipped_count?: number;
          failed_count?: number;
          status?: "pending" | "mapping" | "processing" | "completed" | "failed";
          mapping_config?: Json | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      column_rules: {
        Row: {
          id: string;
          column_name: string;
          rule_type: "required" | "format" | "enum" | "min_length" | "max_length" | "custom";
          rule_config: Json;
          error_message: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          column_name: string;
          rule_type: "required" | "format" | "enum" | "min_length" | "max_length" | "custom";
          rule_config?: Json;
          error_message?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          column_name?: string;
          rule_type?: "required" | "format" | "enum" | "min_length" | "max_length" | "custom";
          rule_config?: Json;
          error_message?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      prompts: {
        Row: {
          id: string;
          step: "understand" | "clean" | "research_address" | "research_description" | "validate";
          name: string;
          template: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          step: "understand" | "clean" | "research_address" | "research_description" | "validate";
          name: string;
          template: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          step?: "understand" | "clean" | "research_address" | "research_description" | "validate";
          name?: string;
          template?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      processing_logs: {
        Row: {
          id: string;
          company_id: string | null;
          import_id: string | null;
          step: string;
          input: Json | null;
          output: Json | null;
          llm_model: string | null;
          llm_response: Json | null;
          tokens_used: number | null;
          duration_ms: number | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          import_id?: string | null;
          step: string;
          input?: Json | null;
          output?: Json | null;
          llm_model?: string | null;
          llm_response?: Json | null;
          tokens_used?: number | null;
          duration_ms?: number | null;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          import_id?: string | null;
          step?: string;
          input?: Json | null;
          output?: Json | null;
          llm_model?: string | null;
          llm_response?: Json | null;
          tokens_used?: number | null;
          duration_ms?: number | null;
          error?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

// Helper types
export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"];
export type Import = Database["public"]["Tables"]["imports"]["Row"];
export type ImportInsert = Database["public"]["Tables"]["imports"]["Insert"];
export type ColumnRule = Database["public"]["Tables"]["column_rules"]["Row"];
export type Prompt = Database["public"]["Tables"]["prompts"]["Row"];
export type ProcessingLog = Database["public"]["Tables"]["processing_logs"]["Row"];
