import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { arcPoint, clock } from '../logic';
import { useStrings } from '../i18n';
import { useTheme } from '../theme';
import { T } from './ui';

const ACircle = Animated.createAnimatedComponent(Circle);

/** A crescent of radius r centred on (x, y), the same shape as the night marker everywhere else. */
export function moonPath(x: number, y: number, r: number) {
  const p = (n: number) => n.toFixed(1);
  return `M${p(x + 0.36 * r)} ${p(y - 0.93 * r)}A${p(r)} ${p(r)} 0 1 0 ${p(x + 0.93 * r)} ${p(y + 0.36 * r)}A${p(0.77 * r)} ${p(0.77 * r)} 0 0 1 ${p(x + 0.36 * r)} ${p(y - 0.93 * r)}Z`;
}

/**
 * The brand's day arc as a dial: the sun travels the arc with the time of day
 * and the ring shows battery level. Both move on springs that run on the UI
 * thread; with Reduce Motion on, Reanimated's default applies them instantly.
 */
export function ArcDial({ hour, battery, size = 280 }: { hour: number; battery: number; size?: number }) {
  const th = useTheme();
  const { t } = useStrings();
  const box = { cx: size / 2, cy: size * 0.62, r: size * 0.42 };
  // The ring sits wholly above the horizon, inside the arc.
  const ringR = size * 0.16;
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
        {/* The arc leads: a clear dashed sky over the horizon. The battery ring sits quietly beneath it. */}
        <Path d={`M${box.cx - box.r} ${box.cy}A${box.r} ${box.r} 0 0 1 ${box.cx + box.r} ${box.cy}`} stroke={th.c.textMuted} strokeWidth={2.5} strokeDasharray="4 9" strokeLinecap="round" fill="none" />
        <Line x1={box.cx - box.r - 18} y1={box.cy} x2={box.cx + box.r + 18} y2={box.cy} stroke={th.c.textMuted} strokeWidth={2} strokeLinecap="round" />
        <Circle cx={box.cx} cy={box.cy - ringR - 10} r={ringR} stroke={th.c.surface} strokeWidth={6} fill="none" />
        <ACircle cx={box.cx} cy={box.cy - ringR - 10} r={ringR} stroke={th.viz[1]} strokeOpacity={0.75} strokeWidth={6} strokeLinecap="round" fill="none" strokeDasharray={`${circumference} ${circumference}`} animatedProps={ringProps} rotation={-90} originX={box.cx} originY={box.cy - ringR - 10} />
        {/* By day an amber sun travels the arc. At night there is no sun above the horizon: a crescent sits at the top of the sky. */}
        <ACircle r={18} fill={th.sun} opacity={daylight ? 0.25 : 0} animatedProps={haloProps} />
        <ACircle r={9} fill={th.sun} opacity={daylight ? 1 : 0} animatedProps={sunProps} />
        {daylight ? null : <Path testID="moon" d={moonPath(box.cx, box.cy - box.r, 11)} fill={th.moon} />}
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: box.cy - ringR - 10 - 26, alignItems: 'center' }}>
        <T kind="mono" style={{ fontSize: th.size['2xl'], lineHeight: th.size['2xl'] * 1.1, textAlign: 'center' }}>{battery}%</T>
        <T kind="muted" style={{ textAlign: 'center', fontSize: 12, lineHeight: 15 }}>{t.today.battery}</T>
      </View>
    </View>
  );
}
