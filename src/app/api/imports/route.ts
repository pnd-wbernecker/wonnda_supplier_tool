import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runImport } from '@/lib/pipeline/import';
import type { ColumnMapping, RawCompanyData } from '@/lib/pipeline/types';

export async function GET() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('imports')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ imports: data });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, mappings, filename } = body as {
      data: RawCompanyData[];
      mappings: ColumnMapping[];
      filename: string;
    };
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'No data provided' },
        { status: 400 }
      );
    }
    
    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return NextResponse.json(
        { error: 'No column mappings provided' },
        { status: 400 }
      );
    }
    
    // Check if 'name' is mapped (required)
    const hasNameMapping = mappings.some(m => m.targetColumn === 'name');
    if (!hasNameMapping) {
      return NextResponse.json(
        { error: 'Name column mapping is required' },
        { status: 400 }
      );
    }
    
    const result = await runImport(data, mappings, filename || 'unnamed.csv');
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
