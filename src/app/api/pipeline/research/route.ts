import { NextRequest, NextResponse } from 'next/server';
import { runResearchStep } from '@/lib/pipeline/research';

export async function POST(request: NextRequest) {
  try {
    const { importId } = await request.json();
    
    if (!importId) {
      return NextResponse.json(
        { error: 'importId is required' },
        { status: 400 }
      );
    }
    
    const result = await runResearchStep(importId);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Research step error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Research step failed' },
      { status: 500 }
    );
  }
}
