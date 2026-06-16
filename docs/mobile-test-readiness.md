# YORIAX Mobile Test Readiness

Stand: 2026-06-15

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
- Expo-Projekt ist im Code über `extra.eas.projectId` mit `ca24776f-fea9-45f2-9d23-1dc5e26aed06` verbunden
- App Store Connect Zugriff für Build Uploads
- App Store Connect Angaben: Support-URL, Datenschutz-URL, Screenshots, Altersfreigabe, Export-Compliance und Datenschutzfragebogen

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

## Release Checks 2026-06-16

Erledigt:

- `npm run mobile:check` ist sauber.
- `npm audit --omit=dev --audit-level=high` meldet keine High-/Critical-Probleme. Es bleiben moderate Expo-Tooling-Hinweise über `uuid`/`xcode`; `npm audit fix --force` würde Expo massiv downgraden und wird deshalb nicht verwendet.
- iOS Native-Projekt ist auf Version `1.0.0`, Build `7`, Bundle ID `com.yoriax.app`, Team `3H83CGSR39` gesetzt.
- App Store Icon liegt nativ und in Expo Assets als 1024x1024 PNG vor.
- `PrivacyInfo.xcprivacy` ist vorhanden und deklariert Required-Reason-APIs ohne Tracking.
- EAS ist lokal eingeloggt und die iOS-Credentials liegen remote auf den Expo-Servern.
- App Store Connect ist für `com.yoriax.app` vorbereitet; ASC App ID `6780680190`.
- iOS Build `7` wurde mit EAS erfolgreich gebaut und zu App Store Connect/TestFlight hochgeladen.
- App Store Connect ID `6780680190` ist in `eas.json` hinterlegt, damit non-interactive TestFlight-Submits funktionieren.

Bekannt:

- `expo-doctor` meldet 20/21 Checks. Die offene Warnung ist erwartbar, weil das iOS-Native-Projekt eingecheckt ist und `app.json`-Native-Felder dann nicht automatisch gespiegelt werden. Release-relevante iOS-Werte wurden deshalb bewusst auch direkt im Xcode-Projekt gesetzt.

Lokaler Login:

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli whoami
```

Wenn `whoami` den Expo-Namen ausgibt, kann der TestFlight-Build gestartet werden.

App Store Connect Datenschutz muss vor Einreichung passend zur echten Nutzung ausgefüllt werden. Mindestens prüfen: Account-Informationen, User-ID, Nutzungsdaten/Playback-Verlauf, User Content wie Profilbilder/Playlists, Diagnose-/Crashdaten und ob irgendein Tracking/Analytics-Dienst aktiv ist.

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
- Version: `1.0.0`
- iOS Buildnummer: `5`
- Android VersionCode: `3`
- Background-Audio ist für iOS aktiviert
- Foto-Permission-Texte sind für iOS auf Englisch gesetzt
- Export-Compliance ist als keine nicht-ausgenommene Verschlüsselung markiert
