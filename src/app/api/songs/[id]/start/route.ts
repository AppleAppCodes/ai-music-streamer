import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Records a song "start" (Anspielung) — fired when a song begins playing,
// regardless of duration. Separate from /play (30s honest play).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { error } = await supabase.rpc('record_song_start', { target_song_id: id });
    if (error) {
      return NextResponse.json({ error: 'Failed to record start' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in song start:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
