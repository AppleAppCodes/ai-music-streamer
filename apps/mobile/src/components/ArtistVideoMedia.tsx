import { memo } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { DecorativeVideoView } from 'yoriax-decorative-video';
import { useShouldPlaySilentVideo } from '../lib/silent-video';

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
  const shouldPlay = useShouldPlaySilentVideo(active);

  if (!uri) return null;

  return (
    <DecorativeVideoView
      active={shouldPlay}
      contentFit="cover"
      source={uri}
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
