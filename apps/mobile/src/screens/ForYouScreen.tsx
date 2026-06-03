import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { formatPlays } from '../lib/format';
import { useAuth } from '../lib/auth-context';
import { loadFeedPreview } from '../lib/music-data';
import type { FeedPreviewSong } from '../lib/types';
import { theme } from '../theme';

export function ForYouScreen() {
  const { user } = useAuth();
  const [songs, setSongs] = useState<FeedPreviewSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const nextSongs = await loadFeedPreview(user.id);
        if (mounted) setSongs(nextSongs);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Fuer dich konnte nicht geladen werden.');
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

  const firstSong = songs[0] ?? null;

  return (
    <View style={styles.screen}>
      <View style={styles.hookCard}>
        {firstSong?.cover_url ? (
          <Image source={{ uri: firstSong.cover_url }} style={styles.artworkPlaceholder} />
        ) : (
          <View style={styles.artworkPlaceholder}>
            <Text style={styles.artworkText}>9:16</Text>
          </View>
        )}
        <View style={styles.modeTabs}>
          <Text style={[styles.modeTab, styles.modeTabActive]}>Fuer dich</Text>
          <Text style={styles.modeTab}>Gefolgt</Text>
          <Text style={styles.modeTab}>Explore</Text>
        </View>
        <Text style={styles.eyebrow}>Hook Vorschau</Text>
        <Text style={styles.title}>{firstSong?.title ?? 'Native Feed wird geladen'}</Text>
        <Text style={styles.copy}>
          {firstSong
            ? `${firstSong.artist_name || firstSong.creatorName || 'Creator'} · ${formatPlays(firstSong.plays)} Streams`
            : 'Songs werden aus Yoriax geladen. Player und Swipe-Gesten folgen im naechsten Schritt.'}
        </Text>
        {firstSong?.clip ? (
          <Text style={styles.hookTime}>
            Hook: {firstSong.clip.hook_start_seconds}s bis {firstSong.clip.hook_end_seconds}s
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.text} />
          <Text style={styles.stateText}>Hooks werden geladen</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading && songs.length > 0 ? (
        <View style={styles.queueList}>
          {songs.slice(0, 8).map((song, index) => (
            <View key={song.id} style={styles.queueRow}>
              <Text style={styles.queueRank}>{index + 1}</Text>
              <View style={styles.queueText}>
                <Text style={styles.queueTitle} numberOfLines={1}>
                  {song.title}
                </Text>
                <Text style={styles.queueMeta} numberOfLines={1}>
                  {song.artist_name || song.creatorName || 'Creator'}
                </Text>
              </View>
              <Text style={styles.queueLikes}>{song.likes_count ?? 0} Likes</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 16,
  },
  hookCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
  },
  artworkPlaceholder: {
    alignItems: 'center',
    aspectRatio: 9 / 16,
    backgroundColor: '#140c23',
    borderRadius: 24,
    justifyContent: 'center',
    marginBottom: 18,
    width: '100%',
  },
  artworkText: {
    color: theme.colors.subtle,
    fontSize: 28,
    fontWeight: '900',
  },
  modeTabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  modeTab: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '900',
  },
  modeTabActive: {
    color: theme.colors.text,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 8,
  },
  copy: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  hookTime: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 12,
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
  queueList: {
    gap: 10,
  },
  queueRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: theme.colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  queueRank: {
    color: theme.colors.subtle,
    fontSize: 14,
    fontWeight: '900',
    width: 22,
  },
  queueText: {
    flex: 1,
  },
  queueTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  queueMeta: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  queueLikes: {
    color: theme.colors.subtle,
    fontSize: 11,
    fontWeight: '800',
  },
});
