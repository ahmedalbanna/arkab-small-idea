import React, { useState } from "react";
import {
  Plus,
  X,
  Type,
  Maximize2 as FocusOn,
  Target,
  FileDown,
  ALargeSmall,
  ChevronsUpDown,
  Minus,
  Sparkles,
} from "lucide-react";
import { cn } from "../../lib/utils";
import ProseMirrorEditor, { EditorRef } from "../ProseMirrorEditor";
import { useEditorStore } from "../../stores/editorStore";
import { useUIStore } from "../../stores/uiStore";
import { useAIStore } from "../../stores/aiStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { AI_ACTIONS } from "../../constants";
import { SnapshotsMenu } from "../overlays/SnapshotsMenu";
import { FileActionsMenu } from "../overlays/FileActionsMenu";
import { motion, AnimatePresence, Reorder } from "motion/react";
import { ActivePageEditor } from "./ActivePageEditor";
import { Page } from "../../stores/editorStore";

interface EditorContainerProps {
  editorRefs: React.MutableRefObject<Record<string, EditorRef | null>>;
  handleKeyDown: (e: KeyboardEvent) => void;
  insertText: (before: string, after: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  applyContent: (
    content: string,
    method: "append" | "insert" | "replace" | "suggest",
  ) => void;
  handleAiAction: (actionId: string, customInstruction?: string) => Promise<void>;
  isSemantic: boolean;
  setMatchCount: (val: number) => void;
  findText: string;
  isCaseSensitive: boolean;
  isWholeWord: boolean;
  searchIndex: number;
  currentMatchIndex: number;
}

export const EditorContainer: React.FC<EditorContainerProps> = ({
  editorRefs,
  handleKeyDown,
  insertText,
  fileInputRef,
  applyContent,
  handleAiAction,
  isSemantic,
  setMatchCount,
  findText,
  isCaseSensitive,
  isWholeWord,
  searchIndex,
  currentMatchIndex,
}) => {
  const {
    pages,
    activePageIds,
    activeFocusedPageId,
    setPageContent,
    addPage,
    togglePageOpen,
    setActiveFocusedPageId,
    setPageSettings,
    setPageCursor,
    addSnapshot,
    reorderPages,
  } = useEditorStore();
  const {
    fontSize: globalFontSize,
    lineHeight: globalLineHeight,
    setTheme,
    setFontFamily,
    theme: globalTheme,
    enableHeadingNumbering
  } = useSettingsStore();
  const { direction, showSearch } = useUIStore();
  const {
    personalInstructions: aiPersonalInstructions,
    serviceConfigs,
    apiKeys,
    providerConfigs,
  } = useAIStore();
  const { setAIAssistant, setAutoSaving, isAutoSaving } = useUIStore();

  const [quoteIndex, setQuoteIndex] = useState(0);
  const [visibleSnapshots, setVisibleSnapshots] = useState<
    Record<string, boolean>
  >({});
  const [visibleFileActions, setVisibleFileActions] = useState<
    Record<string, boolean>
  >({});
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const autoSaveTimeout = React.useRef<NodeJS.Timeout | null>(null);

  const handleScroll = (id: string) => {
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    setAutoSaving(true);
    autoSaveTimeout.current = setTimeout(() => {
      setAutoSaving(false);
    }, 1500);
  };

  const toggleSnapshots = (pageId: string) => {
    setVisibleSnapshots((prev) => ({ ...prev, [pageId]: !prev[pageId] }));
  };

  const toggleFileActions = (pageId: string) => {
    setVisibleFileActions((prev) => ({ ...prev, [pageId]: !prev[pageId] }));
  };

  const sortedActivePageIds = [...activePageIds].sort((a, b) => {
    const indexA = pages.findIndex((p) => p.id === a);
    const indexB = pages.findIndex((p) => p.id === b);
    return indexA - indexB;
  });

  const activePages = sortedActivePageIds
    .map((id) => pages.find((p) => p.id === id))
    .filter(Boolean) as Page[];

  const handleReorderActivePages = (newActivePages: Page[]) => {
    const activeIndices = pages
      .map((p, idx) => (activePageIds.includes(p.id) ? idx : -1))
      .filter((idx) => idx !== -1);

    const newPages = [...pages];
    activeIndices.forEach((masterIdx, activeIdx) => {
      newPages[masterIdx] = newActivePages[activeIdx];
    });

    reorderPages(newPages);
  };

  return (
    <main
      className={cn(
        "flex-1 flex relative overflow-hidden bg-minimal-sidebar transition-all duration-1000 h-full",
        "pt-0",
      )}
    >
      {sortedActivePageIds.length === 0 ? (
        <div className="flex-1 overflow-y-auto p-6 md:p-16 flex flex-col items-center justify-center min-h-full custom-scrollbar bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-minimal-accent/5 via-transparent to-transparent select-none">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-full max-w-4xl text-center space-y-8 md:space-y-12"
          >
            {/* Calligraphic Floating Seal */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-minimal-border bg-minimal-sidebar/40 backdrop-blur-md shadow-sm animate-pulse">
                <span className="w-2 h-2 rounded-full bg-minimal-accent" />
                <span className="font-mono text-[9px] font-black uppercase tracking-widest text-minimal-muted">
                  Space Active • {globalTheme.toUpperCase()}
                </span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-minimal-text font-serif bg-gradient-to-r from-minimal-text via-minimal-accent to-minimal-text bg-clip-text text-transparent">
                حبرٌ وريشة <span className="font-sans font-light text-2xl md:text-3xl text-minimal-muted align-middle mx-2">|</span> Ink & Quill
              </h1>
              <p className="text-xs md:text-sm text-minimal-muted max-w-lg mx-auto leading-relaxed">
                صمّم فضاء كتابتك الفاخر، ودع سحر الكلمات يتدفق بلا حدود في واجهتك المخصصة للأدب والتفكير العالي.
              </p>
            </div>

            {/* Quote of the Day Section */}
            <motion.div 
              key={quoteIndex}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="relative max-w-xl mx-auto p-6 md:p-8 rounded-3xl border border-minimal-border/80 bg-minimal-bg/60 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all group/quote"
            >
              {/* Corner Accents represent luxury paper borders */}
              <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-minimal-accent/20 rounded-tl" />
              <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-minimal-accent/20 rounded-tr" />
              <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-minimal-accent/20 rounded-bl" />
              <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-minimal-accent/20 rounded-br" />

              <div className="space-y-4">
                <p className="text-lg md:text-2xl font-serif text-minimal-text leading-relaxed font-semibold italic text-center px-4" style={{ fontFamily: '"Amiri", serif' }}>
                  « {POETIC_QUOTES[quoteIndex].ar} »
                </p>
                <div className="w-12 h-px bg-minimal-accent/30 mx-auto" />
                <p className="text-[11px] font-sans text-minimal-muted tracking-tight leading-relaxed max-w-md mx-auto">
                  "{POETIC_QUOTES[quoteIndex].en}"
                </p>
                <p className="text-[9px] font-mono font-bold text-minimal-accent tracking-widest uppercase">
                  — {POETIC_QUOTES[quoteIndex].author}
                </p>
              </div>

              {/* Cycle Quote Trigger */}
              <button
                onClick={() => setQuoteIndex((prev) => (prev + 1) % POETIC_QUOTES.length)}
                className="absolute -bottom-3 right-6 px-3 py-1 bg-minimal-bg border border-minimal-border rounded-full text-[8px] font-bold text-minimal-muted hover:text-minimal-accent hover:border-minimal-accent/30 transition-all flex items-center gap-1.5 shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>مقولة أخرى (Next Quote)</span>
                <span className="text-[10px]">✨</span>
              </button>
            </motion.div>

            {/* Theme & Page Templates */}
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-xs font-bold text-minimal-muted uppercase tracking-widest">
                  شغّل فضاءً إبداعياً متكاملاً / Select Visual Workspace
                </h3>
                <p className="text-[9px] text-minimal-muted mt-1">
                  سيقوم النظام بإنشاء فصل جديد تلقائياً وتفعيل المظهر والخط المناسبين للنوع المحدد فوراً.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto px-4">
                {[
                  {
                    title: "الأندلس الأثري",
                    desc: "عراقة الأدب الموشّح والفردوس المفقود",
                    theme: "andalusia",
                    font: '"Amiri", serif',
                    content: ANDALUSIA_CONTENT,
                    docTitle: "الأندلس والفردوس المفقود",
                    icon: "🕌",
                    badge: "مظهر دافئ & خط كلاسيكي",
                    color: "border-emerald-500/20 hover:border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-800"
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
                    color: "border-purple-500/20 hover:border-purple-500 bg-purple-500/5 hover:bg-purple-500/10 text-purple-400"
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
                    color: "border-amber-600/20 hover:border-amber-600 bg-amber-600/5 hover:bg-amber-600/10 text-amber-800"
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
                    color: "border-pink-500/20 hover:border-pink-500 bg-pink-500/5 hover:bg-pink-500/10 text-pink-400"
                  }
                ].map((preset) => (
                  <button
                    key={preset.theme}
                    onClick={() => {
                      setTheme(preset.theme as any);
                      setFontFamily(preset.font);
                      addPage(preset.docTitle, preset.content);
                    }}
                    className={cn(
                      "flex flex-col p-5 rounded-3xl border text-right justify-between transition-all hover:scale-[1.03] active:scale-95 shadow-md hover:shadow-xl cursor-pointer h-52 group relative overflow-hidden bg-minimal-sidebar/60 border-minimal-border"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-minimal-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <div className="w-full">
                      <div className="flex justify-between items-start w-full mb-3">
                        <span className="text-[8px] bg-minimal-accent/10 text-minimal-accent px-2 py-0.5 rounded-full font-black uppercase tracking-tight">
                          {preset.theme.toUpperCase()}
                        </span>
                        <span className="text-2xl group-hover:scale-125 transition-transform duration-300">{preset.icon}</span>
                      </div>
                      <h4 className="text-[13px] font-black text-minimal-text leading-tight mb-1">
                        {preset.title}
                      </h4>
                      <p className="text-[10px] text-minimal-muted leading-snug">
                        {preset.desc}
                      </p>
                    </div>

                    <div className="w-full mt-4 pt-3 border-t border-minimal-border/40 flex items-center justify-between text-[8px] font-bold text-minimal-muted">
                      <span className="text-[8px] font-extrabold text-minimal-accent/80">
                        {preset.badge}
                      </span>
                      <span className="text-[11px] group-hover:translate-x-1 transition-transform">←</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Standard Quick Action buttons */}
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              <button
                onClick={() => addPage("New Chapter", "# New Chapter\n\n")}
                className="flex items-center gap-2 py-3 px-6 bg-minimal-accent hover:bg-minimal-accent/90 text-white rounded-2xl text-[10px] font-black tracking-widest shadow-lg shadow-minimal-accent/20 hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء مستند فارغ (ADD BLANK CHAPTER)</span>
              </button>
            </div>
          </motion.div>
        </div>
      ) : (
        <Reorder.Group
          axis="x"
          values={activePages}
          onReorder={handleReorderActivePages}
          className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory gap-4 md:gap-8 p-4 md:p-12 custom-scrollbar bg-minimal-sidebar/50 scroll-smooth h-full"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {activePages.map((page) => (
              <ActivePageEditor
                key={page.id}
                page={page}
                editorRefs={editorRefs}
                handleKeyDown={handleKeyDown}
                fileInputRef={fileInputRef}
                handleAiAction={handleAiAction}
                isSemantic={isSemantic}
                setMatchCount={setMatchCount}
                findText={findText}
                isCaseSensitive={isCaseSensitive}
                isWholeWord={isWholeWord}
                searchIndex={searchIndex}
                currentMatchIndex={currentMatchIndex}
              />
            ))}
          </AnimatePresence>

          <button
            onClick={() => addPage("New Chapter")}
            className="flex-shrink-0 w-64 h-full border-2 border-dashed border-minimal-border rounded-xl flex flex-col items-center justify-center gap-3 text-minimal-muted hover:border-minimal-accent/40 hover:text-minimal-accent hover:bg-minimal-sidebar transition-all group"
          >
            <div className="p-4 bg-minimal-sidebar rounded-full group-hover:rotate-180 transition-transform duration-500">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">
              New Chapter
            </span>
          </button>
        </Reorder.Group>
      )}
    </main>
  );
};

// ==========================================
// PRESETS & TEMPLATES FOR LUXURY DESK
// ==========================================

const POETIC_QUOTES = [
  {
    ar: "الخط هندسة روحانية ظهرت بآلة جسدانية",
    en: "Writing is a spiritual geometry, manifested through a physical tool.",
    author: "ياقوت المستعصمي"
  },
  {
    ar: "إن حبر القلم حبلٌ سري يربط بين روحين يفصل بينهما الدهر",
    en: "The ink of the pen is an umbilical cord connecting two souls across epochs.",
    author: "خليل جبران"
  },
  {
    ar: "الكتابة تنهض من عتمة الفكر لتنير دروب الحقيقة ببريق الكلمات",
    en: "Writing rises from the darkness of thought to illuminate the paths of truth with the glitter of words.",
    author: "أنيس منصور"
  },
  {
    ar: "الكلمة الجميلة كشجرة طيبة أصلها ثابت وفرعها في السماء",
    en: "A beautiful word is like a beautiful tree, its root is firm and its branches reach the sky.",
    author: "فلسفة الكلمة والأثر"
  }
];

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
