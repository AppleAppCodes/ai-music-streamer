import { ActivityIndicator, Alert, FlatList, Image, ImageBackground, Linking, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { theme } from '../theme';
import { usePlayerControls } from '../lib/player-context';
import { loadArtistSongs } from '../lib/music-data';
import type { Song } from '../lib/types';
import { formatPlays } from '../lib/format';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../lib/auth-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'Artist'>;
type StorageFile = { name: string; created_at?: string | null };
type ArtistSocials = {
  instagram_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
};

function ArtistSongSeparator() {
  return <View style={styles.songSeparator} />;
}

const ArtistSongRow = memo(function ArtistSongRow({
  active,
  index,
  isPlaying,
  onPlay,
  song,
}: {
  active: boolean;
  index: number;
  isPlaying: boolean;
  onPlay: (index: number) => void;
  song: Song;
}) {
  return (
    <TouchableOpacity
      style={styles.songRow}
      onPress={() => onPlay(index)}
    >
      <Text style={styles.songIndex}>{index + 1}</Text>
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
        <Text style={styles.songPlays}>{formatPlays(song.plays)}</Text>
      </View>
      {active && isPlaying ? (
        <View style={styles.playingIndicator}>
          <Text style={styles.playingText}>▶</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

export function ArtistScreen({ route, navigation }: Props) {
  const { locale, t } = useI18n();
  const { artistId: artistName } = route.params;
  const insets = useSafeAreaInsets();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [socials, setSocials] = useState<ArtistSocials | null>(null);

  const { user } = useAuth();
  const { activeSong, isPlaying, isShuffling, playSong, setQueue, toggle, toggleShuffle } = usePlayerControls();

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      setBannerUrl(null);
      setSocials(null);
      setIsFollowing(false);
      try {
        const data = await loadArtistSongs(artistName);
        if (mounted) setSongs(data);

        // Keep this in sync with the web artist page: covers/banners/<artist>...
        if (!supabase) throw new Error('Supabase Env fehlt.');
        const client = supabase;
        const sanitizedName = artistName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const { data: files, error: filesError } = await client.storage
          .from('covers')
          .list('banners', {
            limit: 100,
            search: sanitizedName,
          });

        if (!filesError && files && mounted) {
          const bannerFiles = (files as StorageFile[])
            .filter((file) => file.name.toLowerCase().startsWith(sanitizedName) && !file.name.includes('_video'));

          if (bannerFiles.length > 0) {
            bannerFiles.sort(
              (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
            );
            const { data: publicUrlData } = client.storage
              .from('covers')
              .getPublicUrl(`banners/${bannerFiles[0].name}`);
            setBannerUrl(publicUrlData.publicUrl);
          }
        }

        const [{ data: socialsData }, followResult] = await Promise.all([
          client
            .from('artist_profiles')
            .select('instagram_url, tiktok_url, youtube_url')
            .eq('artist_name', artistName)
            .maybeSingle(),
          user
            ? client
                .from('follows')
                .select('id')
                .eq('user_id', user.id)
                .eq('artist_name', artistName)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (mounted) {
          setSocials((socialsData as ArtistSocials | null) ?? null);
          setIsFollowing(Boolean(followResult.data));
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : t('artist.loadError'));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [artistName, t, user]);

  const totalPlays = useMemo(
    () => songs.reduce((acc, song) => acc + (song.plays || 0), 0),
    [songs],
  );
  const monthlyListeners = useMemo(() => getMonthlyListeners(songs), [songs]);
  const artistQueue = useMemo(
    () => songs.map((song) => ({ ...song, creatorName: song.creatorName || artistName })),
    [artistName, songs],
  );
  const hasSongs = artistQueue.length > 0;
  const isArtistActive = artistQueue.some((song) => song.id === activeSong?.id);
  const isArtistPlaying = isArtistActive && isPlaying;
  const hasSocials = Boolean(socials?.instagram_url || socials?.tiktok_url || socials?.youtube_url);

  function handlePlayAll() {
    if (!hasSongs) return;

    if (isArtistActive) {
      toggle();
      return;
    }

    setQueue(artistQueue, 0);
    void playSong(artistQueue[0]);
  }

  function handleShuffle() {
    if (!hasSongs) return;

    if (!isShuffling) {
      toggleShuffle();
    }

    const currentIndex = artistQueue.findIndex((song) => song.id === activeSong?.id);
    const startIndex = getShuffleStartIndex(artistQueue, currentIndex);
    setQueue(artistQueue, startIndex);
    void playSong(artistQueue[startIndex]);
  }

  const handleSongPress = useCallback((index: number) => {
    if (!artistQueue[index]) return;

    setQueue(artistQueue, index);
    void playSong(artistQueue[index]);
  }, [artistQueue, playSong, setQueue]);

  function handleShare() {
    void Share.share({
      message: t('artist.shareMessage', {
        artist: artistName,
        url: `https://www.yoriax.com/artist/${encodeURIComponent(artistName)}`,
      }),
      title: artistName,
    });
  }

  async function handleFollow() {
    if (!user || !supabase) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        const { error: followError } = await supabase
          .from('follows')
          .delete()
          .eq('user_id', user.id)
          .eq('artist_name', artistName);
        if (followError) throw new Error(followError.message);
        setIsFollowing(false);
      } else {
        const { error: followError } = await supabase
          .from('follows')
          .insert({ user_id: user.id, artist_name: artistName });
        if (followError) throw new Error(followError.message);
        setIsFollowing(true);
      }
    } catch (followError) {
      Alert.alert(
        t('artist.followError'),
        followError instanceof Error ? followError.message : t('onboarding.tryAgain'),
      );
    } finally {
      setFollowLoading(false);
    }
  }

  const renderSong = useCallback(({ item, index }: { item: Song; index: number }) => {
    const active = activeSong?.id === item.id;

    return (
      <ArtistSongRow
        active={active}
        index={index}
        isPlaying={active && isPlaying}
        onPlay={handleSongPress}
        song={item}
      />
    );
  }, [activeSong?.id, handleSongPress, isPlaying]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.86}
        onPress={() => navigation.goBack()}
        style={[styles.floatingBackButton, { top: insets.top + 10 }]}
      >
        <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        <Text style={styles.floatingBackText}>{t('artist.back')}</Text>
      </TouchableOpacity>
      <FlatList
        contentContainerStyle={styles.content}
        data={loading || error ? [] : songs}
        initialNumToRender={10}
        ItemSeparatorComponent={ArtistSongSeparator}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            {bannerUrl ? (
              <ImageBackground source={{ uri: bannerUrl }} style={styles.heroBanner}>
                <LinearGradient
                  colors={['rgba(12,10,18,0.10)', 'rgba(12,10,18,0.58)', '#0c0a12']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.heroContent}>
                  <VerifiedBadge label={t('artist.verified')} />
                  <Text style={styles.title} numberOfLines={1}>{artistName}</Text>
                  <Text style={styles.subtitle}>
                    {t('artist.listeners', { value: monthlyListeners.toLocaleString(locale === 'de' ? 'de-DE' : 'en-US') })}
                  </Text>
                  <Text style={styles.totalStreams}>{t('artist.totalStreams', { value: formatPlays(totalPlays) })}</Text>
                </View>
              </ImageBackground>
            ) : (
              <View style={styles.hero}>
                <VerifiedBadge label={t('artist.verified')} />
                <Text style={styles.title} numberOfLines={1}>{artistName}</Text>
                <Text style={styles.subtitle}>
                  {t('artist.listeners', { value: monthlyListeners.toLocaleString(locale === 'de' ? 'de-DE' : 'en-US') })}
                </Text>
                <Text style={styles.totalStreams}>{t('artist.totalStreams', { value: formatPlays(totalPlays) })}</Text>
              </View>
            )}

            {loading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color={theme.colors.text} />
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <View style={styles.section}>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.86}
                    disabled={!hasSongs}
                    onPress={handlePlayAll}
                    style={[styles.playAllButton, !hasSongs && styles.disabledButton]}
                  >
                    <Ionicons
                      name={isArtistPlaying ? 'pause' : 'play'}
                      size={28}
                      color="#050505"
                      style={!isArtistPlaying ? styles.playIconOffset : undefined}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.86}
                    disabled={!hasSongs}
                    onPress={handleShuffle}
                    style={[styles.secondaryAction, isShuffling && styles.secondaryActionActive, !hasSongs && styles.disabledButton]}
                  >
                    <Ionicons name="shuffle" size={22} color={isShuffling ? theme.colors.text : theme.colors.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" activeOpacity={0.86} onPress={handleShare} style={styles.secondaryAction}>
                    <Ionicons name="share-social" size={21} color={theme.colors.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.86}
                    disabled={followLoading}
                    onPress={() => {
                      void handleFollow();
                    }}
                    style={[styles.followButton, isFollowing && styles.followButtonActive, followLoading && styles.disabledButton]}
                  >
                    {followLoading ? (
                      <ActivityIndicator color={theme.colors.text} size="small" />
                    ) : (
                      <Ionicons name={isFollowing ? 'person' : 'person-add'} size={15} color={theme.colors.text} />
                    )}
                    <Text style={styles.followButtonText}>
                      {isFollowing ? t('artist.followed') : t('artist.follow')}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.songCountPill}>
                    <Text style={styles.songCountText}>{songs.length} {t('common.songs')}</Text>
                  </View>
                </View>
                {hasSocials ? (
                  <View style={styles.socialCard}>
                    <Text style={styles.socialLabel}>Socials</Text>
                    <View style={styles.socialActions}>
                      <SocialLink icon="logo-instagram" label="Instagram" tint="#E1306C" url={socials?.instagram_url} />
                      <SocialLink icon="logo-tiktok" label="TikTok" tint="#00f2fe" url={socials?.tiktok_url} />
                      <SocialLink icon="logo-youtube" label="YouTube" tint="#FF0033" url={socials?.youtube_url} />
                    </View>
                  </View>
                ) : null}
                <Text style={styles.sectionTitle}>{t('artist.popular')}</Text>
              </View>
            )}
          </>
        }
        maxToRenderPerBatch={10}
        renderItem={renderSong}
        showsVerticalScrollIndicator={false}
        updateCellsBatchingPeriod={32}
        windowSize={7}
      />
    </View>
  );
}

function VerifiedBadge({ label }: { label: string }) {
  return (
    <View style={styles.verifiedRow}>
      <View style={styles.verifiedIcon}>
        <Ionicons name="checkmark" size={12} color="#60a5fa" />
      </View>
      <Text style={styles.verifiedText}>{label}</Text>
    </View>
  );
}

function SocialLink({
  icon,
  label,
  tint,
  url,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  url?: string | null;
}) {
  const { t } = useI18n();
  if (!url) return null;
  const normalizedUrl = normalizeExternalUrl(url);
  if (!normalizedUrl) return null;

  return (
    <TouchableOpacity
      accessibilityLabel={label}
      accessibilityRole="link"
      activeOpacity={0.84}
      onPress={() => {
        void Linking.openURL(normalizedUrl).catch(() => {
          Alert.alert(t('artist.linkError'), t('artist.linkErrorCopy'));
        });
      }}
      style={styles.socialButton}
    >
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={styles.socialButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function getMonthlyListeners(songs: Song[]) {
  if (songs.length === 0) return 0;

  const totalPlays = songs.reduce((sum, song) => sum + (song.plays || 0), 0);
  const oldestSong = songs.reduce((oldest, song) => {
    const songDate = song.created_at ? new Date(song.created_at) : new Date();
    const oldestDate = oldest.created_at ? new Date(oldest.created_at) : new Date();
    return songDate < oldestDate ? song : oldest;
  }, songs[0]);
  const firstReleaseDate = oldestSong.created_at ? new Date(oldestSong.created_at) : new Date();
  const monthsActive = Math.max(1, (Date.now() - firstReleaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));

  return Math.round(totalPlays / monthsActive);
}

function normalizeExternalUrl(url: string) {
  const rawUrl = url.trim();
  if (!rawUrl) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(rawUrl)
    ? rawUrl
    : `https://${rawUrl}`;

  try {
    const parsedUrl = new URL(candidate);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return null;
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function getShuffleStartIndex(songs: Song[], currentIndex: number) {
  if (songs.length <= 1) return 0;
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  return (safeCurrentIndex + Math.max(1, Math.floor(songs.length / 2))) % songs.length;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  floatingBackButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(5,5,5,0.58)',
    borderColor: theme.colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    left: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    top: 14,
    zIndex: 20,
  },
  floatingBackText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  content: {
    paddingBottom: 120, // space for MiniPlayer
  },
  heroBanner: {
    justifyContent: 'flex-end',
    minHeight: 310,
    width: '100%',
  },
  heroContent: {
    alignItems: 'flex-start',
    paddingBottom: 34,
    paddingHorizontal: 28,
    zIndex: 1,
  },
  hero: {
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 28,
    paddingVertical: 36,
  },
  verifiedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  verifiedIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(96,165,250,0.16)',
    borderColor: 'rgba(96,165,250,0.58)',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  verifiedText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: theme.colors.text,
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: -1.6,
    maxWidth: '100%',
    textAlign: 'left',
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 12,
  },
  totalStreams: {
    color: theme.colors.subtle,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  stateBox: {
    padding: 40,
    alignItems: 'center',
  },
  errorBox: {
    margin: 20,
    padding: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.32)',
    borderWidth: 1,
    borderRadius: 12,
  },
  errorText: {
    color: '#fecaca',
    textAlign: 'center',
  },
  section: {
    padding: 20,
  },
  actionRow: {
    alignItems: 'center',
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  playAllButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    width: 58,
  },
  playIconOffset: {
    marginLeft: 3,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: theme.colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  secondaryActionActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primaryLight,
  },
  followButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: theme.colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  followButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderColor: 'rgba(255,255,255,0.38)',
  },
  followButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  disabledButton: {
    opacity: 0.42,
  },
  songCountPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 'auto',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  songCountText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  socialCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: theme.colors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
    padding: 14,
  },
  socialLabel: {
    color: theme.colors.subtle,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  socialActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  socialButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  socialButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 16,
  },
  songSeparator: {
    height: 12,
  },
  songRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  songIndex: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFallbackText: {
    color: theme.colors.muted,
    fontSize: 16,
    fontWeight: '900',
  },
  songInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  songTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  activeText: {
    color: theme.colors.primary,
  },
  songPlays: {
    color: theme.colors.subtle,
    fontSize: 12,
    fontWeight: '600',
  },
  playingIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingText: {
    color: theme.colors.background,
    fontSize: 10,
    fontWeight: '900',
  },
});
