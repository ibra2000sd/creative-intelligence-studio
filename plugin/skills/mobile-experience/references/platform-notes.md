# Platform notes

Written from first principles and platform documentation; consult the current Apple Human Interface Guidelines and Material Design guidance directly for specifics. Nothing here reproduces their text or assets.

- Navigation: keep system back behaviour. On Android the system back gesture must always work. On iOS do not replace the navigation bar's back affordance.
- Tab bars: three to five destinations, each a place, not an action.
- Touch targets: 44pt on iOS, 48dp on Android, regardless of the visual size of the control.
- Type: respect the user's text-size setting; test the largest sizes for truncation.
- Motion: gesture-driven motion must track the finger, be interruptible, and settle with a spring that carries velocity. Respect Reduce Motion.
- Safe areas: use safe-area insets; do not hard-code status bar or home indicator heights.
- Right-to-left: mirror layout and directional icons; do not mirror depictions of real-world direction such as a clock or the sun's path. Android needs `I18nManager.forceRTL` and a restart for a full mirror.
- A brand may be inspired by a platform's principles (clarity, deference to content, depth). It may not copy a platform vendor's proprietary assets or imply their endorsement.
