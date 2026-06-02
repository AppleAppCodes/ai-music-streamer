import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdminUser } from '@/lib/admin';
import type { User as SupabaseUser } from '@supabase/supabase-js';

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

// ---------------------------------------------------------------------------
// GET /api/songs  –  List songs with optional filters
// Query params: artist, genre, limit (default 20, max 100), offset (default 0)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = request.nextUrl;

    const artist = searchParams.get('artist');
    const genre = searchParams.get('genre');
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100);
    const offset = Number(searchParams.get('offset')) || 0;

    let query = supabase
      .from('songs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (artist) {
      query = query.ilike('artist_name', `%${artist}%`);
    }
    if (genre) {
      query = query.ilike('genre', `%${genre}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch songs', details: error.message },
        { status: 500, headers: corsHeaders },
      );
    }

    return NextResponse.json(data, { headers: corsHeaders });
  } catch (err) {
    console.error('[GET /api/songs]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/songs  –  Upload a new song (multipart/form-data)
// Fields: title, artist_name, genre, mood, ai_tool, description, language
// Files : audio (required), cover (required)
// Auth  : Supabase session cookie OR Authorization: Bearer <token>
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // --- Authenticate --------------------------------------------------
    let authenticatedUser: SupabaseUser | null = null;

    // 1. Try cookie-based session first
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      authenticatedUser = user;
    } else {
      // 2. Fall back to Bearer token
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

    const userId = authenticatedUser.id;

    // --- Parse form data -----------------------------------------------
    const formData = await request.formData();

    const title = formData.get('title') as string | null;
    const artistName = formData.get('artist_name') as string | null;
    const genre = formData.get('genre') as string | null;
    const mood = formData.get('mood') as string | null;
    const aiTool = formData.get('ai_tool') as string | null;
    const description = formData.get('description') as string | null;
    const language = formData.get('language') as string | null;
    const humanEditStr = formData.get('human_edit') as string | null;
    const vocalsType = formData.get('vocals_type') as string | null;
    const audioFile = formData.get('audio') as File | null;
    const coverFile = formData.get('cover') as File | null;

    if (!title || !artistName) {
      return NextResponse.json(
        { error: 'Missing required fields: title, artist_name' },
        { status: 400, headers: corsHeaders },
      );
    }
    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { error: 'Missing required file: audio' },
        { status: 400, headers: corsHeaders },
      );
    }
    if (!coverFile || !(coverFile instanceof File)) {
      return NextResponse.json(
        { error: 'Missing required file: cover' },
        { status: 400, headers: corsHeaders },
      );
    }

    // --- Check for duplicates ------------------------------------------
    const { data: existingSongs, error: searchError } = await supabase
      .from('songs')
      .select('id')
      .ilike('title', title)
      .ilike('artist_name', artistName)
      .limit(1);

    if (searchError) {
      return NextResponse.json(
        { error: 'Failed to verify duplicate status', details: searchError.message },
        { status: 500, headers: corsHeaders },
      );
    }

    if (existingSongs && existingSongs.length > 0) {
      return NextResponse.json(
        { error: `Ein Song mit dem Titel "${title}" von "${artistName}" existiert bereits.` },
        { status: 409, headers: corsHeaders },
      );
    }

    const timestamp = Date.now();

    // --- Upload audio --------------------------------------------------
    const audioExt = audioFile.name.split('.').pop() ?? 'mp3';
    const audioPath = `${userId}/${timestamp}_song.${audioExt}`;
    const audioBuffer = await audioFile.arrayBuffer();

    const { error: audioUploadError } = await supabase.storage
      .from('songs')
      .upload(audioPath, audioBuffer, {
        contentType: audioFile.type || 'audio/mpeg',
        upsert: false,
      });

    if (audioUploadError) {
      return NextResponse.json(
        { error: 'Failed to upload audio', details: audioUploadError.message },
        { status: 500, headers: corsHeaders },
      );
    }

    // --- Upload cover --------------------------------------------------
    const coverExt = coverFile.name.split('.').pop() ?? 'jpg';
    const coverPath = `${userId}/${timestamp}_cover.${coverExt}`;
    const coverBuffer = await coverFile.arrayBuffer();

    const { error: coverUploadError } = await supabase.storage
      .from('covers')
      .upload(coverPath, coverBuffer, {
        contentType: coverFile.type || 'image/jpeg',
        upsert: false,
      });

    if (coverUploadError) {
      // Clean up the already-uploaded audio file
      await supabase.storage.from('songs').remove([audioPath]);
      return NextResponse.json(
        { error: 'Failed to upload cover', details: coverUploadError.message },
        { status: 500, headers: corsHeaders },
      );
    }

    // --- Get public URLs -----------------------------------------------
    const {
      data: { publicUrl: audioUrl },
    } = supabase.storage.from('songs').getPublicUrl(audioPath);
    const {
      data: { publicUrl: coverUrl },
    } = supabase.storage.from('covers').getPublicUrl(coverPath);

    // --- Insert song row -----------------------------------------------
    const { data: song, error: insertError } = await supabase
      .from('songs')
      .insert({
        creator_id: userId,
        title,
        artist_name: artistName,
        genre,
        mood,
        ai_tool: aiTool,
        human_edit: humanEditStr ? parseInt(humanEditStr, 10) : null,
        vocals_type: vocalsType || null,
        description,
        language,
        audio_url: audioUrl,
        cover_url: coverUrl,
      })
      .select()
      .single();

    if (insertError) {
      // Clean up uploaded files on insert failure
      await supabase.storage.from('songs').remove([audioPath]);
      await supabase.storage.from('covers').remove([coverPath]);
      return NextResponse.json(
        { error: 'Failed to create song', details: insertError.message },
        { status: 500, headers: corsHeaders },
      );
    }

    return NextResponse.json(song, { status: 201, headers: corsHeaders });
  } catch (err) {
    console.error('[POST /api/songs]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
