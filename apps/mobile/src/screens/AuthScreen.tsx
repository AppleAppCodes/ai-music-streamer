import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
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
import { useI18n } from '../lib/i18n';

type AuthMode = 'sign-in' | 'sign-up';

export function AuthScreen() {
  const { t } = useI18n();
  const { authReady, lastError, signIn, signInWithApple, signInWithGoogle, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleSubmitting, setAppleSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const isSignUp = mode === 'sign-up';
  const captchaReady = hasTurnstileConfig && Boolean(captchaToken);
  const canSubmit = authReady && captchaReady && email.trim().length > 3 && password.length >= 6 && !submitting;

  useEffect(() => {
    let active = true;

    if (Platform.OS !== 'ios') {
      return () => {
        active = false;
      };
    }

    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (active) setAppleAvailable(available);
      })
      .catch(() => {
        if (active) setAppleAvailable(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setMessage(null);

    const result = isSignUp ? await signUp(email, password, captchaToken ?? undefined) : await signIn(email, password, captchaToken ?? undefined);

    if (!result.ok) {
      setMessage(result.message);
    } else if (result.needsEmailConfirmation) {
      setMessage(t('auth.accountCreated'));
      setMode('sign-in');
    }

    setSubmitting(false);
    setCaptchaToken(null);
    setCaptchaResetKey((key) => key + 1);
  }

  async function handleGoogleLogin() {
    if (!authReady || googleSubmitting) return;

    setGoogleSubmitting(true);
    setMessage(null);

    const result = await signInWithGoogle();
    if (!result.ok) {
      setMessage(result.message);
    }

    setGoogleSubmitting(false);
  }

  async function handleAppleLogin() {
    if (!authReady || appleSubmitting || googleSubmitting || submitting) return;

    setAppleSubmitting(true);
    setMessage(null);

    const result = await signInWithApple();
    if (!result.ok) {
      setMessage(result.message);
    }

    setAppleSubmitting(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{isSignUp ? t('auth.register') : t('auth.welcome')}</Text>
        <Text style={styles.copy}>{t('auth.copy')}</Text>

        {!authReady ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>{t('auth.localEnvMissing')}</Text>
            <Text style={styles.warningText}>{t('auth.localEnvMissingCopy')}</Text>
          </View>
        ) : null}

        <View style={styles.socialButtons}>
          {appleAvailable ? (
            <View pointerEvents={appleSubmitting || googleSubmitting || submitting ? 'none' : 'auto'}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                cornerRadius={18}
                onPress={() => {
                  void handleAppleLogin();
                }}
                style={[styles.appleButton, appleSubmitting && styles.buttonDisabled]}
              />
            </View>
          ) : null}

          <TouchableOpacity
            accessibilityRole="button"
            disabled={!authReady || appleSubmitting || googleSubmitting || submitting}
            onPress={() => {
              void handleGoogleLogin();
            }}
            style={[
              styles.googleButton,
              (!authReady || appleSubmitting || googleSubmitting || submitting) && styles.buttonDisabled,
            ]}
          >
            {googleSubmitting ? (
              <ActivityIndicator color={theme.colors.text} />
            ) : (
              <>
                <View style={styles.googleIcon}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>{t('auth.googleContinue')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('auth.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.email')}</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={theme.colors.subtle}
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.password')}</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              onChangeText={setPassword}
              placeholder={t('auth.passwordPlaceholder')}
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
          {captchaReady ? t('auth.captchaComplete') : t('auth.captchaPrompt')}
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
              {!captchaReady ? t('auth.captchaConfirm') : isSignUp ? t('auth.createAccount') : t('auth.login')}
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
            {isSignUp ? t('auth.signInInstead') : t('auth.noAccount')}
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
    backgroundColor: 'rgba(23, 17, 31, 0.88)',
    borderColor: theme.colors.border,
    borderRadius: 30,
    borderWidth: 1,
    padding: 24,
  },
  title: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.2,
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
  socialButtons: {
    gap: 12,
    marginTop: 22,
  },
  appleButton: {
    height: 52,
    width: '100%',
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: theme.colors.borderStrong,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  googleIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  googleIconText: {
    color: '#050505',
    fontSize: 15,
    fontWeight: '900',
  },
  googleButtonText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  dividerLine: {
    backgroundColor: theme.colors.border,
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: theme.colors.subtle,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  form: {
    gap: 14,
    marginTop: 20,
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
