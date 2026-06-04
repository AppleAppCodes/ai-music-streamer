'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';
import { CheckCircle2 } from 'lucide-react';
import { getErrorMessage } from '@/lib/errors';

function getSafeNextPath(value: string | null) {
  if (!value?.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [turnstileSize, setTurnstileSize] = useState<'compact' | 'flexible'>('compact');
  const [googleLoading, setGoogleLoading] = useState(false);
  const captchaTokenRef = useRef<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const oauthError = searchParams.get('error') === 'google_oauth_failed'
    ? 'Google Login konnte nicht abgeschlossen werden. Bitte versuche es erneut.'
    : null;
  const visibleError = error || oauthError;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 480px)');
    const updateTurnstileSize = () => {
      setTurnstileSize(mediaQuery.matches ? 'flexible' : 'compact');
    };

    updateTurnstileSize();
    mediaQuery.addEventListener('change', updateTurnstileSize);

    return () => mediaQuery.removeEventListener('change', updateTurnstileSize);
  }, []);

  // Keep Cloudflare's managed check usable inside the narrower mobile login card.
  const turnstileOptions = useMemo(() => ({ 
    theme: 'dark' as const,
    size: turnstileSize,
  }), [turnstileSize]);

  const handleCaptchaSuccess = useCallback((token: string) => {
    captchaTokenRef.current = token;
  }, []);

  const handleCaptchaError = useCallback((errorCode?: string) => {
    console.error('Turnstile error:', errorCode);
    captchaTokenRef.current = null;
  }, []);

  const handleCaptchaExpire = useCallback(() => {
    captchaTokenRef.current = null;
  }, []);

  // Helper: get a fresh token, retrying if needed
  const getCaptchaToken = async (): Promise<string | null> => {
    // Try to get response synchronously first
    const directResponse = turnstileRef.current?.getResponse();
    if (directResponse) return directResponse;

    // If we already have a token from callback, use it
    if (captchaTokenRef.current) {
      return captchaTokenRef.current;
    }

    // Wait for token with polling
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const res = turnstileRef.current?.getResponse();
      if (res) return res;
      
      if (captchaTokenRef.current) {
        return captchaTokenRef.current;
      }
    }

    return null;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const token = await getCaptchaToken();

    if (!token) {
      setError('Bitte schließe die Sicherheitsprüfung ab und versuche es erneut.');
      setLoading(false);
      turnstileRef.current?.reset();
      captchaTokenRef.current = null;
      return;
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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            captchaToken: token
          }
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmationEmail(email);
        } else {
          router.push('/');
          router.refresh();
        }
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      // Always reset captcha after attempt (tokens are single-use)
      turnstileRef.current?.reset();
      captchaTokenRef.current = null;
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);

    try {
      const next = getSafeNextPath(searchParams.get('next'));
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });

      if (error) throw error;
    } catch (err) {
      setError(getErrorMessage(err));
      setGoogleLoading(false);
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

          {confirmationEmail ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-teal-300" />
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">E-Mail bestätigen</h1>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Wir haben dir einen Bestätigungslink an <span className="font-bold text-white">{confirmationEmail}</span> gesendet.
              </p>
              <button
                type="button"
                onClick={() => {
                  setConfirmationEmail(null);
                  setIsLogin(true);
                }}
                className="mt-7 text-sm font-semibold text-teal-200 transition-colors hover:text-white"
              >
                Zurück zum Login
              </button>
            </div>
          ) : (
          <>
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

            {visibleError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                {visibleError}
              </div>
            )}

            {/* Cloudflare may request an interactive check depending on the visitor risk. */}
            {siteKey && (
              <div className="flex justify-center">
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

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">oder</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3.5 font-bold text-white transition-all hover:border-white/20 hover:bg-white/[0.1] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black text-black">
              G
            </span>
            {googleLoading ? 'Google wird geöffnet...' : 'Mit Google fortfahren'}
          </button>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                turnstileRef.current?.reset();
                captchaTokenRef.current = null;
              }}
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              {isLogin 
                ? 'Noch keinen Account? Jetzt registrieren' 
                : 'Bereits einen Account? Hier einloggen'}
            </button>
          </div>
          </>
          )}
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
