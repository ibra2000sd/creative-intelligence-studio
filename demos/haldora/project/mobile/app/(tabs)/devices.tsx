import { Link } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Icon, Screen, T } from '@/components/ui';
import { useStrings } from '@/i18n';
import { DEVICES } from '@/logic';
import { useTheme } from '@/theme';

export default function Devices() {
  const th = useTheme();
  const { t } = useStrings();
  const tone = { online: th.c.success, offline: th.c.textMuted, attention: th.c.warning };
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
            <Link href={{ pathname: '/device/[id]', params: { id: item.id } }} asChild>
              <Pressable accessibilityRole="button" accessibilityLabel={t.devices.open(item.name)} testID={`device-${item.id}`} style={({ pressed }) => ({ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: th.space[4], padding: th.space[4], borderRadius: th.radius.lg, borderWidth: 1, borderColor: th.c.border, backgroundColor: pressed ? th.c.surface : th.c.surfaceRaised })}>
                <View style={{ width: 48, height: 48, borderRadius: th.radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: th.c.surface }}>
                  <Icon name={item.kind} color={th.c.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <T kind="label" style={{ fontSize: th.size.md }}>{item.name}</T>
                  <T kind="muted">{item.location}</T>
                </View>
                <T kind="label" style={{ color: tone[item.status] }}>{t.devices[item.status]}</T>
              </Pressable>
            </Link>
          </Animated.View>
        )}
      />
    </Screen>
  );
}
