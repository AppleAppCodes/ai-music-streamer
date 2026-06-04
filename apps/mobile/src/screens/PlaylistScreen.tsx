import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { theme } from '../theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { loadPlaylistDetails } from '../lib/music-data';
import type { Playlist, Song } from '../lib/types';
import { usePlayer } from '../lib/player-context';
import { Ionicons } from '@expo/vector-icons';
import { formatPlays } from '../lib/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Playlist'>;

export function PlaylistScreen({ route, navigation }: Props) {
  const { playlistId } = route.params;
  
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { activeSong, isPlaying, playSong, setQueue } = usePlayer();

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await loadPlaylistDetails(playlistId);
        if (mounted) {
          setPlaylist(data.playlist);
          setSongs(data.songs);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Playlist konnte nicht geladen werden.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [playlistId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.primary} />
          <Text style={styles.backText}>Zurück</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.colors.text} size="large" />
          <Text style={styles.centerText}>Playlist wird geladen...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : playlist ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.playlistHero}>
            {playlist.cover_url ? (
              <Image source={{ uri: playlist.cover_url }} style={styles.playlistCover} alt="" />
            ) : (
              <View style={[styles.playlistCover, styles.playlistFallback]}>
                <Text style={styles.playlistFallbackText}>♪</Text>
              </View>
            )}
            <Text style={styles.playlistTitle}>{playlist.title}</Text>
            <Text style={styles.playlistMeta}>
              {playlist.is_public ? 'Öffentliche Playlist' : 'Private Playlist'} • {songs.length} Songs
            </Text>
            {playlist.description ? (
              <Text style={styles.playlistDescription}>{playlist.description}</Text>
            ) : null}

            {songs.length > 0 && (
              <TouchableOpacity 
                style={styles.playAllButton}
                onPress={() => {
                  setQueue(songs, 0);
                  void playSong(songs[0]);
                }}
              >
                <Text style={styles.playAllText}>Abspielen</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.songList}>
            {songs.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Diese Playlist ist leer.</Text>
              </View>
            ) : (
              songs.map((song, index) => {
                const isActive = activeSong?.id === song.id;

                return (
                  <TouchableOpacity
                    key={`${song.id}-${index}`}
                    style={[styles.songRow, isActive && styles.songRowActive]}
                    onPress={() => {
                      setQueue(songs, index);
                      void playSong(song);
                    }}
                  >
                    {song.cover_url ? (
                      <Image source={{ uri: song.cover_url }} style={styles.songCover} alt="" />
                    ) : (
                      <View style={[styles.songCover, styles.songFallback]}>
                        <Text style={styles.songFallbackText}>Y</Text>
                      </View>
                    )}

                    <View style={styles.songInfo}>
                      <Text style={[styles.songTitle, isActive && styles.activeText]} numberOfLines={1}>
                        {song.title}
                      </Text>
                      <Text style={styles.songArtist} numberOfLines={1}>
                        {song.artist_name || song.creatorName || 'Creator'}
                      </Text>
                    </View>

                    <Text style={styles.songMeta}>{formatPlays(song.plays)}</Text>

                    {isActive && isPlaying && (
                      <View style={styles.playingIndicator}>
                        <Text style={styles.playingText}>▶</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      ) : null}
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
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 4,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  centerText: {
    color: theme.colors.muted,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#fecaca',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  content: {
    paddingBottom: 120, // space for miniplayer
  },
  playlistHero: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  playlistCover: {
    width: 200,
    height: 200,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceMuted,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  playlistFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistFallbackText: {
    color: theme.colors.text,
    fontSize: 80,
    fontWeight: '900',
  },
  playlistTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  playlistMeta: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  playlistDescription: {
    color: theme.colors.text,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  playAllButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 10,
  },
  playAllText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  songList: {
    padding: 20,
    gap: 12,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 12,
    borderRadius: 16,
  },
  songRowActive: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderColor: 'rgba(124,58,237,0.3)',
    borderWidth: 1,
  },
  songCover: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
  },
  songFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  songFallbackText: {
    color: theme.colors.muted,
    fontSize: 20,
    fontWeight: '900',
  },
  songInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  songTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  activeText: {
    color: theme.colors.primary,
  },
  songArtist: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  songMeta: {
    color: theme.colors.subtle,
    fontSize: 12,
    fontWeight: '700',
  },
  playingIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  playingText: {
    color: theme.colors.background,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: theme.colors.muted,
    fontSize: 16,
  }
});
