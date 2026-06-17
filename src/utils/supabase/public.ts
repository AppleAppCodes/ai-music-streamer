import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

let publicClient: SupabaseClient | null = null;

export function createPublicClient() {
  if (!publicClient) {
    publicClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return publicClient;
}
