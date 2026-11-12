import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { arcPoint, clock } from '../logic';
import { useStrings } from '../i18n';
import { useTheme } from '../theme';
import { T } from './ui';

const ACircle = Animated.createAnimatedComponent(Circle);

/**
 * The brand's day arc as a dial: the sun travels the arc with the time of day
 * and the ring shows battery level. Both move on springs that run on the UI
 * thread; with Reduce Motion on, Reanimated's default applies them instantly.
 */
export function ArcDial({ hour, battery, size = 280 }: { hour: number; battery: number; size?: number }) {
  const th = useTheme();
  const { t } = useStrings();
  const box = { cx: size / 2, cy: size * 0.62, r: size * 0.42 };
  const ringR = size * 0.2;
  const circumference = 2 * Math.PI * ringR;
  const progress = useSharedValue(arcPoint(hour, box).progress);
  const level = useSharedValue(battery / 100);

  useEffect(() => {
    progress.value = withSpring(arcPoint(hour, box).progress, th.motion.spring);
    level.value = withSpring(battery / 100, th.motion.spring);
    // box is derived from size only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hour, battery, size]);

  const sunProps = useAnimatedProps(() => {
    const a = Math.PI * (1 - progress.value);
    return { cx: box.cx + box.r * Math.cos(a), cy: box.cy - box.r * Math.sin(a) };
  });
  const haloProps = useAnimatedProps(() => {
    const a = Math.PI * (1 - progress.value);
    return { cx: box.cx + box.r * Math.cos(a), cy: box.cy - box.r * Math.sin(a) };
  });
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - level.value) }));
  const daylight = arcPoint(hour, box).daylight;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={t.today.dial(battery, clock(hour))} testID="arc-dial" style={{ width: size, height: size * 0.78, alignSelf: 'center' }}>
      {/* The arc depicts the sky, so it runs left to right in every locale. */}
      <Svg width={size} height={size * 0.78} style={{ direction: 'ltr' }}>
        <Path d={`M${box.cx - box.r} ${box.cy}A${box.r} ${box.r} 0 0 1 ${box.cx + box.r} ${box.cy}`} stroke={th.c.border} strokeWidth={2} strokeDasharray="2 8" strokeLinecap="round" fill="none" />
        <Line x1={box.cx - box.r - 10} y1={box.cy} x2={box.cx + box.r + 10} y2={box.cy} stroke={th.c.border} strokeWidth={2} strokeLinecap="round" />
        <Circle cx={box.cx} cy={box.cy - ringR * 0.55} r={ringR} stroke={th.c.surface} strokeWidth={12} fill="none" />
        <ACircle cx={box.cx} cy={box.cy - ringR * 0.55} r={ringR} stroke={th.viz[1]} strokeWidth={12} strokeLinecap="round" fill="none" strokeDasharray={`${circumference} ${circumference}`} animatedProps={ringProps} rotation={-90} originX={box.cx} originY={box.cy - ringR * 0.55} />
        <ACircle r={18} fill={th.c.accent} opacity={daylight ? 0.25 : 0.1} animatedProps={haloProps} />
        <ACircle r={9} fill={daylight ? th.c.accent : th.c.textMuted} animatedProps={sunProps} />
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: box.cy - ringR * 0.55 - 22, alignItems: 'center' }}>
        <T kind="mono" style={{ fontSize: th.size['2xl'], lineHeight: th.size['2xl'] * 1.1, textAlign: 'center' }}>{battery}%</T>
      </View>
    </View>
  );
}
