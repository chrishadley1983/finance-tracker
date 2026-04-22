import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();

  const url = new URL('/login', request.url);
  return NextResponse.redirect(url);
}
