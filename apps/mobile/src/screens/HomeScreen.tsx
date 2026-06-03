import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { formatPlays } from '../lib/format';
import { useAuth } from '../lib/auth-context';
import { loadHomeMusic, type HomeMusicData } from '../lib/music-data';
import { usePlayer } from '../lib/player-context';
import type { Song } from '../lib/types';
import { theme } from '../theme';

export function HomeScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<HomeMusicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const nextData = await loadHomeMusic(user.id);
        if (mounted) setData(nextData);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Home konnte nicht geladen werden.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Yoriax Native</Text>
        <Text style={styles.title}>Home</Text>
        <Text style={styles.copy}>Echte Yoriax-Daten sind verbunden. Player und Navigation zu Details folgen als naechster Schritt.</Text>
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>{data?.totalSongs ?? 0}</Text>
            <Text style={styles.statLabel}>Songs</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>{data?.recommendedSongs.length ?? 0}</Text>
            <Text style={styles.statLabel}>Fuer dich</Text>
          </View>
        </View>
      </View>

      <View style={styles.grid}>
        {['Lieblingssongs', 'Charts', 'Kuenstler', 'Playlists'].map((item, index) => (
          <View key={item} style={[styles.tile, index === 0 && styles.tileAccent]}>
            <Text style={styles.tileText}>{item}</Text>
          </View>
        ))}
      </View>

      {loading ? <LoadingBlock label="Musik wird geladen" /> : null}
      {error ? <ErrorBlock message={error} /> : null}

      {data && !loading ? (
        <>
          <SongRail title="Trending heute" songs={data.trendingSongs} />
          <SongRail title="Fuer dich ausgewaehlt" songs={data.recommendedSongs} />
          <SongRail title="Neu auf Yoriax" songs={data.latestSongs} />
        </>
      ) : null}
    </View>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator color={theme.colors.text} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function SongRail({ title, songs }: { title: string; songs: Song[] }) {
  const { activeSong, isPlaying, playSong } = usePlayer();

  if (songs.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.songRail}>
        {songs.map((song) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={song.id}
            onPress={() => {
              void playSong(song);
            }}
            style={styles.songCard}
          >
            {song.cover_url ? (
              <Image source={{ uri: song.cover_url }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverFallback]}>
                <Text style={styles.coverFallbackText}>Y</Text>
              </View>
            )}
            <View style={styles.playBadge}>
              <Text style={styles.playBadgeText}>{activeSong?.id === song.id && isPlaying ? 'II' : '▶'}</Text>
            </View>
            <Text style={styles.songTitle} numberOfLines={1}>
              {song.title}
            </Text>
            <Text style={styles.songArtist} numberOfLines={1}>
              {song.artist_name || song.creatorName || 'Creator'}
            </Text>
            <Text style={styles.songMeta}>{formatPlays(song.plays)} Streams</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 20,
  },
  hero: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.text,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.5,
    marginTop: 10,
  },
  copy: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  statPill: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: theme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 82,
    padding: 16,
    width: '48%',
  },
  tileAccent: {
    backgroundColor: '#25103c',
    borderColor: 'rgba(124,58,237,0.42)',
  },
  tileText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  stateBox: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  stateText: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.32)',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 13,
    lineHeight: 19,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  songRail: {
    gap: 14,
    paddingRight: 20,
  },
  songCard: {
    width: 142,
  },
  cover: {
    aspectRatio: 1,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 18,
    width: 142,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFallbackText: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '900',
  },
  playBadge: {
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: 999,
    bottom: 46,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    width: 34,
  },
  playBadgeText: {
    color: '#050505',
    fontSize: 13,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 16,
    textAlign: 'center',
  },
  songTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 10,
  },
  songArtist: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  songMeta: {
    color: theme.colors.subtle,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
});
