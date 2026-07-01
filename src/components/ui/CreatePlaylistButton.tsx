'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ListMusic, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

export default function CreatePlaylistButton() {
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const supabase = createClient();
  const router = useRouter();
  const { t } = useTranslation();

  const openCreateModal = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const { count } = await supabase
      .from('playlists')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    setTitle(`Meine Playlist #${(count || 0) + 1}`);
    setDescription('');
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const newTitle = title.trim() || t('playlistEditor.untitled');
      const newDescription = description.trim();

      const { data: newPlaylist, error } = await supabase
        .from('playlists')
        .insert({
          user_id: session.user.id,
          title: newTitle,
          description: newDescription || null,
          is_public: false
        })
        .select()
        .single();

      if (error) throw error;

      if (newPlaylist) {
        setIsModalOpen(false);
        setTitle('');
        setDescription('');
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
    <>
      <button
        onClick={openCreateModal}
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

      {isModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => !loading && setIsModalOpen(false)}>
          <div className="yoriax-card w-full max-w-[480px] overflow-hidden rounded-[1.75rem] p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-white">{t('nav.newPlaylist')}</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={loading}
                className="rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
                aria-label={t('common.cancel')}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="yoriax-input w-full rounded-xl p-3 text-sm"
                placeholder={t('playlist.addNamePlaceholder')}
                autoFocus
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="yoriax-input min-h-[120px] w-full resize-none rounded-xl p-3 text-sm"
                placeholder={t('playlist.addDescPlaceholder')}
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={loading}
                className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition-transform hover:scale-105 disabled:cursor-wait disabled:opacity-70 disabled:hover:scale-100"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? t('playlist.creating') : t('library.createBtn')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
