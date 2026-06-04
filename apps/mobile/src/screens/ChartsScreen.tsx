import { ActivityIndicator, Image, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { loadChartsData, type ChartsData } from '../lib/music-data';
import { usePlayer } from '../lib/player-context';
import type { Song } from '../lib/types';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { formatPlays } from '../lib/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Charts'>;

export function ChartsScreen({ navigation }: Props) {
  const [data, setData] = useState<ChartsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'viral' | 'daily'>('viral');
  const { activeSong, isPlaying, playSong, setQueue } = usePlayer();

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const fetchedData = await loadChartsData();
        if (mounted) {
          setData(fetchedData);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError('Konnte Charts nicht laden.');
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const currentSongs = activeTab === 'viral' ? data?.viralSongs || [] : data?.dailySongs || [];

  const handlePlayAll = () => {
    if (currentSongs.length === 0) return;
    setQueue(currentSongs, 0);
    void playSong(currentSongs[0]);
  };

  const handlePlaySong = (song: Song, index: number) => {
    setQueue(currentSongs, index);
    void playSong(song);
  };

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=2000&auto=format&fit=crop' }} 
        style={styles.heroBackground}
        imageStyle={{ opacity: 0.5 }}
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)', '#000']}
          locations={[0, 0.6, 1]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Charts</Text>
          <Text style={styles.heroMeta}>Die beliebtesten Songs auf YORIAX</Text>
        </View>
      </ImageBackground>

      <ScrollView contentContainerStyle={styles.content} stickyHeaderIndices={[0]}>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'viral' && styles.tabActive]} 
            onPress={() => setActiveTab('viral')}
          >
            <Ionicons name="flame" size={16} color={activeTab === 'viral' ? '#f97316' : theme.colors.muted} />
            <Text style={[styles.tabText, activeTab === 'viral' && styles.tabTextActive]}>Viral 20</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'daily' && styles.tabActive]} 
            onPress={() => setActiveTab('daily')}
          >
            <Ionicons name="calendar" size={16} color={activeTab === 'daily' ? '#a855f7' : theme.colors.muted} />
            <Text style={[styles.tabText, activeTab === 'daily' && styles.tabTextActive]}>Daily 50</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listHeader}>
          {currentSongs.length > 0 && (
            <TouchableOpacity style={styles.playAllButton} onPress={handlePlayAll}>
              <Ionicons name="play" size={20} color={theme.colors.background} />
              <Text style={styles.playAllText}>Abspielen</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.text} style={styles.loader} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : currentSongs.length === 0 ? (
          <Text style={styles.emptyText}>Keine Songs gefunden.</Text>
        ) : (
          <View style={styles.list}>
            {currentSongs.map((song, index) => {
              const isActive = activeSong?.id === song.id;
              const metric = activeTab === 'viral' ? song.plays : (data?.dailyPlayMap[song.id] || 0);
              return (
                <TouchableOpacity
                  key={song.id}
                  style={[styles.itemRow, isActive && styles.itemRowActive]}
                  onPress={() => handlePlaySong(song, index)}
                >
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                  {song.cover_url ? (
                    <Image source={{ uri: song.cover_url }} style={styles.itemImage} />
                  ) : (
                    <View style={[styles.itemImage, styles.itemFallback]}>
                      <Text style={styles.itemFallbackText}>Y</Text>
                    </View>
                  )}
                  <View style={styles.itemText}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{song.title}</Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {song.artist_name || song.creatorName || 'Creator'}
                    </Text>
                  </View>
                  <Text style={styles.rowPlayState}>{isActive && isPlaying ? 'II' : '▶'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  heroBackground: {
    backgroundColor: theme.colors.surface,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  content: {
    paddingBottom: 100,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 8,
  },
  heroMeta: {
    fontSize: 16,
    color: theme.colors.muted,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    zIndex: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    gap: 8,
    marginHorizontal: 4,
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tabText: {
    color: theme.colors.muted,
    fontSize: 15,
    fontWeight: '800',
  },
  tabTextActive: {
    color: theme.colors.text,
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
  },
  playAllText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: '900',
  },
  loader: {
    marginTop: 40,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  list: {
    paddingHorizontal: 20,
    gap: 10,
  },
  itemRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: theme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
  },
  itemRowActive: {
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderColor: 'rgba(124,58,237,0.42)',
  },
  rankNumber: {
    color: theme.colors.muted,
    fontSize: 18,
    fontWeight: '900',
    width: 24,
    textAlign: 'center',
  },
  itemImage: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 12,
    height: 56,
    width: 56,
  },
  itemFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemFallbackText: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  itemMeta: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  rowPlayState: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    width: 28,
  },
});
