import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import yoriaxLogo from '../../assets/yoriax-logo.png';
import yoriaxSymbol from '../../assets/yoriax-symbol.png';
import yoriaxLoginSymbol from '../../assets/yoriax-login-symbol.png';
import yoriaxLoginWordmark from '../../assets/yoriax-login-wordmark.png';

export function YoriaxMark({ size = 34 }: { size?: number }) {
  return <Image source={yoriaxSymbol} style={{ height: size, width: size }} resizeMode="contain" alt="YORIAX" />;
}

export function YoriaxLogo() {
  return <Image source={yoriaxLogo} style={styles.logoImage} resizeMode="contain" alt="YORIAX" />;
}

export function YoriaxLoginLogo() {
  return (
    <View style={styles.loginLogo}>
      <Image source={yoriaxLoginSymbol} style={styles.loginLogoSymbol} resizeMode="contain" alt="" />
      <Image source={yoriaxLoginWordmark} style={styles.loginLogoWordmark} resizeMode="contain" alt="YORIAX" />
    </View>
  );
}

export function BackButton({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={[styles.backButton, style]}>
      <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
    </TouchableOpacity>
  );
}

export function IconButton({
  icon,
  onPress,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={[styles.iconButton, style]}>
      <Ionicons name={icon} size={22} color={theme.colors.text} />
    </TouchableOpacity>
  );
}

export function StateCard({
  icon = 'musical-notes',
  title,
  message,
  loading = false,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  loading?: boolean;
}) {
  return (
    <View style={styles.stateCard}>
      {loading ? (
        <ActivityIndicator color={theme.colors.text} />
      ) : (
        <View style={styles.stateIcon}>
          <Ionicons name={icon} size={24} color={theme.colors.text} />
        </View>
      )}
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.stateMessage}>{message}</Text> : null}
    </View>
  );
}

export function CoverArt({
  uri,
  size,
  radius = 14,
  style,
}: {
  uri?: string | null;
  size: number;
  radius?: number;
  style?: StyleProp<ImageStyle>;
}) {
  if (uri) {
    return <Image source={{ uri }} style={[{ width: size, height: size, borderRadius: radius }, styles.cover, style]} alt="" />;
  }

  return (
    <View style={[{ width: size, height: size, borderRadius: radius }, styles.cover, styles.coverFallback, style]}>
      <YoriaxMark size={size * 0.42} />
    </View>
  );
}

export function GradientOrb({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={['rgba(124,58,237,0.34)', 'rgba(45,212,191,0.12)', 'transparent']}
      style={[styles.orb, style]}
    />
  );
}

const styles = StyleSheet.create({
  logoImage: {
    height: 36,
    width: 158,
  },
  loginLogo: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  loginLogoSymbol: {
    height: 44,
    width: 44,
  },
  loginLogoWordmark: {
    height: 34,
    width: 136,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.round,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.round,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: 10,
    padding: 22,
  },
  stateIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.round,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  stateTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateMessage: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    maxWidth: 260,
    textAlign: 'center',
  },
  cover: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderWidth: 1,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    borderRadius: 220,
    height: 280,
    opacity: 0.8,
    position: 'absolute',
    width: 280,
  },
});
