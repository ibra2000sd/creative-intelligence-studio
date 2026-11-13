import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';

// Native tab bars size themselves (and add the safe area); in a browser the default bar is too short
// for the brand's text face, which cut the labels off.
const webTabBar = Platform.OS === 'web' ? { height: 64 } : {};
import { Icon } from '@/components/ui';
import { useStrings } from '@/i18n';
import { useStore } from '@/store';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const th = useTheme();
  const { t } = useStrings();
  const onboarded = useStore((s) => s.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;
  // The navigator may pass a platform colour object; fall back to the theme's text colour.
  const icon = (name: string) => (props: { color: unknown }) => <Icon name={name} color={typeof props.color === 'string' ? props.color : th.c.text} />;
  return (
    // System tab bar behaviour is kept as is; the brand only supplies tint and type.
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: th.c.primary, tabBarInactiveTintColor: th.c.textMuted, tabBarStyle: { backgroundColor: th.c.surface, borderTopColor: th.c.border, ...webTabBar }, tabBarLabelStyle: { fontFamily: th.font.medium, fontSize: 12, lineHeight: 16 } }}>
      <Tabs.Screen name="index" options={{ title: t.tabs.today, tabBarIcon: icon('arc'), tabBarButtonTestID: 'tab-today' }} />
      <Tabs.Screen name="devices" options={{ title: t.tabs.devices, tabBarIcon: icon('device'), tabBarButtonTestID: 'tab-devices' }} />
      <Tabs.Screen name="settings" options={{ title: t.tabs.settings, tabBarIcon: icon('sliders'), tabBarButtonTestID: 'tab-settings' }} />
    </Tabs>
  );
}
