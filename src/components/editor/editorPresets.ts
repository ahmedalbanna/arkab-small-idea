/**
 * Data constants for the editor workspace — presets, quotes, and content
 * templates that were historically inlined in component files.
 *
 * Following the same data-driven pattern used by `AI_ACTIONS` in
 * `src/constants.ts`.
 */

import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  Code,
  Table,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Layout,
  Link,
  Image as ImageIcon,
} from "lucide-react";
import type { ComponentType } from "react";

// ---------------------------------------------------------------------------
// Poetic quotes shown in the empty-state desk
// ---------------------------------------------------------------------------

export interface PoeticQuote {
  ar: string;
  en: string;
  author: string;
}

export const POETIC_QUOTES: PoeticQuote[] = [
  {
    ar: "الخط هندسة روحانية ظهرت بآلة جسدانية",
    en: "Writing is a spiritual geometry, manifested through a physical tool.",
    author: "ياقوت المستعصمي",
  },
  {
    ar: "إن حبر القلم حبلٌ سري يربط بين روحين يفصل بينهما الدهر",
    en: "The ink of the pen is an umbilical cord connecting two souls across epochs.",
    author: "خليل جبران",
  },
  {
    ar: "الكتابة تنهض من عتمة الفكر لتنير دروب الحقيقة ببريق الكلمات",
    en: "Writing rises from the darkness of thought to illuminate the paths of truth with the glitter of words.",
    author: "أنيس منصور",
  },
  {
    ar: "الكلمة الجميلة كشجرة طيبة أصلها ثابت وفرعها في السماء",
    en: "A beautiful word is like a beautiful tree, its root is firm and its branches reach the sky.",
    author: "فلسفة الكلمة والأثر",
  },
];

// ---------------------------------------------------------------------------
// Multi-paragraph content templates used by theme presets
// (Defined before EDITOR_THEME_PRESETS since that array references them.)
// ---------------------------------------------------------------------------

const ANDALUSIA_CONTENT = `# الأندلس: الفردوس المفقود وطوق الحمامة

> "يا أهل أندلسٍ لله درّكُمُ.. ماءٌ وظلٌ وأنهارٌ وأشجارُ" - ابن خفاجة

تعدّ الأندلس منارة حضارية جمعت بين جمال الطبيعة، وفخامة العمران، ورِقّة الأدب الموشّح. في هذا الفصل، نستعرض ملامح الإبداع الأدبي والعمراني:

## ١. طوق الحمامة في الأُلفة والأُلَّاف
ألفه الفقيه الأديب **ابن حزم الأندلسي**، وهو دراسة عميقة في علم النفس العاطفي والاجتماعي. يحلل فيه الحب بأسلوب فلسفي شاعري فريد:

*   **نشأة المودة**: الحب اتصال بين النفوس في جبلتها الرفيعة.
*   **علامات الهوى**: إدمان النظر، والإقبال بالحديث، والبهتان عند اللقاء المفاجئ.

## ٢. هندسة الجنان والقصور
امتازت العمارة الأندلسية بالتناغم البصري الفائق:
- **بهو السباع** في قصر الحمراء: توازن دقيق بين الظل والضوء، وتدفق سلِس للمياه الرقراقة.
- **الحدائق المعلقة**: شُيّدت على شكل مستويات مدرّجة لتوفير نظام تهوية وتبريد طبيعي متقن.`;

const COSMOS_CONTENT = `# أسرار الكون: سديم الجبار وحواضن النجوم

> "الكون ليس فقط أكثر غرابة مما نتخيل، بل هو أكثر غرابة مما يمكننا تخيله." - آرثر إيدنجتون

في أعماق الفضاء السحيق، تتراقص موجات الغبار الكوني لتصنع سُدماً مذهلة تلتمع بألوان الطيف بفعل تأين الغازات المحيطة بالشموس الوليدة.

## ١. سديم الجبار (Orion Nebula)
يقع السديم على بُعد **١٣٤٤ سنة ضوئية** من الأرض، وهو أقرب حاضنة للنجوم العملاقة إلينا:

- **الأطياف اللامعة**: ينبعث اللون الأحمر الداكن من هيدروجين الفضاء المتأين، بينما تتألق درجات الأزرق المخضر بفعل ذرات الأكسجين المزدوجة.
- **الأقراص النجمية الأولية**: أنظمة كوكبية كاملة تبدأ في التشكل داخل هذه الغيمة العملاقة.

## ٢. فيزياء الثقوب السوداء
تنهار النجوم فائقة الكتلة تحت تأثير جاذبيتها الخاصة، لتشكل ثقوباً سوداء تتحدى نسيج الزمكان:
1. **أفق الحدث**: النقطة التي لا يمكن لأي شيء، حتى الضوء، الهروب منها.
2. **التفرد الجاذبي**: النقطة اللانهائية الكثافة في قلب الثقب الأسود حيث تنهار القوانين الفيزيائية المعروفة.`;

const PARCHMENT_CONTENT = `# حبرٌ وريشة: خواطر في فلسفة الكتابة والأثر

> "الخط لسان اليد، وبهجة الضمير، وسفير العقل." - ياقوت المستعصمي

كنا نخط الحروف ببطء وصبر، لنمنح الكلمة هيبتها وجلالها المستحق. إن الكتابة ليست مجرد صفّ للحروف، بل هي حياكة للأرواح وتجسيد للأفكار العابرة.

## ١. ميتالورجيا الحبر القديم
صُنع الحبر التقليدي قديماً من مواد طبيعية تدوم لقرون:
- **حبر السناج**: يخلط الهباب الأسود الخفيف مع صمغ عربي نقي وماء الورد المعطر ليعطي سواداً حالكاً وملمساً مخملياً.
- **حبر العفص الدباغي**: يُغلى كرات نبات العفص مع الزاج الحديدي لإنتاج حبر كيميائي يتغلغل في ألياف الورق لضمان عدم زواله.

## ٢. ريشة الكتابة الأثيرة
لم تكن كل ريشة صالحة للخط؛ بل اختيرت قصاب القصب والخريز بعناية فائقة:
- **زاوية قط الريشة**: يحدد ميل القلم سماكة الحرف وتناغم انحناءاته.
- **الشق الأوسط**: يحبس قطرات الحبر ويسربها بتوازن دقيق أثناء انسياب الكتابة.`;

const TOKYO_CONTENT = `# TOKYO NEON: CYBERPUNK MEMORY CORES

> "The sky above the port was the color of television, tuned to a dead channel." - William Gibson

Connecting to Cyber-Core 0x99F... High-speed fiber channels online. Memory matrix synced.

## 1. NEON LIGHT DISTRICTS
The glowing light of the city serves as a physical wrapper around digital data lanes:
*   **Virtual Projections**: Real-time holographic ads layered directly onto the skyline.
*   **Encrypted Terminals**: Dark alleys hosting physical hardware layers for decentralized nodes.

## 2. METROPOLIS PROTOCOLS
1.  **Sync Rate**: 99.98% telemetry parity.
2.  **Quantum Encryption**: Keys rotated every 120ms to safeguard personal memory shards.`;

// ---------------------------------------------------------------------------
// Theme presets for the "space selection" cards
// ---------------------------------------------------------------------------

export interface EditorThemePreset {
  title: string;
  desc: string;
  theme: string;
  font: string;
  content: string;
  docTitle: string;
  icon: string;
  badge: string;
  color: string;
}

export const EDITOR_THEME_PRESETS: EditorThemePreset[] = [
  {
    title: "الأندلس الأثري",
    desc: "عراقة الأدب الموشّح والفردوس المفقود",
    theme: "andalusia",
    font: '"Amiri", serif',
    content: ANDALUSIA_CONTENT,
    docTitle: "الأندلس والفردوس المفقود",
    icon: "🕌",
    badge: "مظهر دافئ & خط كلاسيكي",
    color:
      "border-emerald-500/20 hover:border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-800",
  },
  {
    title: "الكون الساحر",
    desc: "أسرار الفضاء السحيق وسديم الجبار",
    theme: "cosmos",
    font: '"Cairo", sans-serif',
    content: COSMOS_CONTENT,
    docTitle: "سديم الجبار وحواضن النجوم",
    icon: "🌌",
    badge: "مظهر داكن & خط هندسي",
    color:
      "border-purple-500/20 hover:border-purple-500 bg-purple-500/5 hover:bg-purple-500/10 text-purple-400",
  },
  {
    title: "الوثيقة العتيقة",
    desc: "خواطر كلاسيكية برائحة الحبر القديم",
    theme: "parchment",
    font: '"EB Garamond", serif',
    content: PARCHMENT_CONTENT,
    docTitle: "حبر وريشة: فلسفة الكتابة",
    icon: "📜",
    badge: "ورق معتق & خط أنيق",
    color:
      "border-amber-600/20 hover:border-amber-600 bg-amber-600/5 hover:bg-amber-600/10 text-amber-800",
  },
  {
    title: "طوكيو النيون",
    desc: "مستقبل تقني مشحون بطاقة السيبربانك",
    theme: "tokyo",
    font: '"JetBrains Mono", monospace',
    content: TOKYO_CONTENT,
    docTitle: "Tokyo Cyber Cores",
    icon: "🌆",
    badge: "مظهر مستقبلي & خط تقني",
    color:
      "border-pink-500/20 hover:border-pink-500 bg-pink-500/5 hover:bg-pink-500/10 text-pink-400",
  },
];

// ---------------------------------------------------------------------------
// Toolbar: format action items
// ---------------------------------------------------------------------------

export interface FormatToolbarItem {
  type: string;
  /** Display label. Omit for separator items (type: "sep"). */
  title?: string;
  icon?: ComponentType<{ className?: string }>;
  /** Format command name passed to handleFormat. */
  formatKey?: string;
  /** Key into activeFormats for highlight state. Defaults to formatKey. */
  activeKey?: string;
}

/**
 * Helper to create a regular format button item, deriving `activeKey` from
 * `formatKey` automatically.  Pass an explicit `activeKey` when the format
 * command name differs from the key used in `activeFormats` (e.g. quote →
 * blockquote).
 */
const fmt = (
  type: string,
  title: string,
  icon: ComponentType<{ className?: string }>,
  formatKey: string,
  activeKey?: string,
): FormatToolbarItem => ({
  type,
  title,
  icon,
  formatKey,
  activeKey: activeKey ?? formatKey,
});

export const FORMAT_TOOLBAR_ITEMS: FormatToolbarItem[] = [
  // Headings
  fmt("h1", "Heading 1", Heading1, "h1"),
  fmt("h2", "Heading 2", Heading2, "h2"),
  fmt("h3", "Heading 3", Heading3, "h3"),
  { type: "sep" },
  // Inline formatting
  fmt("bold", "Bold (Ctrl+B)", Bold, "bold"),
  fmt("italic", "Italic (Ctrl+I)", Italic, "italic"),
  fmt("underline", "Underline (Ctrl+U)", Underline, "underline"),
  fmt("strike", "Strikethrough", Strikethrough, "strike"),
  { type: "sep" },
  // Block formatting
  fmt("quote", "Quote", Quote, "quote", "blockquote"),
  fmt("bullet", "Bullet List", List, "bullet"),
  fmt("code", "Code", Code, "code"),
  fmt("tableify", "Convert to Table", Table, "tableify"),
  { type: "sep" },
  // Alignment
  fmt("alignLeft", "Align Left", AlignLeft, "alignLeft"),
  fmt("alignCenter", "Align Center", AlignCenter, "alignCenter"),
  fmt("alignRight", "Align Right", AlignRight, "alignRight"),
  fmt("alignJustify", "Justify", Layout, "alignJustify"),
  { type: "sep" },
  // Insertion
  { type: "link", title: "Link", icon: Link, formatKey: "link" },
  { type: "image", title: "Insert Image", icon: ImageIcon },
];
