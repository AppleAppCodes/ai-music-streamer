import AuthenticatedHome from '@/components/home/AuthenticatedHome';
import GuestHome from '@/components/home/GuestHome';
import { createClient } from '@/utils/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
