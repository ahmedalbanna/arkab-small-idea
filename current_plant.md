الآن أصبح لدي فهم شامل للحالة الحالية. دعني ألخص ملاحظاتي وأضع الخطة المفصلة.

---

# خطة تحسين التحقق والأمان لنظام الأوامر

## تحليل الوضع الحالي

بعد التعديلات السابقة، النظام شهد تحسينات كبيرة:
- **توحيد المسارات**: كل الأوامر تمر عبر `EditorCommandBus → executor → CoreEditor.apply()`
- **فصل المسؤوليات**: الإضافات لا تلامس الـ stores مباشرة بل تستخدم `CommandAPI` + `emitIntent`
- **التحقق من الإضافات**: Zod schemas موجودة بالفعل في `contributionSchemas.ts` للتحقق من `EditorCommand`, `ToolbarItem`, `Overlay`, `Setting`, `NodeView`

**لكن الثغرات المتبقية:**

| الثغرة | الموقع | الخطورة |
|--------|--------|---------|
| لا يوجد تحقق runtime من صحة `EditorCommandAction` عند `dispatch()` | `commandBus.ts` | عالية |
| لا يوجد تسجيل مسار للتغييرات (audit trail) | `commandBus.ts` | متوسطة |
| لا يوجد bounds checking مركزي للمواقع | `executor.ts` | منخفضة |
| لا يوجد تحقق من صحة محتوى markdown/URL في الأوامر | `executor.ts` + `format.ts` | متوسطة |
| لا يوجد حماية ضد أوامر متكررة بسرعة (debounce/rate-limit) | `commandBus.ts` | منخفضة |

---

## المرحلة 1: Zod Schema لـ `EditorCommandAction` (أولوية عالية)

### الملفات المتأثرة:
- **جديد**: `src/core/commands/actionSchema.ts`
- **مُعدَّل**: `src/core/commands/commandBus.ts`
- **جديد**: `src/test/commandActionValidation.test.ts`

### التفاصيل:

**1.1 إنشاء `actionSchema.ts`:**
```typescript
// Zod schema يتحقق من صحة كل أمر عند dispatch
const EditorCommandActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("focus") }),
  z.object({ type: z.literal("format"), format: z.string().min(1), attrs: z.record(z.any()).optional() }),
  z.object({ type: z.literal("insertText"), before: z.string(), after: z.string().optional() }),
  z.object({ type: z.literal("insertImage"), src: z.string().min(1), alt: z.string().optional(), title: z.string().optional() }),
  z.object({ type: z.literal("insertGallery"), srcs: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("appendMarkdown"), markdown: z.string() }),
  z.object({ type: z.literal("replaceSelectionWithMarkdown"), markdown: z.string() }),
  z.object({ type: z.literal("setMarkdown"), content: z.string() }),
  z.object({ type: z.literal("setTTSHighlight"), range: z.object({ from: z.number().nonneg(), to: z.number().nonneg() }).nullable() }),
  z.object({ type: z.literal("scrollToText"), text: z.string().min(1) }),
  z.object({ type: z.literal("scrollToPos"), pos: z.number().nonneg() }),
  z.object({ type: z.literal("streamMarkdown"), content: z.string(), isNew: z.boolean().optional() }),
  z.object({ type: z.literal("undo") }),
  z.object({ type: z.literal("redo") }),
  z.object({ type: z.literal("setSelection"), from: z.number().nonneg(), to: z.number().nonneg() }),
  z.object({ type: z.literal("deleteRange"), from: z.number().nonneg(), to: z.number().nonneg() }),
  z.object({ type: z.literal("insertNodeAt"), nodeName: z.string().min(1), attrs: z.record(z.any()).optional(), pos: z.number().nonneg().optional() }),
  // Queries
  z.object({ type: z.literal("getSelectedText") }),
  z.object({ type: z.literal("getHtml") }),
  z.object({ type: z.literal("getDoc") }),
  z.object({ type: z.literal("getTextWithPositions") }),
  z.object({ type: z.literal("getHeadings") }),
  z.object({ type: z.literal("getCursorContext") }),
]);
```

**1.2 تعديل `EditorCommandBus.dispatch()`:**
```typescript
dispatch(action: EditorCommandAction, options?: { strict?: boolean }): void {
  if (!this.executor) return;

  // التحقق في وضع التطوير + الاختبار فقط (أو عند activation)
  if (import.meta.env.DEV || import.meta.env.MODE === "test") {
    const result = EditorCommandActionSchema.safeParse(action);
    if (!result.success) {
      pluginLogger.error("bus", "action:invalid", "Invalid command action dispatched", {
        action,
        issues: formatIssues(result.error.issues),
      });
      if (options?.strict) return; // في الوضع الصارم، نتجاهل الأمر
    }
  }

  this.executor.run(action);
}
```

**1.3 ملاحظات التصميم:**
- **في `DEV`**: التحقق يعمل ويُسجّل الأخطاء في الـ logger لكن لا يمنع التنفيذ (لا نكسر الأداء في التطوير)
- **في `test`**: التحقق يعمل بالكامل للكشف عن المشاكل مبكراً
- **في `production`**: لا يوجد تحقق (أداء أفضل) - لكن يمكن تفعيله مؤقتاً عبر `options.strict`
- **`import.meta.env.DEV`** متاح في Vite/React автоматически

---

## المرحلة 2: تسجيل مسار التغييرات (Audit Trail) (أولوية متوسطة)

### الملفات المتأثرة:
- **مُعدَّل**: `src/core/commands/commandBus.ts`
- **جديد**: `src/core/commands/auditTrail.ts`
- **جديد**: `src/test/commandAuditTrail.test.ts`

### التفاصيل:

**2.1 إنشاء `auditTrail.ts`:**
```typescript
export interface CommandAuditEntry {
  id: string;                // معرّف فريد لكل عملية
  action: EditorCommandAction;
  source: CommandSource;
  timestamp: number;
  success: boolean;
  duration?: number;         // مدة التنفيذ بالمللي ثانية
}

export type CommandSource =
  | "user:keyboard"    // اختصار لوحة المفاتيح
  | "user:toolbar"     // شريط الأدوات
  | "user:slash"       // قائمة slash
  | "user:context"     // قائمة السياق
  | "user:palette"     // لوحة الأوامر
  | "plugin"           // إضافة مسجّلة
  | "ai"               // المساعد الذكي
  | "system";          // نظام (TTS, collab, etc.)

export interface AuditTrailConfig {
  maxEntries?: number;       // افتراضي: 100
  enabled?: boolean;         // افتراضي: true في DEV/test
}

export class CommandAuditTrail {
  private entries: CommandAuditEntry[] = [];
  private config: AuditTrailConfig;
  private nextId = 1;

  constructor(config?: AuditTrailConfig) { /* ... */ }

  record(entry: Omit<CommandAuditEntry, "id" | "timestamp">): CommandAuditEntry { /* ... */ }

  getRecent(count?: number): CommandAuditEntry[] { /* ... */ }

  getBySource(source: CommandSource): CommandAuditEntry[] { /* ... */ }

  clear(): void { /* ... */ }
}
```

**2.2 تعديل `EditorCommandBus`:**
```typescript
export class EditorCommandBus {
  private executor: EditorCommandExecutor | null = null;
  private auditTrail: CommandAuditTrail | null = null;

  constructor(config?: { audit?: AuditTrailConfig }) {
    if (config?.audit?.enabled !== false) {
      this.auditTrail = new CommandAuditTrail(config?.audit);
    }
  }

  dispatch(action: EditorCommandAction, options?: { source?: CommandSource }): void {
    if (!this.executor) return;
    const start = performance.now();
    try {
      this.executor.run(action);
      this.auditTrail?.record({
        action,
        source: options?.source ?? "system",
        success: true,
        duration: performance.now() - start,
      });
    } catch (err) {
      this.auditTrail?.record({
        action,
        source: options?.source ?? "system",
        success: false,
        duration: performance.now() - start,
      });
      throw err;
    }
  }

  /** لل调试: عرض آخر N عملية */
  getAuditLog(count?: number): CommandAuditEntry[] {
    return this.auditTrail?.getRecent(count) ?? [];
  }
}
```

**2.3 تعديل `EditorCommandBusProvider`:**
```typescript
export function EditorCommandBusProvider({ children }: { children: ReactNode }) {
  const bus = useMemo(() => new EditorCommandBus({
    audit: { enabled: import.meta.env.DEV }
  }), []);
  return (
    <EditorCommandBusContext.Provider value={bus}>{children}</EditorCommandBusContext.Provider>
  );
}
```

**2.4 استخدام `source` في المستهلكين الرئيسيين:**

في `editorCommandsPlugin`:
```typescript
ctx.registerCommand({
  id: "bold",
  label: "Bold",
  key: "Mod-b",
  run: (api) => {
    api.commandBus.dispatch({ type: "format", format: "bold" }, { source: "user:keyboard" });
  },
});
```

في `useFormatting.ts`:
```typescript
bus.dispatch({ type: "format", format: type }, { source: "user:toolbar" });
```

في `useAIStreaming.ts`:
```typescript
bus.dispatch({ type: "streamMarkdown", content: fullResponse, isNew }, { source: "ai" });
```

---

## المرحلة 3: Bounds Checking مركزي (أولوية منخفضة-متوسطة)

### الملفات المتأثرة:
- **مُعدَّل**: `src/core/commands/executor.ts`
- **جديد**: `src/core/commands/validateAction.ts`

### التفاصيل:

**3.1 إنشاء `validateAction.ts` helper:**
```typescript
/**
 * Clamp document positions to valid range.
 * Returns corrected from/to, or null if the document is empty.
 */
export function clampPositions(
  state: EditorState,
  from: number,
  to?: number,
): { from: number; to: number } | null {
  const max = state.doc.content.size;
  if (max === 0) return null;
  const clampedFrom = Math.max(0, Math.min(from, max));
  const clampedTo = to !== undefined ? Math.max(clampedFrom, Math.min(to, max)) : clampedFrom;
  return { from: clampedFrom, to: clampedTo };
}
```

**3.2 استخدامه في `executor.ts`:**
```typescript
// بدلاً من التكرار في كل case:
case "setSelection": {
  const pos = clampPositions(state, action.from, action.to);
  if (!pos) return {};
  const tr = state.tr.setSelection(TextSelection.create(state.doc, pos.from, pos.to));
  core.apply(tr);
  return {};
}

case "deleteRange": {
  const pos = clampPositions(state, action.from, action.to);
  if (!pos || pos.from === pos.to) return {};
  const tr = state.tr.delete(pos.from, pos.to);
  core.apply(tr);
  return {};
}
```

---

## المرحلة 4: تحسينات أمان الإدخال (أولوية متوسطة)

### الملفات المتأثرة:
- **مُعدَّل**: `src/core/commands/actionSchema.ts` (الملف الجديد من المرحلة 1)
- **مُعدَّل**: `src/core/operations/format.ts`

### التفاصيل:

**4.1 تقييد `format` values:**
```typescript
// في actionSchema.ts
const VALID_FORMATS = [
  "bold", "italic", "underline", "strike", "code",
  "h1", "h2", "h3", "paragraph",
  "bullet", "numbered", "quote",
  "alignLeft", "alignCenter", "alignRight", "alignJustify",
  "link", "tableify",
] as const;

const FormatCommandSchema = z.object({
  type: z.literal("format"),
  format: z.enum(VALID_FORMATS),
  attrs: z.record(z.any()).optional(),
});
```

**4.2 تقييد URL في `format.ts`:**
```typescript
// في applyFormat - case "link"
case "link": {
  if (!action.attrs?.href) return null;
  // التحقق من أن URL آمن
  const href = action.attrs.href;
  if (/^javascript:/i.test(href) || /^data:/i.test(href)) {
    pluginLogger.warn("executor", "format:unsafe-url", "Blocked unsafe URL in link format", { href });
    return null;
  }
  return runCommand(setMark(schema.marks.link, { href }), state);
}
```

---

## المرحلة 5: اختبارات شاملة (تتداخل مع كل مرحلة)

### الملفات الجديدة:

**5.1 `src/test/commandActionValidation.test.ts`:**
```typescript
describe("EditorCommandAction validation", () => {
  it("accepts all valid action types", () => {
    const validActions = [
      { type: "focus" },
      { type: "format", format: "bold" },
      { type: "insertText", before: "Hello" },
      { type: "undo" },
      // ... كل الأنواع الصحيحة
    ];
    for (const action of validActions) {
      expect(EditorCommandActionSchema.safeParse(action).success).toBe(true);
    }
  });

  it("rejects invalid format names", () => {
    expect(EditorCommandActionSchema.safeParse({ type: "format", format: "" }).success).toBe(false);
    expect(EditorCommandActionSchema.safeParse({ type: "format", format: "evil" }).success).toBe(false);
  });

  it("rejects negative positions", () => {
    expect(EditorCommandActionSchema.safeParse({ type: "setSelection", from: -1, to: 5 }).success).toBe(false);
  });

  it("rejects unknown action types", () => {
    expect(EditorCommandActionSchema.safeParse({ type: "unknown" }).success).toBe(false);
  });
});
```

**5.2 `src/test/commandAuditTrail.test.ts`:**
```typescript
describe("CommandAuditTrail", () => {
  it("records entries with incrementing ids", () => {
    const trail = new CommandAuditTrail({ maxEntries: 10 });
    const e1 = trail.record({ action: { type: "undo" }, source: "user:keyboard", success: true });
    const e2 = trail.record({ action: { type: "redo" }, source: "user:keyboard", success: true });
    expect(e2.id).toBe(String(Number(e1.id) + 1));
  });

  it("respects maxEntries limit", () => {
    const trail = new CommandAuditTrail({ maxEntries: 3 });
    for (let i = 0; i < 5; i++) {
      trail.record({ action: { type: "focus" }, source: "system", success: true });
    }
    expect(trail.getRecent().length).toBe(3);
  });

  it("filters by source", () => {
    const trail = new CommandAuditTrail();
    trail.record({ action: { type: "undo" }, source: "ai", success: true });
    trail.record({ action: { type: "undo" }, source: "user:keyboard", success: true });
    expect(trail.getBySource("ai").length).toBe(1);
  });
});
```

---

## خارطة التنفيذ

```
الأسبوع 1:
├── اليوم 1-2: المرحلة 1 (actionSchema.ts + dispatch validation)
├── اليوم 3: اختبارات المرحلة 1
├── اليوم 4-5: المرحلة 3 (validateAction.ts + executor cleanup)
└── اليوم 5: اختبارات المرحلة 3

الأسبوع 2:
├── اليوم 1-2: المرحلة 2 (auditTrail.ts + bus integration)
├── اليوم 3: تحديث المستهلكين الرئيسيين (source tagging)
├── اليوم 4: اختبارات المرحلة 2
└── اليوم 5: المرحلة 4 (format restrictions + URL validation)

الأسبوع 3:
├── اليوم 1-2: اختبارات تكاملية شاملة
├── اليوم 3: مراجعة الأداء (لا يوجد تأثير في production)
├── اليوم 4: التوثيق
└── اليوم 5: مراجعة نهائية
```

---

## مقاييس النجاح

| المقياس | القيمة الحالية | القيمة المستهدفة |
|---------|---------------|-----------------|
| التحقق من صحة الأوامر | لا يوجد | 100% من أنواع `EditorCommandAction` |
| تسجيل مسار التغييرات | لا يوجد | كل أمر مسجّل في DEV/test |
| تغطية الاختبارات الجديدة | 0% | > 90% للملفات الجديدة |
| الأداء في production | - | لا يوجد تأثير (validation خارج prod) |
| الأخطاء المكتشفة مبكراً | بعد التشغيل | قبل الوصول للـ executor |

---
