import { Image } from 'react-native';
import {
  DAILY_NEW_RELEASES_PLAYLIST_ID,
  loadHomeMusic,
  loadPlaylistDetails,
  type HomeMusicData,
} from './music-data';
import type { Playlist, Song } from './types';

const preloadedImages = new Set<string>();

function isRemoteUri(uri?: string | null): uri is string {
  return Boolean(uri && /^https?:\/\//i.test(uri));
}

function addSongCovers(target: Set<string>, songs: Song[]) {
  for (const song of songs) {
    if (isRemoteUri(song.cover_url)) {
      target.add(song.cover_url);
    }
  }
}

function addPlaylistCover(target: Set<string>, playlist?: Playlist | null) {
  if (isRemoteUri(playlist?.cover_url)) {
    target.add(playlist.cover_url);
  }
}

function collectHomeCoverUris(home: HomeMusicData) {
  const uris = new Set<string>();

  addSongCovers(uris, home.trendingSongs);
  addSongCovers(uris, home.recommendedSongs);
  addSongCovers(uris, home.latestSongs);

  for (const playlist of home.officialPlaylists) {
    addPlaylistCover(uris, playlist);
  }

  return uris;
}

export async function prefetchImageUris(uris: Iterable<string>, limit = 72) {
  const nextUris = Array.from(new Set(uris))
    .filter((uri) => !preloadedImages.has(uri))
    .slice(0, limit);

  if (nextUris.length === 0) return;

  for (let index = 0; index < nextUris.length; index += 8) {
    const batch = nextUris.slice(index, index + 8);
    await Promise.allSettled(
      batch.map(async (uri) => {
        await Image.prefetch(uri);
        preloadedImages.add(uri);
      }),
    );
  }
}

export async function preloadStartupMedia(
  userId: string,
  options?: { onVideoUrls?: (videoUrls: string[]) => void },
) {
  const home = await loadHomeMusic(userId);
  const imageUris = collectHomeCoverUris(home);
  const videoUrls = new Set<string>();
  const playlistIds = Array.from(new Set([
    DAILY_NEW_RELEASES_PLAYLIST_ID,
    ...home.officialPlaylists.map((playlist) => playlist.id).filter(Boolean),
  ])).slice(0, 4);

  const playlistResults = await Promise.allSettled(
    playlistIds.map((playlistId) => loadPlaylistDetails(playlistId)),
  );

  for (const result of playlistResults) {
    if (result.status !== 'fulfilled') continue;

    addPlaylistCover(imageUris, result.value.playlist);
    addSongCovers(imageUris, result.value.songs.slice(0, 16));

    if (isRemoteUri(result.value.playlist.video_url)) {
      videoUrls.add(result.value.playlist.video_url);
    }
  }

  options?.onVideoUrls?.(Array.from(videoUrls).slice(0, 4));
  await prefetchImageUris(imageUris);
}
