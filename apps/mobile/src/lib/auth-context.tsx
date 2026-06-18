import type { AuthError, Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform } from 'react-native';
import { apiBaseUrl, hasSupabaseConfig } from './env';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

type AuthResult =
  | { ok: true; needsEmailConfirmation?: boolean }
  | { ok: false; message: string };

type AuthContextValue = {
  authReady: boolean;
  deleteAccount: () => Promise<AuthResult>;
  initializing: boolean;
  lastError: string | null;
  session: Session | null;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<AuthResult>;
  signInWithApple: () => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
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

function getOAuthRedirectUri() {
  return makeRedirectUri({
    path: 'auth/callback',
    scheme: 'yoriax',
  });
}

function missingConfigResult(): AuthResult {
  return {
    ok: false,
    message:
      'Supabase ist in der nativen App lokal noch nicht konfiguriert. Lege EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY an.',
  };
}

async function triggerWelcomeEmail(accessToken?: string | null) {
  if (!accessToken) return;

  try {
    const baseUrl = apiBaseUrl.replace(/\/+$/, '');
    await fetch(`${baseUrl}/api/auth/welcome`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    console.error('[AuthProvider] Welcome email failed', error);
  }
}

function isRequestCanceledError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_REQUEST_CANCELED'
  );
}

async function createAppleNonce() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  return { hashedNonce, rawNonce };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(hasSupabaseConfig && Boolean(supabase));
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!hasSupabaseConfig || !supabase) {
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

    const { data, error } = await supabase.auth.signInWithPassword({
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
    await triggerWelcomeEmail(data.session?.access_token);
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
    await triggerWelcomeEmail(data.session?.access_token);
    return { ok: true, needsEmailConfirmation: !data.session };
  }, []);

  const signInWithApple = useCallback(async (): Promise<AuthResult> => {
    if (!hasSupabaseConfig || !supabase) {
      return missingConfigResult();
    }

    if (Platform.OS !== 'ios') {
      return { ok: false, message: 'Apple Login ist nur auf iPhone und iPad verfügbar.' };
    }

    try {
      const { hashedNonce, rawNonce } = await createAppleNonce();
      const credential = await AppleAuthentication.signInAsync({
        nonce: hashedNonce,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        const message = 'Apple hat kein gültiges Login-Token zurückgegeben.';
        setLastError(message);
        return { ok: false, message };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        nonce: rawNonce,
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        const message = normalizeAuthError(error);
        setLastError(message);
        return { ok: false, message };
      }

      const givenName = credential.fullName?.givenName ?? null;
      const middleName = credential.fullName?.middleName ?? null;
      const familyName = credential.fullName?.familyName ?? null;
      const fullName = [givenName, middleName, familyName].filter(Boolean).join(' ');

      if (fullName) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            full_name: fullName,
            given_name: givenName,
            family_name: familyName,
          },
        });

        if (metadataError) {
          console.warn('[AuthProvider] Apple name metadata could not be saved', metadataError);
        }
      }

      setSession(data.session ?? null);
      setLastError(null);
      await triggerWelcomeEmail(data.session?.access_token);
      return { ok: true };
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return { ok: false, message: 'Apple Login wurde abgebrochen.' };
      }

      const message = normalizeAuthError(error);
      setLastError(message);
      return { ok: false, message };
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    if (!hasSupabaseConfig || !supabase) {
      return missingConfigResult();
    }

    const redirectTo = getOAuthRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      const message = normalizeAuthError(error);
      setLastError(message);
      return { ok: false, message };
    }

    if (!data.url) {
      const message = 'Google Login konnte nicht gestartet werden.';
      setLastError(message);
      return { ok: false, message };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type !== 'success') {
      return { ok: false, message: 'Google Login wurde abgebrochen.' };
    }

    try {
      const urlToParse = result.url.includes('?') ? result.url.replace('#', '&') : result.url.replace('#', '?');
      const parsedUrl = Linking.parse(urlToParse);
      const params = parsedUrl.queryParams || {};
      const code = params.code;

      if (code && typeof code === 'string') {
        const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          const message = normalizeAuthError(exchangeError);
          setLastError(message);
          return { ok: false, message };
        }

        setSession(sessionData.session ?? null);
        setLastError(null);
        await triggerWelcomeEmail(sessionData.session?.access_token);
        return { ok: true };
      } else if (params.access_token && params.refresh_token) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: params.access_token as string,
          refresh_token: params.refresh_token as string,
        });
        if (sessionError) {
          const message = normalizeAuthError(sessionError);
          setLastError(message);
          return { ok: false, message };
        }

        setSession(sessionData.session ?? null);
        setLastError(null);
        await triggerWelcomeEmail(sessionData.session?.access_token);
        return { ok: true };
      } else {
        const errorDesc = params.error_description || params.error;
        if (errorDesc) {
          const message = 'Supabase Fehler: ' + errorDesc;
          setLastError(message);
          return { ok: false, message };
        }
        
        const message = 'Keine Login-Daten. URL: ' + result.url.substring(0, 100);
        setLastError(message);
        return { ok: false, message };
      }
    } catch (oauthError) {
      const message = normalizeAuthError(oauthError);
      setLastError(message);
      return { ok: false, message };
    }
  }, []);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (!hasSupabaseConfig || !supabase) {
      return missingConfigResult();
    }

    if (!session?.access_token) {
      return { ok: false, message: 'Bitte melde dich erneut an, bevor du deinen Account löschst.' };
    }

    try {
      const { data, error } = await supabase.functions.invoke<{ deleted?: boolean; error?: string }>(
        'delete-account',
        { method: 'DELETE' },
      );

      if (error || !data?.deleted) {
        const message =
          data?.error ||
          error?.message ||
          'Der Account konnte nicht gelöscht werden. Bitte versuche es erneut.';
        setLastError(message);
        return { ok: false, message };
      }

      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      setSession(null);
      setLastError(null);
      return { ok: true };
    } catch (error) {
      const message = normalizeAuthError(error);
      setLastError(message);
      return { ok: false, message };
    }
  }, [session?.access_token]);

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
      deleteAccount,
      initializing,
      lastError,
      session,
      signIn,
      signInWithApple,
      signInWithGoogle,
      signOut,
      signUp,
      user: session?.user ?? null,
    }),
    [
      deleteAccount,
      initializing,
      lastError,
      session,
      signIn,
      signInWithApple,
      signInWithGoogle,
      signOut,
      signUp,
    ],
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
