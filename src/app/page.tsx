import AuthenticatedHome from '@/components/home/AuthenticatedHome';
import GuestHome from '@/components/home/GuestHome';
import PrelaunchLanding from '@/components/launch/PrelaunchLanding';
import { isAdminUser } from '@/lib/admin';
import { getLocaleFromAcceptLanguage } from '@/lib/locale';
import { loadHomeInitialData } from '@/lib/public-music-data';
import { isPrelaunchLockEnabled, isUserWhitelisted } from '@/lib/prelaunch';
import { createClient } from '@/utils/supabase/server';
import { headers } from 'next/headers';

export default async function Home() {
  const supabase = await createClient();
  const headerStore = await headers();
  const { data: { user } } = await supabase.auth.getUser();
  const isPrelaunchLocked = isPrelaunchLockEnabled() && !isAdminUser(user) && !isUserWhitelisted(user?.email);

  if (isPrelaunchLocked) {
    return (
      <PrelaunchLanding
        locale={getLocaleFromAcceptLanguage(headerStore.get('accept-language'))}
        signedIn={Boolean(user)}
      />
    );
  }

  if (user) {
    const initialHomeData = await loadHomeInitialData(supabase, user.id);
    return <AuthenticatedHome initialHomeData={initialHomeData} />;
  }

  const { data: songs } = await supabase
    .from('songs')
    .select('id, title, artist_name, cover_url, plays')
    .order('plays', { ascending: false })
    .limit(16);

  return <GuestHome songs={songs || []} />;
}
