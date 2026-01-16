import { NextRequest, NextResponse } from 'next/server';
import { runValidateStep } from '@/lib/pipeline/validate';

export async function POST(request: NextRequest) {
  try {
    const { importId } = await request.json();
    
    if (!importId) {
      return NextResponse.json(
        { error: 'importId is required' },
        { status: 400 }
      );
    }
    
    const result = await runValidateStep(importId);
    
    // Return in format expected by frontend
    return NextResponse.json({
      processed: result.processed,
      valid: result.valid,
      invalid: result.invalid,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Validate step error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Validate step failed' },
      { status: 500 }
    );
  }
}
