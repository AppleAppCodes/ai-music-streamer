import AuthenticatedHome from '@/components/home/AuthenticatedHome';
import GuestHome from '@/components/home/GuestHome';
import PrelaunchLanding from '@/components/launch/PrelaunchLanding';
import { isAdminUser } from '@/lib/admin';
import { getLocaleFromAcceptLanguage } from '@/lib/locale';
import { isPrelaunchLockEnabled } from '@/lib/prelaunch';
import { createClient } from '@/utils/supabase/server';
import { headers } from 'next/headers';

export default async function Home() {
  const supabase = await createClient();
  const headerStore = await headers();
  const { data: { user } } = await supabase.auth.getUser();
  const isPrelaunchLocked = isPrelaunchLockEnabled() && !isAdminUser(user);

  if (isPrelaunchLocked) {
    return (
      <PrelaunchLanding
        locale={getLocaleFromAcceptLanguage(headerStore.get('accept-language'))}
        signedIn={Boolean(user)}
      />
    );
  }

  if (user) {
    return <AuthenticatedHome />;
  }

  const { data: songs } = await supabase
    .from('songs')
    .select('id, title, artist_name, cover_url, plays')
    .order('plays', { ascending: false })
    .limit(16);

  return <GuestHome songs={songs || []} />;
}
