# Yoriax Native App Plan

Goal: build real native apps for Android and iOS stores. The current mobile browser work only keeps the web product usable until the app is ready.

## Current Setup

- Web app stays at the repository root to avoid breaking Vercel.
- Native app starts as a sidecar Expo project in `apps/mobile`.
- Shared backend remains Supabase: Auth, songs, playlists, likes, feed hooks, storage and charts.
- Shared code will be extracted later only where it reduces duplication safely.
- Supabase Auth is wired in the native shell with AsyncStorage session persistence. The native app only uses public Supabase client keys, never service-role keys.

## Testing

- JavaScript/UI smoke tests: `cd apps/mobile && npm run start`, then open with Expo Go.
- Android: `cd apps/mobile && npm run android` with Android Studio emulator or a USB device.
- iOS Simulator: requires Xcode on macOS, then `cd apps/mobile && npm run ios`.
- Store-like native behavior: use Expo development builds, then Android internal testing and iOS TestFlight.

## Build Order

1. Native shell, theme and app navigation.
2. Supabase session handling with native storage.
3. Native audio player with lockscreen/background controls.
4. For-you feed with swipe gestures and hook start/end playback.
5. Library, liked songs, playlists and charts.
6. Upload/admin functions only after user-facing playback flows are stable.
7. Android internal test release.
8. iOS TestFlight release.

## Important Product Notes

- Web autoplay restrictions do not apply the same way in native app audio sessions.
- We should not ship a simple WebView wrapper as the final app.
- We can still reuse API contracts, types, theme decisions and product logic from the web app.
- If Supabase captcha protection is enforced for email/password auth, native login needs a dedicated Turnstile/native captcha flow before store release.

## Current Technical Notes

- `npm audit --omit=dev` currently reports a moderate `uuid` warning through Expo CLI tooling (`xcode` -> `uuid`). The suggested forced fix would downgrade Expo and is not safe for this setup.
