import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCallback, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { useAuth } from '../lib/auth-context';
import { useI18n } from '../lib/i18n';
import { usePlayerControls } from '../lib/player-context';
import type { RootStackParamList } from '../navigation/types';
import type { Song } from '../lib/types';
import {
  fetchGenreStationSongs,
  fetchMixStationSongs,
  fetchMoodStationSongs,
  GENRE_STATIONS,
  MOOD_STATIONS,
} from '../lib/radio-stations';

type Props = NativeStackScreenProps<RootStackParamList, 'Radio'>;

export function RadioScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { user } = useAuth();
  const { playSong, setQueue } = usePlayerControls();
  const [loadingStation, setLoadingStation] = useState<string | null>(null);

  const startStation = useCallback(
    async (stationKey: string, loader: () => Promise<Song[]>) => {
      if (loadingStation) return;
      setLoadingStation(stationKey);
      try {
        const songs = await loader();
        if (songs.length === 0) {
          Alert.alert(t('radio.startError'));
          return;
        }
        // The starter queue is all a station needs — once it runs out, the
        // player's autoplay keeps the mix going with similar songs forever.
        setQueue(songs, 0);
        void playSong(songs[0]);
      } catch {
        Alert.alert(t('radio.startError'));
      } finally {
        setLoadingStation(null);
      }
    },
    [loadingStation, playSong, setQueue, t],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('radio.title')}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}>
        <Text style={styles.tagline}>{t('radio.tagline')}</Text>

        {user && (
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.88}
            onPress={() => void startStation('mix', () => fetchMixStationSongs(user.id))}
          >
            <LinearGradient
              colors={[theme.colors.primary, '#7c3aed']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mixCard}
            >
              <View style={styles.mixIcon}>
                {loadingStation === 'mix' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="radio" size={26} color="#fff" />
                )}
              </View>
              <View style={styles.mixCopy}>
                <Text style={styles.mixTitle}>{t('radio.yourMix')}</Text>
                <Text style={styles.mixSubtitle}>{t('radio.yourMixCopy')}</Text>
              </View>
              <Ionicons name="play-circle" size={40} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>{t('radio.genres')}</Text>
        <View style={styles.grid}>
          {GENRE_STATIONS.map((station) => (
            <TouchableOpacity
              key={station.id}
              accessibilityRole="button"
              activeOpacity={0.88}
              style={[styles.tile, { backgroundColor: `${station.color}26`, borderColor: `${station.color}55` }]}
              onPress={() => void startStation(`genre:${station.id}`, () => fetchGenreStationSongs(station))}
            >
              {loadingStation === `genre:${station.id}` ? (
                <ActivityIndicator color={station.color} />
              ) : (
                <Ionicons name={station.icon} size={22} color={station.color} />
              )}
              <Text style={styles.tileLabel}>{station.label}</Text>
              <Text style={[styles.tileHint, { color: station.color }]}>RADIO</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('radio.moods')}</Text>
        <View style={styles.grid}>
          {MOOD_STATIONS.map((station) => (
            <TouchableOpacity
              key={station.id}
              accessibilityRole="button"
              activeOpacity={0.88}
              style={[styles.tile, { backgroundColor: `${station.color}26`, borderColor: `${station.color}55` }]}
              onPress={() => void startStation(`mood:${station.id}`, () => fetchMoodStationSongs(station))}
            >
              {loadingStation === `mood:${station.id}` ? (
                <ActivityIndicator color={station.color} />
              ) : (
                <Ionicons name={station.icon} size={22} color={station.color} />
              )}
              <Text style={styles.tileLabel}>{t(station.labelKey)}</Text>
              <Text style={[styles.tileHint, { color: station.color }]}>RADIO</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 20,
  },
  tagline: {
    color: theme.colors.muted,
    fontSize: 14,
    marginBottom: 16,
  },
  mixCard: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 8,
    padding: 18,
  },
  mixIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  mixCopy: {
    flex: 1,
  },
  mixTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  mixSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    minHeight: 96,
    padding: 14,
    width: '47.5%',
  },
  tileLabel: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  tileHint: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
