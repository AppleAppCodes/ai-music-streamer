import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { turnstileBaseUrl, turnstileSiteKey } from '../lib/env';
import { theme } from '../theme';

type TurnstileMessage =
  | { type: 'ready' }
  | { type: 'token'; token: string }
  | { type: 'expired' }
  | { type: 'error'; code?: string };

type TurnstileChallengeProps = {
  onError: (message: string | null) => void;
  onToken: (token: string | null) => void;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function TurnstileChallenge({ onError, onToken }: TurnstileChallengeProps) {
  const html = useMemo(() => {
    const siteKey = escapeHtml(turnstileSiteKey);

    return `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body {
        background: transparent;
        height: 100%;
        margin: 0;
        overflow: hidden;
        width: 100%;
      }
      body {
        align-items: center;
        display: flex;
        justify-content: center;
      }
      #turnstile-container {
        min-height: 70px;
        width: 100%;
      }
    </style>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
  </head>
  <body>
    <div id="turnstile-container"></div>
    <script>
      function post(payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      function renderTurnstile() {
        if (!window.turnstile) {
          window.setTimeout(renderTurnstile, 150);
          return;
        }

        window.turnstile.render('#turnstile-container', {
          sitekey: "${siteKey}",
          theme: "dark",
          size: "flexible",
          callback: function(token) {
            post({ type: 'token', token: token });
          },
          'expired-callback': function() {
            post({ type: 'expired' });
          },
          'error-callback': function(code) {
            post({ type: 'error', code: code });
          }
        });
        post({ type: 'ready' });
      }

      renderTurnstile();
    </script>
  </body>
</html>`;
  }, []);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as TurnstileMessage;

      if (message.type === 'token') {
        onError(null);
        onToken(message.token);
        return;
      }

      if (message.type === 'expired') {
        onToken(null);
        onError('Sicherheitspruefung abgelaufen. Bitte warte auf eine neue Pruefung.');
        return;
      }

      if (message.type === 'error') {
        onToken(null);
        onError(`Sicherheitspruefung konnte nicht geladen werden${message.code ? ` (${message.code})` : ''}.`);
      }
    } catch {
      onToken(null);
      onError('Sicherheitspruefung konnte nicht gelesen werden.');
    }
  }

  if (!turnstileSiteKey) {
    return (
      <View style={styles.missingBox}>
        <Text style={styles.missingTitle}>Turnstile Env fehlt</Text>
        <Text style={styles.missingText}>EXPO_PUBLIC_TURNSTILE_SITE_KEY ist fuer Native Login erforderlich.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.loadingOverlay} pointerEvents="none">
        <ActivityIndicator color={theme.colors.muted} />
      </View>
      <WebView
        automaticallyAdjustContentInsets={false}
        bounces={false}
        javaScriptEnabled
        mixedContentMode="always"
        onError={() => {
          onToken(null);
          onError('Sicherheitspruefung konnte nicht geladen werden.');
        }}
        onMessage={handleMessage}
        originWhitelist={['*']}
        scrollEnabled={false}
        source={{ html, baseUrl: turnstileBaseUrl }}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: theme.colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 86,
    marginTop: 16,
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  missingBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.32)',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    padding: 12,
  },
  missingTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  missingText: {
    color: '#fecaca',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
