import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useEffect, useState, memo, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadLibraryMusic, type LibraryMusicData } from '../lib/music-data';
import { readPersistedCache, writePersistedCache } from '../lib/persisted-cache';
import { usePlayerControls } from '../lib/player-context';
import type { Playlist, Song } from '../lib/types';
import { theme } from '../theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useI18n } from '../lib/i18n';
import { SongListRow } from '../components/SongListRow';

const LIBRARY_CACHE_PREFIX = 'yoriax:library:v1:';

export function LibraryScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<LibraryMusicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) return;

      const cacheKey = `${LIBRARY_CACHE_PREFIX}${user.id}`;
      let hasCachedData = false;
      setLoading(true);
      setError(null);

      const cachedData = await readPersistedCache<LibraryMusicData>(cacheKey);
      if (mounted && cachedData) {
        hasCachedData = true;
        setData(cachedData);
        setLoading(false);
      }

      try {
        const nextData = await loadLibraryMusic(user.id);
        if (!mounted) return;
        setData(nextData);
        setError(null);
        setLoading(false);
        void writePersistedCache(cacheKey, nextData);
      } catch (loadError) {
        if (mounted && !hasCachedData) {
          setError(loadError instanceof Error ? loadError.message : t('library.loading'));
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [t, user]);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeSong, isPlaying, playSong, setQueue } = usePlayerControls();

  const handlePlaySong = useCallback((song: Song, index: number, list: Song[]) => {
    setQueue(list, index);
    void playSong(song);
  }, [setQueue, playSong]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.stack,
        {
          paddingBottom: insets.bottom + (activeSong ? 220 : 130),
          paddingTop: insets.top + 18,
        },
      ]}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      <Text style={styles.title}>{t('library.title')}</Text>
      <TouchableOpacity
        activeOpacity={0.84}
        style={styles.favoritesCard}
        onPress={() => navigation.navigate('LikedSongs')}
      >
        <LinearGradient
          colors={['rgba(124,58,237,0.4)', 'rgba(70,31,132,0.24)', 'rgba(255,255,255,0.045)']}
          locations={[0, 0.52, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.favoritesCover}>
          <Ionicons name="heart" size={40} color={theme.colors.text} />
        </View>
        <View style={styles.favoritesText}>
          <Text style={styles.favoritesEyebrow}>PLAYLIST</Text>
          <Text style={styles.favoritesTitle}>{t('library.favorites')}</Text>
          <Text style={styles.favoritesMeta}>
            {t('library.accountSongs', { count: data?.likedSongs.length ?? 0 })}
          </Text>
        </View>
      </TouchableOpacity>

      {loading && !data ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.text} />
          <Text style={styles.stateText}>{t('library.loading')}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {data ? (
        <>
          <SectionTitle title={t('library.myPlaylists')} />
          {data.playlists.length > 0 ? (
            <View style={styles.list}>
              {data.playlists.slice(0, 8).map((playlist) => (
                <PlaylistRow key={playlist.id} playlist={playlist} />
              ))}
            </View>
          ) : (
            <EmptyBlock title={t('library.emptyPlaylists')} copy={t('library.emptyPlaylistsCopy')} />
          )}

          <SectionTitle title={t('library.recentlyPlayed')} />
          {data.likedSongs.length > 0 ? (
            <View style={styles.list}>
              {data.likedSongs.slice(0, 8).map((song, index, arr) => {
                const isActive = activeSong?.id === song.id;
                return (
                  <SongRow 
                    key={song.id} 
                    song={song} 
                    index={index} 
                    list={arr} 
                    isActive={isActive}
                    isPlaying={isActive ? isPlaying : false}
                    onPlay={handlePlaySong}
                  />
                );
              })}
            </View>
          ) : (
            <EmptyBlock title={t('library.emptyHistory')} copy={t('library.emptyHistoryCopy')} />
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const SectionTitle = memo(function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
});

const SongRow = memo(function SongRow({ 
  song, 
  index, 
  list, 
  isActive, 
  isPlaying, 
  onPlay 
}: { 
  song: Song; 
  index: number; 
  list: Song[]; 
  isActive: boolean; 
  isPlaying: boolean; 
  onPlay: (song: Song, index: number, list: Song[]) => void; 
}) {
  return (
    <SongListRow
      active={isActive}
      index={index}
      isPlaying={isPlaying}
      onPlay={(nextSong, nextIndex) => onPlay(nextSong, nextIndex, list)}
      song={song}
    />
  );
});

const PlaylistRow = memo(function PlaylistRow({ playlist }: { playlist: Playlist }) {
  const { t } = useI18n();
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
        <Text style={styles.itemMeta}>
          {playlist.is_public ? t('common.public') : t('common.private')}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

function EmptyBlock({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  stack: {
    backgroundColor: theme.colors.background,
    flexGrow: 1,
    gap: 16,
    paddingHorizontal: theme.spacing.screen,
  },
  title: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: '900',
  },
  favoritesCard: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 18,
    minHeight: 132,
    overflow: 'hidden',
    padding: 18,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
  },
  favoritesCover: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
    borderWidth: 1,
    height: 92,
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.36,
    shadowRadius: 18,
    width: 92,
  },
  favoritesEyebrow: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.4,
    marginBottom: 4,
  },
  favoritesMeta: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  favoritesText: {
    flex: 1,
    minWidth: 0,
  },
  favoritesTitle: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
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
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 12,
  },
  itemImage: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 10,
    height: 52,
    width: 52,
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
    fontSize: 15,
    fontWeight: '800',
  },
  itemMeta: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
});
