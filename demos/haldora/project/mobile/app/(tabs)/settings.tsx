import { router } from 'expo-router';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { ReserveSlider } from '@/components/ReserveSlider';
import { Button, Card, Screen, T } from '@/components/ui';
import { useStrings } from '@/i18n';
import { store, useStore, type Locale } from '@/store';
import { useTheme } from '@/theme';

export default function Settings() {
  const th = useTheme();
  const { t, locale } = useStrings();
  const reserve = useStore((s) => s.reserve);
  const alerts = useStore((s) => s.alerts);
  const online = useStore((s) => s.online);
  const langs: [Locale, string][] = [['en', t.settings.english], ['ar', t.settings.arabic]];
  const row = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: th.space[4], minHeight: th.minTarget } as const;
  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingVertical: th.space[5], gap: th.space[5] }} showsVerticalScrollIndicator={false}>
        <T kind="display" accessibilityRole="header" testID="settings-title">{t.settings.title}</T>
        <Card>
          <T kind="title">{t.settings.reserve}</T>
          <T kind="muted">{t.settings.reserveHelp}</T>
          <ReserveSlider value={reserve} onChange={(v) => store.set({ reserve: v })} />
        </Card>
        <Card>
          <View style={row}>
            <T kind="body" nativeID="alerts-label" style={{ flex: 1 }}>{t.settings.alerts}</T>
            <Switch testID="alerts" accessibilityLabel={t.settings.alerts} value={alerts} onValueChange={(v) => store.set({ alerts: v })} trackColor={{ true: th.c.primary, false: th.c.border }} />
          </View>
          <View style={row}>
            <T kind="body" style={{ flex: 1 }}>{t.settings.simulate}</T>
            <Switch testID="simulate-offline" accessibilityLabel={t.settings.simulate} value={!online} onValueChange={(v) => store.set({ online: !v })} trackColor={{ true: th.c.primary, false: th.c.border }} />
          </View>
        </Card>
        <Card>
          <T kind="title">{t.settings.language}</T>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: th.space[3] }}>
            {langs.map(([code, label]) => {
              const on = locale === code;
              return (
                <Pressable key={code} testID={`lang-${code}`} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} onPress={() => store.set({ locale: code })} style={{ flex: 1, minHeight: th.minTarget, alignItems: 'center', justifyContent: 'center', borderRadius: th.radius.md, borderWidth: 1.5, borderColor: on ? th.c.primary : th.c.border, backgroundColor: on ? th.c.surface : 'transparent' }}>
                  <T kind="label" style={{ textAlign: 'center' }}>{label}</T>
                </Pressable>
              );
            })}
          </View>
        </Card>
        <Button variant="ghost" label={t.settings.replay} testID="replay" onPress={() => { store.set({ onboarded: false }); router.replace('/onboarding'); }} />
      </ScrollView>
    </Screen>
  );
}
