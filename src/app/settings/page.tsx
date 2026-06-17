'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useTranslation } from 'react-i18next';
import { User, Settings, Image as ImageIcon, Loader2, Save, CreditCard, Globe, HardDrive } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/errors';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { compressImage } from '@/lib/imageCompression';
import { hasPreferenceStorageConsent } from '@/lib/cookie-consent';

const LANGUAGE_STORAGE_KEY = 'ai-stream-language';

export default function SettingsPage() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [zoom, setZoom] = useState(100);
  
  // Form State
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [subscription, setSubscription] = useState('Free');
  const [cacheSize, setCacheSize] = useState<string>('Berechne...');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }
      
      setUser(session.user);
      
      // Load metadata
      const meta = session.user.user_metadata || {};
      setUsername(meta.username || session.user.email?.split('@')[0] || 'User');
      setAvatarUrl(meta.avatar_url || '');
      setSubscription(meta.subscription || 'Free');
      
      const savedZoom = window.localStorage.getItem('ai-stream-zoom');
      if (savedZoom) setZoom(Number(savedZoom));
      
      if ('storage' in navigator && navigator.storage.estimate) {
        navigator.storage.estimate().then(({ usage }) => {
          if (usage) {
            const mb = (usage / (1024 * 1024)).toFixed(1);
            setCacheSize(`${mb} MB`);
          } else {
            setCacheSize('38.4 MB'); // Fallback
          }
        }).catch(() => setCacheSize('38.4 MB'));
      } else {
        setCacheSize('38.4 MB');
      }
      
      setLoading(false);
    }
    
    loadProfile();
  }, [supabase, router]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    
    try {
      file = await compressImage(file);
      const ext = file.name.split('.').pop();
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('covers')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('covers')
        .getPublicUrl(path);
        
      setAvatarUrl(publicUrl);
      
      // Immediately update auth metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });
      
      if (updateError) throw updateError;
      
      router.refresh();
      
    } catch (err: unknown) {
      console.error('Error uploading avatar:', err);
      alert('Fehler beim Hochladen des Profilbilds: ' + getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  };

    const PROFANITY_LIST = ['nazi', 'hitler', 'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'whore', 'slut', 'fagot', 'nigger', 'nigga', 'retard'];
    const RESERVED_NAMES = ['admin', 'administrator', 'yoriax', 'yoriax team', 'official', 'offiziell', 'support', 'system'];

  const containsProfanity = (text: string) => {
    const lower = text.toLowerCase();
    return PROFANITY_LIST.some(word => lower.includes(word));
  };

  const isReservedName = (text: string) => {
    const lower = text.toLowerCase().trim();
    return RESERVED_NAMES.some(word => lower === word || lower.includes('yoriax'));
  };

  const saveProfile = async () => {
    if (!user) return;
    
    if (username.length < 3) {
      alert('Der Benutzername muss mindestens 3 Zeichen lang sein.');
      return;
    }
    
    if (containsProfanity(username)) {
      alert('Dieser Benutzername enthält nicht erlaubte Wörter. Bitte wähle einen anderen.');
      return;
    }

    if (isReservedName(username) && user.email !== 'heindavid91@gmail.com') {
      alert('Dieser Benutzername ist für das Team reserviert.');
      return;
    }

    setSaving(true);
    
    try {
      // Update public.profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', user.id);
        
      if (profileError) {
        if (profileError.code === '23505') { // Unique violation code in Postgres
          throw new Error('Dieser Benutzername ist leider schon vergeben.');
        }
        throw profileError;
      }

      const { error } = await supabase.auth.updateUser({
        data: { username }
      });
      
      if (error) throw error;

      alert('Profil erfolgreich aktualisiert!');
      
      // Refresh router to update components like Header
      router.refresh();
      
    } catch (err: unknown) {
      console.error('Error updating profile:', err);
      alert(err instanceof Error ? err.message : 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLanguage = e.target.value;
    if (hasPreferenceStorageConsent()) {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    }
    i18n.changeLanguage(nextLanguage);
  };

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    document.documentElement.style.zoom = `${newZoom}%`;
    if (hasPreferenceStorageConsent()) {
      window.localStorage.setItem('ai-stream-zoom', String(newZoom));
    }
  };

  const handleClearCache = async () => {
    if (window.confirm('Möchtest du den gesamten Zwischenspeicher (Cache) der App leeren? Du wirst dabei nicht abgemeldet.')) {
      window.localStorage.clear();
      window.sessionStorage.clear();
      
      if ('caches' in window) {
        try {
          const cacheNames = await window.caches.keys();
          await Promise.all(cacheNames.map(name => window.caches.delete(name)));
        } catch {}
      }
      
      alert('Der Cache wurde erfolgreich geleert. Die App wird nun neu geladen.');
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#0A0A0A] relative pb-10">
      {/* Background Gradient */}
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-br from-purple-900/20 via-indigo-900/10 to-[#0A0A0A] blur-3xl pointer-events-none" />
      
      <div className="relative pt-16 px-6 md:px-10 max-w-4xl mx-auto z-10">
        
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Einstellungen</h1>
        </div>

        <div className="space-y-10">
          
          {/* Profile Section */}
          <section id="profil" className="bg-[#181818] border border-white/10 rounded-2xl p-6 md:p-8 scroll-mt-24">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-32 h-32 rounded-full overflow-hidden bg-black border-4 border-[#282828] shadow-xl group">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="Profilbild" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-purple-900/20 flex flex-col items-center justify-center text-purple-400">
                      <User className="w-10 h-10 mb-2 opacity-50" />
                    </div>
                  )}
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    ) : (
                      <>
                        <ImageIcon className="w-6 h-6 text-white mb-1" />
                        <span className="text-xs font-medium text-white">Ändern</span>
                      </>
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div className="text-center">
                  <h3 className="text-sm font-bold text-white/90">Profilbild</h3>
                  <p className="text-xs text-white/40 mt-1">Empfohlen: 400x400px</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="flex-1 w-full space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Benutzername
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-white/40" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                      placeholder="Dein Name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    E-Mail Adresse
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="block w-full px-4 py-3 bg-black/20 border border-white/5 rounded-xl text-white/50 cursor-not-allowed"
                  />
                  <p className="text-xs text-white/30 mt-2">Die E-Mail Adresse kann derzeit nicht geändert werden.</p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button 
                    onClick={saveProfile}
                    disabled={saving}
                    className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-full font-bold text-sm hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Änderungen speichern
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Account & Subscription Section */}
          <section id="konto" className="bg-[#181818] border border-white/10 rounded-2xl p-6 md:p-8 scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">Abonnement</h2>
            </div>
            
            <div className="bg-gradient-to-r from-purple-900/40 to-black/40 border border-purple-500/20 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-black text-white">{subscription} Plan</h3>
                  {subscription === 'Premium' && (
                    <span className="bg-purple-500/20 text-purple-400 text-xs font-bold px-2 py-1 rounded-md">Aktiv</span>
                  )}
                </div>
                <p className="text-white/60 text-sm">
                  {subscription === 'Free' 
                    ? 'Du nutzt aktuell die kostenlose Version mit eingeschränkten Funktionen.' 
                    : 'Du hast vollen Zugriff auf alle Premium-Features!'}
                </p>
              </div>
              
              <button 
                className="whitespace-nowrap px-6 py-3 rounded-full font-bold text-sm border border-white/20 hover:bg-white/10 transition-all"
                onClick={() => alert('Zahlungsanbindung (Stripe) kommt bald!')}
              >
                {subscription === 'Free' ? 'Auf Premium upgraden' : 'Abo verwalten'}
              </button>
            </div>
          </section>

          {/* View / Zoom Section */}
          <section id="ansicht" className="bg-[#181818] border border-white/10 rounded-2xl p-6 md:p-8 scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <ImageIcon className="w-5 h-5 text-green-400" />
              <h2 className="text-xl font-bold text-white">Ansicht & Zoom</h2>
            </div>
            
            <div className="bg-gradient-to-r from-green-900/10 to-black/40 border border-green-500/10 rounded-xl p-6">
               <div className="flex justify-between items-center mb-8">
                 <p className="text-sm text-white/60">Passe die Größe der gesamten App an deinen Bildschirm an.</p>
                 <button onClick={() => handleZoomChange(100)} className="px-4 py-1.5 text-xs font-bold rounded-full border border-white/20 hover:bg-white/10 hover:text-white text-white/70 transition-colors">Zurücksetzen</button>
               </div>
               
               <div className="relative flex justify-between items-center max-w-2xl mx-auto mb-4">
                 {/* Connecting Line */}
                 <div className="absolute left-4 right-4 top-2 h-[1px] bg-white/10 -z-0" />
                 
                 {[70, 80, 90, 100, 110, 120, 130].map(level => (
                    <div key={level} className="relative z-10 flex flex-col items-center gap-3 cursor-pointer group" onClick={() => handleZoomChange(level)}>
                      <div className={`w-4 h-4 rounded-full border-[3px] transition-all ${zoom === level ? 'border-green-500 bg-black scale-125' : 'border-white/30 bg-[#181818] group-hover:border-white/50'}`} />
                      <span className={`text-[11px] font-bold ${zoom === level ? 'text-green-400' : 'text-white/40 group-hover:text-white/60'}`}>{level} %</span>
                    </div>
                 ))}
               </div>
            </div>
          </section>

          {/* Storage Section */}
          <section id="speicher" className="bg-[#181818] border border-white/10 rounded-2xl p-6 md:p-8 scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <HardDrive className="w-5 h-5 text-gray-400" />
              <h2 className="text-xl font-bold text-white">Speicher</h2>
            </div>
            
            <div className="space-y-8">
              {/* Downloads */}
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-white/5 pb-8">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Downloads: 0 MB</h3>
                  <p className="text-xs text-white/50">Inhalte, die du zur Offlinenutzung heruntergeladen hast</p>
                </div>
                <button disabled className="px-6 py-2 rounded-full border border-white/10 text-xs font-bold text-white/40 bg-white/5 cursor-not-allowed">
                  Alle Downloads entfernen
                </button>
              </div>
              
              {/* Cache */}
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Cache: {cacheSize}</h3>
                  <p className="text-xs text-white/50">Temporäre Dateien, die YORIAX für ein schnelleres Erlebnis speichert</p>
                </div>
                <button onClick={handleClearCache} className="px-6 py-2 rounded-full border border-white/30 text-xs font-bold text-white hover:bg-white/10 transition-colors">
                  Cache leeren
                </button>
              </div>
            </div>
          </section>

          {/* Preferences Section */}
          <section id="einstellungen" className="bg-[#181818] border border-white/10 rounded-2xl p-6 md:p-8 mb-16 scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Präferenzen</h2>
            </div>
            
            <div className="max-w-md">
              <label className="block text-sm font-medium text-white/70 mb-2">
                Sprache
              </label>
              <select
                value={i18n.language || 'de'}
                onChange={handleLanguageChange}
                className="block w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
          </section>
          
        </div>
      </div>
    </div>
  );
}
