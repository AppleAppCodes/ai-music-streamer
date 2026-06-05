interface NowPlayingMetadata {
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string | null;
}

function getAbsoluteArtworkUrl(url?: string | null): string {
  if (typeof window === 'undefined') return url || '/brand/yoriax-app-icon-512.png?v=4';
  return new URL(url || '/brand/yoriax-app-icon-512.png?v=4', window.location.origin).toString();
}

export function setNowPlayingMetadata({ title, artist, album = 'Yoriax', artworkUrl }: NowPlayingMetadata) {
  if (
    typeof window === 'undefined'
    || typeof navigator === 'undefined'
    || !('mediaSession' in navigator)
    || !('MediaMetadata' in window)
  ) {
    return;
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist,
    album,
    artwork: [
      {
        src: getAbsoluteArtworkUrl(artworkUrl),
        sizes: '512x512',
      },
      {
        src: getAbsoluteArtworkUrl('/brand/yoriax-app-icon-512.png?v=4'),
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  });
}

export function clearNowPlayingMetadata() {
  if (
    typeof navigator === 'undefined'
    || !('mediaSession' in navigator)
  ) {
    return;
  }

  navigator.mediaSession.metadata = null;
}
