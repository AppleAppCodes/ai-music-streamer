export const LIKED_SONG_CHANGE_EVENT = 'yoriax:liked-song-change';

export interface LikedSongChangeDetail {
  isLiked: boolean;
  songId: string;
}

export function emitLikedSongChange(songId: string, isLiked: boolean) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<LikedSongChangeDetail>(LIKED_SONG_CHANGE_EVENT, {
      detail: { songId, isLiked },
    }),
  );
}

export function getLikedSongChangeDetail(event: Event): LikedSongChangeDetail | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail = event.detail as Partial<LikedSongChangeDetail> | undefined;
  if (!detail?.songId || typeof detail.isLiked !== 'boolean') return null;
  return { songId: detail.songId, isLiked: detail.isLiked };
}
