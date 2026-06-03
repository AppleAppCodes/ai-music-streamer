import type { AuthError, Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { hasSupabaseConfig } from './env';
import { supabase } from './supabase';

type AuthResult =
  | { ok: true; needsEmailConfirmation?: boolean }
  | { ok: false; message: string };

type AuthContextValue = {
  authReady: boolean;
  initializing: boolean;
  lastError: string | null;
  session: Session | null;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  signUp: (email: string, password: string, captchaToken?: string) => Promise<AuthResult>;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeAuthError(error: AuthError | Error | unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('captcha') || lowerMessage.includes('turnstile')) {
      return 'Sicherheitspruefung fehlgeschlagen. Bitte warte kurz, bis die Pruefung abgeschlossen ist, und versuche es erneut.';
    }

    if (lowerMessage.includes('invalid login credentials')) {
      return 'E-Mail oder Passwort ist nicht korrekt.';
    }

    if (lowerMessage.includes('email not confirmed')) {
      return 'Bitte bestaetige zuerst deine E-Mail-Adresse.';
    }

    return message;
  }

  return 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.';
}

function missingConfigResult(): AuthResult {
  return {
    ok: false,
    message:
      'Supabase ist in der nativen App lokal noch nicht konfiguriert. Lege EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY an.',
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!hasSupabaseConfig || !supabase) {
      setInitializing(false);
      return () => {
        mounted = false;
      };
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setLastError(normalizeAuthError(error));
        }
        setSession(data.session ?? null);
      })
      .catch((error: unknown) => {
        if (mounted) {
          setLastError(normalizeAuthError(error));
        }
      })
      .finally(() => {
        if (mounted) {
          setInitializing(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLastError(null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string): Promise<AuthResult> => {
    if (!hasSupabaseConfig || !supabase) {
      return missingConfigResult();
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    if (error) {
      const message = normalizeAuthError(error);
      setLastError(message);
      return { ok: false, message };
    }

    setLastError(null);
    return { ok: true };
  }, []);

  const signUp = useCallback(async (email: string, password: string, captchaToken?: string): Promise<AuthResult> => {
    if (!hasSupabaseConfig || !supabase) {
      return missingConfigResult();
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    if (error) {
      const message = normalizeAuthError(error);
      setLastError(message);
      return { ok: false, message };
    }

    setLastError(null);
    return { ok: true, needsEmailConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async (): Promise<AuthResult> => {
    if (!hasSupabaseConfig || !supabase) {
      return missingConfigResult();
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      const message = normalizeAuthError(error);
      setLastError(message);
      return { ok: false, message };
    }

    setSession(null);
    setLastError(null);
    return { ok: true };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      authReady: hasSupabaseConfig && Boolean(supabase),
      initializing,
      lastError,
      session,
      signIn,
      signOut,
      signUp,
      user: session?.user ?? null,
    }),
    [initializing, lastError, session, signIn, signOut, signUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
