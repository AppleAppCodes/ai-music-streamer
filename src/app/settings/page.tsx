'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useTranslation } from 'react-i18next';
import { User, Settings, Image as ImageIcon, Loader2, Save, CreditCard, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  const [user, setUser] = useState<any>(null);
  
  // Form State
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [subscription, setSubscription] = useState('Free');
  
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
      
      setLoading(false);
    }
    
    loadProfile();
  }, [supabase, router]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    const ext = file.name.split('.').pop();
    const path = `avatars/${user.id}-${Date.now()}.${ext}`;

    try {
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
      
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      alert('Fehler beim Hochladen des Profilbilds: ' + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        data: { username }
      });
      
      if (error) throw error;
      alert('Profil erfolgreich aktualisiert!');
      
      // Refresh router to update components like Header
      router.refresh();
      
    } catch (err: any) {
      console.error('Error updating profile:', err);
      alert('Fehler beim Speichern: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] relative pb-32">
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
                value={i18n.language || 'en'}
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
