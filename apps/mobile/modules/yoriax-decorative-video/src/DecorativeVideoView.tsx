import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
import { Image, Platform, View, type ImageStyle, type StyleProp, type ViewProps } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

export type DecorativeVideoViewProps = {
  /**
   * The source URL or asset path for the video.
   * Can be a remote URL or a resolved local asset (e.g., from Image.resolveAssetSource).
   */
  source?: string | number | null;

  /**
   * Whether the video should be actively playing.
   * If false, the video will pause.
   * Defaults to true.
   */
  active?: boolean;

  /**
   * How the video should fit within its container.
   * 'cover' (default) preserves aspect ratio and fills the view.
   * 'contain' preserves aspect ratio and fits entirely within the view.
   * 'fill' stretches to fill the view.
   */
  contentFit?: 'cover' | 'contain' | 'fill';
} & ViewProps;

// The looping muted-video view is implemented natively on iOS only (AVQueuePlayer +
// AVPlayerLooper). Resolve the native view lazily and only on iOS, so importing this
// module never throws on Android/other platforms, where no `YoriaxDecorativeVideo`
// view manager is registered.
const NativeView: React.ComponentType<Omit<DecorativeVideoViewProps, 'source'> & { source?: string | null }> | null =
  Platform.OS === 'ios' ? requireNativeViewManager('YoriaxDecorativeVideo') : null;

/** Derives the animated motion-still (.webp) URL that mirrors a remote video URL. */
function getMotionFallbackUri(source: string | null): string | null {
  if (!source) return null;
  const [base, query] = source.split('?');
  const webp = base.replace(/\.(mp4|m4v|mov|webm)$/i, '.webp');
  if (webp === base) return null;
  return query ? `${webp}?${query}` : webp;
}

export default function DecorativeVideoView({ source, active, contentFit = 'cover', style, ...props }: DecorativeVideoViewProps) {
  let resolvedSource: string | null = null;

  if (typeof source === 'number') {
    resolvedSource = Image.resolveAssetSource(source)?.uri ?? null;
  } else if (typeof source === 'string') {
    resolvedSource = source;
  }

  if (NativeView) {
    return <NativeView {...props} active={active} contentFit={contentFit} style={style} source={resolvedSource} />;
  }

  // Non-iOS fallback: the native looping video isn't available, so show the matching
  // animated motion still (expo-image autoplays animated webp) when one can be derived
  // from the source; otherwise render an empty placeholder so nothing crashes.
  const motionUri = getMotionFallbackUri(resolvedSource);
  if (!motionUri) {
    return <View style={style} {...props} />;
  }

  return <ExpoImage source={{ uri: motionUri }} contentFit={contentFit} style={style as StyleProp<ImageStyle>} {...props} />;
}
