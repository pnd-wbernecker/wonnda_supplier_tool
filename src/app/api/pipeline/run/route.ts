import { NextRequest, NextResponse } from 'next/server';
import { runFullPipeline, getPipelineStatus } from '@/lib/pipeline/runner';

export async function POST(request: NextRequest) {
  try {
    const { importId } = await request.json();
    
    if (!importId) {
      return NextResponse.json(
        { error: 'importId is required' },
        { status: 400 }
      );
    }
    
    const result = await runFullPipeline(importId);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Pipeline error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const importId = searchParams.get('importId');
    
    if (!importId) {
      return NextResponse.json(
        { error: 'importId is required' },
        { status: 400 }
      );
    }
    
    const status = await getPipelineStatus(importId);
    
    return NextResponse.json(status);
  } catch (error) {
    console.error('Pipeline status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}
