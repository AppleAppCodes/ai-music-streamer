import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackButton, CoverArt, StateCard } from '../components/YoriaxUI';
import { useAuth } from '../lib/auth-context';
import { loadLibraryMusic, type LibraryMusicData } from '../lib/music-data';
import { usePlayer } from '../lib/player-context';
import type { Song } from '../lib/types';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'LikedSongs'>;

export function LikedSongsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<LibraryMusicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeSong, isPlaying, playSong, setQueue, toggleShuffle } = usePlayer();

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

  const likedSongs = data?.likedSongs ?? [];

  const handlePlayAll = () => {
    if (likedSongs.length === 0) return;
    setQueue(likedSongs, 0);
    void playSong(likedSongs[0]);
  };

  const handleShuffle = () => {
    if (likedSongs.length === 0) return;
    toggleShuffle();
    setQueue(likedSongs, 0);
    void playSong(likedSongs[0]);
  };

  const handlePlaySong = (song: Song, index: number) => {
    setQueue(likedSongs, index);
    void playSong(song);
  };

  const handleContextMenu = (song: Song) => {
    Alert.alert(
      song.title,
      'Was möchtest du tun?',
      [
        { text: 'Teilen', onPress: () => console.log('Teilen', song.id) },
        { text: 'Zur Playlist hinzufügen', onPress: () => console.log('Playlist', song.id) },
        { text: 'Zum Künstler', onPress: () => console.log('Künstler', song.id) },
        { text: 'Zum Album', onPress: () => console.log('Album', song.id) },
        { text: 'Abbrechen', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(124,58,237,0.38)', 'rgba(124,58,237,0.12)', 'transparent']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="heart" size={30} color={theme.colors.text} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>PLAYLIST</Text>
            <Text style={styles.heroTitle}>Lieblingssongs</Text>
            <Text style={styles.heroMeta}>{likedSongs.length} Songs</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={likedSongs.length === 0}
            onPress={handleShuffle}
            style={[styles.secondaryButton, likedSongs.length === 0 && styles.disabledButton]}
          >
            <Ionicons name="shuffle" size={22} color={likedSongs.length === 0 ? theme.colors.subtle : theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={likedSongs.length === 0}
            onPress={handlePlayAll}
            style={[styles.playButton, likedSongs.length === 0 && styles.disabledButton]}
          >
            <Ionicons name="play" size={28} color={likedSongs.length === 0 ? theme.colors.subtle : '#050505'} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <StateCard title="Lieblingssongs werden geladen" message="Deine gespeicherten Tracks werden synchronisiert." loading />
        ) : error ? (
          <StateCard icon="warning" title="Konnte nicht geladen werden" message={error} />
        ) : likedSongs.length === 0 ? (
          <StateCard icon="heart-outline" title="Noch keine Lieblingssongs" message="Tippe bei Songs auf das Herz, dann erscheinen sie hier." />
        ) : (
          <View style={styles.list}>
            {likedSongs.map((song, index) => {
              const active = activeSong?.id === song.id;

              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={song.id}
                  onPress={() => handlePlaySong(song, index)}
                  style={[styles.row, active && styles.rowActive]}
                >
                  <CoverArt uri={song.cover_url} size={52} radius={12} />
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, active && styles.rowTitleActive]} numberOfLines={1}>{song.title}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>{song.artist_name || song.creatorName || 'Creator'}</Text>
                  </View>
                  {active && isPlaying ? <Ionicons name="volume-high" size={18} color={theme.colors.primaryLight} /> : null}
                  <TouchableOpacity
                    accessibilityRole="button"
                    hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    onPress={() => handleContextMenu(song)}
                    style={styles.contextButton}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.muted} />
                  </TouchableOpacity>
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
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  header: {
    left: 20,
    position: 'absolute',
    top: 18,
    zIndex: 10,
  },
  content: {
    paddingBottom: 170,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 86,
  },
  hero: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 18,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 26,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    width: 88,
  },
  heroText: {
    flex: 1,
    paddingBottom: 4,
  },
  eyebrow: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 6,
  },
  heroMeta: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'flex-end',
    marginBottom: 18,
    marginTop: 24,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.round,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  playButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radii.round,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  disabledButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  list: {
    gap: 8,
  },
  row: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: 'transparent',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 8,
  },
  rowActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: 'rgba(168,85,247,0.42)',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  rowTitleActive: {
    color: theme.colors.primaryLight,
  },
  rowMeta: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  contextButton: {
    padding: 8,
  },
});
