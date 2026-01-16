// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  // Pagination
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;
  
  // Filters
  const status = searchParams.get('status');
  const importId = searchParams.get('import_id');
  const search = searchParams.get('search');
  const companyType = searchParams.get('company_type');
  
  // Build query
  let query = supabase
    .from('companies')
    .select('*', { count: 'exact' });
  
  if (status) {
    query = query.eq('status', status);
  }
  
  if (importId) {
    query = query.eq('import_id', importId);
  }
  
  if (companyType) {
    query = query.eq('company_type', companyType);
  }
  
  if (search) {
    query = query.or(`name.ilike.%${search}%,domain.ilike.%${search}%,formatted_name.ilike.%${search}%`);
  }
  
  // Execute with pagination
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({
    companies: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];
  const deleteAll = searchParams.get('all') === 'true';
  
  if (deleteAll) {
    // Delete all companies
    const { error, count } = await supabase
      .from('companies')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (neq trick)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ deleted: count || 'all' });
  }
  
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
  }
  
  const { error } = await supabase
    .from('companies')
    .delete()
    .in('id', ids);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ deleted: ids.length });
}
