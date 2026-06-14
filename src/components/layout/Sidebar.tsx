import SidebarClient from './SidebarClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export default function Sidebar({
  user,
  appVersionLabel,
}: {
  user: SupabaseUser | null;
  appVersionLabel?: string;
}) {
  return <SidebarClient user={user} appVersionLabel={appVersionLabel} />;
}
