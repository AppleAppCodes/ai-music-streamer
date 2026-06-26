import { Image as ExpoImage } from 'expo-image';
import { getBundledMotionLoopAsset } from './motion-loop-assets';

export function getMotionImageUri(videoUri?: string | null) {
  if (!videoUri) return null;

  const [base, query] = videoUri.split('?');
  const motionBase = base.replace(/\.(mp4|m4v|mov|webm)$/i, '.webp');
  if (motionBase === base) return null;

  return `${motionBase}${query ? `?${query}` : ''}`;
}

export function getMotionImageSource(videoUri?: string | null) {
  const bundledAsset = getBundledMotionLoopAsset(videoUri);
  if (bundledAsset) return bundledAsset;

  const motionUri = getMotionImageUri(videoUri);
  return motionUri ? { uri: motionUri, isAnimated: true } : null;
}

export function isRemoteUri(uri?: string | null): uri is string {
  return Boolean(uri && /^https?:\/\//i.test(uri));
}

export async function prefetchMotionImages(uris: Iterable<string>, limit = 8) {
  const motionUris = Array.from(new Set(uris))
    .map((uri) => getMotionImageUri(uri))
    .filter((uri): uri is string => isRemoteUri(uri))
    .slice(0, limit);

  if (motionUris.length === 0) return;

  await Promise.allSettled(
    motionUris.map((uri) => ExpoImage.prefetch(uri, { cachePolicy: 'memory-disk' })),
  );
}
