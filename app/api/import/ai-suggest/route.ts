import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { suggestColumnMapping, generateHeadersHash, AIMappingError } from '@/lib/import/ai-mapper';
import type { Json } from '@/lib/supabase/database.types';

// Rate limit configuration
const DAILY_AI_LIMIT = parseInt(process.env.AI_DAILY_LIMIT || '10', 10);

interface AISuggestRequest {
  sessionId: string;
  headers: string[];
  sampleRows: string[][];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AISuggestRequest;
    const { sessionId, headers, sampleRows } = body;

    // Validate request
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(headers) || headers.length === 0) {
      return NextResponse.json(
        { error: 'headers array is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(sampleRows) || sampleRows.length === 0) {
      return NextResponse.json(
        { error: 'sampleRows array is required' },
        { status: 400 }
      );
    }

    // Check rate limit
    const today = new Date().toISOString().split('T')[0];
    const { data: usageData } = await supabaseAdmin
      .from('ai_usage_tracking')
      .select('count')
      .eq('date', today)
      .eq('usage_type', 'column_mapping')
      .single();

    const currentUsage = usageData?.count || 0;
    const rateLimitRemaining = Math.max(0, DAILY_AI_LIMIT - currentUsage);

    // Check cache first
    const headersHash = generateHeadersHash(headers);
    const { data: cachedResult } = await supabaseAdmin
      .from('ai_mapping_cache')
      .select('*')
      .eq('headers_hash', headersHash)
      .single();

    if (cachedResult) {
      // Update cache hit count
      await supabaseAdmin
        .from('ai_mapping_cache')
        .update({
          hits: (cachedResult.hits || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', cachedResult.id);

      return NextResponse.json({
        suggestion: cachedResult.result,
        usedCache: true,
        rateLimitRemaining,
      });
    }

    // Check if rate limited (only for non-cached requests)
    if (currentUsage >= DAILY_AI_LIMIT) {
      return NextResponse.json(
        {
          error: 'Daily AI suggestion limit reached',
          rateLimitRemaining: 0,
        },
        { status: 429 }
      );
    }

    // Call AI mapper service
    const suggestion = await suggestColumnMapping(headers, sampleRows);

    // Cache the result
    await supabaseAdmin.from('ai_mapping_cache').insert({
      headers_hash: headersHash,
      headers: headers as unknown as Json,
      result: suggestion as unknown as Json,
      confidence: suggestion.confidence,
    });

    // Update usage tracking
    await supabaseAdmin
      .from('ai_usage_tracking')
      .upsert(
        {
          date: today,
          usage_type: 'column_mapping',
          count: currentUsage + 1,
        },
        {
          onConflict: 'date,usage_type',
        }
      );

    return NextResponse.json({
      suggestion,
      usedCache: false,
      rateLimitRemaining: rateLimitRemaining - 1,
    });
  } catch (error) {
    console.error('AI suggest error:', error);

    if (error instanceof AIMappingError) {
      const statusCode = error.code === 'RATE_LIMITED' ? 429 : 500;
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get AI suggestion' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return rate limit status
  const today = new Date().toISOString().split('T')[0];

  const { data: usageData } = await supabaseAdmin
    .from('ai_usage_tracking')
    .select('count')
    .eq('date', today)
    .eq('usage_type', 'column_mapping')
    .single();

  const currentUsage = usageData?.count || 0;
  const rateLimitRemaining = Math.max(0, DAILY_AI_LIMIT - currentUsage);

  return NextResponse.json({
    dailyLimit: DAILY_AI_LIMIT,
    used: currentUsage,
    remaining: rateLimitRemaining,
  });
}
