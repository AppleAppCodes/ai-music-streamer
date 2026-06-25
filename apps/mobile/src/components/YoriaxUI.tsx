import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import yoriaxSymbol from '../../assets/yoriax-symbol.png';
import yoriaxAppIcon from '../../assets/icon.png';

export function YoriaxMark({ size = 34 }: { size?: number }) {
  return <Image source={yoriaxSymbol} style={{ height: size, width: size }} resizeMode="contain" alt="YORIAX" />;
}

export function YoriaxLogo() {
  return <Image source={yoriaxSymbol} style={styles.logoImage} resizeMode="contain" alt="YORIAX" />;
}

export function YoriaxLoginLogo() {
  return (
    <View style={styles.loginLogo}>
      <Image source={yoriaxSymbol} style={styles.loginLogoSymbol} resizeMode="contain" alt="YORIAX" />
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
  style?: StyleProp<ImageStyle | ViewStyle>;
}) {
  const isLocalSymbol = uri === 'local://yoriax-symbol';
  const [imageState, setImageState] = useState({ ready: isLocalSymbol, uri: uri ?? null });
  const imageReady = imageState.uri === (uri ?? null) ? imageState.ready : isLocalSymbol;

  useEffect(() => {
    if (!uri || uri === 'local://yoriax-symbol' || !/^https?:\/\//i.test(uri)) return;
    Image.prefetch(uri).catch(() => {
      // The visible image still handles fallback state. Prefetch failures should
      // not block rendering.
    });
  }, [uri]);

  if (uri) {
    const source = uri === 'local://yoriax-symbol'
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ? require('../../assets/yoriax-symbol.png')
      : { uri };

    return (
      <View style={[{ width: size, height: size, borderRadius: radius }, styles.cover, style]}>
        <LinearGradient
          colors={['rgba(124,58,237,0.28)', 'rgba(20,12,36,0.98)', 'rgba(5,5,5,0.94)']}
          style={StyleSheet.absoluteFill}
        />
        {!imageReady ? (
          <View style={styles.coverLoadingFallback}>
            <YoriaxMark size={Math.max(18, size * 0.32)} />
          </View>
        ) : null}
        <Image
          source={source}
          style={[StyleSheet.absoluteFill, !imageReady && styles.coverImageHidden]}
          resizeMode="cover"
          alt=""
          onError={() => setImageState({ ready: false, uri })}
          onLoad={() => setImageState({ ready: true, uri })}
        />
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size, borderRadius: radius }, styles.cover, styles.coverFallback, style]}>
      <YoriaxMark size={size * 0.42} />
    </View>
  );
}

export function YoriaxPlaylistCover({
  radius = 18,
  size,
  style,
}: {
  radius?: number;
  size: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={yoriaxAppIcon}
      style={[{ borderRadius: radius, height: size, width: size }, styles.cover, style]}
      resizeMode="cover"
      alt="YORIAX"
    />
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
    height: 38,
    width: 38,
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
    overflow: 'hidden',
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLoadingFallback: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  coverImageHidden: {
    opacity: 0,
  },
  orb: {
    borderRadius: 220,
    height: 280,
    opacity: 0.8,
    position: 'absolute',
    width: 280,
  },
});
