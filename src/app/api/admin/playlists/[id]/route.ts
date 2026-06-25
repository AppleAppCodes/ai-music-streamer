import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asOptionalBoolean,
  asOptionalTrimmedString,
  isHttpUrl,
  jsonError,
  jsonOk,
  optionsResponse,
  requireAdminAuth,
} from '@/lib/yoriax-admin-api';

type PlaylistPatchBody = {
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

async function replacePlaylistSongs(admin: SupabaseClient, playlistId: string, songIds: string[]) {
  const { error: deleteError } = await admin.from('playlist_songs').delete().eq('playlist_id', playlistId);
  if (deleteError) return deleteError;

  const uniqueSongIds = Array.from(new Set(songIds.filter(Boolean)));
  if (!uniqueSongIds.length) return null;

  const { error: insertError } = await admin.from('playlist_songs').insert(
    uniqueSongIds.map((songId) => ({
      playlist_id: playlistId,
      song_id: songId,
    })),
  );

  return insertError;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const { data: playlist, error } = await auth.context.admin
    .from('playlists')
    .select(
      'id,user_id,title,description,cover_url,is_public,is_official,video_url,video_storage_path,created_at,playlist_songs(song_id,songs(id,title,artist_name,cover_url,audio_url,duration,track_number))',
    )
    .eq('id', id)
    .single();

  if (error) {
    return jsonError('Playlist not found', 404, error.message);
  }

  return jsonOk({ playlist });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as PlaylistPatchBody | null;
  if (!body || typeof body !== 'object') {
    return jsonError('Invalid JSON body', 400);
  }

  const patch: Record<string, string | boolean | null> = {};
  const title = asOptionalTrimmedString(body.title);
  if (title) patch.title = title;

  if ('description' in body) patch.description = asOptionalTrimmedString(body.description);
  if ('cover_url' in body) patch.cover_url = asOptionalTrimmedString(body.cover_url);
  if ('video_url' in body) patch.video_url = asOptionalTrimmedString(body.video_url);
  if ('video_storage_path' in body) patch.video_storage_path = asOptionalTrimmedString(body.video_storage_path);
  if ('user_id' in body) patch.user_id = asOptionalTrimmedString(body.user_id);

  const isPublic = asOptionalBoolean(body.is_public);
  if (isPublic != null) patch.is_public = isPublic;

  const isOfficial = asOptionalBoolean(body.is_official);
  if (isOfficial != null) patch.is_official = isOfficial;

  const invalidUrl = [patch.cover_url, patch.video_url]
    .filter((value): value is string => typeof value === 'string' && Boolean(value))
    .find((url) => !isHttpUrl(url));
  if (invalidUrl) {
    return jsonError(`Invalid URL: ${invalidUrl}`, 400);
  }

  let playlist = null;
  if (Object.keys(patch).length) {
    const { data, error } = await auth.context.admin
      .from('playlists')
      .update(patch)
      .eq('id', id)
      .select('id,user_id,title,description,cover_url,is_public,is_official,video_url,video_storage_path,created_at')
      .single();

    if (error) {
      return jsonError('Failed to update playlist', 500, error.message);
    }
    playlist = data;
  }

  if (Array.isArray(body.song_ids)) {
    const songIds = body.song_ids.filter((songId): songId is string => typeof songId === 'string' && Boolean(songId.trim()));
    const replaceError = await replacePlaylistSongs(auth.context.admin, id, songIds);
    if (replaceError) {
      return jsonError('Failed to update playlist songs', 500, replaceError.message);
    }
  }

  if (!playlist) {
    const { data, error } = await auth.context.admin
      .from('playlists')
      .select('id,user_id,title,description,cover_url,is_public,is_official,video_url,video_storage_path,created_at')
      .eq('id', id)
      .single();

    if (error) {
      return jsonError('Playlist not found', 404, error.message);
    }
    playlist = data;
  }

  return jsonOk({ playlist });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  await auth.context.admin.from('playlist_songs').delete().eq('playlist_id', id);
  const { error } = await auth.context.admin.from('playlists').delete().eq('id', id);

  if (error) {
    return jsonError('Failed to delete playlist', 500, error.message);
  }

  return jsonOk({ deleted: true });
}
