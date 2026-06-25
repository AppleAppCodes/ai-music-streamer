import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { theme } from '../theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { DAILY_NEW_RELEASES_PLAYLIST_ID, loadPlaylistDetails } from '../lib/music-data';
import type { Playlist, Song } from '../lib/types';
import { usePlayerControls } from '../lib/player-context';
import { Ionicons } from '@expo/vector-icons';
import { SongListRow } from '../components/SongListRow';
import { YoriaxPlaylistCover } from '../components/YoriaxUI';
import { useI18n } from '../lib/i18n';
import { configureSilentLoopingVideoPlayer, prepareSilentVideoPlayback } from '../lib/silent-video';

type Props = NativeStackScreenProps<RootStackParamList, 'Playlist'>;

function SongSeparator() {
  return <View style={styles.songSeparator} />;
}

function PlaylistHeroBackground({ active, videoUrl }: { active: boolean; videoUrl?: string | null }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const source = useMemo(() => videoUrl ? { uri: videoUrl } : require('../../assets/yoriax_intro.MOV'), [videoUrl]);
  const player = useVideoPlayer(source, (videoPlayer) => {
    configureSilentLoopingVideoPlayer(videoPlayer);
  });

  useEffect(() => {
    player.replace(source);
  }, [player, source]);

  useEffect(() => {
    if (active) {
      prepareSilentVideoPlayback(player);
      player.play();
    } else {
      player.pause();
    }

    return () => {
      try {
        player.pause();
      } catch {
        // Ignore native player teardown races while leaving the screen.
      }
    };
  }, [active, player]);

  return (
    <View pointerEvents="none" style={styles.dailyHeroBackground}>
      <VideoView
        contentFit="cover"
        nativeControls={false}
        player={player}
        style={styles.dailyHeroVideo}
      />
      <LinearGradient
        colors={['rgba(5,5,6,0.32)', 'rgba(8,7,14,0.72)', theme.colors.background]}
        locations={[0, 0.52, 1]}
        style={styles.dailyHeroOverlay}
      />
    </View>
  );
}

export function PlaylistScreen({ route, navigation }: Props) {
  const { t } = useI18n();
  const { playlistId } = route.params;
  
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { activeSong, isPlaying, playSong, setQueue } = usePlayerControls();

  const handlePlaySong = useCallback((song: Song, index: number) => {
    setQueue(songs, index);
    void playSong(song);
  }, [playSong, setQueue, songs]);

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
          setError(err instanceof Error ? err.message : t('playlist.loadError'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [playlistId, t]);

  useEffect(() => () => {
    if (backTimerRef.current) {
      clearTimeout(backTimerRef.current);
      backTimerRef.current = null;
    }
  }, []);

  const renderSong = useCallback(({ item, index }: { item: Song; index: number }) => {
    const isActive = activeSong?.id === item.id;

    return (
      <SongListRow
        active={isActive}
        index={index}
        isPlaying={isActive && isPlaying}
        onPlay={handlePlaySong}
        song={item}
        style={styles.songRowFrame}
      />
    );
  }, [activeSong?.id, handlePlaySong, isPlaying]);

  const isDailyNewReleases = playlist?.id === DAILY_NEW_RELEASES_PLAYLIST_ID;
  const hasVideo = !!playlist?.video_url || isDailyNewReleases;
  const playlistDescription = isDailyNewReleases
    ? t('playlist.dailyNewReleasesCopy')
    : playlist?.description;

  const handleBackPress = useCallback(() => {
    if (isLeaving) return;

    setIsLeaving(true);

    const navigateBack = () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }

      navigation.navigate('MainTabs', { screen: 'Home' });
    };

    if (isDailyNewReleases) {
      backTimerRef.current = setTimeout(navigateBack, 120);
      return;
    }

    navigateBack();
  }, [isDailyNewReleases, isLeaving, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.primary} />
          <Text style={styles.backText}>{t('playlist.back')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.colors.text} size="large" />
          <Text style={styles.centerText}>{t('playlist.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : playlist ? (
        <FlatList
          contentContainerStyle={styles.content}
          data={songs}
          extraData={`${activeSong?.id ?? ''}:${isPlaying ? '1' : '0'}`}
          initialNumToRender={10}
          ItemSeparatorComponent={SongSeparator}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          maxToRenderPerBatch={10}
          renderItem={renderSong}
          showsVerticalScrollIndicator={false}
          updateCellsBatchingPeriod={32}
          windowSize={7}
          ListHeaderComponent={
            <>
              <View style={[styles.playlistHero, hasVideo && styles.dailyPlaylistHero]}>
                {hasVideo && !isLeaving ? (
                  <PlaylistHeroBackground active={!loading && !error && !isLeaving} videoUrl={playlist?.video_url} />
                ) : null}
                <View style={styles.playlistHeroContent}>
                  {isDailyNewReleases ? (
                    <YoriaxPlaylistCover size={200} radius={20} style={styles.playlistCover} />
                  ) : playlist.cover_url ? (
                    <Image source={{ uri: playlist.cover_url }} style={styles.playlistCover} alt="" />
                  ) : (
                    <View style={[styles.playlistCover, styles.playlistFallback]}>
                      <Text style={styles.playlistFallbackText}>♪</Text>
                    </View>
                  )}
                  <Text style={styles.playlistTitle}>{playlist.title}</Text>
                  {playlist.creatorName ? (
                    <Text style={styles.playlistCreator}>
                      {t('playlistDiscover.by', { creator: playlist.creatorName })}
                      {playlist.is_official && (
                        <>
                          {' '}
                          <Ionicons name="shield-checkmark" size={13} color="#5eead4" />
                        </>
                      )}
                    </Text>
                  ) : null}
                  <Text style={styles.playlistMeta}>
                    {playlist.is_public ? t('playlist.publicMeta') : t('playlist.privateMeta')} • {songs.length} {t('common.songs')}
                  </Text>
                  {playlistDescription ? (
                    <Text style={styles.playlistDescription}>{playlistDescription}</Text>
                  ) : null}

                  {songs.length > 0 ? (
                    <TouchableOpacity
                      style={styles.playAllButton}
                      onPress={() => handlePlaySong(songs[0], 0)}
                    >
                      <Text style={styles.playAllText}>{t('playlist.play')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              {songs.length > 0 ? <View style={styles.playlistTracksTopGap} /> : null}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{t('playlist.empty')}</Text>
            </View>
          }
        />
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    overflow: 'hidden',
    paddingBottom: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  dailyPlaylistHero: {
    backgroundColor: theme.colors.background,
  },
  dailyHeroBackground: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dailyHeroVideo: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dailyHeroOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  playlistHeroContent: {
    alignItems: 'center',
    width: '100%',
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
  playlistCreator: {
    color: theme.colors.muted,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
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
  songSeparator: {
    height: 12,
  },
  songRowFrame: {
    marginHorizontal: 20,
  },
  playlistTracksTopGap: {
    height: 18,
  },
  emptyBox: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  emptyText: {
    color: theme.colors.muted,
    fontSize: 16,
  }
});
