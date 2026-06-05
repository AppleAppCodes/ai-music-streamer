import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import type { NavigationState, PartialState } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

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
import { ChartsScreen } from '../screens/ChartsScreen';
import { ArtistsScreen } from '../screens/ArtistsScreen';
import { PlaylistDiscoverScreen } from '../screens/PlaylistDiscoverScreen';
import { MiniPlayer } from '../components/MiniPlayer';
import { usePlayer } from '../lib/player-context';

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

function getActiveRouteName(state: AppNavigationState | undefined): string | undefined {
  if (!state?.routes.length) return undefined;

  const route = state.routes[state.index ?? 0];
  const nestedState = route.state as AppNavigationState | undefined;
  return getActiveRouteName(nestedState) ?? route.name;
}

function MainTabs() {
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
          bottom: 12,
          elevation: 0,
          height: 70,
          left: 14,
          paddingBottom: 9,
          paddingTop: 8,
          position: 'absolute',
          right: 14,
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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ title: 'Suche' }} />
      <Tab.Screen name="ForYou" component={ForYouScreen} options={{ title: 'Für dich' }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ title: 'Bibliothek' }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { activeSong } = usePlayer();
  const [activeRoute, setActiveRoute] = useState<string>('Home');

  return (
    <NavigationContainer
      theme={NavigationTheme}
      onStateChange={(state) => setActiveRoute(getActiveRouteName(state) ?? 'Home')}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen 
          name="FullscreenPlayer" 
          component={FullscreenPlayer}
          options={{ presentation: 'fullScreenModal' }}
        />
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
          name="Charts"
          component={ChartsScreen}
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
      </Stack.Navigator>
      {activeSong && activeRoute !== 'ForYou' ? <MiniPlayer /> : null}
    </NavigationContainer>
  );
}
