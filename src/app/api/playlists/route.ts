import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/** CORS headers applied to every response from this route. */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** Preflight handler. */
export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: corsHeaders });
}

/**
 * Resolve the authenticated user from cookie session or Bearer token.
 * Returns the user ID or null.
 */
async function getAuthUserId(
  request: NextRequest,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  // 1. Cookie-based session
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user.id;

  // 2. Bearer token
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

// ---------------------------------------------------------------------------
// GET /api/playlists  –  List playlists belonging to the authenticated user
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = await getAuthUserId(request, supabase);

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders },
      );
    }

    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch playlists', details: error.message },
        { status: 500, headers: corsHeaders },
      );
    }

    return NextResponse.json(data, { headers: corsHeaders });
  } catch (err) {
    console.error('[GET /api/playlists]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/playlists  –  Create a new playlist
// Body (JSON): { title: string, is_public?: boolean }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = await getAuthUserId(request, supabase);

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders },
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: title' },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data, error } = await supabase
      .from('playlists')
      .insert({
        user_id: userId,
        title: body.title.trim(),
        description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null,
        is_public: body.is_public ?? false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create playlist', details: error.message },
        { status: 500, headers: corsHeaders },
      );
    }

    return NextResponse.json(data, { status: 201, headers: corsHeaders });
  } catch (err) {
    console.error('[POST /api/playlists]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
