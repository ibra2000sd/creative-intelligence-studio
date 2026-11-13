import { Link } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Icon, Screen, StatusPill, T } from '@/components/ui';
import { useStrings } from '@/i18n';
import { DEVICES } from '@/logic';
import { useTheme } from '@/theme';

export default function Devices() {
  const th = useTheme();
  const { t, rtl } = useStrings();
  return (
    <Screen>
      <FlatList
        data={DEVICES}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={<T kind="display" accessibilityRole="header" style={{ marginBottom: th.space[5] }}>{t.devices.title}</T>}
        ListEmptyComponent={<T kind="muted">{t.devices.empty}</T>}
        ItemSeparatorComponent={() => <View style={{ height: th.space[3] }} />}
        contentContainerStyle={{ paddingBottom: th.space[8] }}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * th.motion.staggerMs).duration(th.motion.durationMs.base)}>
            {/* Inside Link, style must be an object: a style function is not applied on the web. */}
            <Link href={{ pathname: '/device/[id]', params: { id: item.id } }} asChild>
              <Pressable accessibilityRole="button" accessibilityLabel={t.devices.open(item.name ?? t.devices.names[item.nameKey!])} testID={`device-${item.id}`} android_ripple={{ color: th.c.surface }} style={{ minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: th.space[4], padding: th.space[4], borderRadius: th.radius.lg, borderWidth: 1, borderColor: th.c.border, backgroundColor: th.c.surfaceRaised }}>
                <View style={{ width: 52, height: 52, borderRadius: th.radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: th.c.surface }}>
                  <Icon name={item.kind} color={th.c.text} />
                </View>
                <View style={{ flex: 1, gap: th.space[1] }}>
                  <T kind="title" style={{ fontSize: th.size.lg, lineHeight: th.size.lg * 1.25 }}>{item.name ?? t.devices.names[item.nameKey!]}</T>
                  <T kind="muted">{t.devices.places[item.place]}</T>
                  <StatusPill status={item.status} label={t.devices[item.status]} />
                </View>
                {/* Opens the device: the arrow points toward the end of the line in either direction. */}
                <View style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }}>
                  <Icon name="arrow-right" color={th.c.textMuted} size={20} />
                </View>
              </Pressable>
            </Link>
          </Animated.View>
        )}
      />
    </Screen>
  );
}
