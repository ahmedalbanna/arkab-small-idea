# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (Express + Vite HMR) on ports 3009 (API), 5175 (Vite) |
| `npm run build` | Build production bundle to `dist/` |
| `npm run preview` | Serve production build locally on port 4174 |
| `npm test` | Run full test suite (Vitest) |
| `npm run lint` | TypeScript type-check via `tsc --noEmit` and ESLint |
| `npm run format` | Format code with Prettier |
| `npm run clean` | Remove `dist/` directory |
| `npm run dev:vite` | Run Vite standalone on port 5175 (no Express) |
| `npm run dev:api` | Run Express server only, skip Vite (useful for API work) |

## Architecture Overview

**Ink & Quill** is an AI-powered markdown editor built on **React 19**, **ProseMirror**, and a **plugin system**. Every feature is a plugin that contributes schema nodes/marks, editor behaviors, UI components, and commands.

### Plugin System (Core Architecture)

The plugin system is the foundation. Each plugin (`src/plugins/<name>/index.ts`) exports an `InkPlugin` that conforms to `src/plugins/types.ts:InkPlugin`:

```typescript
export interface InkPlugin {
  id: string;                           // Unique ID
  name: string;
  version: string;
  enabled?: boolean;
  essential?: boolean;                   // Can't be toggled off
  dependencies?: string[];               // Must init after these
  getSchemaContribution?(): SchemaContribution;  // Schema nodes/marks
  init(ctx: PluginContext): void;        // Register UI, commands, overlays
  destroy?(): void;                      // Cleanup (idempotent)
}
```

**Key plugin methods:**
- `ctx.registerProsePlugin()` — Add ProseMirror plugins (keymaps, input rules, selections)
- `ctx.registerNodeView()` — Render custom React components inside the editor
- `ctx.registerCommand()` — Add commands with keyboard shortcuts, slash menu entries
- `ctx.registerToolbarItem()` — Add buttons to floating/mobile toolbars
- `ctx.registerOverlay()` — Add modals, panels, sidebars
- `ctx.registerSetting()` — Add user-facing settings
- `ctx.registerHost()` — Register a React component that runs plugin hooks/effects at app level

**Loading:** Plugins are registered in `src/plugins/index.ts:buildPluginModules()` and loaded via `PluginRegistry` in `src/plugins/registry.ts`. When any plugin's code changes in dev mode, `notifyPluginsChanged()` triggers a targeted editor rebuild (no full page reload).

### Key Files & Layers

| File/Path | Purpose |
|-----------|---------|
| `src/App.tsx` | Root component; wires stores, contexts, intent system, and plugins |
| `src/stores/` | Zustand stores (persisted via IndexedDB): `editorStore`, `uiStore`, `aiStore`, `aiUIStore`, `settingsStore` |
| `src/plugins/` | 20+ plugins (AI, search, math, tables, diagrams, collaboration, etc.) |
| `src/core/` | Headless editor operations (commands, shortcuts, storage, etc.) |
| `src/components/` | React UI: `ProseMirrorEditor`, toolbars, modals, overlays, editor containers |
| `src/services/` | AI providers (OpenAI, Anthropic, Gemini, Ollama), embeddings (Xenova), RAG |
| `src/lib/` | Utilities: `cn()` (Tailwind), `useMediaQuery()`, etc. |
| `src/index.css` | Tailwind base + global styles |
| `src/plugins/appContext.tsx` | Plugin host context: provides `EditorRef` and `AppApi` to overlay components |
| `src/plugins/editorCommandBus.ts` | Typed command dispatcher (single source of truth for editor actions) |
| `src/plugins/intents.ts` | Intent system: plugins emit intents (`showSearch`, `toggleAIAssistant`, etc.) that App.tsx translates to store mutations |

### Intent System (Plugin ↔ App Communication)

Plugins should **never import stores directly**. Instead, they emit intents:

```typescript
// In a plugin or command:
emitIntent({ type: 'showSearch' });
emitIntent({ type: 'runAIAction', actionId: 'improve' });

// App.tsx intercepts and updates stores:
case "showSearch":
  ui.setSearch(true);
  break;
```

See `src/plugins/intents.ts` for all intent types.

### Stores (Zustand + IndexedDB)

Each store persists to IndexedDB and is accessible from any plugin via `ctx.stores`:

- **`editorStore`** — Pages, content, active page ID, snapshots
- **`uiStore`** — Search visibility, AI assistant toggle, direction (RTL/LTR), modals, etc.
- **`aiStore`** — Chat messages, model/provider config, API keys, RAG indices
- **`aiUIStore`** — Command palette, shortcuts help, follow-up suggestions, etc.
- **`settingsStore`** — Theme, font size, max width, heading color, per-plugin toggles

Stores are initialized by hydrating from IndexedDB on app mount. Use `store.getState()` to read synchronously, or hooks (`useEditorStore()`) to subscribe.

## Adding a New Feature as a Plugin

1. **Create the plugin directory:**
   ```bash
   mkdir src/plugins/myfeature
   ```

2. **Implement `src/plugins/myfeature/index.ts`:**
   ```typescript
   import type { InkPlugin } from '../types';
   
   export const myPlugin: InkPlugin = {
     id: 'myfeature',
     name: 'My Feature',
     version: '1.0.0',
     getSchemaContribution() {
       return {
         nodes: {
           myNode: {
             content: 'inline*',
             group: 'block',
             parseDOM: [{ tag: 'my-node' }],
             toDOM() { return ['my-node', 0]; },
           },
         },
       };
     },
     init(ctx) {
       // Register commands
       ctx.registerCommand({
         id: 'myfeature.toggle',
         key: 'Mod-m',
         label: 'Toggle My Feature',
         run: (api) => {
           api.dispatch(/* editor transaction */);
         },
         slash: true, // Show in slash menu
       });
       
       // Register toolbar item
       ctx.registerToolbarItem({
         id: 'myfeature',
         icon: MyIcon,
         label: 'My Feature',
         onClick: (api) => { /* ... */ },
       });
       
       // Register an overlay
       ctx.registerOverlay({
         id: 'myfeature-panel',
         component: MyPanel,
         mount: 'panel',
       });
     },
     destroy() {
       // Cleanup timers, subscriptions, etc.
     },
   };
   ```

3. **Register in `src/plugins/index.ts`:**
   ```typescript
   import { myPlugin } from './myfeature';
   
   export function buildPluginModules(): InkPlugin[] {
     return [
       // ... existing plugins
       myPlugin,
     ];
   }
   ```

4. **Add tests in `src/test/`** (see test patterns below).

## Testing Patterns

The test suite is in `src/test/`. Run with `npm test` or `npm test -- <pattern>` for a subset.

**Key test utilities:**
- `src/test/helpers/` — Setup fixtures, mock plugins, create test editors
- `describe()`, `it()`, `expect()` (Vitest)
- `render()`, `screen`, `fireEvent` (Testing Library for React)

**Patterns:**
- **Plugin tests** — Use `createTestPlugin()` and `createTestEditor()` from helpers
- **Command tests** — Use `executeCommand()` from helpers to dispatch editor commands
- **Store tests** — Direct Zustand `act()` calls and subscriptions
- **Security tests** — Math XSS, SVG sanitization, API key persistence (see `security-*.test.ts`)

Example:
```typescript
import { describe, it, expect } from 'vitest';
import { createTestEditor } from '../helpers';

describe('My Feature', () => {
  it('toggles when command runs', () => {
    const { editor, api } = createTestEditor();
    expect(api.executeCommand('myfeature.toggle')).toBe(true);
  });
});
```

## Development Patterns

### Schema & Nodes

ProseMirror nodes/marks are defined in plugin `getSchemaContribution()`. Schema is built once at startup; adding nodes dynamically is not supported (requires editor rebuild).

### Editor API

Plugins interact with the editor through a stable `EditorAPI` interface (not the raw `EditorView`), defined in `src/plugins/types.ts:EditorAPI`. This allows the editor to be rebuilt without breaking plugins.

### Command Dispatch

Use the **CommandBus** for editor actions:

```typescript
ctx.commandBus.execute('editor.insertText', { text: '# Heading' });
```

(Not documented in detail here; see `src/plugins/editorCommandBus.ts` for all commands.)

### Node Views

Custom React components inside the editor are registered as `NodeViewRegistration`:

```typescript
ctx.registerNodeView({
  name: 'mynode',
  view: (node, view, getPos) => {
    // Return a ProseMirror NodeView (with a React root)
  },
});
```

### Overlays (Modals, Panels, Sidebars)

Register with `ctx.registerOverlay()`:

```typescript
ctx.registerOverlay({
  id: 'myfeature-settings',
  component: SettingsPanel,
  mount: 'panel', // or 'modal', 'sidebar', 'statusbar', 'overlay'
  show: () => useUIStore.getState().myFeatureOpen, // Optional visibility control
});
```

Component receives `{ pluginContext: PluginContext }` as props.

### Keyboard Shortcuts

- **In `EditorCommand`:** `key: 'Mod-b'` (Mod = Ctrl on Windows/Linux, Cmd on Mac)
- **Plugin-level:** `ctx.registerProsePlugin()` with a keymap
- See `src/constants.ts` for common shortcuts

### LaTeX & Diagrams

Math is rendered with KaTeX; diagrams (Mermaid, nomnoml, Vega-Lite) use their respective libraries. Both are ProseMirror nodes with custom node views.

### Real-Time Collaboration

The collab plugin uses **Yjs** for shared state and **y-prosemirror** for editor binding. See `src/plugins/collab/` for awareness, conflict resolution, and offline queuing.

### AI Features

- **Providers:** Ollama (local), OpenAI, Anthropic, Google Gemini, Xenova (embeddings only)
- **Services:** `src/services/aiService.ts` (chat/actions), `src/services/embedService.ts` (RAG)
- **Commands:** Inline actions (improve, grammar, expand, rewrite, summarize) via right-click or command palette
- **Chat:** Half-screen side panel with follow-up suggestions; streaming replies

## Deployment & Environment

**Environment Variables** (`.env.local`):
```
GEMINI_API_KEY=...      # Required for Google Gemini
OPENAI_API_KEY=...      # For OpenAI
ANTHROPIC_API_KEY=...   # For Anthropic
OLLAMA_HOST=...         # Local Ollama endpoint (default: http://localhost:11434)
OLLAMA_MODEL=...        # Default Ollama model (default: qwen2.5:0.5b)
```

**Build:** `npm run build` produces a PWA-ready bundle in `dist/`. The app works offline (once loaded) via IndexedDB and service workers (vite-plugin-pwa).

**API Proxy:** Dev server proxies `/api/*` to `http://localhost:3009` (Express). In production, the frontend is static; an Express/backend handles API routes if needed.

## Known Patterns & Conventions

- **File naming:** Component files are PascalCase (`.tsx`), utilities are camelCase (`.ts`)
- **Imports:** Use path aliases (`@core/`, `@devtools/`, `@/` for repo root)
- **Styling:** Tailwind CSS 4 + `clsx()` for conditionals, `cn()` from `src/lib/utils` merges Tailwind classes
- **Icons:** `lucide-react` (import as `IconName` from `lucide-react`)
- **Animations:** Framer Motion (`motion` package)
- **API calls:** Fetch-based, with Zod for validation (see `server.ts` for patterns)

## Debugging & DevTools

- **Dev Console:** Check browser console for plugin load messages
- **Redux DevTools:** If installed, the Zustand store is visible
- **Devtools Plugin:** `src/plugins/devtools/` provides command inspector, audit logging, and more
- **HMR:** Plugin changes hot-reload the editor without losing document state (in dev mode)

## Plugin Architecture & Add-ons (All Plugins Working)

Ink & Quill is built entirely on a **plugin system** — every feature is a modular add-on. The following 20 plugins are fully registered, loaded, and functional:

### Essential Plugins (Cannot Be Disabled)

| Plugin | ID | Version | What It Does |
|--------|----|---------| ------------|
| **Core Editor** | `core` | 1.0.0 | Base ProseMirror setup: history, keymaps, input rules, gap/drop cursors, table editing, paste handler, link preview, task toggles, priority cycling |
| **Document Lifecycle** | `document` | 1.0.0 | Auto-snapshots, RAG indexing, vector store initialization per document |
| **Collaboration** | `collab` | 3.0.0 | Yjs real-time sync, WebSocket transport, offline persistence, cursor awareness, multi-tab BroadcastChannel support |

### Content & Formatting Plugins (All Working)

| Plugin | ID | Version | Provides | Keyboard Shortcuts |
|--------|----|---------| -------- | ------------------|
| **Editor Commands** | `editorCommands` | 1.0.0 | 16 formatting commands: Bold, Italic, Underline, Strikethrough, Inline Code, Headings 1-3, Paragraph, Lists, Quotes, Text Alignment (4 variants) | Mod+B, Mod+I, Mod+U, Mod+E, etc. |
| **Tables** | `tables` | 1.0.0 | ProseMirror tables with row/column insertion/deletion. **Bonus:** Click header to sort (asc/desc), numeric-aware sorting, delete row actions | Click header to sort |
| **Images & Gallery** | `image` | 1.0.0 | Single image insertion and gallery groups with lightbox |  |
| **Math (KaTeX)** | `math` | 1.0.0 | LaTeX math rendering with `$...$` (inline) and `$$...$$` (display) | Auto via markdown syntax |
| **Diagrams** | `diagram` | 1.0.0 | Mermaid, nomnoml, and Vega-Lite visualization blocks | Markdown code fences with language tags |
| **Syntax Highlighting** | `highlight` | 1.0.0 | Code block syntax highlighting via highlight.js (40+ languages) |  |
| **Scribble** | `scribble` | 1.0.0 | Drawing/hand-writing canvas nodes (basic implementation) |  |

### Navigation & UI Plugins (All Working)

| Plugin | ID | Version | Provides |
|--------|----|---------| --------|
| **Search** | `search` | 1.0.0 | Full-text search: regex, case-sensitive, whole-word matching in active document |
| **Table of Contents** | `toc` | 1.0.0 | Auto-generated TOC from headings with auto-navigation |
| **Headings (Collapsible)** | `heading` | 1.0.0 | Fold/unfold sections by heading level; visual indicators |
| **Status Bar** | `status-bar` | 1.0.0 | Bottom info bar with word count, model selector, AI status |

### Editor Infrastructure Plugins

| Plugin | ID | Version | Purpose |
|--------|----|---------| ---------|
| **Editor UI** | `editorUI` | 1.0.0 | Aggregation wrapper coordinating multiple UI sub-systems |
| **Editor Menus** | `editorMenus` | 1.0.0 | Context menus, bubble menus, block menu with formatting options |
| **Editor Active Formats** | `editorActiveFormats` | 1.0.0 | Tracks active formatting state (H1/H2/bold/italic/etc.) for UI state |
| **Editor TTS Highlight** | `editorTTSHighlight` | 1.0.0 | Highlights text during text-to-speech playback (partial implementation) |

### AI & Search Plugins (Full Featured)

| Plugin | ID | Version | What It Provides |
|--------|----|---------| --------|
| **AI Assistant & Search** | `ai` | 1.0.0 | **Main AI features:** Chat interface, 4 providers (Ollama/OpenAI/Anthropic/Gemini), model switcher, 5 inline actions (improve/grammar/summarize/expand/rewrite), RAG semantic search, token monitoring, rate limiting, follow-up suggestions, image attachment, streaming responses with abort support |
| **AI Draft Highlight** | `draft` | 1.0.0 | Highlights AI-generated text with visual indicator (underline/background) |

### Developer & Debug Plugins

| Plugin | ID | Version | Purpose |
|--------|----|---------| ---------|
| **Developer Tools** | `devtools` | 1.0.0 | Command inspector, plugin audit logger, command bounds validation, action validation (dev-only) |

### Plugin Registration & Loading

All plugins are loaded in `src/plugins/index.ts:buildPluginModules()`. The order matters for dependencies but not for loading (PluginRegistry handles dependency resolution).

**Plugin Lifecycle:**
1. `getSchemaContribution()` — Runs first to contribute nodes/marks
2. `init(ctx)` — Runs after schema is built; registers commands, overlays, settings, etc.
3. `destroy()` — Called on plugin disable (must be idempotent)

**Hot Reload:** In dev mode, when any plugin's code changes, `notifyPluginsChanged()` triggers a targeted rebuild (no full page reload).

## Fully Working Features (Tested & Verified)

### Core Editor
- ✅ **Rich Markdown Editing** — Full ProseMirror editor with live preview
- ✅ **Multi-page Documents** — Create, rename, reorder pages with drag-and-drop
- ✅ **Snapshot History** — Automatic snapshots per document with versioning
- ✅ **Undo/Redo** — Full history support with keyboard shortcuts (Ctrl+Z / Cmd+Z)
- ✅ **Paste Handler** — Smart paste with Markdown, HTML, and DOCX support
- ✅ **Task Lists** — `[ ]` and `[x]` task item rendering with toggle functionality
- ✅ **Priority Badges** — `(H)` `(M)` `(L)` priority marking with cycle-click support

### Content Features
- ✅ **Markdown Syntax** — Headings, bold, italic, lists, blockquotes, code blocks
- ✅ **Tables** — Full ProseMirror table support with row/column insertion/deletion
- ✅ **Images & Gallery** — Single image insert and gallery groups
- ✅ **Math (LaTeX/KaTeX)** — Inline and display math with KaTeX rendering
- ✅ **Diagrams** — Mermaid, nomnoml, and Vega-Lite visualization support
- ✅ **Code Blocks** — Syntax highlighting with highlight.js (40+ languages)
- ✅ **Links** — Link insertion with preview on hover

### Search & Navigation
- ✅ **Full-Text Search** — Regex, case-sensitive, whole-word search in active document
- ✅ **Semantic Search** — Vector embedding search with Xenova Transformers
- ✅ **Table of Contents** — Auto-generated TOC from headings with navigation
- ✅ **Collapsible Headings** — Fold/unfold sections by heading level

### AI Features
- ✅ **Chat Interface** — Half-screen side panel with streaming replies
- ✅ **Multiple Providers** — Ollama (local), OpenAI, Anthropic, Google Gemini
- ✅ **Model Switcher** — Quick provider/model selection in header & status bar
- ✅ **Inline AI Actions** — Improve, fix grammar, summarize, expand, rewrite (5 actions)
- ✅ **RAG (Retrieval-Augmented Generation)** — Semantic indexing across all documents
- ✅ **Follow-up Suggestions** — Auto-generated suggestions after each AI reply
- ✅ **Personal Instructions** — Custom system prompt per user
- ✅ **Image Attachment in Chat** — Upload images to include in AI messages
- ✅ **Streaming Responses** — Real-time token streaming with abort support
- ✅ **Token Monitoring** — Tracks token usage per message and prevents overages
- ✅ **Rate Limiting** — Per-action and chat rate limits to avoid API abuse
- ✅ **Retry Logic** — Exponential backoff on transient failures

### Document Management
- ✅ **Import** — DOCX and HTML import with parsing
- ✅ **Export** — Markdown, HTML, DOCX, PDF, and RTF export formats
- ✅ **Word Count & Goals** — Tracks words per document and custom word count goals

### Real-Time Collaboration
- ✅ **Yjs Binding** — Real-time document sync with y-prosemirror
- ✅ **WebSocket Transport** — Remote collaboration via configurable WebSocket server
- ✅ **Offline Persistence** — y-indexeddb for offline editing + automatic sync
- ✅ **Remote Cursors** — Awareness protocol for live cursor/selection visibility
- ✅ **Connection Management** — Auto-reconnect, conflict resolution, offline queue
- ✅ **BroadcastChannel** — Multi-tab local collaboration (no server needed)
- ✅ **User Awareness** — Username, color, avatar, and online status

### UI & Theming
- ✅ **Dark/Light Modes** — Comprehensive dark/light themes + system preference detection
- ✅ **Custom Themes** — Andalusia, Cosmos, Parchment, Tokyo Night built-in themes
- ✅ **Typography Customization** — Font family, size, line height, max width per user
- ✅ **RTL/LTR Toggle** — Full right-to-left language support
- ✅ **Mobile Responsive** — Mobile-optimized toolbar, menu drawer, full mobile support
- ✅ **Floating Toolbar** — Context-aware toolbar on desktop
- ✅ **Command Palette** — Keyboard-driven command search (Mod+P)
- ✅ **Slash Menu** — Quick inline commands with `/` trigger
- ✅ **Settings Modal** — User-facing settings UI for all configurable options

### Plugin System
- ✅ **Hot Reload** — Dev-mode plugin code changes rebuild editor without losing state
- ✅ **Plugin Registry** — Dynamic plugin loading/unloading with dependency resolution
- ✅ **Plugin Cleanup** — Proper resource teardown on plugin disable (idempotent/re-entrant safe)
- ✅ **Schema Contribution** — Plugins can add nodes/marks to the editor schema
- ✅ **Command Registration** — Keyboard shortcuts, slash menu, command palette entries
- ✅ **Toolbar Items** — Plugin-contributed buttons with icons and click handlers
- ✅ **Overlays** — Modals, panels, sidebars, status bars, overlay portals
- ✅ **Settings UI** — Plugin-defined user preferences (toggles, selects, sliders, text)

### Data Persistence
- ✅ **IndexedDB Storage** — All editor/app state persisted locally (offline-first)
- ✅ **Zustand Hydration** — Automatic state restoration on app load
- ✅ **API Key Storage** — Secure local storage with XSS protection
- ✅ **Settings Persistence** — Theme, font, editor options, plugin toggles saved

### Developer Tools
- ✅ **Plugin Inspector** — DevTools command to audit plugin load order and state
- ✅ **Audit Logger** — Per-plugin lifecycle tracking and error reporting
- ✅ **Command Bounds Check** — Validation that commands don't exceed model limits
- ✅ **Action Validation** — Ensures AI actions are valid before dispatch
- ✅ **Command Test Utilities** — Helpers for testing plugin commands in isolation

### Security & Validation
- ✅ **XSS Protection** — Math (KaTeX) and SVG (diagrams) sanitization
- ✅ **API Key Isolation** — API keys not baked into production bundles (Vite define block)
- ✅ **Zod Validation** — Server-side request validation on all API routes
- ✅ **CORS Headers** — Proper cross-origin handling in Express

### Platform & Performance
- ✅ **PWA Ready** — Service worker, manifest, offline support via vite-plugin-pwa
- ✅ **HMR (Hot Module Replacement)** — Dev server HMR for instant feedback
- ✅ **Vite Build** — Fast production builds with code splitting
- ✅ **Stream Buffering** — Chunked NDJSON streaming for AI responses
- ✅ **Lazy Loading** — Dynamic imports for diagram libraries (mermaid, nomnoml, vega-lite)

## Known Limitations & Partial Features

### Limited Scope
- ⚠️ **TTS (Text-to-Speech)** — Plugin structure present but feature not fully implemented
- ⚠️ **Scribble/Drawing** — Plugin registered but minimal implementation
- ⚠️ **Collaboration Roles** — Role types defined but enforcement incomplete
- ⚠️ **Semantic Folders** — Mentioned in README but not implemented in current version

### In-Progress
- ⚠️ **Multi-Document RAG** — RAG service works but cross-document search may need optimization
- ⚠️ **Real-time Collab Edge Cases** — Offline queue and conflict resolution working but some race conditions possible

## UI Components & Hooks (All Working)

### Core React Components

#### Main Application Shell
| Component | Path | Purpose |
|-----------|------|---------|
| **App** | `src/App.tsx` | Root component; wires stores, contexts, intent system, plugin loading |
| **AppShell** | `src/components/layout/AppShell.tsx` | Top-level layout wrapper with theme/direction handling |
| **LayoutContext** | `src/components/layout/LayoutContext.tsx` | Portal context for modals, panels, overlays |

#### Editor Components
| Component | Path | Purpose |
|-----------|------|---------|
| **ProseMirrorEditor** | `src/components/ProseMirrorEditor.tsx` | Main editor instance with hooks orchestration |
| **EditorContainer** | `src/components/editor/EditorContainer.tsx` | Wraps multi-page editor tabs, loads plugins, manages lifecycle |
| **ActivePageEditor** | `src/components/editor/ActivePageEditor.tsx` | Single-page editor view with AI streaming, menus |
| **CommandPalette** | `src/components/editor/CommandPalette.tsx` | Keyboard-driven command search (Mod+P) |
| **SlashMenu** | `src/components/SlashMenu.tsx` | Inline `/` command trigger menu |

#### Navigation & Toolbars
| Component | Path | Purpose |
|-----------|------|---------|
| **FloatingToolbar** | `src/components/navigation/FloatingToolbar.tsx` | Desktop floating toolbar with plugin-contributed buttons |
| **MobileMenu** | `src/components/navigation/MobileMenu.tsx` | Mobile hamburger menu with navigation, settings, export |
| **BottomBar** | `src/components/layout/BottomBar.tsx` | Bottom status bar with word count, AI status, theme/plugin toggles |
| **AIFloatingToolbar** | `src/components/editor/AIFloatingToolbar.tsx` | Floating action menu for AI actions (improve, grammar, etc.) |

#### AI Components
| Component | Path | Purpose |
|-----------|------|---------|
| **AIAssistant** | `src/components/ai/AIAssistant.tsx` | Half-screen side panel with chat interface |
| **AssistantHeader** | `src/components/ai/AssistantHeader.tsx` | Chat header with close/minimize controls |
| **ChatThread** | `src/components/ai/ChatThread.tsx` | Message list with streaming support |
| **MessageBubble** | `src/components/ai/MessageBubble.tsx` | Individual message rendering with markdown support |
| **Composer** | `src/components/ai/Composer.tsx` | Chat input textarea with image attachment, template picker |
| **ModelSwitcher** | `src/components/ai/ModelSwitcher.tsx` | Dropdown to switch AI provider/model (Ollama/OpenAI/Anthropic/Gemini) |
| **ModelConfigBar** | `src/components/ai/ModelConfigBar.tsx` | Advanced provider settings (temperature, max tokens, API keys) |
| **AIProviderSettings** | `src/components/ai/AIProviderSettings.tsx` | Per-provider configuration UI |
| **TokenUsage** | `src/components/ai/TokenUsage.tsx` | Token counter with live tracking |
| **QuickActions** | `src/components/ai/QuickActions.tsx` | Quick button grid for AI actions (improve, grammar, etc.) |
| **EmptyState** | `src/components/ai/EmptyState.tsx` | Initial chat empty state with prompt templates |
| **SuggestedPrompts** | `src/components/ai/SuggestedPrompts.tsx` | Auto-generated follow-up suggestions after AI reply |

#### Overlay Components (Modals/Panels)
| Component | Path | Purpose |
|-----------|------|---------|
| **SearchBar** | `src/components/overlays/SearchBar.tsx` | Full-text + semantic search overlay (Mod+F) |
| **ExportDialog** | `src/components/overlays/ExportDialog.tsx` | Export to Markdown/HTML/DOCX/PDF/RTF |
| **ImportModal** | `src/components/overlays/ImportModal.tsx` | Import DOCX/HTML files |
| **SnapshotsMenu** | `src/components/overlays/SnapshotsMenu.tsx` | Document snapshot history with restore |
| **FileActionsMenu** | `src/components/overlays/FileActionsMenu.tsx` | Document create/rename/delete/duplicate |
| **ShortcutsHelp** | `src/components/overlays/ShortcutsHelp.tsx` | Keyboard shortcuts reference modal |
| **RegisteredOverlays** | `src/components/overlays/RegisteredOverlays.tsx` | Renders plugin-registered overlays dynamically |
| **RegisteredHosts** | `src/components/overlays/RegisteredHosts.tsx` | Renders plugin-registered host components |

#### Settings & Popovers
| Component | Path | Purpose |
|-----------|------|---------|
| **ThemePopover** | `src/components/layout/ThemePopover.tsx` | Theme selector (Light/Dark/System + 4 custom themes) |
| **FontSettingsPopover** | `src/components/layout/FontSettingsPopover.tsx` | Typography: font family, size, line height, max width |
| **PluginsPopover** | `src/components/layout/PluginsPopover.tsx` | Plugin enable/disable toggles with descriptions |
| **AISettingsPopover** | `src/components/ai/AISettingsPopover.tsx` | AI-specific settings (personal instructions, provider config) |

#### Layout & Portals
| Component | Path | Purpose |
|-----------|------|---------|
| **ModalSlot** | `src/components/layout/ModalSlot.tsx` | Portal container for modals |
| **PanelSlot** | `src/components/layout/PanelSlot.tsx` | Portal container for side panels |
| **OverlayPortal** | `src/components/layout/OverlayPortal.tsx` | Generic portal for overlays |

#### Utility Components
| Component | Path | Purpose |
|-----------|------|---------|
| **ErrorBoundary** | `src/components/ErrorBoundary.tsx` | Catches React errors and logs them |
| **TTSSpeaker** | `src/components/TTSSpeaker.tsx` | Text-to-speech player for document content |
| **Dialog** | `src/components/ui/Dialog.tsx` | Reusable dialog/modal primitive |

### Custom React Hooks

#### Editor Hooks (`src/components/editor/hooks/`)
| Hook | Signature | Purpose |
|------|-----------|---------|
| **useEditorView** | `(params: EditorViewParams): void` | Creates/destroys ProseMirror `EditorView` instance; manages DOM listeners |
| **useAIStreaming** | `(params: AIStreamingParams): void` | Handles AI action streaming (improve, grammar, expand, rewrite, summarize) with abort support |
| **usePluginLoader** | `(signal: AbortSignal): void` | Loads plugin registry; triggers on plugin code changes (hot reload) |
| **useMarkdownSync** | `(editorId, value, ...): void` | Syncs external markdown prop changes to editor state |
| **useMarkdownSerializer** | `(): (doc: Node) => string` | Serializes ProseMirror document to markdown |
| **useFormatting** | `(): { handleFormat: (type: string) => void, ... }` | Command dispatcher for text formatting (bold, italic, headings, etc.) |
| **useImperativeEditorApi** | `(viewRef, ...): EditorRef` | Exposes imperative API (`insertText`, `insertImage`, etc.) for parent refs |
| **useSearchSync** | `(viewRef, searchState, ...): void` | Syncs search state with editor highlights |

#### Library Hooks (`src/lib/`)
| Hook | Signature | Purpose |
|------|-----------|---------|
| **useMediaQuery** | `(query: string): boolean` | Detects media queries (e.g., `"(max-width: 768px)"` for mobile) |
| **useFocusTrap** | `(options): void` | Traps focus within a container; closes on Escape |

### State Management (Zustand Stores)

All stores persist to IndexedDB and are accessible via hooks:

| Store | Hook | State Keys |
|-------|------|-----------|
| **Editor Store** | `useEditorStore()` | `pages`, `activeFocusedPageId`, `snapshots`, `setPageContent()`, `addPage()`, `deletePage()`, `reorderPages()` |
| **UI Store** | `useUIStore()` | `searchVisible`, `aiAssistantOpen`, `direction`, `tts`, `quickCommands`, `setSearch()`, `setAIAssistant()`, `setDirection()` |
| **AI Store** | `useAIStore()` | `messages`, `provider`, `model`, `apiKeys`, `personalInstructions`, `ragIndex`, `setMessages()`, `setProvider()`, `addMessage()` |
| **AI UI Store** | `useAIUIStore()` | `commandPaletteOpen`, `slashMenu`, `contextMenu`, `shortcuts`, `setCommandPaletteOpen()`, `setSlashMenu()` |
| **Settings Store** | `useSettingsStore()` | `theme`, `fontSize`, `lineHeight`, `fontFamily`, `maxWidth`, `headingColor`, `disabledPlugins`, `setTheme()`, `setFontSize()` |

### Context Providers

| Context | File | Purpose |
|---------|------|---------|
| **LayoutContext** | `src/components/layout/LayoutContext.tsx` | Provides portal refs for modals/panels/overlays |
| **PluginProvider** | `src/plugins/appContext.tsx` | Provides plugin context (EditorRef, AppApi) to overlay components |
| **PluginRegistryProvider** | `src/plugins/registryContext.tsx` | Exposes plugin registry for UI inspection |
| **EditorCommandBusProvider** | `src/plugins/editorCommandContext.tsx` | Provides typed command dispatcher to components |

### Event Handlers & Callbacks

#### Editor Events
- `onChange` — ProseMirror document change
- `onLoaded(loadedPlugins)` — Fired after plugins are loaded
- `onImageUploadRequest()` — Triggered by image upload button

#### Keyboard Shortcuts (ProseMirror Keymaps)
- `Mod+Z` — Undo
- `Mod+Shift+Z` — Redo
- `Mod+B` — Bold
- `Mod+I` — Italic
- `Mod+U` — Underline
- `Mod+E` — Inline code
- `Mod+J` — Toggle AI assistant
- `Mod+F` — Toggle search
- `Mod+P` — Command palette
- `Mod+Shift+I` — AI: Improve
- `Mod+G` — AI: Grammar fix
- `Mod+S` — AI: Summarize
- `Mod+Shift+E` — AI: Expand
- `Mod+Shift+R` — AI: Rewrite
- `Escape` — Close overlays

#### AI Event Handlers
- `onChunk(chunk)` — Called on each streamed token
- `onDone(finalText)` — Called when stream completes
- `onError(error)` — Called on API failure

### Component Props Interfaces

#### EditorRef (Imperative API)
```typescript
interface EditorRef {
  insertText(text: string): void;
  insertImage(src: string, alt: string): void;
  insertGallery(srcs: string[]): void;
  setMarkdown(md: string): void;
  getMarkdown(): string;
  getView(): EditorView | null;
}
```

#### AppApi (Plugin Context)
```typescript
interface AppApi {
  getEditorRef(pageId?: string): EditorRef | null;
  getActivePageId(): string;
}
```

#### PluginContext (Available to All Plugins)
```typescript
interface PluginContext {
  editor: EditorAPI;
  commandBus: EditorCommandBus;
  stores: AppStores;
  emitIntent(intent: PluginIntent): void;
  schema: Schema;
  registerProsePlugin(plugin: Plugin | () => Plugin): void;
  registerNodeView(reg: NodeViewRegistration): void;
  registerCommand(cmd: EditorCommand): void;
  registerToolbarItem(item: ToolbarItem): void;
  registerOverlay(overlay: PluginOverlay): void;
  registerSetting(setting: PluginSettingDef): void;
  registerHost(host: ComponentType<any>): void;
}
```

## Server & Storage Infrastructure

### Backend Server (Express + Node.js)

**Entry Point:** `server.ts` (starts on port 3008 or 3009)

#### Core Server Features
- **Express.js** HTTP server with middleware stack
- **Vite dev server** integration (HMR for development)
- **WebSocket server** for real-time collaboration (on `/ws-collab`)
- **Graceful shutdown** with signal handling (SIGINT/SIGTERM)
- **Health check endpoint** at `/api/health`

#### Server Configuration
```typescript
const PORT = API_ONLY ? 3009 : 3008;      // 3008: Full server, 3009: API-only
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:0.5b";
```

#### Middleware Stack
| Middleware | Purpose | Enabled By |
|-----------|---------|-----------|
| **express.json()** | Parse JSON requests (10MB limit) | Always |
| **Rate Limiter** | Request throttling | `RATE_LIMIT_ENABLED=true` |
| **Auth Middleware** | API token validation | `AUTH_ENABLED=true` |
| **CORS** | Cross-origin headers (dev mode) | `API_ONLY` flag |
| **Vite Middleware** | Dev server HMR & reloading | Dev mode only |
| **Static File Server** | Serve production `dist/` | Production mode |

### API Endpoints

#### AI Endpoints (Ollama Local)
| Route | Method | Purpose | Input | Output |
|-------|--------|---------|-------|--------|
| `/api/ai/tags` | GET | List available Ollama models | — | `{ models: [...] }` |
| `/api/ai/chat` | POST | Chat completion (streaming) | `{ messages, model, stream }` | NDJSON stream |
| `/api/ai/generate` | POST | Text generation (streaming) | `{ prompt, system, model, stream }` | NDJSON stream |

#### Provider Proxy Endpoints (Optional, Require API Keys)
| Route | Provider | Requires | Status |
|-------|----------|----------|--------|
| `/api/proxy/openai/chat` | OpenAI | `OPENAI_API_KEY` | Enabled if key present |
| `/api/proxy/anthropic/messages` | Anthropic | `ANTHROPIC_API_KEY` | Enabled if key present |
| `/api/proxy/google/generateContent` | Google Gemini | `GOOGLE_API_KEY` | Enabled if key present |

#### Collaboration WebSocket
| Endpoint | Port | Protocol | Purpose |
|----------|------|----------|---------|
| `/ws-collab/:docId` | 3008 | WebSocket | Real-time doc sync via Yjs |

#### Health & Status
| Route | Method | Returns |
|-------|--------|---------|
| `/api/health` | GET | `{ status, uptime, collab: { rooms, clients, uptime, roomDetails } }` |

### Request/Response Streaming

**NDJSON (Newline-Delimited JSON) Format:**
- Used for streaming AI responses (tokens)
- Headers: `Content-Type: application/x-ndjson`, `Cache-Control: no-cache`
- Each chunk: `{ token: "...", finish_reason?: "stop" }`
- Client reads line-by-line for real-time display

**Flow:**
1. Client sends POST to `/api/ai/chat` or provider proxy
2. Server validates with Zod schema
3. Forward request to Ollama or upstream provider
4. Stream response back as NDJSON
5. Client reads chunks and renders incrementally

### Collaboration WebSocket Server

**File:** `server/collab-server.ts`

#### Protocol
Follows y-protocols specification with 6 message types:

| Type | ID | Direction | Purpose |
|------|----|-----------| ---------|
| **messageSync** | 0 | Both | Yjs document sync (3-step sync protocol) |
| **messageAwareness** | 1 | Both | User cursors, selections, presence |
| **messageAuth** | 2 | Server→Client | Auth response |
| **messageQueryAwareness** | 3 | Client→Server | Request full awareness state |
| **messagePing** | 4 | Client→Server | Latency probe |
| **messagePong** | 5 | Server→Client | Latency response |

#### Room Architecture
- Each room = one document (identified by path segment)
- Room holds Yjs `Y.Doc` + awareness state
- Per-client tracking: sync status, role, bandwidth
- Session info: username, color, avatar, joinedAt

#### Features
- ✅ **Multi-room support** — Rooms auto-create on first client join
- ✅ **In-memory persistence** — Docs stay in memory while clients connected
- ✅ **Offline queue** — Client buffers changes while disconnected
- ✅ **Awareness protocol** — Cursor/selection broadcasting
- ✅ **Session management** — Role-based (viewer/editor/admin)
- ✅ **Token auth** — Optional JWT via URL params
- ✅ **Health tracking** — Rooms, clients, bandwidth per client
- ✅ **Latency measurement** — Ping/pong for round-trip time

#### Configuration
```typescript
export interface CollabServerConfig {
  docUpdateInterval?: number;      // Doc save interval (if persistence enabled)
  gcInterval?: number;             // Garbage collection interval
  maxClientsPerRoom?: number;       // Max concurrent clients per room
  idleTimeout?: number;            // Disconnect idle clients
}
```

### Client-Side Storage (IndexedDB)

**File:** `src/lib/idbStorage.ts`

#### Database Structure
```typescript
const DB_NAME = "ink-quill-storage";
const STORE_NAME = "kv";            // Key-value object store
const DB_VERSION = 1;
```

#### Stored Data
All Zustand stores persist to IndexedDB:

| Key | Store | Content | Size |
|-----|-------|---------|------|
| `ink-quill-editor-storage-v2` | editorStore | Pages, content, snapshots | ~MB (per document) |
| `ink-quill-settings` | settingsStore | Theme, fonts, plugin toggles | ~KB |
| `ink-quill-ai-storage` | aiStore | Chat history, RAG index, settings | ~MB (per doc) |
| `ink-quill-ui-storage` | uiStore | UI state (visibility, modals) | ~KB |

#### Storage Features
- ✅ **Automatic persistence** — Zustand middleware writes on state change
- ✅ **Lazy loading** — Data only loaded on app mount (via `hydrate()`)
- ✅ **Legacy migration** — Transparently migrates old localStorage to IndexedDB
- ✅ **Quota management** — Graceful fallback to localStorage if quota exceeded
- ✅ **Offline-first** — All data available offline

#### Zustand Integration
```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { idbStorage } from "../lib/idbStorage";

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      pages: [],
      // ... actions
    }),
    {
      name: "ink-quill-editor-storage-v2",
      storage: idbStorage, // IndexedDB backend
    },
  ),
);
```

#### API
| Function | Signature | Purpose |
|----------|-----------|---------|
| **idbGet** | `(key: string): Promise<string \| null>` | Retrieve serialized store |
| **idbSet** | `(key: string, value: string): Promise<void>` | Persist serialized store |
| **idbRemove** | `(key: string): Promise<void>` | Delete store |
| **idbClear** | `(): Promise<void>` | Clear entire IndexedDB |

### Middleware

**Directory:** `server/middleware/`

#### Rate Limiting (`rateLimit.ts`)
```typescript
interface RateLimitConfig {
  maxRequests: number;         // Default: 60
  windowMs: number;            // Default: 60000 (1 minute)
}
```
- Tracks requests per IP address
- Rejects with 429 if quota exceeded
- Enabled via `RATE_LIMIT_ENABLED=true`

#### Authentication (`auth.ts`)
```typescript
interface AuthConfig {
  enabled: boolean;            // Default: false
}
```
- Validates Bearer token via header
- Supports JWT (configurable)
- Enabled via `AUTH_ENABLED=true`

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server endpoint |
| `OLLAMA_MODEL` | `qwen2.5:0.5b` | Default Ollama model |
| `OPENAI_API_KEY` | — | OpenAI proxy (optional) |
| `ANTHROPIC_API_KEY` | — | Anthropic proxy (optional) |
| `GOOGLE_API_KEY` | — | Google Gemini proxy (optional) |
| `RATE_LIMIT_ENABLED` | `false` | Enable request throttling |
| `RATE_LIMIT_MAX_REQUESTS` | `60` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `AUTH_ENABLED` | `false` | Enable API auth |
| `COLLAB_ENABLED` | `true` | Enable WebSocket collab |
| `NODE_ENV` | `development` | App environment |

### Error Handling

**Generic Error Message:**
```
"Upstream AI service error. Check server logs for details."
```
- Client receives generic message (no internal details leaked)
- Server logs full error to stdout
- Consistent error format: `{ error: string, status?: number }`

**Validation:**
- All request bodies validated with Zod before forwarding
- Invalid requests rejected with 400 + error message
- Streaming errors caught and logged

### Server Startup Flow

1. Load environment variables (`.env`)
2. Create Express app with middleware
3. Register API routes (AI, proxies, health)
4. Create HTTP server (port 3008 or 3009)
5. Create WebSocket collab server (if `COLLAB_ENABLED=true`)
6. Setup static file serving (production) or Vite HMR (dev)
7. Listen for connections
8. Setup graceful shutdown handlers

**Logs:**
```
[server] Rate limiting enabled
[server] API auth middleware enabled
[server] OpenAI proxy enabled
[server] Anthropic proxy enabled
[server] Google Gemini proxy enabled
[server] Collaboration server enabled at ws://0.0.0.0:3008/ws-collab
Server running on http://localhost:3008
Proxying AI requests to http://localhost:11434 using model qwen2.5:0.5b
```

## Common Gotchas

1. **Plugins don't auto-reload on schema changes** — If you add a node type, restart the dev server
2. **Store mutations must use `act()`** — Use `useEditorStore.setState()` or Zustand's `act()` wrapper in tests
3. **Intent system is one-way** — Plugins emit intents; App.tsx translates them. Don't call store setters from plugins
4. **Overlays receive `pluginContext` prop** — Access stores and APIs via context, not direct imports
5. **Editor refs are scoped** — Each page/document has its own `EditorRef`; get the active one via `appApi.getEditorRef()`
