import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverArt, IconButton, StateCard, YoriaxLogo } from '../components/YoriaxUI';
import { formatPlays } from '../lib/format';
import { useAuth } from '../lib/auth-context';
import { loadHomeMusic, type HomeMusicData } from '../lib/music-data';
import { usePlayer } from '../lib/player-context';
import type { Song } from '../lib/types';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { theme } from '../theme';

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
  gradientColors: readonly [string, string, string];
};

export function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<HomeNavigation>();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<HomeMusicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const nextData = await loadHomeMusic(user.id);
        if (mounted) setData(nextData);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Home konnte nicht geladen werden.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [user]);

  const quickTiles = useMemo<QuickTile[]>(() => [
    {
      accent: theme.colors.primaryLight, // Purple
      icon: 'heart',
      label: 'Lieblingssongs',
      subtitle: 'Deine gespeicherten Tracks',
      onPress: () => navigation.navigate('LikedSongs'),
      gradientColors: ['rgba(168,85,247,0.25)', 'rgba(168,85,247,0.05)', 'rgba(255,255,255,0.02)'],
    },
    {
      accent: '#eab308', // Yellow
      icon: 'trending-up',
      label: 'Charts',
      subtitle: 'Viral, Daily, Artists',
      onPress: () => navigation.navigate('Charts'),
      gradientColors: ['rgba(234,179,8,0.25)', 'rgba(234,179,8,0.05)', 'rgba(255,255,255,0.02)'],
    },
    {
      accent: '#0d9488', // Teal
      icon: 'mic',
      label: 'Künstler',
      subtitle: 'Neue Creator entdecken',
      onPress: () => navigation.navigate('Artists'),
      gradientColors: ['rgba(13,148,136,0.25)', 'rgba(13,148,136,0.05)', 'rgba(255,255,255,0.02)'],
    },
    {
      accent: '#06b6d4', // Cyan
      icon: 'library',
      label: 'Playlists',
      subtitle: 'Community & kuratiert',
      onPress: () => navigation.navigate('PlaylistDiscover'),
      gradientColors: ['rgba(6,182,212,0.25)', 'rgba(6,182,212,0.05)', 'rgba(255,255,255,0.02)'],
    },
  ], [navigation]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['rgba(88,28,135,0.45)', 'rgba(12,10,18,0)']}
        style={styles.topGradient}
      />
      <View style={styles.header}>
        <YoriaxLogo />
        <IconButton icon="person-circle-outline" onPress={() => navigation.navigate('Profile')} />
      </View>

      <View style={styles.quickGrid}>
        {quickTiles.map((tile) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={tile.label}
            onPress={tile.onPress}
            activeOpacity={0.8}
            style={{ width: '48%' }}
          >
            <LinearGradient
              colors={tile.gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickTile}
            >
              <View style={[styles.quickIcon, { backgroundColor: `${tile.accent}24` }]}>
                <Ionicons name={tile.icon} size={21} color={tile.accent} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1}>{tile.label}</Text>
              <Text style={styles.quickSubtitle} numberOfLines={1}>{tile.subtitle}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <StateCard title="Musik wird geladen" message="Wir holen deine YORIAX-Daten." loading /> : null}
      {error ? <StateCard icon="warning" title="Home konnte nicht geladen werden" message={error} /> : null}

      {data && !loading ? (
        <View style={styles.sections}>
          <SongRail title="Trending heute" songs={data.trendingSongs} />
          <SongRail title="Für dich ausgewählt" songs={data.recommendedSongs} />
          <SongRail title="Neu auf YORIAX" songs={data.latestSongs} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function SongRail({ title, songs }: { title: string; songs: Song[] }) {
  const { activeSong, isPlaying, playSong, setQueue, toggle } = usePlayer();

  if (songs.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.songRail}>
        {songs.map((song, index, arr) => {
          const active = activeSong?.id === song.id;

          return (
            <TouchableOpacity
              accessibilityRole="button"
              key={song.id}
              onPress={() => {
                if (active) {
                  toggle();
                } else {
                  setQueue(arr, index);
                  void playSong(song);
                }
              }}
              style={[styles.songCard, active && styles.songCardActive]}
            >
              <CoverArt uri={song.cover_url} size={132} radius={18} />
              <View style={[styles.playBadge, active && styles.playBadgeActive]}>
                <Ionicons name={active && isPlaying ? 'pause' : 'play'} size={16} color={active ? theme.colors.text : theme.colors.background} />
              </View>
              <Text style={[styles.songTitle, active && styles.songTitleActive]} numberOfLines={1}>
                {song.title}
              </Text>
              <Text style={styles.songArtist} numberOfLines={1}>
                {song.artist_name || song.creatorName || 'Creator'}
              </Text>
              <Text style={styles.songMeta}>{formatPlays(song.plays)} Streams</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  content: {
    gap: theme.spacing.section,
    paddingBottom: 170,
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
    justifyContent: 'space-between',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickTile: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    minHeight: 108,
    padding: 14,
    width: '100%',
  },
  quickIcon: {
    alignItems: 'center',
    borderRadius: theme.radii.md,
    height: 38,
    justifyContent: 'center',
    marginBottom: 12,
    width: 38,
  },
  quickLabel: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  quickSubtitle: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
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
    backgroundColor: theme.colors.primarySoft,
    borderColor: 'rgba(168,85,247,0.38)',
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
