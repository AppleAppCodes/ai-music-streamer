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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { useAuth } from '../lib/auth-context';
import {
  loadFeedLikeCount,
  loadFeedPreview,
  loadFollowedArtistNames,
  loadFollowingFeed,
  loadExploreFeed,
  toggleArtistFollow,
  toggleLike,
} from '../lib/music-data';
import { usePlayerControls } from '../lib/player-context';
import type { FeedPreviewSong } from '../lib/types';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

function getArtistName(song: FeedPreviewSong) {
  return song.artist_name || song.creatorName || 'Creator';
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
  isLiked,
  isFollowingArtist,
  showFollowButton,
  onToggleLike,
  onToggleFollow,
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
  isLiked: boolean;
  isFollowingArtist: boolean;
  showFollowButton: boolean;
  onToggleLike: (item: FeedPreviewSong) => void;
  onToggleFollow: (item: FeedPreviewSong) => void;
}) {
  const artistName = getArtistName(item);

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
            {artistName}
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
        {showFollowButton ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onToggleFollow(item)}
            accessibilityRole="button"
            accessibilityLabel={isFollowingArtist ? `${artistName} nicht mehr folgen` : `${artistName} folgen`}
          >
            <LinearGradient
              colors={isFollowingArtist
                ? ['rgba(45,212,191,0.36)', 'rgba(124,58,237,0.22)']
                : ['rgba(124,58,237,0.34)', 'rgba(45,212,191,0.18)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.followAvatar}
            >
              <Ionicons
                name={isFollowingArtist ? 'person' : 'person-add-outline'}
                size={24}
                color={isFollowingArtist ? theme.colors.accent : theme.colors.text}
              />
              <View style={[styles.followBadge, isFollowingArtist && styles.followBadgeActive]}>
                <Text style={[styles.followBadgeText, isFollowingArtist && styles.followBadgeTextActive]}>
                  {isFollowingArtist ? 'OK' : 'Y+'}
                </Text>
              </View>
            </LinearGradient>
            <Text style={styles.actionText}>{isFollowingArtist ? 'Gefolgt' : 'Folgen'}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onTogglePlay}
        >
          <Ionicons name={isActive && isCurrentSong && isPlaying ? "pause-circle" : "play-circle"} size={44} color="white" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onToggleLike(item)}>
          <Ionicons name="heart" size={32} color={isLiked ? theme.colors.primary : "white"} />
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
  && previous.isActive === next.isActive
  && previous.isCurrentSong === next.isCurrentSong
  && previous.isPlaying === next.isPlaying
  && previous.shouldLoadVideo === next.shouldLoadVideo
  && previous.isLiked === next.isLiked
  && previous.isFollowingArtist === next.isFollowingArtist
  && previous.showFollowButton === next.showFollowButton
));

export function ForYouScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { height: itemHeight, width: itemWidth } = useWindowDimensions();
  const { activeSong, isPlaying, playSong, toggle, setQueue, setPreviewVolume } = usePlayerControls();
  const [activeFeed, setActiveFeed] = useState<'foryou' | 'following' | 'explore'>('foryou');
  const [songs, setSongs] = useState<FeedPreviewSong[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likedSongsMap, setLikedSongsMap] = useState<Record<string, boolean>>({});
  const [followedArtistsMap, setFollowedArtistsMap] = useState<Record<string, boolean>>({});

  // Track currently visible item to avoid playing the same song repeatedly
  const currentHookSongId = useRef<string | null>(null);
  const dragSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hookStartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hookInteractionTask = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const scrollVolumeFrame = useRef<number | null>(null);
  const pendingScrollVolume = useRef(1);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) return;
      setLoading(true);
      setError(null);

      try {
        let nextSongs: FeedPreviewSong[] = [];
        if (activeFeed === 'foryou') {
          nextSongs = await loadFeedPreview(user.id);
        } else if (activeFeed === 'following') {
          nextSongs = await loadFollowingFeed(user.id);
        } else if (activeFeed === 'explore') {
          nextSongs = await loadExploreFeed(user.id);
        }
        
        const followedArtistNames = await loadFollowedArtistNames(user.id);

        if (mounted) {
          const initialLikedMap: Record<string, boolean> = {};
          const initialFollowedMap: Record<string, boolean> = {};

          nextSongs.forEach(s => {
            if (s.isLiked) initialLikedMap[s.id] = true;
          });
          followedArtistNames.forEach((artistName) => {
            initialFollowedMap[artistName] = true;
          });

          setLikedSongsMap(initialLikedMap);
          setFollowedArtistsMap(initialFollowedMap);
          currentHookSongId.current = null;
          setActiveIndex(0);
          setSongs(nextSongs.map((song) => ({
            ...song,
            isFollowingArtist: !!initialFollowedMap[getArtistName(song)],
          })));
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Feed konnte nicht geladen werden.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [user, activeFeed]);

  const startHookPlayback = useCallback((song: FeedPreviewSong, force = false, fadeInMs = 0) => {
    if (!force && currentHookSongId.current === song.id && activeSong?.id === song.id) return;
    currentHookSongId.current = song.id;

    setQueue([song], 0);
    void playSong(song, { startAt: getHookStart(song), fadeInMs });
  }, [activeSong?.id, playSong, setQueue]);

  const scheduleHookPlayback = useCallback((index: number, force = false) => {
    if (songs.length === 0) return;
    const nextIndex = Math.max(0, Math.min(songs.length - 1, index));

    setActiveIndex((currentIndex) => currentIndex === nextIndex ? currentIndex : nextIndex);

    if (hookStartTimer.current) {
      clearTimeout(hookStartTimer.current);
    }
    hookInteractionTask.current?.cancel?.();

    const nextSong = songs[nextIndex];
    const shouldFadeIn = Boolean(currentHookSongId.current && currentHookSongId.current !== nextSong.id);

    hookStartTimer.current = setTimeout(() => {
      hookInteractionTask.current = InteractionManager.runAfterInteractions(() => {
        startHookPlayback(nextSong, force, shouldFadeIn ? 220 : 0);
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
    if (scrollVolumeFrame.current != null) {
      cancelAnimationFrame(scrollVolumeFrame.current);
    }
    setPreviewVolume(1);
  }, [clearDragSettleTimer, setPreviewVolume]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isPlaying || songs.length < 2 || itemHeight <= 0) return;

    const pageOffset = event.nativeEvent.contentOffset.y / itemHeight;
    const distanceToSnap = Math.min(0.5, Math.abs(pageOffset - Math.round(pageOffset)));
    const transitionProgress = distanceToSnap / 0.5;

    pendingScrollVolume.current = 1 - transitionProgress * 0.42;

    if (scrollVolumeFrame.current != null) return;
    scrollVolumeFrame.current = requestAnimationFrame(() => {
      scrollVolumeFrame.current = null;
      setPreviewVolume(pendingScrollVolume.current);
    });
  }, [isPlaying, itemHeight, setPreviewVolume, songs.length]);

  const handleMomentumScrollBegin = useCallback(() => {
    clearDragSettleTimer();
  }, [clearDragSettleTimer]);

  const handleMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    clearDragSettleTimer();
    setPreviewVolume(1);
    const nextIndex = getIndexFromOffset(event.nativeEvent.contentOffset.y, itemHeight, songs.length);
    scheduleHookPlayback(nextIndex);
  }, [clearDragSettleTimer, itemHeight, scheduleHookPlayback, setPreviewVolume, songs.length]);

  const handleScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    clearDragSettleTimer();
    const nextIndex = getIndexFromOffset(event.nativeEvent.contentOffset.y, itemHeight, songs.length);

    dragSettleTimer.current = setTimeout(() => {
      setPreviewVolume(1);
      scheduleHookPlayback(nextIndex);
    }, 220);
  }, [clearDragSettleTimer, itemHeight, scheduleHookPlayback, setPreviewVolume, songs.length]);

  // We want to pause when leaving the ForYou tab?
  // Usually TikTok pauses when you go to another tab, but for a music app maybe not.
  // We'll leave it playing for now.

  const handlePlayFull = useCallback((item: FeedPreviewSong) => {
    setPreviewVolume(1);
    setQueue([item], 0);
    void playSong(item);
    navigation.navigate('FullscreenPlayer');
  }, [setPreviewVolume, setQueue, playSong, navigation]);

  const getItemLayout = useCallback((_: ArrayLike<FeedPreviewSong> | null | undefined, index: number) => ({
    length: itemHeight,
    offset: itemHeight * index,
    index,
  }), [itemHeight]);

  const handleToggleLike = useCallback(async (item: FeedPreviewSong) => {
    if (!user) return;
    const isCurrentlyLiked = !!likedSongsMap[item.id];
    const newStatus = !isCurrentlyLiked;
    const optimisticCount = Math.max(0, (item.likes_count ?? 0) + (newStatus ? 1 : -1));
    
    setLikedSongsMap(prev => ({ ...prev, [item.id]: newStatus }));
    setSongs(prev => prev.map(s => s.id === item.id ? { ...s, likes_count: optimisticCount, isLiked: newStatus } : s));

    try {
      const confirmedStatus = await toggleLike(user.id, item.id, isCurrentlyLiked);
      const confirmedCount = await loadFeedLikeCount(item.id);

      setLikedSongsMap(prev => ({ ...prev, [item.id]: confirmedStatus }));
      setSongs(prev => prev.map(s => s.id === item.id ? {
        ...s,
        isLiked: confirmedStatus,
        likes_count: confirmedCount,
      } : s));
    } catch {
      setLikedSongsMap(prev => ({ ...prev, [item.id]: isCurrentlyLiked }));
      setSongs(prev => prev.map(s => s.id === item.id ? {
        ...s,
        isLiked: isCurrentlyLiked,
        likes_count: item.likes_count ?? 0,
      } : s));
    }
  }, [user, likedSongsMap]);

  const handleToggleFollow = useCallback(async (item: FeedPreviewSong) => {
    if (!user) return;
    const artistName = getArtistName(item);
    const isCurrentlyFollowing = !!followedArtistsMap[artistName];
    const nextStatus = !isCurrentlyFollowing;

    setFollowedArtistsMap(prev => ({ ...prev, [artistName]: nextStatus }));
    setSongs(prev => prev.map(song => getArtistName(song) === artistName ? {
      ...song,
      isFollowingArtist: nextStatus,
    } : song));

    try {
      const confirmedStatus = await toggleArtistFollow(user.id, artistName, isCurrentlyFollowing);
      setFollowedArtistsMap(prev => ({ ...prev, [artistName]: confirmedStatus }));
      setSongs(prev => prev.map(song => getArtistName(song) === artistName ? {
        ...song,
        isFollowingArtist: confirmedStatus,
      } : song));
    } catch {
      setFollowedArtistsMap(prev => ({ ...prev, [artistName]: isCurrentlyFollowing }));
      setSongs(prev => prev.map(song => getArtistName(song) === artistName ? {
        ...song,
        isFollowingArtist: isCurrentlyFollowing,
      } : song));
    }
  }, [followedArtistsMap, user]);

  const renderTopTabs = useCallback(() => (
    <View style={[styles.topTabs, { top: Math.max(insets.top + 10, 60) }]}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setActiveFeed('foryou')}>
        <Text style={[styles.topTab, activeFeed === 'foryou' && styles.topTabActive]}>Für dich</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setActiveFeed('following')}>
        <Text style={[styles.topTab, activeFeed === 'following' && styles.topTabActive]}>Gefolgt</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setActiveFeed('explore')}>
        <Text style={[styles.topTab, activeFeed === 'explore' && styles.topTabActive]}>Explore</Text>
      </TouchableOpacity>
    </View>
  ), [activeFeed, insets.top]);

  const renderEmptyState = useCallback(() => {
    const copy = activeFeed === 'following'
      ? {
          icon: 'people-outline' as const,
          eyebrow: 'Gefolgt',
          title: 'Noch keine gefolgten Artists',
          message: 'Folge Artists, damit hier nur Hooks von deinen Favoriten erscheinen.',
          primaryLabel: 'Artists entdecken',
          primaryAction: () => navigation.navigate('Artists'),
          secondaryLabel: 'Explore öffnen',
          secondaryAction: () => setActiveFeed('explore'),
        }
      : activeFeed === 'explore'
        ? {
            icon: 'compass-outline' as const,
            eyebrow: 'Explore',
            title: 'Noch keine Explore-Hooks',
            message: 'Sobald neue Hooks verfügbar sind, landen sie hier zuerst.',
            primaryLabel: 'Für dich öffnen',
            primaryAction: () => setActiveFeed('foryou'),
            secondaryLabel: null,
            secondaryAction: null,
          }
        : {
            icon: 'sparkles-outline' as const,
            eyebrow: 'Für dich',
            title: 'Dein Feed wird vorbereitet',
            message: 'Höre und like Songs, damit YORIAX deinen Feed besser kuratieren kann.',
            primaryLabel: 'Explore öffnen',
            primaryAction: () => setActiveFeed('explore'),
            secondaryLabel: null,
            secondaryAction: null,
          };

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name={copy.icon} size={28} color={theme.colors.text} />
          </View>
          <Text style={styles.emptyEyebrow}>{copy.eyebrow}</Text>
          <Text style={styles.emptyTitle}>{copy.title}</Text>
          <Text style={styles.emptyMessage}>{copy.message}</Text>

          <View style={styles.emptyActions}>
            <TouchableOpacity activeOpacity={0.86} style={styles.emptyPrimaryButton} onPress={copy.primaryAction}>
              <Text style={styles.emptyPrimaryText}>{copy.primaryLabel}</Text>
            </TouchableOpacity>
            {copy.secondaryLabel && copy.secondaryAction ? (
              <TouchableOpacity activeOpacity={0.86} style={styles.emptySecondaryButton} onPress={copy.secondaryAction}>
                <Text style={styles.emptySecondaryText}>{copy.secondaryLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  }, [activeFeed, navigation]);

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
            startHookPlayback(item, true, 180);
          }
        }}
        shouldLoadVideo={shouldLoadVideo}
        isLiked={!!likedSongsMap[item.id]}
        isFollowingArtist={!!followedArtistsMap[getArtistName(item)]}
        showFollowButton={activeFeed !== 'following'}
        onToggleLike={handleToggleLike}
        onToggleFollow={handleToggleFollow}
      />
    );
  }, [
    activeFeed,
    activeIndex,
    activeSong?.id,
    followedArtistsMap,
    handlePlayFull,
    handleToggleFollow,
    handleToggleLike,
    isPlaying,
    itemHeight,
    itemWidth,
    likedSongsMap,
    startHookPlayback,
    toggle,
  ]);

  if (loading) {
    return (
      <View style={styles.container}>
        {renderTopTabs()}
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {renderTopTabs()}
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  if (songs.length === 0) {
    return (
      <View style={styles.container}>
        {renderTopTabs()}
        {renderEmptyState()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderTopTabs()}

      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        extraData={`${activeIndex}:${activeSong?.id ?? ''}:${isPlaying ? '1' : '0'}:${itemHeight}:${itemWidth}:${activeFeed}:${JSON.stringify(likedSongsMap)}:${JSON.stringify(followedArtistsMap)}`}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        onMomentumScrollBegin={handleMomentumScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
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
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 30,
    borderWidth: 1,
    maxWidth: 360,
    padding: 24,
    width: '100%',
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderColor: 'rgba(168,85,247,0.35)',
    borderRadius: 24,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    marginBottom: 16,
    width: 54,
  },
  emptyEyebrow: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyMessage: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 22,
    textAlign: 'center',
  },
  emptyActions: {
    gap: 10,
    width: '100%',
  },
  emptyPrimaryButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: 999,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  emptyPrimaryText: {
    color: theme.colors.background,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  emptySecondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  emptySecondaryText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
  followAvatar: {
    alignItems: 'center',
    borderColor: 'rgba(168,85,247,0.45)',
    borderRadius: 18,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    shadowColor: theme.colors.primaryLight,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    width: 48,
  },
  followBadge: {
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    borderColor: '#050505',
    borderRadius: 999,
    borderWidth: 2,
    bottom: -7,
    height: 23,
    justifyContent: 'center',
    position: 'absolute',
    right: -7,
    width: 27,
  },
  followBadgeActive: {
    backgroundColor: theme.colors.accent,
  },
  followBadgeText: {
    color: theme.colors.text,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  followBadgeTextActive: {
    color: theme.colors.background,
    fontSize: 7,
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
