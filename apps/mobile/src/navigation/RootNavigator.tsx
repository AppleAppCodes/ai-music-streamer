import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import type { NavigationState, PartialState } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MainTabParamList, RootStackParamList } from './types';
import { theme } from '../theme';

import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { ForYouScreen } from '../screens/ForYouScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { ArtistScreen } from '../screens/ArtistScreen';
import { PlaylistScreen } from '../screens/PlaylistScreen';
import { FullscreenPlayer } from '../screens/FullscreenPlayer';
import { LikedSongsScreen } from '../screens/LikedSongsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RadioScreen } from '../screens/RadioScreen';
import { ArtistsScreen } from '../screens/ArtistsScreen';
import { PlaylistDiscoverScreen } from '../screens/PlaylistDiscoverScreen';
import { MusicPreferencesScreen } from '../screens/MusicPreferencesScreen';
import { DailyMixScreen } from '../screens/DailyMixScreen';
import { MiniPlayer } from '../components/MiniPlayer';
import { usePlayerControls, usePlayerShell } from '../lib/player-context';
import { PlayerOverlayProvider, usePlayerOverlay } from '../lib/player-overlay-context';
import { useI18n } from '../lib/i18n';
import { loadSongById } from '../lib/music-data';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const NavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.background,
    card: 'rgba(5,5,5,0.96)',
    text: theme.colors.text,
    border: theme.colors.border,
    primary: theme.colors.text,
  },
};

type AppNavigationState = NavigationState | PartialState<NavigationState>;
const UNIVERSAL_LINK_HOSTS = new Set(['www.yoriax.com', 'yoriax.com']);

function normalizeDeepLinkPath(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (parsed.protocol === 'yoriax:') {
      return [parsed.hostname, parsed.pathname]
        .filter(Boolean)
        .join('/')
        .replace(/\/+/g, '/')
        .replace(/^\/+|\/+$/g, '');
    }

    if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && UNIVERSAL_LINK_HOSTS.has(parsed.hostname)) {
      return parsed.pathname.replace(/^\/+|\/+$/g, '');
    }
  } catch {
    const parsed = Linking.parse(url);
    return [parsed.hostname, parsed.path]
      .filter(Boolean)
      .join('/')
      .replace(/\/+/g, '/')
      .replace(/^\/+|\/+$/g, '') || null;
  }

  return null;
}

function decodePathPart(value: string | undefined) {
  if (!value) return '';

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getActiveRouteName(state: AppNavigationState | undefined): string | undefined {
  if (!state?.routes.length) return undefined;

  const route = state.routes[state.index ?? 0];
  const nestedState = route.state as AppNavigationState | undefined;
  return getActiveRouteName(nestedState) ?? route.name;
}

function MainTabs() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const tabBarHorizontalInset = Math.max(18, insets.left + 18, insets.right + 18);
  const tabBarBottomInset = Math.max(22, insets.bottom + 8);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: route.name === 'ForYou' ? 'rgba(0,0,0,0.28)' : 'rgba(12,10,18,0.96)',
          borderColor: route.name === 'ForYou' ? 'rgba(255,255,255,0.16)' : theme.colors.borderStrong,
          borderRadius: 26,
          borderTopWidth: 0,
          borderWidth: 1,
          bottom: tabBarBottomInset,
          elevation: 0,
          height: 68,
          left: tabBarHorizontalInset,
          paddingBottom: 8,
          paddingTop: 7,
          position: 'absolute',
          right: tabBarHorizontalInset,
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: route.name === 'ForYou' ? 0 : 0.16,
          shadowRadius: 24,
        },
        tabBarActiveTintColor: theme.colors.text,
        tabBarItemStyle: {
          borderRadius: theme.radii.lg,
        },
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'help';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'ForYou') {
            iconName = focused ? 'sparkles' : 'sparkles-outline';
          } else if (route.name === 'Library') {
            iconName = focused ? 'library' : 'library-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('tabs.home') }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ title: t('tabs.search') }} />
      <Tab.Screen name="ForYou" component={ForYouScreen} options={{ title: t('tabs.forYou') }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ title: t('tabs.library') }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <PlayerOverlayProvider>
      <RootNavigationContent />
    </PlayerOverlayProvider>
  );
}

function RootNavigationContent() {
  const { hasActiveSong } = usePlayerShell();
  const { playSong, setQueue } = usePlayerControls();
  const { closePlayer, isPlayerExpanded, openPlayer } = usePlayerOverlay();
  const [activeRoute, setActiveRoute] = useState<string>('Home');
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const pendingDeepLinkRef = useRef<string | null>(null);
  const lastHandledDeepLinkRef = useRef<{ time: number; url: string } | null>(null);

  useEffect(() => {
    if (!hasActiveSong && isPlayerExpanded) {
      closePlayer();
    }
  }, [closePlayer, hasActiveSong, isPlayerExpanded]);

  const handleDeepLink = useCallback(async (url: string) => {
    const now = Date.now();
    const lastHandled = lastHandledDeepLinkRef.current;

    if (lastHandled?.url === url && now - lastHandled.time < 1600) {
      return;
    }

    if (!navigationRef.isReady()) {
      pendingDeepLinkRef.current = url;
      return;
    }

    const path = normalizeDeepLinkPath(url);
    if (!path) return;

    const [section, ...rest] = path.split('/').filter(Boolean);
    if (section === 'auth') return;

    lastHandledDeepLinkRef.current = { time: now, url };

    if (!section) {
      navigationRef.navigate('MainTabs', { screen: 'Home' });
      return;
    }

    if (section === 'song') {
      const songId = decodePathPart(rest.join('/'));
      if (!songId) return;

      try {
        const song = await loadSongById(songId);
        setQueue([song]);
        await playSong(song);
        openPlayer();
      } catch (error) {
        console.error('[DeepLink] Failed to open song link', error);
      }
      return;
    }

    if (section === 'artist') {
      const artistId = decodePathPart(rest.join('/'));
      if (artistId) navigationRef.navigate('Artist', { artistId });
      return;
    }

    if (section === 'playlist') {
      const playlistId = decodePathPart(rest.join('/'));
      if (playlistId) {
        navigationRef.navigate('Playlist', { playlistId });
      } else {
        navigationRef.navigate('PlaylistDiscover');
      }
      return;
    }

    if (section === 'playlists' || (section === 'discover' && rest[0] === 'playlists')) {
      navigationRef.navigate('PlaylistDiscover');
      return;
    }

    if (section === 'artists') {
      navigationRef.navigate('Artists');
      return;
    }

    // Charts was replaced by Radio; old deep links keep working.
    if (section === 'charts' || section === 'radio') {
      navigationRef.navigate('Radio');
      return;
    }

    if (section === 'collection' && rest[0] === 'tracks') {
      navigationRef.navigate('LikedSongs');
      return;
    }

    if (section === 'feed') {
      navigationRef.navigate('MainTabs', { screen: 'ForYou' });
      return;
    }

    navigationRef.navigate('MainTabs', { screen: 'Home' });
  }, [navigationRef, openPlayer, playSong, setQueue]);

  // Accessed via ref so the effect below never re-runs: handleDeepLink's
  // identity changes with playSong (ad counter), and a re-run used to call
  // getInitialURL() AGAIN — which returns the LAUNCH url for the whole process
  // lifetime, so the launch link's song suddenly replaced whatever was playing
  // (e.g. a radio station) on the next song transition.
  const handleDeepLinkRef = useRef(handleDeepLink);
  useEffect(() => {
    handleDeepLinkRef.current = handleDeepLink;
  }, [handleDeepLink]);

  useEffect(() => {
    let mounted = true;

    // The launch URL is handled exactly once per mount; live links keep
    // arriving through the event listener.
    Linking.getInitialURL()
      .then((url) => {
        if (mounted && url) void handleDeepLinkRef.current(url);
      })
      .catch((error: unknown) => {
        console.error('[DeepLink] Failed to read initial URL', error);
      });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleDeepLinkRef.current(url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={NavigationTheme}
      onReady={() => {
        if (pendingDeepLinkRef.current) {
          const pendingUrl = pendingDeepLinkRef.current;
          pendingDeepLinkRef.current = null;
          void handleDeepLink(pendingUrl);
        }
      }}
      onStateChange={(state) => setActiveRoute(getActiveRouteName(state) ?? 'Home')}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen 
          name="Artist" 
          component={ArtistScreen}
          options={{ presentation: 'card' }}
        />
        <Stack.Screen 
          name="Playlist" 
          component={PlaylistScreen}
          options={{ presentation: 'card' }}
        />
        <Stack.Screen 
          name="LikedSongs" 
          component={LikedSongsScreen}
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="Radio"
          component={RadioScreen}
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="Artists"
          component={ArtistsScreen}
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="PlaylistDiscover"
          component={PlaylistDiscoverScreen}
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="MusicPreferences"
          component={MusicPreferencesScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="DailyMix"
          component={DailyMixScreen}
          options={{ presentation: 'card' }}
        />
      </Stack.Navigator>
      {hasActiveSong && activeRoute !== 'ForYou' ? (
        <MiniPlayer onExpand={openPlayer} />
      ) : null}
      {hasActiveSong && isPlayerExpanded ? <FullscreenPlayer onClose={closePlayer} /> : null}
    </NavigationContainer>
  );
}
