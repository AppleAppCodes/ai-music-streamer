import Link from 'next/link';
import { Play } from 'lucide-react';
import { Song } from '@/lib/types';

interface SongCardProps {
  song: Song;
  creatorName?: string;
  className?: string;
}

export default function SongCard({ song, creatorName = 'Creator', className = '' }: SongCardProps) {
  return (
    <div className={`group relative flex flex-col gap-3 p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer ${className}`}>
      {/* Cover Image Container */}
      <div className="relative aspect-square w-full rounded-md overflow-hidden shadow-lg mb-2">
        <img 
          src={song.cover_url} 
          alt={song.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Play Button Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-xl hover:scale-110 hover:bg-primary-hover transition-all">
            <Play className="w-6 h-6 fill-current ml-1" />
          </button>
        </div>
        

      </div>

      {/* Song Details */}
      <div className="flex flex-col">
        <Link href={`/song/${song.id}`} className="text-base font-semibold text-white truncate hover:underline">
          {song.title}
        </Link>
        <Link href={`/creator/${song.creator_id}`} className="text-sm text-muted truncate hover:text-white hover:underline mt-0.5">
          {creatorName}
        </Link>
      </div>
    </div>
  );
}
