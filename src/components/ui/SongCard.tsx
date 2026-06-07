import Link from 'next/link';
import { Play, Pause, Music } from 'lucide-react';
import { Song } from '@/lib/types';
import { usePlayer } from '@/lib/player-context';
import PlaylistAddButton from '@/components/ui/PlaylistAddButton';
import MobileSongMenu from '@/components/ui/MobileSongMenu';
import Image from 'next/image';

interface SongCardProps {
  song: Song;
  creatorName?: string;
  className?: string;
  contextQueue?: Song[];
  compact?: boolean;
}

export default function SongCard({ song, creatorName = 'Creator', className = '', contextQueue, compact = false }: SongCardProps) {
  const { playSong, currentSong, isPlaying, togglePlayPause, setQueue } = usePlayer();
  const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
  const displayArtist = song.artist_name || creatorName;

  return (
    <div className={`group relative flex flex-col rounded-xl hover:bg-white/5 transition-colors cursor-pointer ${compact ? 'gap-2 p-2.5' : 'gap-3 p-4'} ${className}`}>
      {/* Cover Image Container */}
      <div className="relative aspect-square w-full rounded-md overflow-hidden shadow-lg mb-2">
        {song.cover_url ? (
          <Image 
            src={song.cover_url} 
            alt={song.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 180px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-[#282828] flex items-center justify-center">
            <Music className="h-12 w-12 text-white/20" />
          </div>
        )}
        
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
            className={`${compact ? 'h-10 w-10' : 'h-12 w-12'} rounded-full bg-primary flex items-center justify-center text-white shadow-xl hover:scale-110 hover:bg-primary-hover transition-all`}
          >
            {isThisSongPlaying ? (
              <Pause className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} fill-current`} />
            ) : (
              <Play className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} fill-current`} />
            )}
          </button>
        </div>
        
        {/* Playlist Add Button Overlay */}
        <div className="absolute top-2 right-2 hidden items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 md:flex">
          <PlaylistAddButton songId={song.id} iconClassName="w-4 h-4" className="bg-black/50 p-1.5 rounded-full hover:bg-black/80" />
        </div>

      </div>

      {/* Song Details */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0 flex-1">
          <Link href={`/song/${song.id}`} className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-white truncate hover:underline`}>
            {song.title}
          </Link>
          <Link href={`/artist/${encodeURIComponent(displayArtist)}`} className={`${compact ? 'text-xs' : 'text-sm'} text-muted truncate hover:text-white hover:underline mt-0.5`}>
            {displayArtist}
          </Link>
        </div>
        <div className="-mt-1 -mr-2">
          <MobileSongMenu song={song} />
        </div>
      </div>
    </div>
  );
}
