import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDuration } from '../lib/format';
import { usePlayer } from '../lib/player-context';
import { theme } from '../theme';
import { CoverArt } from './YoriaxUI';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useI18n } from '../lib/i18n';

export const MINI_PLAYER_LAYOUT = {
  bottom: 124,
  height: 77,
  horizontalInset: 14,
} as const;

export const MINI_PLAYER_RADIUS = 34;

export function MiniPlayer({ onExpand }: { onExpand: () => void }) {
  return (
    <View style={styles.shell}>
      <TouchableOpacity
        style={styles.shellButton}
        activeOpacity={0.94}
        onPress={onExpand}
      >
        <MiniPlayerPreview />
      </TouchableOpacity>
    </View>
  );
}

export function MiniPlayerPreview({ interactive = true }: { interactive?: boolean }) {
  const { t } = useI18n();
  const { activeSong, currentTime, duration, error, isBuffering, isPlaying, toggle } = usePlayer();

  if (!activeSong) return null;

  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <View style={styles.preview}>
      {activeSong.cover_url && (
        <View style={StyleSheet.absoluteFill}>
          <Image source={{ uri: activeSong.cover_url }} style={StyleSheet.absoluteFill} blurRadius={10} alt="" />
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(12,10,18,0.5)', 'rgba(12,10,18,0.9)']}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.content}>
        <CoverArt uri={activeSong.cover_url} size={52} radius={14} />

        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {activeSong.title}
          </Text>
          <Text style={[styles.meta, error ? styles.metaError : null]} numberOfLines={1}>
            {error || activeSong.artist_name || activeSong.creatorName || t('common.creator')}
          </Text>
        </View>

        <Text style={styles.time}>{formatDuration(currentTime)}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.85}
          disabled={!interactive}
          onPress={toggle}
          style={styles.button}
        >
          {isBuffering ? (
            <ActivityIndicator color="#050505" size="small" />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color="#050505"
              style={!isPlaying ? styles.playIcon : undefined}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: 'transparent',
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
  },
  shellButton: {
    flex: 1,
  },
  preview: {
    flex: 1,
    overflow: 'hidden',
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    height: 3,
  },
  progressFill: {
    backgroundColor: '#fff',
    height: '100%',
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 11,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  meta: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  metaError: {
    color: '#fecaca',
  },
  time: {
    color: theme.colors.subtle,
    fontSize: 12,
    fontWeight: '800',
  },
  button: {
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  playIcon: {
    marginLeft: 2,
  },
});
