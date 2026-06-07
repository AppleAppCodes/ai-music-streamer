'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ArrowLeft, Mic2, Play, Users, Edit2, Loader2, Music, GripHorizontal, Save } from 'lucide-react';
import { Reorder } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/errors';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isAdminUser } from '@/lib/admin';

interface ArtistStat {
  name: string;
  plays: number;
  songsCount: number;
  coverUrl: string;
  videoUrl?: string;
  createdAt: string;
  sortOrder?: number;
  isOriginal?: boolean;
}

function ArtistVideo({ src, artistName, play }: { src: string; artistName: string; play: boolean }) {
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (play) {
      videoRef.current?.play().catch(() => {});
    } else {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [play]);

  return (
    <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#101010]">
          <Loader2 className="h-8 w-8 animate-spin text-violet-300" aria-label={`${artistName} Video lädt`} />
        </div>
      ) : null}
      <video
        ref={videoRef}
        src={`${src}#t=0.001`}
        preload="metadata"
        loop
        muted
        playsInline
        controlsList="nodownload"
        onLoadedData={() => setReady(true)}
        onCanPlay={() => setReady(true)}
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
        className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover:scale-110 ${
          ready ? 'opacity-100' : 'opacity-0'
        } pointer-events-none select-none`}
      />
    </div>
  );
}

function ArtistCard({ artist }: { artist: ArtistStat }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link 
      href={`/artist/${encodeURIComponent(artist.name)}`} 
      className="group relative h-64 md:h-72 rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 hover:shadow-[0_0_40px_rgba(168,85,247,0.3)] hover:-translate-y-2 border border-white/10 block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Image or Video */}
      {artist.videoUrl ? (
        <ArtistVideo src={artist.videoUrl} artistName={artist.name} play={isHovered} />
      ) : (
        <Image 
          src={artist.coverUrl} 
          alt={artist.name} 
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 pointer-events-none select-none" 
        />
      )}
      
      {/* Premium Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-500 pointer-events-none" />
      <div className="absolute inset-0 bg-indigo-500/10 mix-blend-overlay group-hover:bg-purple-500/20 transition-colors duration-500 pointer-events-none" />
      
      {/* Content */}
      <div className="absolute inset-0 p-8 flex flex-col justify-end translate-y-4 group-hover:translate-y-0 transition-transform duration-500 pointer-events-none">
        <h3 className="font-black text-3xl md:text-4xl text-white mb-2 tracking-tight drop-shadow-2xl">{artist.name}</h3>
        <div className="flex items-center gap-2 text-white/70 font-medium">
          <Music className="w-4 h-4" />
          <span>{artist.songsCount} {artist.songsCount === 1 ? 'Song' : 'Songs'}</span>
        </div>
      </div>

      {/* Hover Play Button Overlay */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100 pointer-events-none">
        <div className="w-20 h-20 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center shadow-2xl">
          <Play className="w-8 h-8 text-white fill-white ml-2" />
        </div>
      </div>
    </Link>
  );
}

export default function ArtistsPage() {
  const router = useRouter();
  const [artists, setArtists] = useState<ArtistStat[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const supabase = createClient();
  const isAdmin = isAdminUser(user);

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
          const cacheKey = new Date(videoFile.updated_at || videoFile.created_at || 0).getTime();
          setVideoUrl(`${urlData.publicUrl}?t=${cacheKey}`);
        }
      }
      
      const { data } = await supabase
        .from('songs')
        .select('artist_name, plays, cover_url, created_at');
        
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
              coverUrl: song.cover_url,
              createdAt: song.created_at || new Date(0).toISOString()
            });
          }
          const artist = artistMap.get(name)!;
          artist.plays += (song.plays || 0);
          artist.songsCount += 1;
          
          if (song.created_at && new Date(song.created_at).getTime() > new Date(artist.createdAt).getTime()) {
            artist.createdAt = song.created_at;
          }
        });
        
        const artistArray = Array.from(artistMap.values());
        
        // Fetch all banners to see if there are videos
        const { data: banners } = await supabase.storage.from('covers').list('banners', { limit: 100 });
        if (banners) {
          artistArray.forEach(artist => {
            const sanitizedName = artist.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const videoFiles = banners.filter(f => f.name.startsWith(sanitizedName + '_video'));
            if (videoFiles.length > 0) {
              videoFiles.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
              const videoFile = videoFiles[0];
              const { data: urlData } = supabase.storage
                .from('covers')
                .getPublicUrl(`banners/${videoFile.name}`);
              const cacheKey = new Date(videoFile.updated_at || videoFile.created_at || 0).getTime();
              artist.videoUrl = `${urlData.publicUrl}?t=${cacheKey}`;
            }
          });
        }
        
        // Fetch sort orders and is_original flag
        const { data: profilesData } = await supabase.from('artist_profiles').select('artist_name, sort_order, is_original');
        const profileMap = new Map((profilesData || []).map(p => [p.artist_name, { sort: p.sort_order, original: p.is_original }]));
        
        artistArray.forEach(artist => {
          const profile = profileMap.get(artist.name);
          artist.sortOrder = profile?.sort || 0;
          artist.isOriginal = profile?.original || false;
        });
        
        setArtists(artistArray.sort((a, b) => {
          if (a.sortOrder !== b.sortOrder) return (a.sortOrder || 0) - (b.sortOrder || 0);
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }));
      }
      
      setLoading(false);
    };

    fetchArtists();
  }, [supabase]);

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const orderData = artists.map((artist, index) => ({
        artist_name: artist.name,
        sort_order: index,
        is_original: artist.isOriginal || false,
      }));
      const { error } = await supabase.rpc('update_artist_order', { order_data: orderData });
      if (error) throw error;
      setIsEditingOrder(false);
    } catch (err: unknown) {
      console.error('Error saving order:', err);
      alert('Fehler beim Speichern der Reihenfolge: ' + getErrorMessage(err));
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
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
    } catch (err: unknown) {
      console.error('Error uploading video:', err);
      alert('Fehler beim Hochladen des Videos: ' + getErrorMessage(err));
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
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] relative pb-32">
      {/* Background Gradient Header or Video */}
      <div className="absolute top-0 left-0 right-0 h-[500px] overflow-hidden pointer-events-none z-0">
        {videoUrl ? (
          <video 
            src={videoUrl} 
            autoPlay 
            loop 
            muted 
            playsInline
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
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

      <button
        type="button"
        onClick={() => router.back()}
        className="absolute left-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white md:left-8 md:top-8"
        aria-label="Zurück"
      >
        <ArrowLeft className="h-6 w-6" />
      </button>
      
      {/* Header Content */}
      <div className="relative group pt-24 px-6 md:px-10 pb-8 flex flex-col md:flex-row gap-8 items-end z-10">
        
        {/* Admin Editable Overlay */}
        {isAdmin && (
          <div className="absolute top-10 right-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            {isEditingOrder ? (
              <button 
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
                className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-full border border-teal-400 transition-all text-sm font-bold shadow-lg"
              >
                {isSavingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Reihenfolge speichern
              </button>
            ) : (
              <button 
                onClick={() => setIsEditingOrder(true)}
                className="flex items-center gap-2 bg-black/50 hover:bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full border border-white/20 transition-all text-sm font-medium"
              >
                <GripHorizontal className="w-4 h-4" />
                Reihenfolge ändern
              </button>
            )}
            {!isEditingOrder && (
              <>
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
                  Video ändern
                </button>
              </>
            )}
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
            Künstler entdecken
          </h1>
          <div className="flex items-center gap-3 text-sm text-white/70 mt-3 font-medium">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center overflow-hidden shadow-inner">
              <Users className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white">YORIAX</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>{artists.length} Künstler*innen</span>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="relative bg-black/40 backdrop-blur-xl px-6 md:px-10 py-10 min-h-screen border-t border-white/5">
        {artists.length > 0 ? (
          isEditingOrder ? (
            <Reorder.Group axis="y" values={artists} onReorder={setArtists} className="flex flex-col gap-4 max-w-3xl mx-auto">
              {artists.map((artist) => (
                <Reorder.Item 
                  key={artist.name} 
                  value={artist} 
                  className="relative flex items-center justify-between bg-white/[0.08] backdrop-blur-lg border border-white/10 rounded-2xl p-4 cursor-grab active:cursor-grabbing hover:bg-white/15 transition-colors shadow-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-black/50">
                      {artist.coverUrl ? (
                        <img src={artist.coverUrl} className="w-full h-full object-cover" alt={artist.name} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Mic2 className="w-8 h-8 text-white/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-col">
                      <h3 className="font-bold text-xl text-white tracking-tight">{artist.name}</h3>
                      <p className="text-sm text-white/50">{artist.songsCount} {artist.songsCount === 1 ? 'Song' : 'Songs'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setArtists(prev => prev.map(a => a.name === artist.name ? { ...a, isOriginal: !a.isOriginal } : a));
                      }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${artist.isOriginal ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-white/40 border border-transparent hover:bg-white/10 hover:text-white'}`}
                      title="Yoriax Original Status umschalten"
                    >
                      <Users className="w-5 h-5" />
                    </button>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-colors cursor-grab active:cursor-grabbing">
                      <GripHorizontal className="w-5 h-5" />
                    </div>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <div className="flex flex-col gap-16">
              {/* Yoriax Originals */}
              {artists.filter(a => a.isOriginal).length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Yoriax Originals</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {artists.filter(a => a.isOriginal).slice(0, 12).map((artist) => (
                      <ArtistCard key={artist.name} artist={artist} />
                    ))}
                  </div>
                </section>
              )}

              {/* Alle Künstler Liste */}
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
                    <Mic2 className="w-5 h-5 text-white/50" />
                  </div>
                  <h2 className="text-3xl font-black text-white tracking-tight">Alle Künstler</h2>
                </div>
                <div className="flex flex-col gap-2 max-w-4xl">
                  {artists.map((artist) => (
                    <Link 
                      key={artist.name}
                      href={`/artist/${encodeURIComponent(artist.name)}`}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.05] transition-colors group"
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-white/5 shrink-0 relative shadow-md">
                        <img src={artist.coverUrl} alt={artist.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">{artist.name}</span>
                        <span className="text-sm text-white/50">{artist.songsCount} {artist.songsCount === 1 ? 'Song' : 'Songs'}</span>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                        <Play className="w-4 h-4 text-white ml-1" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          )
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
