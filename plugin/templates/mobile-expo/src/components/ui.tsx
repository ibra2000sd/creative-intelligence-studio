import { type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import icons from '../dna/icons.json';
import { useStrings } from '../i18n';
import { store } from '../store';
import { useTheme } from '../theme';

const ICONS = icons.icons as Record<string, string[]>;

export function Icon({ name, size = 24, color }: { name: string; size?: number; color: string }) {
  const paths = ICONS[name] ?? ICONS.sun;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={icons.meta.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

/** Text that takes its family, colour and writing direction from the theme and locale. */
export function T({ kind = 'body', style, children, ...rest }: { kind?: 'display' | 'title' | 'body' | 'muted' | 'mono' | 'label'; style?: StyleProp<TextStyle>; children: ReactNode } & React.ComponentProps<typeof Text>) {
  const th = useTheme();
  const { rtl } = useStrings();
  // Text starts at the reading edge. Native text treats 'left' as the start of a right-to-left
  // layout; on the web 'left' is physical, so Arabic needs 'right' there.
  const start = Platform.OS === 'web' && rtl ? 'right' : 'left';
  const base: TextStyle = { color: th.c.text, fontFamily: th.font.text, fontSize: th.size.md, lineHeight: th.size.md * 1.5, textAlign: start, writingDirection: rtl ? 'rtl' : 'ltr' };
  const kinds: Record<string, TextStyle> = {
    display: { fontFamily: th.font.display, fontSize: th.size['3xl'], lineHeight: th.size['3xl'] * (rtl ? 1.4 : 1.1) },
    title: { fontFamily: th.font.display, fontSize: th.size.xl, lineHeight: th.size.xl * (rtl ? 1.45 : 1.2) },
    body: {},
    muted: { color: th.c.textMuted, fontSize: th.size.sm, lineHeight: th.size.sm * 1.5 },
    mono: { fontFamily: th.font.mono, fontSize: th.size.lg, writingDirection: 'ltr' },
    label: { fontFamily: th.font.medium, fontSize: th.size.sm, lineHeight: th.size.sm * 1.4 },
  };
  return (
    <Text style={[base, kinds[kind], style]} {...rest}>
      {children}
    </Text>
  );
}

export function Screen({ children, scroll = false, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const th = useTheme();
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: th.c.bg }, style]} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1, paddingHorizontal: th.space[5], paddingTop: scroll ? 0 : th.space[4] }}>{children}</View>
    </SafeAreaView>
  );
}

/** Shown while the device is offline. Slides in and out; the action is a real button. */
export function OfflineBanner() {
  const th = useTheme();
  const { t } = useStrings();
  return (
    <Animated.View entering={FadeInDown.springify().damping(th.motion.spring.damping)} exiting={FadeOutUp.duration(th.motion.durationMs.fast)} accessibilityRole="alert" testID="offline-banner" style={[styles.banner, { backgroundColor: th.c.surfaceRaised, borderColor: th.c.warning, margin: th.space[4], borderRadius: th.radius.md, padding: th.space[4], gap: th.space[3] }]}>
      <Icon name="offline" color={th.c.warning} />
      <T kind="muted" style={{ flex: 1, color: th.c.text }}>{t.offline.message}</T>
      <Button label={t.offline.retry} onPress={() => store.set({ online: true })} testID="reconnect" compact />
    </Animated.View>
  );
}

/** Pressable with a spring press response. The touch target never drops below the platform minimum. */
export function Button({ label, onPress, variant = 'primary', icon, compact = false, testID, accessibilityLabel }: { label: string; onPress: () => void; variant?: 'primary' | 'ghost'; icon?: string; compact?: boolean; testID?: string; accessibilityLabel?: string }) {
  const th = useTheme();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fg = variant === 'primary' ? th.c.onPrimary : th.c.text;
  return (
    <Animated.View style={anim}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        testID={testID}
        onPress={onPress}
        onPressIn={() => (scale.value = withSpring(0.96, th.motion.spring))}
        onPressOut={() => (scale.value = withSpring(1, th.motion.spring))}
        style={{ minHeight: th.minTarget, minWidth: th.minTarget, paddingHorizontal: compact ? th.space[4] : th.space[6], borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: th.space[2], backgroundColor: variant === 'primary' ? th.c.primary : 'transparent', borderWidth: variant === 'ghost' ? 1.5 : 0, borderColor: th.c.border }}
      >
        {icon ? <Icon name={icon} size={20} color={fg} /> : null}
        {label ? <Text style={{ color: fg, fontFamily: th.font.medium, fontSize: th.size.sm }}>{label}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

/**
 * On/off switch in the brand's colours. The control is drawn left to right in every language
 * (only its place in the row mirrors), which also keeps its thumb inside its track on the web.
 */
export function Toggle({ value, onValueChange, testID, accessibilityLabel }: { value: boolean; onValueChange: (v: boolean) => void; testID?: string; accessibilityLabel: string }) {
  const th = useTheme();
  // react-native-web names the "on" colours separately; without them it falls back to its own teal.
  const web = Platform.OS === 'web' ? ({ activeThumbColor: th.c.onPrimary, activeTrackColor: th.c.primary } as object) : null;
  return (
    <View style={{ direction: 'ltr' }}>
      <Switch testID={testID} accessibilityLabel={accessibilityLabel} value={value} onValueChange={onValueChange} trackColor={{ true: th.c.primary, false: th.c.border }} thumbColor={value ? th.c.onPrimary : th.c.surfaceRaised} ios_backgroundColor={th.c.border} {...web} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const th = useTheme();
  return <View style={[{ backgroundColor: th.c.surfaceRaised, borderColor: th.c.border, borderWidth: 1, borderRadius: th.radius.lg, padding: th.space[5], gap: th.space[2] }, style]}>{children}</View>;
}

const styles = StyleSheet.create({ banner: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 } });
