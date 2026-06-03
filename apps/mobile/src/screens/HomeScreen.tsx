import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

export function HomeScreen() {
  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Native Foundation</Text>
        <Text style={styles.title}>Yoriax App</Text>
        <Text style={styles.copy}>
          Erste native Shell fuer Android und iOS. Web bleibt stabil, Mobile wird Schritt fuer Schritt
          mit Supabase, Player und Feed verbunden.
        </Text>
      </View>

      <View style={styles.grid}>
        {['Lieblingssongs', 'Charts', 'Kuenstler', 'Playlists'].map((item) => (
          <View key={item} style={styles.tile}>
            <Text style={styles.tileText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 18,
  },
  hero: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.text,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.5,
    marginTop: 10,
  },
  copy: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 82,
    padding: 16,
    width: '48%',
  },
  tileText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
});
