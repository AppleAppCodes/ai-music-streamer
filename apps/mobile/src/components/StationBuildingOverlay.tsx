/**
 * The "your station is being assembled" moment right after onboarding.
 *
 * Pure theatre (labor illusion): the songs are fetched in parallel anyway, but
 * showing the chosen genres being "worked in" one by one makes the auto-played
 * result feel hand-made instead of arbitrary — and the final line ("N songs
 * queued for you") opens the loop that keeps a new user listening.
 *
 * The parent controls how long the overlay lives; stationBuildDurationMs()
 * tells it how long the choreography needs for a given genre count.
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { MusicGenre } from '../lib/genre-catalog';
import { useI18n } from '../lib/i18n';
import { theme } from '../theme';
import { YoriaxMark } from './YoriaxUI';

const BASE_MS = 900; // fade-in + a beat before the first genre appears
const PER_ROW_MS = 340;
const FINAL_HOLD_MS = 800;
const MAX_GENRE_ROWS = 4;

export function stationBuildDurationMs(genreCount: number): number {
  const rows = Math.min(genreCount, MAX_GENRE_ROWS) + (genreCount > MAX_GENRE_ROWS ? 1 : 0);
  return BASE_MS + (rows + 1) * PER_ROW_MS + FINAL_HOLD_MS;
}

export function StationBuildingOverlay({
  genres,
  queueCount,
}: {
  genres: MusicGenre[];
  queueCount: number | null;
}) {
  const { t } = useI18n();
  const shownGenres = genres.slice(0, MAX_GENRE_ROWS);
  const extraCount = genres.length - shownGenres.length;
  // +1 row for "+N more" (if any), +1 for the final "N songs queued" line.
  const rowCount = shownGenres.length + (extraCount > 0 ? 1 : 0) + 1;

  const containerOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const rowValues = useRef(
    Array.from({ length: rowCount }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    Animated.timing(containerOpacity, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.09, duration: 640, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 640, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();

    const reveal = Animated.stagger(
      PER_ROW_MS,
      rowValues.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    );
    const timer = setTimeout(() => reveal.start(), BASE_MS - 240);

    return () => {
      clearTimeout(timer);
      pulseLoop.stop();
      reveal.stop();
    };
  }, [containerOpacity, pulse, rowValues]);

  const rowStyle = (index: number) => ({
    opacity: rowValues[index],
    transform: [
      {
        translateY: rowValues[index].interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  });

  const finalRowIndex = rowCount - 1;

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <LinearGradient
        colors={['rgba(124,58,237,0.38)', 'rgba(45,212,191,0.10)', 'transparent']}
        style={styles.ambientGlow}
      />
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <YoriaxMark size={58} />
      </Animated.View>
      <Text style={styles.title}>{t('onboarding.building')}</Text>

      <View style={styles.rows}>
        {shownGenres.map((genre, index) => (
          <Animated.View key={genre.id} style={[styles.row, rowStyle(index)]}>
            <Ionicons name="checkmark-circle" size={22} color={genre.color} />
            <Text style={styles.rowLabel}>{genre.label}</Text>
          </Animated.View>
        ))}
        {extraCount > 0 ? (
          <Animated.View style={[styles.row, rowStyle(shownGenres.length)]}>
            <Ionicons name="checkmark-circle" size={22} color={theme.colors.accent} />
            <Text style={styles.rowLabel}>
              {t('onboarding.buildingMore', { count: extraCount })}
            </Text>
          </Animated.View>
        ) : null}
        <Animated.View style={[styles.row, styles.finalRow, rowStyle(finalRowIndex)]}>
          <Ionicons name="musical-notes" size={20} color={theme.colors.text} />
          <Text style={styles.finalLabel}>
            {queueCount && queueCount > 1
              ? t('onboarding.buildingReady', { count: queueCount })
              : t('onboarding.buildingReadyGeneric')}
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ambientGlow: {
    height: 420,
    position: 'absolute',
    right: -130,
    top: -120,
    width: 420,
  },
  container: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 32,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  finalLabel: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  finalRow: {
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  rowLabel: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  rows: {
    alignItems: 'center',
    gap: 13,
    marginTop: 30,
    minHeight: 200,
  },
  title: {
    color: theme.colors.text,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 26,
    textAlign: 'center',
  },
});
