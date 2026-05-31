import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Vercel populates this header automatically in production
    const country = req.headers.get('x-vercel-ip-country') || 'Unknown';
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('profiles')
      .update({ 
        last_active_at: now,
        ...(country !== 'Unknown' && { country }) 
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating profile track:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, country });
  } catch (error) {
    console.error('Error in track route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
