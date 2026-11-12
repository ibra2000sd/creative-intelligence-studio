import { useStore, type Locale } from './store';

// Example domain copy: replace together with src/logic.ts when adapting the template.
const STRINGS = {
  en: {
    tabs: { today: 'Today', devices: 'Devices', settings: 'Settings' },
    today: { title: 'Today at home', battery: 'In the battery', solar: 'From the roof', home: 'Home is using', grid: 'From the grid', charging: 'Charging from the roof', discharging: 'Powering the home', idle: 'Holding steady', time: 'Time of day', earlier: 'Half an hour earlier', later: 'Half an hour later', dial: (pct: number, time: string) => `Battery at ${pct} percent at ${time}` },
    devices: { title: 'Devices', online: 'Online', offline: 'Offline', attention: 'Needs attention', firmware: 'Firmware', location: 'Location', empty: 'No devices yet', back: 'Back', open: (n: string) => `Open ${n}` },
    settings: { title: 'Settings', reserve: 'Backup reserve', reserveHelp: 'Kept in the battery for a power cut.', less: 'Lower the reserve by 5 percent', more: 'Raise the reserve by 5 percent', alerts: 'Alerts', language: 'Language', arabic: 'العربية', english: 'English', simulate: 'Simulate being offline', replay: 'Show the introduction again' },
    offline: { message: 'You are offline. Showing the last known values.', retry: 'Reconnect' },
    onboarding: { skip: 'Skip', next: 'Next', start: 'Get started', page: (i: number, n: number) => `Page ${i} of ${n}`, pages: [{ title: 'Your day, as an arc', body: 'The sun travels the arc. The ring shows what is in the battery.' }, { title: 'Noon is for storing', body: 'When the roof makes more than the home needs, the Cell keeps it.' }, { title: 'A reserve you choose', body: 'Decide how much to hold back for a power cut. Change it any time.' }] },
  },
  ar: {
    tabs: { today: 'اليوم', devices: 'الأجهزة', settings: 'الإعدادات' },
    today: { title: 'بيتك اليوم', battery: 'في البطارية', solar: 'من السطح', home: 'استهلاك البيت', grid: 'من الشبكة', charging: 'تُشحن من السطح', discharging: 'تغذّي البيت', idle: 'مستقرة', time: 'الوقت من اليوم', earlier: 'نصف ساعة أبكر', later: 'نصف ساعة لاحقاً', dial: (pct: number, time: string) => `البطارية عند ${pct} بالمئة الساعة ${time}` },
    devices: { title: 'الأجهزة', online: 'متصل', offline: 'غير متصل', attention: 'يحتاج إلى انتباه', firmware: 'إصدار البرنامج', location: 'المكان', empty: 'لا توجد أجهزة بعد', back: 'رجوع', open: (n: string) => `افتح ${n}` },
    settings: { title: 'الإعدادات', reserve: 'احتياطي الطوارئ', reserveHelp: 'يُحفظ في البطارية لحالات انقطاع الكهرباء.', less: 'اخفض الاحتياطي ٥ بالمئة', more: 'ارفع الاحتياطي ٥ بالمئة', alerts: 'التنبيهات', language: 'اللغة', arabic: 'العربية', english: 'English', simulate: 'محاكاة انقطاع الاتصال', replay: 'اعرض المقدمة مرة أخرى' },
    offline: { message: 'أنت غير متصل. نعرض آخر القيم المعروفة.', retry: 'إعادة الاتصال' },
    onboarding: { skip: 'تخطٍّ', next: 'التالي', start: 'ابدأ', page: (i: number, n: number) => `صفحة ${i} من ${n}`, pages: [{ title: 'يومك على شكل قوس', body: 'تسير الشمس على القوس، والحلقة تبيّن ما في البطارية.' }, { title: 'الظهيرة وقت التخزين', body: 'حين ينتج السطح أكثر من حاجة البيت تحتفظ البطارية بالفائض.' }, { title: 'احتياطي تختاره أنت', body: 'حدّد ما يُحفظ لحالات الانقطاع، وغيّره متى شئت.' }] },
  },
};

export type Strings = (typeof STRINGS)['en'];
export const stringsFor = (locale: Locale): Strings => STRINGS[locale] as Strings;

export function useStrings() {
  const locale = useStore((s) => s.locale);
  return { t: stringsFor(locale), locale, rtl: locale === 'ar' };
}
