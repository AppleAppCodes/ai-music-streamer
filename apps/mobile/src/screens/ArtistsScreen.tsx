import { FlatList, StyleSheet, Text, TouchableOpacity, View, type ViewToken } from 'react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackButton, CoverArt, StateCard } from '../components/YoriaxUI';
import { loadArtistsData, type ArtistStat } from '../lib/music-data';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Artists'>;
type ArtistsNavigation = NativeStackNavigationProp<RootStackParamList, 'Artists'>;
const ARTIST_VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 55 };

function haveSameItems(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return left.size === right.size && Array.from(left).every((item) => right.has(item));
}

const ActiveArtistVideo = memo(function ActiveArtistVideo({ uri }: { uri: string }) {
  const videoPlayer = useVideoPlayer({ uri }, (player) => {
    player.loop = true;
    player.muted = true;
  });

  useEffect(() => {
    videoPlayer.play();

    return () => {
      videoPlayer.pause();
    };
  }, [videoPlayer]);

  return (
    <VideoView
      contentFit="cover"
      nativeControls={false}
      player={videoPlayer}
      playsInline
      style={styles.cardMedia}
    />
  );
});

const ArtistCard = memo(function ArtistCard({
  isVideoActive,
  item,
  navigation,
}: {
  isVideoActive: boolean;
  item: ArtistStat;
  navigation: ArtistsNavigation;
}) {
  const videoUrl = item.videoUrl || null;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => navigation.navigate('Artist', { artistId: item.name })}
      style={styles.card}
    >
      <View style={styles.cardInner}>
        <CoverArt uri={item.coverUrl} size={220} radius={0} style={styles.cardMedia} />
        {isVideoActive && videoUrl ? (
          <ActiveArtistVideo uri={videoUrl} />
        ) : null}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.54)', 'rgba(0,0,0,0.94)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardContent}>
          <Text style={styles.artistName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.statsRow}>
            <Ionicons name="musical-notes" size={12} color={theme.colors.accent} />
            <Text style={styles.statsText}>{item.songsCount} {item.songsCount === 1 ? 'Song' : 'Songs'}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export function ArtistsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [artists, setArtists] = useState<ArtistStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleArtistNames, setVisibleArtistNames] = useState<ReadonlySet<string>>(() => new Set());
  const onViewableItemsChanged = useCallback(({
    viewableItems,
  }: {
    viewableItems: Array<ViewToken<ArtistStat>>;
  }) => {
    const nextVisibleArtistNames = new Set(
      viewableItems
        .filter((viewToken) => viewToken.isViewable)
        .map((viewToken) => viewToken.item.name),
    );

    setVisibleArtistNames((current) => (
      haveSameItems(current, nextVisibleArtistNames) ? current : nextVisibleArtistNames
    ));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await loadArtistsData();
        if (mounted) setArtists(data);
      } catch {
        if (mounted) setError('Konnte Künstler nicht laden.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const renderArtist = useCallback(({ item }: { item: ArtistStat }) => (
    <ArtistCard
      isVideoActive={isFocused && visibleArtistNames.has(item.name)}
      item={item}
      navigation={navigation}
    />
  ), [isFocused, navigation, visibleArtistNames]);

  const videoRenderState = useMemo(() => ({
    isFocused,
    visibleArtistNames,
  }), [isFocused, visibleArtistNames]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(45,212,191,0.20)', 'rgba(124,58,237,0.14)', 'transparent']}
        style={styles.glow}
      />
      <View style={[styles.header, { top: Math.max(insets.top + 8, 18) }]}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <FlatList
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[styles.listContent, { paddingTop: Math.max(insets.top + 60, 84) }]}
        data={artists}
        extraData={videoRenderState}
        initialNumToRender={4}
        keyExtractor={(item) => item.name}
        maxToRenderPerBatch={4}
        numColumns={2}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={renderArtist}
        showsVerticalScrollIndicator={false}
        updateCellsBatchingPeriod={50}
        viewabilityConfig={ARTIST_VIEWABILITY_CONFIG}
        windowSize={5}
        ListHeaderComponent={
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <LinearGradient
                colors={[theme.colors.accent, theme.colors.primaryLight]}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="mic" size={38} color={theme.colors.text} />
            </View>
            <Text style={styles.eyebrow}>ENTDECKEN</Text>
            <Text style={styles.heroTitle}>Künstler entdecken</Text>
            <Text style={styles.heroMeta}>Videos, Cover und Creator aus dem YORIAX-Kosmos.</Text>
            <View style={styles.statsBadge}>
              <Ionicons name="people" size={14} color={theme.colors.text} />
              <Text style={styles.statsBadgeText}>{artists.length} Künstler</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <StateCard title="Künstler werden geladen" message="Wir suchen aktuelle Creator und Videos." loading />
          ) : error ? (
            <StateCard icon="warning" title="Künstler nicht verfügbar" message={error} />
          ) : (
            <StateCard icon="mic-outline" title="Keine Künstler gefunden" message="Sobald Songs veröffentlicht sind, erscheinen die Künstler hier." />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  glow: {
    borderRadius: 260,
    height: 330,
    left: -80,
    position: 'absolute',
    right: -80,
    top: -150,
  },
  header: {
    left: 20,
    position: 'absolute',
    top: 18,
    zIndex: 10,
  },
  listContent: {
    paddingBottom: 170,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 84,
  },
  columnWrapper: {
    gap: 14,
    marginBottom: 14,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroIcon: {
    alignItems: 'center',
    borderColor: theme.colors.borderStrong,
    borderRadius: 28,
    borderWidth: 1,
    height: 86,
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    width: 86,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 6,
    textAlign: 'center',
  },
  heroMeta: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 300,
    textAlign: 'center',
  },
  statsBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statsBadgeText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  card: {
    flex: 1,
    height: 202,
  },
  cardInner: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
  },
  cardMedia: {
    height: '100%',
    position: 'absolute',
    width: '100%',
  },
  cardContent: {
    bottom: 0,
    left: 0,
    padding: 14,
    position: 'absolute',
    right: 0,
  },
  artistName: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  statsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
  },
  statsText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
});
