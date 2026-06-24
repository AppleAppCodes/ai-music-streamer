import { memo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CoverArt } from './YoriaxUI';
import { PlayingVisualizer } from './PlayingVisualizer';
import { formatPlays } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { Song } from '../lib/types';
import { theme } from '../theme';

const CONTEXT_BUTTON_HIT_SLOP = { top: 10, right: 10, bottom: 10, left: 10 };

export const SongListRow = memo(function SongListRow({
  active,
  index,
  isPlaying,
  onOpenMenu,
  onPlay,
  showPlays = true,
  song,
  style,
}: {
  active: boolean;
  index: number;
  isPlaying: boolean;
  onOpenMenu?: (song: Song) => void;
  onPlay: (song: Song, index: number) => void;
  showPlays?: boolean;
  song: Song;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useI18n();
  const shouldShowVisualizer = active && isPlaying;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.82}
      onPress={() => onPlay(song, index)}
      style={[styles.row, active && styles.rowActive, style]}
    >
      <CoverArt uri={song.cover_url} size={52} radius={10} />

      <View style={styles.textColumn}>
        <Text style={[styles.title, active && styles.titleActive]} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {song.artist_name || song.creatorName || t('common.creator')}
        </Text>
      </View>

      {showPlays ? (
        <Text style={styles.meta} numberOfLines={1}>
          {formatPlays(song.plays)}
        </Text>
      ) : null}

      <PlayingVisualizer active={shouldShowVisualizer} style={styles.visualizer} />

      {onOpenMenu ? (
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={CONTEXT_BUTTON_HIT_SLOP}
          onPress={(event) => {
            event.stopPropagation();
            onOpenMenu(song);
          }}
          style={styles.contextButton}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={active ? theme.colors.primaryLight : theme.colors.muted} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  artist: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  contextButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    marginRight: -2,
    width: 34,
  },
  meta: {
    color: theme.colors.subtle,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 26,
    textAlign: 'right',
  },
  row: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 12,
  },
  rowActive: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderColor: 'rgba(124,58,237,0.3)',
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  title: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  titleActive: {
    color: theme.colors.primary,
  },
  visualizer: {
    marginLeft: -2,
  },
});
