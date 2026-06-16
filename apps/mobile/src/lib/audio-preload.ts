import { preload } from 'expo-audio';
import type { Song } from './types';

const preloadedUrls = new Set<string>();
const MAX_PRELOADED_URLS = 36;

export function preloadSongs(songs: Song[], limit = 8) {
  if (preloadedUrls.size >= MAX_PRELOADED_URLS) return;

  songs.slice(0, limit).forEach((song) => {
    if (!song.audio_url || preloadedUrls.has(song.audio_url)) return;

    preloadedUrls.add(song.audio_url);
    void preload(
      {
        name: song.title,
        uri: song.audio_url,
      },
      { preferredForwardBufferDuration: 16 },
    ).catch(() => {
      preloadedUrls.delete(song.audio_url!);
    });
  });
}
