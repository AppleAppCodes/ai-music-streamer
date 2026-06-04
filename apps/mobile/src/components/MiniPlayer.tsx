import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatDuration } from '../lib/format';
import { usePlayer } from '../lib/player-context';
import { theme } from '../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

export function MiniPlayer() {
  const { activeSong, currentTime, duration, error, isBuffering, isPlaying, toggle } = usePlayer();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (!activeSong) return null;

  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <TouchableOpacity
      style={styles.shell}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('FullscreenPlayer')}
    >
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.content}>
        {activeSong.cover_url ? (
          <Image source={{ uri: activeSong.cover_url }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <Text style={styles.coverFallbackText}>Y</Text>
          </View>
        )}

        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {activeSong.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {error || activeSong.artist_name || activeSong.creatorName || 'Creator'}
          </Text>
        </View>

        <Text style={styles.time}>{formatDuration(currentTime)}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={toggle} style={styles.button}>
          <Text style={styles.buttonText}>{isBuffering ? '…' : isPlaying ? 'Ⅱ' : '▶'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: 'rgba(10,10,10,0.98)',
    borderColor: theme.colors.border,
    borderRadius: 20,
    borderWidth: 1,
    bottom: 86,
    left: 14,
    overflow: 'hidden',
    position: 'absolute',
    right: 14,
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    height: 3,
  },
  progressFill: {
    backgroundColor: theme.colors.primary,
    height: '100%',
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 10,
  },
  cover: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 12,
    height: 48,
    width: 48,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFallbackText: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '900',
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
  time: {
    color: theme.colors.subtle,
    fontSize: 12,
    fontWeight: '800',
  },
  button: {
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  buttonText: {
    color: '#050505',
    fontSize: 17,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 20,
    textAlign: 'center',
  },
});
