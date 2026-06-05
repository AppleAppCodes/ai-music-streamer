# YORIAX Desktop

Electron wrapper for the production YORIAX web app.

## Development

```bash
npm run desktop:dev
```

By default the app loads `https://www.yoriax.com`. To point it at a local or preview URL:

```bash
YORIAX_DESKTOP_URL=https://www.yoriax.com npm run desktop:dev
```

## Packaging

```bash
npm run desktop:dist:mac
npm run desktop:dist:win
```

Store-ready releases still need platform signing and notarization:

- macOS: Apple Developer certificate, hardened runtime, notarization.
- Windows: code-signing certificate for SmartScreen reputation.
