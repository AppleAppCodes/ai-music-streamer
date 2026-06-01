'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { UploadCloud, Music, Image as ImageIcon, Loader2, CheckCircle2, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ArtistAutocomplete from '@/components/ui/ArtistAutocomplete';
import CustomSelect from '@/components/ui/CustomSelect';
import { GENRES, MOODS } from '@/lib/constants';
import { getErrorMessage } from '@/lib/errors';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { compressImage } from '@/lib/imageCompression';

export default function UploadPage() {
  const { t } = useTranslation();
  const [uploadMode, setUploadMode] = useState<'single' | 'album'>('single');
  const [albumType, setAlbumType] = useState<'album' | 'ep'>('album');
  const [albumFiles, setAlbumFiles] = useState<{file: File, title: string, duration?: number}[]>([]);

  const [artistName, setArtistName] = useState('');
  const [title, setTitle] = useState(''); // Single title OR Album title
  const [genre, setGenre] = useState(GENRES[0].name);
  const [mood, setMood] = useState(MOODS[0]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isDraggingAudio, setIsDraggingAudio] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [humanEdit, setHumanEdit] = useState<number>(0);
  const [vocalsType, setVocalsType] = useState<string>('AI');
  const [credits, setCredits] = useState<{ role: string; name: string }[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [user, setUser] = useState<SupabaseUser | null>(null);
  
  const router = useRouter();
  const supabase = createClient();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
      }
    };
    getUser();
  }, [router, supabase]);

  const handleAudioFileChange = (file: File | null) => {
    setAudioFile(file);
    setAudioDuration(null);
  };

  // Auto-detect audio duration when file is selected
  useEffect(() => {
    if (!audioFile) return;

    const url = URL.createObjectURL(audioFile);
    const audio = new Audio(url);
    let revoked = false;
    const revokeUrl = () => {
      if (!revoked) {
        URL.revokeObjectURL(url);
        revoked = true;
      }
    };
    const handleLoadedMetadata = () => {
      setAudioDuration(Math.round(audio.duration));
      revokeUrl();
    };
    const handleError = () => {
      setAudioDuration(null);
      revokeUrl();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      revokeUrl();
    };
  }, [audioFile]);

  const handleAudioDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingAudio(false);
    if (e.dataTransfer.files?.length) {
      if (uploadMode === 'single') {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('audio/')) {
          handleAudioFileChange(file);
        } else {
          setError(t('upload.errorOnlyAudio') || 'Bitte lade nur Audio-Dateien hoch.');
        }
      } else {
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
        if (files.length === 0) {
          setError('Keine gültigen Audio-Dateien gefunden.');
          return;
        }
        const newAlbumFiles = files.map(f => ({
          file: f,
          title: f.name.replace(/\.[^/.]+$/, ""),
          duration: undefined
        }));
        setAlbumFiles(prev => [...prev, ...newAlbumFiles]);
      }
    }
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCover(false);
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setCoverFile(file);
      } else {
        setError(t('upload.errorOnlyImage') || 'Bitte lade nur Bild-Dateien hoch.');
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadMode === 'single' && !audioFile) {
      setError('Bitte lade eine Audio-Datei hoch.'); return;
    }
    if (uploadMode === 'album' && albumFiles.length === 0) {
      setError('Bitte lade mindestens eine Audio-Datei für das Album hoch.'); return;
    }
    if (!coverFile || !title || !artistName || !vocalsType) {
      setError('Bitte fülle alle Pflichtfelder aus.');
      return;
    }
    if (!user) {
      setError('Bitte melde dich erneut an, bevor du etwas hochlädst.');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // 1. Upload Cover Image
      const compressedCover = await compressImage(coverFile);
      const coverExt = compressedCover.name.split('.').pop();
      const coverPath = `${user.id}/${Date.now()}_cover.${coverExt}`;
      const { error: coverError } = await supabase.storage
        .from('covers')
        .upload(coverPath, compressedCover);
        
      if (coverError) throw new Error('Cover-Upload fehlgeschlagen: ' + coverError.message);
      
      const { data: { publicUrl: coverUrl } } = supabase.storage
        .from('covers')
        .getPublicUrl(coverPath);

      if (uploadMode === 'single' && audioFile) {
        // --- SINGLE UPLOAD ---
        const audioExt = audioFile.name.split('.').pop();
        const audioPath = `${user.id}/${Date.now()}_song.${audioExt}`;
        const { error: audioError } = await supabase.storage
          .from('songs')
          .upload(audioPath, audioFile);
          
        if (audioError) throw new Error('Song-Upload fehlgeschlagen: ' + audioError.message);
        
        const { data: { publicUrl: audioUrl } } = supabase.storage
          .from('songs')
          .getPublicUrl(audioPath);

        const { error: dbError } = await supabase
          .from('songs')
          .insert({
            creator_id: user.id,
            artist_name: artistName,
            title,
            genre,
            mood,
            cover_url: coverUrl,
            audio_url: audioUrl,
            human_edit: humanEdit,
            vocals_type: vocalsType,
            credits,
            duration: audioDuration || null,
            plays: 0
          });
        if (dbError) throw new Error('Datenbank-Fehler: ' + dbError.message);

      } else {
        // --- ALBUM UPLOAD ---
        const { data: albumData, error: albumError } = await supabase
          .from('albums')
          .insert({
            creator_id: user.id,
            title,
            cover_url: coverUrl,
            type: albumType
          }).select().single();
          
        if (albumError || !albumData) throw new Error('Fehler beim Erstellen des Albums.');

        // Upload all songs
        for (let i = 0; i < albumFiles.length; i++) {
          const item = albumFiles[i];
          const audioExt = item.file.name.split('.').pop();
          const audioPath = `${user.id}/${Date.now()}_albumsong_${i}.${audioExt}`;
          const { error: audioError } = await supabase.storage
            .from('songs')
            .upload(audioPath, item.file);
            
          if (audioError) throw new Error(`Upload fehlgeschlagen für ${item.title}`);
          
          const { data: { publicUrl: audioUrl } } = supabase.storage
            .from('songs')
            .getPublicUrl(audioPath);

          const { error: dbError } = await supabase
            .from('songs')
            .insert({
              creator_id: user.id,
              artist_name: artistName,
              title: item.title,
              genre,
              mood,
              cover_url: coverUrl,
              audio_url: audioUrl,
              human_edit: humanEdit,
              vocals_type: vocalsType,
              credits,
              duration: item.duration || null,
              plays: 0,
              album_id: albumData.id,
              track_number: i + 1
            });
            
          if (dbError) throw new Error(`Fehler beim Speichern von ${item.title}`);
        }
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 2000);

    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null; // Wait for auth redirect
  const creatorDisplayName = user.user_metadata?.username || user.email?.split('@')[0] || 'Creator';

  if (success) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-full">
        <CheckCircle2 className="w-24 h-24 text-green-500 mb-6 animate-pulse" />
        <h1 className="text-3xl font-bold text-white mb-2">{t('upload.successTitle')}</h1>
        <p className="text-white/60">{t('upload.successText')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-32">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">{t('upload.title')}</h1>
          <p className="text-white/50">{t('upload.subtitle')}</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-white/5 border border-white/10 rounded-full p-1 mb-8 w-fit">
          <button
            type="button"
            onClick={() => setUploadMode('single')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-colors ${uploadMode === 'single' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
          >
            Single
          </button>
          <button
            type="button"
            onClick={() => setUploadMode('album')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-colors ${uploadMode === 'album' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
          >
            Album / EP
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-8">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              {error}
            </div>
          )}

          {/* Form Fields Container */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6 backdrop-blur-md">
            
            <ArtistAutocomplete 
              value={artistName} 
              onChange={setArtistName} 
            />

            {uploadMode === 'album' && (
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-2">Release Typ *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="albumType" 
                      value="album"
                      checked={albumType === 'album'}
                      onChange={() => setAlbumType('album')}
                      className="text-indigo-500 bg-white/10 border-white/20"
                    />
                    <span className="text-white/80 text-sm">Album</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="albumType" 
                      value="ep"
                      checked={albumType === 'ep'}
                      onChange={() => setAlbumType('ep')}
                      className="text-indigo-500 bg-white/10 border-white/20"
                    />
                    <span className="text-white/80 text-sm">EP</span>
                  </label>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-white/80 mb-2">
                {uploadMode === 'single' ? t('upload.songTitle') : 'Album Titel *'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder={uploadMode === 'single' ? t('upload.songTitlePlaceholder') : 'Name des Albums'}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-2">{t('upload.genre')}</label>
                <CustomSelect
                  options={GENRES.map(g => ({ value: g.name, label: g.name }))}
                  value={genre}
                  onChange={setGenre}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-2">{t('upload.mood')}</label>
                <CustomSelect
                  options={MOODS.map(m => ({ value: m, label: m }))}
                  value={mood}
                  onChange={setMood}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/80 mb-2">Human Edit Anteil: {humanEdit}%</label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={humanEdit} 
                onChange={(e) => setHumanEdit(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-white/50 mt-2">
                <span>0% (Pure AI)</span>
                <span>100% (Manual)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/80 mb-3">Art der Vocals *</label>
              <div className="flex gap-4">
                {['AI', 'Human', 'Hybrid', 'Instrumental'].map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="vocalsType" 
                      value={type}
                      checked={vocalsType === type}
                      onChange={(e) => setVocalsType(e.target.value)}
                      className="w-4 h-4 text-indigo-500 bg-white/10 border-white/20 focus:ring-indigo-500 focus:ring-offset-black"
                    />
                    <span className="text-white/80 text-sm">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Optional Credits Section */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-semibold text-white/80">Weitere Credits (Optional)</label>
                {credits.length < 20 && (
                  <button
                    type="button"
                    onClick={() => setCredits([...credits, { role: 'Creator', name: '' }])}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Hinzufügen
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                {credits.map((credit, index) => (
                  <div key={index} className="flex gap-3 items-center">
                    <select
                      value={credit.role}
                      onChange={(e) => {
                        const newCredits = [...credits];
                        newCredits[index].role = e.target.value;
                        setCredits(newCredits);
                      }}
                      className="w-1/3 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                        const newCredits = [...credits];
                        newCredits[index].name = e.target.value;
                        setCredits(newCredits);
                      }}
                      placeholder="Name"
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setCredits(credits.filter((_, i) => i !== index))}
                      className="text-white/30 hover:text-red-400 transition-colors p-2"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* File Uploads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Audio Upload */}
            <div 
              onClick={() => audioInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingAudio(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDraggingAudio(false); }}
              onDrop={handleAudioDrop}
              className={`border-2 border-dashed ${isDraggingAudio ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-indigo-500/50 bg-white/5'} rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group`}
            >
              <input 
                type="file" 
                accept="audio/*" 
                multiple={uploadMode === 'album'}
                className="hidden" 
                ref={audioInputRef}
                onChange={(e) => {
                  if (uploadMode === 'single') {
                    handleAudioFileChange(e.target.files?.[0] || null);
                  } else {
                    const files = Array.from(e.target.files || []);
                    const newAlbumFiles = files.map(f => ({
                      file: f,
                      title: f.name.replace(/\.[^/.]+$/, ""),
                      duration: undefined
                    }));
                    setAlbumFiles(prev => [...prev, ...newAlbumFiles]);
                  }
                }}
              />
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
                <Music className={`w-8 h-8 ${audioFile || albumFiles.length > 0 ? 'text-indigo-400' : 'text-white/40'}`} />
              </div>
              <h3 className="text-white font-semibold mb-1">
                {uploadMode === 'single' ? (audioFile ? audioFile.name : t('upload.uploadAudio')) : (albumFiles.length > 0 ? `${albumFiles.length} Tracks ausgewählt` : 'Audios hochladen')}
              </h3>
              <p className="text-white/40 text-sm">
                {uploadMode === 'single' ? (audioFile ? t('upload.changeFile') : t('upload.uploadAudioHint')) : (albumFiles.length > 0 ? 'Klicken, um weitere hinzuzufügen' : 'Ziehe mehrere Audio-Dateien hierhin')}
              </p>
            </div>

            {/* Cover Upload */}
            <div 
              onClick={() => coverInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingCover(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDraggingCover(false); }}
              onDrop={handleCoverDrop}
              className={`border-2 border-dashed ${isDraggingCover ? 'border-pink-500 bg-pink-500/10' : 'border-white/10 hover:border-pink-500/50 bg-white/5'} rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group relative overflow-hidden`}
            >
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={coverInputRef}
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              />
              
              {coverFile ? (
                <div className="absolute inset-0 z-0 opacity-40">
                  <img src={URL.createObjectURL(coverFile)} alt="Cover preview" className="w-full h-full object-cover blur-sm" />
                </div>
              ) : null}

              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 group-hover:bg-pink-500/20 transition-colors relative z-10">
                <ImageIcon className={`w-8 h-8 ${coverFile ? 'text-pink-400' : 'text-white/40'}`} />
              </div>
              <h3 className="text-white font-semibold mb-1 relative z-10">
                {coverFile ? coverFile.name : t('upload.uploadCover')}
              </h3>
              <p className="text-white/40 text-sm relative z-10">
                {coverFile ? t('upload.changeFile') : t('upload.uploadCoverHint')}
              </p>
            </div>

          </div>

          {uploadMode === 'album' && albumFiles.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <h3 className="text-white font-bold mb-4">Tracks ({albumFiles.length})</h3>
              <div className="space-y-3">
                {albumFiles.map((af, i) => (
                  <div key={i} className="flex gap-4 items-center bg-black/40 p-3 rounded-xl border border-white/5">
                    <span className="text-white/50 w-6 text-center">{i+1}</span>
                    <input 
                      type="text" 
                      value={af.title} 
                      onChange={e => {
                        const newFiles = [...albumFiles];
                        newFiles[i].title = e.target.value;
                        setAlbumFiles(newFiles);
                      }}
                      className="flex-1 bg-transparent text-white focus:outline-none"
                    />
                    <button 
                      type="button"
                      onClick={() => setAlbumFiles(albumFiles.filter((_, idx) => idx !== i))}
                      className="text-white/30 hover:text-red-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (uploadMode === 'single' && !audioFile) || (uploadMode === 'album' && albumFiles.length === 0) || !coverFile || !title || !artistName}
            className="w-full relative group overflow-hidden rounded-xl bg-white text-black font-bold py-4 transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 mt-8"
          >
            <span className="relative z-10 flex items-center justify-center gap-2 text-lg">
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('upload.uploadingButton')}
                </>
              ) : (
                <>
                  <UploadCloud className="w-5 h-5" />
                  {t('upload.publishButton')}
                </>
              )}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
