import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme';
import { useAuth } from '../lib/auth-context';
import { addSongToPlaylist, createPlaylist, getUserPlaylists } from '../lib/music-data';
import type { Playlist } from '../lib/types';
import { Ionicons } from '@expo/vector-icons';

interface AddToPlaylistModalProps {
  visible: boolean;
  songId: string;
  onClose: () => void;
}

export function AddToPlaylistModal({ visible, songId, onClose }: AddToPlaylistModalProps) {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchPlaylists() {
      if (!user || !visible) return;
      setLoading(true);
      try {
        const data = await getUserPlaylists(user.id);
        if (mounted) setPlaylists(data);
      } catch (e) {
        console.error('Error fetching playlists:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchPlaylists();

    return () => {
      mounted = false;
    };
  }, [user, visible]);

  const handleAdd = async (playlistId: string) => {
    if (addingId) return;
    setAddingId(playlistId);
    try {
      await addSongToPlaylist(playlistId, songId);
      onClose();
    } catch (e) {
      console.error('Error adding to playlist:', e);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Zu Playlist hinzufügen</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.colors.text} />
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              <TouchableOpacity
                style={styles.playlistRow}
                onPress={() => {
                  Alert.prompt(
                    'Neue Playlist',
                    'Wie soll die Playlist heißen?',
                    [
                      { text: 'Abbrechen', style: 'cancel' },
                      {
                        text: 'Erstellen',
                        onPress: async (text?: string) => {
                          if (!text || !user) return;
                          setLoading(true);
                          try {
                            const newPlaylist = await createPlaylist(user.id, text);
                            setPlaylists([newPlaylist, ...playlists]);
                            await handleAdd(newPlaylist.id);
                          } catch (e) {
                            console.error(e);
                            setLoading(false);
                          }
                        },
                      },
                    ],
                    'plain-text'
                  );
                }}
              >
                <View style={[styles.playlistIcon, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <Ionicons name="add" size={24} color={theme.colors.text} />
                </View>
                <View style={styles.playlistInfo}>
                  <Text style={styles.playlistTitle}>Neue Playlist erstellen</Text>
                </View>
              </TouchableOpacity>
              
              {playlists.length > 0 && <View style={styles.divider} />}

              {playlists.map(playlist => (
                <TouchableOpacity
                  key={playlist.id}
                  style={styles.playlistRow}
                  onPress={() => void handleAdd(playlist.id)}
                  disabled={addingId !== null}
                >
                  <View style={styles.playlistIcon}>
                    <Ionicons name="musical-notes" size={24} color={theme.colors.background} />
                  </View>
                  <View style={styles.playlistInfo}>
                    <Text style={styles.playlistTitle} numberOfLines={1}>{playlist.title}</Text>
                    <Text style={styles.playlistMeta}>{playlist.is_public ? 'Öffentlich' : 'Privat'}</Text>
                  </View>
                  {addingId === playlist.id && (
                    <ActivityIndicator color={theme.colors.primary} size="small" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  content: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 300,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  closeBtn: {
    padding: 4,
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.muted,
    fontSize: 16,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    padding: 20,
    gap: 12,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: 16,
    gap: 14,
  },
  playlistIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  playlistTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  playlistMeta: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
});
