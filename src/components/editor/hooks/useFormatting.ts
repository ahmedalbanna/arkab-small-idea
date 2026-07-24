import { useCallback, type RefObject } from "react";
import type { EditorView } from "prosemirror-view";
import { validateUrl } from "../../../lib/utils";
import { useEditorCommandBus } from "../../../plugins/editorCommandContext";

interface FormattingParams {
  viewRef: RefObject<EditorView | null>;
}

/**
 * Returns `handleFormat`, the single entry point for toolbar / menu formatting
 * actions (marks, block types, alignment, list conversion, tableify, link).
 *
 * Every formatting action is routed through `bus.dispatch({ type: "format" })`
 * so the ProseMirror operation stays defined in one place (`core/operations/format.ts`)
 * and all mutations flow through the headless core, keeping the command bus as
 * the single entry-point for user-invoked commands (Bus-Centric architecture).
 *
 * The "link" format is handled here when called directly (e.g. context menu):
 * the URL prompt (`window.prompt`) is a UI concern at this layer. When attrs
 * are pre-populated (e.g. per-page toolbar with a prompt), they are forwarded
 * as-is.
 */
export function useFormatting({ viewRef }: FormattingParams) {
  const bus = useEditorCommandBus();

  const handleFormat = useCallback(
    (type: string, attrs?: Record<string, any>) => {
      // Link format without pre-populated attrs requires a URL prompt.
      if (type === "link" && !attrs?.href) {
        const url = window.prompt("Enter URL:");
        if (url && validateUrl(url)) {
          bus.dispatch(
            { type: "format", format: "link", attrs: { href: url } },
            { source: "user:toolbar" },
          );
        } else if (url) {
          window.alert("Invalid URL. Only http, https, and mailto links are allowed.");
        }
        viewRef.current?.focus();
        return;
      }

      bus.dispatch(
        { type: "format", format: type, ...(attrs ? { attrs } : {}) },
        { source: "user:toolbar" },
      );
      viewRef.current?.focus();
    },
    [bus, viewRef],
  );

  return { handleFormat };
}
