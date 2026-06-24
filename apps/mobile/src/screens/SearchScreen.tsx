import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { memo, useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { usePlayerControls } from '../lib/player-context';
import { searchMusic } from '../lib/music-data';
import type { Song } from '../lib/types';
import { useI18n } from '../lib/i18n';
import { SongListRow } from '../components/SongListRow';

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
    <SongListRow
      active={active}
      index={index}
      isPlaying={isPlaying}
      onPlay={onPlay}
      song={song}
    />
  );
});

const GenreSuggestions = memo(function GenreSuggestions({
  onSelect,
}: {
  onSelect: (genre: string) => void;
}) {
  const { t } = useI18n();

  return (
    <View style={styles.genreSection}>
      <Text style={styles.sectionEyebrow}>{t('search.genresEyebrow')}</Text>
      <Text style={styles.sectionTitle}>{t('search.genresTitle')}</Text>
      <Text style={styles.sectionDescription}>{t('search.genresCopy')}</Text>

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
  const { t } = useI18n();
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
        if (mounted) setError(err instanceof Error ? err.message : t('search.error'));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    doSearch();

    return () => {
      mounted = false;
    };
  }, [debouncedQuery, t]);

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
        <Text style={styles.title}>{t('search.title')}</Text>
        <View style={styles.searchBox}>
          <TextInput
            style={styles.input}
            placeholder={t('search.placeholder')}
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
              <Text style={styles.stateText}>{t('search.loading')}</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>{t('search.noResults', { query })}</Text>
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
});
