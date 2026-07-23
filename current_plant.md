الآن أصبح لدي فهم كامل للحالة الراهضة. سأقدم خطة شاملة لتحسين تجربة المطور.

---

# خطة تحسين تجربة المطور — المرحلة الرابعة

## تحليل الفجوات الحالية

بعد التحليل المعمّق، إليك الفجوات الرئيسية في تجربة المطور:

| الفجوة | الحالة الحالية | الأثر |
|--------|---------------|-------|
| لا يوجد DevTools Panel | لا طريقة لفحص CommandBus أو AuditTrail أو State في الوقت الفعلي | صعوبة تتبع المشاكل |
| لا توجد Command Testing Helpers | كل ملف اختبار ينشئ mocks خاص به | تكرار وتفرّق أنماط |
| لا يوجد Plugin Dev Helper | لا طريقة لاختبار إضافة معزولة بسرعة | بطء تطوير الإضافات |
| لا يوجد Schema Explorer | لا يمكن فحص Nodes/Marks/Marks المتاحة وقت التشغيل | صعوبة فهم الـ Schema |
| لا يوجد Command Inspector | لا يمكن رؤية الأوامر المسجلة ومفاتيحها ومصدرها | صعوبة تتبع مسار الأوامر |

---

## الخطوة 1: Command Testing Utilities

### 1.1 إنشاء `src/test/helpers/commandTestUtils.ts`

ملف مساعد يوفر:

```typescript
// ── Mock Executor ──
export function createMockExecutor(): MockExecutor {
  return {
    run: vi.fn(() => ({})),
    lastAction: () => /* آخر action تم تشغيله */,
  };
}

// ── Mock Command Bus ──
export function createMockCommandBus(config?: {
  executor?: EditorCommandExecutor;
  audit?: boolean;
}): EditorCommandBus

// ── Fake CoreEditor ──
// نسخة خفيفة من CoreEditor للاختبارات لا تحتاج DOM
export function createTestCore(config?: {
  initialMarkdown?: string;
  prosePlugins?: Plugin[];
}): CoreEditor

// ── Assertion Helpers ──
export function expectDispatched(
  bus: EditorCommandBus,
  ...expectedActions: EditorCommandAction[]
): void

export function expectAuditEntry(
  bus: EditorCommandBus,
  partial: Partial<CommandAuditEntry>
): void
```

### 1.2 تحديث ملفات الاختبار القديمة

تحويل الملفات المكررة:
- `commandActionValidation.test.ts` → يستخدم `createMockExecutor()`
- `editorCommandBus.test.ts` → يستخدم `createMockCommandBus()`
- `editorCommands.test.ts` → يستخدم `createMockCommandBus()`

### الملفات المتأثرة:
| ملف | التغيير |
|-----|---------|
| `src/test/helpers/commandTestUtils.ts` | **جديد** - مساعدات الاختبار |
| `src/test/commandActionValidation.test.ts` | تحديث ليستخدم المساعدات الجديدة |
| `src/test/editorCommandBus.test.ts` | تحديث ليستخدم المساعدات الجديدة |
| `src/test/editorCommands.test.ts` | تحديث ليستخدم المساعدات الجديدة |
| `src/test/commandAuditTrail.test.ts` | تحديث ليستخدم المساعدات الجديدة |

---

## الخطوة 2: Command Inspector (Dev-Only)

### 2.1 إنشاء `src/plugins/devtools/commandInspector.ts`

ملف يوفر API لفحص أوامر المحرر في الوقت الفعلي:

```typescript
export interface CommandInfo {
  /** معرّف الأمر */
  id: string;
  /** الوسيلة النصية */
  key?: string;
  /** التسمية المعروضة */
  label?: string;
  /** المصدر: من سجّل هذا الأمر */
  source: "core" | "plugin" | "ai" | string;
  /** هل يظهر في SlashMenu */
  slash?: boolean;
  /** هل له اختصار لوحة مفاتيح */
  hasKeybinding: boolean;
}

export interface BusSnapshot {
  /** جميع الأوامر المسجلة */
  commands: CommandInfo[];
  /** آخر 10 أوامر تم تنفيذها */
  recentDispatches: CommandAuditEntry[];
  /** هل الـ executor مسجل */
  executorAttached: boolean;
  /** عدد Entries في AuditTrail */
  auditSize: number;
}

export class CommandInspector {
  constructor(
    private bus: EditorCommandBus,
    private registeredCommands: EditorCommand[],
  ) {}

  /** لقطة حالية لحالة الـ Bus */
  snapshot(): BusSnapshot { /* ... */ }

  /** البحث في الأوامر */
  search(query: string): CommandInfo[] { /* ... */ }

  /** تصفية حسب المصدر */
  filterBySource(source: CommandSource): CommandInfo[] { /* ... */ }

  /** فحص مسار تنفيذ محدد */
  traceDispatch(action: EditorCommandAction): {
    valid: boolean;
    issues?: string[];
    source?: CommandSource;
    entry?: CommandAuditEntry;
  } { /* ... */ }
}
```

### 2.2 إنشاء `src/plugins/devtools/index.ts`

Plugin devtools معزول يُحمّل فقط في وضع التطوير:

```typescript
export const devtoolsPlugin: InkPlugin = {
  id: "devtools",
  name: "Developer Tools",
  version: "1.0.0",
  enabled: import.meta.env.DEV,

  init(ctx: PluginContext) {
    // يسجل overlay في لوحة side panel
    ctx.registerOverlay({
      id: "command-inspector",
      component: CommandInspectorPanel,  // React component
      mount: "sidebar",
      show: () => import.meta.env.DEV,
    });

    // يسجل أمر مخصص "dev:inspect"
    ctx.registerCommand({
      id: "dev:inspect",
      label: "Open Command Inspector",
      key: "Mod-Shift-i",
      run: (api) => {
        api.emitIntent({ type: "showCommandPalette" });
      },
    });
  },
};
```

### 2.3 إنشاء `src/components/devtools/CommandInspectorPanel.tsx`

React component يعرض:

```tsx
// ── القسم 1: قائمة الأوامر المسجلة ──
// جدول: ID | Label | Keybinding | Source | Slash
// مع إمكانية البحث والتصفية

// ── القسم 2: آخر الأوامر المنفذة ──
// جدول: # | Action | Source | Duration | Status
// مع تحديث مباشر عند كل dispatch

// ── القسم 3: Audit Trail Timeline ──
// Timeline بصري يُظهر مسار كل أمر

// ── القسم 4: Schema Info ──
// عدد Nodes و Marks و Plugins المسجلة
```

### الملفات المتأثرة:
| ملف | التغيير |
|-----|---------|
| `src/plugins/devtools/index.ts` | **جديد** - Plugin devtools |
| `src/plugins/devtools/commandInspector.ts` | **جديد** - CommandInspector class |
| `src/components/devtools/CommandInspectorPanel.tsx` | **جديد** - UI component |
| `src/plugins/index.ts` | إضافة `devtoolsPlugin` إلى `buildPluginModules()` |
| `src/plugins/registry.ts` | لا يتطلب تغيير — الإضافة تتبع القواعد الحالية |

---

## الخطوة 3: Plugin Development Helpers

### 3.1 إنشاء `src/plugins/devtools/pluginDevHelper.ts`

```typescript
/**
 * مساعد تطوير الإضافات — يوفر بيئة معزولة لاختبار إضافة واحدة
 */

export interface PluginTestBench {
  /** بناء context وهمي لإضافة واحدة */
  createPluginContext(options?: {
    schema?: Schema;
    commandBus?: EditorCommandBus;
  }): PluginTestContext;

  /** تسجيل وإدارة دورة حياة الإضافة */
  loadPlugin(plugin: InkPlugin): Promise<void>;

  /** محاكاة بيئة المستخدم */
  simulateUserAction(action: EditorCommandAction): void;

  /** فحص مساهمات الإضافة */
  getContributions(): {
    commands: EditorCommand[];
    toolbarItems: ToolbarItem[];
    prosePlugins: Plugin[];
    nodeViews: NodeViewRegistration[];
  };

  /** تنظيف بعد الاختبار */
  destroy(): void;
}

export function createPluginTestBench(): PluginTestBench { /* ... */ }
```

### 3.2 إنشاء `src/test/helpers/pluginTestUtils.ts`

```typescript
export function createTestPluginContext(): PluginTestContext
export function createTestCommandAPI(): CommandAPI
export function withTestPlugin(plugin: InkPlugin): PluginTestResult
```

### الملفات المتأثرة:
| ملف | التغيير |
|-----|---------|
| `src/plugins/devtools/pluginDevHelper.ts` | **جديد** - PluginTestBench |
| `src/test/helpers/pluginTestUtils.ts` | **جديد** - مساعدات اختبار الإضافات |

---

## الخطوة 4: Audit Trail Logger (Dev-Only)

### 4.1 إنشاء `src/plugins/devtools/auditLogger.ts`

```typescript
/**
 * سجل أوامر مرئي في وضع التطوير — يعرض كل أمر يتم تنفيذه
 * مع المصدر والمدة وحالة النجاح/Failure
 */

export class AuditLogger {
  private trail: CommandAuditTrail;
  private listeners = new Set<(entry: CommandAuditEntry) => void>();

  constructor(bus: EditorCommandBus) { /* ... */ }

  /** الاشتراك في الأوامر الجديدة */
  onCommand(callback: (entry: CommandAuditEntry) => void): () => void { /* ... */ }

  /** تصدير السجل كـ JSON */
  exportJSON(): string { /* ... */ }

  /** تصدير كـ CSV */
  exportCSV(): string { /* ... */ }

  /** إحصائيات سريعة */
  stats(): {
    totalCommands: number;
    bySource: Record<CommandSource, number>;
    avgDuration: number;
    failureRate: number;
  } { /* ... */ }
}
```

### الملفات المتأثرة:
| ملف | التغيير |
|-----|---------|
| `src/plugins/devtools/auditLogger.ts` | **جديد** - AuditLogger |

---

## الخطوة 5: التكامل والاختبارات

### 5.1 اختبارات المساعدات الجديدة

| ملف | الوصف |
|-----|-------|
| `src/test/commandTestUtils.test.ts` | **جديد** - اختبار المساعدات نفسها |
| `src/test/pluginTestUtils.test.ts` | **جديد** - اختبار مساعدات الإضافات |
| `src/test/commandInspector.test.ts` | **جديد** - اختبار CommandInspector |

### 5.2 تحديث vite.config.ts

إضافة alias للـ devtools:

```typescript
// vite.config.ts
resolve: {
  alias: {
    "@devtools": path.resolve(__dirname, "src/plugins/devtools"),
  },
}
```

---

## خارطة الطريق المقترحة

```
الأسبوع 1:
├── Day 1-2: commandTestUtils.ts + تحديث ملفات الاختبار القديمة
├── Day 3-4: pluginDevHelper.ts + pluginTestUtils.ts
└── Day 5:   اختبارات المساعدات الجديدة

الأسبوع 2:
├── Day 1-2: commandInspector.ts + AuditLogger
├── Day 3-4: CommandInspectorPanel.tsx
└── Day 5:   devtoolsPlugin + التكامل

الأسبوع 3:
├── Day 1-2: تحديث index.ts + اختبارات التكامل
├── Day 3-4: مراجعة شاملة + تنظيف
└── Day 5:   التوثيق النهائي
```

---

## مقاييس النجاح

| المقياس | القيمة الحالية | القيمة المستهدفة |
|---------|---------------|-----------------|
| ملفات الاختبار المكررة | ~80% تكرار mocks | < 10% تكرار |
| وقت إنشاء اختبار إضافة جديد | ~15 دقيقة | < 3 دقائق |
| وقت تشخيص مشكلة أمر | ~30 دقيقة | < 5 دقائق |
| تغطية اختبارات مساعدات DX | 0% | > 90% |

---

هل تريد أن أبدأ بالتنفيذ من الخطوة 1 (Command Testing Utilities)؟
