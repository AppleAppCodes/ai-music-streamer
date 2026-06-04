import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadLibraryMusic, type LibraryMusicData } from '../lib/music-data';
import { usePlayer } from '../lib/player-context';
import type { Playlist, Song } from '../lib/types';
import { theme } from '../theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

export function LibraryScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<LibraryMusicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          setError(loadError instanceof Error ? loadError.message : 'Bibliothek konnte nicht geladen werden.');
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

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={[styles.stack, { paddingTop: insets.top + 18 }]}>
      <Text style={styles.title}>Bibliothek</Text>
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('LikedSongs')}
      >
        <View style={styles.iconBox}>
          <Text style={styles.heart}>♥</Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Lieblingssongs</Text>
          <Text style={styles.rowMeta}>{data?.likedSongs.length ?? 0} Songs in deinem Account</Text>
        </View>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.text} />
          <Text style={styles.stateText}>Bibliothek wird geladen</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {data && !loading ? (
        <>
          <SectionTitle title="Meine Playlists" />
          {data.playlists.length > 0 ? (
            <View style={styles.list}>
              {data.playlists.slice(0, 8).map((playlist) => (
                <PlaylistRow key={playlist.id} playlist={playlist} />
              ))}
            </View>
          ) : (
            <EmptyBlock title="Noch keine Playlists" copy="Sobald du Playlists erstellst, werden sie hier synchronisiert." />
          )}

          <SectionTitle title="Zuletzt gehört" />
          {data.likedSongs.length > 0 ? (
            <View style={styles.list}>
              {data.likedSongs.slice(0, 8).map((song, index, arr) => (
                <SongRow key={song.id} song={song} index={index} list={arr} />
              ))}
            </View>
          ) : (
            <EmptyBlock title="Noch keine Songs gehört" copy="Deine zuletzt gehörten Songs erscheinen hier." />
          )}
        </>
      ) : null}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function SongRow({ song, index, list }: { song: Song; index: number; list: Song[] }) {
  const { activeSong, isPlaying, playSong, setQueue } = usePlayer();
  const isActive = activeSong?.id === song.id;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => {
        setQueue(list, index);
        void playSong(song);
      }}
      style={[styles.itemRow, isActive && styles.itemRowActive]}
    >
      {song.cover_url ? (
        <Image source={{ uri: song.cover_url }} style={styles.itemImage} alt="" />
      ) : (
        <View style={[styles.itemImage, styles.itemFallback]}>
          <Text style={styles.itemFallbackText}>Y</Text>
        </View>
      )}
      <View style={styles.itemText}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.itemMeta} numberOfLines={1}>
          {song.artist_name || song.creatorName || 'Creator'}
        </Text>
      </View>
      <Text style={styles.rowPlayState}>{isActive && isPlaying ? 'II' : '▶'}</Text>
    </TouchableOpacity>
  );
}

function PlaylistRow({ playlist }: { playlist: Playlist }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <TouchableOpacity
      style={styles.itemRow}
      onPress={() => navigation.navigate('Playlist', { playlistId: playlist.id })}
    >
      {playlist.cover_url ? (
        <Image source={{ uri: playlist.cover_url }} style={styles.itemImage} alt="" />
      ) : (
        <View style={[styles.itemImage, styles.playlistFallback]}>
          <Text style={styles.itemFallbackText}>♪</Text>
        </View>
      )}
      <View style={styles.itemText}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {playlist.title}
        </Text>
        <Text style={styles.itemMeta}>{playlist.is_public ? 'Oeffentlich' : 'Privat'}</Text>
      </View>
    </TouchableOpacity>
  );
}

function EmptyBlock({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: 16,
    paddingBottom: 170,
    paddingHorizontal: theme.spacing.screen,
  },
  title: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: '900',
  },
  row: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 18,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  heart: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  rowMeta: {
    color: theme.colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  emptyBox: {
    borderColor: theme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyCopy: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  stateBox: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  stateText: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.32)',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: 4,
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
  playlistFallback: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
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
