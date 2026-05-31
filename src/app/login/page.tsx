'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaStatus, setCaptchaStatus] = useState<'loading' | 'ready' | 'error' | 'expired'>('loading');
  const turnstileRef = useRef<TurnstileInstance>(null);
  
  const router = useRouter();
  const supabase = createClient();

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

  // Stable options object to prevent re-renders
  const turnstileOptions = useMemo(() => ({ theme: 'dark' as const }), []);

  const handleCaptchaSuccess = useCallback((token: string) => {
    console.log('Turnstile token received:', token.substring(0, 20) + '...');
    setCaptchaToken(token);
    setCaptchaStatus('ready');
  }, []);

  const handleCaptchaError = useCallback(() => {
    console.error('Turnstile error');
    setCaptchaStatus('error');
    setCaptchaToken(null);
  }, []);

  const handleCaptchaExpire = useCallback(() => {
    console.log('Turnstile token expired');
    setCaptchaStatus('expired');
    setCaptchaToken(null);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // If no captcha token yet, wait a moment and try once more
    let token = captchaToken;
    if (!token) {
      // Give Turnstile a brief moment to finish
      await new Promise(resolve => setTimeout(resolve, 1500));
      // Re-check after wait (the state might not have updated, so we read from ref)
      // If still no token, proceed without it and let Supabase return the proper error
      if (!captchaToken) {
        setError('Die Sicherheitsprüfung lädt noch. Bitte warte einen Moment und versuche es dann erneut.');
        setLoading(false);
        // Try to reset and get a fresh token
        turnstileRef.current?.reset();
        return;
      }
      token = captchaToken;
    }

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: {
            captchaToken: token
          }
        });
        if (error) throw error;
        router.push('/');
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            captchaToken: token
          }
        });
        if (error) throw error;
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      // Always reset captcha after attempt (tokens are single-use)
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      setCaptchaStatus('loading');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-black">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/stardust.png")' }} />

      <div className="relative w-full max-w-md p-8 sm:p-10 z-10">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          
          {/* Subtle shine effect on the card edge */}
          <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10 pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              {isLogin ? 'Willkommen zurück' : 'Account erstellen'}
            </h1>
            <p className="text-white/60 text-sm">
              {isLogin 
                ? 'Melde dich an, um Musik in höchster Qualität zu hören.' 
                : 'Tritt der Revolution der AI-Musik bei.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="hello@example.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {/* Turnstile widget - rendered but can be hidden for invisible mode */}
            {siteKey && (
              <div className="flex justify-center my-4">
                <Turnstile 
                  ref={turnstileRef}
                  siteKey={siteKey}
                  onSuccess={handleCaptchaSuccess}
                  onError={handleCaptchaError}
                  onExpire={handleCaptchaExpire}
                  options={turnstileOptions}
                />
              </div>
            )}

            {/* Status indicator */}
            {captchaStatus === 'error' && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    turnstileRef.current?.reset();
                    setCaptchaStatus('loading');
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                >
                  Sicherheitsprüfung neu laden
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full relative group overflow-hidden rounded-xl bg-white text-black font-bold py-3.5 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  isLogin ? 'Einloggen' : 'Registrieren'
                )}
              </span>
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                // Reset captcha when switching modes
                turnstileRef.current?.reset();
                setCaptchaToken(null);
                setCaptchaStatus('loading');
              }}
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              {isLogin 
                ? 'Noch keinen Account? Jetzt registrieren' 
                : 'Bereits einen Account? Hier einloggen'}
            </button>
          </div>
        </div>

        {/* Back to Home Link */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-sm font-medium text-white/40 hover:text-white transition-colors">
            ← Zurück zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
