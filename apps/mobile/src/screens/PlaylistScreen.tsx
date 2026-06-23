import { ActivityIndicator, Animated, Easing, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState, memo, useCallback, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { theme } from '../theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { DAILY_NEW_RELEASES_PLAYLIST_ID, loadPlaylistDetails } from '../lib/music-data';
import type { Playlist, Song } from '../lib/types';
import { usePlayerControls } from '../lib/player-context';
import { Ionicons } from '@expo/vector-icons';
import { formatPlays } from '../lib/format';
import { YoriaxPlaylistCover } from '../components/YoriaxUI';
import { useI18n } from '../lib/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'Playlist'>;

function SongSeparator() {
  return <View style={styles.songSeparator} />;
}

function DailyNewReleasesHeroBackground({ active }: { active: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const player = useVideoPlayer(require('../../assets/yoriax_intro.MOV'), (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
  });

  useEffect(() => {
    if (active) {
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

function PlayingVisualizer({ active }: { active: boolean }) {
  const bars = useRef([
    new Animated.Value(0.32),
    new Animated.Value(0.58),
    new Animated.Value(0.42),
  ]).current;

  useEffect(() => {
    if (!active) {
      bars.forEach((bar) => {
        bar.stopAnimation();
        bar.setValue(0.32);
      });
      return;
    }

    const loops = bars.map((bar, index) => (
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 90),
          Animated.timing(bar, {
            duration: 210,
            easing: Easing.inOut(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            duration: 230,
            easing: Easing.inOut(Easing.quad),
            toValue: index === 1 ? 0.38 : 0.54,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            duration: 190,
            easing: Easing.inOut(Easing.quad),
            toValue: index === 2 ? 0.9 : 0.68,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            duration: 220,
            easing: Easing.inOut(Easing.quad),
            toValue: 0.32,
            useNativeDriver: true,
          }),
        ]),
      )
    ));

    loops.forEach((loop) => loop.start());

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [active, bars]);

  if (!active) return null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.visualizer}
    >
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[
            styles.visualizerBar,
            {
              transform: [{ scaleY: bar }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const MemoizedSongRow = memo(function SongRow({
  song,
  index,
  isActive,
  isPlaying,
  onPlay
}: {
  song: Song;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: (song: Song, index: number) => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.songRow, isActive && styles.songRowActive]}
      onPress={() => onPlay(song, index)}
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

      <PlayingVisualizer active={isActive && isPlaying} />
    </TouchableOpacity>
  );
});

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
      <MemoizedSongRow
        song={item}
        index={index}
        isActive={isActive}
        isPlaying={isActive && isPlaying}
        onPlay={handlePlaySong}
      />
    );
  }, [activeSong?.id, handlePlaySong, isPlaying]);

  const isDailyNewReleases = playlist?.id === DAILY_NEW_RELEASES_PLAYLIST_ID;
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
            <View style={[styles.playlistHero, isDailyNewReleases && styles.dailyPlaylistHero]}>
              {isDailyNewReleases && !isLeaving ? (
                <DailyNewReleasesHeroBackground active={!loading && !error && !isLeaving} />
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
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 12,
    borderRadius: 16,
    marginHorizontal: 20,
  },
  songSeparator: {
    height: 12,
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
  visualizer: {
    alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.16)',
    borderColor: 'rgba(168,85,247,0.42)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    height: 24,
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
    width: 28,
  },
  visualizerBar: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 2,
    height: 14,
    shadowColor: theme.colors.primaryLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 6,
    width: 3,
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
