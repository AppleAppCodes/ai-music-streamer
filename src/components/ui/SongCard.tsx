import Link from 'next/link';
import { Play, Pause, Music } from 'lucide-react';
import { Song } from '@/lib/types';
import { usePlayer } from '@/lib/player-context';
import PlaylistAddButton from '@/components/ui/PlaylistAddButton';
import MobileSongMenu from '@/components/ui/MobileSongMenu';
import Image from 'next/image';

import { useRouter } from 'next/navigation';

interface SongCardProps {
  song: Song;
  creatorName?: string;
  className?: string;
  contextQueue?: Song[];
  compact?: boolean;
  priority?: boolean;
}

export default function SongCard({ song, creatorName = 'Creator', className = '', contextQueue, compact = false, priority = false }: SongCardProps) {
  const router = useRouter();
  const { playSong, currentSong, isPlaying, togglePlayPause, setQueue, preloadSong } = usePlayer();
  const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
  const displayArtist = song.artist_name || creatorName;

  return (
    <div
      onPointerEnter={() => preloadSong(song)}
      onFocus={() => preloadSong(song)}
      onClick={() => router.push(`/song/${song.id}`)}
      className={`group relative flex cursor-pointer flex-col rounded-[1.35rem] border border-white/[0.065] bg-[linear-gradient(150deg,rgba(33,24,51,0.58),rgba(9,7,14,0.66))] shadow-[0_16px_42px_rgba(0,0,0,0.2)] transition-all hover:-translate-y-0.5 hover:border-violet-300/18 hover:bg-[linear-gradient(150deg,rgba(45,33,66,0.7),rgba(12,9,18,0.76))] hover:shadow-[0_22px_58px_rgba(0,0,0,0.32)] ${compact ? 'gap-2 p-2.5' : 'gap-3 p-4'} ${className}`}
    >
      {/* Cover Image Container */}
      <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-[1.1rem] border border-white/10 shadow-[0_18px_38px_rgba(0,0,0,0.34)]">
        {song.cover_url ? (
          <Image
            src={song.cover_url}
            alt={song.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 180px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-hover">
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
            className={`${compact ? 'h-10 w-10' : 'h-12 w-12'} flex items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-[0_12px_28px_rgba(124,58,237,0.42)] transition-all hover:scale-110 hover:from-violet-400 hover:to-violet-600`}
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
