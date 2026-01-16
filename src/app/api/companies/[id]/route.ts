// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  
  // Get processing logs for this company
  const { data: logs } = await supabase
    .from('processing_logs')
    .select('*')
    .eq('company_id', id)
    .order('created_at', { ascending: false });
  
  return NextResponse.json({ company: data, logs: logs || [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();
  
  // Only allow updating certain fields
  const allowedFields = [
    'name', 'formatted_name', 'website', 'email', 'phone',
    'address', 'formatted_address', 'country_code', 'country_name',
    'description', 'enriched_description', 'company_type',
    'categories', 'tags', 'certifications', 'production_types',
    'accepts_startups', 'status'
  ];
  
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }
  
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }
  
  updates.updated_at = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ company: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', id);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ deleted: true });
}
