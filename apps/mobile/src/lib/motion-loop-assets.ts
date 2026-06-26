// Generated from current YORIAX decorative video storage paths.
// These bundled animated WebPs avoid native video playback for visual-only loops on iOS.

import type { ImageRequireSource } from 'react-native';

const MOTION_LOOP_ASSETS: Record<string, ImageRequireSource> = {
  "banners/white_noir_video_1780726791362-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_white_noir_video_1780726791362_silent_1782428380118_mp4.webp'),
  "banners/trumpet_twins_video_1782402729418-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_trumpet_twins_video_1782402729418_silent_1782428380118_mp4.webp'),
  "banners/the_starlite_boys_video-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_the_starlite_boys_video_silent_1782428380118_mp4.webp'),
  "banners/squibi_video-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_squibi_video_silent_1782428380118_mp4.webp'),
  "banners/mvdmuzik_video-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_mvdmuzik_video_silent_1782428380118_mp4.webp'),
  "banners/lewnamoon_video_1780857324927-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_lewnamoon_video_1780857324927_silent_1782428380118_mp4.webp'),
  "banners/lewnamoon_video_1780852107394-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_lewnamoon_video_1780852107394_silent_1782428380118_mp4.webp'),
  "banners/laz1tunes_video-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_laz1tunes_video_silent_1782428380118_mp4.webp'),
  "banners/juno_bantu_video-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_juno_bantu_video_silent_1782428380118_mp4.webp'),
  "banners/hrtbrk3r_video_1780988209360-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_hrtbrk3r_video_1780988209360_silent_1782428380118_mp4.webp'),
  "banners/dj_azura_video_1780825077084-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_dj_azura_video_1780825077084_silent_1782428380118_mp4.webp'),
  "banners/defn0t3_video-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_defn0t3_video_silent_1782428380118_mp4.webp'),
  "banners/aya_milari_video-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_aya_milari_video_silent_1782428380118_mp4.webp'),
  "banners/austin_creek_video-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_austin_creek_video_silent_1782428380118_mp4.webp'),
  "banners/artificialz_video_1780773977778-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_artificialz_video_1780773977778_silent_1782428380118_mp4.webp'),
  "banners/artificialz_video_1780773607405-silent-1782428380118.mp4": require('../../assets/motion-loops/banners_artificialz_video_1780773607405_silent_1782428380118_mp4.webp'),
  "playlist-videos/78103a49-2ca2-4d75-8ceb-b98abcf18da3-1782380504600-silent-1782428380118.mp4": require('../../assets/motion-loops/playlist_videos_78103a49_2ca2_4d75_8ceb_b98abcf18da3_1782380504600_silent_1782428380118_mp4.webp'),
  "playlist-videos/1f17e3e8-fdd4-4b91-98ad-0ddc82deb8c8-1782380329552-silent-1782428380118.mp4": require('../../assets/motion-loops/playlist_videos_1f17e3e8_fdd4_4b91_98ad_0ddc82deb8c8_1782380329552_silent_1782428380118_mp4.webp'),
  "playlist-videos/daily-new-releases-1782377969833-silent-1782428380118.mp4": require('../../assets/motion-loops/playlist_videos_daily_new_releases_1782377969833_silent_1782428380118_mp4.webp'),
  "charts/background-video.mp4": require('../../assets/motion-loops/charts_background_video_mp4.webp'),
  "discover/background-video.mp4": require('../../assets/motion-loops/discover_background_video_mp4.webp'),
};

function storagePathFromPublicUrl(uri: string) {
  const marker = '/storage/v1/object/public/covers/';
  const markerIndex = uri.indexOf(marker);
  if (markerIndex === -1) return uri;

  const pathWithQuery = uri.slice(markerIndex + marker.length);
  return decodeURIComponent(pathWithQuery.split('?')[0] || '');
}

export function getBundledMotionLoopAsset(videoUri?: string | null) {
  if (!videoUri) return null;
  return MOTION_LOOP_ASSETS[storagePathFromPublicUrl(videoUri)] ?? null;
}
