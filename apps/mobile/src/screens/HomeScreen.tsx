import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useMemo, useState, memo, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverArt, IconButton, StateCard } from '../components/YoriaxUI';
import { LiquidGlassSurface } from '../components/LiquidGlass';
import { formatPlays } from '../lib/format';
import { useAuth } from '../lib/auth-context';
import { loadHomeMusic, type HomeMusicData } from '../lib/music-data';
import { readPersistedCache, writePersistedCache } from '../lib/persisted-cache';
import { usePlayerControls } from '../lib/player-context';
import { useMusicPreferences } from '../lib/music-preferences-context';
import type { Song } from '../lib/types';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useI18n } from '../lib/i18n';

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type QuickTile = {
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  subtitle: string;
};

const HOME_CACHE_PREFIX = 'yoriax:home:v1:';

export function HomeScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { favoriteGenres, revision: preferenceRevision } = useMusicPreferences();
  const navigation = useNavigation<HomeNavigation>();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<HomeMusicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) return;

      const cacheKey = `${HOME_CACHE_PREFIX}${user.id}:${favoriteGenres.join(',')}`;
      let hasCachedData = false;
      setLoading(true);
      setError(null);

      const cachedData = await readPersistedCache<HomeMusicData>(cacheKey);
      if (mounted && cachedData) {
        hasCachedData = true;
        setData(cachedData);
        setLoading(false);
      }

      try {
        const nextData = await loadHomeMusic(user.id);
        if (!mounted) return;
        setData(nextData);
        setError(null);
        setLoading(false);
        void writePersistedCache(cacheKey, nextData);
      } catch (loadError) {
        if (mounted && !hasCachedData) {
          setError(loadError instanceof Error ? loadError.message : t('home.error'));
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [favoriteGenres, preferenceRevision, t, user]);

  const refreshHome = useCallback(async () => {
    if (!user || refreshing) return;

    const cacheKey = `${HOME_CACHE_PREFIX}${user.id}:${favoriteGenres.join(',')}`;
    setRefreshing(true);
    setError(null);

    try {
      const nextData = await loadHomeMusic(user.id);
      setData(nextData);
      void writePersistedCache(cacheKey, nextData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('home.refreshError'));
    } finally {
      setRefreshing(false);
    }
  }, [favoriteGenres, refreshing, t, user]);

  const quickTiles = useMemo<QuickTile[]>(() => [
    {
      accent: theme.colors.primaryLight, // Purple
      icon: 'heart',
      label: t('home.favorites'),
      subtitle: t('home.favoritesSubtitle'),
      onPress: () => navigation.navigate('LikedSongs'),
    },
    {
      accent: '#eab308', // Yellow
      icon: 'trending-up',
      label: t('home.charts'),
      subtitle: t('home.chartsSubtitle'),
      onPress: () => navigation.navigate('Charts'),
    },
    {
      accent: '#0d9488', // Teal
      icon: 'mic',
      label: t('home.artists'),
      subtitle: t('home.artistsSubtitle'),
      onPress: () => navigation.navigate('Artists'),
    },
    {
      accent: '#06b6d4', // Cyan
      icon: 'library',
      label: t('home.playlists'),
      subtitle: t('home.playlistsSubtitle'),
      onPress: () => navigation.navigate('PlaylistDiscover'),
    },
  ], [navigation, t]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}
      refreshControl={(
        <RefreshControl
          colors={[theme.colors.primaryLight]}
          onRefresh={() => { void refreshHome(); }}
          progressBackgroundColor={theme.colors.surface}
          progressViewOffset={insets.top + 8}
          refreshing={refreshing}
          tintColor={theme.colors.primaryLight}
        />
      )}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['rgba(88,28,135,0.45)', 'rgba(12,10,18,0)']}
        style={styles.topGradient}
      />
      <View style={styles.header}>
        <IconButton icon="person-circle-outline" onPress={() => navigation.navigate('Profile')} />
      </View>

      <View style={styles.quickGrid}>
        {quickTiles.map((tile) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={tile.label}
            onPress={tile.onPress}
            activeOpacity={0.8}
            style={styles.quickTileShell}
          >
            <LiquidGlassSurface radius={22} style={styles.quickTile} contentStyle={styles.quickTileContent} variant="panel" intensity={24}>
              <LinearGradient
                pointerEvents="none"
                colors={[`${tile.accent}24`, 'rgba(255,255,255,0.03)', `${tile.accent}0D`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.quickIcon, { backgroundColor: `${tile.accent}24` }]}>
                <Ionicons name={tile.icon} size={24} color={tile.accent} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1}>{tile.label}</Text>
            </LiquidGlassSurface>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !data ? <StateCard title={t('home.loading')} message={t('home.loadingCopy')} loading /> : null}
      {error ? <StateCard icon="warning" title={t('home.error')} message={error} /> : null}

      {data ? (
        <View style={styles.sections}>
          <SongRail title={t('home.trending')} songs={data.trendingSongs} />
          <SongRail title={t('home.forYouSelected')} songs={data.recommendedSongs} />
          <SongRail title={t('home.latest')} songs={data.latestSongs} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const SongRailItem = memo(function SongRailItem({
  song,
  index,
  list,
  isActive,
  isPlaying,
  onPlay,
  onToggle
}: {
  song: Song;
  index: number;
  list: Song[];
  isActive: boolean;
  isPlaying: boolean;
  onPlay: (song: Song, list: Song[], index: number) => void;
  onToggle: () => void;
}) {
  const { t } = useI18n();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.96}
      onPress={() => {
        if (isActive) {
          onToggle();
        } else {
          onPlay(song, list, index);
        }
      }}
      style={[styles.songCard, isActive && styles.songCardActive]}
    >
      <CoverArt uri={song.cover_url} size={132} radius={18} />
      <View style={[styles.playBadge, isActive && styles.playBadgeActive]}>
        <Ionicons name={isActive && isPlaying ? 'pause' : 'play'} size={16} color={isActive ? theme.colors.text : theme.colors.background} />
      </View>
      <Text style={[styles.songTitle, isActive && styles.songTitleActive]} numberOfLines={1}>
        {song.title}
      </Text>
      <Text style={styles.songArtist} numberOfLines={1}>
        {song.artist_name || song.creatorName || t('common.creator')}
      </Text>
      <Text style={styles.songMeta}>{formatPlays(song.plays)} {t('common.streams')}</Text>
    </TouchableOpacity>
  );
});

const SongRail = memo(function SongRail({ title, songs }: { title: string; songs: Song[] }) {
  const { activeSong, isPlaying, playSong, setQueue, toggle } = usePlayerControls();

  const handlePlay = useCallback((song: Song, list: Song[], index: number) => {
    setQueue(list, index);
    void playSong(song);
  }, [setQueue, playSong]);

  if (songs.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.songRail}>
        {songs.map((song, index, arr) => {
          const isActive = activeSong?.id === song.id;

          return (
            <SongRailItem
              key={song.id}
              song={song}
              index={index}
              list={arr}
              isActive={isActive}
              isPlaying={isActive ? isPlaying : false}
              onPlay={handlePlay}
              onToggle={toggle}
            />
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  content: {
    gap: theme.spacing.section,
    paddingBottom: 230,
    paddingHorizontal: theme.spacing.screen,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickTileShell: {
    width: '48.5%',
  },
  quickTile: {
    borderRadius: 22,
    minHeight: 72,
    width: '100%',
  },
  quickTileContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  quickIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  quickLabel: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
  },
  sections: {
    gap: 28,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  songRail: {
    gap: 14,
    paddingRight: 20,
  },
  songCard: {
    borderColor: 'transparent',
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    padding: 8,
    width: 150,
  },
  songCardActive: {
    borderColor: 'rgba(168,85,247,0.42)',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  playBadge: {
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: theme.radii.round,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    top: 96,
    width: 36,
  },
  playBadgeActive: {
    backgroundColor: theme.colors.primary,
  },
  songTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 10,
  },
  songTitleActive: {
    color: theme.colors.primaryLight,
  },
  songArtist: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  songMeta: {
    color: theme.colors.subtle,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
});
