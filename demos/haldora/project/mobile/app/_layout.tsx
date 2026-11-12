import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/ui';
import { useStore } from '@/store';
import { fontAssets } from '@/dna/fonts';
import { useStrings } from '@/i18n';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const [loaded] = useFonts(fontAssets);
  const th = useTheme();
  const { t, rtl } = useStrings();
  const online = useStore((s) => s.online);
  if (!loaded) return null;
  return (
    // `direction` flips the layout for Arabic at once on iOS and the web. On Android a
    // full mirror also needs I18nManager.forceRTL and an app restart (see README).
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: th.c.bg, direction: rtl ? 'rtl' : 'ltr' }}>
      <SafeAreaProvider>
        <StatusBar style={th.scheme === 'dark' ? 'light' : 'dark'} />
        {/* One banner for the whole app, above the navigator, so it survives tab and screen changes. */}
        {!online && (
          <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: th.c.bg }}>
            <OfflineBanner />
          </SafeAreaView>
        )}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: th.c.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="device/[id]" options={{ headerShown: true, title: '', headerBackTitle: t.devices.back, headerTintColor: th.c.text, headerStyle: { backgroundColor: th.c.bg }, headerShadowVisible: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
