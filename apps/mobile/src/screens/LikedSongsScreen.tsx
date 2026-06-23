import { Alert, FlatList, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { memo, useCallback, useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackButton, CoverArt, StateCard } from '../components/YoriaxUI';
import { useAuth } from '../lib/auth-context';
import { loadLibraryMusic, type LibraryMusicData } from '../lib/music-data';
import { usePlayerControls } from '../lib/player-context';
import type { Song } from '../lib/types';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { formatDuration } from '../lib/format';
import { useI18n } from '../lib/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'LikedSongs'>;
const EMPTY_SONGS: Song[] = [];
const CONTEXT_BUTTON_HIT_SLOP = { top: 10, right: 10, bottom: 10, left: 10 };

function RowSeparator() {
  return <View style={styles.rowSeparator} />;
}

const LikedSongRow = memo(function LikedSongRow({
  active,
  index,
  isPlaying,
  onOpenMenu,
  onPlay,
  song,
}: {
  active: boolean;
  index: number;
  isPlaying: boolean;
  onOpenMenu: (song: Song) => void;
  onPlay: (song: Song, index: number) => void;
  song: Song;
}) {
  const { t } = useI18n();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => onPlay(song, index)}
      style={[styles.row, active && styles.rowActive]}
    >
      <CoverArt uri={song.cover_url} size={52} radius={12} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, active && styles.rowTitleActive]} numberOfLines={1}>{song.title}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {song.artist_name || song.creatorName || t('common.creator')}
        </Text>
      </View>
      {active && isPlaying ? <Ionicons name="volume-high" size={18} color={theme.colors.primaryLight} /> : null}
      <TouchableOpacity
        accessibilityRole="button"
        hitSlop={CONTEXT_BUTTON_HIT_SLOP}
        onPress={(event) => {
          event.stopPropagation();
          onOpenMenu(song);
        }}
        style={styles.contextButton}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

export function LikedSongsScreen({ navigation }: Props) {
  const { locale, t } = useI18n();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [data, setData] = useState<LibraryMusicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playlistSongId, setPlaylistSongId] = useState<string | null>(null);
  const { activeSong, isPlaying, playSong, setQueue, toggleShuffle } = usePlayerControls();

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) return;
      setLoading(true);
      setError(null);

      try {
        const nextData = await loadLibraryMusic(user.id);
        if (mounted) setData(nextData);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : t('liked.error'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [t, user]);

  const likedSongs = data?.likedSongs ?? EMPTY_SONGS;

  const handlePlayAll = useCallback(() => {
    if (likedSongs.length === 0) return;
    setQueue(likedSongs, 0);
    void playSong(likedSongs[0]);
  }, [likedSongs, playSong, setQueue]);

  const handleShuffle = useCallback(() => {
    if (likedSongs.length === 0) return;
    toggleShuffle();
    setQueue(likedSongs, 0);
    void playSong(likedSongs[0]);
  }, [likedSongs, playSong, setQueue, toggleShuffle]);

  const handlePlaySong = useCallback((song: Song, index: number) => {
    setQueue(likedSongs, index);
    void playSong(song);
  }, [likedSongs, playSong, setQueue]);

  const handleContextMenu = useCallback((song: Song) => {
    Alert.alert(
      song.title,
      t('liked.menuCopy'),
      [
        {
          text: t('player.share'),
          onPress: () => {
            void Share.share({
              message: t('player.shareMessage', {
                title: song.title,
                url: `https://www.yoriax.com/song/${song.id}`,
              }),
              title: song.title,
            });
          },
        },
        { text: t('liked.addToPlaylist'), onPress: () => setPlaylistSongId(song.id) },
        {
          text: t('liked.openArtist'),
          onPress: () => navigation.navigate('Artist', { artistId: song.artist_name || song.creatorName || song.creator_id || 'unknown' }),
        },
        {
          text: t('player.details'),
          onPress: () => {
            Alert.alert(
              song.title,
              [
                song.artist_name || song.creatorName || t('common.creator'),
                song.genre ? `Genre: ${song.genre}` : null,
                song.duration ? t('player.duration', { duration: formatDuration(song.duration) }) : null,
                `${t('common.streams')}: ${song.plays.toLocaleString(locale === 'de' ? 'de-DE' : 'en-US')}`,
              ].filter(Boolean).join('\n'),
            );
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ],
      { cancelable: true },
    );
  }, [locale, navigation, t]);

  const renderSong = useCallback(({ item, index }: { item: Song; index: number }) => {
    const active = activeSong?.id === item.id;

    return (
      <LikedSongRow
        active={active}
        index={index}
        isPlaying={active && isPlaying}
        onOpenMenu={handleContextMenu}
        onPlay={handlePlaySong}
        song={item}
      />
    );
  }, [activeSong?.id, handleContextMenu, handlePlaySong, isPlaying]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(124,58,237,0.38)', 'rgba(124,58,237,0.12)', 'transparent']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { top: Math.max(insets.top + 8, 18) }]}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 60, 86) }]}
        data={loading || error ? EMPTY_SONGS : likedSongs}
        extraData={`${activeSong?.id ?? ''}:${isPlaying ? '1' : '0'}`}
        initialNumToRender={10}
        ItemSeparatorComponent={RowSeparator}
        keyExtractor={(item) => item.id}
        maxToRenderPerBatch={10}
        renderItem={renderSong}
        showsVerticalScrollIndicator={false}
        updateCellsBatchingPeriod={32}
        windowSize={7}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Ionicons name="heart" size={30} color={theme.colors.text} />
              </View>
              <View style={styles.heroText}>
                <Text style={styles.eyebrow}>PLAYLIST</Text>
                <Text style={styles.heroTitle}>{t('liked.title')}</Text>
                <Text style={styles.heroMeta}>{likedSongs.length} {t('common.songs')}</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={likedSongs.length === 0}
                onPress={handleShuffle}
                style={[styles.secondaryButton, likedSongs.length === 0 && styles.disabledButton]}
              >
                <Ionicons name="shuffle" size={22} color={likedSongs.length === 0 ? theme.colors.subtle : theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={likedSongs.length === 0}
                onPress={handlePlayAll}
                style={[styles.playButton, likedSongs.length === 0 && styles.disabledButton]}
              >
                <Ionicons name="play" size={28} color={likedSongs.length === 0 ? theme.colors.subtle : '#050505'} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <StateCard title={t('liked.loading')} message={t('liked.loadingCopy')} loading />
            ) : error ? (
              <StateCard icon="warning" title={t('liked.error')} message={error} />
            ) : likedSongs.length === 0 ? (
              <StateCard icon="heart-outline" title={t('liked.empty')} message={t('liked.emptyCopy')} />
            ) : null}
          </>
        }
      />
      {playlistSongId ? (
        <AddToPlaylistModal
          visible={Boolean(playlistSongId)}
          songId={playlistSongId}
          onClose={() => setPlaylistSongId(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  header: {
    left: 20,
    position: 'absolute',
    top: 18,
    zIndex: 10,
  },
  content: {
    paddingBottom: 170,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 86,
  },
  hero: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 18,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 26,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    width: 88,
  },
  heroText: {
    flex: 1,
    paddingBottom: 4,
  },
  eyebrow: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 6,
  },
  heroMeta: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'flex-end',
    marginBottom: 18,
    marginTop: 24,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.round,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  playButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radii.round,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  disabledButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  rowSeparator: {
    height: 8,
  },
  row: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: 'transparent',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 8,
  },
  rowActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: 'rgba(168,85,247,0.42)',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  rowTitleActive: {
    color: theme.colors.primaryLight,
  },
  rowMeta: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  contextButton: {
    padding: 8,
  },
});
