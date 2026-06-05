import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackButton, CoverArt, StateCard } from '../components/YoriaxUI';
import { loadDiscoverPlaylists, type DiscoverPlaylistsData } from '../lib/music-data';
import type { DiscoverPlaylist } from '../lib/types';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PlaylistDiscover'>;
type Accent = 'teal' | 'purple';

const ACCENTS: Record<Accent, string> = {
  purple: theme.colors.primaryLight,
  teal: theme.colors.accent,
};

export function PlaylistDiscoverScreen({ navigation }: Props) {
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
        if (mounted) setError('Konnte Playlists nicht laden.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    const timer = setTimeout(load, 250);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [query]);

  const officialPlaylists = data?.officialPlaylists ?? [];
  const communityPlaylists = data?.communityPlaylists ?? [];
  const totalPlaylists = officialPlaylists.length + communityPlaylists.length;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(45,212,191,0.22)', 'rgba(124,58,237,0.16)', 'transparent']}
        style={styles.heroGlow}
      />

      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerText}>
          <Text style={styles.headerEyebrow}>ENTDECKEN</Text>
          <Text style={styles.headerTitle}>Playlists</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(124,58,237,0.22)', 'rgba(45,212,191,0.10)', 'rgba(255,255,255,0.03)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroIcon}>
            <Ionicons name="library" size={30} color={theme.colors.text} />
          </View>
          <Text style={styles.heroTitle}>Community & kuratiert</Text>
          <Text style={styles.heroMeta}>
            Finde offizielle YORIAX-Sammlungen und öffentliche Playlists aus der Community.
          </Text>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.colors.muted} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Playlists durchsuchen"
            placeholderTextColor={theme.colors.subtle}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>

        {loading ? (
          <StateCard title="Playlists werden geladen" message="Wir holen öffentliche Sammlungen." loading />
        ) : error ? (
          <StateCard icon="warning" title="Playlists nicht verfügbar" message={error} />
        ) : totalPlaylists === 0 ? (
          <StateCard icon="search" title="Keine Playlists gefunden" message="Zu deiner Suche gibt es aktuell keine öffentlichen Playlists." />
        ) : (
          <>
            <PlaylistSection
              accent="teal"
              emptyText="Noch keine kuratierten offiziellen Playlists."
              icon="sparkles"
              onOpen={(playlistId) => navigation.navigate('Playlist', { playlistId })}
              playlists={officialPlaylists}
              subtitle="Von YORIAX ausgewählte Sammlungen."
              title="Kuratierte offizielle Playlists"
            />
            <PlaylistSection
              accent="purple"
              emptyText="Noch keine Community Playlists."
              icon="people"
              onOpen={(playlistId) => navigation.navigate('Playlist', { playlistId })}
              playlists={communityPlaylists}
              subtitle="Öffentliche Playlists anderer Nutzer."
              title="Community Playlists"
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PlaylistSection({
  accent,
  emptyText,
  icon,
  onOpen,
  playlists,
  subtitle,
  title,
}: {
  accent: Accent;
  emptyText: string;
  icon: keyof typeof Ionicons.glyphMap;
  onOpen: (playlistId: string) => void;
  playlists: DiscoverPlaylist[];
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
        <Text style={[styles.countBadge, { color: tint }]}>{playlists.length}</Text>
      </View>

      {playlists.length === 0 ? (
        <View style={styles.emptySection}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        <View style={styles.cards}>
          {playlists.map((playlist) => (
            <PlaylistCard
              accent={accent}
              key={playlist.id}
              onPress={() => onOpen(playlist.id)}
              playlist={playlist}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function PlaylistCard({
  accent,
  onPress,
  playlist,
}: {
  accent: Accent;
  onPress: () => void;
  playlist: DiscoverPlaylist;
}) {
  const tint = ACCENTS[accent];

  return (
    <TouchableOpacity accessibilityRole="button" activeOpacity={0.82} onPress={onPress} style={styles.card}>
      <LinearGradient
        colors={[`${tint}24`, 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']}
        style={StyleSheet.absoluteFill}
      />
      <CoverArt uri={playlist.cover_url} size={82} radius={18} />
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, playlist.isOfficial && { color: tint }]} numberOfLines={1}>
          {playlist.title}
        </Text>
        <Text style={styles.cardCreator} numberOfLines={1}>
          Von {playlist.creatorName}
        </Text>
        {playlist.description ? (
          <Text style={styles.cardDescription} numberOfLines={2}>{playlist.description}</Text>
        ) : (
          <Text style={styles.cardDescription} numberOfLines={1}>Öffentliche Playlist</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.subtle} />
    </TouchableOpacity>
  );
}

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
    gap: 18,
    paddingBottom: 170,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 20,
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
    gap: 12,
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
  cards: {
    gap: 10,
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
