import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/** CORS headers applied to every response from this route. */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** Preflight handler. */
export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: corsHeaders });
}

/**
 * Resolve the authenticated user from cookie session or Bearer token.
 */
async function getAuthUserId(
  request: NextRequest,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user.id;

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const {
      data: { user: tokenUser },
    } = await supabase.auth.getUser(token);
    if (tokenUser) return tokenUser.id;
  }

  return null;
}

/**
 * Verify the authenticated user owns the given playlist.
 * Returns the playlist row on success, or a NextResponse error.
 */
async function verifyPlaylistOwnership(
  playlistId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<
  | { playlist: Record<string, unknown>; error?: never }
  | { playlist?: never; error: NextResponse }
> {
  const { data: playlist, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', playlistId)
    .single();

  if (error || !playlist) {
    return {
      error: NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404, headers: corsHeaders },
      ),
    };
  }

  if (playlist.user_id !== userId) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden: you do not own this playlist' },
        { status: 403, headers: corsHeaders },
      ),
    };
  }

  return { playlist };
}

// ---------------------------------------------------------------------------
// POST /api/playlists/:id/songs  –  Add a song to a playlist
// Body (JSON): { song_id: string }
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: playlistId } = await params;
    const supabase = await createClient();
    const userId = await getAuthUserId(request, supabase);

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders },
      );
    }

    // Verify ownership
    const ownershipCheck = await verifyPlaylistOwnership(
      playlistId,
      userId,
      supabase,
    );
    if (ownershipCheck.error) return ownershipCheck.error;

    // Parse body
    const body = await request.json().catch(() => null);

    if (!body || typeof body.song_id !== 'string' || !body.song_id.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: song_id' },
        { status: 400, headers: corsHeaders },
      );
    }

    // Verify the song exists
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('id')
      .eq('id', body.song_id)
      .single();

    if (songError || !song) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404, headers: corsHeaders },
      );
    }

    // Insert into playlist_songs
    const { data, error } = await supabase
      .from('playlist_songs')
      .insert({
        playlist_id: playlistId,
        song_id: body.song_id,
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Song is already in this playlist' },
          { status: 409, headers: corsHeaders },
        );
      }
      return NextResponse.json(
        { error: 'Failed to add song to playlist', details: error.message },
        { status: 500, headers: corsHeaders },
      );
    }

    return NextResponse.json(data, { status: 201, headers: corsHeaders });
  } catch (err) {
    console.error('[POST /api/playlists/:id/songs]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/playlists/:id/songs  –  Remove a song from a playlist
// Body (JSON): { song_id: string }
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: playlistId } = await params;
    const supabase = await createClient();
    const userId = await getAuthUserId(request, supabase);

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders },
      );
    }

    // Verify ownership
    const ownershipCheck = await verifyPlaylistOwnership(
      playlistId,
      userId,
      supabase,
    );
    if (ownershipCheck.error) return ownershipCheck.error;

    // Parse body
    const body = await request.json().catch(() => null);

    if (!body || typeof body.song_id !== 'string' || !body.song_id.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: song_id' },
        { status: 400, headers: corsHeaders },
      );
    }

    const { error, count } = await supabase
      .from('playlist_songs')
      .delete({ count: 'exact' })
      .eq('playlist_id', playlistId)
      .eq('song_id', body.song_id);

    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to remove song from playlist',
          details: error.message,
        },
        { status: 500, headers: corsHeaders },
      );
    }

    if (count === 0) {
      return NextResponse.json(
        { error: 'Song was not in this playlist' },
        { status: 404, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { message: 'Song removed from playlist' },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error('[DELETE /api/playlists/:id/songs]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
