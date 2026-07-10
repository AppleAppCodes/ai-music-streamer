/**
 * "Dein Mix von heute" — the personal daily playlist.
 *
 * The retention idea behind it: a fresh-but-stable mix every day gives users a
 * ritual reason to open the app ("mal schauen, was heute drin ist"). The list
 * is deterministic for user+day (see fetchDailyMixSongs), so it feels curated
 * rather than random and survives re-opens unchanged until midnight.
 */

import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, StateCard, YoriaxMark } from '../components/YoriaxUI';
import { SongListRow } from '../components/SongListRow';
import { useAuth } from '../lib/auth-context';
import { useMusicPreferences } from '../lib/music-preferences-context';
import { fetchDailyMixSongs } from '../lib/radio-stations';
import { usePlayerControls } from '../lib/player-context';
import type { Song } from '../lib/types';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useI18n } from '../lib/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyMix'>;

export function DailyMixScreen({ navigation }: Props) {
  const { locale, t } = useI18n();
  const { user } = useAuth();
  const { favoriteGenres } = useMusicPreferences();
  const insets = useSafeAreaInsets();
  const { activeSong, isPlaying, playSong, setQueue } = usePlayerControls();

  const [songs, setSongs] = useState<Song[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!user) return;
      try {
        const mix = await fetchDailyMixSongs(user.id, favoriteGenres);
        if (mounted) setSongs(mix);
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : t('dailyMix.error'));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [favoriteGenres, t, user]);

  const playFrom = useCallback((song: Song, index: number) => {
    if (!songs) return;
    setQueue(songs, index);
    void playSong(song);
  }, [playSong, setQueue, songs]);

  const playAll = useCallback(() => {
    if (!songs || songs.length === 0) return;
    setQueue(songs, 0);
    void playSong(songs[0]);
  }, [playSong, setQueue, songs]);

  const today = new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long' });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(124,58,237,0.4)', 'rgba(45,212,191,0.08)', 'transparent']}
        style={styles.ambientGlow}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 170 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <IconButton icon="chevron-back" onPress={() => navigation.goBack()} />
        </View>

        <View style={styles.hero}>
          <LinearGradient
            colors={['rgba(124,58,237,0.9)', 'rgba(45,212,191,0.55)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCover}
          >
            <YoriaxMark size={44} />
            <Ionicons name="musical-notes" size={30} color="rgba(255,255,255,0.92)" style={styles.heroNote} />
          </LinearGradient>
          <Text style={styles.eyebrow}>{t('dailyMix.eyebrow')}</Text>
          <Text style={styles.title}>{t('dailyMix.title')}</Text>
          <Text style={styles.subtitle}>{t('dailyMix.subtitle')}</Text>
          {songs ? (
            <Text style={styles.meta}>{t('dailyMix.songCount', { count: songs.length, date: today })}</Text>
          ) : null}

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.88}
            disabled={!songs || songs.length === 0}
            onPress={playAll}
            style={[styles.playButton, (!songs || songs.length === 0) && styles.playButtonDisabled]}
          >
            <Ionicons name="play" size={20} color={theme.colors.background} style={styles.playIcon} />
            <Text style={styles.playButtonText}>{t('dailyMix.playAll')}</Text>
          </TouchableOpacity>
        </View>

        {!songs && !error ? (
          <StateCard title={t('dailyMix.loading')} message={t('dailyMix.loadingCopy')} loading />
        ) : null}
        {error ? <StateCard icon="warning" title={t('dailyMix.error')} message={error} /> : null}
        {songs && songs.length === 0 ? (
          <StateCard icon="musical-notes" title={t('dailyMix.empty')} message={t('dailyMix.emptyCopy')} />
        ) : null}

        {songs ? (
          <View style={styles.list}>
            {songs.map((song, index) => (
              <SongListRow
                active={activeSong?.id === song.id}
                index={index}
                isPlaying={isPlaying}
                key={song.id}
                onPlay={playFrom}
                showPlays={false}
                song={song}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ambientGlow: {
    height: 460,
    position: 'absolute',
    right: -140,
    top: -120,
    width: 460,
  },
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
    marginTop: 22,
  },
  hero: {
    alignItems: 'center',
    marginTop: 6,
  },
  heroCover: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 26,
    borderWidth: 1,
    height: 148,
    justifyContent: 'center',
    width: 148,
  },
  heroNote: {
    bottom: 14,
    position: 'absolute',
    right: 14,
  },
  list: {
    gap: 6,
    marginTop: 26,
  },
  meta: {
    color: theme.colors.subtle,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
  },
  playButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 50,
    paddingHorizontal: 34,
  },
  playButtonDisabled: {
    opacity: 0.4,
  },
  playButtonText: {
    color: theme.colors.background,
    fontSize: 15,
    fontWeight: '900',
  },
  playIcon: {
    marginLeft: -2,
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 460,
    textAlign: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 8,
    textAlign: 'center',
  },
  topBar: {
    alignItems: 'flex-start',
    minHeight: 60,
  },
});
