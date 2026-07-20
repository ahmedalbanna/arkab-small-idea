/**
 * @deprecated
 *
 * The command bus now lives in the headless core at `@core/commands/commandBus`.
 * This file is a thin re-export shim kept only so existing imports
 * (`plugins/*`, `components/*`, `test/*`) continue to resolve. New code should
 * import directly from `@core/commands/commandBus`.
 */
export {
  EditorCommandBus,
  defaultEditorCommandBus,
} from "@core/commands/commandBus";
export type {
  EditorCommandAction,
  EditorCommandResult,
  EditorCommandExecutor,
} from "@core/commands/commandBus";
