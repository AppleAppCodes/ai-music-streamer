import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

const storageBuckets = ['audio-files', 'cover-images', 'covers', 'songs'] as const;
const removalBatchSize = 100;
const listPageSize = 100;

type StorageBucket = (typeof storageBuckets)[number];
type StorageReferences = Map<StorageBucket, Set<string>>;

type ProfileData = {
  avatar_url: string | null;
};

type SongData = {
  id: string;
  audio_url: string | null;
  cover_url: string | null;
};

type PlaylistData = {
  id: string;
  cover_url: string | null;
};

type AlbumData = {
  cover_url: string | null;
};

type FeedClipData = {
  cover_url: string | null;
  video_url: string | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function getSecretKey() {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceRoleKey) return serviceRoleKey;

  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeys) {
    const parsed = JSON.parse(secretKeys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }

  throw new Error('Supabase secret key is not configured');
}

function getAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured');

  return createClient(supabaseUrl, getSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createStorageReferences(): StorageReferences {
  return new Map(storageBuckets.map((bucket) => [bucket, new Set<string>()]));
}

function addStorageUrl(references: StorageReferences, rawUrl: string | null | undefined) {
  if (!rawUrl) return;

  try {
    const url = new URL(rawUrl);
    const expectedSupabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!expectedSupabaseUrl || url.origin !== new URL(expectedSupabaseUrl).origin) return;

    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if (!match) return;

    const bucket = decodeURIComponent(match[1]) as StorageBucket;
    if (!storageBuckets.includes(bucket)) return;

    const path = match[2]
      .split('/')
      .map((part) => decodeURIComponent(part))
      .join('/');

    references.get(bucket)?.add(path);
  } catch {
    // External and malformed URLs are intentionally ignored.
  }
}

async function listFolderFiles(
  admin: SupabaseClient,
  bucket: StorageBucket,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: listPageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) throw error;
    if (!data?.length) break;

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        paths.push(...(await listFolderFiles(admin, bucket, path)));
      } else {
        paths.push(path);
      }
    }

    if (data.length < listPageSize) break;
    offset += listPageSize;
  }

  return paths;
}

async function addKnownStoragePaths(
  admin: SupabaseClient,
  references: StorageReferences,
  userId: string,
  playlistIds: string[],
) {
  for (const bucket of storageBuckets) {
    const userFolderPaths = await listFolderFiles(admin, bucket, userId);
    userFolderPaths.forEach((path) => references.get(bucket)?.add(path));
  }

  const avatarPaths = await listFolderFiles(admin, 'covers', 'avatars');
  avatarPaths
    .filter((path) => path.split('/').pop()?.startsWith(`${userId}-`))
    .forEach((path) => references.get('covers')?.add(path));

  if (playlistIds.length > 0) {
    const playlistIdSet = new Set(playlistIds);
    const playlistCoverPaths = await listFolderFiles(admin, 'covers', 'playlists');

    playlistCoverPaths
      .filter((path) => {
        const fileName = path.split('/').pop() ?? '';
        const playlistId = fileName.split('-').slice(0, 5).join('-');
        return playlistIdSet.has(playlistId);
      })
      .forEach((path) => references.get('covers')?.add(path));
  }
}

async function removeStorageReferences(admin: SupabaseClient, references: StorageReferences) {
  for (const [bucket, paths] of references) {
    const allPaths = [...paths];

    for (let index = 0; index < allPaths.length; index += removalBatchSize) {
      const batch = allPaths.slice(index, index + removalBatchSize);
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (error) throw error;
    }
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'DELETE') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  const accessToken = authorization?.replace(/^Bearer\s+/i, '');

  if (!accessToken) {
    return json({ error: 'Authentication required' }, 401);
  }

  try {
    const admin = getAdminClient();
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(accessToken);

    if (userError || !user) {
      return json({ error: 'Bitte melde dich erneut an, bevor du deinen Account löschst.' }, 401);
    }

    const { error: revokeSessionsError } = await admin.auth.admin.signOut(accessToken, 'global');
    if (revokeSessionsError) throw revokeSessionsError;

    const [
      { data: profile, error: profileError },
      { data: songs, error: songsError },
      { data: playlists, error: playlistsError },
      { data: albums, error: albumsError },
    ] = await Promise.all([
      admin.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle<ProfileData>(),
      admin.from('songs').select('id,audio_url,cover_url').eq('creator_id', user.id).returns<SongData[]>(),
      admin.from('playlists').select('id,cover_url').eq('user_id', user.id).returns<PlaylistData[]>(),
      admin.from('albums').select('cover_url').eq('creator_id', user.id).returns<AlbumData[]>(),
    ]);

    const dataError = profileError || songsError || playlistsError || albumsError;
    if (dataError) throw dataError;

    const songIds = (songs ?? []).map((song) => song.id);
    let feedClips: FeedClipData[] = [];

    if (songIds.length > 0) {
      const { data, error } = await admin
        .from('song_feed_clips')
        .select('cover_url,video_url')
        .in('song_id', songIds)
        .returns<FeedClipData[]>();

      if (error) throw error;
      feedClips = data ?? [];
    }

    const references = createStorageReferences();
    addStorageUrl(references, profile?.avatar_url);

    for (const song of songs ?? []) {
      addStorageUrl(references, song.audio_url);
      addStorageUrl(references, song.cover_url);
    }

    for (const playlist of playlists ?? []) {
      addStorageUrl(references, playlist.cover_url);
    }

    for (const album of albums ?? []) {
      addStorageUrl(references, album.cover_url);
    }

    for (const feedClip of feedClips) {
      addStorageUrl(references, feedClip.cover_url);
      addStorageUrl(references, feedClip.video_url);
    }

    await addKnownStoragePaths(
      admin,
      references,
      user.id,
      (playlists ?? []).map((playlist) => playlist.id),
    );
    await removeStorageReferences(admin, references);

    const { error: deleteReportsError } = await admin
      .from('reports')
      .delete()
      .eq('reporter_id', user.id);
    if (deleteReportsError) throw deleteReportsError;

    const { error: deleteProfileError } = await admin.from('profiles').delete().eq('id', user.id);
    if (deleteProfileError) throw deleteProfileError;

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteUserError) throw deleteUserError;

    return json({ deleted: true });
  } catch (error) {
    console.error('[delete-account]', error);
    return json(
      { error: 'Der Account konnte nicht vollständig gelöscht werden. Bitte versuche es erneut.' },
      500,
    );
  }
});
