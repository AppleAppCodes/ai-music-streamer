import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asOptionalBoolean,
  asOptionalTrimmedString,
  asTrimmedString,
  isHttpUrl,
  jsonError,
  jsonOk,
  optionsResponse,
  requireAdminAuth,
} from '@/lib/yoriax-admin-api';

type PlaylistBody = {
  title?: unknown;
  description?: unknown;
  cover_url?: unknown;
  video_url?: unknown;
  video_storage_path?: unknown;
  is_public?: unknown;
  is_official?: unknown;
  user_id?: unknown;
  song_ids?: unknown;
};

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;

  const officialOnly = request.nextUrl.searchParams.get('official') !== 'false';

  let query = auth.context.admin
    .from('playlists')
    .select('id,user_id,title,description,cover_url,is_public,is_official,video_url,video_storage_path,created_at')
    .order('created_at', { ascending: false });

  if (officialOnly) {
    query = query.eq('is_official', true);
  }

  const { data, error } = await query;
  if (error) {
    return jsonError('Failed to fetch playlists', 500, error.message);
  }

  return jsonOk({ playlists: data ?? [] });
}

async function replacePlaylistSongs(
  admin: SupabaseClient,
  playlistId: string,
  songIds: string[],
) {
  const { error: deleteError } = await admin.from('playlist_songs').delete().eq('playlist_id', playlistId);
  if (deleteError) return deleteError;

  if (!songIds.length) return null;

  const uniqueSongIds = Array.from(new Set(songIds));
  const { error: insertError } = await admin.from('playlist_songs').insert(
    uniqueSongIds.map((songId) => ({
      playlist_id: playlistId,
      song_id: songId,
    })),
  );

  return insertError;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as PlaylistBody | null;
  if (!body || typeof body !== 'object') {
    return jsonError('Invalid JSON body', 400);
  }

  const title = asTrimmedString(body.title);
  if (!title) {
    return jsonError('Missing required field: title', 400);
  }

  const coverUrl = asOptionalTrimmedString(body.cover_url);
  const videoUrl = asOptionalTrimmedString(body.video_url);
  const invalidUrl = [coverUrl, videoUrl].filter(Boolean).find((url) => !isHttpUrl(url as string));
  if (invalidUrl) {
    return jsonError(`Invalid URL: ${invalidUrl}`, 400);
  }

  const songIds = Array.isArray(body.song_ids)
    ? body.song_ids.filter((songId): songId is string => typeof songId === 'string' && Boolean(songId.trim()))
    : null;

  const { data: playlist, error } = await auth.context.admin
    .from('playlists')
    .insert({
      title,
      description: asOptionalTrimmedString(body.description),
      cover_url: coverUrl,
      video_url: videoUrl,
      video_storage_path: asOptionalTrimmedString(body.video_storage_path),
      is_public: asOptionalBoolean(body.is_public) ?? true,
      is_official: asOptionalBoolean(body.is_official) ?? true,
      user_id: asOptionalTrimmedString(body.user_id),
    })
    .select('id,user_id,title,description,cover_url,is_public,is_official,video_url,video_storage_path,created_at')
    .single();

  if (error) {
    return jsonError('Failed to create playlist', 500, error.message);
  }

  if (songIds) {
    const replaceError = await replacePlaylistSongs(auth.context.admin, playlist.id, songIds);
    if (replaceError) {
      return jsonError('Playlist created, but failed to assign songs', 500, replaceError.message);
    }
  }

  return jsonOk({ playlist }, { status: 201 });
}
