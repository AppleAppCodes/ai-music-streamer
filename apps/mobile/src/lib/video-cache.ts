import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const CACHE_FOLDER = `${FileSystem.cacheDirectory}yoriax-video-cache/`;

class VideoCacheManager {
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
      console.warn('Failed to initialize VideoCacheManager:', e);
    }
  }

  private getFilePath(url: string, id: string) {
    const ext = url.split('.').pop()?.split('?')[0] || 'mp4';
    return `${CACHE_FOLDER}${id}.${ext}`;
  }

  private async cleanupCache() {
    try {
      const files = await FileSystem.readDirectoryAsync(CACHE_FOLDER);
      if (files.length <= 10) return; // Keep max 10 videos cached

      const fileStats = await Promise.all(
        files.map(async (file) => {
          const info = await FileSystem.getInfoAsync(`${CACHE_FOLDER}${file}`);
          return { name: file, time: info.exists ? info.modificationTime || 0 : 0 };
        })
      );

      fileStats.sort((a, b) => b.time - a.time); // newest first

      const filesToDelete = fileStats.slice(10);
      for (const file of filesToDelete) {
        await FileSystem.deleteAsync(`${CACHE_FOLDER}${file.name}`, { idempotent: true });
      }
    } catch (e) {
      console.warn('Failed to cleanup video cache:', e);
    }
  }

  /**
   * Prefetches a video file into the local cache.
   */
  async prefetch(url: string, id: string) {
    if (!url || !id || Platform.OS === 'web') return null;
    
    // Ignore local required files
    if (typeof url === 'number' || (typeof url === 'string' && !url.startsWith('http'))) {
      return url;
    }

    await this.init();

    const fileUri = this.getFilePath(url, id);
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        return fileUri;
      }

      if (this.activeDownloads.has(id)) {
        return null;
      }

      const downloadResumable = FileSystem.createDownloadResumable(url, fileUri);
      this.activeDownloads.set(id, downloadResumable);

      const result = await downloadResumable.downloadAsync();
      this.activeDownloads.delete(id);

      void this.cleanupCache();

      return result?.uri || null;
    } catch (e) {
      this.activeDownloads.delete(id);
      console.warn(`Failed to prefetch video ${id}:`, e);
      return null;
    }
  }

  /**
   * Returns the local file URI if cached, otherwise returns the original URL.
   */
  async getVideoSource(url: string, id: string): Promise<string> {
    if (!url || !id || Platform.OS === 'web') return url;
    
    if (typeof url === 'number' || (typeof url === 'string' && !url.startsWith('http'))) {
      return url;
    }
    
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
    
    // If not cached, trigger a background prefetch so next time it's fast
    void this.prefetch(url, id);
    return url;
  }

  async clearCache() {
    try {
      await FileSystem.deleteAsync(CACHE_FOLDER, { idempotent: true });
      this.initialized = false;
      await this.init();
    } catch (e) {
      console.warn('Failed to clear video cache:', e);
    }
  }
}

export const videoCacheManager = new VideoCacheManager();
