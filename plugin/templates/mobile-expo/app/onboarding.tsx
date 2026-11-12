import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Button, T } from '@/components/ui';
import { useStrings } from '@/i18n';
import { settlePage } from '@/logic';
import { store } from '@/store';
import { useTheme } from '@/theme';

const ACircle = Animated.createAnimatedComponent(Circle);

export default function Onboarding() {
  const th = useTheme();
  const { t, rtl } = useStrings();
  const { width } = useWindowDimensions();
  const pages = t.onboarding.pages;
  const [index, setIndex] = useState(0);
  const position = useSharedValue(0); // fractional page index, follows the finger
  const start = useSharedValue(0);

  useEffect(() => {
    position.value = withSpring(index, th.motion.spring);
  }, [index, position, th.motion.spring]);

  const finish = () => {
    store.set({ onboarded: true });
    router.replace('/');
  };

  // Horizontal drags turn the page; vertical movement is left alone for scrolling and VoiceOver.
  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-24, 24],
    onBegin: () => {
      'worklet';
      start.value = position.value;
    },
    onUpdate: (e) => {
      'worklet';
      const delta = (-e.translationX / width) * (rtl ? -1 : 1);
      position.value = Math.min(pages.length - 1 + 0.2, Math.max(-0.2, start.value + delta));
    },
    onDeactivate: (e) => {
      'worklet';
      const next = settlePage(Math.round(start.value), e.translationX, e.velocityX, width, pages.length, rtl);
      position.value = withSpring(next, th.motion.spring);
      runOnJS(setIndex)(next);
    },
  });

  const track = useAnimatedStyle(() => ({ transform: [{ translateX: -position.value * width * (rtl ? -1 : 1) }] }));
  const R = 110;
  const sun = useAnimatedProps(() => {
    const a = Math.PI * (1 - (0.12 + (position.value / (pages.length - 1)) * 0.76));
    return { cx: 140 + R * Math.cos(a), cy: 130 - R * Math.sin(a) };
  });
  const last = index === pages.length - 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: th.c.bg }}>
      <View style={{ alignItems: 'flex-end', paddingHorizontal: th.space[5] }}>
        <Button variant="ghost" compact label={t.onboarding.skip} testID="skip" onPress={finish} />
      </View>
      <View style={{ alignItems: 'center', marginTop: th.space[6] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={280} height={150} style={{ direction: 'ltr' }}>
          <Path d={`M30 130A${R} ${R} 0 0 1 250 130`} stroke={th.c.border} strokeWidth={2} strokeDasharray="2 8" strokeLinecap="round" fill="none" />
          <Path d="M16 130H264" stroke={th.c.border} strokeWidth={2} strokeLinecap="round" />
          <ACircle r={22} fill={th.c.accent} opacity={0.25} animatedProps={sun} />
          <ACircle r={11} fill={th.c.accent} animatedProps={sun} />
        </Svg>
      </View>
      <GestureDetector gesture={pan}>
        <View style={{ flex: 1, overflow: 'hidden' }} testID="pager">
          <Animated.View style={[{ flexDirection: 'row', width: width * pages.length, flex: 1 }, track]}>
            {pages.map((p, i) => (
              <View key={p.title} style={{ width, paddingHorizontal: th.space[6], justifyContent: 'center', gap: th.space[4] }} accessibilityElementsHidden={i !== index} importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}>
                <T kind="display" accessibilityRole="header" testID={`page-title-${i}`}>{p.title}</T>
                <T kind="body" style={{ fontSize: th.size.lg, lineHeight: th.size.lg * 1.5, color: th.c.textMuted }}>{p.body}</T>
              </View>
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={{ padding: th.space[5], gap: th.space[4] }}>
        <T kind="muted" testID="page-indicator" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>{t.onboarding.page(index + 1, pages.length)}</T>
        <Button label={last ? t.onboarding.start : t.onboarding.next} testID="next" onPress={() => (last ? finish() : setIndex(index + 1))} />
      </View>
    </SafeAreaView>
  );
}
