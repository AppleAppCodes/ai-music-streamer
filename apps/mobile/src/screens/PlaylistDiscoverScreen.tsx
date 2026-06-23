import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useEffect, useState, memo, useCallback, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackButton, CoverArt, StateCard, YoriaxPlaylistCover } from '../components/YoriaxUI';
import {
  DAILY_NEW_RELEASES_PLAYLIST_ID,
  loadDiscoverPlaylists,
  type DiscoverPlaylistsData,
} from '../lib/music-data';
import type { DiscoverPlaylist } from '../lib/types';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useI18n } from '../lib/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'PlaylistDiscover'>;
type Accent = 'teal' | 'purple';
type PlaylistListItem =
  | {
      kind: 'section';
      accent: Accent;
      count: number;
      emptyText: string;
      icon: keyof typeof Ionicons.glyphMap;
      subtitle: string;
      title: string;
    }
  | {
      kind: 'playlist';
      accent: Accent;
      playlist: DiscoverPlaylist;
    }
  | {
      kind: 'empty';
      text: string;
    };

const ACCENTS: Record<Accent, string> = {
  purple: theme.colors.primaryLight,
  teal: theme.colors.accent,
};
const EMPTY_PLAYLISTS: DiscoverPlaylist[] = [];
const EMPTY_LIST_ITEMS: PlaylistListItem[] = [];

function PlaylistItemSeparator() {
  return <View style={styles.itemSeparator} />;
}

export function PlaylistDiscoverScreen({ navigation }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [data, setData] = useState<DiscoverPlaylistsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextData = await loadDiscoverPlaylists(query);
        if (mounted) setData(nextData);
      } catch {
        if (mounted) setError(t('playlistDiscover.loadError'));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    const timer = setTimeout(load, 250);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [query, t]);

  const officialPlaylists = data?.officialPlaylists ?? EMPTY_PLAYLISTS;
  const communityPlaylists = data?.communityPlaylists ?? EMPTY_PLAYLISTS;
  const totalPlaylists = officialPlaylists.length + communityPlaylists.length;

  const handleOpenPlaylist = useCallback((playlistId: string) => {
    navigation.navigate('Playlist', { playlistId });
  }, [navigation]);
  const listItems = useMemo<PlaylistListItem[]>(() => {
    if (loading || error || totalPlaylists === 0) return EMPTY_LIST_ITEMS;

    const items: PlaylistListItem[] = [
      {
        kind: 'section',
        accent: 'teal',
        count: officialPlaylists.length,
        emptyText: t('playlistDiscover.curatedEmpty'),
        icon: 'sparkles',
        subtitle: t('playlistDiscover.curatedSectionCopy'),
        title: t('playlistDiscover.curatedSection'),
      },
    ];

    if (officialPlaylists.length > 0) {
      officialPlaylists.forEach((playlist) => {
        items.push({ kind: 'playlist', accent: 'teal', playlist });
      });
    } else {
      items.push({ kind: 'empty', text: t('playlistDiscover.curatedEmpty') });
    }

    items.push({
      kind: 'section',
      accent: 'purple',
      count: communityPlaylists.length,
      emptyText: t('playlistDiscover.communityEmpty'),
      icon: 'people',
      subtitle: t('playlistDiscover.communitySectionCopy'),
      title: t('playlistDiscover.communitySection'),
    });

    if (communityPlaylists.length > 0) {
      communityPlaylists.forEach((playlist) => {
        items.push({ kind: 'playlist', accent: 'purple', playlist });
      });
    } else {
      items.push({ kind: 'empty', text: t('playlistDiscover.communityEmpty') });
    }

    return items;
  }, [communityPlaylists, error, loading, officialPlaylists, t, totalPlaylists]);
  const renderListItem = useCallback(({ item }: { item: PlaylistListItem }) => {
    if (item.kind === 'section') {
      return (
        <PlaylistSectionHeader
          accent={item.accent}
          count={item.count}
          icon={item.icon}
          subtitle={item.subtitle}
          title={item.title}
        />
      );
    }

    if (item.kind === 'empty') {
      return (
        <View style={styles.emptySection}>
          <Text style={styles.emptyText}>{item.text}</Text>
        </View>
      );
    }

    return (
      <PlaylistCard
        accent={item.accent}
        onOpen={handleOpenPlaylist}
        playlist={item.playlist}
      />
    );
  }, [handleOpenPlaylist]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(45,212,191,0.22)', 'rgba(124,58,237,0.16)', 'transparent']}
        style={styles.heroGlow}
      />

      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerText}>
          <Text style={styles.headerEyebrow}>{t('playlistDiscover.eyebrow')}</Text>
          <Text style={styles.headerTitle}>Playlists</Text>
        </View>
      </View>

      <FlatList
        contentContainerStyle={styles.content}
        data={listItems}
        initialNumToRender={8}
        ItemSeparatorComponent={PlaylistItemSeparator}
        keyExtractor={(item, index) => item.kind === 'playlist'
          ? `playlist-${item.playlist.id}`
          : `${item.kind}-${index}`}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.heroCard}>
              <LinearGradient
                colors={['rgba(124,58,237,0.22)', 'rgba(45,212,191,0.10)', 'rgba(255,255,255,0.03)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.heroIcon}>
                <Ionicons name="library" size={30} color={theme.colors.text} />
              </View>
              <Text style={styles.heroTitle}>{t('playlistDiscover.community')}</Text>
              <Text style={styles.heroMeta}>{t('playlistDiscover.communityCopy')}</Text>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={theme.colors.muted} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder={t('playlistDiscover.search')}
                placeholderTextColor={theme.colors.subtle}
                returnKeyType="search"
                style={styles.searchInput}
                value={query}
              />
            </View>

            {loading ? (
              <StateCard title={t('playlistDiscover.loading')} message={t('playlistDiscover.loadingCopy')} loading />
            ) : error ? (
              <StateCard icon="warning" title={t('playlistDiscover.unavailable')} message={error} />
            ) : totalPlaylists === 0 ? (
              <StateCard icon="search" title={t('playlistDiscover.empty')} message={t('playlistDiscover.emptyCopy')} />
            ) : null}
          </View>
        }
        maxToRenderPerBatch={8}
        renderItem={renderListItem}
        showsVerticalScrollIndicator={false}
        updateCellsBatchingPeriod={32}
        windowSize={7}
      />
    </View>
  );
}

const PlaylistSectionHeader = memo(function PlaylistSectionHeader({
  accent,
  count,
  icon,
  subtitle,
  title,
}: {
  accent: Accent;
  count: number;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
  title: string;
}) {
  const tint = ACCENTS[accent];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: `${tint}1f`, borderColor: `${tint}4d` }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        <Text style={[styles.countBadge, { color: tint }]}>{count}</Text>
      </View>
    </View>
  );
});

const PlaylistCard = memo(function PlaylistCard({
  accent,
  onOpen,
  playlist,
}: {
  accent: Accent;
  onOpen: (playlistId: string) => void;
  playlist: DiscoverPlaylist;
}) {
  const { t } = useI18n();
  const tint = ACCENTS[accent];
  const isDailyNewReleases = playlist.id === DAILY_NEW_RELEASES_PLAYLIST_ID;
  const description = isDailyNewReleases
    ? t('playlistDiscover.dailyNewReleasesCopy')
    : playlist.description;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.82}
      onPress={() => onOpen(playlist.id)}
      style={styles.card}
    >
      <LinearGradient
        colors={[`${tint}24`, 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']}
        style={StyleSheet.absoluteFill}
      />
      {isDailyNewReleases ? (
        <YoriaxPlaylistCover size={82} radius={18} />
      ) : (
        <CoverArt uri={playlist.cover_url} size={82} radius={18} />
      )}
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, playlist.isOfficial && { color: tint }]} numberOfLines={1}>
          {playlist.title}
        </Text>
        <Text style={styles.cardCreator} numberOfLines={1}>
          {t('playlistDiscover.by', { creator: playlist.creatorName })}
        </Text>
        {description ? (
          <Text style={styles.cardDescription} numberOfLines={2}>{description}</Text>
        ) : (
          <Text style={styles.cardDescription} numberOfLines={1}>
            {t('playlistDiscover.publicPlaylist')}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.subtle} />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  heroGlow: {
    borderRadius: 260,
    height: 320,
    left: -90,
    position: 'absolute',
    right: -60,
    top: -160,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: theme.spacing.screen,
  },
  headerText: {
    flex: 1,
  },
  headerEyebrow: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  content: {
    paddingBottom: 170,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 20,
  },
  listHeader: {
    gap: 18,
    marginBottom: 18,
  },
  itemSeparator: {
    height: 10,
  },
  heroCard: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 22,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.borderStrong,
    borderRadius: 24,
    borderWidth: 1,
    height: 62,
    justifyContent: 'center',
    marginBottom: 16,
    width: 62,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroMeta: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 7,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  searchInput: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    padding: 0,
  },
  section: {
    marginTop: 8,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  sectionIcon: {
    alignItems: 'center',
    borderRadius: theme.radii.round,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  countBadge: {
    fontSize: 16,
    fontWeight: '900',
  },
  card: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    minHeight: 112,
    overflow: 'hidden',
    padding: 12,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  cardCreator: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  cardDescription: {
    color: theme.colors.subtle,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 7,
  },
  emptySection: {
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    padding: 18,
  },
  emptyText: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
});
