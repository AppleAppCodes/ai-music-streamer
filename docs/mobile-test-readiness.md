# YORIAX Mobile Test Readiness

Stand: 2026-06-04

## Scope

Die Mobile-App liegt unter `apps/mobile` und nutzt Expo/React Native mit Supabase als Backend. iOS ist bereits nativ vorgebaut und eingecheckt. Android wird bewusst nicht eingecheckt, bis wir den nativen Ordner wirklich brauchen.

## Vor Jedem Testbuild

```bash
npm run mobile:check
```

Der Check führt Mobile-TypeScript und den Mobile-Lint-Scope aus. Wenn dieser Befehl fehlschlägt, wird kein Testbuild verteilt.

## Lokale Device-Tests

iOS über Xcode:

```bash
npm run mobile:ios
```

Android über Android Studio oder Emulator:

```bash
npm run mobile:prebuild:android
npm run mobile:android
```

Der Android-Prebuild erzeugt `apps/mobile/android`. Diesen Ordner erst committen, wenn wir Android nativ anpassen müssen.

## Interne Testbuilds

iOS Preview:

```bash
npm run mobile:eas:preview:ios
```

Android Preview:

```bash
npm run mobile:eas:preview:android
```

Die Preview-Profile erzeugen interne Testbuilds. Für Android ist das zunächst ein APK, damit Tests schnell auf echten Geräten installierbar sind. Production nutzt später ein AAB für Google Play.

## Pflicht-Checks Auf Echten Geräten

- Login, Logout und Session-Wiederherstellung
- Home, Charts, Liked Songs, Artists und Suche
- Hook-Playback im Für-dich-Modus inklusive Swipe, Like und Audio-Startpunkt
- Normaler Player: Play, Pause, Skip, Queue und Mini/Fullscreen-State
- Artist-Seiten inklusive Banner, Socials und Songliste
- Playlist hinzufügen, leere Playlist, Liked Songs und leere Zustände
- Profilbild-Auswahl inklusive iOS-Fotoberechtigung
- Background-Audio und Lock-Screen-Metadaten
- Kein Admin-UI für normale Nutzer

## Aktuelle Store-Metadaten Im Code

- iOS Bundle ID: `com.yoriax.app`
- Android Package: `com.yoriax.app`
- Version: `0.1.0`
- Buildnummer / VersionCode: `2`
- Background-Audio ist für iOS aktiviert
- Foto-Permission-Texte sind für iOS gesetzt
- Export-Compliance ist als keine nicht-ausgenommene Verschlüsselung markiert
