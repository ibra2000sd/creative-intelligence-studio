// Interface copy. The energy domain here is example content: replace the
// strings and the mock API together when adapting the template to a brief.
export const STRINGS = {
  en: {
    skip: 'Skip to content', nav: 'Sections', theme: 'Switch between light and dark', language: 'العربية', otherLang: 'ar',
    routes: { overview: 'Today', devices: 'Devices', history: 'History', settings: 'Settings' },
    overview: {
      title: 'Today at home', battery: 'In the battery', solar: 'From the roof', home: 'Used by the home', grid: 'Bought from the grid', selfPowered: 'self-powered so far',
      chartTitle: 'The day so far', chartDesc: 'Solar generation, home use and battery level in half-hour steps. Use the time slider to read any moment.',
      time: 'Time', series: { solar: 'Roof', home: 'Home', battery: 'Battery level' }, showTable: 'Show the data as a table', hideTable: 'Hide the table', seriesToggle: 'Series shown',
      flowTitle: 'Right now', flowSolar: 'Roof', flowHome: 'Home', flowBattery: 'Battery', flowGrid: 'Grid', charging: 'charging', discharging: 'powering the home', idle: 'holding', full: 'full', refresh: 'Refresh', updated: 'Updated',
      summary: (f) => ['At ', f.time, ' the battery holds ', f.battery, ', the roof is making ', f.solar, ' and the home is using ', f.home, '. Bought from the grid so far today: ', f.grid, '.'],
      reserve: 'Backup reserve', change: 'Change',
      now: 'Now', showing: 'Showing', forecast: 'forecast', earlier: 'earlier today', backToNow: 'Back to now', at: 'At', forecastNote: 'Lines to the right of “Now” are fainter: they are the forecast for the rest of today.',
    },
    devices: { title: 'Devices', online: 'Online', offline: 'Offline', attention: 'Needs attention', details: 'Details', firmware: 'Firmware', serial: 'Serial', lastSeen: 'Last seen', emptyTitle: 'No devices yet', emptyBody: 'When your installer pairs a Cell, it will appear here.', errorTitle: 'We could not reach your devices', errorBody: 'Your battery keeps working. This page just cannot show it right now.', retry: 'Try again', loading: 'Loading devices' },
    band: 'The sun on the arc shows the time of day now.',
    history: { title: 'History', fortnight: 'The last fortnight', fortnightHelp: 'The warmer the sky, the more of that day the home ran on its own power. The figure under each day gives the share.', everyDay: 'Every day', search: 'Find a day', searchHint: 'For example 31 Oct, or Sat', date: 'Date', solar: 'Roof (kWh)', used: 'Used (kWh)', grid: 'Grid (kWh)', self: 'Self-powered', sortBy: 'Sort by', page: 'Page', of: 'of', prev: 'Previous', next: 'Next', empty: 'No days match that filter.', clear: 'Clear the filter', rows: 'days' },
    settings: { title: 'Settings', reserve: 'Backup reserve', reserveHelp: 'The share of the battery kept back for a power cut.', alerts: 'Email me when something needs attention', email: 'Email address', save: 'Save changes', saving: 'Saving…', saved: 'Settings saved.', failed: 'Could not save. Your previous settings are still in place.', errRange: 'Choose a reserve between 10% and 100%.', errRequired: 'An email address is needed for alerts.', errFormat: 'Enter an email address like name@example.com.', demo: 'Demonstration data. Nothing is sent anywhere.', display: 'Display', dark: 'Dark appearance', language: 'Language' },
    units: { kw: 'kW', kwh: 'kWh', pct: '%' },
  },
  ar: {
    skip: 'انتقل إلى المحتوى', nav: 'الأقسام', theme: 'التبديل بين الوضعين الفاتح والداكن', language: 'English', otherLang: 'en',
    routes: { overview: 'اليوم', devices: 'الأجهزة', history: 'السجل', settings: 'الإعدادات' },
    overview: {
      title: 'بيتك اليوم', battery: 'في البطارية', solar: 'من السطح', home: 'استهلاك البيت', grid: 'مشتراة من الشبكة', selfPowered: 'اكتفاء ذاتي حتى الآن',
      chartTitle: 'اليوم حتى الآن', chartDesc: 'إنتاج الألواح واستهلاك البيت ومستوى البطارية كل نصف ساعة. استخدم شريط الوقت لقراءة أي لحظة.',
      time: 'الوقت', series: { solar: 'السطح', home: 'البيت', battery: 'مستوى البطارية' }, showTable: 'اعرض البيانات في جدول', hideTable: 'أخفِ الجدول', seriesToggle: 'السلاسل المعروضة',
      flowTitle: 'الآن', flowSolar: 'السطح', flowHome: 'البيت', flowBattery: 'البطارية', flowGrid: 'الشبكة', charging: 'تُشحن', discharging: 'تغذّي البيت', idle: 'ثابتة', full: 'ممتلئة', refresh: 'تحديث', updated: 'آخر تحديث',
      summary: (f) => ['عند الساعة ', f.time, ' في البطارية ', f.battery, '، والسطح ينتج ', f.solar, ' والبيت يستهلك ', f.home, '. المشترى من الشبكة اليوم حتى الآن: ', f.grid, '.'],
      reserve: 'احتياطي الطوارئ', change: 'تغيير',
      now: 'الآن', showing: 'المعروض', forecast: 'توقّع', earlier: 'في وقت سابق اليوم', backToNow: 'العودة إلى الآن', at: 'عند الساعة', forecastNote: 'الخطوط الأبهت بعد «الآن» هي توقّع بقية اليوم.',
    },
    devices: { title: 'الأجهزة', online: 'متصل', offline: 'غير متصل', attention: 'يحتاج إلى انتباه', details: 'التفاصيل', firmware: 'إصدار البرنامج', serial: 'الرقم التسلسلي', lastSeen: 'آخر ظهور', emptyTitle: 'لا توجد أجهزة بعد', emptyBody: 'سيظهر الجهاز هنا عندما يربطه فنّي التركيب.', errorTitle: 'تعذّر الوصول إلى أجهزتك', errorBody: 'بطاريتك تواصل عملها، لكن هذه الصفحة لا تستطيع عرضها الآن.', retry: 'حاول مرة أخرى', loading: 'جارٍ تحميل الأجهزة' },
    band: 'تبيّن الشمس على القوس الوقت الحالي من اليوم.',
    history: { title: 'السجل', fortnight: 'آخر أسبوعين', fortnightHelp: 'كلما كانت السماء أدفأ زاد اكتفاء البيت ذاتياً في ذلك اليوم. والرقم تحت كل يوم يبيّن النسبة.', everyDay: 'كل الأيام', search: 'ابحث عن يوم', searchHint: 'مثال: 31 أكتوبر', date: 'التاريخ', solar: 'السطح (ك.و.س)', used: 'الاستهلاك (ك.و.س)', grid: 'الشبكة (ك.و.س)', self: 'الاكتفاء الذاتي', sortBy: 'ترتيب حسب', page: 'صفحة', of: 'من', prev: 'السابق', next: 'التالي', empty: 'لا توجد أيام مطابقة لهذه التصفية.', clear: 'إلغاء التصفية', rows: 'يوماً' },
    settings: { title: 'الإعدادات', reserve: 'احتياطي الطوارئ', reserveHelp: 'النسبة التي تُحفظ في البطارية لحالات انقطاع الكهرباء.', alerts: 'أرسل لي بريداً عندما يحتاج شيء إلى انتباه', email: 'البريد الإلكتروني', save: 'حفظ التغييرات', saving: 'جارٍ الحفظ…', saved: 'تم حفظ الإعدادات.', failed: 'تعذّر الحفظ. إعداداتك السابقة ما زالت كما هي.', errRange: 'اختر نسبة احتياطي بين 10% و100%.', errRequired: 'نحتاج إلى بريد إلكتروني لإرسال التنبيهات.', errFormat: 'اكتب بريداً إلكترونياً بصيغة name@example.com.', demo: 'بيانات تجريبية. لا يُرسل أي شيء إلى أي مكان.', display: 'العرض', dark: 'المظهر الداكن', language: 'اللغة' },
    units: { kw: 'kW', kwh: 'kWh', pct: '%' },
  },
};

export function localeFromUrl() {
  return new URLSearchParams(location.search).get('lang') === 'ar' ? 'ar' : 'en';
}
