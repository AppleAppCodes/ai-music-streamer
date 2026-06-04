import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { loadCreatedSongs } from '../lib/music-data';
import { usePlayer } from '../lib/player-context';
import type { Song } from '../lib/types';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeSong, isPlaying, playSong, setQueue } = usePlayer();

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user) return;
      setLoading(true);
      const data = await loadCreatedSongs(user.id);
      if (mounted) {
        setSongs(data);
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [user]);

  const handlePlaySong = (song: Song, index: number) => {
    setQueue(songs, index);
    void playSong(song);
  };

  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void signOut()} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroSection}>
          <View style={styles.heroIconBox}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.heroAvatarText}>{username.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.heroTitle}>@{username}</Text>
          <Text style={styles.heroMeta}>Dein Profil</Text>
        </View>

        <Text style={styles.sectionTitle}>Deine erstellten Songs</Text>
        
        {loading ? (
          <ActivityIndicator color={theme.colors.text} style={styles.loader} />
        ) : songs.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Keine eigenen Songs</Text>
            <Text style={styles.emptyCopy}>Wenn du in der YORIAX Web-App Songs erstellst, tauchen sie hier auf.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {songs.map((song, index) => {
              const isActive = activeSong?.id === song.id;
              return (
                <TouchableOpacity
                  key={song.id}
                  style={[styles.itemRow, isActive && styles.itemRowActive]}
                  onPress={() => handlePlaySong(song, index)}
                >
                  {song.cover_url ? (
                    <Image source={{ uri: song.cover_url }} style={styles.itemImage} />
                  ) : (
                    <View style={[styles.itemImage, styles.itemFallback]}>
                      <Text style={styles.itemFallbackText}>Y</Text>
                    </View>
                  )}
                  <View style={styles.itemText}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{song.title}</Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>{song.genre || 'AI Music'}</Text>
                  </View>
                  <Text style={styles.rowPlayState}>{isActive && isPlaying ? 'II' : '▶'}</Text>
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
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  logoutButton: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: '800',
    fontSize: 14,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroIconBox: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  heroAvatarText: {
    fontSize: 64,
    fontWeight: '900',
    color: theme.colors.text,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 4,
  },
  heroMeta: {
    fontSize: 16,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  loader: {
    marginTop: 40,
  },
  emptyBox: {
    borderColor: theme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginTop: 10,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyCopy: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  list: {
    gap: 10,
  },
  itemRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: theme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
  },
  itemRowActive: {
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderColor: 'rgba(124,58,237,0.42)',
  },
  itemImage: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 12,
    height: 56,
    width: 56,
  },
  itemFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemFallbackText: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  itemMeta: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  rowPlayState: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    width: 28,
  },
});
