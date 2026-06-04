import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useState, useEffect } from 'react';
import { theme } from '../theme';
import { usePlayer } from '../lib/player-context';
import { loadArtistSongs } from '../lib/music-data';
import type { Song } from '../lib/types';
import { formatPlays } from '../lib/format';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Artist'>;

export function ArtistScreen({ route, navigation }: Props) {
  const { artistId: artistName } = route.params;
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { activeSong, isPlaying, playSong } = usePlayer();

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await loadArtistSongs(artistName);
        if (mounted) setSongs(data);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Künstler konnte nicht geladen werden.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [artistName]);

  const totalPlays = songs.reduce((acc, song) => acc + (song.plays || 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Zurück</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{artistName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.title}>{artistName}</Text>
          <Text style={styles.subtitle}>{formatPlays(totalPlays)} Streams gesamt</Text>
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={theme.colors.text} />
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Beliebte Songs</Text>
            <View style={styles.songList}>
              {songs.map((song, idx) => {
                const active = activeSong?.id === song.id;
                return (
                  <TouchableOpacity
                    key={song.id}
                    style={styles.songRow}
                    onPress={() => void playSong(song)}
                  >
                    <Text style={styles.songIndex}>{idx + 1}</Text>
                    {song.cover_url ? (
                      <Image source={{ uri: song.cover_url }} style={styles.cover} />
                    ) : (
                      <View style={[styles.cover, styles.coverFallback]}>
                        <Text style={styles.coverFallbackText}>Y</Text>
                      </View>
                    )}
                    <View style={styles.songInfo}>
                      <Text style={[styles.songTitle, active && styles.activeText]} numberOfLines={1}>
                        {song.title}
                      </Text>
                      <Text style={styles.songPlays}>{formatPlays(song.plays)}</Text>
                    </View>
                    {active && isPlaying && (
                      <View style={styles.playingIndicator}>
                        <Text style={styles.playingText}>▶</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
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
    paddingTop: 50, // Safe area approx
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: theme.colors.background,
    zIndex: 10,
  },
  backButton: {
    paddingVertical: 8,
  },
  backText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    paddingBottom: 120, // space for MiniPlayer
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: theme.colors.text,
    fontSize: 40,
    fontWeight: '900',
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  stateBox: {
    padding: 40,
    alignItems: 'center',
  },
  errorBox: {
    margin: 20,
    padding: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.32)',
    borderWidth: 1,
    borderRadius: 12,
  },
  errorText: {
    color: '#fecaca',
    textAlign: 'center',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 16,
  },
  songList: {
    gap: 12,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  songIndex: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFallbackText: {
    color: theme.colors.muted,
    fontSize: 16,
    fontWeight: '900',
  },
  songInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  songTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  activeText: {
    color: theme.colors.primary,
  },
  songPlays: {
    color: theme.colors.subtle,
    fontSize: 12,
    fontWeight: '600',
  },
  playingIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingText: {
    color: theme.colors.background,
    fontSize: 10,
    fontWeight: '900',
  },
});
