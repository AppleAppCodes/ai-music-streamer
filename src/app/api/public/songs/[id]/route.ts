import { NextResponse } from 'next/server';

import type { Song } from '@/lib/types';
import { createPublicClient } from '@/utils/supabase/public';

const PUBLIC_SONG_SELECT = [
  'id',
  'creator_id',
  'title',
  'artist_name',
  'cover_url',
  'audio_url',
  'genre',
  'mood',
  'language',
  'description',
  'ai_tool',
  'human_edit',
  'vocals_type',
  'credits',
  'duration',
  'plays',
  'created_at',
  'album_id',
  'track_number',
].join(', ');

function publicSongFilter<T extends { or: (filters: string) => T }>(query: T): T {
  return query.or('is_approved.is.true,is_approved.is.null');
}

function mapSong(row: Partial<Song>): Song {
  const artistName = row.artist_name || 'Creator';

  return {
    id: row.id || '',
    creator_id: row.creator_id || '',
    title: row.title || 'YORIAX Song',
    artist_name: artistName,
    cover_url: row.cover_url || '',
    audio_url: row.audio_url || '',
    genre: row.genre || '',
    mood: row.mood || '',
    language: row.language || '',
    description: row.description || '',
    ai_tool: row.ai_tool ?? null,
    human_edit: row.human_edit ?? 0,
    vocals_type: row.vocals_type || 'AI',
    credits: row.credits || [],
    duration: row.duration,
    plays: row.plays ?? 0,
    created_at: row.created_at || new Date(0).toISOString(),
    creatorName: artistName,
    album_id: row.album_id ?? null,
    track_number: row.track_number ?? null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createPublicClient();

    const { data: song, error } = await publicSongFilter(
      supabase
        .from('songs')
        .select(PUBLIC_SONG_SELECT)
        .eq('id', id),
    ).maybeSingle();

    if (error) {
      console.error('[GET /api/public/songs/:id]', error);
    }

    if (error || !song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    const songRow = song as Partial<Song>;
    const artistName = songRow.artist_name || null;
    const relatedQuery = supabase
      .from('songs')
      .select(PUBLIC_SONG_SELECT)
      .neq('id', id)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: relatedSongs, error: relatedError } = artistName
      ? await publicSongFilter(relatedQuery.eq('artist_name', artistName))
      : { data: [], error: null };

    if (relatedError) {
      console.error('[GET /api/public/songs/:id related]', relatedError);
    }

    return NextResponse.json(
      {
        song: mapSong(songRow),
        relatedSongs: ((relatedSongs || []) as Partial<Song>[]).map(mapSong),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    console.error('[GET /api/public/songs/:id]', error);
    return NextResponse.json({ error: 'Failed to load song' }, { status: 500 });
  }
}
