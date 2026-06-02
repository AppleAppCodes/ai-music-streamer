import AuthenticatedHome from '@/components/home/AuthenticatedHome';
import GuestHome from '@/components/home/GuestHome';
import { createClient } from '@/utils/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const [
    { data: { user } },
    { data: songs },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('songs')
      .select('id, title, artist_name, cover_url, plays')
      .order('plays', { ascending: false })
      .limit(16),
  ]);

  if (user) {
    return <AuthenticatedHome />;
  }

  return <GuestHome songs={songs || []} />;
}
