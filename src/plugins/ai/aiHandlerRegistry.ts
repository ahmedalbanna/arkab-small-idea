/**
 * AI Action Handler Registry
 *
 * A simple module-level registry for editor-scoped AI action handlers.
 * Replaces the previous approach of storing handlers in `aiUIStore`,
 * which created direct coupling between the plugin and Zustand stores.
 *
 * Usage:
 *  - `useAIStreaming` (React hook) registers a handler per editor via `setHandler`
 *  - The `ai` plugin's keymap invokes the handler via `runAction`
 *
 * This module has NO imports from stores, making it portable and testable.
 */

export type AIScope = "sel" | "section" | "doc";

export type AIActionHandler = (action: string, customInstruction?: string, scope?: AIScope) => void;

const handlers = new Map<string, AIActionHandler | null>();

/**
 * Register (or unregister with `null`) the AI action handler for an editor.
 * Called from `useAIStreaming` on mount/unmount.
 */
export function setHandler(editorId: string, handler: AIActionHandler | null): void {
  handlers.set(editorId, handler);
}

/**
 * Look up the handler for a given editor id.
 */
export function getHandler(editorId: string): AIActionHandler | null {
  return handlers.get(editorId) ?? null;
}

/**
 * Run an AI action via the registered handler for the given editor.
 * Returns `true` if a handler was found and invoked, `false` otherwise.
 */
export function runAction(
  action: string,
  customInstruction?: string,
  editorId?: string,
  scope?: AIScope,
): boolean {
  if (!editorId) return false;
  const handler = handlers.get(editorId);
  if (!handler) return false;
  handler(action, customInstruction, scope);
  return true;
}

/**
 * Clear all registered handlers. Useful in tests or on full teardown.
 */
export function clearAllHandlers(): void {
  handlers.clear();
}

/**
 * Get the set of editor IDs that currently have handlers registered.
 */
export function getRegisteredEditorIds(): string[] {
  return Array.from(handlers.keys()).filter((id) => handlers.get(id) !== null);
}
