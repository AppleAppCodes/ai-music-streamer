import type { User as SupabaseUser } from '@supabase/supabase-js';

export function isAdminUser(user: Pick<SupabaseUser, 'app_metadata'> | null | undefined) {
  return user?.app_metadata?.role === 'admin';
}

export function isModUser(user: Pick<SupabaseUser, 'app_metadata'> | null | undefined) {
  return user?.app_metadata?.role === 'admin' || user?.app_metadata?.role === 'mod';
}
