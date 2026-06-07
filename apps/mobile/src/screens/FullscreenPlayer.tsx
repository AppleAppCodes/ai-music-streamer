import { Alert, ActionSheetIOS, Animated, Image, PanResponder, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { theme } from '../theme';
import { usePlayer } from '../lib/player-context';
import { useAuth } from '../lib/auth-context';
import { checkIsLiked, toggleLike } from '../lib/music-data';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { formatDuration } from '../lib/format';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'FullscreenPlayer'>;

export function FullscreenPlayer({ navigation }: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [isLiked, setIsLiked] = useState(false);
  const [likedSongId, setLikedSongId] = useState<string | null>(null);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isPlaylistModalVisible, setIsPlaylistModalVisible] = useState(false);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [translateY] = useState(() => new Animated.Value(0));
  const { 
    activeSong, currentTime, duration, isPlaying, isBuffering, isAdPlaying, toggle, 
    pause, playNext, playPrevious, isShuffling, repeatMode, toggleShuffle, toggleRepeat, seekTo
  } = usePlayer();
  const activeSongId = activeSong?.id;
  const isCurrentSongLiked = Boolean(activeSongId && likedSongId === activeSongId && isLiked);
  const repeatActive = repeatMode !== 'none';

  const resetDrag = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 24,
      bounciness: 4,
    }).start();
  }, [translateY]);

  const playerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.15,
        onPanResponderMove: (_event, gesture) => {
          translateY.setValue(Math.max(0, Math.min(gesture.dy, 190)));
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 105 || gesture.vy > 0.85) {
            navigation.goBack();
            return;
          }
          resetDrag();
        },
        onPanResponderTerminate: resetDrag,
      }),
    [navigation, resetDrag, translateY],
  );

  useEffect(() => {
    let mounted = true;
    if (user && activeSongId) {
      checkIsLiked(user.id, activeSongId).then((liked) => {
        if (mounted) {
          setLikedSongId(activeSongId);
          setIsLiked(liked);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [user, activeSongId]);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
      }
    };
  }, []);

  const handleLike = async () => {
    if (!user || !activeSong || isLikeLoading) return;
    const songId = activeSong.id;
    const previousStatus = isCurrentSongLiked;

    setLikedSongId(songId);
    setIsLiked(!previousStatus);
    setIsLikeLoading(true);

    try {
      const newStatus = await toggleLike(user.id, songId, previousStatus);
      setLikedSongId(songId);
      setIsLiked(newStatus);
    } catch (e) {
      console.error(e);
      setLikedSongId(songId);
      setIsLiked(previousStatus);
    } finally {
      setIsLikeLoading(false);
    }
  };

  const handleSongDetails = () => {
    if (!activeSong) return;
    Alert.alert(
      activeSong.title,
      [
        activeSong.artist_name || activeSong.creatorName || 'Creator',
        activeSong.genre ? `Genre: ${activeSong.genre}` : null,
        duration ? `Dauer: ${formatDuration(duration)}` : null,
        `Streams: ${activeSong.plays.toLocaleString('de-DE')}`,
      ].filter(Boolean).join('\n'),
    );
  };

  const handleShareSong = () => {
    if (!activeSong) return;
    void Share.share({
      message: `Hoer ${activeSong.title} auf YORIAX: https://www.yoriax.com/song/${activeSong.id}`,
      title: activeSong.title,
    });
  };

  const scheduleSleepTimer = (minutes: number) => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
    }
    sleepTimerRef.current = setTimeout(() => {
      pause();
      sleepTimerRef.current = null;
    }, minutes * 60 * 1000);
    Alert.alert('Sleeptimer aktiv', `Die Wiedergabe stoppt in ${minutes} Minuten.`);
  };

  const handleSleepTimer = () => {
    const options = ['Abbrechen', '5 Minuten', '10 Minuten', '15 Minuten', '30 Minuten', 'Timer löschen'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, destructiveButtonIndex: 5 },
        (buttonIndex) => {
          if (buttonIndex >= 1 && buttonIndex <= 4) {
            scheduleSleepTimer([5, 10, 15, 30][buttonIndex - 1]);
          }
          if (buttonIndex === 5 && sleepTimerRef.current) {
            clearTimeout(sleepTimerRef.current);
            sleepTimerRef.current = null;
          }
        },
      );
      return;
    }

    Alert.alert('Sleeptimer', undefined, [
      { text: '5 Minuten', onPress: () => scheduleSleepTimer(5) },
      { text: '10 Minuten', onPress: () => scheduleSleepTimer(10) },
      { text: '15 Minuten', onPress: () => scheduleSleepTimer(15) },
      { text: '30 Minuten', onPress: () => scheduleSleepTimer(30) },
      {
        text: 'Timer löschen',
        style: 'destructive',
        onPress: () => {
          if (sleepTimerRef.current) {
            clearTimeout(sleepTimerRef.current);
            sleepTimerRef.current = null;
          }
        },
      },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  };

  const handleContextMenu = () => {
    const options = ['Abbrechen', 'Song-Details', 'Sleeptimer', 'Teilen'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0 },
        (buttonIndex) => {
          if (buttonIndex === 1) handleSongDetails();
          if (buttonIndex === 2) handleSleepTimer();
          if (buttonIndex === 3) handleShareSong();
        }
      );
    } else {
      Alert.alert('Optionen', undefined, [
        { text: 'Song-Details', onPress: handleSongDetails },
        { text: 'Sleeptimer', onPress: handleSleepTimer },
        { text: 'Teilen', onPress: handleShareSong },
        { text: 'Abbrechen', style: 'cancel' }
      ]);
    }
  };

  if (!activeSong) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="chevron-down" size={32} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Kein Song aktiv</Text>
      </View>
    );
  }

  const timeRemaining = Math.max(0, duration - currentTime);

  return (
    <View style={styles.container}>
      {activeSong.cover_url && (
        <View style={StyleSheet.absoluteFill}>
          <Image source={{ uri: activeSong.cover_url }} style={StyleSheet.absoluteFill} blurRadius={10} alt="" />
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(12,10,18,0.4)', 'rgba(12,10,18,0.8)', '#0c0a12']}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <Animated.View
        style={[styles.foreground, { transform: [{ translateY }] }]}
        {...playerPanResponder.panHandlers}
      >
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton} hitSlop={10}>
          <Ionicons name="chevron-down" size={32} color={theme.colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleContextMenu} style={styles.menuButton} hitSlop={10}>
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeSong.cover_url ? (
          <Image source={{ uri: activeSong.cover_url }} style={styles.cover} alt="" />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <Text style={styles.coverFallbackText}>Y</Text>
          </View>
        )}

        <View style={styles.infoContainer}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextContainer}>
              <Text style={styles.title} numberOfLines={1}>{activeSong.title}</Text>
              <TouchableOpacity onPress={() => {
                navigation.goBack();
                setTimeout(() => {
	                navigation.navigate('Artist', {
	                    artistId: activeSong.artist_name || activeSong.creatorName || activeSong.creator_id || 'unknown'
	                  });
                }, 300);
              }}>
                <Text style={styles.artist} numberOfLines={1}>
                  {activeSong.artist_name || activeSong.creatorName || 'Creator'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setIsPlaylistModalVisible(true)}
                hitSlop={10}
                disabled={isAdPlaying}
              >
                <Ionicons name="add-circle-outline" size={28} color={isAdPlaying ? theme.colors.muted : theme.colors.text} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.likeButton}
                onPress={() => { void handleLike(); }}
                disabled={isLikeLoading || isAdPlaying}
                hitSlop={12}
              >
                <Ionicons 
	                  name={isCurrentSongLiked ? "heart" : "heart-outline"}
                  size={28} 
	                  color={isAdPlaying ? theme.colors.muted : isCurrentSongLiked ? theme.colors.primary : theme.colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration > 0 ? duration : 1}
            value={currentTime}
            minimumTrackTintColor={theme.colors.text}
            maximumTrackTintColor="rgba(255,255,255,0.2)"
            thumbTintColor={theme.colors.text}
            onSlidingComplete={(val) => { if (!isAdPlaying) void seekTo(val); }}
            disabled={isAdPlaying}
          />
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatDuration(currentTime)}</Text>
            <Text style={styles.timeText}>-{formatDuration(timeRemaining)}</Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity onPress={toggleShuffle} style={styles.secondaryControlButton}>
            <Ionicons name="shuffle" size={24} color={isShuffling ? theme.colors.primary : theme.colors.muted} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => playPrevious()} style={styles.controlButton} disabled={isAdPlaying}>
            <Ionicons name="play-skip-back" size={36} color={isAdPlaying ? theme.colors.muted : theme.colors.text} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={toggle} style={styles.playButton}>
            <Ionicons name={isBuffering ? "ellipsis-horizontal" : isPlaying ? "pause" : "play"} size={36} color="#000" style={{ marginLeft: isPlaying || isBuffering ? 0 : 4 }} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => playNext()} style={styles.controlButton} disabled={isAdPlaying}>
            <Ionicons name="play-skip-forward" size={36} color={isAdPlaying ? theme.colors.muted : theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleRepeat}
            style={styles.secondaryControlButton}
            accessibilityLabel={repeatMode === 'one' ? 'Aktuellen Song wiederholen' : repeatMode === 'all' ? 'Playlist wiederholen' : 'Wiederholung aus'}
          >
            <View style={styles.repeatIconWrap}>
              <Ionicons name="repeat" size={24} color={repeatActive ? theme.colors.text : theme.colors.muted} />
              {repeatMode === 'one' ? (
                <View style={styles.repeatOneBadge}>
                  <Text style={styles.repeatOneText}>1</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
        
        <View style={styles.bottomControlsRow}>
          <TouchableOpacity onPress={handleShareSong} style={styles.secondaryControlButton}>
            <Ionicons name="share-social-outline" size={24} color={theme.colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleContextMenu} style={styles.secondaryControlButton}>
            <Ionicons name="list-outline" size={26} color={theme.colors.muted} />
          </TouchableOpacity>
        </View>
        
      </View>
      </Animated.View>
      <AddToPlaylistModal 
        visible={isPlaylistModalVisible} 
        songId={activeSong.id} 
        onClose={() => setIsPlaylistModalVisible(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  foreground: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    padding: 8,
  },
  menuButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingBottom: 50,
    alignItems: 'center',
  },
  cover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceMuted,
    marginTop: 20,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFallbackText: {
    color: theme.colors.text,
    fontSize: 80,
    fontWeight: '900',
  },
  infoContainer: {
    width: '100%',
    marginBottom: 30,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleTextContainer: {
    flex: 1,
    paddingRight: 20,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 4,
  },
  artist: {
    color: theme.colors.muted,
    fontSize: 18,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  likeButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 30,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
  },
  controlButton: {
    padding: 10,
  },
  secondaryControlButton: {
    padding: 10,
  },
  repeatIconWrap: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  repeatOneBadge: {
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderColor: '#0c0a12',
    borderRadius: 7,
    borderWidth: 1,
    height: 14,
    justifyContent: 'center',
    position: 'absolute',
    right: -3,
    top: -4,
    width: 14,
  },
  repeatOneText: {
    color: '#050505',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 10,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
});
