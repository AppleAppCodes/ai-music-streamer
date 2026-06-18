import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { memo, useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { usePlayerControls } from '../lib/player-context';
import { searchMusic } from '../lib/music-data';
import type { Song } from '../lib/types';
import { formatPlays } from '../lib/format';

const GENRE_SUGGESTIONS: Array<{
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { label: 'Pop', color: '#ec4899', icon: 'sparkles' },
  { label: 'Hip-Hop', color: '#f97316', icon: 'flame' },
  { label: 'R&B', color: '#a855f7', icon: 'heart' },
  { label: 'Afrobeat', color: '#14b8a6', icon: 'globe' },
  { label: 'EDM', color: '#06b6d4', icon: 'flash' },
  { label: 'Phonk', color: '#7c3aed', icon: 'car-sport' },
  { label: 'Latin', color: '#ef4444', icon: 'radio' },
  { label: 'Sleep', color: '#4338ca', icon: 'moon' },
  { label: 'Country', color: '#f59e0b', icon: 'musical-notes' },
  { label: 'K-Pop', color: '#fb7185', icon: 'star' },
];
const EMPTY_RESULTS: Song[] = [];

function ResultSeparator() {
  return <View style={styles.resultSeparator} />;
}

const SearchResultRow = memo(function SearchResultRow({
  active,
  index,
  isPlaying,
  onPlay,
  song,
}: {
  active: boolean;
  index: number;
  isPlaying: boolean;
  onPlay: (song: Song, index: number) => void;
  song: Song;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => onPlay(song, index)}
      style={styles.songRow}
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

      {active && isPlaying ? (
        <View style={styles.playingIndicator}>
          <Text style={styles.playingText}>▶</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

const GenreSuggestions = memo(function GenreSuggestions({
  onSelect,
}: {
  onSelect: (genre: string) => void;
}) {
  return (
    <View style={styles.genreSection}>
      <Text style={styles.sectionEyebrow}>Schnellzugriff</Text>
      <Text style={styles.sectionTitle}>Genres entdecken</Text>
      <Text style={styles.sectionDescription}>
        Tippe ein Genre an, um direkt passende Songs zu finden.
      </Text>

      <View style={styles.genreGrid}>
        {GENRE_SUGGESTIONS.map((genre) => (
          <TouchableOpacity
            key={genre.label}
            activeOpacity={0.82}
            style={[styles.genreChip, { borderColor: `${genre.color}66` }]}
            onPress={() => onSelect(genre.label)}
            accessibilityRole="button"
          >
            <View style={[styles.genreIcon, { backgroundColor: `${genre.color}30` }]}>
              <Ionicons name={genre.icon} size={18} color={genre.color} />
            </View>
            <Text style={styles.genreLabel}>{genre.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { activeSong, isPlaying, playSong, setQueue } = usePlayerControls();
  const normalizedQuery = query.trim();
  const showGenreSuggestions = !normalizedQuery;
  const isSearchPending = !showGenreSuggestions && normalizedQuery !== debouncedQuery.trim();

  const handleGenrePress = useCallback((genre: string) => {
    setQuery(genre);
    setDebouncedQuery(genre);
  }, []);

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

  const handlePlayResult = useCallback((song: Song, index: number) => {
    setQueue(results, index);
    void playSong(song);
  }, [playSong, results, setQueue]);

  const renderResult = useCallback(({ item, index }: { item: Song; index: number }) => {
    const active = activeSong?.id === item.id;

    return (
      <SearchResultRow
        active={active}
        index={index}
        isPlaying={active && isPlaying}
        onPlay={handlePlayResult}
        song={item}
      />
    );
  }, [activeSong?.id, handlePlayResult, isPlaying]);

  const listData = showGenreSuggestions || isSearchPending || loading || error ? EMPTY_RESULTS : results;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
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

      <FlatList
        contentContainerStyle={styles.content}
        data={listData}
        initialNumToRender={8}
        ItemSeparatorComponent={ResultSeparator}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        maxToRenderPerBatch={8}
        renderItem={renderResult}
        showsVerticalScrollIndicator={false}
        updateCellsBatchingPeriod={32}
        windowSize={7}
        ListEmptyComponent={
          showGenreSuggestions ? (
            <GenreSuggestions onSelect={handleGenrePress} />
          ) : isSearchPending || loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={theme.colors.text} />
              <Text style={styles.stateText}>Suche läuft...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>Keine Ergebnisse für {query}</Text>
            </View>
          )
        }
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
    paddingHorizontal: 20,
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
  genreSection: {
    gap: 10,
  },
  sectionEyebrow: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  sectionDescription: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 8,
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  genreChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    gap: 10,
    minHeight: 66,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  genreIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  genreLabel: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
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
  resultSeparator: {
    height: 16,
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
