import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  InteractionManager,
  Modal,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { memo, type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { useMusicPreferences } from '../lib/music-preferences-context';
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
import { usePlayerOverlay } from '../lib/player-overlay-context';
import type { FeedPreviewSong } from '../lib/types';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useI18n } from '../lib/i18n';
import { CoverArt } from '../components/YoriaxUI';

const DEFAULT_HOOK_DURATION_SECONDS = 20;

function getHookRange(song: FeedPreviewSong | null) {
  if (!song) {
    return { start: 0, end: DEFAULT_HOOK_DURATION_SECONDS };
  }

  const rawDuration = Number(song?.duration);
  const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : null;
  const rawStart = Number(song.clip.hook_start_seconds);
  const configuredStart = Number.isFinite(rawStart) ? Math.max(0, rawStart) : 0;
  const start = duration
    ? Math.min(configuredStart, Math.max(0, duration - 0.25))
    : configuredStart;
  const rawEnd = Number(song.clip.hook_end_seconds);
  const configuredEnd = Number.isFinite(rawEnd) && rawEnd > start
    ? rawEnd
    : start + DEFAULT_HOOK_DURATION_SECONDS;
  const end = duration
    ? Math.min(Math.max(start + 0.25, configuredEnd), duration)
    : Math.max(start + 0.25, configuredEnd);

  return { start, end };
}

function getHookStart(song: FeedPreviewSong | null) {
  return getHookRange(song).start;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

async function waitForFeedAudioReady(
  player: AudioPlayer,
  isCurrentRequest: () => boolean,
  expectedDuration?: number | null,
  timeoutMs = 2200,
) {
  await new Promise((resolve) => setTimeout(resolve, 96));
  const startedAt = Date.now();

  while (isCurrentRequest() && Date.now() - startedAt < timeoutMs) {
    try {
      const status = player.currentStatus;
      const durationMatches = !expectedDuration
        || expectedDuration <= 0
        || (status.duration > 0 && Math.abs(status.duration - expectedDuration) <= 3);
      if (status.isLoaded && durationMatches) return true;
    } catch {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return false;
}

async function seekFeedPlayerToHookStart(
  player: AudioPlayer,
  song: FeedPreviewSong,
  isCurrentRequest: () => boolean,
) {
  const hookStart = getHookStart(song);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!isCurrentRequest()) return false;

    try {
      await player.seekTo(hookStart, 0, 0);
    } catch {
      // A newly replaced remote source can reject the first seek while loading.
    }

    await new Promise((resolve) => setTimeout(resolve, 60 + attempt * 30));
    if (!isCurrentRequest()) return false;

    try {
      const currentTime = player.currentTime;
      if (Number.isFinite(currentTime) && Math.abs(currentTime - hookStart) <= 0.5) {
        return true;
      }
    } catch {
      return false;
    }
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
  size,
}: {
  item: FeedPreviewSong;
  size: number;
}) {
  const mediaStyle = [styles.coverImage, { width: size, height: size }];

  if (item.cover_url) {
    return <CoverArt uri={item.cover_url} size={size} radius={25} style={mediaStyle} />;
  }

  return (
    <LinearGradient
      colors={['#2a1645', '#140a24', '#09050f']}
      style={[mediaStyle, styles.fallbackCover]}
    >
      <Ionicons name="musical-notes" size={54} color={theme.colors.primaryLight} />
    </LinearGradient>
  );
}

const AnimatedCiBackdrop = memo(function AnimatedCiBackdrop() {
  const [drift] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const driftAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          duration: 7000,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          duration: 7000,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    Animated.parallel([driftAnimation, pulseAnimation]).start();

    return () => {
      driftAnimation.stop();
      pulseAnimation.stop();
    };
  }, [drift, pulse]);

  return (
    <View pointerEvents="none" style={styles.animatedBackdrop}>
      <LinearGradient
        colors={['#050505', '#10081c', '#09040f', '#050505']}
        locations={[0, 0.34, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          styles.glowOrb,
          styles.glowOrbPurple,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.48, 0.78] }),
            transform: [
              { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-42, 34] }) },
              { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [-24, 48] }) },
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }) },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(168,85,247,0.68)', 'rgba(124,58,237,0.08)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.glowOrb,
          styles.glowOrbAccent,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.38] }),
            transform: [
              { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [28, -36] }) },
              { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [44, -20] }) },
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1.08, 0.9] }) },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(45,212,191,0.5)', 'rgba(45,212,191,0.03)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.meshLineOne} />
      <View style={styles.meshLineTwo} />
      <View style={styles.backgroundVignette} />
    </View>
  );
});

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
  likeCount,
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
  likeCount: number;
  isFollowingArtist: boolean;
  showFollowButton: boolean;
  onToggleLike: (item: FeedPreviewSong) => void;
  onToggleFollow: (item: FeedPreviewSong) => void;
}) {
  const { t } = useI18n();
  const artistName = getArtistName(item);
  const coverSize = Math.max(220, Math.min(itemWidth - 64, itemHeight * 0.4, 350));
  const coverTop = Math.max(126, itemHeight * 0.14);

  return (
    <View style={[styles.feedItem, { width: itemWidth, height: itemHeight }]}>
      <View style={[styles.coverStage, { top: coverTop }]}>
        <View style={[styles.coverOrbit, { height: coverSize + 24, width: coverSize + 24 }]} />
        <View style={[styles.coverFrame, { height: coverSize, width: coverSize }]}>
          <FeedVisual item={item} size={coverSize} />
          <LinearGradient
            colors={['transparent', 'rgba(5,5,5,0.18)']}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={styles.selectionPill}>
          <View style={styles.selectionDot} />
          <Text style={styles.selectionText}>YORIAX SELECT</Text>
        </View>
      </View>

      <View style={[styles.contentContainer, { top: coverTop + coverSize + 26 }]}>
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
            <Text style={styles.fullSongText}>{t('forYou.fullSong')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.actionsContainer, { top: coverTop + coverSize - 54 }]}>
        {showFollowButton ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onToggleFollow(item)}
            accessibilityRole="button"
            accessibilityLabel={isFollowingArtist
              ? t('forYou.unfollowArtist', { artist: artistName })
              : t('forYou.followArtist', { artist: artistName })}
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
            <Text style={styles.actionText}>
              {isFollowingArtist ? t('forYou.followed') : t('forYou.follow')}
            </Text>
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
          <Text style={styles.actionText}>{likeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-social" size={32} color="white" />
          <Text style={styles.actionText}>{t('forYou.share')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}, (previous, next) => (
  previous.item.id === next.item.id
  && previous.isActive === next.isActive
  && previous.isCurrentSong === next.isCurrentSong
  && previous.isPlaying === next.isPlaying
  && previous.isLiked === next.isLiked
  && previous.likeCount === next.likeCount
  && previous.isFollowingArtist === next.isFollowingArtist
  && previous.showFollowButton === next.showFollowButton
));

const GenreFilterModal = memo(function GenreFilterModal({
  disabledGenres,
  genres,
  onClose,
  onDeselectAll,
  onSelectAll,
  onToggleGenre,
  visible,
}: {
  disabledGenres: Set<string>;
  genres: string[];
  onClose: () => void;
  onDeselectAll: () => void;
  onSelectAll: () => void;
  onToggleGenre: (genre: string) => void;
  visible: boolean;
}) {
  const { t } = useI18n();
  const activeCount = genres.filter((genre) => !disabledGenres.has(genre)).length;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.genreModalOverlay}>
        <TouchableOpacity
          activeOpacity={1}
          accessibilityLabel={t('forYou.filterClose')}
          onPress={onClose}
          style={styles.genreModalBackdrop}
        />

        <View style={styles.genreModalCard}>
          <View style={styles.genreModalHandle} />

          <View style={styles.genreModalHeader}>
            <View style={styles.genreModalHeading}>
              <Text style={styles.genreModalEyebrow}>EXPLORE FILTER</Text>
              <Text style={styles.genreModalTitle}>{t('forYou.filterGenres')}</Text>
              <Text style={styles.genreModalDescription}>{t('forYou.filterCopy')}</Text>
            </View>
            <TouchableOpacity
              accessibilityLabel={t('forYou.filterClose')}
              accessibilityRole="button"
              onPress={onClose}
              style={styles.genreModalClose}
            >
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.genreFilterSummary}>
            <Text style={styles.genreFilterSummaryText}>
              {t('forYou.filterSummary', { active: activeCount, total: genres.length })}
            </Text>
            <View style={styles.genreFilterQuickActions}>
              <TouchableOpacity onPress={onSelectAll} style={styles.genreFilterSelectAll}>
                <Text style={styles.genreFilterSelectAllText}>{t('forYou.all')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDeselectAll} style={styles.genreFilterDeselectAll}>
                <Text style={styles.genreFilterDeselectAllText}>{t('forYou.deselectAll')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.genreChipGrid}
            showsVerticalScrollIndicator={false}
            style={styles.genreScrollView}
          >
            {genres.map((genre) => {
              const isActive = !disabledGenres.has(genre);

              return (
                <TouchableOpacity
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isActive }}
                  activeOpacity={0.82}
                  key={genre}
                  onPress={() => onToggleGenre(genre)}
                  style={[
                    styles.genreChip,
                    isActive ? styles.genreChipActive : styles.genreChipInactive,
                  ]}
                >
                  <View style={[
                    styles.genreChipCheck,
                    isActive && styles.genreChipCheckActive,
                  ]}>
                    {isActive ? (
                      <Ionicons name="checkmark" size={13} color={theme.colors.background} />
                    ) : null}
                  </View>
                  <Text style={[
                    styles.genreChipText,
                    !isActive && styles.genreChipTextInactive,
                  ]}>
                    {genre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={onClose}
            style={styles.genreModalDone}
          >
            <Text style={styles.genreModalDoneText}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

type FeedEmptyStateProps = {
  eyebrow: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  message: string;
  primaryAction: () => void;
  primaryLabel: string;
  secondaryAction: (() => void) | null;
  secondaryLabel: string | null;
  title: string;
};

const FeedEmptyState = memo(function FeedEmptyState({
  eyebrow,
  icon,
  message,
  primaryAction,
  primaryLabel,
  secondaryAction,
  secondaryLabel,
  title,
}: FeedEmptyStateProps) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <Ionicons name={icon} size={28} color={theme.colors.text} />
        </View>
        <Text style={styles.emptyEyebrow}>{eyebrow}</Text>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyMessage}>{message}</Text>

        <View style={styles.emptyActions}>
          <TouchableOpacity activeOpacity={0.86} style={styles.emptyPrimaryButton} onPress={primaryAction}>
            <Text style={styles.emptyPrimaryText}>{primaryLabel}</Text>
          </TouchableOpacity>
          {secondaryLabel && secondaryAction ? (
            <TouchableOpacity activeOpacity={0.86} style={styles.emptySecondaryButton} onPress={secondaryAction}>
              <Text style={styles.emptySecondaryText}>{secondaryLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
});

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
  updateInterval: 250,
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
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { openPlayer } = usePlayerOverlay();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { revision: preferenceRevision } = useMusicPreferences();
  const { height: itemHeight, width: itemWidth } = useWindowDimensions();
  const { playSong, reset: resetMainPlayer, setQueue } = usePlayerControls();
  const previewPlayerA = useAudioPlayer(null, PREVIEW_PLAYER_OPTIONS);
  const previewPlayerB = useAudioPlayer(null, PREVIEW_PLAYER_OPTIONS);
  const [activeFeed, setActiveFeed] = useState<'foryou' | 'following' | 'explore'>('foryou');
  const [allSongs, setAllSongs] = useState<FeedPreviewSong[]>([]);
  const songsRef = useRef<FeedPreviewSong[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedPlayingSongId, setFeedPlayingSongId] = useState<string | null>(null);
  const [likedSongsMap, setLikedSongsMap] = useState<Record<string, boolean>>({});
  const [likeCountsMap, setLikeCountsMap] = useState<Record<string, number>>({});
  const [followedArtistsMap, setFollowedArtistsMap] = useState<Record<string, boolean>>({});
  const [disabledGenres, setDisabledGenres] = useState<Set<string>>(new Set());
  const [genreFilterVisible, setGenreFilterVisible] = useState(false);
  const listRef = useRef<FlatList<FeedPreviewSong>>(null);

  const availableGenres = useMemo(() => Array.from(new Set(
    allSongs
      .map((song) => song.genre?.trim())
      .filter((genre): genre is string => Boolean(genre)),
  )).sort((first, second) => first.localeCompare(second, 'de')), [allSongs]);

  const songs = useMemo(() => {
    const hasActiveFilter = activeFeed === 'explore'
      && availableGenres.some((genre) => disabledGenres.has(genre));
    if (!hasActiveFilter) return allSongs;

    return allSongs.filter((song) => {
      const genre = song.genre?.trim();
      if (!genre) return false;
      return !disabledGenres.has(genre);
    });
  }, [activeFeed, allSongs, availableGenres, disabledGenres]);

  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);

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
  const hookLoopSeekInFlight = useRef<Record<PreviewSlotKey, boolean>>({ a: false, b: false });
  const prefetchedCoverUrls = useRef(new Set<string>());
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
    if (!isFocused) return Promise.resolve(false);
    const song = songsRef.current[index];
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
      const ready = await waitForFeedAudioReady(player, isCurrentRequest, song.duration);
      if (!ready || !isCurrentRequest()) return false;

      const positionedAtHook = await seekFeedPlayerToHookStart(player, song, isCurrentRequest);
      if (!positionedAtHook || !isCurrentRequest()) return false;
      state.ready = true;
      return true;
    })().finally(() => {
      if (state.token === token) {
        state.pending = null;
      }
    });

    state.pending = pending;
    return pending;
  }, [getPreviewSlot, isFocused]);

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
    if (!isFocused) return null;
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
  }, [findPreparedSlot, isFocused, preparePreviewSlot, selectPreviewSlot, songs.length]);

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

  const activatePreviewSlot = useCallback(async (slotKey: PreviewSlotKey) => {
    if (!isFocused) return false;
    const previousAudibleSlot = audiblePreviewSlot.current;
    if (previousAudibleSlot && previousAudibleSlot !== slotKey) {
      pausePreviewSlot(previousAudibleSlot);
    }

    const { player, state } = getPreviewSlot(slotKey);
    const song = state.index == null ? null : songsRef.current[state.index];
    if (!song || state.songId !== song.id) return false;

    const token = state.token;
    setFeedPlayerMuted(player, true);
    setFeedPlayerVolume(player, 0);

    try {
      // Start silently first. AVPlayer can reset a prepared remote item to zero
      // while transitioning into active playback, so the authoritative hook seek
      // must happen after play() and before the player becomes audible.
      player.play();
    } catch {
      return false;
    }

    const positionedAtHook = await seekFeedPlayerToHookStart(
      player,
      song,
      () => (
        isMounted.current
        && state.token === token
        && state.songId === song.id
      ),
    );
    if (!positionedAtHook) {
      pausePreviewSlot(slotKey);
      return false;
    }

    if (
      !isMounted.current
      || state.token !== token
      || state.songId !== song.id
    ) {
      pausePreviewSlot(slotKey);
      return false;
    }

    audiblePreviewSlot.current = slotKey;
    setFeedPlayingSongId(state.songId);
    setFeedPlayerVolume(player, 1);
    setFeedPlayerMuted(player, false);
    return true;
  }, [getPreviewSlot, isFocused, pausePreviewSlot]);

  const transitionToIndex = useCallback(async (index: number, force = false) => {
    if (!isFocused) return;
    const currentSongs = songsRef.current;
    if (currentSongs.length === 0) return;
    const nextIndex = Math.max(0, Math.min(currentSongs.length - 1, index));
    const nextSong = currentSongs[nextIndex];
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

    const activated = await activatePreviewSlot(slotKey);
    if (
      !activated
      || transitionToken.current !== requestToken
      || !isMounted.current
    ) {
      if (activated) {
        pausePreviewSlot(slotKey);
      }
      if (pendingTransitionIndex.current === nextIndex) {
        pendingTransitionIndex.current = null;
      }
      return;
    }
    currentHookSongId.current = nextSong.id;
    const swipeDirection = nextIndex >= previousIndex ? 1 : -1;
    const continuationIndex = nextIndex + swipeDirection;
    if (continuationIndex >= 0 && continuationIndex < currentSongs.length) {
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
    isFocused,
    pausePreviewSlot,
    queueNeighborPrewarm,
  ]);

  useEffect(() => {
    const subscribeToHookBoundary = (slotKey: PreviewSlotKey, player: AudioPlayer) => (
      player.addListener('playbackStatusUpdate', (status) => {
        if (
          audiblePreviewSlot.current !== slotKey
          || !status.isLoaded
          || (!status.playing && !status.didJustFinish)
          || hookLoopSeekInFlight.current[slotKey]
        ) {
          return;
        }

        const state = slotKey === 'a' ? previewSlotA.current : previewSlotB.current;
        const song = state.index == null ? null : songsRef.current[state.index];
        if (!song || state.songId !== song.id) return;

        const { start, end } = getHookRange(song);
        const outsideHook = status.currentTime < start - 0.5
          || status.currentTime >= end - 0.05
          || status.didJustFinish;
        if (!outsideHook) return;

        const token = state.token;
        hookLoopSeekInFlight.current[slotKey] = true;
        setFeedPlayerMuted(player, true);

        void seekFeedPlayerToHookStart(
          player,
          song,
          () => (
            isMounted.current
            && audiblePreviewSlot.current === slotKey
            && state.token === token
            && state.songId === song.id
          ),
        ).then((positionedAtHook) => {
          if (
            !positionedAtHook
            || audiblePreviewSlot.current !== slotKey
            || state.token !== token
          ) {
            return;
          }

          player.play();
          setFeedPlayerMuted(player, false);
        }).finally(() => {
          hookLoopSeekInFlight.current[slotKey] = false;
        });
      })
    );

    const subscriptionA = subscribeToHookBoundary('a', previewPlayerA);
    const subscriptionB = subscribeToHookBoundary('b', previewPlayerB);

    return () => {
      subscriptionA.remove();
      subscriptionB.remove();
    };
  }, [previewPlayerA, previewPlayerB]);

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
          const initialLikeCountsMap: Record<string, number> = {};
          const initialFollowedMap: Record<string, boolean> = {};

          nextSongs.forEach(s => {
            if (s.isLiked) initialLikedMap[s.id] = true;
            initialLikeCountsMap[s.id] = s.likes_count ?? 0;
          });
          followedArtistNames.forEach((artistName) => {
            initialFollowedMap[artistName] = true;
          });

          setLikedSongsMap(initialLikedMap);
          setLikeCountsMap(initialLikeCountsMap);
          setFollowedArtistsMap(initialFollowedMap);
          currentHookSongId.current = null;
          activeIndexRef.current = 0;
          setActiveIndex(0);
          setAllSongs(nextSongs);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : t('errors.feedLoad'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [user, activeFeed, preferenceRevision, resetMainPlayer, stopAllPreviewPlayers, t]);

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
    if (!loading && songsRef.current.length > 0) {
      void transitionToIndex(activeIndexRef.current, true);
    }

    return () => {
      transitionToken.current += 1;
      pendingTransitionIndex.current = null;
      stopAllPreviewPlayers();
      currentHookSongId.current = null;
    };
  }, [
    isFocused,
    loading,
    resetMainPlayer,
    stopAllPreviewPlayers,
    transitionToIndex,
  ]);

  useEffect(() => {
    const nearbyIndexes = [activeIndex - 1, activeIndex, activeIndex + 1, activeIndex + 2];
    nearbyIndexes.forEach((index) => {
      const coverUrl = songs[index]?.cover_url;
      if (!coverUrl || prefetchedCoverUrls.current.has(coverUrl)) return;

      prefetchedCoverUrls.current.add(coverUrl);
      void Image.prefetch(coverUrl).then((loaded) => {
        if (!loaded) prefetchedCoverUrls.current.delete(coverUrl);
      }).catch(() => {
        prefetchedCoverUrls.current.delete(coverUrl);
      });
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

    void (async () => {
      try {
        await stopAllPreviewPlayersAndWait();
        setQueue([item], 0);
        await playSong(item, { startAt: 0 });
        openPlayer();
      } finally {
        fullSongTransitionActive.current = false;
      }
    })();
  }, [openPlayer, playSong, setQueue, stopAllPreviewPlayersAndWait]);

  const getItemLayout = useCallback((_: ArrayLike<FeedPreviewSong> | null | undefined, index: number) => ({
    length: itemHeight,
    offset: itemHeight * index,
    index,
  }), [itemHeight]);

  const handleToggleLike = useCallback(async (item: FeedPreviewSong) => {
    if (!user) return;
    const isCurrentlyLiked = !!likedSongsMap[item.id];
    const newStatus = !isCurrentlyLiked;
    const previousCount = likeCountsMap[item.id] ?? item.likes_count ?? 0;
    const optimisticCount = Math.max(0, previousCount + (newStatus ? 1 : -1));
    
    setLikedSongsMap(prev => ({ ...prev, [item.id]: newStatus }));
    setLikeCountsMap(prev => ({ ...prev, [item.id]: optimisticCount }));

    try {
      const confirmedStatus = await toggleLike(user.id, item.id, isCurrentlyLiked);
      const confirmedCount = await loadFeedLikeCount(item.id);

      setLikedSongsMap(prev => ({ ...prev, [item.id]: confirmedStatus }));
      setLikeCountsMap(prev => ({ ...prev, [item.id]: confirmedCount }));
    } catch {
      setLikedSongsMap(prev => ({ ...prev, [item.id]: isCurrentlyLiked }));
      setLikeCountsMap(prev => ({ ...prev, [item.id]: previousCount }));
    }
  }, [likeCountsMap, likedSongsMap, user]);

  const handleToggleFollow = useCallback(async (item: FeedPreviewSong) => {
    if (!user) return;
    const artistName = getArtistName(item);
    const isCurrentlyFollowing = !!followedArtistsMap[artistName];
    const nextStatus = !isCurrentlyFollowing;

    setFollowedArtistsMap(prev => ({ ...prev, [artistName]: nextStatus }));

    try {
      const confirmedStatus = await toggleArtistFollow(user.id, artistName, isCurrentlyFollowing);
      setFollowedArtistsMap(prev => ({ ...prev, [artistName]: confirmedStatus }));
    } catch {
      setFollowedArtistsMap(prev => ({ ...prev, [artistName]: isCurrentlyFollowing }));
    }
  }, [followedArtistsMap, user]);

  const resetExploreAfterFilterChange = useCallback(() => {
    transitionToken.current += 1;
    pendingTransitionIndex.current = null;
    currentHookSongId.current = null;
    activeIndexRef.current = 0;
    setActiveIndex(0);
    stopAllPreviewPlayers();
    listRef.current?.scrollToOffset({ animated: false, offset: 0 });
  }, [stopAllPreviewPlayers]);

  const handleToggleGenre = useCallback((genre: string) => {
    setDisabledGenres((currentGenres) => {
      const nextGenres = new Set(currentGenres);
      if (nextGenres.has(genre)) nextGenres.delete(genre);
      else nextGenres.add(genre);
      return nextGenres;
    });
    resetExploreAfterFilterChange();
  }, [resetExploreAfterFilterChange]);

  const handleSelectAllGenres = useCallback(() => {
    setDisabledGenres(new Set());
    resetExploreAfterFilterChange();
  }, [resetExploreAfterFilterChange]);

  const handleDeselectAllGenres = useCallback(() => {
    setDisabledGenres(new Set(availableGenres));
    resetExploreAfterFilterChange();
  }, [availableGenres, resetExploreAfterFilterChange]);

  const handleFeedChange = useCallback((nextFeed: 'foryou' | 'following' | 'explore') => {
    setGenreFilterVisible(false);
    setActiveFeed(nextFeed);
  }, []);

  const activeGenreCount = useMemo(
    () => availableGenres.filter((genre) => !disabledGenres.has(genre)).length,
    [availableGenres, disabledGenres],
  );

  const renderTopTabs = useCallback(() => (
    <View style={[styles.topTabs, { top: Math.max(insets.top + 10, 60) }]}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => handleFeedChange('foryou')}>
        <Text style={[styles.topTab, activeFeed === 'foryou' && styles.topTabActive]}>
          {t('forYou.forYou')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={() => handleFeedChange('following')}>
        <Text style={[styles.topTab, activeFeed === 'following' && styles.topTabActive]}>
          {t('forYou.followed')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={() => handleFeedChange('explore')}>
        <Text style={[styles.topTab, activeFeed === 'explore' && styles.topTabActive]}>
          {t('forYou.explore')}
        </Text>
      </TouchableOpacity>
    </View>
  ), [activeFeed, handleFeedChange, insets.top, t]);

  const renderExploreFilter = useCallback(() => {
    if (activeFeed !== 'explore' || availableGenres.length === 0) return null;

    return (
      <>
        <TouchableOpacity
          accessibilityLabel={t('forYou.filterLabel')}
          accessibilityRole="button"
          activeOpacity={0.84}
          onPress={() => setGenreFilterVisible(true)}
          style={[
            styles.exploreFilterButton,
            { top: Math.max(insets.top + 56, 106) },
            activeGenreCount < availableGenres.length && styles.exploreFilterButtonActive,
          ]}
        >
          <Ionicons name="options-outline" size={18} color={theme.colors.text} />
          <Text style={styles.exploreFilterButtonText}>{t('forYou.genres')}</Text>
          <View style={styles.exploreFilterCount}>
            <Text style={styles.exploreFilterCountText}>
              {activeGenreCount}/{availableGenres.length}
            </Text>
          </View>
        </TouchableOpacity>

        <GenreFilterModal
          disabledGenres={disabledGenres}
          genres={availableGenres}
          onClose={() => setGenreFilterVisible(false)}
          onDeselectAll={handleDeselectAllGenres}
          onSelectAll={handleSelectAllGenres}
          onToggleGenre={handleToggleGenre}
          visible={genreFilterVisible}
        />
      </>
    );
  }, [
    activeFeed,
    activeGenreCount,
    availableGenres,
    disabledGenres,
    genreFilterVisible,
    handleDeselectAllGenres,
    handleSelectAllGenres,
    handleToggleGenre,
    insets.top,
    t,
  ]);

  const emptyStateCopy = useMemo<FeedEmptyStateProps>(() => (
    activeFeed === 'following'
      ? {
          icon: 'people-outline' as const,
          eyebrow: t('forYou.followed'),
          title: t('forYou.followingEmptyTitle'),
          message: t('forYou.followingEmptyMessage'),
          primaryLabel: t('forYou.artistsDiscover'),
          primaryAction: () => navigation.navigate('Artists'),
          secondaryLabel: t('forYou.openExplore'),
          secondaryAction: () => handleFeedChange('explore'),
        }
      : activeFeed === 'explore'
        ? allSongs.length > 0
          ? {
              icon: 'options-outline' as const,
              eyebrow: t('forYou.exploreFilter'),
              title: t('forYou.genresEmptyTitle'),
              message: t('forYou.genresEmptyMessage'),
              primaryLabel: t('forYou.filterGenres'),
              primaryAction: () => setGenreFilterVisible(true),
              secondaryLabel: t('forYou.all'),
              secondaryAction: handleSelectAllGenres,
            }
          : {
              icon: 'compass-outline' as const,
              eyebrow: t('forYou.explore'),
              title: t('forYou.exploreEmptyTitle'),
              message: t('forYou.exploreEmptyMessage'),
              primaryLabel: t('forYou.openForYou'),
              primaryAction: () => handleFeedChange('foryou'),
              secondaryLabel: null,
              secondaryAction: null,
            }
      : {
          icon: 'sparkles-outline' as const,
          eyebrow: t('forYou.forYou'),
          title: t('forYou.forYouEmptyTitle'),
          message: t('forYou.forYouEmptyMessage'),
          primaryLabel: t('forYou.openExplore'),
          primaryAction: () => handleFeedChange('explore'),
          secondaryLabel: null,
          secondaryAction: null,
        }
  ), [activeFeed, allSongs.length, handleFeedChange, handleSelectAllGenres, navigation, t]);

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
        likeCount={likeCountsMap[item.id] ?? item.likes_count ?? 0}
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
    likeCountsMap,
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
        <AnimatedCiBackdrop />
        {renderTopTabs()}
        {renderExploreFilter()}
        <FeedEmptyState {...emptyStateCopy} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AnimatedCiBackdrop />
      {renderTopTabs()}
      {renderExploreFilter()}

      <FlatList
        ref={listRef}
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
  exploreFilterButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,7,16,0.78)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    left: 18,
    minHeight: 42,
    paddingHorizontal: 12,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    zIndex: 20,
  },
  exploreFilterButtonActive: {
    backgroundColor: 'rgba(124,58,237,0.24)',
    borderColor: 'rgba(168,85,247,0.58)',
  },
  exploreFilterButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  exploreFilterCount: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 22,
    minWidth: 38,
    paddingHorizontal: 7,
  },
  exploreFilterCountText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '900',
  },
  genreModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  genreModalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.68)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  genreModalCard: {
    backgroundColor: theme.colors.surface,
    borderColor: 'rgba(168,85,247,0.24)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    maxHeight: '82%',
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
  },
  genreModalHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    height: 5,
    marginBottom: 18,
    width: 46,
  },
  genreModalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  genreModalHeading: {
    flex: 1,
  },
  genreModalEyebrow: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.1,
    marginBottom: 7,
  },
  genreModalTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  genreModalDescription: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 7,
  },
  genreModalClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  genreFilterSummary: {
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 1,
    marginTop: 20,
    paddingBottom: 16,
  },
  genreFilterSummaryText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 12,
  },
  genreFilterQuickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  genreFilterSelectAll: {
    backgroundColor: theme.colors.text,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  genreFilterSelectAllText: {
    color: theme.colors.background,
    fontSize: 11,
    fontWeight: '900',
  },
  genreFilterDeselectAll: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  genreFilterDeselectAllText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '900',
  },
  genreScrollView: {
    marginTop: 16,
    maxHeight: 300,
  },
  genreChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    paddingBottom: 4,
  },
  genreChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  genreChipActive: {
    backgroundColor: 'rgba(124,58,237,0.22)',
    borderColor: 'rgba(168,85,247,0.5)',
  },
  genreChipInactive: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  genreChipCheck: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    borderWidth: 1,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  genreChipCheckActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primaryLight,
  },
  genreChipText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  genreChipTextInactive: {
    color: 'rgba(255,255,255,0.38)',
  },
  genreModalDone: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 50,
  },
  genreModalDoneText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
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
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  animatedBackdrop: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  glowOrb: {
    borderRadius: 999,
    overflow: 'hidden',
    position: 'absolute',
  },
  glowOrbPurple: {
    height: 430,
    right: -145,
    shadowColor: theme.colors.primaryLight,
    shadowOpacity: 0.42,
    shadowRadius: 70,
    top: 40,
    width: 430,
  },
  glowOrbAccent: {
    bottom: 20,
    height: 330,
    left: -165,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.24,
    shadowRadius: 64,
    width: 330,
  },
  meshLineOne: {
    backgroundColor: 'rgba(168,85,247,0.16)',
    height: 1,
    left: -80,
    position: 'absolute',
    right: -80,
    top: '37%',
    transform: [{ rotate: '-14deg' }],
  },
  meshLineTwo: {
    backgroundColor: 'rgba(45,212,191,0.1)',
    bottom: '25%',
    height: 1,
    left: -90,
    position: 'absolute',
    right: -90,
    transform: [{ rotate: '18deg' }],
  },
  backgroundVignette: {
    backgroundColor: 'rgba(0,0,0,0.16)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  coverStage: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 3,
  },
  coverOrbit: {
    borderColor: 'rgba(168,85,247,0.28)',
    borderRadius: 32,
    borderWidth: 1,
    position: 'absolute',
    top: -12,
    transform: [{ rotate: '3deg' }],
  },
  coverFrame: {
    backgroundColor: '#130b20',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 26,
    borderWidth: 1,
    elevation: 18,
    overflow: 'hidden',
    shadowColor: theme.colors.primaryLight,
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
  },
  coverImage: {
    borderRadius: 25,
  },
  fallbackCover: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,7,16,0.9)',
    borderColor: 'rgba(168,85,247,0.38)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    marginTop: -15,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  selectionDot: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 999,
    height: 6,
    shadowColor: theme.colors.primaryLight,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    width: 6,
  },
  selectionText: {
    color: theme.colors.text,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  contentContainer: {
    left: 22,
    position: 'absolute',
    right: 88,
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
  },
  artistName: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  songTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 30,
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
    alignItems: 'center',
    gap: 18,
    position: 'absolute',
    right: 14,
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
