import { memo, useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { configureSilentLoopingVideoPlayer, prepareSilentVideoPlayback } from '../lib/silent-video';

type ArtistVideoMediaProps = {
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  uri?: string | null;
};

export const ArtistVideoMedia = memo(function ArtistVideoMedia({
  active = true,
  style,
  uri,
}: ArtistVideoMediaProps) {
  const player = useVideoPlayer(uri ? { uri, useCaching: true } : null, (videoPlayer) => {
    configureSilentLoopingVideoPlayer(videoPlayer);
  });

  useEffect(() => {
    if (!uri || !active) {
      try {
        player.pause();
      } catch {
        // Ignore native player lifecycle races while virtualized artist cards unmount.
      }
      return;
    }

    prepareSilentVideoPlayback(player);
    player.play();

    return () => {
      try {
        player.pause();
      } catch {
        // Ignore native player lifecycle races while virtualized artist cards unmount.
      }
    };
  }, [active, player, uri]);

  if (!uri) return null;

  return (
    <VideoView
      contentFit="cover"
      nativeControls={false}
      player={player}
      pointerEvents="none"
      style={[styles.video, style]}
    />
  );
});

const styles = StyleSheet.create({
  video: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
