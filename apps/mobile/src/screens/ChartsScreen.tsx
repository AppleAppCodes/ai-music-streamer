import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackButton, CoverArt, StateCard } from '../components/YoriaxUI';
import { loadChartsData, type ChartsData } from '../lib/music-data';
import { usePlayer } from '../lib/player-context';
import type { Song } from '../lib/types';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Charts'>;
type ChartTab = 'viral' | 'daily';
type Accent = 'orange' | 'violet';

interface ChartPanelProps {
  accent: Accent;
  activeSongId?: string;
  iconName: keyof typeof Ionicons.glyphMap;
  isPlaying: boolean;
  metricLabel: string;
  onPlayChart: (songs: Song[]) => void;
  onPlaySong: (songs: Song[], index: number) => void;
  songs: Song[];
  subtitle: string;
  title: string;
}

const ACCENTS: Record<Accent, string> = {
  orange: '#f97316',
  violet: theme.colors.primaryLight,
};

function ChartPanel({
  accent,
  activeSongId,
  iconName,
  isPlaying,
  metricLabel,
  onPlayChart,
  onPlaySong,
  songs,
  subtitle,
  title,
}: ChartPanelProps) {
  const accentColor = ACCENTS[accent];
  const isChartPlaying = isPlaying && songs.some((song) => song.id === activeSongId);

  return (
    <View style={[styles.panel, { borderColor: `${accentColor}44` }]}>
      <LinearGradient
        colors={[`${accentColor}2b`, 'rgba(255,255,255,0.035)', 'rgba(255,255,255,0.018)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.panelHeader}>
        <View style={styles.panelCopy}>
          <View style={styles.panelEyebrow}>
            <Ionicons name={iconName} size={15} color={accentColor} />
            <Text style={[styles.eyebrowText, { color: accentColor }]}>Top {songs.length}</Text>
          </View>
          <Text style={styles.panelTitle}>{title}</Text>
          <Text style={styles.panelSubtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={songs.length === 0}
          onPress={() => onPlayChart(songs)}
          style={[styles.playButton, { backgroundColor: songs.length === 0 ? theme.colors.surface : accentColor }]}
        >
          <Ionicons name={isChartPlaying ? 'pause' : 'play'} size={22} color={songs.length === 0 ? theme.colors.muted : '#050505'} />
        </TouchableOpacity>
      </View>

      <View style={styles.panelList}>
        {songs.length === 0 ? (
          <StateCard icon="stats-chart" title="Noch keine Songs" message="Diese Charts füllen sich, sobald neue Plays gezählt werden." />
        ) : (
          songs.map((song, index) => {
            const active = activeSongId === song.id;

            return (
              <TouchableOpacity
                accessibilityRole="button"
                key={song.id}
                onPress={() => onPlaySong(songs, index)}
                style={[
                  styles.row,
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
                  <Text style={styles.rowMeta} numberOfLines={1}>{song.artist_name || song.creatorName || 'Creator'}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.metric}>{metricLabel}</Text>
                  <Ionicons name={active && isPlaying ? 'pause' : 'play'} size={18} color={active ? accentColor : theme.colors.muted} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </View>
  );
}

export function ChartsScreen({ navigation }: Props) {
  const [data, setData] = useState<ChartsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChartTab>('viral');
  const { activeSong, isPlaying, playSong, setQueue, toggle } = usePlayer();

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const fetchedData = await loadChartsData();
        if (mounted) setData(fetchedData);
      } catch {
        if (mounted) setError('Konnte Charts nicht laden.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePlayChart = (chartSongs: Song[]) => {
    if (chartSongs.length === 0) return;
    if (activeSong && chartSongs.some((song) => song.id === activeSong.id) && isPlaying) {
      toggle();
      return;
    }
    setQueue(chartSongs, 0);
    void playSong(chartSongs[0]);
  };

  const handlePlaySong = (chartSongs: Song[], index: number) => {
    setQueue(chartSongs, index);
    void playSong(chartSongs[index]);
  };

  const currentSongs = activeTab === 'viral' ? data?.viralSongs ?? [] : data?.dailySongs ?? [];
  const currentAccent: Accent = activeTab === 'viral' ? 'orange' : 'violet';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(124,58,237,0.24)', 'rgba(249,115,22,0.10)', 'transparent']}
        style={styles.heroGlow}
      />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerText}>
          <Text style={styles.headerEyebrow}>YORIAX</Text>
          <Text style={styles.headerTitle}>Charts</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <ChartTabButton active={activeTab === 'viral'} icon="flame" label="Viral 20" onPress={() => setActiveTab('viral')} tint={ACCENTS.orange} />
        <ChartTabButton active={activeTab === 'daily'} icon="calendar" label="Daily 50" onPress={() => setActiveTab('daily')} tint={ACCENTS.violet} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <StateCard title="Charts werden geladen" message="Wir holen die aktuellen YORIAX-Rankings." loading />
        ) : error ? (
          <StateCard icon="warning" title="Charts nicht verfügbar" message={error} />
        ) : (
          <ChartPanel
            accent={currentAccent}
            activeSongId={activeSong?.id}
            iconName={activeTab === 'viral' ? 'flame' : 'calendar'}
            isPlaying={isPlaying}
            metricLabel={activeTab === 'viral' ? 'Streams' : 'Heute'}
            onPlayChart={handlePlayChart}
            onPlaySong={handlePlaySong}
            songs={currentSongs}
            subtitle={activeTab === 'viral' ? 'Songs mit der stärksten Plattform-Dynamik.' : 'Was heute auf YORIAX am meisten gehört wird.'}
            title={activeTab === 'viral' ? 'Viral Charts' : 'Daily Charts'}
          />
        )}
      </ScrollView>
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
    paddingTop: 18,
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
    fontSize: 14,
    fontWeight: '900',
  },
  content: {
    paddingBottom: 170,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 18,
  },
  panel: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  panelHeader: {
    alignItems: 'flex-start',
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
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
  panelList: {
    gap: 8,
    padding: 12,
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
});
