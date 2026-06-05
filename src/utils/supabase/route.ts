import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { createClient as createServerClient } from './server';

export async function createRouteClient(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );
  }

  return createServerClient();
}
