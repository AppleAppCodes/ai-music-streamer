import imageCompression from 'browser-image-compression';

export async function compressImage(file: File): Promise<File> {
  // Check if file is an image
  if (!file.type.startsWith('image/')) {
    return file; // Return as-is if it's not an image (e.g. video)
  }

  // Enforce a hard 15MB limit before even attempting compression
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Das Bild ist zu groß. Bitte lade maximal 15 MB hoch.');
  }

  const options = {
    maxSizeMB: 0.2, // Aim for ~200 KB
    maxWidthOrHeight: 1080,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.85
  };

  try {
    const compressedFile = await imageCompression(file, options);
    
    // browser-image-compression might return a Blob, we convert it back to a File
    // preserving the original name but changing the extension to .webp
    const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
    
    return new File([compressedFile], newName, {
      type: 'image/webp',
      lastModified: Date.now()
    });
  } catch (error) {
    console.error('Image compression failed:', error);
    // Fallback to original file if compression fails, but still block if >10MB?
    // Actually, if compression fails, it's safer to throw.
    throw new Error('Fehler beim Komprimieren des Bildes.');
  }
}
