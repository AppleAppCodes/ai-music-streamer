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
import { useI18n } from './i18n';

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

function normalizeAuthError(error: AuthError | Error | unknown, t: (key: string) => string): string {
  if (error instanceof Error) {
    const message = error.message;
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('captcha') || lowerMessage.includes('turnstile')) {
      return t('auth.captchaFailed');
    }

    if (lowerMessage.includes('invalid login credentials')) {
      return t('auth.invalidCredentials');
    }

    if (lowerMessage.includes('email not confirmed')) {
      return t('auth.emailUnconfirmed');
    }

    return message;
  }

  return t('auth.genericError');
}

function getOAuthRedirectUri() {
  return makeRedirectUri({
    path: 'auth/callback',
    scheme: 'yoriax',
  });
}

function missingConfigResult(t: (key: string) => string): AuthResult {
  return {
    ok: false,
    message: t('auth.missingConfig'),
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
  const { t } = useI18n();
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
          setLastError(normalizeAuthError(error, t));
        }
        setSession(data.session ?? null);
      })
      .catch((error: unknown) => {
        if (mounted) {
          setLastError(normalizeAuthError(error, t));
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
  }, [t]);

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string): Promise<AuthResult> => {
    if (!hasSupabaseConfig || !supabase) {
      return missingConfigResult(t);
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    if (error) {
      const message = normalizeAuthError(error, t);
      setLastError(message);
      return { ok: false, message };
    }

    setLastError(null);
    await triggerWelcomeEmail(data.session?.access_token);
    return { ok: true };
  }, [t]);

  const signUp = useCallback(async (email: string, password: string, captchaToken?: string): Promise<AuthResult> => {
    if (!hasSupabaseConfig || !supabase) {
      return missingConfigResult(t);
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    if (error) {
      const message = normalizeAuthError(error, t);
      setLastError(message);
      return { ok: false, message };
    }

    setLastError(null);
    await triggerWelcomeEmail(data.session?.access_token);
    return { ok: true, needsEmailConfirmation: !data.session };
  }, [t]);

  const signInWithApple = useCallback(async (): Promise<AuthResult> => {
    if (!hasSupabaseConfig || !supabase) {
      return missingConfigResult(t);
    }

    if (Platform.OS !== 'ios') {
      return { ok: false, message: t('auth.appleOnly') };
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
        const message = t('auth.appleTokenMissing');
        setLastError(message);
        return { ok: false, message };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        nonce: rawNonce,
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        const message = normalizeAuthError(error, t);
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
        return { ok: false, message: t('auth.appleCanceled') };
      }

      const message = normalizeAuthError(error, t);
      setLastError(message);
      return { ok: false, message };
    }
  }, [t]);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    if (!hasSupabaseConfig || !supabase) {
      return missingConfigResult(t);
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
      const message = normalizeAuthError(error, t);
      setLastError(message);
      return { ok: false, message };
    }

    if (!data.url) {
      const message = t('auth.googleStartFailed');
      setLastError(message);
      return { ok: false, message };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type !== 'success') {
      return { ok: false, message: t('auth.googleCanceled') };
    }

    try {
      const urlToParse = result.url.includes('?') ? result.url.replace('#', '&') : result.url.replace('#', '?');
      const parsedUrl = Linking.parse(urlToParse);
      const params = parsedUrl.queryParams || {};
      const code = params.code;

      if (code && typeof code === 'string') {
        const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          const message = normalizeAuthError(exchangeError, t);
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
          const message = normalizeAuthError(sessionError, t);
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
        
        const message = t('auth.noLoginData', { url: result.url.substring(0, 100) });
        setLastError(message);
        return { ok: false, message };
      }
    } catch (oauthError) {
      const message = normalizeAuthError(oauthError, t);
      setLastError(message);
      return { ok: false, message };
    }
  }, [t]);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (!hasSupabaseConfig || !supabase) {
      return missingConfigResult(t);
    }

    if (!session?.access_token) {
      return { ok: false, message: t('auth.reauthenticate') };
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
          t('auth.deleteFailed');
        setLastError(message);
        return { ok: false, message };
      }

      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      setSession(null);
      setLastError(null);
      return { ok: true };
    } catch (error) {
      const message = normalizeAuthError(error, t);
      setLastError(message);
      return { ok: false, message };
    }
  }, [session?.access_token, t]);

  const signOut = useCallback(async (): Promise<AuthResult> => {
    if (!hasSupabaseConfig || !supabase) {
      return missingConfigResult(t);
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      const message = normalizeAuthError(error, t);
      setLastError(message);
      return { ok: false, message };
    }

    setSession(null);
    setLastError(null);
    return { ok: true };
  }, [t]);

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
