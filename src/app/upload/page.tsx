'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { UploadCloud, Music, Image as ImageIcon, Loader2, CheckCircle2 } from 'lucide-react';

const GENRES = ['Pop', 'Hip Hop', 'Electronic', 'R&B', 'Rock', 'Ambient', 'Other'];
const MOODS = ['Happy', 'Sad', 'Energetic', 'Chill', 'Dark', 'Romantic'];

export default function UploadPage() {
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState(GENRES[0]);
  const [mood, setMood] = useState(MOODS[0]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [aiTool, setAiTool] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [user, setUser] = useState<any>(null);
  
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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile || !coverFile || !title) {
      setError('Bitte fülle alle Pflichtfelder aus (Titel, Song, Cover).');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // 1. Upload Cover Image
      const coverExt = coverFile.name.split('.').pop();
      const coverPath = `${user.id}/${Date.now()}_cover.${coverExt}`;
      const { error: coverError, data: coverData } = await supabase.storage
        .from('covers')
        .upload(coverPath, coverFile);
        
      if (coverError) throw new Error('Cover-Upload fehlgeschlagen: ' + coverError.message);
      
      const { data: { publicUrl: coverUrl } } = supabase.storage
        .from('covers')
        .getPublicUrl(coverPath);

      // 2. Upload Audio File
      const audioExt = audioFile.name.split('.').pop();
      const audioPath = `${user.id}/${Date.now()}_song.${audioExt}`;
      const { error: audioError } = await supabase.storage
        .from('songs')
        .upload(audioPath, audioFile);
        
      if (audioError) throw new Error('Song-Upload fehlgeschlagen: ' + audioError.message);
      
      const { data: { publicUrl: audioUrl } } = supabase.storage
        .from('songs')
        .getPublicUrl(audioPath);

      // 3. Save to Database
      const { error: dbError } = await supabase
        .from('songs')
        .insert({
          creator_id: user.id,
          title,
          genre,
          mood,
          cover_url: coverUrl,
          audio_url: audioUrl,
          ai_tool: aiTool || null,
          plays: 0
        });

      if (dbError) throw new Error('Datenbank-Fehler: ' + dbError.message);

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 2000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null; // Wait for auth redirect

  if (success) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-full">
        <CheckCircle2 className="w-24 h-24 text-green-500 mb-6 animate-pulse" />
        <h1 className="text-3xl font-bold text-white mb-2">Upload erfolgreich!</h1>
        <p className="text-white/60">Dein Song ist jetzt live. Du wirst weitergeleitet...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-32">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Song hochladen</h1>
          <p className="text-white/50">Teile deine neuesten AI-Kreationen mit der Welt.</p>
        </div>

        <form onSubmit={handleUpload} className="space-y-8">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              {error}
            </div>
          )}

          {/* Form Fields Container */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6 backdrop-blur-md">
            
            <div>
              <label className="block text-sm font-semibold text-white/80 mb-2">Song Titel *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="Name deines Meisterwerks"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-2">Genre *</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none"
                >
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-2">Mood *</label>
                <select
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none"
                >
                  {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/80 mb-2">Erstellt mit (Optional)</label>
              <input
                type="text"
                value={aiTool}
                onChange={(e) => setAiTool(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="z.B. Suno, Udio"
              />
            </div>
          </div>

          {/* File Uploads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Audio Upload */}
            <div 
              onClick={() => audioInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 hover:border-indigo-500/50 bg-white/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group"
            >
              <input 
                type="file" 
                accept="audio/*" 
                className="hidden" 
                ref={audioInputRef}
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              />
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
                <Music className={`w-8 h-8 ${audioFile ? 'text-indigo-400' : 'text-white/40'}`} />
              </div>
              <h3 className="text-white font-semibold mb-1">
                {audioFile ? audioFile.name : 'MP3 / M4A hochladen'}
              </h3>
              <p className="text-white/40 text-sm">
                {audioFile ? 'Klicke zum Ändern' : 'Max 50MB'}
              </p>
            </div>

            {/* Cover Upload */}
            <div 
              onClick={() => coverInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 hover:border-pink-500/50 bg-white/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group relative overflow-hidden"
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
                {coverFile ? coverFile.name : 'Cover Artwork'}
              </h3>
              <p className="text-white/40 text-sm relative z-10">
                {coverFile ? 'Klicke zum Ändern' : 'JPG, PNG (1:1)'}
              </p>
            </div>

          </div>

          <button
            type="submit"
            disabled={loading || !audioFile || !coverFile || !title}
            className="w-full relative group overflow-hidden rounded-xl bg-white text-black font-bold py-4 transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 mt-8"
          >
            <span className="relative z-10 flex items-center justify-center gap-2 text-lg">
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Wird hochgeladen...
                </>
              ) : (
                <>
                  <UploadCloud className="w-5 h-5" />
                  Song veröffentlichen
                </>
              )}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
