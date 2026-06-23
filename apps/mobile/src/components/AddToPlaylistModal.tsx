import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../lib/auth-context';
import {
  addSongToPlaylist,
  createPlaylist,
  getPlaylistIdsForSong,
  getUserPlaylists,
  removeSongFromPlaylist,
} from '../lib/music-data';
import type { Playlist } from '../lib/types';
import { useI18n } from '../lib/i18n';

interface AddToPlaylistModalProps {
  visible: boolean;
  songId: string;
  onClose: () => void;
  isLiked?: boolean;
  onToggleLiked?: () => Promise<boolean>;
}

function PlaylistSeparator() {
  return <View style={styles.playlistSeparator} />;
}

const SelectionControl = memo(function SelectionControl({
  loading,
  selected,
}: {
  loading: boolean;
  selected: boolean;
}) {
  if (loading) {
    return <ActivityIndicator color={theme.colors.primaryLight} size="small" />;
  }

  return (
    <View style={[styles.selectionControl, selected && styles.selectionControlSelected]}>
      {selected ? <Ionicons name="checkmark" size={16} color={theme.colors.background} /> : null}
    </View>
  );
});

const PlaylistModalRow = memo(function PlaylistModalRow({
  loading,
  onToggle,
  playlist,
  selected,
}: {
  loading: boolean;
  onToggle: (playlistId: string) => void;
  playlist: Playlist;
  selected: boolean;
}) {
  const { t } = useI18n();

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      disabled={loading}
      onPress={() => onToggle(playlist.id)}
      style={[styles.playlistRow, selected && styles.playlistRowSelected]}
    >
      <View style={[styles.playlistIcon, selected && styles.playlistIconSelected]}>
        <Ionicons
          name="musical-notes"
          size={23}
          color={selected ? theme.colors.text : theme.colors.background}
        />
      </View>
      <View style={styles.playlistInfo}>
        <Text style={styles.playlistTitle} numberOfLines={1}>{playlist.title}</Text>
        <Text style={styles.playlistMeta}>
          {playlist.is_public ? t('common.public') : t('common.private')}
        </Text>
      </View>
      <SelectionControl loading={loading} selected={selected} />
    </TouchableOpacity>
  );
});

export function AddToPlaylistModal({
  visible,
  songId,
  onClose,
  isLiked = false,
  onToggleLiked,
}: AddToPlaylistModalProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<string>>(new Set());
  const [likedSelected, setLikedSelected] = useState(isLiked);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatingLiked, setUpdatingLiked] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user || !visible) return;
      setLoading(true);
      try {
        const nextPlaylists = await getUserPlaylists(user.id);
        const selectedIds = await getPlaylistIdsForSong(
          nextPlaylists.map((playlist) => playlist.id),
          songId,
        );
        if (!mounted) return;
        setPlaylists(nextPlaylists);
        setSelectedPlaylistIds(new Set(selectedIds));
      } catch (error) {
        console.error('Error loading save destinations:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [songId, user, visible]);

  const handleTogglePlaylist = useCallback(async (playlistId: string) => {
    if (updatingId) return;
    const wasSelected = selectedPlaylistIds.has(playlistId);

    setSelectedPlaylistIds((current) => {
      const next = new Set(current);
      if (wasSelected) next.delete(playlistId);
      else next.add(playlistId);
      return next;
    });
    setUpdatingId(playlistId);

    try {
      if (wasSelected) {
        await removeSongFromPlaylist(playlistId, songId);
      } else {
        await addSongToPlaylist(playlistId, songId);
      }
    } catch (error) {
      console.error('Error updating playlist:', error);
      setSelectedPlaylistIds((current) => {
        const next = new Set(current);
        if (wasSelected) next.add(playlistId);
        else next.delete(playlistId);
        return next;
      });
    } finally {
      setUpdatingId(null);
    }
  }, [selectedPlaylistIds, songId, updatingId]);

  const handleToggleLiked = useCallback(async () => {
    if (!onToggleLiked || updatingLiked) return;
    const previousStatus = likedSelected;
    setLikedSelected(!previousStatus);
    setUpdatingLiked(true);
    try {
      setLikedSelected(await onToggleLiked());
    } catch (error) {
      console.error('Error updating liked songs:', error);
      setLikedSelected(previousStatus);
    } finally {
      setUpdatingLiked(false);
    }
  }, [likedSelected, onToggleLiked, updatingLiked]);

  const handleCreatePlaylist = useCallback(() => {
    Alert.prompt(
      t('save.title'),
      t('save.playlistName'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('save.create'),
          onPress: async (text?: string) => {
            if (!text?.trim() || !user) return;
            setLoading(true);
            try {
              const newPlaylist = await createPlaylist(user.id, text.trim());
              await addSongToPlaylist(newPlaylist.id, songId);
              setPlaylists((current) => [newPlaylist, ...current]);
              setSelectedPlaylistIds((current) => new Set(current).add(newPlaylist.id));
            } catch (error) {
              console.error('Error creating playlist:', error);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'plain-text',
    );
  }, [songId, t, user]);

  const renderPlaylist = useCallback(({ item }: { item: Playlist }) => (
    <PlaylistModalRow
      loading={updatingId === item.id}
      onToggle={(playlistId) => { void handleTogglePlaylist(playlistId); }}
      playlist={item}
      selected={selectedPlaylistIds.has(item.id)}
    />
  ), [handleTogglePlaylist, selectedPlaylistIds, updatingId]);

  return (
    <Modal
      animationType="slide"
      onShow={() => setLikedSelected(isLiked)}
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.backdrop} />
        <View style={styles.content}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>YORIAX</Text>
              <Text style={styles.title}>{t('save.saveIn')}</Text>
            </View>
            <TouchableOpacity accessibilityLabel={t('save.close')} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.colors.primaryLight} />
            </View>
          ) : (
            <FlatList
              contentContainerStyle={styles.listContent}
              data={playlists}
              initialNumToRender={10}
              ItemSeparatorComponent={PlaylistSeparator}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={
                <>
                  {onToggleLiked ? (
                    <TouchableOpacity
                      activeOpacity={0.84}
                      disabled={updatingLiked}
                      onPress={() => { void handleToggleLiked(); }}
                      style={[styles.playlistRow, likedSelected && styles.playlistRowSelected]}
                    >
                      <View style={[styles.playlistIcon, styles.favoriteIcon, likedSelected && styles.favoriteIconSelected]}>
                        <Ionicons name="heart" size={23} color={theme.colors.text} />
                      </View>
                      <View style={styles.playlistInfo}>
                        <Text style={styles.playlistTitle}>{t('save.favorites')}</Text>
                        <Text style={styles.playlistMeta}>{t('save.favoritesCopy')}</Text>
                      </View>
                      <SelectionControl loading={updatingLiked} selected={likedSelected} />
                    </TouchableOpacity>
                  ) : null}

                  {onToggleLiked ? <View style={styles.divider} /> : null}

                  <TouchableOpacity activeOpacity={0.84} onPress={handleCreatePlaylist} style={styles.playlistRow}>
                    <View style={[styles.playlistIcon, styles.createPlaylistIcon]}>
                      <Ionicons name="add" size={24} color={theme.colors.text} />
                    </View>
                    <View style={styles.playlistInfo}>
                      <Text style={styles.playlistTitle}>{t('save.createPlaylist')}</Text>
                    </View>
                  </TouchableOpacity>

                  {playlists.length > 0 ? <View style={styles.divider} /> : null}
                </>
              }
              maxToRenderPerBatch={10}
              renderItem={renderPlaylist}
              style={styles.list}
              updateCellsBatchingPeriod={32}
              windowSize={7}
            />
          )}

          <TouchableOpacity activeOpacity={0.88} onPress={onClose} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>{t('common.done')}</Text>
          </TouchableOpacity>
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
    backgroundColor: 'rgba(0,0,0,0.68)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  content: {
    backgroundColor: '#120c1b',
    borderColor: 'rgba(168,85,247,0.24)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    maxHeight: '82%',
    minHeight: 330,
    paddingBottom: 28,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    height: 5,
    marginTop: 10,
    width: 46,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  eyebrow: {
    color: theme.colors.primaryLight,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 5,
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  closeBtn: {
    padding: 4,
  },
  centerBox: {
    alignItems: 'center',
    padding: 40,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    padding: 20,
    paddingBottom: 10,
  },
  playlistSeparator: {
    height: 10,
  },
  divider: {
    backgroundColor: theme.colors.border,
    height: 1,
    marginVertical: 12,
  },
  playlistRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(5,5,5,0.72)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 12,
  },
  playlistRowSelected: {
    backgroundColor: 'rgba(124,58,237,0.13)',
    borderColor: 'rgba(168,85,247,0.32)',
  },
  playlistIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  playlistIconSelected: {
    backgroundColor: theme.colors.primary,
  },
  favoriteIcon: {
    backgroundColor: theme.colors.primary,
  },
  favoriteIconSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  createPlaylistIcon: {
    backgroundColor: 'rgba(255,255,255,0.1)',
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
  selectionControl: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    borderWidth: 1,
    height: 25,
    justifyContent: 'center',
    width: 25,
  },
  selectionControlSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primaryLight,
  },
  doneButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    minHeight: 50,
  },
  doneButtonText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
