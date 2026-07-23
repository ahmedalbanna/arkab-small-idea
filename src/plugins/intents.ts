/**
 * Plugin Intent System
 *
 * Decouples plugins from direct UI store access. Instead of calling
 * `useAIUIStore.getState().setCommandPaletteOpen(true)` (which creates hidden
 * coupling between plugins and concrete store implementations), plugins emit
 * **intents** — declarative descriptions of what they want the shell to do.
 *
 * The app shell (e.g. App.tsx) registers a single handler via
 * `setIntentHandler` that maps each intent to the appropriate store mutation
 * or side-effect. This keeps plugins store-agnostic and makes them testable
 * with a mock handler.
 */

/**
 * Every UI intent a plugin may emit. New intents are added as the shell
 * evolves; a plugin emitting an unknown intent is silently ignored.
 */
export type PluginIntent =
  | { type: "showCommandPalette" }
  | { type: "hideCommandPalette" }
  | { type: "showSearch" }
  | { type: "hideSearch" }
  | { type: "toggleAIAssistant" }
  | { type: "showShortcuts" }
  | { type: "hideShortcuts" }
  | { type: "showTTS" }
  | { type: "hideTTS" }
  | { type: "showQuickCommands" }
  | { type: "hideQuickCommands" }
  /** Run an AI editing action (improve, fix-grammar, rewrite, etc.). */
  | { type: "runAIAction"; actionId: string; customInstruction?: string };

/** Function that processes a single intent. */
export type IntentHandler = (intent: PluginIntent) => void;

let intentHandler: IntentHandler | null = null;

/**
 * Register the shell's intent handler. The handler is the single place where
 * intents are translated into concrete store mutations / side effects. Pass
 * `null` to clear (e.g. on unmount).
 */
export function setIntentHandler(handler: IntentHandler | null): void {
  intentHandler = handler;
}

/**
 * Emit an intent. No-op until the shell registers a handler. Safe to call
 * before the shell is ready or after it has been torn down.
 */
export function emitIntent(intent: PluginIntent): void {
  intentHandler?.(intent);
}
