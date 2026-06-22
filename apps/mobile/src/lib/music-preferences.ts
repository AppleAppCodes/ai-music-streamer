import { supabase } from './supabase';

export interface MusicPreferences {
  favoriteGenres: string[];
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
}

export const EMPTY_MUSIC_PREFERENCES: MusicPreferences = {
  favoriteGenres: [],
  onboardingCompleted: false,
  onboardingSkipped: false,
};

function requireClient() {
  if (!supabase) throw new Error('Supabase Env fehlt.');
  return supabase;
}

export async function loadMusicPreferences(userId: string): Promise<MusicPreferences> {
  const client = requireClient();
  const { data, error } = await client
    .from('user_music_preferences')
    .select('favorite_genres, onboarding_skipped, onboarding_completed_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return EMPTY_MUSIC_PREFERENCES;

  return {
    favoriteGenres: Array.isArray(data.favorite_genres) ? data.favorite_genres : [],
    onboardingCompleted: Boolean(data.onboarding_completed_at),
    onboardingSkipped: Boolean(data.onboarding_skipped),
  };
}

export async function saveMusicPreferences(
  userId: string,
  favoriteGenres: string[],
  onboardingSkipped = false,
): Promise<MusicPreferences> {
  const client = requireClient();
  const uniqueGenres = Array.from(new Set(favoriteGenres)).slice(0, 32);
  const completedAt = new Date().toISOString();
  const { error } = await client
    .from('user_music_preferences')
    .upsert({
      user_id: userId,
      favorite_genres: uniqueGenres,
      onboarding_skipped: onboardingSkipped,
      onboarding_completed_at: completedAt,
      updated_at: completedAt,
    }, { onConflict: 'user_id' });

  if (error) throw new Error(error.message);

  return {
    favoriteGenres: uniqueGenres,
    onboardingCompleted: true,
    onboardingSkipped,
  };
}
