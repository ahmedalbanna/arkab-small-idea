<div align="center">
  <img src="public/icon.svg" width="80" height="80" alt="Ink & Quill logo" />
  <h1 align="center">حبرٌ وريشة | Ink &amp; Quill</h1>
  <p align="center">
    A premium AI-powered writing studio — crafted for creative minds.
    <br />
    محرّر نصوص فاخر مع مساعد ذكاء اصطناعي متكامل.
  </p>
</div>

---

## ✨ Features

### ✍️ Rich Markdown Editor
- Full-featured ProseMirror-based editor with live preview
- Multiple open documents (tabs with drag-to-reorder)
- Markdown shortcuts, headings, lists, tables, blockquotes
- Image gallery insertion, code blocks with syntax highlighting
- LaTeX math expressions (KaTeX) and diagram support (Mermaid, nomnoml, Vega-Lite)
- Snapshot history per document

### 🤖 AI Writing Assistant
- **Chat interface** with streaming replies — half-screen side panel
- **Multiple AI providers**: Ollama (local), OpenAI, Anthropic, Google Gemini, local Pipeline
- **Model switcher** in the header and status bar for quick provider/model changes
- **Inline actions**: improve, fix grammar, summarise, expand, rewrite
- **Semantic search** with RAG indexing across your documents
- **Personal instructions** to customise AI behaviour
- Image attachment in chat
- Follow-up suggestions after each reply

### 🔍 Smart Search
- Regex / case-sensitive / whole-word search across the active document
- **Semantic search** using local vector embeddings (Xenova Transformers)
- Results highlighted inline in the editor

### 📁 Document Management
- Create, rename, and organise multiple pages
- Drag-and-drop reorder
- Word count and goal tracking per document
- DOCX and HTML import/export
- Snapshot versioning

### 🎨 Visual Studio
- 6 themes: Light, Dark, System + Andalusia, Cosmos, Parchment, Tokyo Night
- Custom font family, size, line height, and max-width
- RTL / LTR direction toggle
- Floating toolbar, mobile-optimised toolbar
- Workspace placement panel

### 🧩 Plugin Architecture
- Extensible plugin system — register commands, overlays, settings, toolbar items
- Built-in plugins: AI, status bar, table of contents, diagrams, collab, scribble, heading numbering, images, search, math, and more
- Command palette for quick actions
- Slash menu (`/`) for inline commands

### 🔐 Additional
- PWA-ready — install as a standalone app
- Local-first — state persisted via IndexedDB
- Keyboard shortcuts (Mod+J for AI, Mod+F for search, etc.)
- Works offline (once loaded)

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19 + TypeScript |
| **Editor** | ProseMirror (model, view, state, commands, tables, markdown) |
| **AI / ML** | Ollama, Google Gemini API, Anthropic, OpenAI, Xenova Transformers |
| **State** | Zustand (persisted via IndexedDB) |
| **Styling** | Tailwind CSS 4 + `tailwind-merge` + `clsx` |
| **Animation** | Motion (Framer Motion) |
| **Build** | Vite + PWA |
| **Backend** | Express (dev proxy for Ollama) |
| **Testing** | Vitest + Testing Library |
| **Collaboration** | Yjs + y-prosemirror |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **npm** ≥ 9

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Copy `.env.local.example` to `.env.local` and set your API keys:

```env
GEMINI_API_KEY=your_gemini_api_key           # Required for Google Gemini
OPENAI_API_KEY=your_openai_api_key           # For OpenAI
ANTHROPIC_API_KEY=your_anthropic_api_key     # For Anthropic
OLLAMA_HOST=http://localhost:11434           # Default Ollama endpoint
OLLAMA_MODEL=qwen2.5:0.5b                   # Default Ollama model
```

> **Note:** Ollama is optional — the app works with cloud providers too.
> If running Ollama locally, ensure the Ollama service is running on the configured host.

### 3. Start development server
```bash
npm run dev
```
The app will be available at **http://localhost:3000**.

### 4. Build for production
```bash
npm run build
npm run preview    # Preview the production build
```

---

## 📁 Project Structure

```
src/
├── components/
│   ├── ai/                  # AI assistant UI (AIAssistant, ChatThread, Composer,
│   │                        # MessageBubble, ModelSwitcher, AssistantHeader…)
│   ├── editor/              # Editor container, page editors
│   ├── layout/              # StatusBar
│   ├── navigation/          # FloatingToolbar, MobileToolbar, MobileMenu,
│   │                        # WorkspacePlacement, TableOfContents
│   ├── overlays/            # SearchBar, SettingsModal, ImportModal,
│   │                        # ShortcutsHelp, RegisteredHosts, RegisteredOverlays
│   ├── ui/                  # Reusable UI primitives (Dialog, etc.)
│   └── ProseMirrorEditor.tsx # Core editor component
│
├── plugins/
│   ├── ai/                  # AI plugin (host + handlers + services)
│   ├── statusbar/           # Status bar plugin
│   ├── editorUI/            # Editor UI integration (menus, actions)
│   ├── editorCommands/      # Command palette entries
│   ├── search/              # Search & replace in-editor
│   ├── highlight/           # Syntax highlighter
│   ├── collab/              # Real-time collaboration
│   ├── diagram/             # Diagram renderer
│   ├── heading/             # Heading numbering
│   ├── image/               # Image support
│   ├── math/                # LaTeX math
│   ├── tables/              # Advanced tables
│   ├── scribble/            # Drawing / hand-writing
│   ├── draft/               # Draft mode
│   ├── toc/                 # Table of contents
│   └── …                    # More
│   ├── types.ts             # Plugin type definitions
│   └── index.ts             # Plugin loader
│
├── services/                # AI chat, embedding, RAG
├── stores/                  # Zustand stores (editor, ui, ai, settings, aiUI)
├── lib/                     # Utilities (cn, useMediaQuery…)
├── core/                    # Headless editor operations
├── test/                    # Test files
│
├── App.tsx                  # Root component
├── main.tsx                 # App entry point
└── index.css                # Tailwind base + global styles
```

---

## 🧩 Plugin Architecture

Ink & Quill is built on a lightweight plugin system. Each plugin can contribute:

- **Schema nodes / marks** — Extend the ProseMirror schema
- **ProseMirror plugins** — Add editor behaviour
- **Node views** — Render custom React components inside the editor
- **Toolbar items** — Buttons in the floating / mobile toolbar
- **Commands** — Keyboard shortcuts, slash commands, command palette entries
- **Overlays** — Panels, modals, and status bars
- **Settings** — User-configurable options per plugin
- **Hosts** — App-level hook components (side effects, intervals, subscriptions)

### Plugin registration example

```typescript
// src/plugins/ai/index.ts
export const aiPlugin: InkPlugin = {
  id: 'ai',
  name: 'AI Assistant',
  version: '1.0.0',
  init(ctx) {
    ctx.registerSlashCommand({ id: 'ai-ask', label: 'Ask AI', … });
    ctx.registerHotkey({ key: 'Mod-j', commandId: 'ai.toggle' });
    ctx.registerToolbarItem({ id: 'ai', icon: Sparkles, … });
    ctx.registerHost(AIHost);
  },
};
```

Plugins are loaded from `src/plugins/index.ts` and rendered via `<RegisteredHosts>` / `<RegisteredOverlays>` in `App.tsx`.

---

## 🤖 AI Features

### Providers
Switch between five AI providers via the **Model Switcher** in the chat header or the status bar:

| Provider | API Key | Notes |
|----------|---------|-------|
| **Ollama** | — | Local, free, requires Ollama server |
| **OpenAI** | `OPENAI_API_KEY` | GPT-4o, GPT-4o-mini, etc. |
| **Anthropic** | `ANTHROPIC_API_KEY` | Claude 3.5 Sonnet / Opus / Haiku |
| **Google** | `GEMINI_API_KEY` | Gemini models |
| **Pipeline** | — | Local via Xenova Transformers (embeddings only) |

### Chat
- Click the **Sparkles** icon in the floating toolbar to open the assistant
- The assistant slides in from the right side as a half-screen panel
- Type a message or pick a template from the empty-state grid
- The AI considers your active document's content and cursor context
- After each reply, suggested follow-ups appear

### Actions
- **Inline editing**: Select text → right-click → AI action (improve, fix grammar, summarise, expand, rewrite)
- **Slash menu**: Type `/` in the editor for quick AI commands
- **Command palette**: Press `Mod+P` or click the commands button

---

## 🧪 Testing

```bash
npm test            # Run all tests (Vitest)
npm run lint        # TypeScript type-check (tsc --noEmit)
```

The test suite is located in `src/test/`. It covers stores, plugins, the editor engine, diagram transforms, collaboration, and more.

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server (Express + Vite HMR) |
| `npm run build` | Build for production (Vite) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the full test suite |
| `npm run lint` | TypeScript type-check |
| `npm run clean` | Remove `dist/` |

---

## 🎨 Configuration

All app settings are persisted to IndexedDB. You can configure:

- **Theme**: Light, Dark, System, or 4 curated themes
- **Editor**: Font family, size, line height, max width
- **AI**: Provider, model, API keys, personal instructions
- **Plugins**: Toggle each plugin on/off via the settings modal

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | For Google AI | — | Google Gemini API key |
| `OPENAI_API_KEY` | For OpenAI | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | For Anthropic | — | Anthropic API key |
| `OLLAMA_HOST` | For Ollama | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | For Ollama | `qwen2.5:0.5b` | Default Ollama model |

---

## 🧰 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Mod+J` | Toggle AI assistant |
| `Mod+F` | Toggle search |
| `Mod+Shift+I` | Improve selection |
| `Mod+G` | Grammar fix |
| `Mod+P` | Command palette |
| `Mod+S` | Summarise selection |
| `Mod+Shift+E` | Expand selection |
| `Mod+Shift+R` | Rewrite selection |
| `Escape` | Close panels |

---

## 🤝 Contributing

This project follows a plugin-based architecture. To add a new feature:

1. Create a plugin directory under `src/plugins/<feature>`
2. Implement `InkPlugin` interface from `src/plugins/types.ts`
3. Register it in `src/plugins/index.ts`
4. Add tests in `src/test/`

Please run `npm run lint` and `npm test` before submitting changes.

---

## 📄 License

Apache 2.0 — see [LICENSE](LICENSE) for details.
