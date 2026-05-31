'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Mic2, Play, Users, ChevronRight, Edit2, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ArtistStat {
  name: string;
  plays: number;
  songsCount: number;
  coverUrl: string;
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<ArtistStat[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [user, setUser] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const supabase = createClient();

  useEffect(() => {
    const fetchArtists = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);

      // Fetch background video
      const { data: files } = await supabase.storage
        .from('covers')
        .list('discover');
        
      if (files && files.length > 0) {
        const videoFile = files.find(f => f.name.startsWith('background-video'));
        if (videoFile) {
          const { data: urlData } = supabase.storage
            .from('covers')
            .getPublicUrl(`discover/${videoFile.name}`);
          setVideoUrl(urlData.publicUrl);
        }
      }
      
      const { data, error } = await supabase
        .from('songs')
        .select('artist_name, plays, cover_url');
        
      if (data) {
        const artistMap = new Map<string, ArtistStat>();
        
        data.forEach(song => {
          const name = song.artist_name || 'Unbekannt';
          if (name === 'Unbekannt') return; // Skip unknown artists if desired, or keep them. Let's skip for discover page.
          
          if (!artistMap.has(name)) {
            artistMap.set(name, { 
              name, 
              plays: 0, 
              songsCount: 0, 
              coverUrl: song.cover_url 
            });
          }
          const artist = artistMap.get(name)!;
          artist.plays += (song.plays || 0);
          artist.songsCount += 1;
        });
        
        setArtists(Array.from(artistMap.values()).sort((a, b) => b.plays - a.plays));
      }
      
      setLoading(false);
    };

    fetchArtists();
  }, [supabase]);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingVideo(true);
    const ext = file.name.split('.').pop();
    const path = `discover/background-video.${ext}`;

    try {
      const { error } = await supabase.storage
        .from('covers')
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from('covers')
        .getPublicUrl(path);
        
      setVideoUrl(`${data.publicUrl}?t=${Date.now()}`);
    } catch (err: any) {
      console.error('Error uploading video:', err);
      alert('Fehler beim Hochladen des Videos: ' + err.message);
    } finally {
      setIsUploadingVideo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] relative pb-32 group">
      {/* Background Gradient Header or Video */}
      <div className="absolute top-0 left-0 right-0 h-[500px] overflow-hidden pointer-events-none z-0">
        {videoUrl ? (
          <video 
            src={videoUrl} 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="w-full h-full object-cover opacity-40"
            style={{ 
              maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)'
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-[#0A0A0A] blur-3xl" />
        )}
      </div>
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-black/10 via-[#0A0A0A]/60 to-[#0A0A0A] pointer-events-none z-0" />
      
      {/* Header Content */}
      <div className="relative pt-24 px-6 md:px-10 pb-8 flex flex-col md:flex-row gap-8 items-end z-10">
        
        {/* Admin Editable Overlay */}
        {user && (
          <div className="absolute top-10 right-10 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <input 
              type="file" 
              accept="video/*" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleVideoUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingVideo}
              className="flex items-center gap-2 bg-black/50 hover:bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full border border-white/20 transition-all text-sm font-medium"
            >
              {isUploadingVideo ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Edit2 className="w-4 h-4" />
              )}
              Hintergrundvideo ändern
            </button>
          </div>
        )}

        <div className="w-40 h-40 md:w-56 md:h-56 flex-shrink-0 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 border border-white/10 backdrop-blur-md flex items-center justify-center">
          <Mic2 className="w-20 h-20 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-white/50 tracking-[0.2em] uppercase">
            Entdecken
          </span>
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 tracking-tighter drop-shadow-2xl">
            Künstler
          </h1>
          <div className="flex items-center gap-3 text-sm text-white/70 mt-3 font-medium">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center overflow-hidden shadow-inner">
              <Users className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white">AI Stream</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>{artists.length} Künstler*innen</span>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="relative bg-black/40 backdrop-blur-xl px-6 md:px-10 py-10 min-h-screen border-t border-white/5">
        {artists.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {artists.map((artist, idx) => (
              <Link 
                href={`/artist/${encodeURIComponent(artist.name)}`} 
                key={artist.name}
                className="group bg-[#181818] rounded-xl p-5 hover:bg-[#282828] transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 border border-white/5"
              >
                <div className="relative mb-5 w-full aspect-square rounded-full overflow-hidden shadow-lg bg-black">
                  <img 
                    src={artist.coverUrl} 
                    alt={artist.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                  
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-transform">
                      <Play className="w-6 h-6 text-black fill-current ml-1" />
                    </div>
                  </div>
                </div>
                
                <h3 className="font-bold text-white text-lg truncate mb-1">{artist.name}</h3>
                
                <div className="flex items-center justify-between text-xs font-medium text-white/50">
                  <span>{artist.songsCount} {artist.songsCount === 1 ? 'Song' : 'Songs'}</span>
                  <span>{artist.plays.toLocaleString()} Streams</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
              <Mic2 className="w-10 h-10 text-white/30" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Keine Künstler gefunden</h2>
            <p className="text-white/50 max-w-sm">Es gibt aktuell keine Songs von Künstlern auf der Plattform.</p>
          </div>
        )}
      </div>
    </div>
  );
}
