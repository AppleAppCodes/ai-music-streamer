# YORIAX Mobile Test Readiness

Stand: 2026-06-05

## Scope

Die Mobile-App liegt unter `apps/mobile` und nutzt Expo/React Native mit Supabase als Backend. iOS ist bereits nativ vorgebaut und eingecheckt. Android wird bewusst nicht eingecheckt, bis wir den nativen Ordner wirklich brauchen.

## Vor Jedem Testbuild

```bash
npm run mobile:check
```

Der Check führt Mobile-TypeScript und den Mobile-Lint-Scope aus. Wenn dieser Befehl fehlschlägt, wird kein Testbuild verteilt.

## Lokale Device-Tests

Expo Go ist fuer diese App aktuell nicht der richtige Testweg. Das Projekt nutzt Expo SDK 56; wenn Expo Go auf dem Handy diese SDK-Version nicht unterstützt, erscheint "Project is incompatible with this version of Expo Go". Nutze stattdessen einen Development Build.

iOS Development Build einmal auf dem iPhone installieren:

```bash
npm run mobile:ios:device
```

Danach Metro fuer die installierte YORIAX-Development-App starten:

```bash
npm run mobile:start:dev-client
```

Development Builds enthalten den Expo Dev Launcher. Wenn Metro nicht läuft oder das iPhone den Mac nicht findet, erscheint "Finding Dev Servers" bzw. "No development servers found". Das ist nur bei Development Builds normal. TestFlight-/Production-Builds starten direkt in YORIAX ohne Dev Launcher.

Wenn iPhone und Mac sich im Netzwerk nicht finden, den Tunnel nutzen:

```bash
npm run mobile:start:dev-client:tunnel
```

Android über Android Studio oder Emulator:

```bash
npm run mobile:prebuild:android
npm run mobile:android
```

Der Android-Prebuild erzeugt `apps/mobile/android`. Diesen Ordner erst committen, wenn wir Android nativ anpassen müssen.

## Interne Testbuilds

iOS Preview ohne TestFlight, aber ohne Dev Launcher:

```bash
npm run mobile:eas:preview:ios
```

Android Preview:

```bash
npm run mobile:eas:preview:android
```

Die Preview-Profile erzeugen interne Testbuilds. Für Android ist das zunächst ein APK, damit Tests schnell auf echten Geräten installierbar sind. Production nutzt später ein AAB für Google Play.

## TestFlight Ablauf

Voraussetzungen:

- Aktiver Apple Developer Program Account
- App Store Connect App mit Bundle ID `com.yoriax.app`
- EAS/Expo Account Login lokal: `cd apps/mobile && npx eas-cli login`
- App Store Connect Zugriff für Build Uploads

Vor jedem TestFlight Build:

```bash
npm run mobile:check
```

Build und automatischer Upload nach App Store Connect:

```bash
npm run mobile:testflight
```

Alternativ getrennt:

```bash
npm run mobile:eas:production:ios
npm run mobile:eas:submit:ios
```

Nach dem Upload muss Apple den Build verarbeiten. Danach erscheint er in App Store Connect unter TestFlight und kann internen Testern zugewiesen werden.

Die TestFlight Builds verwenden die `production` EAS-Konfiguration und enthalten keinen Expo Dev Launcher.

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
