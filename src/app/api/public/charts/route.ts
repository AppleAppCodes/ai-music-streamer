import { NextResponse } from 'next/server';
import { loadPublicChartsData } from '@/lib/public-music-data';
import { createPublicClient } from '@/utils/supabase/public';

export const revalidate = 60;

export async function GET() {
  try {
    const data = await loadPublicChartsData(createPublicClient());

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Failed to load public charts data', error);

    return NextResponse.json(
      { error: 'Failed to load charts data' },
      { status: 500 },
    );
  }
}
