import { useColorScheme } from 'react-native';
import { theme } from './dna/theme';
import { fonts } from './dna/fonts';
import { useStore } from './store';

/** Colours for the active scheme plus the shared scale. Every value comes from the Experience DNA. */
export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const locale = useStore((s) => s.locale);
  const arabic = locale === 'ar' && fonts.arabic;
  return {
    scheme,
    c: theme.color[scheme],
    viz: theme.color.dataViz,
    space: theme.space,
    radius: theme.radius,
    size: theme.fontSize,
    motion: theme.motion,
    minTarget: theme.minTarget,
    font: {
      display: arabic ? fonts.arabicBold : fonts.display,
      text: arabic ? fonts.arabic : fonts.text,
      medium: arabic ? fonts.arabicBold : fonts.textMedium,
      mono: fonts.mono,
    },
  } as const;
}

export type AppTheme = ReturnType<typeof useTheme>;
