import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

export function ForYouScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.hookCard}>
        <View style={styles.artworkPlaceholder}>
          <Text style={styles.artworkText}>9:16</Text>
        </View>
        <Text style={styles.eyebrow}>Fuer-dich Hooks</Text>
        <Text style={styles.title}>Native Feed kommt hier rein</Text>
        <Text style={styles.copy}>
          Als naechstes verbinden wir echte Song-Hooks, native Audio-Session und Swipe-Gesten. Im Web
          ist Autoplay begrenzt, in der App koennen wir Audio/Lockscreen deutlich kontrollierter bauen.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 16,
  },
  hookCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
  },
  artworkPlaceholder: {
    alignItems: 'center',
    aspectRatio: 9 / 16,
    backgroundColor: '#140c23',
    borderRadius: 24,
    justifyContent: 'center',
    marginBottom: 18,
  },
  artworkText: {
    color: theme.colors.subtle,
    fontSize: 28,
    fontWeight: '900',
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 8,
  },
  copy: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
});
