import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import hljs from "highlight.js";
import { cn } from "../lib/utils";

const highlightKey = new PluginKey("highlight");

function getDecorations(doc: any) {
  const decorations: any[] = [];
  
  doc.descendants((node: any, pos: number) => {
    if (node.isText) {
      const text = node.text || "";
      
      // Task Priorities: (H), (M), (L)
      const priorityRegex = /\((H|M|L)\)/g;
      let match;
      while ((match = priorityRegex.exec(text)) !== null) {
        const priority = match[1];
        const start = pos + match.index;
        const end = start + match[0].length;
        
        let priorityClass = "";
        switch(priority) {
          case 'H': priorityClass = "task-priority-high"; break;
          case 'M': priorityClass = "task-priority-medium"; break;
          case 'L': priorityClass = "task-priority-low"; break;
        }
        
        decorations.push(Decoration.inline(start, end, { 
          class: cn("task-priority", priorityClass),
          "data-priority": priority 
        }));
      }

      // Checkboxes: [ ] and [x] at start of line or after bullet
      const checkboxRegex = /(^|(?<=\s))\[( |x)\](?=\s)/g;
      while ((match = checkboxRegex.exec(text)) !== null) {
        const checked = match[2] === 'x';
        const start = pos + match.index + (match[1] ? match[1].length : 0);
        const end = start + match[0].length - (match[1] ? match[1].length : 0);
        
        decorations.push(Decoration.inline(start, end, { 
          class: cn("task-checkbox", checked && "task-checkbox-checked"),
          "data-checked": checked ? "true" : "false"
        }));
      }
    }

    if (node.type.name === "code_block") {
      const lang = node.attrs.params || "";
      const text = node.textContent;
      let result;

      try {
        if (lang && hljs.getLanguage(lang)) {
          result = hljs.highlight(text, { language: lang });
        } else {
          result = hljs.highlightAuto(text);
        }
      } catch (e) {
        console.error("Highlighting error:", e);
        return;
      }

      if (result && result.value) {
        // More robust HTML to Decoration mapping
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(`<div>${result.value}</div>`, "text/html");
        const container = htmlDoc.body.firstChild;

        if (container) {
          let currentPos = pos + 1;
          
          const walk = (htmlNode: Node) => {
            if (htmlNode.nodeType === Node.TEXT_NODE) {
              currentPos += (htmlNode.textContent?.length || 0);
            } else if (htmlNode.nodeType === Node.ELEMENT_NODE) {
              const el = htmlNode as HTMLElement;
              const start = currentPos;
              el.childNodes.forEach(walk);
              const end = currentPos;
              
              if (el.className) {
                // hljs classes are like "hljs-keyword"
                decorations.push(Decoration.inline(start, end, { 
                  class: el.className 
                }));
              }
            }
          };

          container.childNodes.forEach(walk);
        }
        
        // Add meta decoration for language display
        decorations.push(Decoration.node(pos, pos + node.nodeSize, { 
          class: "hljs-container",
          "data-language": lang || (result as any).language || "auto"
        }));
      }
    }
  });

  // Sort decorations by start position as required by DecorationSet.create
  decorations.sort((a, b) => a.from - b.from);

  return DecorationSet.create(doc, decorations);
}

export const highlightPlugin = new Plugin({
  key: highlightKey,
  state: {
    init(_, { doc }) {
      return getDecorations(doc);
    },
    apply(tr, set) {
      if (!tr.docChanged) return set;
      return getDecorations(tr.doc);
    }
  },
  props: {
    decorations(state) {
      return this.getState(state);
    }
  }
});
