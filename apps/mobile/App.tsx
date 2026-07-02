import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { preloadStartupMedia } from './src/lib/media-preload';
import { supabase } from './src/lib/supabase';

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
  const [startupMediaState, setStartupMediaState] = useState<{ ready: boolean; userId: string | null }>({
    ready: false,
    userId: null,
  });
  const startupMediaReady = !signedIn || (startupMediaState.ready && startupMediaState.userId === user?.id);
  const appInitializing = initializing || (signedIn && (preferencesLoading || !startupMediaReady));

  useEffect(() => {
    if (!signedIn) reset();
  }, [reset, signedIn]);

  // Mark the user as active in-app (feeds the admin dashboard's "last active"
  // and daily-active-users, which the web previously updated only in-browser).
  // Runs on sign-in and whenever the app returns to the foreground, throttled.
  useEffect(() => {
    const userId = user?.id;
    if (!signedIn || !userId || !supabase) return;

    let lastPing = 0;
    const ping = () => {
      const now = Date.now();
      if (now - lastPing < 5 * 60 * 1000) return;
      lastPing = now;
      void supabase!
        .from('profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', userId);
    };

    ping();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') ping();
    });
    return () => subscription.remove();
  }, [signedIn, user?.id]);

  useEffect(() => {
    if (!signedIn || !user?.id) {
      setStartupMediaState({ ready: true, userId: null });
      return;
    }

    let mounted = true;
    const userId = user.id;
    const timeout = setTimeout(() => {
      if (mounted) {
        setStartupMediaState({ ready: true, userId });
      }
    }, 2400);

    setStartupMediaState({ ready: false, userId });

    preloadStartupMedia(userId)
      .catch((error) => {
        console.warn('Startup media preload failed:', error);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (mounted) {
          setStartupMediaState({ ready: true, userId });
        }
      });

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [signedIn, user?.id]);

  return (
    <SafeAreaView style={styles.safeArea} edges={signedIn ? ['left', 'right'] : ['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />

      {!signedIn && !initializing && (
        <DecorativeVideoView
          contentFit="cover"
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require('./assets/yoriax_intro.MOV')}
          active
          style={StyleSheet.absoluteFill}
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
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 1450,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 1450,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    driftLoop.start();

    return () => {
      pulseLoop.stop();
      driftLoop.stop();
    };
  }, [drift, pulse]);

  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.12],
  });
  const markScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.03],
  });
  const markTranslateY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [3, -5],
  });

  return (
    <View style={styles.launchScreen}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.launchAmbientOrb,
          styles.launchAmbientOrbTop,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.42] }),
            transform: [{ scale: glowScale }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.launchAmbientOrb,
          styles.launchAmbientOrbBottom,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.32] }),
            transform: [{ scale: glowScale }],
          },
        ]}
      />
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

      <View style={styles.launchDots}>
        <Animated.View style={[styles.launchDot, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]} />
        <View style={[styles.launchDot, styles.launchDotMuted]} />
        <Animated.View style={[styles.launchDot, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) }]} />
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
  launchAmbientOrb: {
    borderRadius: 240,
    height: 360,
    position: 'absolute',
    width: 360,
  },
  launchAmbientOrbTop: {
    backgroundColor: 'rgba(124,58,237,0.52)',
    right: -160,
    top: 80,
  },
  launchAmbientOrbBottom: {
    backgroundColor: 'rgba(45,212,191,0.26)',
    bottom: 70,
    left: -190,
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
  launchDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 22,
  },
  launchDot: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    height: 5,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.36,
    shadowRadius: 8,
    width: 5,
  },
  launchDotMuted: {
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
});
