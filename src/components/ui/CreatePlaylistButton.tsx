'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ListMusic, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

export default function CreatePlaylistButton() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const { t } = useTranslation();

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Count existing playlists to generate a name like "Meine Playlist #3"
      const { count } = await supabase
        .from('playlists')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id);

      const nextNumber = (count || 0) + 1;
      const newTitle = `Meine Playlist #${nextNumber}`;

      const { data: newPlaylist, error } = await supabase
        .from('playlists')
        .insert({
          user_id: session.user.id,
          title: newTitle,
          is_public: false
        })
        .select()
        .single();

      if (error) throw error;

      if (newPlaylist) {
        router.push(`/playlist/${newPlaylist.id}?add=1`);
      }
    } catch (err) {
      console.error('Error creating playlist:', err);
      alert('Fehler beim Erstellen der Playlist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleCreate}
      disabled={loading}
      className="w-full flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors text-left"
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <ListMusic className="w-5 h-5" />
      )}
      {t('nav.newPlaylist')}
    </button>
  );
}
