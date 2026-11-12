import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArcDial } from '@/components/ArcDial';
import { Button, Card, Icon, Screen, T } from '@/components/ui';
import { useStrings } from '@/i18n';
import { clock, snapshot } from '@/logic';
import { store, useStore } from '@/store';
import { useTheme } from '@/theme';

export default function Today() {
  const th = useTheme();
  const { t } = useStrings();
  const hour = useStore((s) => s.hour);
  const reserve = useStore((s) => s.reserve);
  const [refreshing, setRefreshing] = useState(false);
  const snap = snapshot(hour, reserve);
  const step = (d: number) => store.set({ hour: (hour + d + 24) % 24 });
  const refresh = useCallback(() => {
    setRefreshing(true);
    // Stands in for a network request; a real app would also set `online` from its result.
    setTimeout(() => setRefreshing(false), 700);
  }, []);
  const tiles: [string, string, string, number][] = [['sun', t.today.solar, `${snap.solarKw} kW`, 0], ['home', t.today.home, `${snap.homeKw} kW`, 2], ['grid', t.today.grid, `${snap.gridKw} kW`, 3]];
  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingVertical: th.space[5], gap: th.space[5] }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={th.c.primary} />} showsVerticalScrollIndicator={false}>
        <T kind="display" accessibilityRole="header" testID="today-title">{t.today.title}</T>
        <Card>
          <ArcDial hour={hour} battery={snap.battery} />
          <T kind="label" testID="state" style={{ textAlign: 'center' }}>{t.today[snap.state]}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: th.space[4], marginTop: th.space[2], direction: 'ltr' }}>
            <Button variant="ghost" compact label="−" accessibilityLabel={t.today.earlier} testID="earlier" onPress={() => step(-0.5)} />
            <T kind="mono" testID="clock" accessibilityLabel={`${t.today.time} ${clock(hour)}`} style={{ minWidth: 76, textAlign: 'center' }}>{clock(hour)}</T>
            <Button variant="ghost" compact label="+" accessibilityLabel={t.today.later} testID="later" onPress={() => step(0.5)} />
          </View>
        </Card>
        <View style={{ gap: th.space[3] }}>
          {tiles.map(([icon, label, value, viz], i) => (
            <Animated.View key={icon} entering={FadeInDown.delay(i * th.motion.staggerMs).duration(th.motion.durationMs.base)}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: th.space[4] }}>
                <View style={{ width: 44, height: 44, borderRadius: th.radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: th.c.surface, borderWidth: 2, borderColor: th.viz[viz] }}>
                  <Icon name={icon} color={th.c.text} />
                </View>
                <T kind="body" style={{ flex: 1 }}>{label}</T>
                <T kind="mono">{value}</T>
              </Card>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
