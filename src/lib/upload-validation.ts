export const MAX_COVER_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 120 * 1024 * 1024;

export const ALLOWED_COVER_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const ALLOWED_COVER_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export const ALLOWED_AUDIO_TYPES = new Set([
  'audio/aac',
  'audio/flac',
  'audio/m4a',
  'audio/mp3',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
  'audio/x-wav',
]);

export const ALLOWED_AUDIO_EXTENSIONS = new Set([
  'aac',
  'flac',
  'm4a',
  'mp3',
  'mp4',
  'ogg',
  'wav',
  'webm',
]);

interface ValidateUploadFileOptions {
  allowedExtensions: Set<string>;
  allowedMimeTypes: Set<string>;
  label: string;
  maxBytes: number;
}

export function getUploadFileExtension(file: File): string {
  return file.name.split('?')[0]?.split('.').pop()?.toLowerCase() || '';
}

export function extensionForMimeType(mimeType: string, fallback: string) {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3';
    case 'audio/mp4':
    case 'audio/x-m4a':
    case 'audio/m4a':
      return 'm4a';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/webm':
      return 'webm';
    case 'audio/flac':
      return 'flac';
    case 'audio/aac':
      return 'aac';
    default:
      return fallback;
  }
}

export function validateUploadFile(
  file: File,
  { allowedExtensions, allowedMimeTypes, label, maxBytes }: ValidateUploadFileOptions,
): string | null {
  if (file.size <= 0) {
    return `${label} ist leer.`;
  }

  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return `${label} ist zu groß. Maximal erlaubt sind ${maxMb} MB.`;
  }

  const mimeType = file.type.toLowerCase();
  const extension = getUploadFileExtension(file);

  if (mimeType && allowedMimeTypes.has(mimeType)) {
    return null;
  }

  if (extension && allowedExtensions.has(extension)) {
    return null;
  }

  return `${label} hat einen nicht erlaubten Dateityp.`;
}
