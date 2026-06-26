import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
import { Image, type ViewProps } from 'react-native';

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

const NativeView: React.ComponentType<Omit<DecorativeVideoViewProps, 'source'> & { source?: string | null }> =
  requireNativeViewManager('YoriaxDecorativeVideo');

export default function DecorativeVideoView({ source, ...props }: DecorativeVideoViewProps) {
  let resolvedSource: string | null = null;

  if (typeof source === 'number') {
    resolvedSource = Image.resolveAssetSource(source)?.uri ?? null;
  } else if (typeof source === 'string') {
    resolvedSource = source;
  }

  return <NativeView {...props} source={resolvedSource} />;
}
