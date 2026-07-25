/**
 * PromptTemplates — Configurable prompt templates per AI action type.
 *
 * Provides:
 * - Default templates for every AIAssistantAction
 * - User-customizable system prompts (overridable via store)
 * - Context-aware prompt construction (doc structure, user preferences)
 * - Placeholder interpolation ({text}, {personalInstructions}, {customInstruction}, etc.)
 */

import type { AIAssistantAction } from "./providers/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromptTemplate {
  /** Matches AIAssistantAction. */
  id: AIAssistantAction;
  /** Human-readable label shown in the settings UI. */
  label: string;
  /** Short description of what this action does. */
  description: string;
  /** System prompt template with optional placeholders. */
  systemPrompt: string;
  /** User / action prompt template with `{text}` and optional `{customInstruction}`. */
  userPrompt: string;
  /** Whether the template is active. Disabled templates fall through to defaults. */
  enabled: boolean;
  /** Optional maximum output tokens for this action type. */
  maxOutputTokens?: number;
}

/** Placeholder values injected at rendering time. */
export interface TemplateContext {
  text: string;
  personalInstructions?: string;
  customInstruction?: string;
  documentTitle?: string;
  documentStructure?: string;
  cursorSection?: string;
}

/** Map of action → custom template overrides (only customized ones are stored). */
export type TemplateOverrides = Partial<Record<string, Partial<PromptTemplate>>>;

// ---------------------------------------------------------------------------
// Default templates
// ---------------------------------------------------------------------------

const DEFAULT_SYSTEM_PREFIX =
  "You are a precise writing assistant in Ink & Quill. You modify ONLY the text provided below.";

/**
 * Universal scope rules appended to every action prompt.
 * These prevent the AI from expanding beyond the selected text boundaries.
 */
const SCOPE_RULES = `
STRICT SCOPE CONSTRAINTS — These rules are MANDATORY:
1. Modify ONLY the exact text shown below.
2. Do NOT add, remove, or modify any text OUTSIDE the provided selection.
3. Do NOT create new paragraphs, sections, headings, or standalone content blocks.
4. Return ONLY the modified text — no explanations, no notes, no introductory phrases, no commentary.
5. Preserve the original length approximately — do not significantly expand or shrink unless the action explicitly requires it.
6. Maintain all original formatting (bold, italic, lists, headings) within the selection.
7. Do NOT reference or incorporate content from other parts of the document.`;

const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: "improve",
    label: "Improve Writing",
    description: "Enhance clarity, flow, and impact of selected text",
    systemPrompt: `${DEFAULT_SYSTEM_PREFIX} Improve the quality of the following text while keeping its meaning and general structure. Enhance clarity, flow, and impact. Keep the text within the same boundaries — do not expand or restructure beyond the selection.\n\n${SCOPE_RULES}\n{personalInstructionsSegment}`,
    userPrompt: "Improve ONLY this exact text (do not change anything outside it):\n\n{text}",
    enabled: true,
    maxOutputTokens: 2048,
  },
  {
    id: "fix-grammar",
    label: "Fix Grammar",
    description: "Fix grammar, spelling, and punctuation errors",
    systemPrompt: `${DEFAULT_SYSTEM_PREFIX} Fix grammar, spelling, and punctuation errors only. Do not restructure sentences or change word choice unless it fixes a grammatical error. Do not change the meaning.\n\n${SCOPE_RULES}\n{personalInstructionsSegment}`,
    userPrompt: "Fix grammar ONLY in this exact text:\n\n{text}",
    enabled: true,
    maxOutputTokens: 2048,
  },
  {
    id: "shorten",
    label: "Shorten",
    description: "Make text more concise while preserving key info",
    systemPrompt: `${DEFAULT_SYSTEM_PREFIX} Make the following text more concise without losing key information. Condense within the selection boundaries — do not remove content outside the provided text.\n\n${SCOPE_RULES}\n{personalInstructionsSegment}`,
    userPrompt: "Shorten ONLY this exact text:\n\n{text}",
    enabled: true,
    maxOutputTokens: 1024,
  },
  {
    id: "expand",
    label: "Expand",
    description: "Add detail, depth, and richer language",
    systemPrompt: `${DEFAULT_SYSTEM_PREFIX} Expand on the following text with relevant details and richer language. Expand ONLY within the boundaries of the provided text — add detail and depth, but do not create new standalone sections or paragraphs outside the selection.\n\n${SCOPE_RULES}\n{personalInstructionsSegment}`,
    userPrompt: "Expand ONLY this exact text (stay within selection boundaries):\n\n{text}",
    enabled: true,
    maxOutputTokens: 4096,
  },
  {
    id: "summarize",
    label: "Summarize",
    description: "Condense to key points or one-sentence summary",
    systemPrompt: `${DEFAULT_SYSTEM_PREFIX} Summarize the following text into a concise one-sentence description or a few key bullet points. Summarize ONLY the provided text — do not include content from outside the selection.\n\n${SCOPE_RULES}\n{personalInstructionsSegment}`,
    userPrompt: "Summarize ONLY this exact text:\n\n{text}",
    enabled: true,
    maxOutputTokens: 1024,
  },
  {
    id: "generate-outline",
    label: "Generate Outline",
    description: "Create a structural outline from text",
    systemPrompt: `${DEFAULT_SYSTEM_PREFIX} Generate a clear, high-level structural outline for the following text. Use Markdown headings and bullet points. Outline ONLY the provided text — do not add sections from elsewhere in the document.\n\n${SCOPE_RULES}\n{personalInstructionsSegment}`,
    userPrompt: "Generate an outline for ONLY this text:\n\n{text}",
    enabled: true,
    maxOutputTokens: 2048,
  },
  {
    id: "expand-outline",
    label: "Expand Outline",
    description: "Turn a Markdown outline into a full draft",
    systemPrompt: `${DEFAULT_SYSTEM_PREFIX} You are a master writer. Your task is to take a Markdown outline (headings and bullet points) and expand it into a full, detailed, and well-written draft. Use the outline structure as your guide but write in a natural, cohesive prose style. Maintain any existing Markdown formatting like bolding or italics if present in the outline. Expand ONLY the outline content provided.\n\n${SCOPE_RULES}\n{personalInstructionsSegment}`,
    userPrompt: "Convert this outline into a full draft (expand ONLY this content):\n\n{text}",
    enabled: true,
    maxOutputTokens: 4096,
  },
  {
    id: "draft-topic",
    label: "Draft Topic",
    description: "Write a detailed piece from a topic or snippet",
    systemPrompt: `${DEFAULT_SYSTEM_PREFIX} Take the following topic or snippet and draft a detailed, well-structured, and engaging piece of content around it. Draft content based ONLY on the provided text.\n\n${SCOPE_RULES}\n{personalInstructionsSegment}`,
    userPrompt: "Draft a piece about ONLY this topic:\n\n{text}",
    enabled: true,
    maxOutputTokens: 4096,
  },
  {
    id: "rewrite",
    label: "Rewrite",
    description: "Rewrite from scratch with better flow and clarity",
    systemPrompt: `${DEFAULT_SYSTEM_PREFIX} Rewrite the following text from scratch while preserving all key information and the core message. Focus on better flow, clearer phrasing, and more engaging language. The output must cover the same points as the input — no more, no less. Stay within the same scope and approximate length.\n\n${SCOPE_RULES}\n{personalInstructionsSegment}`,
    userPrompt: "Rewrite ONLY this exact text completely:\n\n{text}",
    enabled: true,
    maxOutputTokens: 4096,
  },
  {
    id: "suggest-title",
    label: "Suggest Titles",
    description: "Generate creative title suggestions",
    systemPrompt: `${DEFAULT_SYSTEM_PREFIX} Suggest three punchy and relevant titles for the following text. Return only the three titles as a list — no additional text, no explanations, no numbering prefixes.\n\n${SCOPE_RULES}\n{personalInstructionsSegment}`,
    userPrompt: "Suggest titles for ONLY this text:\n\n{text}",
    enabled: true,
    maxOutputTokens: 512,
  },
  {
    id: "complete-text",
    label: "Complete Text",
    description: "Continue writing in the same style",
    systemPrompt: `${DEFAULT_SYSTEM_PREFIX} You are a writing assistant. Based on the provided text context, continue the writing in the same style and tone. Provide a natural continuation of about 1-3 sentences. Do not repeat the input. Continue seamlessly from where the text ends — do not rewrite or modify the provided text itself.\n\n${SCOPE_RULES}\n{personalInstructionsSegment}`,
    userPrompt: "Continue this text (add 1-3 sentences after it):\n\n{text}",
    enabled: true,
    maxOutputTokens: 1024,
  },
];

// ---------------------------------------------------------------------------
// Template store (singleton)
// ---------------------------------------------------------------------------

const templateMap = new Map<string, PromptTemplate>();
for (const tpl of DEFAULT_TEMPLATES) {
  templateMap.set(tpl.id, tpl);
}

// ---------------------------------------------------------------------------
// Placeholder interpolation
// ---------------------------------------------------------------------------

/**
 * Replace `{placeholder}` tokens in a template string with values from context.
 * Unknown placeholders are left as-is.
 */
function fillPlaceholders(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in ctx) return ctx[key];
    return match; // leave unknown placeholders
  });
}

/**
 * Build the personal instructions segment for injection into system prompts.
 */
function buildInstructionsSegment(personalInstructions?: string): string {
  if (!personalInstructions?.trim()) return "";
  return `The user has specified these stylistic preferences: "${personalInstructions.trim()}". Please adhere to them while performing the action.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get all default templates (deep copy to avoid mutation).
 */
export function getDefaultTemplates(): PromptTemplate[] {
  return DEFAULT_TEMPLATES.map((t) => ({ ...t }));
}

/**
 * Get a template for a given action, applying any user customizations.
 *
 * @param id - Template / action identifier.
 * @param overrides - User customizations (partial overrides keyed by id).
 */
export function getTemplate(id: string, overrides?: TemplateOverrides): PromptTemplate | undefined {
  const base = templateMap.get(id);
  if (!base) return undefined;

  const userOverride = overrides?.[id];
  if (!userOverride) return { ...base };

  // Merge user overrides on top of the base template
  return {
    ...base,
    ...userOverride,
    systemPrompt: userOverride.systemPrompt ?? base.systemPrompt,
    userPrompt: userOverride.userPrompt ?? base.userPrompt,
    enabled: userOverride.enabled ?? base.enabled,
  };
}

/**
 * Build the full system prompt for an action by interpolating placeholders
 * and injecting context-aware document structure.
 *
 * @param id - Action identifier.
 * @param context - Values for placeholder substitution.
 * @param overrides - User template customizations.
 * @param documentContext - Full document text for structure extraction.
 */
export function buildSystemPrompt(
  id: string,
  context: TemplateContext,
  overrides?: TemplateOverrides,
  documentContext?: string,
): string {
  const template = getTemplate(id, overrides);
  if (!template || !template.enabled) return "";

  const instructionsSegment = buildInstructionsSegment(context.personalInstructions);

  const placeholderValues: Record<string, string> = {
    personalInstructionsSegment: instructionsSegment,
    personalInstructions: context.personalInstructions || "",
    customInstruction: context.customInstruction || "",
    documentTitle: context.documentTitle || "Untitled",
    documentStructure: context.documentStructure || "",
    cursorSection: context.cursorSection || "",
  };

  let system = fillPlaceholders(template.systemPrompt, placeholderValues);

  // Append custom instruction if provided and not already handled by placeholder
  if (context.customInstruction && !template.systemPrompt.includes("{customInstruction}")) {
    system += ` Additional user instruction for this action: "${context.customInstruction}".`;
  }

  // Inject document structure context for orientation (only if documentContext is large enough)
  if (documentContext && documentContext.length > 200) {
    const structure = extractStructure(documentContext);
    if (structure) {
      system += `\n\n### DOCUMENT STRUCTURE (for orientation only) ###\n${structure}`;
    }
  }

  return system;
}

/**
 * Build the user prompt for an action by interpolating placeholders.
 *
 * @param id - Action identifier.
 * @param context - Values for placeholder substitution.
 * @param overrides - User template customizations.
 */
export function buildUserPrompt(
  id: string,
  context: TemplateContext,
  overrides?: TemplateOverrides,
): string {
  const template = getTemplate(id, overrides);
  if (!template || !template.enabled) return context.text;

  const placeholderValues: Record<string, string> = {
    text: context.text,
    customInstruction: context.customInstruction || "",
    context: "", // used by "generate" template
  };

  return fillPlaceholders(template.userPrompt, placeholderValues);
}

// ---------------------------------------------------------------------------
// Document structure extraction
// ---------------------------------------------------------------------------

/**
 * Extract a lightweight structural overview (headings only) from a Markdown
 * document. This gives the model orientation without the full document text.
 */
function extractStructure(markdown: string): string {
  const lines = markdown.split("\n");
  const headings: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();
      headings.push(`${"  ".repeat(level - 1)}${"#".repeat(level)} ${title}`);
    }
  }

  if (headings.length === 0) return "";
  return headings.join("\n");
}

/**
 * Estimate the current section the cursor is in based on headings.
 */
export function getCursorSection(markdown: string, cursorPos: number): string {
  const lines = markdown.split("\n");
  let currentSection = "Introduction";
  let charCount = 0;

  for (const line of lines) {
    if (charCount > cursorPos) break;
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      currentSection = match[2].trim();
    }
    charCount += line.length + 1; // +1 for newline
  }

  return currentSection;
}
