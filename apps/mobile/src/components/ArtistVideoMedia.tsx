import { memo, useMemo, useState } from 'react';
import { StyleSheet, type ImageStyle, type StyleProp } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { getMotionImageSource } from '../lib/motion-image';

type ArtistVideoMediaProps = {
  active?: boolean;
  style?: StyleProp<ImageStyle>;
  uri?: string | null;
};

export const ArtistVideoMedia = memo(function ArtistVideoMedia({
  active = true,
  style,
  uri,
}: ArtistVideoMediaProps) {
  const motionSource = useMemo(() => getMotionImageSource(uri), [uri]);
  const motionKey = typeof motionSource === 'number' ? `asset:${motionSource}` : motionSource?.uri ?? null;
  const [failedUri, setFailedUri] = useState<string | null>(null);

  if (!motionSource || !motionKey || failedUri === motionKey || !active) return null;

  return (
    <ExpoImage
      autoplay
      cachePolicy="memory-disk"
      contentFit="cover"
      onError={() => setFailedUri(motionKey)}
      pointerEvents="none"
      priority="high"
      recyclingKey={motionKey}
      source={motionSource}
      style={[styles.video, style]}
      transition={140}
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
