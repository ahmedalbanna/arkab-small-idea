# تقرير تدقيق واجهات المستخدم — Ink & Quill

> **نوع التدقيق:** مراجعة كود وواجهات (Code & UI Audit) — **للملاحظة فقط، لا تعديلات.**
> **النطاق:** جميع واجهات المستخدم في `src/components/**` + `src/plugins/**` + نظام الثيمات (`src/index.css`) + مخازن الحالة (`src/stores/**`).
> **الأبعاد:** (1) الجودة والصيانة — (2) إمكانية الوصول a11y ودعم RTL — (3) تجربة المستخدم البصرية.
> **تاريخ المراجعة:** 2026-07-20
> **اللغة:** التقرير بالعربية، مع إبقاء معرّفات الكود والمصطلحات التقنية بالإنجليزية.

---

## ٠. ملخص تنفيذي

المشروع تطبيق كتابة ذكي (React 19 + ProseMirror + نظام إضافات). واجهته غنية ومتعددة الطبقات (محرر، أشرطة للسطح والجوال، نوافذ منبثقة، شريط حالة، 7 سمات، دعم RTL). **الوظائف مكتملة بشكل كبير**، لكن الكود يعاني من مشاكل **صيانة واتساق** تراكمية، أبرزها:

- **إدارة الطبقات (z-index) غير مركزية** مع تصادم فعلي عند `z-100` بين 6 مكوّنات.
- **قوائم المحرر تستخدم ألواناً صلبة (`bg-zinc-900`)** تكسر نظام السمات السبع بالكامل (تظهر سوداء في الثيمات الفاتحة).
- **مكوّن المحرر العملاق** (`ProseMirrorEditor.tsx` = 1153 سطراً) يجمع مسؤوليات متعددة.
- **غياب شبه تام لإمكانية الوصول:** لا ARIA على عشرات الأزرار الأيقونية، لا `focus-trap` في النوافذ، لا مناطق `aria-live`، ولا حلقة تركيز مرئية موحّدة.
- **دعم RTL هش:** خلط خصائص فيزيائية (`left-/right-`) مع منطقية (`border-s/end-`)، ومعالجة يدوية متفرقة لا تغطي كل الواجهة.

جميع المشاكل أدناه موثّقة بأدلة (ملف:سطر) وتصنّف حسب الخطورة. الإصلاحات مقترحة كمرجع فقط وهي **خارج نطاق هذا التقرير** (مهمة منفصلة).

### جدول الملخص

| # | البعد | المشكلة | الخطورة | الدليل الرئيسي |
|---|-------|---------|---------|----------------|
| 1 | جودة | z-index بلا مقياس مركزي + تصادم z-100 | عالية | 6 مكوّنات عند `z-100` |
| 2 | جودة | ألوان zinc صلبة تكسر الثيم | عالية | `ProseMirrorEditor.tsx:411,946` |
| 3 | جودة | `ProseMirrorEditor.tsx` عملاق (1153 سطراً) | عالية | الملف بأكمله |
| 4 | جودة | نمط setters مكرر في المخازن (25×) | متوسطة | `uiStore.ts` وغيره |
| 5 | جودة | تكرار دالة `cn` | منخفضة | `Dialog.tsx:7-9` |
| 6 | جودة | إعادة بناء هيكل النوافذ يدوياً | متوسطة | `SettingsModal`, `ImportModal`… |
| 7 | جودة | فحص تعارض متغيرات الثيم | متوسطة | `index.css:6-142` |
| 8 | a11y | غياب ARIA/تسميات على الأزرار الأيقونية | عالية | 6 تطابقات فقط في المشروع |
| 9 | a11y | `role="button"` على `<div>` | متوسطة | `SnapshotsMenu.tsx:86` |
| 10 | a11y | `Dialog` بلا `aria-modal`/focus-trap | عالية | `Dialog.tsx:20-82` |
| 11 | a11y | لا مناطق `aria-live` للحالة | متوسطة | `uiStore` |
| 12 | a11y | لا `:focus-visible` موحّد | متوسطة | `index.css` |
| 13 | RTL | خلط فيزيائي/منطقي + معالجة متفرقة | عالية | 48 تطابقاً `left-/right-` |
| 14 | بصري | قوائم سوداء في ثيمات فاتحة | عالية | (نتيجة 2) |
| 15 | بصري | خلط أنظمة حركات | متوسطة | `motion` + `animate-in` |
| 16 | بصري | تباين أطراف/ظلال | منخفضة–متوسطة | عدة ملفات |
| 17 | بصري | تداخل StatusBar/MobileToolbar على الجوال | متوسطة | كلاهما `bottom-0 z-100` |

---

## ١. الجودة والصيانة (Quality & Maintainability)

### 1.1 تلوث z-index وتصادم الطبقات — **عالية**
يوجد ~30 قيمة `z-index` مشفّرة مباشرة في ~18 ملفاً، بلا مقياس مركزي. القيم المستخدمة: `40, 50, 60, 70, 100, 101, 110, 120, 130, 150, 200, 300`.

**تصادم خطير عند `z-100`** (6 مكوّنات على نفس المستوى — يفصل بينها ترتيب DOM لا الأولوية):
- `src/components/ui/Dialog.tsx:42,57`
- `src/components/ProseMirrorEditor.tsx:411` (قائمة الفقاعة bubble menu)
- `src/plugins/ai/AIHost.tsx:407`
- `src/components/navigation/MobileToolbar.tsx:38`
- `src/components/layout/StatusBar.tsx:47`
- `src/components/editor/ActivePageEditor.tsx:241`

طبقات أخرى: `z-40` (`TableOfContents.tsx:55`)، `z-50` (`ProseMirrorEditor.tsx:877`, `TTSSpeaker.tsx:138`)، `z-60/70` (`SnapshotsMenu.tsx:51`, `FileActionsMenu.tsx:46`, `AIProviderSettings.tsx:42,48`, `FloatingToolbar.tsx:38`)، `z-110` (`AIHost.tsx:412`, `SearchBar.tsx:55`, `WorkspacePlacement.tsx:97`)، `z-120/130` (`WorkspacePlacement.tsx:107`, `MobileMenu.tsx:22,29`)، `z-150` (`ProseMirrorEditor.tsx:793`, `ImportModal.tsx:58`)، `z-200` (`ProseMirrorEditor.tsx:946`, `SlashMenu.tsx:158`)، `z-300` (`CommandPalette.tsx:68`).

**المخاطر:** عند فتح نافذة (Dialog) فوق شريط الحالة/الشريط الجوال تتحكم الترتيب في DOM؛ وتظهر قوائم المحرر (z-200) فوق النوافذ (z-100) بشكل غير مقصود أحياناً. لا توجد طبقة "أعلى الكل" محددة سوى لوحة الأوامر.

### 1.2 ألوان صلبة (`zinc-*`) تُبطل نظام السمات — **عالية**
48 تطابقاً لـ `bg-zinc-*/border-zinc-*/text-zinc-*`. قوائم المحرر الداخلية كلها `bg-zinc-900` **داكنة دائماً** بغض النظر عن الثيم:
- `ProseMirrorEditor.tsx:411, 680, 796, 815, 946`
- `CommandPalette.tsx:72`
- `AIProviderSettings.tsx:42`، `ErrorBoundary.tsx:40-58`، `SettingsModal.tsx:76-78`

**النتيجة:** في ثيمات `light`/`andalusia`/`parchment` تظهر قائمة التنسيق والقائمة السياقية والـ Slash menu كصناديق سوداء غير متناسقة بصرياً — وهذا يُبطل فعلياً نظام السمات السبع للقوائم الداخلية.

### 1.3 مكوّن المحرر العملاق — **عالية**
`src/components/ProseMirrorEditor.tsx` = **1153 سطراً** يجمع: إعداد المحرر، منطق التنسيق، 4 أنظمة قوائم (bubble/side/context/slash)، وتكامل ميزات الذكاء الاصطناعي. خرق واضح لمبدأ المسؤولية الواحدة (SRP). كما يكرّر ترميز أزرار التنسيق (كتل متطابقة لـ h1/h2/h3/bold/italic/underline في الأسطر 415–474 وما يليها).

### 1.4 نمط setters مكرر في المخازن — **متوسطة**
النمط `typeof x === 'function' ? x(state.x) : x` مكرر **25 مرة** عبر 4 مخازن Zustand:
- `src/stores/uiStore.ts`: 15 مرة (الأسطر 76–118)
- `src/stores/aiStore.ts`: 7 مرات (93–114)
- `src/stores/settingsStore.ts`: 3 مرات (48–56)
- `src/stores/editorStore.ts`: 1 (137)

دالة مساعدة عامة (مثل `applyUpdate`/`setFlag`) تختصر نحو 100 سطر وتوحّد السلوك.

### 1.5 تكرار دالة `cn` — **منخفضة**
`src/components/ui/Dialog.tsx:7-9` يعرّف `cn` محلياً مطابقة تماماً لـ `src/lib/utils.ts:8`. يجب استيرادها بدل إعادة تعريفها.

### 1.6 إعادة بناء هيكل النوافذ يدوياً — **متوسطة**
6+ مكوّنات تعيد يدوياً بناء `fixed inset-0 ... backdrop` بدل إعادة استخدام مكوّن `Dialog` الموحّد:
- `SettingsModal.tsx:46`، `ImportModal.tsx:58`، `ShortcutsHelp.tsx:18`، `SearchBar.tsx:55`، `AIProviderSettings.tsx:42`، `CommandPalette.tsx:68`

سبب مباشر لتشتّت z-index (1.1) وعدم اتساق السلوك (بعضها يدعم Escape وبعضها لا).

### 1.7 فحص تعارض متغيرات الثيم — **متوسطة**
`src/index.css` (674 سطراً) يعرّف 6 ثيمات عبر `[data-theme=...]`: الجذر `light` (6)، `dark` (86)، `andalusia` (97)، `cosmos` (109)، `parchment` (121)، `tokyo` (133)، إضافة إلى وضع `system` (يُحلّ في `App.tsx` إلى light/dark) = 7 قابلة للاختيار. كل الثيمات تعيد تعريف نفس مجموعة `--minimal-*`؛ مع الاستخدام الصلب لـ `zinc` في القوائم (1.2) يتبيّن أن الرموز لا تُطبَّق بانتظام. يُوصى بمراجعة كلاسات `.ProseMirror-*` والعناصر الداخلية للتأكد من اعتمادها على الرموز لا على ألوان صلبة.

---

## ٢. إمكانية الوصول (a11y) ودعم RTL

### 2.1 غياب شبه تام لـ ARIA والتسميات — **عالية**
البحث عن `aria-*`, `role=`, `alt=` في `src/components/**` أعاد **6 تطابقات فقط** (`SnapshotsMenu.tsx`, `SettingsModal.tsx` بـ `aria-pressed`, `AIAssistantSidebar.tsx` بـ `alt` على صورتين، وواحدة في ملف اختبار). في المقابل يوجد عشرات الأزرار الأيقونية (إغلاق `X`، أزرار التنسيق، أزرار شريط الأدوات العائم/الجوال) **بلا `aria-label`** ⇒ غير مقروءة لقارئات الشاشة (Screen Readers).

### 2.2 عناصر تفاعلية غير بلوحة المفاتيح — **متوسطة**
`src/components/overlays/SnapshotsMenu.tsx:86` يستخدم `role="button"` على عنصر `<div>` بدل `<button>` ⇒ لا يمكن التركيز عليه أو تفعيله عبر Enter/Space.

### 2.3 نوافذ منبثقة غير متاحة — **عالية**
`src/components/ui/Dialog.tsx` (20–82): يفتقر إلى `role="dialog"`، `aria-modal="true"`، `aria-labelledby`/`aria-label`، و**فخ تركيز (focus trap)**. يعالج `Escape` للإغلاق لكنه لا يعيد التركيز للعنصر المُطلق ولا يمنع التنقّل خارج النافذة. هذا ينطبق على كل النوافذ التي تستخدمه (حالياً قليلة لأن معظمها أعادت البناء يدوياً — راجع 1.6).

### 2.4 لا مناطق `aria-live` — **متوسطة**
حالات ديناميكية في `uiStore` (مثل `isAutoSaving`, `isIndexing`, `isGenerating` في `aiStore`) لا تُعلَن لقارئات الشاشة. يُوصى بمنطقة `aria-live="polite"` لحالة الحفظ والفهرسة، و`aria-live="assertive"` للتنبيهات.

### 2.5 لا حلقة تركيز مرئية موحّدة — **متوسطة**
البحث في `src/index.css` عن `:focus-visible`/`focus:` أعاد فقط أنماط `placeholder` (الأسطر 336–343). لا يوجد نمط `:focus-visible` عام للعناصر التفاعلية ⇒ تنقّل لوحة المفاتيح غير واضح بصرياً (خاصة مع الثيمات الداكنة).

### 2.6 دعم RTL هش ومخلوط — **عالية**
البحث عن خصائص فيزيائية (`left-/right-/ml-/mr-/pl-/pr-`) أعاد **48 تطابقاً**، تقابلها خصائص منطقية متفرقة (`border-s/border-e`, `end-0`). معالجة RTL يدوية **محلية فقط** في:
- `WorkspacePlacement.tsx:108` (`direction==='rtl' ? "left-0 border-r" : "right-0 border-l"`)
- `MobileMenu.tsx:30` (`direction==='rtl' ? "right-0 border-s" : "left-0 border-e"`)
- `AIProviderSettings.tsx:48` (`end-0`)

**غير معالَج** في عناصر رئيسية:
- `FloatingToolbar.tsx:38` (`right-8` ثابت — لا ينقلب لليسار في RTL)
- `TableOfContents.tsx:55` (`right-6` ثابت)
- `SnapshotsMenu.tsx:51` (`left-0`)، `FileActionsMenu.tsx:47` (`right-0`)
- عشرات `right-3/left-3`, `pr-2`, `mr-3` الفيزيائية في `SearchBar`, `AIAssistantSidebar`, `WorkspacePlacement`, `ActivePageEditor`.

رغم أن الجذر يضبط `dir` (في `App.tsx`)، فإن الخصائص الفيزيائية لا تنقلب تلقائياً ⇒ تتشوّه المحاذاة في العربية. **التوصية:** التحوّل الكامل إلى خصائص منطقية (`start-/end-/ms-/me-/ps-/pe-`) عبر Tailwind، والتخلي عن المعالجة اليدوية المتفرقة.

### 2.7 قائمة فحص a11y (مرجع للتنفيذ لاحقاً)
- [ ] إضافة `aria-label` لكل زر أيقوني.
- [ ] استبدال `role="button"` على `<div>` بـ `<button>`.
- [ ] ترقية `Dialog` بـ `role="dialog"` + `aria-modal` + focus-trap + استعادة التركيز.
- [ ] إضافة مناطق `aria-live` للحالة (حفظ/فهرسة/توليد).
- [ ] تعريف `:focus-visible` عام بلون `--minimal-accent`.
- [ ] تحويل كل الخصائص الفيزيائية إلى منطقية لدعم RTL شامل.

---

## ٣. تجربة المستخدم البصرية (Visual UX)

### 3.1 تناقض القوائم مع الثيمات — **عالية**
نتيجة مباشرة لـ (1.2): القوائم الداخلية سوداء ثابتة تتعارض بصرياً مع الثيمات الفاتحة/الذاوية. أكثر ما يلفت النظر عند التبديل بين الثيمات.

### 3.2 خلط أنظمة الحركات — **متوسطة**
بعض المكوّنات تستخدم `motion/react` (مع `spring`)، وأخرى تستخدم فئات `animate-in fade-in zoom-in-95` (من `tailwindcss-animate`)، مثل `SnapshotsMenu.tsx:51` و`FileActionsMenu.tsx:46`. إيقاع ظهور العناصر غير متسق بين القوائم.

### 3.3 تباين أطراف وظلال — **منخفضة–متوسطة**
تفاوت غير منتظم: `rounded-2xl` مقابل `rounded-xl`، و`shadow-2xl` مقابل `shadow-[0_20px_50px_rgba(0,0,0,0.5)]` بين قوائم متجاورة (مثلاً `ProseMirrorEditor.tsx:411` مقابل `:946`). يُفضّل مقياس موحّد لأطراف/ظلال القوائم.

### 3.4 تداخل الشريط السفلي على الجوال — **متوسطة**
`StatusBar.tsx:47` و`MobileToolbar.tsx:38` كلاهما `fixed bottom-0 ... z-[100]` ⇒ على الشاشات الصغيرة قد يتداخلان أو يتنافسان على نفس المساحة السفلية.

### 3.5 اتساق المسافات والأحجام — **منخفضة**
أحجام الأيقونات/الأزرار متفاوتة بين الشريط العائم والشريط الجوال والقوائم؛ يُفضّل نظام تصميم (Design Tokens) موحّد لأبعاد الأيقونات والفجوات.

---

## ٤. خريطة z-index مقترحة (مرجع)

| الطبقة | القيمة المقترحة | الاستخدام |
|--------|-----------------|-----------|
| base | `z-0`–`z-10` | المحتوى، رؤوس القوائم الداخلية (`AIAssistantSidebar:135` كان `z-10`) |
| sticky UI | `z-20` | StatusBar / MobileToolbar |
| popover/menu | `z-40`–`z-50` | TOC، Snapshots، FileActions، TTSSpeaker |
| toolbar/panel | `z-60`–`z-70` | FloatingToolbar، AIProviderSettings، AIHost |
| modal overlay | `z-100` | Dialog/Settings/Import/Search (موحّد) |
| menu-above-modal | `z-110`–`z-130` | MobileMenu، WorkspacePlacement، SearchBar |
| editor menus | `z-150`–`z-200` | bubble/context/slash داخل المحرر |
| command palette | `z-300` | CommandPalette (أعلى الكل) |

**القاعدة:** قيمة واحدة لكل طبقة عبر ملف مركزي (مثلاً متغيرات CSS `--z-*` أو فئات Tailwind مخصّصة)، وعدم تشفير الأرقام في كل مكوّن.

---

## ٥. توصيات إعادة الهيكلة (مرجع فقط — خارج نطاق التقرير)

1. **فصل قوائم المحرر:** استخراج bubble/side/context/slash إلى مكوّنات فرعية في `components/editor/menus/`، وخفض `ProseMirrorEditor.tsx` إلى طبقة تركيب فقط.
2. **مقياس z-index مركزي** كما في §4.
3. **دالة `applyUpdate` عامة** للمخازن للقضاء على تكرار الـ 25 setter.
4. **مكوّن `Dialog` موحّد ومتاح** (يستخدمه كل النوافذ) مع focus-trap و`aria-*`.
5. **رموز ثيم للقوائم:** استبدال `bg-zinc-900` بـ `bg-minimal-bg`/`border-minimal-border`/`text-minimal-text` في كل القوائم الداخلية.
6. **انتقال كامل إلى خصائص RTL منطقية** وإزالة المعالجة اليدنية المتفرقة.
7. **حلقة `:focus-visible` عامة** ومناطق `aria-live`.
8. **نظام تصميم (tokens)** موحّد للأطراف/الظلال/الحركات/أحجام الأيقونات.

---

## الملحق أ — فهرس الأدلة (ملف:سطر)

**z-index:**
- `Dialog.tsx:42,57` (z-100/101)
- `ProseMirrorEditor.tsx:411` (z-100)، `:793` (z-150)، `:877` (z-50)، `:946` (z-200)
- `AIHost.tsx:407` (z-100)، `:412` (z-110)
- `SnapshotsMenu.tsx:51` (z-60)، `ShortcutsHelp.tsx:18` (z-100)، `SettingsModal.tsx:46` (z-100)
- `SearchBar.tsx:55` (z-110)، `ImportModal.tsx:58` (z-150)
- `WorkspacePlacement.tsx:97` (z-110)، `:107` (z-120)
- `FileActionsMenu.tsx:46` (z-60)، `MobileToolbar.tsx:38` (z-100)، `MobileMenu.tsx:22` (z-120)، `:29` (z-130)
- `TableOfContents.tsx:55` (z-40)، `StatusBar.tsx:47` (z-100)، `FloatingToolbar.tsx:38` (z-60)
- `CommandPalette.tsx:68` (z-300)، `ActivePageEditor.tsx:241` (z-100)
- `AIProviderSettings.tsx:42` (z-60)، `:48` (z-70)، `AIAssistantSidebar.tsx:71` (z-110)، `:135` (z-10)
- `TTSSpeaker.tsx:138` (z-50)، `SlashMenu.tsx:158` (z-200)

**ألوان zinc صلبة:** `ProseMirrorEditor.tsx:411,680,796,815,946`؛ `CommandPalette.tsx:72`؛ `AIProviderSettings.tsx:42`؛ `ErrorBoundary.tsx:40-58`؛ `SettingsModal.tsx:76-78`؛ `MobileMenu.tsx:22`؛ `WorkspacePlacement.tsx:97`؛ `SearchBar.tsx:183-186`؛ `ImportModal.tsx:127`.

**المخازن (setters مكرر):** `uiStore.ts:76-118` (15)، `aiStore.ts:93-114` (7)، `settingsStore.ts:48-56` (3)، `editorStore.ts:137` (1).

**a11y/RTL:** `Dialog.tsx:20-82` (بلا aria/focus-trap)؛ `SnapshotsMenu.tsx:86` (`role="button"` على div)؛ `index.css` (لا `:focus-visible`)؛ `FloatingToolbar.tsx:38` (`right-8`)؛ `TableOfContents.tsx:55` (`right-6`)؛ `WorkspacePlacement.tsx:108`، `MobileMenu.tsx:30`، `AIProviderSettings.tsx:48` (معالجة RTL يدوية).

---

## الملحق ب — خطوات التحقق البصري (للملاحظة)

1. `npm install` ثم `npm run dev`.
2. افتح التطبيق وبدّل الثيمات السبع (light/dark/system/andalusia/cosmos/parchment/tokyo) وراقب قوائم المحرر (bubble/context/slash) — لاحظ ظهورها سوداء في الثيمات الفاتحة.
3. فعّل `direction: rtl` (من إعدادات الاتجاه) وراقب: الشريط العائم، جدول المحتويات، القوائم المنسدلة — لاحظ عدم الانقلاب.
4. شغّل قارئ شاشة (أو امتداد a11y) وراقب الأزرار الأيقونية والنوافذ.
5. `npm run lint` لرصد مشاكل الأنواع في مكونات الواجهة.

> **ملاحظة ختامية:** هذا التقرير للتدقيق فقط. أي إصلاح فعلي للكود المذكور أعلاه يُنفّذ في مهمة منفصلة بعد اعتماد التوصيات.
