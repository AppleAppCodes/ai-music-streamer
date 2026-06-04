import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';

import { MainTabParamList, RootStackParamList } from './types';
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

import { Ionicons } from '@expo/vector-icons';

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: route.name === 'ForYou' ? 'transparent' : 'rgba(5,5,5,0.96)',
          borderTopColor: route.name === 'ForYou' ? 'transparent' : theme.colors.border,
          borderTopWidth: route.name === 'ForYou' ? 0 : 1,
          position: route.name === 'ForYou' ? 'absolute' : 'relative',
          elevation: 0,
        },
        tabBarActiveTintColor: theme.colors.primary,
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
  
  return (
    <NavigationContainer theme={NavigationTheme}>
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
      </Stack.Navigator>
      {activeSong ? <MiniPlayer /> : null}
    </NavigationContainer>
  );
}
