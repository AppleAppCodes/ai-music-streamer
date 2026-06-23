import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth-context';
import {
  EMPTY_MUSIC_PREFERENCES,
  loadMusicPreferences,
  saveMusicPreferences,
  type MusicPreferences,
} from './music-preferences';
import { useI18n } from './i18n';

interface MusicPreferencesContextValue extends MusicPreferences {
  error: string | null;
  loading: boolean;
  revision: number;
  save: (favoriteGenres: string[], onboardingSkipped?: boolean) => Promise<void>;
}

const MusicPreferencesContext = createContext<MusicPreferencesContextValue | undefined>(undefined);

export function MusicPreferencesProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();

  if (!user) {
    return (
      <MusicPreferencesContext.Provider value={{
        ...EMPTY_MUSIC_PREFERENCES,
        error: null,
        loading: false,
        revision: 0,
        save: async () => {
          throw new Error('Du bist nicht angemeldet.');
        },
      }}>
        {children}
      </MusicPreferencesContext.Provider>
    );
  }

  return (
    <AuthenticatedMusicPreferencesProvider key={user.id} userId={user.id}>
      {children}
    </AuthenticatedMusicPreferencesProvider>
  );
}

function AuthenticatedMusicPreferencesProvider({
  children,
  userId,
}: PropsWithChildren<{ userId: string }>) {
  const { t } = useI18n();
  const [preferences, setPreferences] = useState<MusicPreferences>(EMPTY_MUSIC_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let mounted = true;

    void loadMusicPreferences(userId)
      .then((nextPreferences) => {
        if (mounted) setPreferences(nextPreferences);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : t('errors.preferencesLoad'));
        setPreferences({ ...EMPTY_MUSIC_PREFERENCES, onboardingCompleted: true });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [t, userId]);

  const save = useCallback(async (favoriteGenres: string[], onboardingSkipped = false) => {
    const nextPreferences = await saveMusicPreferences(userId, favoriteGenres, onboardingSkipped);
    setPreferences(nextPreferences);
    setError(null);
    setRevision((current) => current + 1);
  }, [userId]);

  const value = useMemo<MusicPreferencesContextValue>(() => ({
    ...preferences,
    error,
    loading,
    revision,
    save,
  }), [error, loading, preferences, revision, save]);

  return (
    <MusicPreferencesContext.Provider value={value}>
      {children}
    </MusicPreferencesContext.Provider>
  );
}

export function useMusicPreferences() {
  const context = useContext(MusicPreferencesContext);
  if (!context) {
    throw new Error('useMusicPreferences must be used inside MusicPreferencesProvider');
  }
  return context;
}
