import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { format = 'csv', filters = {} } = await request.json();
  
  // Build query
  let query = supabase
    .from('companies')
    .select('*');
  
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters.import_id) {
    query = query.eq('import_id', filters.import_id);
  }
  
  if (filters.company_type) {
    query = query.eq('company_type', filters.company_type);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'No data to export' }, { status: 404 });
  }
  
  if (format === 'json') {
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="companies.json"',
      },
    });
  }
  
  // CSV format
  const headers = [
    'name', 'formatted_name', 'website', 'domain', 'email', 'phone',
    'address', 'formatted_address', 'country_code', 'country_name',
    'description', 'enriched_description', 'company_type',
    'categories', 'tags', 'status'
  ];
  
  const csvRows = [headers.join(',')];
  
  for (const company of data) {
    const row = headers.map(header => {
      const value = company[header];
      if (value === null || value === undefined) return '';
      if (Array.isArray(value)) return `"${value.join('; ')}"`;
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(row.join(','));
  }
  
  return new NextResponse(csvRows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="companies.csv"',
    },
  });
}
