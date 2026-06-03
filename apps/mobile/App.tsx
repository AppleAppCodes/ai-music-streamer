import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { ForYouScreen } from './src/screens/ForYouScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { theme } from './src/theme';
import { hasSupabaseConfig } from './src/lib/env';

type TabId = 'home' | 'for-you' | 'library';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'for-you', label: 'Für dich' },
  { id: 'library', label: 'Bibliothek' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const activeScreen = useMemo(() => {
    if (activeTab === 'for-you') return <ForYouScreen />;
    if (activeTab === 'library') return <LibraryScreen />;
    return <HomeScreen />;
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.logo} accessibilityLabel="Yoriax Logo">
          <View style={[styles.logoBar, styles.logoBarSmall]} />
          <View style={[styles.logoBar, styles.logoBarLarge]} />
          <View style={[styles.logoBar, styles.logoBarMedium]} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.brand}>YORIAX</Text>
          <Text style={styles.connection}>
            {hasSupabaseConfig ? 'Native App Basis verbunden' : 'Supabase Env fehlt'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeScreen}
      </ScrollView>

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
    </SafeAreaView>
  );
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
