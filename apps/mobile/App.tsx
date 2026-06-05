import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/lib/auth-context';
import { hasSupabaseConfig } from './src/lib/env';
import { PlayerProvider, usePlayer } from './src/lib/player-context';
import { AuthScreen } from './src/screens/AuthScreen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { theme } from './src/theme';
import { YoriaxLogo } from './src/components/YoriaxUI';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PlayerProvider>
          <AppShell />
        </PlayerProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const { initializing, user } = useAuth();
  const { reset } = usePlayer();
  const signedIn = Boolean(user);
  const headerStatus = getHeaderStatus(initializing, user?.email ?? null);

  useEffect(() => {
    if (!signedIn) reset();
  }, [reset, signedIn]);

  return (
    <SafeAreaView style={styles.safeArea} edges={signedIn ? ['left', 'right'] : ['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      {!signedIn && (
        <View style={styles.header}>
          <YoriaxLogo />
          <Text style={styles.connection} numberOfLines={1}>{headerStatus}</Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {initializing ? (
          <View style={[styles.content, styles.authContent]}>
            <View style={styles.loadingCard}>
              <ActivityIndicator color={theme.colors.text} />
              <Text style={styles.loadingText}>Session wird geladen</Text>
            </View>
          </View>
        ) : signedIn ? (
          <RootNavigator />
        ) : (
          <ScrollView contentContainerStyle={[styles.content, styles.authContent]} showsVerticalScrollIndicator={false}>
            <AuthScreen />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function getHeaderStatus(initializing: boolean, email: string | null) {
  if (!hasSupabaseConfig) return 'Supabase Env fehlt';
  if (initializing) return 'Session wird geladen';
  if (email) return `Angemeldet als ${email}`;
  return 'Native Auth bereit';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  connection: {
    flexShrink: 1,
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  content: {
    padding: 20,
    paddingBottom: 110,
  },
  authContent: {
    flexGrow: 1,
    paddingBottom: 34,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    marginTop: 80,
    padding: 24,
  },
  loadingText: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
});
