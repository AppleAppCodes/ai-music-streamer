import SidebarClient from './SidebarClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export default function Sidebar({ user }: { user: SupabaseUser | null }) {
  return <SidebarClient user={user} />;
}
