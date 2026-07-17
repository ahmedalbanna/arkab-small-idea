import { z } from "zod";

/** Accepts any callable (functions, class constructors, plain methods). */
const callable = z.custom((v) => typeof v === "function", {
  message: "must be callable",
});

/**
 * Accepts a React component. Plain function components pass the `typeof ===
 * "function"` check; `forwardRef`/`memo` components are objects carrying a
 * `$$typeof` marker, which the function check would wrongly reject.
 */
const reactComponent = z.custom(
  (v) =>
    typeof v === "function" ||
    (typeof v === "object" && v !== null && "$$typeof" in v),
  { message: "must be a React component" },
);

/**
 * Zod schemas mirroring the contribution types in `types.ts`. They are used at
 * registration time to (a) give plugin authors a precise, structured error when
 * they contribute a malformed command/toolbar item/overlay/setting/node view,
 * and (b) keep the host robust against a single bad plugin taking down the
 * whole editor startup.
 */
export const nodeViewRegistrationSchema = z.object({
  name: z.string().min(1),
  view: callable,
});

export const editorCommandSchema = z.object({
  id: z.string().min(1),
  key: z.string().optional(),
  label: z.string().optional(),
  run: callable,
  slash: z.boolean().optional(),
});

export const toolbarItemSchema = z.object({
  id: z.string().min(1),
  icon: reactComponent,
  label: z.string().min(1),
  group: z.string().optional(),
  order: z.number().optional(),
  onClick: callable,
  isActive: callable.optional(),
  show: callable.optional(),
});

export const pluginOverlaySchema = z.object({
  id: z.string().min(1),
  component: reactComponent,
  mount: z.enum(["panel", "modal", "sidebar", "statusbar", "overlay"]),
  show: callable.optional(),
});

export const pluginSettingSchema = z.object({
  pluginId: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["toggle", "select", "text", "number", "slider"]),
  defaultValue: z.unknown(),
  description: z.string().optional(),
  options: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .optional(),
  group: z.string().optional(),
});

export const schemaContributionSchema = z.object({
  nodes: z.record(z.string(), z.any()).optional(),
  marks: z.record(z.string(), z.any()).optional(),
  patchNodes: z.record(z.string(), z.any()).optional(),
  patchMarks: z.record(z.string(), z.any()).optional(),
});

/** Map Zod issues into a small, serializable shape for logs/sinks. */
export function formatIssues(
  issues: { path: PropertyKey[]; message: string }[],
): { path: string; message: string }[] {
  return issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}
