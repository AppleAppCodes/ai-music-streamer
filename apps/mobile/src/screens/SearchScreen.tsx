import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useState, useEffect } from 'react';
import { theme } from '../theme';
import { usePlayer } from '../lib/player-context';
import { searchMusic } from '../lib/music-data';
import type { Song } from '../lib/types';
import { formatPlays } from '../lib/format';

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { activeSong, isPlaying, playSong, setQueue } = usePlayer();

  // Debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(handler);
  }, [query]);

  // Search logic
  useEffect(() => {
    let mounted = true;

    async function doSearch() {
      if (!debouncedQuery.trim()) {
        if (mounted) setResults([]);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        const data = await searchMusic(debouncedQuery);
        if (mounted) setResults(data);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Suche fehlgeschlagen');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    doSearch();

    return () => {
      mounted = false;
    };
  }, [debouncedQuery]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Suchen</Text>
        <View style={styles.searchBox}>
          <TextInput
            style={styles.input}
            placeholder="Songs, Künstler oder Alben..."
            placeholderTextColor={theme.colors.muted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={theme.colors.text} />
            <Text style={styles.stateText}>Suche läuft...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : query.trim() && results.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Keine Ergebnisse für {query}</Text>
          </View>
        ) : (
          <View style={styles.resultsList}>
            {results.map((song, index) => {
              const active = activeSong?.id === song.id;
              
              return (
                <TouchableOpacity
                  key={song.id}
                  style={styles.songRow}
                  onPress={() => {
                    setQueue(results, index);
                    void playSong(song);
                  }}
                  accessibilityRole="button"
                >
                  {song.cover_url ? (
                    <Image source={{ uri: song.cover_url }} style={styles.cover} alt="" />
                  ) : (
                    <View style={[styles.cover, styles.coverFallback]}>
                      <Text style={styles.coverFallbackText}>Y</Text>
                    </View>
                  )}
                  
                  <View style={styles.songInfo}>
                    <Text style={[styles.songTitle, active && styles.activeText]} numberOfLines={1}>
                      {song.title}
                    </Text>
                    <Text style={styles.songArtist} numberOfLines={1}>
                      {song.artist_name || song.creatorName || 'Creator'}
                    </Text>
                  </View>
                  
                  <Text style={styles.songMeta}>{formatPlays(song.plays)}</Text>
                  
                  {active && isPlaying && (
                    <View style={styles.playingIndicator}>
                      <Text style={styles.playingText}>▶</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 16,
  },
  searchBox: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    justifyContent: 'center',
  },
  input: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    height: '100%',
  },
  content: {
    padding: 20,
    paddingBottom: 120, // space for MiniPlayer
  },
  stateBox: {
    alignItems: 'center',
    gap: 12,
    marginTop: 40,
  },
  stateText: {
    color: theme.colors.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.32)',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginTop: 20,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
    textAlign: 'center',
  },
  resultsList: {
    gap: 16,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 12,
    borderRadius: 16,
  },
  cover: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFallbackText: {
    color: theme.colors.muted,
    fontSize: 20,
    fontWeight: '900',
  },
  songInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  songTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  activeText: {
    color: theme.colors.primary,
  },
  songArtist: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  songMeta: {
    color: theme.colors.subtle,
    fontSize: 12,
    fontWeight: '700',
  },
  playingIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  playingText: {
    color: theme.colors.background,
    fontSize: 10,
    fontWeight: '900',
  },
});
