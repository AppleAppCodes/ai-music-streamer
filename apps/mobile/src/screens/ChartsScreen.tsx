import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState, memo, useCallback, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackButton, CoverArt, StateCard } from '../components/YoriaxUI';
import { formatPlays } from '../lib/format';
import { loadChartsData, type ArtistStat, type ChartsData } from '../lib/music-data';
import { readPersistedCache, writePersistedCache } from '../lib/persisted-cache';
import { usePlayerControls } from '../lib/player-context';
import type { Song } from '../lib/types';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useI18n } from '../lib/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'Charts'>;
type ChartTab = 'viral' | 'daily' | 'artists';
type Accent = 'orange' | 'violet' | 'teal';

type ChartListItem =
  | { kind: 'song'; song: Song; index: number }
  | { kind: 'artist'; artist: ArtistStat; index: number };

const ACCENTS: Record<Accent, string> = {
  orange: '#f97316',
  violet: theme.colors.primaryLight,
  teal: theme.colors.accent,
};

const CHARTS_CACHE_KEY = 'yoriax:charts:v1';
const EMPTY_CHART_ITEMS: ChartListItem[] = [];
const EMPTY_ARTISTS: ArtistStat[] = [];
const EMPTY_SONGS: Song[] = [];

function ChartRowSeparator() {
  return <View style={styles.rowSeparator} />;
}

const ChartPanelItem = memo(function ChartPanelItem({
  song,
  index,
  accentColor,
  active,
  isPlaying,
  metricLabel,
  onPlaySong,
  songs
}: {
  song: Song;
  index: number;
  accentColor: string;
  active: boolean;
  isPlaying: boolean;
  metricLabel: string;
  onPlaySong: (songs: Song[], index: number) => void;
  songs: Song[];
}) {
  const { t } = useI18n();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => onPlaySong(songs, index)}
      style={[
        styles.row,
        styles.chartRow,
        active && {
          backgroundColor: `${accentColor}22`,
          borderColor: `${accentColor}66`,
        },
      ]}
    >
      <Text style={[styles.rank, index < 3 && { color: accentColor }]}>{index + 1}</Text>
      <CoverArt uri={song.cover_url} size={50} radius={12} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, active && { color: accentColor }]} numberOfLines={1}>{song.title}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {song.artist_name || song.creatorName || t('common.creator')}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.metric}>{metricLabel}</Text>
        <Ionicons name={active && isPlaying ? 'pause' : 'play'} size={18} color={active ? accentColor : theme.colors.muted} />
      </View>
    </TouchableOpacity>
  );
});

const ArtistChartItem = memo(function ArtistChartItem({
  artist,
  index,
  onOpenArtist,
}: {
  artist: ArtistStat;
  index: number;
  onOpenArtist: (artistName: string) => void;
}) {
  const { t } = useI18n();
  const accentColor = ACCENTS.teal;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => onOpenArtist(artist.name)}
      style={[styles.row, styles.chartRow]}
    >
      <Text style={[styles.rank, index < 3 && { color: accentColor }]}>{index + 1}</Text>
      <CoverArt uri={artist.coverUrl} size={50} radius={12} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: index < 3 ? accentColor : theme.colors.text }]} numberOfLines={1}>
          {artist.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {artist.songsCount} {t('common.songs')}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.metricValue}>{formatPlays(artist.plays)}</Text>
        <Text style={styles.metric}>{t('common.streams')}</Text>
      </View>
    </TouchableOpacity>
  );
});

function ChartListHeader({
  accent,
  count,
  iconName,
  isChartPlaying,
  onPlay,
  subtitle,
  title,
}: {
  accent: Accent;
  count: number;
  iconName: keyof typeof Ionicons.glyphMap;
  isChartPlaying: boolean;
  onPlay?: () => void;
  subtitle: string;
  title: string;
}) {
  const accentColor = ACCENTS[accent];

  return (
    <View style={styles.panelHeader}>
      <LinearGradient
        colors={[`${accentColor}2b`, 'rgba(255,255,255,0.035)', 'rgba(255,255,255,0.018)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.panelCopy}>
        <View style={styles.panelEyebrow}>
          <Ionicons name={iconName} size={15} color={accentColor} />
          <Text style={[styles.eyebrowText, { color: accentColor }]}>Top {count}</Text>
        </View>
        <Text style={styles.panelTitle}>{title}</Text>
        <Text style={styles.panelSubtitle}>{subtitle}</Text>
      </View>
      {onPlay ? (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={count === 0}
          onPress={onPlay}
          style={[styles.playButton, { backgroundColor: count === 0 ? theme.colors.surface : accentColor }]}
        >
          <Ionicons name={isChartPlaying ? 'pause' : 'play'} size={22} color={count === 0 ? theme.colors.muted : '#050505'} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function ChartsScreen({ navigation }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<ChartsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChartTab>('viral');
  const { activeSong, isPlaying, playSong, setQueue, toggle } = usePlayerControls();

  useEffect(() => {
    let mounted = true;

    async function load() {
      let hasCachedData = false;
      setLoading(true);
      setError(null);

      const cachedData = await readPersistedCache<ChartsData>(CHARTS_CACHE_KEY);
      if (mounted && cachedData) {
        hasCachedData = true;
        setData(cachedData);
        setLoading(false);
      }

      try {
        const fetchedData = await loadChartsData();
        if (!mounted) return;
        setData(fetchedData);
        setError(null);
        setLoading(false);
        void writePersistedCache(CHARTS_CACHE_KEY, fetchedData);
      } catch {
        if (mounted && !hasCachedData) {
          setError(t('charts.unavailable'));
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [t]);

  const handlePlayChart = useCallback((chartSongs: Song[]) => {
    if (chartSongs.length === 0) return;
    if (activeSong && chartSongs.some((song) => song.id === activeSong.id) && isPlaying) {
      toggle();
      return;
    }
    setQueue(chartSongs, 0);
    void playSong(chartSongs[0]);
  }, [activeSong, isPlaying, setQueue, playSong, toggle]);

  const handlePlaySong = useCallback((chartSongs: Song[], index: number) => {
    setQueue(chartSongs, index);
    void playSong(chartSongs[index]);
  }, [setQueue, playSong]);

  const currentSongs = activeTab === 'viral'
    ? data?.viralSongs ?? EMPTY_SONGS
    : activeTab === 'daily'
      ? data?.dailySongs ?? EMPTY_SONGS
      : EMPTY_SONGS;
  const currentAccent: Accent = activeTab === 'viral' ? 'orange' : activeTab === 'daily' ? 'violet' : 'teal';
  const currentArtists = data?.artistCharts ?? EMPTY_ARTISTS;
  const chartItems = useMemo<ChartListItem[]>(
    () => activeTab === 'artists'
      ? currentArtists.map((artist, index) => ({ kind: 'artist', artist, index }))
      : currentSongs.map((song, index) => ({ kind: 'song', song, index })),
    [activeTab, currentArtists, currentSongs],
  );
  const accentColor = ACCENTS[currentAccent];
  const isChartPlaying = isPlaying && currentSongs.some((song) => song.id === activeSong?.id);
  const openArtist = useCallback((artistName: string) => {
    navigation.navigate('Artist', { artistId: artistName });
  }, [navigation]);
  const renderChartItem = useCallback(({ item }: { item: ChartListItem }) => {
    if (item.kind === 'artist') {
      return (
        <ArtistChartItem
          artist={item.artist}
          index={item.index}
          onOpenArtist={openArtist}
        />
      );
    }

    const active = activeSong?.id === item.song.id;
    return (
      <ChartPanelItem
        song={item.song}
        index={item.index}
        accentColor={accentColor}
        active={active}
        isPlaying={isPlaying}
        metricLabel={activeTab === 'viral' ? t('common.streams') : t('charts.today')}
        onPlaySong={handlePlaySong}
        songs={currentSongs}
      />
    );
  }, [accentColor, activeSong?.id, activeTab, currentSongs, handlePlaySong, isPlaying, openArtist, t]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(124,58,237,0.24)', 'rgba(249,115,22,0.10)', 'transparent']}
        style={styles.heroGlow}
      />
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerText}>
          <Text style={styles.headerEyebrow}>YORIAX</Text>
          <Text style={styles.headerTitle}>Charts</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <ChartTabButton active={activeTab === 'viral'} icon="flame" label="Viral 20" onPress={() => setActiveTab('viral')} tint={ACCENTS.orange} />
        <ChartTabButton active={activeTab === 'daily'} icon="calendar" label="Daily 50" onPress={() => setActiveTab('daily')} tint={ACCENTS.violet} />
        <ChartTabButton active={activeTab === 'artists'} icon="mic" label="Artists" onPress={() => setActiveTab('artists')} tint={ACCENTS.teal} />
      </View>

      {loading && !data ? (
        <View style={styles.stateContainer}>
          <StateCard title={t('charts.loading')} message={t('charts.loadingCopy')} loading />
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <StateCard icon="warning" title={t('charts.unavailable')} message={error} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.chartListContent}
          data={chartItems.length > 0 ? chartItems : EMPTY_CHART_ITEMS}
          initialNumToRender={10}
          ItemSeparatorComponent={ChartRowSeparator}
          keyExtractor={(item) => item.kind === 'song' ? `song-${item.song.id}` : `artist-${item.artist.name}`}
          ListEmptyComponent={
            <View style={styles.emptyChart}>
              <StateCard
                icon={activeTab === 'artists' ? 'mic-outline' : 'stats-chart'}
                title={activeTab === 'artists' ? t('charts.emptyArtists') : t('charts.emptySongs')}
                message={activeTab === 'artists'
                  ? t('charts.emptyArtistsCopy')
                  : t('charts.emptySongsCopy')}
              />
            </View>
          }
          ListHeaderComponent={
            <ChartListHeader
              accent={currentAccent}
              count={chartItems.length}
              iconName={activeTab === 'viral' ? 'flame' : activeTab === 'daily' ? 'calendar' : 'mic'}
              isChartPlaying={isChartPlaying}
              onPlay={activeTab === 'artists' ? undefined : () => handlePlayChart(currentSongs)}
              subtitle={activeTab === 'viral'
                ? t('charts.viralSubtitle')
                : activeTab === 'daily'
                  ? t('charts.dailySubtitle')
                  : t('charts.artistSubtitle')}
              title={activeTab === 'viral'
                ? t('charts.viralTitle')
                : activeTab === 'daily'
                  ? t('charts.dailyTitle')
                  : t('charts.artistTitle')}
            />
          }
          maxToRenderPerBatch={8}
          renderItem={renderChartItem}
          showsVerticalScrollIndicator={false}
          style={[styles.chartList, { borderColor: `${accentColor}44` }]}
          updateCellsBatchingPeriod={32}
          windowSize={7}
        />
      )}
    </View>
  );
}

function ChartTabButton({
  active,
  icon,
  label,
  onPress,
  tint,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tint: string;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.tab, active && { backgroundColor: `${tint}22`, borderColor: `${tint}55` }]}
    >
      <Ionicons name={icon} size={16} color={active ? tint : theme.colors.muted} />
      <Text style={[styles.tabText, active && { color: theme.colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  heroGlow: {
    borderRadius: 260,
    height: 300,
    left: -90,
    position: 'absolute',
    right: -60,
    top: -160,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: theme.spacing.screen,
  },
  headerText: {
    flex: 1,
  },
  headerEyebrow: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  tabs: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 20,
  },
  tab: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.round,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  tabText: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '900',
  },
  stateContainer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 18,
  },
  chartList: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    marginHorizontal: theme.spacing.screen,
    marginTop: 18,
    overflow: 'hidden',
  },
  chartListContent: {
    paddingBottom: 170,
  },
  emptyChart: {
    padding: 12,
  },
  panelHeader: {
    alignItems: 'flex-start',
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    overflow: 'hidden',
    padding: 20,
  },
  chartRow: {
    marginHorizontal: 12,
  },
  rowSeparator: {
    height: 8,
  },
  panelCopy: {
    flex: 1,
    paddingRight: 14,
  },
  panelEyebrow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  eyebrowText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  panelTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  panelSubtitle: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 5,
  },
  playButton: {
    alignItems: 'center',
    borderRadius: theme.radii.round,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  row: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderColor: 'transparent',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    padding: 8,
  },
  rank: {
    color: theme.colors.muted,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    width: 25,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  rowMeta: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 5,
  },
  metric: {
    color: theme.colors.subtle,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
});
