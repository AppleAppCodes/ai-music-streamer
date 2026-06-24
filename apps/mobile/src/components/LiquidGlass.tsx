import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

export const LIQUID_GLASS_ENABLED = true;

type LiquidGlassVariant = 'chrome' | 'pill' | 'panel' | 'sheet' | 'toast';

type LiquidGlassSurfaceProps = {
  children?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  radius?: number;
  style?: StyleProp<ViewStyle>;
  variant?: LiquidGlassVariant;
};

const variantConfig: Record<LiquidGlassVariant, {
  blur: number;
  fill: [string, string, ...string[]];
  glow: string;
  highlight: [string, string, ...string[]];
  stroke: string;
}> = {
  chrome: {
    blur: 42,
    fill: ['rgba(16,12,25,0.72)', 'rgba(10,8,18,0.54)', 'rgba(124,58,237,0.10)'],
    glow: 'rgba(168,85,247,0.16)',
    highlight: ['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)'],
    stroke: 'rgba(255,255,255,0.18)',
  },
  pill: {
    blur: 46,
    fill: ['rgba(24,19,35,0.66)', 'rgba(11,9,18,0.48)', 'rgba(45,212,191,0.07)'],
    glow: 'rgba(255,255,255,0.12)',
    highlight: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)'],
    stroke: 'rgba(255,255,255,0.20)',
  },
  panel: {
    blur: 28,
    fill: ['rgba(20,13,30,0.88)', 'rgba(10,8,16,0.76)', 'rgba(124,58,237,0.10)'],
    glow: 'rgba(124,58,237,0.14)',
    highlight: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)'],
    stroke: 'rgba(168,85,247,0.24)',
  },
  sheet: {
    blur: 34,
    fill: ['rgba(22,14,32,0.92)', 'rgba(11,8,18,0.86)', 'rgba(124,58,237,0.13)'],
    glow: 'rgba(168,85,247,0.20)',
    highlight: ['rgba(255,255,255,0.17)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)'],
    stroke: 'rgba(168,85,247,0.30)',
  },
  toast: {
    blur: 38,
    fill: ['rgba(27,20,36,0.90)', 'rgba(12,9,19,0.78)', 'rgba(45,212,191,0.08)'],
    glow: 'rgba(45,212,191,0.13)',
    highlight: ['rgba(255,255,255,0.19)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)'],
    stroke: 'rgba(255,255,255,0.18)',
  },
};

export function LiquidGlassSurface({
  children,
  contentStyle,
  intensity,
  pointerEvents,
  radius = theme.radii.xl,
  style,
  variant = 'chrome',
}: LiquidGlassSurfaceProps) {
  const config = variantConfig[variant];
  const blurIntensity = intensity ?? config.blur;

  if (!LIQUID_GLASS_ENABLED) {
    return (
      <View pointerEvents={pointerEvents} style={[styles.surface, { borderRadius: radius }, styles.fallback, style]}>
        <View style={contentStyle}>{children}</View>
      </View>
    );
  }

  return (
    <View pointerEvents={pointerEvents} style={[styles.surface, { borderRadius: radius }, style]}>
      {Platform.OS !== 'web' ? (
        <BlurView intensity={blurIntensity} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      <LinearGradient
        colors={config.fill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={config.highlight}
        locations={[0, 0.48, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: config.glow }]} />
      <View pointerEvents="none" style={[styles.stroke, { borderColor: config.stroke, borderRadius: radius }]} />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: 'rgba(15,12,22,0.94)',
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
  },
  glow: {
    borderRadius: 180,
    height: 180,
    opacity: 0.9,
    position: 'absolute',
    right: -82,
    top: -106,
    width: 180,
  },
  stroke: {
    borderWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
