Now I have a thorough understanding of the codebase. Let me create the comprehensive implementation plan.

---

# Implementation Plan: Ink & Quill — Collaborative Editing, AI Integration, Editor, Export, Real-time & AI Features

## Executive Summary

Ink & Quill is a mature, plugin-based collaborative document editor built with React 19, ProseMirror, Yjs, and Zustand. This plan addresses **six interconnected feature areas** that require both enhancements to existing infrastructure and new implementations. The codebase already has solid foundations in most areas, but several critical gaps need to be filled for production readiness.

---

## 1\. Requirements Analysis

### 1.1 Current State Assessment

### 1.2 Key Gaps Identified

**Collaborative Editing:**

* No WebSocket/WebRTC signaling server for remote collaboration
* No collaborative document persistence (Yjs state not saved across sessions)
* Awareness limited to local BroadcastChannel (no remote user presence)
* No connection management or reconnection logic
* No conflict resolution beyond Yjs CRDT core

**AI Integration:**

* No local rate limiting (relies entirely on provider limits)
* No token usage monitoring or budgeting dashboard
* Google Provider has incomplete AbortSignal support
* No API key rotation mechanism
* Server proxy only handles Ollama — no proxy for other providers

**ProseMirror Editor:**

* Input rules exist but need edge case coverage (nested lists, table edge cases)
* Paste handling partially implemented — needs validation/sanitization pipeline
* Schema contributions are dynamic but some plugin nodes lack complete parseDOM rules

**Document Export:**

* PDF export uses html2pdf.js (DOM-dependent, limited styling control)
* DOCX export has hardcoded image dimensions (600×400)
* SVG-to-PNG conversion may fail silently
* RTF export lacks table, image, and diagram support
* No export progress indication for large documents

**Real-time Collaboration:**

* No WebSocket server infrastructure
* No WebRTC peer-to-peer option
* No session management or room concept
* No collaborative cursor styling per user

**AI Features:**

* Prompt engineering is hardcoded in aiService.ts — no user customization of prompts per action
* Token estimation is rough (`ceil(text.length / 4)`)
* No token usage tracking across sessions
* Streaming error recovery is basic

### 1.3 Non-Functional Requirements

* **Performance**: Editor must remain responsive with 50+ concurrent collaborators
* **Offline**: Must work fully offline with local persistence, syncing when online
* **Security**: API keys memory-only (already implemented), no secrets in persistence
* **Bundle size**: Yjs + y-prosemirror already added; WebSocket server should be lightweight
* **Browser support**: Modern browsers (ES2020+), no IE11

---

## 2\. Proposed Approach & Design Decisions

### 2.1 Architecture Decisions

### 2.2 Design Principles

1. **Plugin-first**: All new features integrate through the existing plugin architecture
2. **Graceful degradation**: Collaboration works offline, AI falls back to local providers
3. **Security by default**: API keys never persisted, rate limiting enforced at multiple layers
4. **Minimal bundle impact**: Use dynamic imports for heavy features (WebRTC, export libraries)

---

## 3\. Files to Create or Modify

### 3.1 New Files

```
# Collaboration Server
server/collab-server.ts              # WebSocket collaboration server (y-websocket based)
server/collab-server.config.ts       # Server configuration (rooms, persistence, auth)

# Collaboration Plugin Enhancements
src/plugins/collab/websocket.ts      # WebSocket transport adapter
src/plugins/collab/webrtc.ts         # WebRTC transport adapter (dynamic import)
src/plugins/collab/persistence.ts    # y-indexeddb persistence layer
src/plugins/collab/connection.ts     # Connection manager (reconnect, status)
src/plugins/collab/CollabStatus.tsx  # Connection status UI component

# AI Enhancements
src/services/rateLimiter.ts          # Client-side token bucket rate limiter
src/services/tokenMonitor.ts         # Token usage tracking and budgeting
src/components/ai/TokenUsage.tsx     # Token usage display component
server/middleware/rateLimit.ts        # Server-side rate limiting middleware
server/middleware/auth.ts             # API key validation middleware

# Export Enhancements
src/services/export/pdfExport.ts     # Improved PDF export (browser print-based)
src/services/export/docxExport.ts    # Refactored DOCX export with quality improvements
src/services/export/exportUtils.ts   # Shared export utilities (image processing, etc.)
src/components/export/ExportDialog.tsx # Export progress and format selection UI

# Editor Enhancements
src/plugins/editor/pasteHandler.ts   # Enhanced paste handling with sanitization
src/plugins/editor/inputRules.ts     # Comprehensive input rules collection

# Tests
src/test/collab-websocket.test.ts
src/test/collab-persistence.test.ts
src/test/rateLimiter.test.ts
src/test/tokenMonitor.test.ts
src/test/export-quality.test.ts
src/test/pasteHandler.test.ts
src/test/ai-streaming.test.ts
```

### 3.2 Files to Modify

```
# Core Collaboration
src/plugins/collab/index.ts          # Add WebSocket/WebRTC transport options, persistence
src/plugins/collab/types.ts          # Extend CollabConfig with transport options

# AI Integration
src/services/aiService.ts            # Add rate limiting, token monitoring hooks
src/services/providers/google.ts     # Fix AbortSignal support
src/services/providers/openai.ts     # Add proper streaming abort
src/services/providers/anthropic.ts  # Add proper streaming abort, configurable max_tokens
src/stores/aiStore.ts                # Add tokenUsage, rateLimitState
server.ts                            # Add rate limiting middleware, expand proxy routes

# Editor
src/plugins/editor/schema.ts         # Enhance schema for better export/paste support
src/core/CoreEditor.ts               # Add export helpers

# Export
src/services/exportService.ts        # Refactor into modular export modules
src/components/ai/AIHost.tsx         # Add abort signal propagation

# Plugin System
src/plugins/types.ts                 # Extend InkPlugin interface if needed
src/plugins/index.ts                 # Register new plugins
```

---

## 4\. Step-by-Step Implementation Order

### Phase 1: Foundation & Infrastructure (Week 1-2)

**Step 1.1: Collaboration WebSocket Server**

1. Create `server/collab-server.ts` using `y-websocket` library
2. Implement room-based document management
3. Add awareness state broadcasting
4. Configure persistence (in-memory with optional Leveldb)
5. Add health check endpoints
6. Create `server/collab-server.config.ts` for environment configuration

**Step 1.2: Client-Side Transport Layer**

1. Create `src/plugins/collab/websocket.ts` — WebSocket transport adapter wrapping `y-websocket`
2. Create `src/plugins/collab/connection.ts` — Connection manager with reconnection logic (exponential backoff, max retries)
3. Create `src/plugins/collab/CollabStatus.tsx` — Status indicator component (connected/disconnected/reconnecting)
4. Extend `CollabConfig` in `src/plugins/collab/types.ts` with transport options (`websocket`, `webrtc`, `broadcast`)

**Step 1.3: Rate Limiting Infrastructure**

1. Create `src/services/rateLimiter.ts` — Token bucket implementation
2. Create `server/middleware/rateLimit.ts` — Express rate limiting middleware
3. Create `server/middleware/auth.ts` — API key validation for server-side proxy
4. Integrate rate limiter into `aiService.ts` calls

### Phase 2: Collaboration Enhancements (Week 2-3)

**Step 2.1: Refactor Collab Plugin**

1. Modify `src/plugins/collab/index.ts`:
   * Accept transport configuration (`websocket` | `webrtc` | `broadcast`)
   * Initialize appropriate transport based on config
   * Wire connection status to CollabStatus component
   * Handle transport switching (e.g., WebSocket → BroadcastChannel when offline)
2. Add connection lifecycle events (onConnect, onDisconnect, onSync)

**Step 2.2: Persistence Layer**

1. Create `src/plugins/collab/persistence.ts`:
   * Implement `y-indexeddb` integration for offline document persistence
   * Handle document state save/load on connect/disconnect
   * Implement garbage collection for old document versions
2. Modify collab plugin init to load persisted state before connecting to server

**Step 2.3: Awareness Enhancements**

1. Extend awareness state with: user avatar, cursor position metadata, selection range, user color (per-user)
2. Add collaborative cursor rendering with user names/colors
3. Implement presence indicators (online users list)

**Step 2.4: Conflict Resolution & Offline**

1. Yjs handles CRDT conflict resolution automatically — document and test this
2. Implement offline queue: buffer local changes when disconnected, apply on reconnect
3. Add document version merge on reconnection

### Phase 3: AI Integration Hardening (Week 3-4)

**Step 3.1: Token Monitoring**

1. Create `src/services/tokenMonitor.ts`:
   * Track tokens per request (prompt + completion)
   * Maintain running totals per session
   * Configurable budget limits per action type
   * Persist usage stats in IndexedDB (not API keys)
2. Create `src/components/ai/TokenUsage.tsx` — Usage dashboard component
3. Integrate into `aiStore.ts` as `tokenUsage` state

**Step 3.2: Provider AbortSignal Fixes**

1. Fix `GoogleProvider` to properly propagate AbortSignal through `requestOptions`
2. Add AbortController to all streaming operations in `OpenAIProvider` and `AnthropicProvider`
3. Ensure `AIHost.tsx` properly wires AbortController lifecycle to component unmount
4. Add timeout-based abort (configurable per provider)

**Step 3.3: Enhanced Error Handling**

1. Add retry logic with exponential backoff for transient errors (429, 503)
2. Implement circuit breaker pattern for failing providers
3. Add structured error types (not just string messages)
4. Surface provider-specific errors (rate limit, invalid key, model not found)

**Step 3.4: Server Proxy Expansion**

1. Extend `server.ts` to proxy requests for all providers (not just Ollama)
2. Add request validation middleware using Zod schemas
3. Add server-side rate limiting per API key
4. Implement response streaming for all providers through proxy

### Phase 4: Editor & Export Quality (Week 4-5)

**Step 4.1: Enhanced Paste Handling**

1. Create `src/plugins/editor/pasteHandler.ts`:
   * Sanitize pasted HTML using DOMPurify (already in deps)
   * Handle paste from Word/Google Docs (normalize proprietary markup)
   * Preserve formatting attributes (alignment, colors, fonts)
   * Handle image paste (convert to data URLs or upload)
   * Handle markdown paste detection
2. Register as ProseMirror plugin via collab/core plugin

**Step 4.2: Comprehensive Input Rules**

1. Create `src/plugins/editor/inputRules.ts`:
   * Task list input rules (`[ ]` and `[x]`)
   * Table creation shortcuts
   * Mermaid/diagram code block shortcuts
   * Math block shortcuts (`$$`)
   * Horizontal rule shortcuts (`---`, `***`, `___`)
2. Ensure all input rules work with Yjs collaboration

**Step 4.3: Export Quality Improvements**

1. Refactor `src/services/exportService.ts` into modular files:
   * `pdfExport.ts` — Use browser print API for high-fidelity PDF
   * `docxExport.ts` — Improve DOCX: dynamic image sizing, proper table borders, footnote support
   * `exportUtils.ts` — Shared image processing, SVG conversion
2. Add export progress indication (EventEmitter or callback pattern)
3. Fix hardcoded image dimensions in DOCX export
4. Add diagram-to-image conversion error handling (graceful fallback to code block)

**Step 4.4: Export Dialog**

1. Create `src/components/export/ExportDialog.tsx`:
   * Format selection (PDF, DOCX, HTML, Markdown, RTF)
   * Export options (page size, margins, include images, include diagrams)
   * Progress indicator
   * Error reporting

### Phase 5: Real-time Features Polish (Week 5-6)

**Step 5.1: WebSocket Connection Management**

1. Implement connection state machine (disconnected → connecting → connected → reconnecting)
2. Add heartbeat/ping mechanism for connection health
3. Implement exponential backoff reconnection (1s, 2s, 4s, 8s, max 30s)
4. Add connection quality indicators (latency, bandwidth)

**Step 5.2: Session Management**

1. Add room/session concept: users join a named room for a document
2. Implement user authentication for collaboration (optional, via token)
3. Add collaborator list with roles (viewer/editor/admin)
4. Add invite link generation

**Step 5.3: Collaborative Features**

1. Implement collaborative selection highlighting
2. Add "who's editing what" section indicators
3. Add typing indicators
4. Implement undo/redo per-user (y-undo-plugin already handles this)

### Phase 6: AI Features Enhancement (Week 6-7)

**Step 6.1: Prompt Engineering System**

1. Create `src/services/promptTemplates.ts`:
   * Configurable prompt templates per action type
   * User-customizable system prompts
   * Context-aware prompt construction (document structure, user preferences)
2. Add prompt template editor in settings

**Step 6.2: Streaming Response Improvements**

1. Add streaming response buffering (batch chunks for smoother UI updates)
2. Implement streaming cancellation with partial response handling
3. Add streaming progress estimation (based on token count)
4. Handle streaming errors mid-response (retry from last complete chunk)

**Step 6.3: Token Management**

1. Implement per-model token limits (configurable in settings)
2. Add automatic text truncation when approaching limits
3. Add token count display in AI action UI
4. Implement context window management for RAG

---

## 5\. Potential Risks and Edge Cases

### 5.1 Collaboration Risks

### 5.2 AI Integration Risks

### 5.3 Export Risks

### 5.4 Editor Risks

### 5.5 Edge Cases to Test

 1. **Offline→Online transition**: Make edits offline, reconnect, verify sync
 2. **Multiple simultaneous AI requests**: Verify rate limiting and queue management
 3. **Export of document with embedded diagrams**: Verify all formats
 4. **Paste of rich content during collaboration**: Verify consistency
 5. **API key rotation mid-session**: Verify seamless transition
 6. **Large document (10k+ words) with RAG**: Verify token management
 7. **Concurrent table editing by multiple users**: Verify CRDT behavior
 8. **Browser tab closure during collaboration**: Verify cleanup
 9. **Export while AI is streaming**: Verify no interference
10. **PWA offline mode with collaboration**: Verify persistence

---

## 6\. Testing Strategy

### 6.1 Unit Tests

### 6.2 Integration Tests

### 6.3 E2E Tests (Manual or Playwright)

### 6.4 Test Coverage Targets

* **New code**: 90%+ unit test coverage
* **Modified code**: 80%+ unit test coverage
* **Critical paths**: 100% integration test coverage (collab sync, AI streaming, export)
* **Edge cases**: Explicit test cases for all identified edge cases above

### 6.5 Performance Testing

---

## Summary of Implementation Effort

**Total estimated effort**: 6-7 weeks for a single developer, or 3-4 weeks with two developers working in parallel on collaboration and AI tracks.

**Critical path**: Phase 1 (server infrastructure) must complete before Phase 2 (remote collaboration) and Phase 5 (real-time polish). Phases 3, 4, and 6 can proceed in parallel with their respective foundations.
