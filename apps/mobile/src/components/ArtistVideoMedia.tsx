import { memo, useEffect, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { configureSilentLoopingVideoPlayer, prepareSilentVideoPlayback, useShouldPlaySilentVideo } from '../lib/silent-video';

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
  const [videoState, setVideoState] = useState({ ready: false, uri: uri ?? null });
  const isReady = videoState.uri === (uri ?? null) && videoState.ready;
  const shouldPlay = useShouldPlaySilentVideo(active);
  const player = useVideoPlayer(uri ? { uri, useCaching: true } : null, (videoPlayer) => {
    configureSilentLoopingVideoPlayer(videoPlayer);
  });

  useEffect(() => {
    setVideoState({ ready: false, uri: uri ?? null });
  }, [uri]);

  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => {
      setVideoState({ ready: status === 'readyToPlay', uri: uri ?? null });
    });
    const sourceSubscription = player.addListener('sourceLoad', () => {
      setVideoState({ ready: true, uri: uri ?? null });
    });
    if (player.status === 'readyToPlay') {
      setVideoState({ ready: true, uri: uri ?? null });
    }

    return () => {
      subscription.remove();
      sourceSubscription.remove();
    };
  }, [player, uri]);

  useEffect(() => {
    if (!uri || !shouldPlay) {
      try {
        player.pause();
      } catch {
        // Ignore native player lifecycle races while virtualized artist cards unmount.
      }
      return;
    }

    prepareSilentVideoPlayback(player);
    if (isReady) {
      player.play();
    }

    return () => {
      try {
        player.pause();
      } catch {
        // Ignore native player lifecycle races while virtualized artist cards unmount.
      }
    };
  }, [isReady, player, shouldPlay, uri]);

  if (!uri) return null;

  return (
    <VideoView
      contentFit="cover"
      nativeControls={false}
      player={player}
      pointerEvents="none"
      style={[styles.video, style, (!active || !isReady) && styles.hidden]}
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
  hidden: {
    opacity: 0,
  },
});
