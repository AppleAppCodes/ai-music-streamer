'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Song } from '@/lib/types';
import { Play, Pause, Clock3, Edit2, Save, X, Plus, Music } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import { useTranslation } from 'react-i18next';
import SongCard from '@/components/ui/SongCard';
import Image from 'next/image';
import LikeButton from '@/components/ui/LikeButton';
import PlaylistAddButton from '@/components/ui/PlaylistAddButton';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isAdminUser } from '@/lib/admin';

type SongWithProfile = Song & {
  profiles?: {
    username?: string | null;
  } | null;
};

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function SongPageClient({ songId }: { songId: string }) {
  const id = songId;
  const { t } = useTranslation();
  const { playSong, currentSong, isPlaying, togglePlayPause, setQueue } = usePlayer();
  
  const [song, setSong] = useState<Song | null>(null);
  const [relatedSongs, setRelatedSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editHumanEdit, setEditHumanEdit] = useState<number>(0);
  const [editVocalsType, setEditVocalsType] = useState<string>('AI');
  const [editArtistName, setEditArtistName] = useState<string>('');
  const [editCredits, setEditCredits] = useState<{ role: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!id) return;

    const fetchSongDetails = async () => {
      setLoading(true);
      
      // Fetch the main song
      const { data: songData } = await supabase
        .from('songs')
        .select('*, profiles!songs_creator_id_fkey(username)')
        .eq('id', id)
        .single();
        
      if (songData) {
        const songWithProfile = songData as SongWithProfile;
        const creatorName = songWithProfile.artist_name || 'Creator';
        const songForState: SongWithProfile = { ...songWithProfile, creatorName };
        delete songForState.profiles;

        setSong(songForState);
        setEditHumanEdit(songData.human_edit ?? 0);
        setEditVocalsType(songData.vocals_type || 'AI');
        setEditArtistName(songData.artist_name || '');
        setEditCredits(songData.credits || []);
        
        // Fetch related songs by the same artist
        const artistName = songData.artist_name || 'Creator';
        const { data: relatedData } = await supabase
          .from('songs')
          .select('*')
          .eq('artist_name', artistName)
          .neq('id', id)
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (relatedData) {
          setRelatedSongs(relatedData);
        }
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);

      setLoading(false);
    };

    fetchSongDetails();
  }, [id, supabase]);

  const handleSaveMetadata = async () => {
    if (!song || !isAdminUser(user)) return;
    setSaving(true);
    
    const { error } = await supabase
      .from('songs')
      .update({
        human_edit: editHumanEdit,
        vocals_type: editVocalsType,
        artist_name: editArtistName,
        credits: editCredits
      })
      .eq('id', song.id);
      
    if (!error) {
      setSong({ ...song, human_edit: editHumanEdit, vocals_type: editVocalsType, artist_name: editArtistName, creatorName: editArtistName, credits: editCredits });
      setIsEditing(false);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="yoriax-page flex min-h-screen flex-1 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="yoriax-page flex min-h-screen flex-1 items-center justify-center">
        <h1 className="text-2xl text-white">Song not found</h1>
      </div>
    );
  }

  const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
  const displayArtist = song.artist_name || t('player.creatorFallback');
  const displayCreator = song.creatorName || displayArtist;
  const releaseYear = new Date(song.created_at).getFullYear();
  const durationText = formatDuration(song.duration);
  const canEditSong = isAdminUser(user);

  return (
    <div className="yoriax-page flex-1 overflow-y-auto pb-32">
      {/* Header Content */}
      <div className="relative flex flex-col items-center gap-5 px-5 pb-6 pt-20 text-center md:flex-row md:items-end md:gap-8 md:px-10 md:pt-24 md:text-left">
        <div className="relative flex h-44 w-44 flex-shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] border border-primary-light/20 bg-surface-hover shadow-[0_24px_70px_rgba(0,0,0,0.52)] sm:h-48 sm:w-48 md:h-60 md:w-60">
          {song.cover_url ? (
            <Image src={song.cover_url} alt={song.title} fill sizes="(max-width: 768px) 192px, 240px" className="object-cover" priority />
          ) : (
            <Music className="w-20 h-20 text-white/20" />
          )}
        </div>
        <div className="flex w-full min-w-0 flex-col items-center gap-2 md:mt-0 md:items-start md:gap-4">
          <span className="text-sm font-semibold text-white/90 drop-shadow-md tracking-wider uppercase">
            {t('song.single')}
          </span>
          <h1 className="max-w-full break-words text-center text-4xl font-extrabold tracking-tighter text-white drop-shadow-lg sm:text-5xl md:text-left md:text-7xl">
            {song.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-white/90 md:justify-start">
            <Link href={`/artist/${encodeURIComponent(displayArtist)}`} className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform">
              <span className="text-xs">{displayArtist.charAt(0)}</span>
            </Link>
            <Link href={`/artist/${encodeURIComponent(displayArtist)}`} className="hover:underline cursor-pointer font-bold">
              {displayArtist}
            </Link>
            <span>•</span>
            <span>{releaseYear}</span>
            <span>•</span>
            <span>{t('song.songCount', { count: 1 })}</span>
            {song.duration && (
              <>
                <span>•</span>
                <span>{durationText}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Background overlay for lower section */}
      <div className="relative min-h-screen border-t border-white/5 bg-black/20 px-6 py-6 backdrop-blur-3xl md:px-10">
        
        {/* Action Bar */}
        <div className="mb-10 flex items-center justify-center gap-6 md:justify-start">
          <button 
            onClick={() => {
              if (currentSong?.id === song.id) {
                togglePlayPause();
              } else {
                playSong({ ...song, creatorName: displayArtist });
              }
            }}
            className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-black hover:scale-105 hover:bg-primary-hover transition-all shadow-xl"
          >
            {isThisSongPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current" />
            )}
          </button>
          
          <LikeButton songId={song.id} iconClassName="w-8 h-8" />
        </div>

        {/* Tracklist Table */}
        <div className="mb-16">
          {/* Table Header */}
          <div className="mb-2 grid grid-cols-[16px_minmax(0,1fr)_36px] gap-3 border-b border-white/10 px-2 py-2 text-sm text-white/60 sm:grid-cols-[16px_minmax(0,1fr)_80px_40px_36px] sm:gap-4 sm:px-4 md:grid-cols-[16px_1fr_150px_40px_36px]">
            <div>#</div>
            <div>{t('song.title')}</div>
            <div className="hidden text-right sm:block">{t('song.plays')}</div>
            <div className="hidden justify-end sm:flex"><Clock3 className="w-4 h-4" /></div>
            <div />
          </div>
          
          {/* Track Row */}
          <div 
            onClick={() => {
              if (currentSong?.id !== song.id) {
                // To keep it simple, the queue is just the main song + related songs
                const queueWithNames = [song, ...relatedSongs].map(s => ({ ...s, creatorName: s.artist_name || displayArtist }));
                setQueue(queueWithNames, 0); // Note: index 0 might not be exact if related, but good enough or we just set queue to this single related song. Wait, actually we can just pass relatedSongs as queue. Let's just set the queue to [song] for now, or just the whole list.
                playSong({ ...song, creatorName: displayArtist });
              }
            }}
            className="grid cursor-pointer grid-cols-[16px_minmax(0,1fr)_36px] items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-white/10 sm:grid-cols-[16px_minmax(0,1fr)_80px_40px_36px] sm:gap-4 sm:px-4 md:grid-cols-[16px_1fr_150px_40px_36px]"
          >
            <div className="text-white/60 group-hover:text-white text-base">
              {isThisSongPlaying ? (
                <div className="w-4 h-4 flex items-end justify-between">
                  <div className="w-1 bg-primary h-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 bg-primary h-2/3 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1 bg-primary h-4/5 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              ) : (
                <span className="group-hover:hidden">1</span>
              )}
              {!isThisSongPlaying && <Play className="w-4 h-4 hidden group-hover:block fill-current" />}
            </div>
            
            <div className="flex min-w-0 flex-col">
              <span className={`truncate text-base font-normal ${currentSong?.id === song.id ? 'text-primary' : 'text-white'}`}>
                {song.title}
              </span>
              <span className="truncate text-sm text-white/60">{displayArtist}</span>
            </div>
            
            <div className="hidden text-right font-mono text-sm tracking-wider text-white/60 sm:block">
              {song.plays.toLocaleString()}
            </div>
            
            <div className="hidden text-right text-sm text-white/60 sm:block">
              {durationText}
            </div>

            <div onClick={(event) => event.stopPropagation()}>
              <PlaylistAddButton songId={song.id} iconClassName="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Track Info / Credits */}
        <div className="yoriax-card group/edit relative mb-16 max-w-4xl rounded-[1.75rem] p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white">Track Info & Credits</h3>
            {canEditSong && !isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover/edit:opacity-100 transition-opacity flex items-center gap-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg border border-white/10"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Bearbeiten
              </button>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Creator / Artist</label>
                  <input
                    type="text"
                    value={editArtistName}
                    onChange={(e) => setEditArtistName(e.target.value)}
                    className="yoriax-input w-full rounded-xl px-3 py-2"
                    placeholder="Creator Name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Human Edit Anteil: {editHumanEdit}%</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={editHumanEdit} 
                    onChange={(e) => setEditHumanEdit(parseInt(e.target.value))}
                    className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-primary"
                  />
                  <div className="flex justify-between text-xs text-white/50 mt-2">
                    <span>0% (Pure AI)</span>
                    <span>100% (Manual)</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Vocals Type</label>
                <div className="flex gap-4">
                  {['AI', 'Human', 'Hybrid', 'Instrumental'].map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer bg-black/20 px-4 py-2 rounded-lg border border-white/5">
                      <input 
                        type="radio" 
                        name="editVocalsType" 
                        value={type}
                        checked={editVocalsType === type}
                        onChange={(e) => setEditVocalsType(e.target.value)}
                        className="h-4 w-4 border-white/20 bg-white/10 text-primary focus:ring-primary focus:ring-offset-black"
                      />
                      <span className="text-white/90 text-sm">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Editable Credits Section */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider">Weitere Credits (Optional)</label>
                  {editCredits.length < 20 && (
                    <button
                      type="button"
                      onClick={() => setEditCredits([...editCredits, { role: 'Creator', name: '' }])}
                      className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary-light transition-colors hover:bg-primary/20 hover:text-white"
                    >
                      <Plus className="w-4 h-4" />
                      Hinzufügen
                    </button>
                  )}
                </div>
                
                <div className="space-y-3">
                  {editCredits.map((credit, index) => (
                    <div key={index} className="flex gap-3 items-center">
                      <select
                        value={credit.role}
                        onChange={(e) => {
                          const newCredits = [...editCredits];
                          newCredits[index].role = e.target.value;
                          setEditCredits(newCredits);
                        }}
                        className="yoriax-input w-1/3 rounded-xl px-3 py-2.5 text-sm"
                      >
                        <option value="Creator">Creator</option>
                        <option value="Producer">Producer</option>
                        <option value="Mixing Engineer">Mixing Engineer</option>
                        <option value="Instrumentalist">Instrumentalist</option>
                        <option value="Vocalist">Vocalist</option>
                      </select>
                      <input
                        type="text"
                        value={credit.name}
                        onChange={(e) => {
                          const newCredits = [...editCredits];
                          newCredits[index].name = e.target.value;
                          setEditCredits(newCredits);
                        }}
                        placeholder="Name"
                        className="yoriax-input flex-1 rounded-xl px-4 py-2.5 text-sm placeholder-white/30"
                      />
                      <button
                        type="button"
                        onClick={() => setEditCredits(editCredits.filter((_, i) => i !== index))}
                        className="text-white/30 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-white/5"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {editCredits.length === 0 && (
                    <p className="text-sm text-white/40 italic">Keine zusätzlichen Credits vorhanden.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Abbrechen
                </button>
                <button 
                  onClick={handleSaveMetadata}
                  disabled={saving}
                  className="flex items-center gap-2 text-sm font-bold text-black bg-white hover:bg-white/90 px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? t('common.saving') : <><Save className="w-4 h-4" /> {t('common.save')}</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-black/20 rounded-xl p-4 transition-colors hover:bg-black/30">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Creator</div>
                  <div className="font-semibold text-white/90">{displayCreator}</div>
                </div>

                <div className="bg-black/20 rounded-xl p-4 transition-colors hover:bg-black/30">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Human Edit Anteil</div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-white/90 w-10">{song.human_edit ?? 0}%</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="bg-gradient-primary h-full rounded-full transition-all duration-1000" style={{ width: `${song.human_edit ?? 0}%` }} />
                    </div>
                  </div>
                </div>

                <div className="bg-black/20 rounded-xl p-4 transition-colors hover:bg-black/30">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Vocals</div>
                  <div className="font-semibold text-white/90 capitalize">{song.vocals_type || 'Unbekannt'}</div>
                </div>
              </div>

              {song.credits && song.credits.length > 0 && (
                <div className="bg-black/20 rounded-xl p-4 transition-colors hover:bg-black/30">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Weitere Credits</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {song.credits.map((credit, idx) => (
                      <div key={idx} className="flex flex-col">
                        <span className="mb-0.5 text-xs font-medium text-primary-light">{credit.role}</span>
                        <span className="text-sm font-semibold text-white/90">{credit.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* More By Artist */}
        {relatedSongs.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">
              {t('song.moreBy', { artist: displayArtist })}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {relatedSongs.map(related => (
                <SongCard key={related.id} song={related} creatorName={displayArtist} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
