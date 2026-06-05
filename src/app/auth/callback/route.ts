import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmailForUser } from '@/lib/welcome-email';
import { createClient } from '@/utils/supabase/server';

function getSafeNextPath(value: string | null) {
  if (!value?.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = getSafeNextPath(requestUrl.searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const loginUrl = new URL('/login', requestUrl.origin);
      loginUrl.searchParams.set('error', 'google_oauth_failed');
      return NextResponse.redirect(loginUrl);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await sendWelcomeEmailForUser(supabase, user).catch((welcomeError) => {
        console.error('[GET /auth/callback] Welcome email failed', welcomeError);
      });
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
