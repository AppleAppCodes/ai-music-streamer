import MobileNavigationClient from './MobileNavigationClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export default function MobileNavigation({ user }: { user: SupabaseUser | null }) {
  return <MobileNavigationClient user={user} />;
}
