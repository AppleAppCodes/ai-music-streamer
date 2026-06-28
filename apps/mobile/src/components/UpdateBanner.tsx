import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppUpdate } from '../lib/app-update';
import { useI18n } from '../lib/i18n';
import { theme } from '../theme';

export function UpdateBanner() {
  const { t } = useI18n();
  const { update, dismiss } = useAppUpdate();

  if (!update) return null;

  return (
    <LinearGradient
      colors={['rgba(124,58,237,0.22)', 'rgba(45,212,191,0.12)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.banner}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="arrow-up-circle" size={22} color={theme.colors.primaryLight} />
      </View>

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>{t('update.title')}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {t('update.subtitle', { version: update.version })}
        </Text>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.85}
        onPress={() => { void Linking.openURL(update.url).catch(() => undefined); }}
        style={styles.cta}
      >
        <Text style={styles.ctaText}>{t('update.action')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('update.dismiss')}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => { void dismiss(); }}
        style={styles.close}
      >
        <Ionicons name="close" size={18} color={theme.colors.muted} />
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    borderColor: 'rgba(168,85,247,0.4)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(168,85,247,0.16)',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 2,
  },
  cta: {
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ctaText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  close: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 20,
  },
});
