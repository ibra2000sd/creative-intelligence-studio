<div dir="rtl" lang="ar">

# دليل المستخدم

## 1. المتطلبات

- Node.js 22 أو أحدث، وClaude Code 2.1.275 أو أحدث.
- متصفح Chrome أو Edge لفحوص الجودة ولتصدير PDF.
- مساحة حرة تقارب 1.5 غيغابايت لاعتماديات مشاريع الويب والجوال.

## 2. التثبيت

<div dir="ltr">

```bash
claude plugin marketplace add ibra2000sd/creative-intelligence-studio
claude plugin install creative-intelligence-studio@creative-intelligence-studio
creative-studio doctor
creative-studio setup
```

</div>

الأمر `doctor` يعرض ما هو متوفر وما ينقص وما لا يستطيع هذا الجهاز فعله. الأمر `setup` يثبّت المحركات الاختيارية (الصور النقطية، المتصفح، المتجهات، ثلاثي الأبعاد) بإصدارات محددة، ولا يُنزَّل شيء قبل أن تشغّله أنت.

## 3. أسهل طريقة: تحدّث إلى Claude

اكتب مثلاً: «عميل جديد اسمه هالدورا يبيع بطاريات منزلية ويحتاج هوية وموقعاً وتطبيقاً بالعربية والإنجليزية». ستعمل مهارة `creative-studio` على:

1. كتابة موجز المشروع والتحقق منه، مع فصل ما قاله العميل عما افترضته هي.
2. بناء خطة مهام لها بوابات اعتماد.
3. التوقف عند كل بوابة وسؤالك عن قرارك.

## 4. الطريقة اليدوية خطوة بخطوة

<div dir="ltr">

```bash
creative-studio brief template > brief.json      # عدّل الملف
creative-studio init my-project --brief brief.json
cd my-project
creative-studio plan
creative-studio status
```

</div>

ثم لكل مهمة جاهزة:

<div dir="ltr">

```bash
creative-studio task start <id>
# نفّذ العمل بالمهارة المذكورة في الخطة
creative-studio task done <id>
```

</div>

وعند كل بوابة:

<div dir="ltr">

```bash
creative-studio approve G1-direction --actor "اسم صاحب القرار" --role client
```

</div>

## 5. الأوامر الأكثر استخداماً

| الغرض | الأمر |
|---|---|
| فحص الـ DNA وتصدير الرموز | `creative-studio dna check` ثم `creative-studio dna tokens` |
| بناء الهوية | `creative-studio brand build` |
| توليد الصور | `creative-studio images generate` |
| إنشاء الموقع | `creative-studio website scaffold` |
| إنشاء بوابة الويب | `creative-studio website scaffold --kind app` |
| إنشاء تطبيق الجوال | `creative-studio mobile scaffold` |
| بناء المشهد ثلاثي الأبعاد | `creative-studio 3d build` |
| تشغيل فحوص الجودة | `creative-studio test` |
| تدقيق الأمن والتراخيص | `creative-studio audit` |
| تسجيل طلب تعديل | `creative-studio revise add ...` |
| حزمة التسليم | `creative-studio export --draft` |

المرجع الكامل لكل أمر في `docs/cli.md`.

## 6. العربية واتجاه الكتابة

- يحدد الموجز اللغات، ويشترط الـ DNA خطاً عربياً مرخّصاً عند وجود لغة عربية.
- الموقع يُنتج صفحة مستقلة لكل لغة (`/` و`/ar/`) باتجاه صحيح ومن دون حاجة إلى JavaScript لقراءتها.
- القوالب تستخدم خصائص CSS المنطقية، فلا حاجة إلى تنسيقات خاصة بالعربية.
- محاور الزمن في المخططات ومسار الشمس تبقى من اليسار إلى اليمين لأنها تصوّر الواقع لا ترتيب القراءة.
- الأرقام لاتينية افتراضياً (`numerals: latin`) ويمكن تغييرها في الـ DNA.
- في تطبيق الجوال: الانعكاس الكامل على Android يتطلب `I18nManager.forceRTL` وإعادة تشغيل التطبيق.
- النصوص العربية في العرض التجريبي كتبها النظام؛ ينبغي أن يراجعها محرر لغوي قبل أي استخدام حقيقي.

## 7. تعديلات العميل

<div dir="ltr">

```bash
creative-studio revise add --target asset:story-dusk --feedback "اجعل صورة الغروب أهدأ" \
  --change asset.regenerate --preserve layout,typography,brand_colors --by "اسم العميل"
creative-studio revise start rev-001
# نفّذ التعديل بأصغر تغيير ممكن
creative-studio revise verify rev-001
creative-studio revise close rev-001 --actor "اسم العميل"
```

</div>

أمر `verify` يفشل إذا تغيّر أي ملف خارج نطاق الطلب، فيبقى العمل المعتمد كما هو.

## 8. قراءة تقرير الجودة

- **pass**: نجح. **fail**: فشل ويجب إصلاحه. **warn**: يحتاج نظر إنسان.
- **blocked**: تعذّر تشغيل الفحص هنا؛ ليس نجاحاً، ويجعل الحكم العام «غير مكتمل».
- كل قياس معلَّم بأنه مختبري (lab) أو ثابت (static) أو يحتاج فحصاً يدوياً.
- العيب الذي يفشل ثلاث مرات متتالية يُصعَّد إلى شخص ولا يُعاد تلقائياً.

## 9. ما لا يفعله النظام

لا يعتمد العمل نيابة عن العميل، ولا يرسل ملفات العميل إلى أي خدمة من دون إذن، ولا يبحث في العلامات التجارية، ولا يبني تطبيقات أصلية من دون أدوات المنصة، ولا يدّعي نجاح ما لم يُختبر.

</div>
