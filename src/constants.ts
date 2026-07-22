import {
  Wand2,
  FileText,
  RefreshCw,
  Maximize2,
  ListOrdered,
  PenTool,
  CheckCheck,
  FastForward,
  Heading,
  Minimize2,
} from "lucide-react";

export const AI_ACTIONS = [
  {
    id: "improve",
    label: "Improve",
    description: "Enhance clarity & impact",
    icon: Wand2,
    color: "text-blue-500",
    bg: "bg-blue-50",
  },
  {
    id: "summarize",
    label: "Summarize",
    description: "Key points only",
    icon: FileText,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
  },
  {
    id: "fix-grammar",
    label: "Fix Grammar",
    description: "Polish & correct",
    icon: CheckCheck,
    color: "text-cyan-500",
    bg: "bg-cyan-50",
  },
  {
    id: "rewrite",
    label: "Rewrite",
    description: "Better tone & flow",
    icon: RefreshCw,
    color: "text-purple-500",
    bg: "bg-purple-50",
  },
  {
    id: "expand",
    label: "Expand",
    description: "Add detail & depth",
    icon: Maximize2,
    color: "text-amber-500",
    bg: "bg-amber-50",
  },
  {
    id: "generate-outline",
    label: "Outline",
    description: "Document structure",
    icon: ListOrdered,
    color: "text-indigo-500",
    bg: "bg-indigo-50",
  },
  {
    id: "draft-topic",
    label: "Draft",
    description: "Write from topic",
    icon: PenTool,
    color: "text-pink-500",
    bg: "bg-pink-50",
  },
  {
    id: "complete-text",
    label: "Complete",
    description: "Finish your thought",
    icon: FastForward,
    color: "text-orange-500",
    bg: "bg-orange-50",
  },
  {
    id: "suggest-title",
    label: "Titles",
    description: "Creative suggestions",
    icon: Heading,
    color: "text-rose-500",
    bg: "bg-rose-50",
  },
  {
    id: "shorten",
    label: "Shorten",
    description: "Make it concise",
    icon: Minimize2,
    color: "text-slate-500",
    bg: "bg-slate-50",
  },
];

export const STATIC_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-3-5-sonnet-20240620", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
  google: ["gemini-3-flash-preview", "gemini-1.5-pro", "gemini-1.5-flash", "text-embedding-004"],
  pipeline: ["Xenova/all-MiniLM-L6-v2", "Xenova/distilbert-base-uncased-distilled-squad"],
};

export const DEFAULT_MARKDOWN = `Here is a detailed guide to **Conducting Gap Analysis (Feature comparison matrices)** written for a **Senior System Analyst & Requirements Engineer**. You will use gap analysis to compare current systems, vendor products, or as-is vs to-be states, and produce actionable requirements for closing the gaps.

## Conducting Gap Analysis (Feature comparison matrices)

As a **Senior System Analyst**, gap analysis is one of your most valuable tools for **bridging the present state to a desired future state**. Whether you are evaluating a commercial off-the-shelf (COTS) product, migrating from a legacy system, or comparing your solution against competitors, you will produce **feature comparison matrices** that drive investment decisions, requirement prioritization, and project scope.

This content covers:
- What gap analysis is (and isn't).
- Step-by-step process for conducting it.

### Feature Comparison Matrix

| Feature | System A (Current) | System B (To-Be) | Gap Status |
| :--- | :--- | :--- | :--- |
| **Real-time Collaboration** | No | Yes | Critical Gap |
| **Markdown Export** | Partial | Full | Minor Gap |
| **AI Writing Partner** | No | Yes | Strategic Gap |
| **Versioning** | Yes | Yes | No Gap |

Enjoy your writing journey with Ink & Quill!
`;
