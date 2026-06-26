import SidebarClient from './SidebarClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export default function Sidebar({
  user,
  appVersionLabel,
  customLogoUrl,
}: {
  user: SupabaseUser | null;
  appVersionLabel?: string;
  customLogoUrl?: string;
}) {
  return <SidebarClient user={user} appVersionLabel={appVersionLabel} customLogoUrl={customLogoUrl} />;
}
