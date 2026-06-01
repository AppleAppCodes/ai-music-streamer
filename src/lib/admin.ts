import type { User as SupabaseUser } from '@supabase/supabase-js';

const ADMIN_EMAILS = [
  process.env.NEXT_PUBLIC_ADMIN_EMAIL,
  'david.hein94@gmail.com',
  'heindavid91@gmail.com',
  'admin@ai-music.com',
]
  .filter((email): email is string => Boolean(email))
  .map((email) => email.toLowerCase());

export function isAdminUser(user: Pick<SupabaseUser, 'app_metadata' | 'email'> | null | undefined) {
  const email = user?.email?.trim().toLowerCase();

  return Boolean(
    user?.app_metadata?.role === 'admin' ||
    (email && (ADMIN_EMAILS.includes(email) || email.includes('admin')))
  );
}
