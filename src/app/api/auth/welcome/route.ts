import { NextRequest, NextResponse } from 'next/server';
import {
  sendWelcomeEmailForUser,
  WelcomeEmailProviderNotConfiguredError,
} from '@/lib/welcome-email';
import { getLocaleFromAcceptLanguage } from '@/lib/locale';
import { createRouteClient } from '@/utils/supabase/route';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const supabase = await createRouteClient(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401, headers: corsHeaders },
    );
  }

  try {
    const locale = getLocaleFromAcceptLanguage(request.headers.get('accept-language'));
    const result = await sendWelcomeEmailForUser(supabase, user, locale);
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    if (error instanceof WelcomeEmailProviderNotConfiguredError) {
      return NextResponse.json(
        { error: 'Welcome email provider is not configured' },
        { status: 503, headers: corsHeaders },
      );
    }

    console.error('[POST /api/auth/welcome]', error);
    return NextResponse.json(
      { error: 'Failed to send welcome email' },
      { status: 500, headers: corsHeaders },
    );
  }
}
