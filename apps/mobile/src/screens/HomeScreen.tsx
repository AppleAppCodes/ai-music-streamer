import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useEffect, useMemo, useState, memo, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverArt, IconButton, StateCard, YoriaxPlaylistCover } from '../components/YoriaxUI';
import { UpdateBanner } from '../components/UpdateBanner';
import { formatPlays } from '../lib/format';
import { useAuth } from '../lib/auth-context';
import { loadHomeMusic, type HomeMusicData, type SpotlightArtist, type SpotlightPlaylist, DAILY_NEW_RELEASES_PLAYLIST_ID } from '../lib/music-data';
import { readPersistedCache, writePersistedCache } from '../lib/persisted-cache';
import { usePlayerControls } from '../lib/player-context';
import { useMusicPreferences } from '../lib/music-preferences-context';
import { prefetchHomeMusicMedia } from '../lib/media-preload';
import type { DiscoverPlaylist, Song } from '../lib/types';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useI18n } from '../lib/i18n';

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type QuickTile = {
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  subtitle: string;
};

const HOME_CACHE_PREFIX = 'yoriax:home:v2:';

export function HomeScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { favoriteGenres, revision: preferenceRevision } = useMusicPreferences();
  const navigation = useNavigation<HomeNavigation>();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<HomeMusicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) return;

      const cacheKey = `${HOME_CACHE_PREFIX}${user.id}:${favoriteGenres.join(',')}`;
      let hasCachedData = false;
      setLoading(true);
      setError(null);

      const cachedData = await readPersistedCache<HomeMusicData>(cacheKey);
      if (mounted && cachedData) {
        hasCachedData = true;
        setData(cachedData);
        setLoading(false);
        void prefetchHomeMusicMedia(cachedData);
      }

      try {
        const nextData = await loadHomeMusic(user.id);
        if (!mounted) return;
        setData(nextData);
        setError(null);
        setLoading(false);
        void writePersistedCache(cacheKey, nextData);
        void prefetchHomeMusicMedia(nextData);
      } catch (loadError) {
        if (mounted && !hasCachedData) {
          setError(loadError instanceof Error ? loadError.message : t('home.error'));
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [favoriteGenres, preferenceRevision, t, user]);

  const refreshHome = useCallback(async () => {
    if (!user || refreshing) return;

    const cacheKey = `${HOME_CACHE_PREFIX}${user.id}:${favoriteGenres.join(',')}`;
    setRefreshing(true);
    setError(null);

    try {
      const nextData = await loadHomeMusic(user.id);
      setData(nextData);
      void writePersistedCache(cacheKey, nextData);
      void prefetchHomeMusicMedia(nextData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('home.refreshError'));
    } finally {
      setRefreshing(false);
    }
  }, [favoriteGenres, refreshing, t, user]);

  const quickTiles = useMemo<QuickTile[]>(() => [
    {
      accent: theme.colors.primaryLight, // Purple
      icon: 'heart',
      label: t('home.favorites'),
      subtitle: t('home.favoritesSubtitle'),
      onPress: () => navigation.navigate('LikedSongs'),
    },
    {
      accent: '#eab308', // Yellow
      icon: 'trending-up',
      label: t('home.charts'),
      subtitle: t('home.chartsSubtitle'),
      onPress: () => navigation.navigate('Charts'),
    },
    {
      accent: '#0d9488', // Teal
      icon: 'mic',
      label: t('home.artists'),
      subtitle: t('home.artistsSubtitle'),
      onPress: () => navigation.navigate('Artists'),
    },
    {
      accent: '#06b6d4', // Cyan
      icon: 'library',
      label: t('home.playlists'),
      subtitle: t('home.playlistsSubtitle'),
      onPress: () => navigation.navigate('PlaylistDiscover'),
    },
  ], [navigation, t]);

  const handleOpenPlaylist = useCallback((playlistId: string) => {
    navigation.navigate('Playlist', { playlistId });
  }, [navigation]);

  const handleOpenArtist = useCallback((artistName: string) => {
    navigation.navigate('Artist', { artistId: artistName });
  }, [navigation]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}
      refreshControl={(
        <RefreshControl
          colors={[theme.colors.primaryLight]}
          onRefresh={() => { void refreshHome(); }}
          progressBackgroundColor={theme.colors.surface}
          progressViewOffset={insets.top + 8}
          refreshing={refreshing}
          tintColor={theme.colors.primaryLight}
        />
      )}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['rgba(88,28,135,0.45)', 'rgba(12,10,18,0)']}
        style={styles.topGradient}
      />
      <View style={styles.header}>
        <IconButton icon="person-circle-outline" onPress={() => navigation.navigate('Profile')} />
      </View>

      <UpdateBanner />

      <View style={styles.quickGrid}>
        {quickTiles.map((tile) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={tile.label}
            onPress={tile.onPress}
            activeOpacity={0.8}
            style={styles.quickTileShell}
          >
            <LinearGradient
              colors={['rgba(14,14,16,0.98)', 'rgba(14,14,16,0.92)', `${tile.accent}10`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.quickTile, { borderColor: `${tile.accent}8A` }]}
            >
              <View style={[styles.quickIcon, { backgroundColor: `${tile.accent}24` }]}>
                <Ionicons name={tile.icon} size={24} color={tile.accent} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1}>{tile.label}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !data ? <StateCard title={t('home.loading')} message={t('home.loadingCopy')} loading /> : null}
      {error ? <StateCard icon="warning" title={t('home.error')} message={error} /> : null}

      {data ? (
        <View style={styles.sections}>
          <PlaylistRail
            title={t('home.officialPlaylists')}
            playlists={data.officialPlaylists}
            onPressPlaylist={handleOpenPlaylist}
          />
          <SpotlightCarousel
            song={data.spotlightSong}
            artist={data.spotlightArtist}
            playlist={data.spotlightPlaylist}
            onOpenArtist={handleOpenArtist}
            onOpenPlaylist={handleOpenPlaylist}
          />
          <SongRail title={t('home.trending')} songs={data.trendingSongs} />
          <SongRail title={t('home.forYouSelected')} songs={data.recommendedSongs} />
          <SongRail title={t('home.latest')} songs={data.latestSongs} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const SongRailItem = memo(function SongRailItem({
  song,
  index,
  list,
  isActive,
  isPlaying,
  onPlay,
  onToggle
}: {
  song: Song;
  index: number;
  list: Song[];
  isActive: boolean;
  isPlaying: boolean;
  onPlay: (song: Song, list: Song[], index: number) => void;
  onToggle: () => void;
}) {
  const { t } = useI18n();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.96}
      onPress={() => {
        if (isActive) {
          onToggle();
        } else {
          onPlay(song, list, index);
        }
      }}
      style={[styles.songCard, isActive && styles.songCardActive]}
    >
      <CoverArt uri={song.cover_url} size={132} radius={18} />
      <View style={[styles.playBadge, isActive && styles.playBadgeActive]}>
        <Ionicons name={isActive && isPlaying ? 'pause' : 'play'} size={16} color={isActive ? theme.colors.text : theme.colors.background} />
      </View>
      <Text style={[styles.songTitle, isActive && styles.songTitleActive]} numberOfLines={1}>
        {song.title}
      </Text>
      <Text style={styles.songArtist} numberOfLines={1}>
        {song.artist_name || song.creatorName || t('common.creator')}
      </Text>
      <Text style={styles.songMeta}>{formatPlays(song.plays)} {t('common.streams')}</Text>
    </TouchableOpacity>
  );
});

type SpotlightSlide =
  | { kind: 'song'; song: Song }
  | { kind: 'artist'; artist: SpotlightArtist }
  | { kind: 'playlist'; playlist: SpotlightPlaylist };

const SpotlightCarousel = memo(function SpotlightCarousel({
  song,
  artist,
  playlist,
  onOpenArtist,
  onOpenPlaylist,
}: {
  song?: Song | null;
  artist?: SpotlightArtist | null;
  playlist?: SpotlightPlaylist | null;
  onOpenArtist: (artistName: string) => void;
  onOpenPlaylist: (playlistId: string) => void;
}) {
  const { t } = useI18n();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);

  const slides = useMemo<SpotlightSlide[]>(() => {
    const list: SpotlightSlide[] = [];
    if (song) list.push({ kind: 'song', song });
    if (artist) list.push({ kind: 'artist', artist });
    if (playlist) list.push({ kind: 'playlist', playlist });
    return list;
  }, [song, artist, playlist]);

  const handleMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setActive(Math.max(0, Math.min(next, slides.length - 1)));
  }, [slides.length, width]);

  if (slides.length === 0) return null;

  const boundedActive = Math.min(active, slides.length - 1);
  const hasMultiple = slides.length > 1;

  return (
    <View style={styles.section}>
      <View style={styles.spotlightHeaderRow}>
        <Text style={styles.sectionTitle}>{t('home.spotlight')}</Text>
        {hasMultiple ? (
          <View style={styles.spotlightSwipeHint}>
            <Text style={styles.spotlightSwipeHintText}>{t('home.spotlightSwipeHint')}</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.muted} />
          </View>
        ) : null}
      </View>

      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumEnd}
            scrollEnabled={hasMultiple}
            decelerationRate="fast"
          >
            {slides.map((slide) => (
              <View key={slide.kind} style={{ width }}>
                {slide.kind === 'song' ? <SpotlightSongSlide song={slide.song} /> : null}
                {slide.kind === 'artist' ? <SpotlightArtistSlide artist={slide.artist} onOpen={onOpenArtist} /> : null}
                {slide.kind === 'playlist' ? <SpotlightPlaylistSlide playlist={slide.playlist} onOpen={onOpenPlaylist} /> : null}
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {hasMultiple ? (
        <View style={styles.spotlightDots}>
          {slides.map((slide, index) => (
            <View
              key={slide.kind}
              style={[styles.spotlightDot, index === boundedActive && styles.spotlightDotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
});

const SpotlightSongSlide = memo(function SpotlightSongSlide({ song }: { song: Song }) {
  const { t } = useI18n();
  const { activeSong, isBuffering, isPlaying, playSong, setQueue, toggle } = usePlayerControls();

  const isActive = activeSong?.id === song.id;
  const isLoading = Boolean(isActive && isBuffering);

  const handlePress = useCallback(() => {
    if (isActive) {
      toggle();
      return;
    }

    setQueue([song], 0);
    void playSong(song);
  }, [isActive, playSong, setQueue, song, toggle]);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.92}
      onPress={handlePress}
      style={[styles.spotlightCard, isActive && styles.spotlightCardActive]}
    >
      <CoverArt uri={song.cover_url} size={118} radius={18} />
      <View style={styles.spotlightText}>
        <Text style={styles.spotlightEyebrow} numberOfLines={1}>{t('home.spotlightSingle')}</Text>
        <Text style={styles.spotlightTitle} numberOfLines={1}>{song.title}</Text>
        <Text style={styles.spotlightArtist} numberOfLines={1}>
          {song.artist_name || song.creatorName || t('common.creator')}
        </Text>
        <Text style={styles.spotlightCopy} numberOfLines={3}>{song.spotlight_copy?.trim() || t('home.spotlightBubbleButtCopy')}</Text>
        <View style={[styles.spotlightAction, isActive && styles.spotlightActionActive]}>
          {isLoading ? (
            <ActivityIndicator color={theme.colors.text} size="small" />
          ) : (
            <Ionicons name={isActive && isPlaying ? 'pause' : 'play'} size={15} color={theme.colors.text} />
          )}
          <Text style={styles.spotlightActionText}>
            {isActive && isPlaying ? t('playlist.pause') : t('playlist.play')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const SpotlightArtistSlide = memo(function SpotlightArtistSlide({
  artist,
  onOpen,
}: {
  artist: SpotlightArtist;
  onOpen: (artistName: string) => void;
}) {
  const { t } = useI18n();
  const copy = artist.spotlight_copy?.trim();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.92}
      onPress={() => onOpen(artist.artist_name)}
      style={styles.spotlightCard}
    >
      <CoverArt uri={artist.cover_url} size={118} radius={18} />
      <View style={styles.spotlightText}>
        <Text style={styles.spotlightEyebrow} numberOfLines={1}>{t('home.spotlightArtistEyebrow')}</Text>
        <Text style={styles.spotlightTitle} numberOfLines={1}>{artist.artist_name}</Text>
        <Text style={styles.spotlightArtist} numberOfLines={1}>
          {t('home.spotlightArtistStats', { songs: artist.song_count, plays: formatPlays(artist.total_plays) })}
        </Text>
        {copy ? <Text style={styles.spotlightCopy} numberOfLines={3}>{copy}</Text> : null}
        <View style={styles.spotlightAction}>
          <Ionicons name="person" size={15} color={theme.colors.text} />
          <Text style={styles.spotlightActionText}>{t('home.spotlightArtistCta')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const SpotlightPlaylistSlide = memo(function SpotlightPlaylistSlide({
  playlist,
  onOpen,
}: {
  playlist: SpotlightPlaylist;
  onOpen: (playlistId: string) => void;
}) {
  const { t } = useI18n();
  const isDailyNewReleases = playlist.id === DAILY_NEW_RELEASES_PLAYLIST_ID || playlist.id === 'daily-new-releases';
  const description = playlist.description?.trim();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.92}
      onPress={() => onOpen(playlist.id)}
      style={styles.spotlightCard}
    >
      {isDailyNewReleases && !playlist.cover_url ? (
        <YoriaxPlaylistCover size={118} radius={18} />
      ) : (
        <CoverArt uri={playlist.cover_url} size={118} radius={18} />
      )}
      <View style={styles.spotlightText}>
        <Text style={styles.spotlightEyebrow} numberOfLines={1}>{t('home.spotlightPlaylistEyebrow')}</Text>
        <Text style={styles.spotlightTitle} numberOfLines={1}>{playlist.title}</Text>
        <Text style={styles.spotlightArtist} numberOfLines={1}>{playlist.creatorName}</Text>
        {description ? <Text style={styles.spotlightCopy} numberOfLines={3}>{description}</Text> : null}
        <View style={styles.spotlightAction}>
          <Ionicons name="play-skip-forward" size={15} color={theme.colors.text} />
          <Text style={styles.spotlightActionText}>{t('home.spotlightPlaylistCta')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const SongRail = memo(function SongRail({ title, songs }: { title: string; songs: Song[] }) {
  const { activeSong, isPlaying, playSong, setQueue, toggle } = usePlayerControls();

  const handlePlay = useCallback((song: Song, list: Song[], index: number) => {
    setQueue(list, index);
    void playSong(song);
  }, [setQueue, playSong]);

  if (songs.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.songRail}>
        {songs.map((song, index, arr) => {
          const isActive = activeSong?.id === song.id;

          return (
            <SongRailItem
              key={song.id}
              song={song}
              index={index}
              list={arr}
              isActive={isActive}
              isPlaying={isActive ? isPlaying : false}
              onPlay={handlePlay}
              onToggle={toggle}
            />
          );
        })}
      </ScrollView>
    </View>
  );
});

const PlaylistRailItem = memo(function PlaylistRailItem({
  playlist,
  onPress,
}: {
  playlist: DiscoverPlaylist;
  onPress: (id: string) => void;
}) {
  const { t } = useI18n();
  const isDailyNewReleases = playlist.id === DAILY_NEW_RELEASES_PLAYLIST_ID || playlist.id === 'daily-new-releases';

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.96}
      onPress={() => onPress(playlist.id)}
      style={styles.songCard}
    >
      {isDailyNewReleases ? (
        <YoriaxPlaylistCover size={132} radius={18} />
      ) : (
        <CoverArt uri={playlist.cover_url} size={132} radius={18} />
      )}
      <Text style={styles.songTitle} numberOfLines={1}>
        {playlist.title}
      </Text>
      <Text style={styles.songArtist} numberOfLines={1}>
        {t('playlistDiscover.by', { creator: playlist.creatorName })}
        {playlist.isOfficial && (
          <>
            {' '}
            <Ionicons name="shield-checkmark" size={12} color="#5eead4" />
          </>
        )}
      </Text>
      {playlist.description ? (
        <Text style={styles.songMeta} numberOfLines={1}>
          {playlist.description}
        </Text>
      ) : (
        <Text style={styles.songMeta}>
          {t('playlistDiscover.publicPlaylist')}
        </Text>
      )}
    </TouchableOpacity>
  );
});

const PlaylistRail = memo(function PlaylistRail({
  title,
  playlists,
  onPressPlaylist,
}: {
  title: string;
  playlists: DiscoverPlaylist[];
  onPressPlaylist: (id: string) => void;
}) {
  if (!playlists || playlists.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.songRail}>
        {playlists.map((playlist) => (
          <PlaylistRailItem
            key={playlist.id}
            playlist={playlist}
            onPress={onPressPlaylist}
          />
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  content: {
    gap: theme.spacing.section,
    paddingBottom: 230,
    paddingHorizontal: theme.spacing.screen,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickTileShell: {
    width: '48.5%',
  },
  quickTile: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 12,
    width: '100%',
  },
  quickIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  quickLabel: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
  },
  sections: {
    gap: 28,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  songRail: {
    gap: 14,
    paddingRight: 20,
  },
  songCard: {
    borderColor: 'transparent',
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    padding: 8,
    width: 150,
  },
  songCardActive: {
    borderColor: 'rgba(168,85,247,0.42)',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  spotlightAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    height: 32,
    justifyContent: 'center',
    marginTop: 10,
    minWidth: 104,
    paddingHorizontal: 12,
  },
  spotlightActionActive: {
    backgroundColor: 'rgba(124,58,237,0.72)',
    borderColor: 'rgba(196,181,253,0.46)',
  },
  spotlightActionText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  spotlightArtist: {
    color: '#a78bfa',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  spotlightCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 146,
    overflow: 'hidden',
    padding: 12,
  },
  spotlightCardActive: {
    borderColor: 'rgba(168,85,247,0.54)',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  spotlightCopy: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 7,
  },
  spotlightEyebrow: {
    color: '#5eead4',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  spotlightText: {
    flex: 1,
    minWidth: 0,
  },
  spotlightTitle: {
    color: theme.colors.text,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 4,
  },
  spotlightHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  spotlightSwipeHint: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  spotlightSwipeHintText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  spotlightDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 2,
  },
  spotlightDot: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  spotlightDotActive: {
    backgroundColor: theme.colors.primaryLight,
    width: 18,
  },
  playBadge: {
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: theme.radii.round,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    top: 96,
    width: 36,
  },
  playBadgeActive: {
    backgroundColor: theme.colors.primary,
  },
  songTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 10,
  },
  songTitleActive: {
    color: theme.colors.primaryLight,
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
