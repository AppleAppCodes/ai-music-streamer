import { createClient } from '@/utils/supabase/server';
import SidebarClient from './SidebarClient';

export default async function Sidebar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <SidebarClient user={user} />;
}
