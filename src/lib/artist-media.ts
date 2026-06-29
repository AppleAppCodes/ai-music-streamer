export function getArtistStorageSlug(artistName: string) {
  return artistName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

export function normalizeStorageExtension(extension: string | null | undefined) {
  const normalized = extension?.replace(/^\./, '').trim().toLowerCase() ?? '';
  return /^[a-z0-9]+$/.test(normalized) ? normalized : '';
}

export function isArtistBannerFile(fileName: string, artistSlug: string) {
  const normalizedName = fileName.toLowerCase();
  const expectedPrefix = `${artistSlug}.`;
  if (!normalizedName.startsWith(expectedPrefix)) return false;

  const suffix = normalizedName.slice(expectedPrefix.length);
  return /^[a-z0-9]+$/.test(suffix);
}

export function isArtistVideoFile(fileName: string, artistSlug: string) {
  const normalizedName = fileName.toLowerCase();
  const underscoredPrefix = `${artistSlug}_video_`;
  const dashedPrefix = `${artistSlug}_video-`;

  const suffix = normalizedName.startsWith(underscoredPrefix)
    ? normalizedName.slice(underscoredPrefix.length)
    : normalizedName.startsWith(dashedPrefix)
      ? normalizedName.slice(dashedPrefix.length)
      : null;

  return Boolean(suffix && /^[a-z0-9][a-z0-9_-]*\.(mp4|webm|mov|m4v)$/.test(suffix));
}

export function getArtistBannerPath(artistName: string, extension: string | null | undefined) {
  const artistSlug = getArtistStorageSlug(artistName);
  const safeExtension = normalizeStorageExtension(extension) || 'webp';
  return `banners/${artistSlug}.${safeExtension}`;
}

export function getArtistVideoFileName(
  artistName: string,
  cacheKey: number,
  extension: string | null | undefined,
) {
  const artistSlug = getArtistStorageSlug(artistName);
  const safeExtension = normalizeStorageExtension(extension) || 'mp4';
  return `${artistSlug}_video_${cacheKey}.${safeExtension}`;
}
