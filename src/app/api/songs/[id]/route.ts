import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdminUser } from '@/lib/admin';
import type { User as SupabaseUser } from '@supabase/supabase-js';

/** CORS headers applied to every response from this route. */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** Preflight handler. */
export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: corsHeaders });
}

// ---------------------------------------------------------------------------
// GET /api/songs/:id  –  Fetch a single song by ID
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404, headers: corsHeaders },
      );
    }

    return NextResponse.json(data, { headers: corsHeaders });
  } catch (err) {
    console.error('[GET /api/songs/:id]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/songs/:id  –  Delete a song (owner only)
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // --- Authenticate --------------------------------------------------
    let authenticatedUser: SupabaseUser | null = null;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      authenticatedUser = user;
    } else {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const {
          data: { user: tokenUser },
          error: tokenError,
        } = await supabase.auth.getUser(token);

        if (tokenError || !tokenUser) {
          return NextResponse.json(
            { error: 'Invalid or expired token' },
            { status: 401, headers: corsHeaders },
          );
        }
        authenticatedUser = tokenUser;
      }
    }

    if (!authenticatedUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders },
      );
    }

    if (!isAdminUser(authenticatedUser)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403, headers: corsHeaders },
      );
    }

    // --- Fetch the song ------------------------------------------------
    const { data: song, error: fetchError } = await supabase
      .from('songs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !song) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404, headers: corsHeaders },
      );
    }

    // --- Delete storage files ------------------------------------------
    // Extract storage paths from public URLs.  Public URLs end with
    // `/object/public/<bucket>/<path>`, so we split on the bucket name.
    const extractPath = (url: string, bucket: string): string | null => {
      const marker = `/object/public/${bucket}/`;
      const idx = url.indexOf(marker);
      if (idx === -1) return null;
      return decodeURIComponent(url.slice(idx + marker.length));
    };

    if (song.audio_url) {
      const audioPath = extractPath(song.audio_url, 'songs');
      if (audioPath) {
        await supabase.storage.from('songs').remove([audioPath]);
      }
    }
    if (song.cover_url) {
      const coverPath = extractPath(song.cover_url, 'covers');
      if (coverPath) {
        await supabase.storage.from('covers').remove([coverPath]);
      }
    }

    // --- Delete database row -------------------------------------------
    const { error: deleteError } = await supabase
      .from('songs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete song', details: deleteError.message },
        { status: 500, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { message: 'Song deleted successfully' },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error('[DELETE /api/songs/:id]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
