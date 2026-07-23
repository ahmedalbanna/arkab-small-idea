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
 * The "link" format is the only exception: the URL prompt (`window.prompt`) is a
 * UI concern that lives at this layer. The validated URL is passed as an attribute
 * on the bus command so the headless executor never touches the DOM.
 */
export function useFormatting({ viewRef }: FormattingParams) {
  const bus = useEditorCommandBus();

  const handleFormat = useCallback(
    (type: string) => {
      // Link format requires a URL prompt — purely a UI concern.
      if (type === "link") {
        const url = window.prompt("Enter URL:");
        if (url && validateUrl(url)) {
          bus.dispatch({ type: "format", format: "link", attrs: { href: url } });
        } else if (url) {
          window.alert("Invalid URL. Only http, https, and mailto links are allowed.");
        }
        viewRef.current?.focus();
        return;
      }

      bus.dispatch({ type: "format", format: type });
      viewRef.current?.focus();
    },
    [bus, viewRef],
  );

  return { handleFormat };
}
