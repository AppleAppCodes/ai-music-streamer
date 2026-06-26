import { memo, useEffect, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { DecorativeVideoView } from 'yoriax-decorative-video';
import { useShouldPlaySilentVideo } from '../lib/silent-video';
import { videoCacheManager } from '../lib/video-cache';

type ArtistVideoMediaProps = {
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  uri?: string | null;
  videoId?: string;
};

export const ArtistVideoMedia = memo(function ArtistVideoMedia({
  active = true,
  style,
  uri,
  videoId,
}: ArtistVideoMediaProps) {
  const shouldPlay = useShouldPlaySilentVideo(active);
  const [localSource, setLocalSource] = useState<string | null>(null);

  useEffect(() => {
    if (!uri) {
      setLocalSource(null);
      return;
    }
    
    let isMounted = true;
    const loadSource = async () => {
      // Use the video ID for caching, fallback to a hash of the URI if missing
      const id = videoId || uri.replace(/[^a-z0-9]/gi, '_').slice(-20);
      const cached = await videoCacheManager.getVideoSource(uri, id);
      if (isMounted) {
        setLocalSource(cached);
      }
    };
    
    void loadSource();
    
    return () => {
      isMounted = false;
    };
  }, [uri, videoId]);

  if (!localSource) return null;

  return (
    <DecorativeVideoView
      source={localSource}
      active={shouldPlay}
      contentFit="cover"
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
