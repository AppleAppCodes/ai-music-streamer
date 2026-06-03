import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

export function LibraryScreen() {
  return (
    <View style={styles.stack}>
      <Text style={styles.title}>Bibliothek</Text>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Text style={styles.heart}>♥</Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Lieblingssongs</Text>
          <Text style={styles.rowMeta}>Wird mit deinem Yoriax Account synchronisiert</Text>
        </View>
      </View>
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>Playlists folgen</Text>
        <Text style={styles.emptyCopy}>
          Die native App nutzt spaeter dieselben Supabase-Playlistdaten wie die Webseite.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  title: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: '900',
  },
  row: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 18,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  heart: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  rowMeta: {
    color: theme.colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  emptyBox: {
    borderColor: theme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
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
});
