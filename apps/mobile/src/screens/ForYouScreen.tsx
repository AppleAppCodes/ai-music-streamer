import {
  ActivityIndicator,
  FlatList,
  Image,
  InteractionManager,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { useAuth } from '../lib/auth-context';
import { loadFeedPreview } from '../lib/music-data';
import { usePlayerControls } from '../lib/player-context';
import type { FeedPreviewSong } from '../lib/types';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

function getHookStart(song: FeedPreviewSong | null) {
  return Math.max(0, song?.clip?.hook_start_seconds ?? 0);
}

function getIndexFromOffset(offsetY: number, itemHeight: number, itemCount: number) {
  if (itemHeight <= 0 || itemCount <= 0) return 0;
  const nextIndex = Math.round(offsetY / itemHeight);
  return Math.max(0, Math.min(itemCount - 1, nextIndex));
}

function FeedVisual({
  active,
  item,
  itemHeight,
  itemWidth,
  shouldLoadVideo,
}: {
  active: boolean;
  item: FeedPreviewSong;
  itemHeight: number;
  itemWidth: number;
  shouldLoadVideo: boolean;
}) {
  const videoUrl = item.clip?.video_url?.trim() || null;
  const videoPlayer = useVideoPlayer(shouldLoadVideo && videoUrl ? { uri: videoUrl } : null, (player) => {
    player.loop = true;
    player.muted = true;
  });

  useEffect(() => {
    if (!videoUrl || !shouldLoadVideo) return;

    if (active) {
      videoPlayer.play();
    } else {
      videoPlayer.pause();
    }

    return () => {
      videoPlayer.pause();
    };
  }, [active, shouldLoadVideo, videoPlayer, videoUrl]);

  const mediaStyle = [styles.coverImage, { width: itemWidth, height: itemHeight }];

  if (videoUrl && shouldLoadVideo) {
    return (
      <VideoView
        player={videoPlayer}
        style={mediaStyle}
        contentFit="cover"
        nativeControls={false}
        playsInline
        surfaceType="textureView"
      />
    );
  }

  if (item.cover_url) {
    return <Image source={{ uri: item.cover_url }} style={mediaStyle} resizeMode="cover" alt="" />;
  }

  return <View style={[mediaStyle, styles.fallbackCover]} />;
}

const FeedItem = memo(function FeedItem({
  itemHeight,
  itemWidth,
  item,
  isActive,
  isCurrentSong,
  isPlaying,
  onPlayFull,
  onTogglePlay,
  shouldLoadVideo,
}: {
  itemHeight: number;
  itemWidth: number;
  item: FeedPreviewSong;
  isActive: boolean;
  isCurrentSong: boolean;
  isPlaying: boolean;
  onPlayFull: (item: FeedPreviewSong) => void;
  onTogglePlay: () => void;
  shouldLoadVideo: boolean;
}) {
  return (
    <View style={[styles.feedItem, { width: itemWidth, height: itemHeight }]}>
      <FeedVisual
        active={isActive}
        item={item}
        itemHeight={itemHeight}
        itemWidth={itemWidth}
        shouldLoadVideo={shouldLoadVideo}
      />

      {/* Dark gradient overlay at bottom could go here, for now just a dark shadow overlay */}
      <View style={styles.overlay} />

      <View style={styles.contentContainer}>
        <View style={styles.textContainer}>
          <Text style={[styles.artistName, { color: theme.colors.primary }]}>
            {item.artist_name || item.creatorName || 'Creator'}
          </Text>
          <Text style={styles.songTitle}>{item.title}</Text>
          <TouchableOpacity 
            style={styles.fullSongButton}
            onPress={() => onPlayFull(item)}
          >
            <Ionicons name="musical-notes" size={14} color="#000" />
            <Text style={styles.fullSongText}>Ganzen Song hören</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onTogglePlay}
        >
          <Ionicons name={isActive && isCurrentSong && isPlaying ? "pause-circle" : "play-circle"} size={44} color="white" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="heart" size={32} color={isActive ? theme.colors.primary : "white"} />
          <Text style={styles.actionText}>{item.likes_count ?? 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-social" size={32} color="white" />
          <Text style={styles.actionText}>Teilen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}, (previous, next) => (
  previous.item.id === next.item.id
  && previous.item.likes_count === next.item.likes_count
  && previous.itemHeight === next.itemHeight
  && previous.itemWidth === next.itemWidth
  && previous.isActive === next.isActive
  && previous.isCurrentSong === next.isCurrentSong
  && previous.isPlaying === next.isPlaying
  && previous.shouldLoadVideo === next.shouldLoadVideo
));

export function ForYouScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { height: itemHeight, width: itemWidth } = useWindowDimensions();
  const { activeSong, isPlaying, playSong, toggle, setQueue } = usePlayerControls();
  const [songs, setSongs] = useState<FeedPreviewSong[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track currently visible item to avoid playing the same song repeatedly
  const currentHookSongId = useRef<string | null>(null);
  const dragSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hookStartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hookInteractionTask = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) return;
      setLoading(true);
      setError(null);

      try {
        const nextSongs = await loadFeedPreview(user.id);
        if (mounted) {
          currentHookSongId.current = null;
          setActiveIndex(0);
          setSongs(nextSongs);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Fuer dich konnte nicht geladen werden.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [user]);

  const startHookPlayback = useCallback((song: FeedPreviewSong, force = false) => {
    if (!force && currentHookSongId.current === song.id && activeSong?.id === song.id) return;
    currentHookSongId.current = song.id;

    setQueue([song], 0);
    void playSong(song, { startAt: getHookStart(song) });
  }, [activeSong?.id, playSong, setQueue]);

  const scheduleHookPlayback = useCallback((index: number, force = false) => {
    if (songs.length === 0) return;
    const nextIndex = Math.max(0, Math.min(songs.length - 1, index));

    setActiveIndex((currentIndex) => currentIndex === nextIndex ? currentIndex : nextIndex);

    if (hookStartTimer.current) {
      clearTimeout(hookStartTimer.current);
    }
    hookInteractionTask.current?.cancel?.();

    hookStartTimer.current = setTimeout(() => {
      hookInteractionTask.current = InteractionManager.runAfterInteractions(() => {
        startHookPlayback(songs[nextIndex], force);
      });
    }, 80);
  }, [songs, startHookPlayback]);

  const clearDragSettleTimer = useCallback(() => {
    if (!dragSettleTimer.current) return;
    clearTimeout(dragSettleTimer.current);
    dragSettleTimer.current = null;
  }, []);

  useEffect(() => {
    if (loading || songs.length === 0 || currentHookSongId.current) return;
    scheduleHookPlayback(0, true);
  }, [loading, scheduleHookPlayback, songs.length]);

  useEffect(() => () => {
    clearDragSettleTimer();
    if (hookStartTimer.current) {
      clearTimeout(hookStartTimer.current);
    }
    hookInteractionTask.current?.cancel?.();
  }, [clearDragSettleTimer]);

  const handleMomentumScrollBegin = useCallback(() => {
    clearDragSettleTimer();
  }, [clearDragSettleTimer]);

  const handleMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    clearDragSettleTimer();
    const nextIndex = getIndexFromOffset(event.nativeEvent.contentOffset.y, itemHeight, songs.length);
    scheduleHookPlayback(nextIndex);
  }, [clearDragSettleTimer, itemHeight, scheduleHookPlayback, songs.length]);

  const handleScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    clearDragSettleTimer();
    const nextIndex = getIndexFromOffset(event.nativeEvent.contentOffset.y, itemHeight, songs.length);

    dragSettleTimer.current = setTimeout(() => {
      scheduleHookPlayback(nextIndex);
    }, 220);
  }, [clearDragSettleTimer, itemHeight, scheduleHookPlayback, songs.length]);

  // We want to pause when leaving the ForYou tab?
  // Usually TikTok pauses when you go to another tab, but for a music app maybe not.
  // We'll leave it playing for now.

  const handlePlayFull = useCallback((item: FeedPreviewSong) => {
    setQueue([item], 0);
    void playSong(item);
    navigation.navigate('FullscreenPlayer');
  }, [setQueue, playSong, navigation]);

  const getItemLayout = useCallback((_: ArrayLike<FeedPreviewSong> | null | undefined, index: number) => ({
    length: itemHeight,
    offset: itemHeight * index,
    index,
  }), [itemHeight]);

  const renderItem = useCallback(({ item, index }: { item: FeedPreviewSong; index: number }) => {
    const isActive = index === activeIndex;
    const isCurrentSong = activeSong?.id === item.id;
    const isSongPlaying = isActive && isCurrentSong && isPlaying;
    const shouldLoadVideo = Math.abs(index - activeIndex) <= 1;

    return (
      <FeedItem
        itemHeight={itemHeight}
        itemWidth={itemWidth}
        item={item}
        isActive={isActive}
        isCurrentSong={isCurrentSong}
        isPlaying={isSongPlaying}
        onPlayFull={handlePlayFull}
        onTogglePlay={() => {
          if (activeSong?.id === item.id) {
            toggle();
          } else {
            startHookPlayback(item, true);
          }
        }}
        shouldLoadVideo={shouldLoadVideo}
      />
    );
  }, [activeIndex, activeSong?.id, handlePlayFull, isPlaying, itemHeight, itemWidth, startHookPlayback, toggle]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topTabs, { top: Math.max(insets.top + 10, 60) }]}>
        <TouchableOpacity activeOpacity={0.8}>
          <Text style={[styles.topTab, styles.topTabActive]}>Für dich</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.6} onPress={() => Alert.alert('Bald verfügbar', 'Dieser Feed kommt in einem der nächsten Updates.')}>
          <Text style={styles.topTab}>Gefolgt</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.6} onPress={() => Alert.alert('Bald verfügbar', 'Dieser Feed kommt in einem der nächsten Updates.')}>
          <Text style={styles.topTab}>Explore</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        extraData={`${activeIndex}:${activeSong?.id ?? ''}:${isPlaying ? '1' : '0'}:${itemHeight}:${itemWidth}`}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        onMomentumScrollBegin={handleMomentumScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollEndDrag={handleScrollEndDrag}
        initialNumToRender={2}
        windowSize={5}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={16}
        removeClippedSubviews={false}
        getItemLayout={getItemLayout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fecaca',
    fontSize: 16,
  },
  topTabs: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    zIndex: 10,
  },
  topTab: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '800',
  },
  topTabActive: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  feedItem: {
    backgroundColor: '#140c23',
    justifyContent: 'flex-end', // content at bottom
  },
  coverImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fallbackCover: {
    backgroundColor: '#1a102d',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)', // slightly dark so text is readable
  },
  contentContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 250, // move the text structure even higher
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 5,
  },
  fullSongButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 12,
    gap: 6,
  },
  fullSongText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },
  textContainer: {
    flex: 1,
    paddingRight: 60, // keep text from hitting absolute buttons
  },
  artistName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  songTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  hookTime: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsContainer: {
    position: 'absolute',
    right: 16,
    bottom: 300, // Move buttons way up to the middle right
    alignItems: 'center',
    gap: 24,
    zIndex: 10,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  }
});
