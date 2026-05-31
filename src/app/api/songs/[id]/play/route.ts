import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Call Supabase RPC or just fetch, increment, and update
    // Since Supabase REST API doesn't have a direct "increment" without RPC unless we read and write
    // Let's read the current plays, then update.
    // (In a production environment, an RPC function like 'increment_plays' is better to avoid race conditions,
    // but for now we'll do a read-modify-write, or we can use RPC if it exists. 
    // We'll just read and update for simplicity since it's a mock/small app)
    
    const { data: song, error: fetchError } = await supabase
      .from('songs')
      .select('plays')
      .eq('id', id)
      .single();

    if (fetchError || !song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    const newPlays = (song.plays || 0) + 1;

    const { error: updateError } = await supabase
      .from('songs')
      .update({ plays: newPlays })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update plays' }, { status: 500 });
    }

    return NextResponse.json({ success: true, plays: newPlays });
  } catch (error: unknown) {
    console.error('Error in play count:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
