import { createClient } from '@/utils/supabase/server';
import MobileNavigationClient from './MobileNavigationClient';

export default async function MobileNavigation() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <MobileNavigationClient user={user} />;
}
