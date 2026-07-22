import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import katex from "katex";

export const mathPluginKey = new PluginKey("mathPlugin");

export interface MathRange {
  start: number;
  end: number;
  math: string;
  isBlock: boolean;
}

export interface InteractiveParam {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  raw: string;
}

export function parseInteractiveParams(mathText: string): InteractiveParam[] {
  const params: InteractiveParam[] = [];
  // Match bracket expressions like [g:9.8:0:20:0.1] or [x:5:0:10]
  const regex = /\[([a-zA-Z0-9_\s]+):([0-9.-]+):([0-9.-]+):([0-9.-]+)(?::([0-9.-]+))?\]/g;
  let match;
  while ((match = regex.exec(mathText)) !== null) {
    params.push({
      name: match[1],
      value: parseFloat(match[2]),
      min: parseFloat(match[3]),
      max: parseFloat(match[4]),
      step: parseFloat(match[5] || "1"),
      raw: match[0],
    });
  }
  return params;
}

export function getKaTeXString(mathText: string, params: InteractiveParam[]): string {
  let result = mathText;
  for (const param of params) {
    // Replace with beautiful colored bold value in LaTeX compilation
    const replacement = `\\mathbf{${param.name} = \\color{#3498db}{${param.value}}}`;
    result = result.replace(param.raw, replacement);
  }
  return result;
}

export function getMathErrorRecommendation(errorMsg: string): string {
  if (errorMsg.includes("Double superscript")) {
    return "💡 Tip: Double superscript. Wrap exponents inside curly braces, e.g., e^{x^2} instead of e^x^2.";
  }
  if (errorMsg.includes("Expected '}'")) {
    return "💡 Tip: Missing closing brace. Ensure all opening '{' braces are balanced with a closing '}' brace.";
  }
  if (errorMsg.includes("Expected ']'")) {
    return "💡 Tip: Missing closing bracket. Ensure all opening '[' brackets are closed.";
  }
  if (errorMsg.includes("Undefined control sequence")) {
    const match = errorMsg.match(/Undefined control sequence:\s*(\\[a-zA-Z]+)/);
    const cmd = match ? match[1] : "";
    return `💡 Tip: Undefined command${cmd ? ` '${cmd}'` : ""}. Ensure you are using standard KaTeX symbols (e.g., \\lambda instead of \\lamba).`;
  }
  return "💡 Tip: Check your LaTeX syntax and ensure all brackets and braces are balanced.";
}

export function getMathRanges(text: string): MathRange[] {
  const ranges: MathRange[] = [];

  // 1. Find block math: $$([\s\S]+?)$$
  const blockRegex = /(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$/g;
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length,
      math: match[1].trim(),
      isBlock: true,
    });
  }

  // 2. Find inline math: $([^\$\n]+?)$
  const inlineRegex = /(?<!\\)\$(?!\s)([^$\n]+?)(?<!\s)(?<!\\)\$/g;
  while ((match = inlineRegex.exec(text)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;

    // Avoid overlap with block math ranges
    const overlaps = ranges.some(
      (r) => (start >= r.start && start < r.end) || (end > r.start && end <= r.end),
    );
    if (!overlaps) {
      ranges.push({
        start,
        end,
        math: match[1],
        isBlock: false,
      });
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
}

const symbols = [
  { label: "½ Frac", code: "\\frac{a}{b}" },
  { label: "√x Sqrt", code: "\\sqrt{x}" },
  { label: "∫ Integral", code: "\\int_{a}^{b} f(x) dx" },
  { label: "∑ Sum", code: "\\sum_{i=1}^{n} i" },
  { label: "λ Lambda", code: "\\lambda" },
  { label: "π Pi", code: "\\pi" },
  { label: "Δ Delta", code: "\\Delta" },
  { label: "∞ Inf", code: "\\infty" },
  { label: "→ Arrow", code: "\\to" },
];

export function buildMathDecorations(state: any): DecorationSet {
  const decorations: Decoration[] = [];
  const { doc, selection } = state;
  const { from, to } = selection;

  doc.descendants((node: any, pos: number) => {
    if (!node.isTextblock) return true;

    const text = node.textContent;
    const ranges = getMathRanges(text);

    for (const range of ranges) {
      const mathStart = pos + 1 + range.start;
      const mathEnd = pos + 1 + range.end;

      // Check if cursor is currently inside or touching the math block
      const isEditing =
        (from >= mathStart && from <= mathEnd) || (to >= mathStart && to <= mathEnd);

      if (isEditing) {
        // Highlight the math block being edited
        decorations.push(
          Decoration.inline(mathStart, mathEnd, {
            class:
              "math-editing bg-minimal-accent/10 text-minimal-accent font-mono px-1.5 py-0.5 rounded border border-minimal-accent/20 font-bold",
          }),
        );

        // Render an elegant inline live-updating preview widget directly adjacent!
        const previewWidget = (view: any) => {
          const dom = document.createElement("div");
          dom.className =
            "math-live-preview-bubble absolute mt-2 bg-minimal-bg border border-minimal-border rounded-xl shadow-2xl p-3 z-50 text-xs flex flex-col gap-2 w-72 backdrop-blur-md transition-all";
          dom.style.pointerEvents = "auto";

          // Title header
          const header = document.createElement("div");
          header.className =
            "flex items-center justify-between text-[9px] font-bold text-minimal-muted uppercase tracking-widest border-b border-minimal-border/30 pb-1.5 select-none";
          {
            const left = document.createElement("span");
            left.className = "flex items-center gap-1";
            const dot = document.createElement("span");
            dot.className = "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse";
            left.appendChild(dot);
            left.appendChild(document.createTextNode("Live Math Preview"));
            header.appendChild(left);
            const right = document.createElement("span");
            right.className = "text-minimal-accent font-mono text-[8px]";
            right.textContent = "ACTIVE";
            header.appendChild(right);
          }
          dom.appendChild(header);

          // Content render container
          const renderContainer = document.createElement("div");
          renderContainer.className =
            "py-2 px-1.5 flex justify-center items-center overflow-x-auto min-h-[2.5rem] bg-minimal-sidebar/40 rounded-lg border border-minimal-border/30";
          dom.appendChild(renderContainer);

          // Error container
          const errorContainer = document.createElement("div");
          errorContainer.className =
            "hidden text-[10px] text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 p-2 rounded-lg font-mono leading-tight flex flex-col gap-1";
          dom.appendChild(errorContainer);

          // Quick Symbols toolbar
          const symbolToolbar = document.createElement("div");
          symbolToolbar.className =
            "flex items-center gap-1 overflow-x-auto py-1 border-t border-minimal-border/30 mt-1 scrollbar-none";

          symbols.forEach((sym) => {
            const symBtn = document.createElement("button");
            symBtn.className =
              "px-1.5 py-0.5 bg-minimal-sidebar hover:bg-minimal-accent/10 hover:text-minimal-accent border border-minimal-border rounded text-[9px] font-semibold transition-all select-none cursor-pointer flex-shrink-0";
            symBtn.textContent = sym.label;
            symBtn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              const { state: viewState, dispatch } = view;
              const { from: cursorFrom } = viewState.selection;
              const tr = viewState.tr.insertText(sym.code, cursorFrom);
              dispatch(tr);
              view.focus();
            };
            symbolToolbar.appendChild(symBtn);
          });
          dom.appendChild(symbolToolbar);

          // Render KaTeX with rich suggestions and errors
          try {
            const cleanText = range.math.trim() || "\\quad";
            const params = parseInteractiveParams(cleanText);
            const compiledKatexStr = getKaTeXString(cleanText, params);

            katex.render(compiledKatexStr, renderContainer, {
              displayMode: false,
              throwOnError: true,
              trust: false,
            });
          } catch (e: unknown) {
            renderContainer.innerHTML =
              '<span class="text-minimal-muted/50 italic text-[11px]">Typing equation...</span>';

            const rawErrorMsg = (e instanceof Error ? e.message : String(e)) || "Parse error";
            const recommendation = getMathErrorRecommendation(rawErrorMsg);

            // Build error DOM with textContent to prevent XSS from user-controlled
            // error messages (e.g. malicious LaTeX that produces crafted parse errors).
            errorContainer.innerHTML = "";
            {
              const titleRow = document.createElement("div");
              titleRow.className = "font-bold flex items-center gap-1 text-[10px]";
              const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
              icon.setAttribute("width", "10");
              icon.setAttribute("height", "10");
              icon.setAttribute("viewBox", "0 0 24 24");
              icon.setAttribute("fill", "none");
              icon.setAttribute("stroke", "currentColor");
              icon.setAttribute("stroke-width", "2.5");
              const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
              circle.setAttribute("cx", "12");
              circle.setAttribute("cy", "12");
              circle.setAttribute("r", "10");
              icon.appendChild(circle);
              const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
              line1.setAttribute("x1", "12");
              line1.setAttribute("y1", "8");
              line1.setAttribute("x2", "12");
              line1.setAttribute("y2", "12");
              icon.appendChild(line1);
              const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
              line2.setAttribute("x1", "12");
              line2.setAttribute("y1", "16");
              line2.setAttribute("x2", "12.01");
              line2.setAttribute("y2", "16");
              icon.appendChild(line2);
              titleRow.appendChild(icon);
              titleRow.appendChild(document.createTextNode(" Error Feedback"));
              errorContainer.appendChild(titleRow);

              const msgRow = document.createElement("div");
              msgRow.className = "text-[9px] opacity-80";
              msgRow.textContent = rawErrorMsg.replace("KaTeX parse error: ", "");
              errorContainer.appendChild(msgRow);

              const recRow = document.createElement("div");
              recRow.className =
                "mt-1 text-emerald-600 dark:text-emerald-400 font-semibold font-sans";
              recRow.textContent = recommendation;
              errorContainer.appendChild(recRow);
            }
            errorContainer.classList.remove("hidden");
          }

          return dom;
        };

        decorations.push(
          Decoration.widget(mathEnd, previewWidget, {
            key: `math-preview-${mathEnd}`,
            stopEvent: () => true,
          }),
        );
      } else {
        // Hide raw LaTeX text
        decorations.push(
          Decoration.inline(mathStart, mathEnd, {
            style: "display: none;",
          }),
        );

        // Insert interactive widget
        const widget = (view: any, _getPos: () => number | undefined) => {
          const dom = document.createElement(range.isBlock ? "div" : "span");
          dom.className = range.isBlock
            ? "math-block-rendered my-4 py-2 flex flex-col justify-center items-center overflow-x-auto select-all cursor-pointer hover:bg-minimal-sidebar/40 rounded-xl transition-all border border-transparent hover:border-minimal-border"
            : "math-inline-rendered mx-1 px-1.5 py-0.5 rounded cursor-pointer select-all hover:bg-minimal-sidebar/40 transition-all inline-block align-middle border border-transparent hover:border-minimal-border";

          const mathRenderBox = document.createElement("div");
          mathRenderBox.className = "flex justify-center items-center w-full";
          dom.appendChild(mathRenderBox);

          const params = parseInteractiveParams(range.math);
          const katexStr = getKaTeXString(range.math, params);

          try {
            katex.render(katexStr, mathRenderBox, {
              displayMode: range.isBlock,
              throwOnError: false,
              trust: false,
            });
          } catch (e: unknown) {
            mathRenderBox.textContent = range.math;
            mathRenderBox.className +=
              " text-red-500 border border-red-200 bg-red-50 px-1.5 rounded text-xs";
            mathRenderBox.title = e instanceof Error ? e.message : "KaTeX rendering error";
          }

          // If there are slideable interactive parameters, render interactive controls panel!
          if (params.length > 0) {
            const controls = document.createElement("div");
            controls.className =
              "math-controls-panel mt-3 p-3 bg-minimal-sidebar rounded-xl border border-minimal-border flex flex-col gap-2.5 w-full max-w-[400px] mx-auto select-none pointer-events-auto shadow-sm";

            params.forEach((param) => {
              const row = document.createElement("div");
              row.className = "flex flex-col gap-1 text-[10px]";

              const labelRow = document.createElement("div");
              labelRow.className =
                "flex justify-between items-center font-bold text-minimal-muted uppercase tracking-wider";
              {
                const left = document.createElement("span");
                left.appendChild(document.createTextNode("Variable: "));
                const strong = document.createElement("strong");
                strong.className = "text-minimal-accent font-mono";
                strong.textContent = param.name;
                left.appendChild(strong);
                labelRow.appendChild(left);
                const right = document.createElement("span");
                right.className =
                  "font-mono text-[10px] text-minimal-accent bg-minimal-accent/10 border border-minimal-accent/20 px-1.5 py-0.5 rounded";
                right.textContent = param.value.toString();
                labelRow.appendChild(right);
              }
              row.appendChild(labelRow);

              const sliderContainer = document.createElement("div");
              sliderContainer.className = "flex items-center gap-3";

              const minLabel = document.createElement("span");
              minLabel.className = "text-minimal-muted font-mono text-[9px]";
              minLabel.textContent = param.min.toString();
              sliderContainer.appendChild(minLabel);

              const slider = document.createElement("input");
              slider.type = "range";
              slider.min = param.min.toString();
              slider.max = param.max.toString();
              slider.step = param.step.toString();
              slider.value = param.value.toString();
              slider.className =
                "flex-1 h-1 bg-minimal-border rounded-lg appearance-none cursor-pointer accent-minimal-accent focus:outline-none transition-all";

              slider.addEventListener("input", (event) => {
                const newVal = parseFloat((event.target as HTMLInputElement).value);
                // Replace the exact occurrences of that specific parameter inside raw math content
                const updatedMath = range.math.replace(
                  param.raw,
                  `[${param.name}:${newVal}:${param.min}:${param.max}${param.step !== 1 ? `:${param.step}` : ""}]`,
                );

                // Dispatch transaction to update the editor document cleanly
                const tr = view.state.tr.replaceWith(
                  mathStart,
                  mathEnd,
                  view.state.schema.text(range.isBlock ? `$$${updatedMath}$$` : `$${updatedMath}$`),
                );
                view.dispatch(tr);
              });

              sliderContainer.appendChild(slider);

              const maxLabel = document.createElement("span");
              maxLabel.className = "text-minimal-muted font-mono text-[9px]";
              maxLabel.textContent = param.max.toString();
              sliderContainer.appendChild(maxLabel);

              row.appendChild(sliderContainer);
              controls.appendChild(row);
            });

            dom.appendChild(controls);
          }

          // Double click or single click to edit raw math expression
          dom.addEventListener("mousedown", (e) => {
            // Check if clicking inside range sliders or controls panel
            if ((e.target as HTMLElement).closest(".math-controls-panel")) {
              return; // Allow native slider gestures and prevent placing cursor
            }

            e.preventDefault();
            e.stopPropagation();

            view.focus();

            const targetCursorPos = mathStart;
            const tr = view.state.tr.setSelection(
              view.state.selection.constructor.near(view.state.doc.resolve(targetCursorPos)),
            );
            view.dispatch(tr);
          });

          return dom;
        };

        decorations.push(
          Decoration.widget(mathStart, widget, {
            key: `math-${range.isBlock ? "block" : "inline"}-${mathStart}`,
            stopEvent: (event) => {
              // Allow slider interactions to pass through natively so mouse gestures work
              if ((event.target as HTMLElement).closest(".math-controls-panel")) {
                return false;
              }
              return true;
            },
          }),
        );
      }
    }
    return false;
  });

  return DecorationSet.create(doc, decorations);
}

export function createMathPlugin() {
  return new Plugin({
    key: mathPluginKey,
    state: {
      init(_, state) {
        return buildMathDecorations(state);
      },
      apply(tr, prev, oldState, newState) {
        if (tr.docChanged || !oldState.selection.eq(newState.selection)) {
          return buildMathDecorations(newState);
        }
        return prev;
      },
    },
    props: {
      decorations(state) {
        return mathPluginKey.getState(state);
      },
    },
  });
}
