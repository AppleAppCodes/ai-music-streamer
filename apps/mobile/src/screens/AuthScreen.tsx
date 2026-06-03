import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { TurnstileChallenge } from '../components/TurnstileChallenge';
import { useAuth } from '../lib/auth-context';
import { hasTurnstileConfig } from '../lib/env';
import { theme } from '../theme';

type AuthMode = 'sign-in' | 'sign-up';

export function AuthScreen() {
  const { authReady, lastError, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignUp = mode === 'sign-up';
  const captchaReady = hasTurnstileConfig && Boolean(captchaToken);
  const canSubmit = authReady && captchaReady && email.trim().length > 3 && password.length >= 6 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setMessage(null);

    const result = isSignUp ? await signUp(email, password, captchaToken ?? undefined) : await signIn(email, password, captchaToken ?? undefined);

    if (!result.ok) {
      setMessage(result.message);
    } else if (result.needsEmailConfirmation) {
      setMessage('Account angelegt. Bitte bestaetige deine E-Mail und melde dich danach an.');
      setMode('sign-in');
    }

    setSubmitting(false);
    setCaptchaToken(null);
    setCaptchaResetKey((key) => key + 1);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Yoriax Account</Text>
        <Text style={styles.title}>{isSignUp ? 'Registrieren' : 'Willkommen zurueck'}</Text>
        <Text style={styles.copy}>
          Melde dich mit deinem bestehenden Yoriax Account an. Die native App nutzt dieselbe
          Supabase-Session wie unsere Plattformdaten.
        </Text>

        {!authReady ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Lokale Env fehlt</Text>
            <Text style={styles.warningText}>
              Fuer den Simulator braucht die App EXPO_PUBLIC_SUPABASE_URL und
              EXPO_PUBLIC_SUPABASE_ANON_KEY.
            </Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>E-Mail</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="du@yoriax.com"
              placeholderTextColor={theme.colors.subtle}
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Passwort</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              onChangeText={setPassword}
              placeholder="Mindestens 6 Zeichen"
              placeholderTextColor={theme.colors.subtle}
              secureTextEntry
              style={styles.input}
              textContentType={isSignUp ? 'newPassword' : 'password'}
              value={password}
            />
          </View>
        </View>

        <TurnstileChallenge
          key={captchaResetKey}
          onError={setCaptchaError}
          onToken={setCaptchaToken}
        />
        <Text style={styles.captchaHelp}>
          {captchaReady ? 'Sicherheitspruefung abgeschlossen.' : 'Bitte bestaetige die Sicherheitspruefung, bevor du dich einloggst.'}
        </Text>

        {message || captchaError || lastError ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{message ?? captchaError ?? lastError}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
        >
          {submitting ? (
            <ActivityIndicator color="#0b0b0b" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {!captchaReady ? 'Sicherheitspruefung bestaetigen' : isSignUp ? 'Account erstellen' : 'Einloggen'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            setMode(isSignUp ? 'sign-in' : 'sign-up');
            setMessage(null);
          }}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            {isSignUp ? 'Schon einen Account? Einloggen' : 'Noch keinen Account? Registrieren'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 620,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 30,
    borderWidth: 1,
    padding: 24,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginTop: 10,
  },
  copy: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  warningBox: {
    backgroundColor: 'rgba(124,58,237,0.14)',
    borderColor: 'rgba(124,58,237,0.42)',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  warningTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  warningText: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  form: {
    gap: 14,
    marginTop: 22,
  },
  field: {
    gap: 8,
  },
  label: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: theme.colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  messageBox: {
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderColor: 'rgba(239,68,68,0.34)',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    padding: 12,
  },
  messageText: {
    color: '#fecaca',
    fontSize: 13,
    lineHeight: 19,
  },
  captchaHelp: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: 18,
    marginTop: 20,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#050505',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 4,
  },
  secondaryButtonText: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
});
