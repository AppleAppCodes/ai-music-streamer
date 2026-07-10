import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YoriaxMark } from '../components/YoriaxUI';
import { StationBuildingOverlay, stationBuildDurationMs } from '../components/StationBuildingOverlay';
import { MUSIC_GENRES, getGenreId, type MusicGenre } from '../lib/genre-catalog';
import { supabase } from '../lib/supabase';
import { fetchOnboardingStarterQueue } from '../lib/radio-stations';
import { armFirstSessionFunnel, recordFunnelEvent } from '../lib/funnel';
import { usePlayerControls } from '../lib/player-context';
import type { Song } from '../lib/types';
import { useMusicPreferences } from '../lib/music-preferences-context';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useI18n } from '../lib/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'MusicPreferences'>;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function MusicPreferencesOnboarding() {
  const { favoriteGenres, save } = useMusicPreferences();
  const { playSong, setQueue } = usePlayerControls();
  const [staging, setStaging] = useState<{ genres: MusicGenre[]; queueCount: number | null } | null>(null);

  return (
    <>
      <MusicPreferencesPicker
        allowSkip
        initialGenres={favoriteGenres}
        onSave={async (genres, skipped) => {
          // The starter queue loads while the build choreography plays — the
          // overlay is theatre, the fetch underneath is real.
          const queuePromise = fetchOnboardingStarterQueue(genres).catch(() => [] as Song[]);

          if (!skipped) {
            const chosen = genres
              .map((id) => MUSIC_GENRES.find((genre) => genre.id === id))
              .filter((genre): genre is MusicGenre => Boolean(genre));
            setStaging({ genres: chosen, queueCount: null });
            void queuePromise.then((songs) => {
              setStaging((current) => (current ? { ...current, queueCount: songs.length } : current));
            });
            // save() flips the app to the main UI and unmounts this screen, so
            // the choreography has to finish before it runs.
            await sleep(stationBuildDurationMs(chosen.length));
          }

          try {
            await save(genres, skipped);
          } catch (error) {
            setStaging(null); // let the picker surface its save error
            throw error;
          }
          recordFunnelEvent('onboarding_completed', { genres: genres.length, skipped });

          // First impression: a new user hears their station immediately
          // instead of landing on a silent home screen — but never block
          // finishing onboarding on the music itself.
          const songs = await Promise.race([queuePromise, sleep(2500).then(() => [] as Song[])]);
          if (songs.length > 0) {
            setQueue(songs, 0);
            armFirstSessionFunnel(songs[0].id);
            void playSong(songs[0], { fadeInMs: 1400 });
          }
        }}
      />
      {staging ? <StationBuildingOverlay genres={staging.genres} queueCount={staging.queueCount} /> : null}
    </>
  );
}

export function MusicPreferencesScreen({ navigation }: Props) {
  const { favoriteGenres, save } = useMusicPreferences();
  return (
    <MusicPreferencesPicker
      initialGenres={favoriteGenres}
      onClose={() => navigation.goBack()}
      onSave={async (genres) => {
        await save(genres, false);
        navigation.goBack();
      }}
    />
  );
}

function MusicPreferencesPicker({
  allowSkip = false,
  initialGenres,
  onClose,
  onSave,
}: {
  allowSkip?: boolean;
  initialGenres: string[];
  onClose?: () => void;
  onSave: (genres: string[], skipped: boolean) => Promise<void>;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [selectedGenres, setSelectedGenres] = useState(() => new Set(initialGenres));
  const [saving, setSaving] = useState(false);

  // Only offer genres that actually have approved songs, so nobody picks a
  // dead-end genre. Fail-safe: on error/empty, show the full catalogue (null).
  const [activeGenreIds, setActiveGenreIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.rpc('get_active_genres');
        if (error || !Array.isArray(data) || data.length === 0) return;
        const ids = new Set((data as string[]).map((g) => getGenreId(g)));
        if (mounted) setActiveGenreIds(ids);
      } catch {
        // keep null → show all
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Keep any already-selected genre visible even if it is currently empty,
  // so a returning user can still deselect it.
  const visibleGenres = useMemo(() => {
    if (!activeGenreIds) return MUSIC_GENRES;
    const keep = new Set([...activeGenreIds, ...initialGenres]);
    return MUSIC_GENRES.filter((genre) => keep.has(genre.id));
  }, [activeGenreIds, initialGenres]);
  const selectedCount = selectedGenres.size;
  const buttonLabel = allowSkip ? t('onboarding.save') : t('onboarding.update');

  const selectionCopy = useMemo(() => {
    if (selectedCount === 0) return t('onboarding.minimum');
    if (selectedCount < 3) return t('onboarding.selectedHint', { count: selectedCount });
    return t('onboarding.selected', { count: selectedCount });
  }, [selectedCount, t]);

  const toggleGenre = (genreId: string) => {
    setSelectedGenres((current) => {
      const next = new Set(current);
      if (next.has(genreId)) next.delete(genreId);
      else next.add(genreId);
      return next;
    });
  };

  const persist = async (skipped: boolean) => {
    if (saving || (!skipped && selectedCount === 0)) return;
    setSaving(true);
    try {
      await onSave(skipped ? [] : Array.from(selectedGenres), skipped);
    } catch (error) {
      Alert.alert(
        t('onboarding.saveError'),
        error instanceof Error ? error.message : t('onboarding.tryAgain'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(124,58,237,0.38)', 'rgba(45,212,191,0.10)', 'transparent']}
        style={styles.ambientGlow}
      />
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        {onClose ? (
          <TouchableOpacity
            accessibilityLabel={t('onboarding.close')}
            accessibilityRole="button"
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.brandMark}>
            <YoriaxMark size={34} />
          </View>
        )}
        {allowSkip ? (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={saving}
            onPress={() => void persist(true)}
            style={styles.skipButton}
          >
            <Text style={styles.skipButtonText}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 150 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>
          {allowSkip ? t('onboarding.eyebrowStart') : t('onboarding.eyebrow')}
        </Text>
        <Text style={styles.title}>{t('onboarding.title')}</Text>
        <Text style={styles.description}>{t('onboarding.description')}</Text>

        <View style={styles.selectionStatus}>
          <Ionicons
            name={selectedCount >= 3 ? 'checkmark-circle' : 'sparkles-outline'}
            size={18}
            color={selectedCount >= 3 ? theme.colors.accent : theme.colors.primaryLight}
          />
          <Text style={styles.selectionStatusText}>{selectionCopy}</Text>
        </View>

        <View style={styles.genreGrid}>
          {visibleGenres.map((genre) => {
            const selected = selectedGenres.has(genre.id);
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected }}
                activeOpacity={0.82}
                key={genre.id}
                onPress={() => toggleGenre(genre.id)}
                style={[
                  styles.genreChip,
                  { borderColor: selected ? genre.color : `${genre.color}50` },
                  selected && { backgroundColor: `${genre.color}22` },
                ]}
              >
                <View style={[styles.genreIcon, { backgroundColor: `${genre.color}24` }]}>
                  <Ionicons name={genre.icon} size={20} color={genre.color} />
                </View>
                <Text style={[styles.genreLabel, selected && styles.genreLabelSelected]}>
                  {genre.label}
                </Text>
                <View style={[styles.selectionCircle, selected && { backgroundColor: genre.color, borderColor: genre.color }]}>
                  {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.88}
          disabled={saving || selectedCount === 0}
          onPress={() => void persist(false)}
          style={[styles.saveButton, (saving || selectedCount === 0) && styles.saveButtonDisabled]}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.background} />
          ) : (
            <>
              <Text style={styles.saveButtonText}>{buttonLabel}</Text>
              <Ionicons name="arrow-forward" size={20} color={theme.colors.background} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ambientGlow: {
    height: 420,
    position: 'absolute',
    right: -130,
    top: -120,
    width: 420,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: theme.colors.border,
    borderRadius: 15,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: theme.colors.border,
    borderRadius: 23,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  description: {
    color: theme.colors.muted,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 23,
    marginTop: 14,
    maxWidth: 620,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  footer: {
    backgroundColor: 'rgba(5,5,5,0.96)',
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    position: 'absolute',
    right: 0,
  },
  genreChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 62,
    paddingHorizontal: 11,
    width: '48.4%',
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 22,
  },
  genreIcon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  genreLabel: {
    color: theme.colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  genreLabelSelected: {
    color: theme.colors.text,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 54,
  },
  saveButtonDisabled: {
    opacity: 0.36,
  },
  saveButtonText: {
    color: theme.colors.background,
    fontSize: 15,
    fontWeight: '900',
  },
  selectionCircle: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  selectionStatus: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectionStatusText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  skipButton: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  skipButtonText: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 41,
    marginTop: 10,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 70,
    paddingHorizontal: 20,
  },
});
