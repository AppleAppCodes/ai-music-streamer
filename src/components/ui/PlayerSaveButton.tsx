'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ListPlus, Loader2, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import AddToPlaylistModal from './AddToPlaylistModal';

interface PlayerSaveButtonProps {
  songId: string;
  className?: string;
  iconClassName?: string;
  openUpwards?: boolean;
}

interface MenuPosition {
  bottom?: number;
  left: number;
  top?: number;
  width: number;
}

export default function PlayerSaveButton({
  songId,
  className = '',
  iconClassName = 'h-6 w-6',
  openUpwards = false,
}: PlayerSaveButtonProps) {
  const supabase = createClient();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadedSongId, setLoadedSongId] = useState<string | null>(null);
  const [openSongId, setOpenSongId] = useState<string | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const isStatusReady = loadedSongId === songId && !isLoading;
  const isOpen = openSongId === songId;

  const closePlaylistModal = useCallback(() => setShowPlaylistModal(false), []);
  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const viewportPadding = 8;
    const menuGap = 12;
    const estimatedMenuHeight = 132;
    const triggerRect = trigger.getBoundingClientRect();
    const width = Math.min(288, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, triggerRect.right - width),
      window.innerWidth - width - viewportPadding
    );
    const shouldOpenUpwards =
      openUpwards || triggerRect.bottom + menuGap + estimatedMenuHeight > window.innerHeight - viewportPadding;

    setMenuPosition(
      shouldOpenUpwards
        ? { bottom: window.innerHeight - triggerRect.top + menuGap, left, width }
        : { left, top: triggerRect.bottom + menuGap, width }
    );
  }, [openUpwards]);

  useEffect(() => {
    let isActive = true;

    async function loadLikeStatus() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isActive) return;

      if (!session) {
        setUserId(null);
        setIsLiked(false);
        setLoadedSongId(songId);
        setIsLoading(false);
        return;
      }

      setUserId(session.user.id);
      const { data } = await supabase
        .from('liked_songs')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('song_id', songId)
        .maybeSingle();

      if (!isActive) return;
      setIsLiked(Boolean(data));
      setLoadedSongId(songId);
      setIsLoading(false);
    }

    loadLikeStatus();
    return () => {
      isActive = false;
    };
  }, [songId, supabase]);

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenSongId(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenSongId(null);
    };

    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  const addToLikedSongs = async () => {
    if (!userId) {
      router.push('/login');
      return false;
    }
    if (isLiked) return true;

    setIsSaving(true);
    const { error } = await supabase
      .from('liked_songs')
      .insert({ user_id: userId, song_id: songId });
    setIsSaving(false);

    if (error && error.code !== '23505') {
      console.error('Error liking song:', error);
      return false;
    }

    setIsLiked(true);
    return true;
  };

  const toggleLikedSongs = async () => {
    if (!userId) {
      router.push('/login');
      return;
    }

    if (!isLiked) {
      await addToLikedSongs();
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from('liked_songs')
      .delete()
      .eq('user_id', userId)
      .eq('song_id', songId);
    setIsSaving(false);

    if (error) {
      console.error('Error unliking song:', error);
      return;
    }

    setIsLiked(false);
  };

  return (
    <>
      <div ref={menuRef} className="relative flex items-center justify-center">
        <button
          ref={triggerRef}
          type="button"
          disabled={!isStatusReady || isSaving}
          onClick={async (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (isOpen) {
              setOpenSongId(null);
              return;
            }
            if (!userId) {
              router.push('/login');
              return;
            }
            if (!isLiked && !(await addToLikedSongs())) return;
            updateMenuPosition();
            setOpenSongId(songId);
          }}
          className={`transition-all duration-300 active:scale-75 ${isLiked ? 'text-green-500' : 'text-white/60 hover:text-white'} ${className}`}
          title={isLiked ? 'Gespeichert' : 'Speichern'}
          aria-label={isLiked ? 'Gespeicherten Song verwalten' : 'Song speichern'}
          aria-expanded={isOpen}
        >
          {isSaving ? (
            <Loader2 className={`${iconClassName} animate-spin`} />
          ) : isLiked ? (
            <CheckCircle2 className={`${iconClassName} drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]`} strokeWidth={2.5} />
          ) : (
            <PlusCircle className={iconClassName} strokeWidth={2} />
          )}
        </button>

        {isOpen && isStatusReady && menuPosition && (
          <div
            className="fixed z-[110] overflow-hidden rounded-xl border border-white/10 bg-[#242424]/95 py-2 text-sm text-white shadow-2xl shadow-black/40 backdrop-blur-xl"
            style={menuPosition}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleLikedSongs();
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/10"
            >
              {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin text-white/70" />
              ) : isLiked ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" strokeWidth={2.5} />
              ) : (
                <PlusCircle className="h-5 w-5 text-white/70" />
              )}
              <span className="flex flex-col">
                <span>{isLiked ? 'In Lieblingssongs gespeichert' : 'Zu Lieblingssongs hinzufügen'}</span>
                {isLiked ? <span className="text-xs text-white/45">Automatisch hinzugefügt</span> : null}
              </span>
            </button>

            <div className="mx-3 h-px bg-white/10" />

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpenSongId(null);
                setShowPlaylistModal(true);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/10"
            >
              <ListPlus className="h-5 w-5 text-white/70" />
              Zu Playlist hinzufügen
            </button>
          </div>
        )}
      </div>

      {showPlaylistModal && (
        <AddToPlaylistModal songId={songId} onClose={closePlaylistModal} />
      )}
    </>
  );
}
