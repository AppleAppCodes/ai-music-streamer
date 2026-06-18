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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

function getHookStart(song: FeedPreviewSong | null) {
  return Math.max(0, song?.clip?.hook_start_seconds ?? 0);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

async function waitForFeedAudioReady(
  player: AudioPlayer,
  isCurrentRequest: () => boolean,
  timeoutMs = 2200,
) {
  await new Promise((resolve) => setTimeout(resolve, 48));
  const startedAt = Date.now();

  while (isCurrentRequest() && Date.now() - startedAt < timeoutMs) {
    try {
      if (player.currentStatus.isLoaded) return true;
    } catch {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return false;
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
  item,
  itemHeight,
  itemWidth,
}: {
  item: FeedPreviewSong;
  itemHeight: number;
  itemWidth: number;
}) {
  const mediaStyle = [styles.coverImage, { width: itemWidth, height: itemHeight }];

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
        item={item}
        itemHeight={itemHeight}
        itemWidth={itemWidth}
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
            accessibilityState={{ selected: isFollowingArtist }}
          >
            <View
              style={[
                styles.followControl,
                isFollowingArtist && styles.followControlActive,
              ]}
            >
              <Ionicons
                name="add"
                size={31}
                color={theme.colors.primaryLight}
              />
            </View>
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
  && previous.isLiked === next.isLiked
  && previous.isFollowingArtist === next.isFollowingArtist
  && previous.showFollowButton === next.showFollowButton
));

type PreviewSlotKey = 'a' | 'b';

type PreviewSlotState = {
  index: number | null;
  pending: Promise<boolean> | null;
  ready: boolean;
  songId: string | null;
  token: number;
};

const PREVIEW_PLAYER_OPTIONS = {
  keepAudioSessionActive: true,
  preferredForwardBufferDuration: 8,
  updateInterval: 1000,
};

function createPreviewSlotState(): PreviewSlotState {
  return {
    index: null,
    pending: null,
    ready: false,
    songId: null,
    token: 0,
  };
}

function setFeedPlayerVolume(player: AudioPlayer, volume: number) {
  try {
    player.volume = clamp01(volume);
  } catch {
    // The native shared object can be released while the screen is unmounting.
  }
}

function setFeedPlayerMuted(player: AudioPlayer, muted: boolean) {
  try {
    player.muted = muted;
  } catch {
    // The native shared object can be released while the screen is unmounting.
  }
}

async function waitForFeedPlayersToStop(players: AudioPlayer[], timeoutMs = 400) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    let allStopped = true;

    players.forEach((player) => {
      setFeedPlayerMuted(player, true);
      setFeedPlayerVolume(player, 0);

      try {
        if (player.playing || player.currentStatus.playing) {
          allStopped = false;
          player.pause();
        }
      } catch {
        // A released player is already stopped from the app's perspective.
      }
    });

    if (allStopped) break;
    await new Promise((resolve) => setTimeout(resolve, 16));
  }

  // Flush the final AVPlayer audio buffer before another player becomes audible.
  await new Promise((resolve) => setTimeout(resolve, 32));
}

export function ForYouScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { height: itemHeight, width: itemWidth } = useWindowDimensions();
  const { playSong, reset: resetMainPlayer, setQueue } = usePlayerControls();
  const previewPlayerA = useAudioPlayer(null, PREVIEW_PLAYER_OPTIONS);
  const previewPlayerB = useAudioPlayer(null, PREVIEW_PLAYER_OPTIONS);
  const [activeFeed, setActiveFeed] = useState<'foryou' | 'following' | 'explore'>('foryou');
  const [songs, setSongs] = useState<FeedPreviewSong[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedPlayingSongId, setFeedPlayingSongId] = useState<string | null>(null);
  const [likedSongsMap, setLikedSongsMap] = useState<Record<string, boolean>>({});
  const [followedArtistsMap, setFollowedArtistsMap] = useState<Record<string, boolean>>({});

  // Track currently visible item to avoid playing the same song repeatedly
  const currentHookSongId = useRef<string | null>(null);
  const activeIndexRef = useRef(0);
  const dragSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewSlotA = useRef<PreviewSlotState>(createPreviewSlotState());
  const previewSlotB = useRef<PreviewSlotState>(createPreviewSlotState());
  const audiblePreviewSlot = useRef<PreviewSlotKey | null>(null);
  const prewarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prewarmGeneration = useRef(0);
  const transitionToken = useRef(0);
  const pendingTransitionIndex = useRef<number | null>(null);
  const fullSongTransitionActive = useRef(false);
  const isMounted = useRef(true);

  const getPreviewSlot = useCallback((slotKey: PreviewSlotKey) => {
    if (slotKey === 'a') {
      return { player: previewPlayerA, state: previewSlotA.current };
    }

    return { player: previewPlayerB, state: previewSlotB.current };
  }, [previewPlayerA, previewPlayerB]);

  const pausePreviewSlot = useCallback((slotKey: PreviewSlotKey) => {
    const { player } = getPreviewSlot(slotKey);
    setFeedPlayerMuted(player, true);
    setFeedPlayerVolume(player, 0);
    try {
      player.pause();
    } catch {
      // The managed player may already be released during teardown.
    }
    if (audiblePreviewSlot.current === slotKey) {
      audiblePreviewSlot.current = null;
      setFeedPlayingSongId(null);
    }
  }, [getPreviewSlot]);

  const resetPreviewSlot = useCallback((slotKey: PreviewSlotKey) => {
    pausePreviewSlot(slotKey);
    const { player, state } = getPreviewSlot(slotKey);
    state.token += 1;
    state.index = null;
    state.pending = null;
    state.ready = false;
    state.songId = null;

    try {
      // Pausing alone leaves the native source resident. Unloading it prevents
      // the feed stream from surviving the handoff to the full-song player.
      player.replace(null);
    } catch {
      // The managed player may already be released during teardown.
    }
  }, [getPreviewSlot, pausePreviewSlot]);

  const cancelNeighborPrewarm = useCallback(() => {
    prewarmGeneration.current += 1;
    if (prewarmTimer.current) {
      clearTimeout(prewarmTimer.current);
      prewarmTimer.current = null;
    }
  }, []);

  const stopAllPreviewPlayers = useCallback(() => {
    cancelNeighborPrewarm();
    resetPreviewSlot('a');
    resetPreviewSlot('b');
  }, [cancelNeighborPrewarm, resetPreviewSlot]);

  const stopAllPreviewPlayersAndWait = useCallback(async () => {
    stopAllPreviewPlayers();
    await waitForFeedPlayersToStop([previewPlayerA, previewPlayerB]);
  }, [previewPlayerA, previewPlayerB, stopAllPreviewPlayers]);

  const preparePreviewSlot = useCallback((slotKey: PreviewSlotKey, index: number): Promise<boolean> => {
    const song = songs[index];
    if (!song?.audio_url) return Promise.resolve(false);

    const { player, state } = getPreviewSlot(slotKey);
    if (state.index === index && state.songId === song.id) {
      if (state.ready) return Promise.resolve(true);
      if (state.pending) return state.pending;
    }

    const token = state.token + 1;
    state.index = index;
    state.pending = null;
    state.ready = false;
    state.songId = song.id;
    state.token = token;

    setFeedPlayerMuted(player, true);
    setFeedPlayerVolume(player, 0);
    try {
      player.pause();
      player.replace({ name: song.title, uri: song.audio_url });
    } catch {
      state.index = null;
      state.songId = null;
      return Promise.resolve(false);
    }

    const pending = (async () => {
      const isCurrentRequest = () => (
        isMounted.current
        && state.token === token
        && state.songId === song.id
      );
      const ready = await waitForFeedAudioReady(player, isCurrentRequest);
      if (!ready || !isCurrentRequest()) return false;

      try {
        await player.seekTo(getHookStart(song), 0, 0);
      } catch {
        // The source is still usable if a platform seek races the final load event.
      }

      if (!isCurrentRequest()) return false;
      state.ready = true;
      return true;
    })().finally(() => {
      if (state.token === token) {
        state.pending = null;
      }
    });

    state.pending = pending;
    return pending;
  }, [getPreviewSlot, songs]);

  const findPreparedSlot = useCallback((index: number): PreviewSlotKey | null => {
    if (previewSlotA.current.index === index && previewSlotA.current.ready) return 'a';
    if (previewSlotB.current.index === index && previewSlotB.current.ready) return 'b';
    return null;
  }, []);

  const selectPreviewSlot = useCallback((targetIndex: number): PreviewSlotKey => {
    const audibleSlot = audiblePreviewSlot.current;
    if (audibleSlot === 'a') return 'b';
    if (audibleSlot === 'b') return 'a';
    if (previewSlotA.current.index == null) return 'a';
    if (previewSlotB.current.index == null) return 'b';

    const distanceA = Math.abs((previewSlotA.current.index ?? targetIndex) - targetIndex);
    const distanceB = Math.abs((previewSlotB.current.index ?? targetIndex) - targetIndex);
    return distanceA >= distanceB ? 'a' : 'b';
  }, []);

  const ensurePreviewSlot = useCallback(async (index: number): Promise<PreviewSlotKey | null> => {
    if (index < 0 || index >= songs.length) return null;

    const preparedSlot = findPreparedSlot(index);
    if (preparedSlot) return preparedSlot;

    const matchingPendingSlot = previewSlotA.current.index === index
      ? 'a'
      : previewSlotB.current.index === index
        ? 'b'
        : null;
    const slotKey = matchingPendingSlot ?? selectPreviewSlot(index);
    const ready = await preparePreviewSlot(slotKey, index);
    return ready ? slotKey : null;
  }, [findPreparedSlot, preparePreviewSlot, selectPreviewSlot, songs.length]);

  const prewarmNeighbors = useCallback((index: number) => {
    const targets = [index + 1, index - 1].filter(
      (targetIndex) => targetIndex >= 0 && targetIndex < songs.length,
    );
    const availableSlots: PreviewSlotKey[] = ['a', 'b'].filter(
      (slotKey) => slotKey !== audiblePreviewSlot.current,
    ) as PreviewSlotKey[];
    const pendingTargets: number[] = [];

    targets.forEach((targetIndex) => {
      const matchingSlot = previewSlotA.current.index === targetIndex
        ? 'a'
        : previewSlotB.current.index === targetIndex
          ? 'b'
          : null;
      if (matchingSlot) {
        const availableIndex = availableSlots.indexOf(matchingSlot);
        if (availableIndex >= 0) {
          availableSlots.splice(availableIndex, 1);
        }
        return;
      }
      pendingTargets.push(targetIndex);
    });

    pendingTargets.forEach((targetIndex, targetOffset) => {
      const slotKey = availableSlots[targetOffset];
      if (slotKey) {
        void preparePreviewSlot(slotKey, targetIndex);
      }
    });
  }, [preparePreviewSlot, songs.length]);

  const queueNeighborPrewarm = useCallback((index: number) => {
    prewarmGeneration.current += 1;
    const generation = prewarmGeneration.current;
    if (prewarmTimer.current) {
      clearTimeout(prewarmTimer.current);
    }

    prewarmTimer.current = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        if (!isMounted.current || prewarmGeneration.current !== generation) return;
        prewarmNeighbors(index);
      });
    }, 180);
  }, [prewarmNeighbors]);

  const activatePreviewSlot = useCallback((slotKey: PreviewSlotKey) => {
    const previousAudibleSlot = audiblePreviewSlot.current;
    if (previousAudibleSlot && previousAudibleSlot !== slotKey) {
      pausePreviewSlot(previousAudibleSlot);
    }

    const { player } = getPreviewSlot(slotKey);
    setFeedPlayerMuted(player, false);
    setFeedPlayerVolume(player, 1);
    try {
      player.play();
      audiblePreviewSlot.current = slotKey;
      setFeedPlayingSongId(getPreviewSlot(slotKey).state.songId);
      return true;
    } catch {
      pausePreviewSlot(slotKey);
      return false;
    }
  }, [getPreviewSlot, pausePreviewSlot]);

  const transitionToIndex = useCallback(async (index: number, force = false) => {
    if (songs.length === 0) return;
    const nextIndex = Math.max(0, Math.min(songs.length - 1, index));
    const nextSong = songs[nextIndex];
    const previousIndex = activeIndexRef.current;
    activeIndexRef.current = nextIndex;
    setActiveIndex((currentIndex) => currentIndex === nextIndex ? currentIndex : nextIndex);

    if (!force && currentHookSongId.current === nextSong.id) {
      queueNeighborPrewarm(nextIndex);
      return;
    }
    if (!force && pendingTransitionIndex.current === nextIndex) {
      return;
    }

    const requestToken = transitionToken.current + 1;
    transitionToken.current = requestToken;
    pendingTransitionIndex.current = nextIndex;
    const slotKey = await ensurePreviewSlot(nextIndex);
    if (
      !slotKey
      || transitionToken.current !== requestToken
      || !isMounted.current
    ) {
      if (pendingTransitionIndex.current === nextIndex) {
        pendingTransitionIndex.current = null;
      }
      return;
    }

    const { state } = getPreviewSlot(slotKey);
    if (!state.ready || state.index !== nextIndex || state.songId !== nextSong.id) {
      if (pendingTransitionIndex.current === nextIndex) {
        pendingTransitionIndex.current = null;
      }
      return;
    }

    if (!activatePreviewSlot(slotKey)) {
      if (pendingTransitionIndex.current === nextIndex) {
        pendingTransitionIndex.current = null;
      }
      return;
    }
    currentHookSongId.current = nextSong.id;
    const swipeDirection = nextIndex >= previousIndex ? 1 : -1;
    const continuationIndex = nextIndex + swipeDirection;
    if (continuationIndex >= 0 && continuationIndex < songs.length) {
      void ensurePreviewSlot(continuationIndex);
    }

    if (pendingTransitionIndex.current === nextIndex) {
      pendingTransitionIndex.current = null;
    }
    queueNeighborPrewarm(nextIndex);
  }, [
    activatePreviewSlot,
    ensurePreviewSlot,
    getPreviewSlot,
    queueNeighborPrewarm,
    songs,
  ]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) return;
      transitionToken.current += 1;
      pendingTransitionIndex.current = null;
      stopAllPreviewPlayers();
      resetMainPlayer();
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
          activeIndexRef.current = 0;
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
  }, [user, activeFeed, resetMainPlayer, stopAllPreviewPlayers]);

  const clearDragSettleTimer = useCallback(() => {
    if (!dragSettleTimer.current) return;
    clearTimeout(dragSettleTimer.current);
    dragSettleTimer.current = null;
  }, []);

  useEffect(() => {
    if (!isFocused) {
      transitionToken.current += 1;
      pendingTransitionIndex.current = null;
      stopAllPreviewPlayers();
      currentHookSongId.current = null;
      return;
    }

    resetMainPlayer();
    if (!loading && songs.length > 0) {
      void transitionToIndex(activeIndexRef.current, true);
    }
  }, [
    isFocused,
    loading,
    resetMainPlayer,
    songs.length,
    stopAllPreviewPlayers,
    transitionToIndex,
  ]);

  useEffect(() => {
    const nearbyIndexes = [activeIndex - 1, activeIndex, activeIndex + 1, activeIndex + 2];
    nearbyIndexes.forEach((index) => {
      const coverUrl = songs[index]?.cover_url;
      if (coverUrl) {
        void Image.prefetch(coverUrl);
      }
    });
  }, [activeIndex, songs]);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      transitionToken.current += 1;
      pendingTransitionIndex.current = null;
      prewarmGeneration.current += 1;
      clearDragSettleTimer();
      if (prewarmTimer.current) {
        clearTimeout(prewarmTimer.current);
      }
      stopAllPreviewPlayers();
    };
  }, [clearDragSettleTimer, stopAllPreviewPlayers]);

  const handleMomentumScrollBegin = useCallback(() => {
    clearDragSettleTimer();
  }, [clearDragSettleTimer]);

  // Keep the native scroll path completely free of JS/audio work.
  // Audio only changes after paging has settled in one of these end callbacks.
  const handleMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    clearDragSettleTimer();
    const nextIndex = getIndexFromOffset(event.nativeEvent.contentOffset.y, itemHeight, songs.length);
    void transitionToIndex(nextIndex);
  }, [clearDragSettleTimer, itemHeight, songs.length, transitionToIndex]);

  const handleScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    clearDragSettleTimer();
    const nextIndex = getIndexFromOffset(event.nativeEvent.contentOffset.y, itemHeight, songs.length);

    dragSettleTimer.current = setTimeout(() => {
      void transitionToIndex(nextIndex);
    }, 120);
  }, [clearDragSettleTimer, itemHeight, songs.length, transitionToIndex]);

  const handlePlayFull = useCallback((item: FeedPreviewSong) => {
    if (fullSongTransitionActive.current) return;
    fullSongTransitionActive.current = true;
    transitionToken.current += 1;
    pendingTransitionIndex.current = null;
    currentHookSongId.current = null;

    let startAt = 0;
    const audibleSlot = audiblePreviewSlot.current;
    if (audibleSlot && feedPlayingSongId === item.id) {
      try {
        startAt = Math.max(0, getPreviewSlot(audibleSlot).player.currentTime);
      } catch {
        startAt = 0;
      }
    }
    void (async () => {
      try {
        await stopAllPreviewPlayersAndWait();
        setQueue([item], 0);
        await playSong(item, { startAt });
        navigation.navigate('FullscreenPlayer');
      } finally {
        fullSongTransitionActive.current = false;
      }
    })();
  }, [feedPlayingSongId, getPreviewSlot, navigation, playSong, setQueue, stopAllPreviewPlayersAndWait]);

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
    const isCurrentSong = feedPlayingSongId === item.id;
    const isSongPlaying = isActive && isCurrentSong;

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
          if (feedPlayingSongId === item.id) {
            const audibleSlot = audiblePreviewSlot.current;
            if (audibleSlot) {
              const { player } = getPreviewSlot(audibleSlot);
              if (player.playing) {
                pausePreviewSlot(audibleSlot);
              } else {
                setFeedPlayerMuted(player, false);
                setFeedPlayerVolume(player, 1);
                player.play();
                setFeedPlayingSongId(item.id);
              }
            }
          } else {
            void transitionToIndex(index, true);
          }
        }}
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
    feedPlayingSongId,
    followedArtistsMap,
    getPreviewSlot,
    handlePlayFull,
    handleToggleFollow,
    handleToggleLike,
    itemHeight,
    itemWidth,
    likedSongsMap,
    pausePreviewSlot,
    transitionToIndex,
  ]);

  const feedRenderState = useMemo(() => ({
    activeFeed,
    activeIndex,
    feedPlayingSongId,
    itemHeight,
    itemWidth,
  }), [activeFeed, activeIndex, feedPlayingSongId, itemHeight, itemWidth]);

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
        extraData={feedRenderState}
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
        windowSize={3}
        maxToRenderPerBatch={1}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
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
  followControl: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,7,16,0.84)',
    borderColor: 'rgba(168,85,247,0.72)',
    borderRadius: 999,
    borderWidth: 2,
    height: 46,
    justifyContent: 'center',
    shadowColor: theme.colors.primaryLight,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    width: 46,
  },
  followControlActive: {
    backgroundColor: 'rgba(124,58,237,0.28)',
    borderColor: theme.colors.primaryLight,
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
