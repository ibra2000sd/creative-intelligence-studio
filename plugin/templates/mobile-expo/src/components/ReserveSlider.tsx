import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { clamp, sliderValue } from '../logic';
import { useStrings } from '../i18n';
import { useTheme } from '../theme';
import { Button, T } from './ui';

const THUMB = 32;

/**
 * Drag to set a percentage. The drag is tracked on the UI thread and can be
 * interrupted at any point. Two buttons do the same job with single taps, and
 * assistive technologies get an adjustable control with increment/decrement.
 */
export function ReserveSlider({ value, onChange, min = 10, max = 100, step = 5 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  const th = useTheme();
  const { t, rtl } = useStrings();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const grip = useSharedValue(1);
  const last = useSharedValue(value);
  const toX = (v: number, w: number) => {
    const ratio = (v - min) / (max - min);
    return (rtl ? 1 - ratio : ratio) * w;
  };

  useEffect(() => {
    last.value = value;
    x.value = withSpring(toX(value, width), th.motion.spring);
    // toX depends only on the listed values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, width, rtl]);

  const pan = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      grip.value = withSpring(1.25, th.motion.spring);
      x.value = clamp(e.x, 0, width);
    },
    onUpdate: (e) => {
      'worklet';
      x.value = clamp(e.x, 0, width);
      const next = sliderValue(e.x, width, min, max, step, rtl);
      if (next !== last.value) {
        last.value = next;
        runOnJS(onChange)(next);
      }
    },
    onFinalize: () => {
      'worklet';
      grip.value = withSpring(1, th.motion.spring);
      const ratio = (last.value - min) / (max - min);
      x.value = withSpring((rtl ? 1 - ratio : ratio) * width, th.motion.spring);
    },
  });

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - THUMB / 2 }, { scale: grip.value }] }));
  const fill = useAnimatedStyle(() => (rtl ? { left: x.value, right: 0 } : { left: 0, width: x.value }));
  const set = (v: number) => onChange(clamp(v, min, max));

  return (
    <View style={{ gap: th.space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: th.space[3] }}>
        <Button variant="ghost" icon="chevron-down" label="" compact accessibilityLabel={t.settings.less} testID="reserve-less" onPress={() => set(value - step)} />
        <GestureDetector gesture={pan}>
          <View
            testID="reserve-slider"
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t.settings.reserve}
            accessibilityValue={{ min, max, now: value, text: `${value}%` }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? step : -step))}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            style={{ flex: 1, height: th.minTarget, justifyContent: 'center', direction: 'ltr' }}
          >
            <View style={{ height: 8, borderRadius: 4, backgroundColor: th.c.surface, overflow: 'hidden' }}>
              <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, backgroundColor: th.c.primary }, fill]} />
            </View>
            <Animated.View style={[{ position: 'absolute', left: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: th.c.surfaceRaised, borderWidth: 3, borderColor: th.c.primary }, thumb]} />
          </View>
        </GestureDetector>
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <Button variant="ghost" icon="chevron-down" label="" compact accessibilityLabel={t.settings.more} testID="reserve-more" onPress={() => set(value + step)} />
        </View>
      </View>
      <T kind="mono" testID="reserve-value" style={{ textAlign: 'center' }}>{value}%</T>
    </View>
  );
}
