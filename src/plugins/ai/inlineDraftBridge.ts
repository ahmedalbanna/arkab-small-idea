import type { AIAssistantAction } from "../../services/aiService";

/**
 * Bridge between the `ai` plugin's keymap (registered at the plugin level so it
 * is removed when the plugin is disabled) and the editor-shell inline AI draft
 * handler, which lives in `ProseMirrorEditor` because it is coupled to that
 * component's local `aiDraft` state. The editor registers its handler on mount.
 */
type InlineAiActionHandler = (action: AIAssistantAction) => void;

let handler: InlineAiActionHandler | null = null;

export function setInlineAiActionHandler(
  h: InlineAiActionHandler | null,
): void {
  handler = h;
}

export function runInlineAiAction(action: AIAssistantAction): void {
  handler?.(action);
}
