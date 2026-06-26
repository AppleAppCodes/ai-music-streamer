import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './src/lib/auth-context';

import { PlayerProvider, usePlayerShell } from './src/lib/player-context';
import { MusicPreferencesProvider, useMusicPreferences } from './src/lib/music-preferences-context';
import { AuthScreen } from './src/screens/AuthScreen';
import { MusicPreferencesOnboarding } from './src/screens/MusicPreferencesScreen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { theme } from './src/theme';
import { YoriaxMark } from './src/components/YoriaxUI';
import { DecorativeVideoView } from 'yoriax-decorative-video';
import { I18nProvider, useI18n } from './src/lib/i18n';
import { loadHomeMusic } from './src/lib/music-data';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <I18nProvider>
          <AuthProvider>
            <MusicPreferencesProvider>
              <PlayerProvider>
                <AppShell />
              </PlayerProvider>
            </MusicPreferencesProvider>
          </AuthProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const { initializing, user } = useAuth();
  const { loading: preferencesLoading, onboardingCompleted } = useMusicPreferences();
  const { reset } = usePlayerShell();
  const signedIn = Boolean(user);
  const appInitializing = initializing || (signedIn && preferencesLoading);

  useEffect(() => {
    if (!signedIn) reset();
  }, [reset, signedIn]);

  // Preload home data and media
  useEffect(() => {
    if (user) {
      const preload = async () => {
        try {
          const homeData = await loadHomeMusic(user.id);
          
          // Prefetch cover images of trending, recommended, and official playlists
          const urlsToPrefetch = new Set<string>();
          
          homeData.trendingSongs.forEach(s => s.cover_url && urlsToPrefetch.add(s.cover_url));
          homeData.recommendedSongs.forEach(s => s.cover_url && urlsToPrefetch.add(s.cover_url));
          homeData.officialPlaylists.forEach(p => p.cover_url && urlsToPrefetch.add(p.cover_url));
          
          await Promise.all(
            Array.from(urlsToPrefetch).map(url => Image.prefetch(url).catch(() => {}))
          );
          
          console.log(`[Preload] Successfully preloaded ${urlsToPrefetch.size} cover images.`);
        } catch (err) {
          console.error('[Preload] Failed to preload media:', err);
        }
      };
      
      preload();
    }
  }, [user]);

  return (
    <SafeAreaView style={styles.safeArea} edges={signedIn ? ['left', 'right'] : ['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      
      {!signedIn && !initializing && (
        <DecorativeVideoView
          style={StyleSheet.absoluteFill}
          source={require('./assets/yoriax_intro.MOV')}
          active={true}
          contentFit="cover"
        />
      )}



      <View style={{ flex: 1 }}>
        {appInitializing ? (
          <LaunchScreen />
        ) : signedIn && !onboardingCompleted ? (
          <MusicPreferencesOnboarding />
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

function LaunchScreen() {
  const { t } = useI18n();
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const bars = useRef([
    new Animated.Value(0.28),
    new Animated.Value(0.58),
    new Animated.Value(0.4),
    new Animated.Value(0.82),
  ]).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 950,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 950,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        duration: 1450,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    const barLoops = bars.map((bar, index) => (
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 95),
          Animated.timing(bar, {
            duration: 260,
            easing: Easing.inOut(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            duration: 280,
            easing: Easing.inOut(Easing.quad),
            toValue: index % 2 === 0 ? 0.34 : 0.48,
            useNativeDriver: true,
          }),
        ]),
      )
    ));

    pulseLoop.start();
    floatLoop.start();
    shimmerLoop.start();
    barLoops.forEach((loop) => loop.start());

    return () => {
      pulseLoop.stop();
      floatLoop.stop();
      shimmerLoop.stop();
      barLoops.forEach((loop) => loop.stop());
    };
  }, [bars, float, pulse, shimmer]);

  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });
  const markScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.04],
  });
  const markTranslateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [4, -6],
  });
  const shimmerTranslateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });

  return (
    <View style={styles.launchScreen}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.launchGlow,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.54, 0.94] }),
            transform: [{ scale: glowScale }],
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(124,58,237,0.42)', 'rgba(45,212,191,0.18)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.launchMark,
          {
            transform: [{ translateY: markTranslateY }, { scale: markScale }],
          },
        ]}
      >
        <View style={styles.launchMarkHalo} />
        <YoriaxMark size={76} />
      </Animated.View>

      <Text style={styles.launchTitle}>YORIAX</Text>
      <Text style={styles.launchSubtitle}>{t('launch.preparing')}</Text>

      <View style={styles.launchVisualizer}>
        {bars.map((bar, index) => (
          <Animated.View
            key={index}
            style={[
              styles.launchVisualizerBar,
              { transform: [{ scaleY: bar }] },
            ]}
          />
        ))}
      </View>

      <View style={styles.launchProgress}>
        <Animated.View
          style={[
            styles.launchProgressShimmer,
            { transform: [{ translateX: shimmerTranslateX }] },
          ]}
        />
      </View>
    </View>
  );
}



const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 110,
  },
  authContent: {
    flexGrow: 1,
    paddingBottom: 34,
  },
  launchScreen: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 32,
  },
  launchGlow: {
    overflow: 'hidden',
    borderRadius: 220,
    height: 360,
    position: 'absolute',
    top: '22%',
    width: 360,
  },
  launchMark: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: theme.colors.border,
    borderRadius: 34,
    borderWidth: 1,
    height: 112,
    justifyContent: 'center',
    marginBottom: 22,
    shadowColor: theme.colors.primaryLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.36,
    shadowRadius: 28,
    width: 112,
  },
  launchMarkHalo: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderRadius: 46,
    height: 92,
    position: 'absolute',
    width: 92,
  },
  launchTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 8,
    marginRight: -8,
  },
  launchSubtitle: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },
  launchVisualizer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    height: 28,
    justifyContent: 'center',
    marginTop: 24,
  },
  launchVisualizerBar: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 3,
    height: 24,
    shadowColor: theme.colors.primaryLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    width: 5,
  },
  launchProgress: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 4,
    marginTop: 18,
    overflow: 'hidden',
    width: 120,
  },
  launchProgressShimmer: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    height: 4,
    opacity: 0.9,
    width: 54,
  },
});
