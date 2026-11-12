import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Card, Icon, Screen, T } from '@/components/ui';
import { useStrings } from '@/i18n';
import { DEVICES } from '@/logic';
import { useTheme } from '@/theme';

export default function DeviceDetail() {
  const th = useTheme();
  const { t } = useStrings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const device = DEVICES.find((d) => d.id === id);
  if (!device) return <Screen><T kind="muted">{t.devices.empty}</T></Screen>;
  const rows: [string, string][] = [[t.devices.location, device.location], [t.devices.firmware, device.firmware]];
  return (
    <Screen style={{ paddingTop: 0 }}>
      <Animated.View entering={FadeIn.duration(th.motion.durationMs.base)} style={{ gap: th.space[5] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: th.space[4] }}>
          <View style={{ width: 64, height: 64, borderRadius: th.radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: th.c.surface }}>
            <Icon name={device.kind} size={32} color={th.c.text} />
          </View>
          <View style={{ flex: 1 }}>
            <T kind="display" accessibilityRole="header" testID="device-title" style={{ fontSize: th.size['2xl'], lineHeight: th.size['2xl'] * 1.2 }}>{device.name}</T>
            <T kind="label">{t.devices[device.status]}</T>
          </View>
        </View>
        <Card>
          {rows.map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 40, alignItems: 'center' }}>
              <T kind="muted">{k}</T>
              <T kind="body">{v}</T>
            </View>
          ))}
        </Card>
      </Animated.View>
    </Screen>
  );
}
