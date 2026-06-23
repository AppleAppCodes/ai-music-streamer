import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/lib/auth-context';

import { PlayerProvider, usePlayerShell } from './src/lib/player-context';
import { MusicPreferencesProvider, useMusicPreferences } from './src/lib/music-preferences-context';
import { AuthScreen } from './src/screens/AuthScreen';
import { MusicPreferencesOnboarding } from './src/screens/MusicPreferencesScreen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { theme } from './src/theme';
import { YoriaxLoginLogo, YoriaxMark } from './src/components/YoriaxUI';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MusicPreferencesProvider>
          <PlayerProvider>
            <AppShell />
          </PlayerProvider>
        </MusicPreferencesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const { initializing, user } = useAuth();
  const { loading: preferencesLoading, onboardingCompleted } = useMusicPreferences();
  const { reset } = usePlayerShell();
  const signedIn = Boolean(user);
  const appInitializing = initializing || (signedIn && preferencesLoading);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const videoPlayer = useVideoPlayer(require('./assets/yoriax_intro.MOV'), (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  useEffect(() => {
    if (signedIn || initializing) {
      videoPlayer.pause();
    } else {
      videoPlayer.play();
    }
  }, [videoPlayer, signedIn, initializing]);

  useEffect(() => {
    if (!signedIn) reset();
  }, [reset, signedIn]);

  return (
    <SafeAreaView style={styles.safeArea} edges={signedIn ? ['left', 'right'] : ['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      
      {!signedIn && !initializing && (
        <VideoView
          style={StyleSheet.absoluteFill}
          player={videoPlayer}
          nativeControls={false}
          contentFit="cover"
        />
      )}

      {!signedIn && !initializing && (
        <View style={styles.header}>
          <YoriaxLoginLogo />
        </View>
      )}

      <View style={{ flex: 1 }}>
        {appInitializing ? (
          <View style={styles.launchScreen}>
            <LinearGradient
              colors={['rgba(124,58,237,0.32)', 'rgba(45,212,191,0.12)', 'transparent']}
              style={styles.launchGlow}
            />
            <View style={styles.launchMark}>
              <YoriaxMark size={76} />
            </View>
            <Text style={styles.launchTitle}>YORIAX</Text>
            <Text style={styles.launchSubtitle}>Dein Sound wird vorbereitet.</Text>
            <ActivityIndicator color={theme.colors.primaryLight} style={styles.launchSpinner} />
          </View>
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
    justifyContent: 'center',
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
  launchScreen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 32,
  },
  launchGlow: {
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
    width: 112,
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
  launchSpinner: {
    marginTop: 20,
  },
});
