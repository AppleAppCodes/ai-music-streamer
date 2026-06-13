import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.redirect('https://github.com/AppleAppCodes/ai-music-streamer/releases/latest/download/YORIAX-0.1.0-win-x64.exe', 302);
}
