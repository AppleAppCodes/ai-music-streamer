import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MiniPlayer } from './src/components/MiniPlayer';
import { AuthProvider, useAuth } from './src/lib/auth-context';
import { hasSupabaseConfig } from './src/lib/env';
import { PlayerProvider, usePlayer } from './src/lib/player-context';
import { AuthScreen } from './src/screens/AuthScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { ForYouScreen } from './src/screens/ForYouScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { theme } from './src/theme';

type TabId = 'home' | 'for-you' | 'library';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'for-you', label: 'Für dich' },
  { id: 'library', label: 'Bibliothek' },
];

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
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const { initializing, signOut, user } = useAuth();
  const { activeSong, pause } = usePlayer();
  const activeScreen = useMemo(() => {
    if (activeTab === 'for-you') return <ForYouScreen />;
    if (activeTab === 'library') return <LibraryScreen />;
    return <HomeScreen />;
  }, [activeTab]);
  const signedIn = Boolean(user);
  const headerStatus = getHeaderStatus(initializing, user?.email ?? null);

  useEffect(() => {
    if (!signedIn) pause();
  }, [pause, signedIn]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.logo} accessibilityLabel="Yoriax Logo">
          <View style={[styles.logoBar, styles.logoBarSmall]} />
          <View style={[styles.logoBar, styles.logoBarLarge]} />
          <View style={[styles.logoBar, styles.logoBarMedium]} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.brand}>YORIAX</Text>
          <Text style={styles.connection}>{headerStatus}</Text>
        </View>
        {signedIn ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              void signOut();
            }}
            style={styles.logoutButton}
          >
            <Text style={styles.logoutText}>Abmelden</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          signedIn && activeSong && styles.contentWithPlayer,
          !signedIn && styles.authContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {initializing ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={theme.colors.text} />
            <Text style={styles.loadingText}>Session wird geladen</Text>
          </View>
        ) : signedIn ? (
          activeScreen
        ) : (
          <AuthScreen />
        )}
      </ScrollView>

      {signedIn ? <MiniPlayer /> : null}

      {signedIn ? (
        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabButton, active && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
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
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  logo: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  logoBar: {
    backgroundColor: theme.colors.text,
    borderRadius: 999,
    width: 5,
  },
  logoBarSmall: {
    height: 16,
  },
  logoBarMedium: {
    height: 22,
  },
  logoBarLarge: {
    height: 30,
  },
  headerText: {
    flex: 1,
  },
  brand: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
  },
  connection: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    padding: 20,
    paddingBottom: 110,
  },
  contentWithPlayer: {
    paddingBottom: 190,
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
  logoutButton: {
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  tabBar: {
    backgroundColor: 'rgba(5,5,5,0.96)',
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    left: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 18,
    position: 'absolute',
    right: 0,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    paddingVertical: 12,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.surface,
  },
  tabLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: theme.colors.text,
  },
});
