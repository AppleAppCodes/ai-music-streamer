import {
  ActionSheetIOS,
  Alert,
  Animated as RNAnimated,
  Easing as RNEasing,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated, {
  Easing as ReanimatedEasing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { usePlayer } from '../lib/player-context';
import { useAuth } from '../lib/auth-context';
import { checkIsLiked, toggleLike } from '../lib/music-data';
import { RootStackParamList } from '../navigation/types';
import { formatDuration } from '../lib/format';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { MINI_PLAYER_LAYOUT, MINI_PLAYER_RADIUS, MiniPlayerPreview } from '../components/MiniPlayer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { Image } from 'expo-image';

export function FullscreenPlayer({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const [isLiked, setIsLiked] = useState(false);
  const [likedSongId, setLikedSongId] = useState<string | null>(null);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isPlaylistModalVisible, setIsPlaylistModalVisible] = useState(false);
  const [seekPreviewTime, setSeekPreviewTime] = useState<number | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const morphProgress = useSharedValue(0);
  const saveButtonScale = useRef(new RNAnimated.Value(1)).current;
  const [saveToastAnimation] = useState(() => new RNAnimated.Value(0));
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const [saveToastSongId, setSaveToastSongId] = useState<string | null>(null);
  const { 
    activeSong, currentTime, duration, isPlaying, isBuffering, isAdPlaying, toggle, 
    pause, playNext, playPrevious, isShuffling, repeatMode, toggleShuffle, toggleRepeat, seekTo
  } = usePlayer();
  const activeSongId = activeSong?.id;
  const isCurrentSongLiked = Boolean(activeSongId && likedSongId === activeSongId && isLiked);
  const repeatActive = repeatMode !== 'none';
  const miniPlayerTop = screenHeight - MINI_PLAYER_LAYOUT.bottom - MINI_PLAYER_LAYOUT.height;
  const morphDistance = Math.max(1, miniPlayerTop);
  const miniPlayerWidth = Math.max(1, screenWidth - MINI_PLAYER_LAYOUT.horizontalInset * 2);
  const miniScaleX = miniPlayerWidth / Math.max(1, screenWidth);
  const miniScaleY = MINI_PLAYER_LAYOUT.height / Math.max(1, screenHeight);
  const miniSurfaceRadius = MINI_PLAYER_RADIUS / Math.max(0.001, miniScaleY);
  const miniCenterOffsetY = miniPlayerTop + MINI_PLAYER_LAYOUT.height / 2 - screenHeight / 2;
  const finishDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    morphProgress.value = 0;
    morphProgress.value = withTiming(1, {
      duration: 420,
      easing: ReanimatedEasing.bezier(0.18, 0.92, 0.18, 1),
    });

    return () => {
      cancelAnimation(morphProgress);
    };
  }, [morphProgress]);

  const resetDrag = useCallback(() => {
    morphProgress.value = withSpring(1, {
      damping: 24,
      mass: 0.86,
      stiffness: 270,
    });
  }, [morphProgress]);

  const dismissPlayer = useCallback((velocity = 0) => {
    const duration = Math.max(210, Math.min(330, 300 - Math.max(0, velocity) * 22));

    morphProgress.value = withTiming(0, {
      duration,
      easing: ReanimatedEasing.bezier(0.22, 1, 0.36, 1),
    }, (finished) => {
      if (finished) runOnJS(finishDismiss)();
    });
  }, [finishDismiss, morphProgress]);

  const playerPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(6)
        .failOffsetX([-36, 36])
        .onUpdate((event) => {
          if (event.translationY <= 0) return;

          morphProgress.value = Math.max(0, Math.min(1, 1 - event.translationY / morphDistance));
        })
        .onEnd((event) => {
          const projectedDistance = event.translationY + Math.max(0, event.velocityY) * 0.18;

          if (projectedDistance > morphDistance * 0.3 || event.velocityY > 1050) {
            const duration = Math.max(145, Math.min(235, 235 - Math.max(0, event.velocityY) * 0.025));
            morphProgress.value = withTiming(0, {
              duration,
              easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
            }, (finished) => {
              if (finished) runOnJS(finishDismiss)();
            });
            return;
          }

          morphProgress.value = withSpring(1, {
            damping: 25,
            mass: 0.86,
            stiffness: 285,
            velocity: -event.velocityY / Math.max(1, morphDistance),
          });
        })
        .onFinalize((_event, success) => {
          if (!success && morphProgress.value > 0 && morphProgress.value < 1) {
            morphProgress.value = withSpring(1, {
              damping: 25,
              mass: 0.86,
              stiffness: 285,
            });
          }
        }),
    [finishDismiss, morphDistance, morphProgress],
  );

  const playerSurfaceStyle = useAnimatedStyle(() => {
    const progress = morphProgress.value;
    const baseScaleX = interpolate(progress, [0, 1], [miniScaleX, 1]);
    const baseScaleY = interpolate(progress, [0, 1], [miniScaleY, 1]);

    return {
      opacity: interpolate(progress, [0, 0.18, 0.46, 1], [0, 0, 0.5, 1]),
      borderRadius: interpolate(progress, [0, 0.18, 0.58, 1], [miniSurfaceRadius, Math.min(miniSurfaceRadius, 440), 74, 0]),
      transform: [
        {
          translateY: interpolate(progress, [0, 1], [miniCenterOffsetY, 0]),
        },
        {
          scaleX: baseScaleX,
        },
        {
          scaleY: baseScaleY,
        },
      ],
    };
  }, [miniCenterOffsetY, miniScaleX, miniScaleY, miniSurfaceRadius]);

  const artworkBackdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morphProgress.value, [0, 0.42, 0.78, 1], [0, 0.18, 0.72, 1]),
  }), []);

  const expandedContentAnimatedStyle = useAnimatedStyle(() => {
    const progress = morphProgress.value;
    const currentScaleX = interpolate(progress, [0, 1], [miniScaleX, 1]);
    const currentScaleY = interpolate(progress, [0, 1], [miniScaleY, 1]);

    return {
      opacity: interpolate(progress, [0, 0.46, 0.76, 1], [0, 0, 0.9, 1]),
      transform: [
        {
          scaleX: 1 / Math.max(0.001, currentScaleX),
        },
        {
          scaleY: 1 / Math.max(0.001, currentScaleY),
        },
        {
          translateY: interpolate(progress, [0.5, 1], [18, 0]),
        },
      ],
    };
  }, [miniScaleX, miniScaleY]);

  const morphVeilAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morphProgress.value, [0, 0.16, 0.42, 1], [0, 0.07, 0.03, 0]),
  }), []);

  const miniSnapshotAnimatedStyle = useAnimatedStyle(() => {
    const morphScale = interpolate(morphProgress.value, [0, 0.2, 0.56], [1, 1, 0.965]);

    return {
      opacity: interpolate(morphProgress.value, [0, 0.3, 0.6], [1, 1, 0]),
      transform: [
        {
          scale: morphScale,
        },
      ],
    };
  }, []);

  const dockBubbleAnimatedStyle = useAnimatedStyle(() => {
    const progress = morphProgress.value;

    return {
      opacity: interpolate(progress, [0, 0.1, 0.28, 0.56], [0, 0.24, 0.16, 0]),
    };
  }, []);

  const animateSaveButton = useCallback(() => {
    saveButtonScale.stopAnimation();
    RNAnimated.sequence([
      RNAnimated.timing(saveButtonScale, {
        duration: 90,
        easing: RNEasing.out(RNEasing.quad),
        toValue: 0.84,
        useNativeDriver: true,
      }),
      RNAnimated.spring(saveButtonScale, {
        damping: 8,
        stiffness: 420,
        toValue: 1.08,
        useNativeDriver: true,
      }),
      RNAnimated.spring(saveButtonScale, {
        damping: 10,
        stiffness: 360,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [saveButtonScale]);

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
      if (saveToastTimerRef.current) {
        clearTimeout(saveToastTimerRef.current);
      }
      if (seekPreviewTimerRef.current) {
        clearTimeout(seekPreviewTimerRef.current);
      }
    };
  }, []);

  const handleSeekStart = useCallback(() => {
    if (isAdPlaying) return;
    if (seekPreviewTimerRef.current) {
      clearTimeout(seekPreviewTimerRef.current);
      seekPreviewTimerRef.current = null;
    }
    setSeekPreviewTime(currentTime);
  }, [currentTime, isAdPlaying]);

  const handleSeekChange = useCallback((value: number) => {
    if (isAdPlaying) return;
    setSeekPreviewTime(value);
  }, [isAdPlaying]);

  const handleSeekComplete = useCallback((value: number) => {
    if (isAdPlaying) return;
    if (seekPreviewTimerRef.current) {
      clearTimeout(seekPreviewTimerRef.current);
      seekPreviewTimerRef.current = null;
    }

    setSeekPreviewTime(value);
    void seekTo(value).finally(() => {
      seekPreviewTimerRef.current = setTimeout(() => {
        setSeekPreviewTime(null);
        seekPreviewTimerRef.current = null;
      }, 360);
    });
  }, [isAdPlaying, seekTo]);

  const toggleLikedStatus = useCallback(async (): Promise<boolean> => {
    if (!user || !activeSong || isLikeLoading) return isCurrentSongLiked;
    const songId = activeSong.id;
    const previousStatus = isCurrentSongLiked;

    setLikedSongId(songId);
    setIsLiked(!previousStatus);
    setIsLikeLoading(true);

    try {
      const newStatus = await toggleLike(user.id, songId, previousStatus);
      setLikedSongId(songId);
      setIsLiked(newStatus);
      return newStatus;
    } catch (e) {
      console.error(e);
      setLikedSongId(songId);
      setIsLiked(previousStatus);
      return previousStatus;
    } finally {
      setIsLikeLoading(false);
    }
  }, [activeSong, isCurrentSongLiked, isLikeLoading, user]);

  const hideSaveToast = useCallback(() => {
    if (saveToastTimerRef.current) {
      clearTimeout(saveToastTimerRef.current);
      saveToastTimerRef.current = null;
    }

    RNAnimated.timing(saveToastAnimation, {
      duration: 170,
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setSaveToastVisible(false);
    });
  }, [saveToastAnimation]);

  const showSaveToast = useCallback((songId: string) => {
    if (saveToastTimerRef.current) {
      clearTimeout(saveToastTimerRef.current);
    }

    setSaveToastSongId(songId);
    setSaveToastVisible(true);
    saveToastAnimation.stopAnimation();
    saveToastAnimation.setValue(0);
    RNAnimated.spring(saveToastAnimation, {
      bounciness: 5,
      speed: 22,
      toValue: 1,
      useNativeDriver: true,
    }).start();

    saveToastTimerRef.current = setTimeout(hideSaveToast, 3200);
  }, [hideSaveToast, saveToastAnimation]);

  const handleSavePress = useCallback(async () => {
    if (!user || !activeSong || isLikeLoading || isAdPlaying) return;
    animateSaveButton();

    if (isCurrentSongLiked) {
      setIsPlaylistModalVisible(true);
      return;
    }

    const nextStatus = await toggleLikedStatus();
    if (nextStatus) showSaveToast(activeSong.id);
  }, [
    activeSong,
    animateSaveButton,
    isAdPlaying,
    isCurrentSongLiked,
    isLikeLoading,
    showSaveToast,
    toggleLikedStatus,
    user,
  ]);

  const handleToastChange = useCallback(() => {
    hideSaveToast();
    setIsPlaylistModalVisible(true);
  }, [hideSaveToast]);

  const handleSongDetails = () => {
    if (!activeSong) return;
    Alert.alert(
      activeSong.title,
      [
        activeSong.artist_name || activeSong.creatorName || t('common.creator'),
        activeSong.genre ? `Genre: ${activeSong.genre}` : null,
        duration ? t('player.duration', { duration: formatDuration(duration) }) : null,
        `${t('common.streams')}: ${activeSong.plays.toLocaleString(locale === 'de' ? 'de-DE' : 'en-US')}`,
      ].filter(Boolean).join('\n'),
    );
  };

  const handleShareSong = () => {
    if (!activeSong) return;
    const url = `https://www.yoriax.com/song/${activeSong.id}`;
    void Share.share({
      message: url,
      title: activeSong.title,
      url,
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
    Alert.alert(
      t('player.sleepTimerActive'),
      t('player.sleepTimerActiveCopy', { minutes }),
    );
  };

  const handleSleepTimer = () => {
    const minuteLabel = (minutes: number) => locale === 'de' ? `${minutes} Minuten` : `${minutes} minutes`;
    const options = [
      t('common.cancel'),
      minuteLabel(5),
      minuteLabel(10),
      minuteLabel(15),
      minuteLabel(30),
      t('player.timerDelete'),
    ];
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

    Alert.alert(t('player.sleepTimer'), undefined, [
      { text: minuteLabel(5), onPress: () => scheduleSleepTimer(5) },
      { text: minuteLabel(10), onPress: () => scheduleSleepTimer(10) },
      { text: minuteLabel(15), onPress: () => scheduleSleepTimer(15) },
      { text: minuteLabel(30), onPress: () => scheduleSleepTimer(30) },
      {
        text: t('player.timerDelete'),
        style: 'destructive',
        onPress: () => {
          if (sleepTimerRef.current) {
            clearTimeout(sleepTimerRef.current);
            sleepTimerRef.current = null;
          }
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const handleContextMenu = () => {
    const options = [
      t('common.cancel'),
      t('player.details'),
      t('player.sleepTimer'),
      t('player.share'),
    ];
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
      Alert.alert(t('player.options'), undefined, [
        { text: t('player.details'), onPress: handleSongDetails },
        { text: t('player.sleepTimer'), onPress: handleSleepTimer },
        { text: t('player.share'), onPress: handleShareSong },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }
  };

  if (!activeSong) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="chevron-down" size={32} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('player.noSong')}</Text>
      </View>
    );
  }

  const displayedTime = seekPreviewTime ?? currentTime;
  const timeRemaining = Math.max(0, duration - displayedTime);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <GestureDetector gesture={playerPanGesture}>
        <Animated.View style={[styles.playerSurface, playerSurfaceStyle]}>
      <LinearGradient
        colors={['#160a24', '#090712', '#050506']}
        locations={[0, 0.54, 1]}
        style={StyleSheet.absoluteFill}
      />
      {activeSong.cover_url && (
        <Animated.View style={[StyleSheet.absoluteFill, artworkBackdropAnimatedStyle]}>
          <Image 
            source={{ uri: activeSong.cover_url }} 
            style={StyleSheet.absoluteFill} 
            blurRadius={24}
            cachePolicy="memory-disk"
            transition={300}
            alt="" 
          />
          <LinearGradient
            colors={['rgba(12,10,18,0.2)', 'rgba(12,10,18,0.56)', 'rgba(12,10,18,0.92)']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      <Animated.View style={[styles.expandedContent, expandedContentAnimatedStyle]}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity onPress={() => dismissPlayer()} style={styles.closeButton} hitSlop={10}>
            <Ionicons name="chevron-down" size={32} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleContextMenu} style={styles.menuButton} hitSlop={10}>
            <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
        {activeSong.cover_url ? (
          <Image source={{ uri: activeSong.cover_url }} style={styles.cover} cachePolicy="memory-disk" transition={200} alt="" />
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
                onClose();
                setTimeout(() => {
                  navigation.navigate('Artist', {
                    artistId: activeSong.artist_name || activeSong.creatorName || activeSong.creator_id || 'unknown',
                  });
                }, 300);
              }}>
                <Text style={styles.artist} numberOfLines={1}>
                  {activeSong.artist_name || activeSong.creatorName || t('common.creator')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionButtons}>
              <RNAnimated.View style={{ transform: [{ scale: saveButtonScale }] }}>
                <TouchableOpacity
                  accessibilityLabel={isCurrentSongLiked ? t('player.changeDestinations') : t('player.addToFavorites')}
                  accessibilityRole="button"
                  activeOpacity={0.82}
                  style={[
                    styles.saveButton,
                    isCurrentSongLiked && styles.saveButtonActive,
                  ]}
                  onPress={() => { void handleSavePress(); }}
                  disabled={isLikeLoading || isAdPlaying}
                  hitSlop={12}
                >
                  <Ionicons
                    name={isCurrentSongLiked ? 'checkmark' : 'add'}
                    size={isCurrentSongLiked ? 16 : 17}
                    color={isAdPlaying ? theme.colors.muted : isCurrentSongLiked ? theme.colors.primaryLight : 'rgba(255,255,255,0.6)'}
                  />
                </TouchableOpacity>
              </RNAnimated.View>
            </View>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration > 0 ? duration : 1}
            value={displayedTime}
            minimumTrackTintColor={theme.colors.text}
            maximumTrackTintColor="rgba(255,255,255,0.2)"
            thumbTintColor={theme.colors.text}
            onSlidingStart={handleSeekStart}
            onValueChange={handleSeekChange}
            onSlidingComplete={handleSeekComplete}
            disabled={isAdPlaying}
          />
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatDuration(displayedTime)}</Text>
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
            accessibilityLabel={repeatMode === 'one'
              ? t('player.repeatOne')
              : repeatMode === 'all'
                ? t('player.repeatAll')
                : t('player.repeatNone')}
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

      <Animated.View
        pointerEvents="none"
        style={[styles.morphVeil, morphVeilAnimatedStyle]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)']}
          locations={[0, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.morphVeilGlow} />
      </Animated.View>
        </Animated.View>
      </GestureDetector>

      <Animated.View
        pointerEvents="none"
        style={[styles.miniSnapshot, miniSnapshotAnimatedStyle]}
      >
        <MiniPlayerPreview interactive={false} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.dockBubble, dockBubbleAnimatedStyle]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {saveToastVisible && saveToastSongId === activeSong.id ? (
        <RNAnimated.View
          pointerEvents="box-none"
          style={[
            styles.saveToastContainer,
            {
              bottom: insets.bottom + 24,
              opacity: saveToastAnimation,
              transform: [{
                translateY: saveToastAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              }],
            },
          ]}
        >
          <View style={styles.saveToast}>
            <View style={styles.saveToastIcon}>
              <Ionicons name="heart" size={16} color={theme.colors.text} />
            </View>
            <Text style={styles.saveToastText} numberOfLines={1}>
              {t('player.addedToFavorites')}
            </Text>
            <TouchableOpacity activeOpacity={0.78} onPress={handleToastChange} hitSlop={8}>
              <Text style={styles.saveToastAction}>{t('common.change')}</Text>
            </TouchableOpacity>
          </View>
        </RNAnimated.View>
      ) : null}

      <AddToPlaylistModal 
        visible={isPlaylistModalVisible} 
        songId={activeSong.id} 
        isLiked={isCurrentSongLiked}
        onClose={() => setIsPlaylistModalVisible(false)}
        onToggleLiked={toggleLikedStatus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    bottom: 0,
    backgroundColor: 'transparent',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
  },
  playerSurface: {
    backgroundColor: theme.colors.background,
    bottom: 0,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.42,
    shadowRadius: 34,
    top: 0,
    zIndex: 1,
  },
  miniSnapshot: {
    borderColor: theme.colors.borderStrong,
    borderRadius: MINI_PLAYER_RADIUS,
    borderWidth: 1,
    bottom: MINI_PLAYER_LAYOUT.bottom,
    height: MINI_PLAYER_LAYOUT.height,
    left: MINI_PLAYER_LAYOUT.horizontalInset,
    overflow: 'hidden',
    position: 'absolute',
    right: MINI_PLAYER_LAYOUT.horizontalInset,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    zIndex: 2,
  },
  dockBubble: {
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: MINI_PLAYER_RADIUS,
    borderWidth: 1,
    bottom: MINI_PLAYER_LAYOUT.bottom,
    height: MINI_PLAYER_LAYOUT.height,
    left: MINI_PLAYER_LAYOUT.horizontalInset,
    overflow: 'hidden',
    position: 'absolute',
    right: MINI_PLAYER_LAYOUT.horizontalInset,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    zIndex: 3,
  },
  expandedContent: {
    flex: 1,
    zIndex: 2,
  },
  morphVeil: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 4,
  },
  morphVeilGlow: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 220,
    bottom: -170,
    height: 340,
    opacity: 0.12,
    position: 'absolute',
    right: -130,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 76,
    width: 340,
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
    alignItems: 'center',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  saveButtonActive: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.primaryLight,
    shadowColor: theme.colors.primaryLight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
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
  saveToastContainer: {
    alignItems: 'center',
    left: 20,
    position: 'absolute',
    right: 20,
    zIndex: 30,
  },
  saveToast: {
    alignItems: 'center',
    backgroundColor: 'rgba(23,17,31,0.97)',
    borderColor: 'rgba(168,85,247,0.34)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    maxWidth: 430,
    paddingHorizontal: 13,
    paddingVertical: 12,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    width: '100%',
  },
  saveToastIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    shadowColor: theme.colors.primaryLight,
    shadowOpacity: 0.5,
    shadowRadius: 9,
    width: 28,
  },
  saveToastText: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  saveToastAction: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '900',
  },
});
