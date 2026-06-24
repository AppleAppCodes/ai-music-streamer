import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '../theme';

type PlayingVisualizerProps = {
  active: boolean;
  style?: StyleProp<ViewStyle>;
};

export const PlayingVisualizer = memo(function PlayingVisualizer({
  active,
  style,
}: PlayingVisualizerProps) {
  const bars = useRef([
    new Animated.Value(0.32),
    new Animated.Value(0.58),
    new Animated.Value(0.42),
  ]).current;

  useEffect(() => {
    if (!active) {
      bars.forEach((bar) => {
        bar.stopAnimation();
        bar.setValue(0.32);
      });
      return;
    }

    const loops = bars.map((bar, index) => (
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 90),
          Animated.timing(bar, {
            duration: 210,
            easing: Easing.inOut(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            duration: 230,
            easing: Easing.inOut(Easing.quad),
            toValue: index === 1 ? 0.38 : 0.54,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            duration: 190,
            easing: Easing.inOut(Easing.quad),
            toValue: index === 2 ? 0.9 : 0.68,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            duration: 220,
            easing: Easing.inOut(Easing.quad),
            toValue: 0.32,
            useNativeDriver: true,
          }),
        ]),
      )
    ));

    loops.forEach((loop) => loop.start());

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [active, bars]);

  if (!active) return null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.container, style]}
    >
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              transform: [{ scaleY: bar }],
            },
          ]}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 2,
    height: 14,
    shadowColor: theme.colors.primaryLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 6,
    width: 3,
  },
  container: {
    alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.16)',
    borderColor: 'rgba(168,85,247,0.42)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    height: 24,
    justifyContent: 'center',
    paddingHorizontal: 6,
    width: 28,
  },
});
