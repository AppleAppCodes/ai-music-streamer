import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { theme } from '../theme';
import { usePlayer } from '../lib/player-context';
import { useAuth } from '../lib/auth-context';
import { checkIsLiked, toggleLike } from '../lib/music-data';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { formatDuration } from '../lib/format';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';

type Props = NativeStackScreenProps<RootStackParamList, 'FullscreenPlayer'>;

export function FullscreenPlayer({ navigation }: Props) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isPlaylistModalVisible, setIsPlaylistModalVisible] = useState(false);
  const { 
    activeSong, currentTime, duration, isPlaying, isBuffering, toggle, 
    playNext, playPrevious, isShuffling, repeatMode, toggleShuffle, toggleRepeat, seekTo 
  } = usePlayer();

  useEffect(() => {
    let mounted = true;
    if (user && activeSong) {
      checkIsLiked(user.id, activeSong.id).then((liked) => {
        if (mounted) setIsLiked(liked);
      });
    }
    return () => {
      mounted = false;
    };
  }, [user, activeSong?.id]);

  const handleLike = async () => {
    if (!user || !activeSong || isLikeLoading) return;
    setIsLikeLoading(true);
    try {
      const newStatus = await toggleLike(user.id, activeSong.id, isLiked);
      setIsLiked(newStatus);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLikeLoading(false);
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="chevron-down" size={32} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeSong.cover_url ? (
          <Image source={{ uri: activeSong.cover_url }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <Text style={styles.coverFallbackText}>Y</Text>
          </View>
        )}

        <View style={styles.infoContainer}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextContainer}>
              <Text style={styles.title} numberOfLines={1}>{activeSong.title}</Text>
              <Text style={styles.artist} numberOfLines={1}>
                {activeSong.artist_name || activeSong.creatorName || 'Creator'}
              </Text>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setIsPlaylistModalVisible(true)}
              >
                <Ionicons name="add-circle-outline" size={28} color={theme.colors.text} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.likeButton}
                onPress={() => { void handleLike(); }}
                disabled={isLikeLoading}
              >
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={28} 
                  color={isLiked ? theme.colors.primary : theme.colors.text} 
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
            onSlidingComplete={(val) => { void seekTo(val); }}
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
          
          <TouchableOpacity onPress={() => playPrevious()} style={styles.controlButton}>
            <Ionicons name="play-skip-back" size={36} color={theme.colors.text} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={toggle} style={styles.playButton}>
            <Ionicons name={isBuffering ? "ellipsis-horizontal" : isPlaying ? "pause" : "play"} size={36} color="#000" style={{ marginLeft: isPlaying || isBuffering ? 0 : 4 }} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => playNext()} style={styles.controlButton}>
            <Ionicons name="play-skip-forward" size={36} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleRepeat} style={styles.secondaryControlButton}>
            <Ionicons name={repeatMode === 'one' ? "repeat" : "repeat"} size={24} color={repeatMode !== 'none' ? theme.colors.primary : theme.colors.muted} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.bottomControlsRow}>
          <TouchableOpacity style={styles.secondaryControlButton}>
            <Ionicons name="share-social-outline" size={24} color={theme.colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleRepeat} style={styles.secondaryControlButton}>
            <Ionicons name={repeatMode === 'one' ? "repeat" : "repeat"} size={24} color={repeatMode !== 'none' ? theme.colors.primary : theme.colors.muted} />
          </TouchableOpacity>
        </View>
        
      </View>
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
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
  },
  closeButton: {
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
    padding: 4,
  },
  likeButton: {
    padding: 4,
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
