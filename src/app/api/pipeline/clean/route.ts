import { NextRequest, NextResponse } from 'next/server';
import { runCleanStep } from '@/lib/pipeline/clean';

export async function POST(request: NextRequest) {
  try {
    const { importId } = await request.json();
    
    if (!importId) {
      return NextResponse.json(
        { error: 'importId is required' },
        { status: 400 }
      );
    }
    
    const result = await runCleanStep(importId);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Clean step error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Clean step failed' },
      { status: 500 }
    );
  }
}
