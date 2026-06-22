import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  ForYou: undefined;
  Library: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Playlist: { playlistId: string };
  Artist: { artistId: string };
  LikedSongs: undefined;
  Profile: undefined;
  Charts: undefined;
  FullscreenPlayer: undefined;
  Artists: undefined;
  PlaylistDiscover: undefined;
  MusicPreferences: undefined;
};
