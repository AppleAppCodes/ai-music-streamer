import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const CACHE_FOLDER = `${FileSystem.cacheDirectory}yoriax-audio-cache/`;

class AudioCacheManager {
  private activeDownloads = new Map<string, FileSystem.DownloadResumable>();
  private initialized = false;

  async init() {
    if (this.initialized) return;
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_FOLDER);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_FOLDER, { intermediates: true });
      }
      this.initialized = true;
    } catch (e) {
      console.warn('Failed to initialize AudioCacheManager:', e);
    }
  }

  private getFilePath(url: string, id: string) {
    const ext = url.split('.').pop()?.split('?')[0] || 'mp3';
    return `${CACHE_FOLDER}${id}.${ext}`;
  }

  /**
   * Prefetches an audio file into the local cache.
   */
  async prefetch(url: string, id: string) {
    if (!url || !id || Platform.OS === 'web') return null;
    await this.init();

    const fileUri = this.getFilePath(url, id);
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        // Already cached
        return fileUri;
      }

      // Check if already downloading
      if (this.activeDownloads.has(id)) {
        return null; // Let the existing download finish
      }

      const downloadResumable = FileSystem.createDownloadResumable(url, fileUri);
      this.activeDownloads.set(id, downloadResumable);

      const result = await downloadResumable.downloadAsync();
      this.activeDownloads.delete(id);

      return result?.uri || null;
    } catch (e) {
      this.activeDownloads.delete(id);
      console.warn(`Failed to prefetch audio ${id}:`, e);
      return null;
    }
  }

  /**
   * Returns the local file URI if cached, otherwise returns the original URL.
   */
  async getAudioSource(url: string, id: string): Promise<string> {
    if (!url || !id || Platform.OS === 'web') return url;
    await this.init();

    const fileUri = this.getFilePath(url, id);
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        return fileUri;
      }
    } catch (e) {
      // Ignore
    }
    return url;
  }

  /**
   * Cleans up the cache directory.
   */
  async clearCache() {
    try {
      await FileSystem.deleteAsync(CACHE_FOLDER, { idempotent: true });
      this.initialized = false;
      await this.init();
    } catch (e) {
      console.warn('Failed to clear audio cache:', e);
    }
  }
}

export const audioCacheManager = new AudioCacheManager();
