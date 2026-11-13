import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Card, Icon, Screen, StatusPill, T } from '@/components/ui';
import { useStrings } from '@/i18n';
import { clock, DEVICES } from '@/logic';
import { useTheme } from '@/theme';

export default function DeviceDetail() {
  const th = useTheme();
  const { t } = useStrings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const device = DEVICES.find((d) => d.id === id);
  if (!device) return <Screen><T kind="muted">{t.devices.empty}</T></Screen>;
  const rows: [string, string, boolean][] = [
    [t.devices.location, t.devices.places[device.place], false],
    [t.devices.lastSeen, t.devices.today(clock(device.lastSeen)), false],
    [t.devices.firmware, device.firmware, true],
    [t.devices.serial, device.serial, true],
  ];
  return (
    <Screen style={{ paddingTop: 0 }}>
      <Animated.View entering={FadeIn.duration(th.motion.durationMs.base)} style={{ gap: th.space[5] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: th.space[4] }}>
          <View style={{ width: 64, height: 64, borderRadius: th.radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: th.c.surface }}>
            <Icon name={device.kind} size={32} color={th.c.text} />
          </View>
          <View style={{ flex: 1 }}>
            <T kind="display" accessibilityRole="header" testID="device-title" style={{ fontSize: th.size['2xl'], lineHeight: th.size['2xl'] * 1.2 }}>{device.name ?? t.devices.names[device.nameKey!]}</T>
            <StatusPill status={device.status} label={t.devices[device.status]} />
          </View>
        </View>
        {device.noteKey ? (
          <Card style={{ borderColor: device.status === 'attention' ? th.c.warning : th.c.border, borderWidth: 1.5 }}>
            <T kind="body" testID="device-note">{t.devices[device.noteKey]}</T>
          </Card>
        ) : null}
        <Card style={{ gap: 0, paddingVertical: th.space[2] }}>
          {rows.map(([k, v, mono], i) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, gap: th.space[4], borderTopWidth: i ? 1 : 0, borderTopColor: th.c.border }}>
              <T kind="muted">{k}</T>
              <T kind={mono ? 'mono' : 'body'} style={mono ? { fontSize: th.size.md } : undefined}>{v}</T>
            </View>
          ))}
        </Card>
      </Animated.View>
    </Screen>
  );
}
