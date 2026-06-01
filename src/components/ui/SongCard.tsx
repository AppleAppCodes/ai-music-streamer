import Link from 'next/link';
import { Play, Pause } from 'lucide-react';
import { Song } from '@/lib/types';
import { usePlayer } from '@/lib/player-context';
import PlaylistAddButton from '@/components/ui/PlaylistAddButton';

interface SongCardProps {
  song: Song;
  creatorName?: string;
  className?: string;
  contextQueue?: Song[];
}

export default function SongCard({ song, creatorName = 'Creator', className = '', contextQueue }: SongCardProps) {
  const { playSong, currentSong, isPlaying, togglePlayPause, setQueue } = usePlayer();
  const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
  const displayArtist = song.artist_name || creatorName;

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
        <div className={`absolute inset-0 flex items-center justify-center bg-black/15 transition-opacity md:bg-black/40 ${currentSong?.id === song.id ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (currentSong?.id === song.id) {
                togglePlayPause();
              } else {
                if (contextQueue && contextQueue.length > 0) {
                  const idx = contextQueue.findIndex(s => s.id === song.id);
                  if (idx !== -1) {
                    const queueWithNames = contextQueue.map(s => ({ ...s, creatorName: s.artist_name || displayArtist }));
                    setQueue(queueWithNames, idx);
                  }
                }
                playSong({ ...song, creatorName: displayArtist });
              }
            }}
            className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-xl hover:scale-110 hover:bg-primary-hover transition-all"
          >
            {isThisSongPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-1" />
            )}
          </button>
        </div>
        
        {/* Playlist Add Button Overlay */}
        <div className="absolute top-2 right-2 hidden items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 md:flex">
          <PlaylistAddButton songId={song.id} iconClassName="w-4 h-4" className="bg-black/50 p-1.5 rounded-full hover:bg-black/80" />
        </div>

      </div>

      {/* Song Details */}
      <div className="flex flex-col">
        <Link href={`/song/${song.id}`} className="text-base font-semibold text-white truncate hover:underline">
          {song.title}
        </Link>
        <Link href={`/artist/${encodeURIComponent(displayArtist)}`} className="text-sm text-muted truncate hover:text-white hover:underline mt-0.5">
          {displayArtist}
        </Link>
      </div>
    </div>
  );
}
