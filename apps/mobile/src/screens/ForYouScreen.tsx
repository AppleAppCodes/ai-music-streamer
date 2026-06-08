import { ActivityIndicator, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View, ViewToken } from 'react-native';
import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { useAuth } from '../lib/auth-context';
import { loadFeedPreview } from '../lib/music-data';
import { usePlayer } from '../lib/player-context';
import type { FeedPreviewSong } from '../lib/types';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 70,
};

function getHookStart(song: FeedPreviewSong | null) {
  return Math.max(0, song?.clip?.hook_start_seconds ?? 0);
}

function FeedVisual({ item, active }: { item: FeedPreviewSong; active: boolean }) {
  const videoUrl = item.clip?.video_url?.trim() || null;
  const videoPlayer = useVideoPlayer(videoUrl ? { uri: videoUrl } : null, (player) => {
    player.loop = true;
    player.muted = true;
  });

  useEffect(() => {
    if (!videoUrl) return;

    if (active) {
      videoPlayer.play();
    } else {
      videoPlayer.pause();
    }

    return () => {
      videoPlayer.pause();
    };
  }, [active, videoPlayer, videoUrl]);

  if (videoUrl) {
    return (
      <VideoView
        player={videoPlayer}
        style={styles.coverImage}
        contentFit="cover"
        nativeControls={false}
        playsInline
        surfaceType="textureView"
      />
    );
  }

  if (item.cover_url) {
    return <Image source={{ uri: item.cover_url }} style={styles.coverImage} resizeMode="cover" alt="" />;
  }

  return <View style={[styles.coverImage, styles.fallbackCover]} />;
}

const FeedItem = memo(function FeedItem({
  item,
  isActive,
  isPlaying,
  onPlayFull,
  onTogglePlay,
  onStartHook
}: {
  item: FeedPreviewSong;
  isActive: boolean;
  isPlaying: boolean;
  onPlayFull: (item: FeedPreviewSong) => void;
  onTogglePlay: () => void;
  onStartHook: (item: FeedPreviewSong, force: boolean) => void;
}) {
  return (
    <View style={styles.feedItem}>
      <FeedVisual item={item} active={isActive} />

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
          onPress={() => {
            if (isActive) {
              onTogglePlay();
            } else {
              onStartHook(item, true);
            }
          }}
        >
          <Ionicons name={isActive && isPlaying ? "pause-circle" : "play-circle"} size={44} color="white" />
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
});

export function ForYouScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { activeSong, isPlaying, playSong, toggle, setQueue } = usePlayer();
  const [songs, setSongs] = useState<FeedPreviewSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track currently visible item to avoid playing the same song repeatedly
  const currentVisibleId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) return;
      setLoading(true);
      setError(null);

      try {
        const nextSongs = await loadFeedPreview(user.id);
        if (mounted) {
          currentVisibleId.current = null;
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
    if (!force && currentVisibleId.current === song.id && activeSong?.id === song.id) return;
    currentVisibleId.current = song.id;

    setQueue([song], 0);
    void playSong(song, { startAt: getHookStart(song) });
  }, [activeSong?.id, playSong, setQueue]);

  useEffect(() => {
    if (loading || songs.length === 0 || currentVisibleId.current) return;
    startHookPlayback(songs[0]);
  }, [loading, songs, startHookPlayback]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visibleItem = viewableItems
      .filter((item) => item.isViewable)
      .sort((first, second) => (first.index ?? 0) - (second.index ?? 0))[0];

    if (visibleItem?.item) {
      startHookPlayback(visibleItem.item as FeedPreviewSong);
    }
  }, [startHookPlayback]);

  // We want to pause when leaving the ForYou tab?
  // Usually TikTok pauses when you go to another tab, but for a music app maybe not.
  // We'll leave it playing for now.

  const handlePlayFull = useCallback((item: FeedPreviewSong) => {
    setQueue([item], 0);
    void playSong(item);
    navigation.navigate('FullscreenPlayer');
  }, [setQueue, playSong, navigation]);

  const renderItem = useCallback(({ item }: { item: FeedPreviewSong }) => {
    const isActive = activeSong?.id === item.id;
    return (
      <FeedItem
        item={item}
        isActive={isActive}
        isPlaying={isActive ? isPlaying : false}
        onPlayFull={handlePlayFull}
        onTogglePlay={toggle}
        onStartHook={startHookPlayback}
      />
    );
  }, [activeSong?.id, isPlaying, handlePlayFull, toggle, startHookPlayback]);

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
      <View style={styles.topTabs}>
        <Text style={[styles.topTab, styles.topTabActive]}>Für dich</Text>
        <Text style={styles.topTab}>Gefolgt</Text>
        <Text style={styles.topTab}>Explore</Text>
      </View>

      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        initialNumToRender={2}
        windowSize={3}
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
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#140c23',
    justifyContent: 'flex-end', // content at bottom
  },
  coverImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
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
