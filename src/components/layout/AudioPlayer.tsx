'use client';

import { Play, Pause, SkipBack, SkipForward, Volume2, Mic2, Shuffle, Repeat } from 'lucide-react';
import { useState } from 'react';
import { MOCK_SONGS } from '@/lib/mock-data';

export default function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(30); // Mock progress percentage
  
  // Using a mock song for the MVP visual player
  const currentSong = MOCK_SONGS[0];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-surface border-t border-white/5 px-4 flex items-center justify-between z-50">
      
      {/* Song Info */}
      <div className="flex items-center gap-4 w-1/3 min-w-[180px]">
        <img 
          src={currentSong.cover_url} 
          alt={currentSong.title} 
          className="w-14 h-14 rounded-md object-cover shadow-lg"
        />
        <div className="flex flex-col">
          <a href={`/song/${currentSong.id}`} className="text-sm font-medium text-white hover:underline truncate">
            {currentSong.title}
          </a>
          <a href={`/creator/${currentSong.creator_id}`} className="text-xs text-muted hover:text-white hover:underline truncate">
            SynthwaveQueen {/* Mock creator name */}
          </a>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center max-w-[40%] w-full">
        <div className="flex items-center gap-6 mb-2">
          <button className="text-muted hover:text-white transition-colors">
            <Shuffle className="w-4 h-4" />
          </button>
          <button className="text-muted hover:text-white transition-colors">
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-1" />}
          </button>
          <button className="text-muted hover:text-white transition-colors">
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
          <button className="text-muted hover:text-white transition-colors">
            <Repeat className="w-4 h-4" />
          </button>
        </div>
        
        {/* Progress Bar */}
        <div className="flex items-center gap-2 w-full max-w-md">
          <span className="text-xs text-muted font-medium w-8 text-right">1:24</span>
          <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden group cursor-pointer">
            <div 
              className="h-full bg-white group-hover:bg-primary transition-colors relative"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted font-medium w-8">3:42</span>
        </div>
      </div>

      {/* Extra Controls */}
      <div className="flex items-center justify-end gap-4 w-1/3 min-w-[180px]">
        <button className="text-muted hover:text-white transition-colors" title="AI Tool Info">
          <Mic2 className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 w-24">
          <Volume2 className="w-4 h-4 text-muted" />
          <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer">
            <div className="h-full bg-white w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
