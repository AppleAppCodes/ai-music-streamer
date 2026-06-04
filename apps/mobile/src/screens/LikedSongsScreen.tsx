import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { loadLibraryMusic, type LibraryMusicData } from '../lib/music-data';
import { usePlayer } from '../lib/player-context';
import type { Song } from '../lib/types';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LikedSongs'>;

export function LikedSongsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<LibraryMusicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeSong, isPlaying, playSong, setQueue } = usePlayer();

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) return;
      setLoading(true);
      setError(null);

      try {
        const nextData = await loadLibraryMusic(user.id);
        if (mounted) setData(nextData);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Konnte Lieblingssongs nicht laden.');
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

  const handlePlayAll = () => {
    if (!data || data.likedSongs.length === 0) return;
    setQueue(data.likedSongs, 0);
    void playSong(data.likedSongs[0]);
  };

  const handlePlaySong = (song: Song, index: number) => {
    if (!data) return;
    setQueue(data.likedSongs, index);
    void playSong(song);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroSection}>
          <View style={styles.heroIconBox}>
            <Ionicons name="heart" size={64} color={theme.colors.text} />
          </View>
          <Text style={styles.heroTitle}>Lieblingssongs</Text>
          <Text style={styles.heroMeta}>
            {data ? data.likedSongs.length : 0} Songs
          </Text>

          {data && data.likedSongs.length > 0 && (
            <TouchableOpacity style={styles.playAllButton} onPress={handlePlayAll}>
              <Ionicons name="play" size={24} color={theme.colors.background} />
              <Text style={styles.playAllText}>Abspielen</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.text} style={styles.loader} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : data?.likedSongs.length === 0 ? (
          <Text style={styles.emptyText}>Du hast noch keine Lieblingssongs.</Text>
        ) : (
          <View style={styles.list}>
            {data?.likedSongs.map((song, index) => {
              const isActive = activeSong?.id === song.id;
              return (
                <TouchableOpacity
                  key={song.id}
                  style={[styles.itemRow, isActive && styles.itemRowActive]}
                  onPress={() => handlePlaySong(song, index)}
                >
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
    padding: 20,
    paddingBottom: 100,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroIconBox: {
    width: 200,
    height: 200,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 8,
  },
  heroMeta: {
    fontSize: 16,
    color: theme.colors.muted,
    fontWeight: '600',
    marginBottom: 24,
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
  },
  playAllText: {
    color: theme.colors.background,
    fontSize: 18,
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
