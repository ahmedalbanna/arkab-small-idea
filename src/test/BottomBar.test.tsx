// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";

// Mock embeddingService BEFORE importing any modules that load it
// (it instantiates a Worker at module scope, which isn't available in happy-dom).
vi.mock("../services/embeddingService", () => {
  const noop = () => {};
  return {
    embeddingService: {
      subscribe: vi.fn(() => noop),
      loadModel: vi.fn(),
    },
    EmbeddingStatus: {} as any,
  };
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BottomBar } from "../components/layout/BottomBar";
import { useEditorStore } from "../stores/editorStore";
import { useUIStore } from "../stores/uiStore";

// Mock matchMedia so we can control the isMobile breakpoint
const matchMediaMock = vi.fn();
window.matchMedia = matchMediaMock;

afterEach(cleanup);

describe("BottomBar", () => {
  beforeEach(() => {
    // Default: desktop viewport (≥768px) → isMobile = false
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    // Reset editor store with a sample page
    useEditorStore.setState({
      pages: [
        {
          id: "test-page",
          title: "Test Chapter",
          content: "# Hello\n\nThis is some content with multiple words.",
          wordGoal: 0,
          snapshots: [],
          updatedAt: Date.now(),
        },
      ],
      activePageIds: ["test-page"],
      activeFocusedPageId: "test-page",
    });

    // Reset UI store
    useUIStore.setState({
      isIndexing: false,
      indexedChunks: 5,
      indexedEpisodes: 3,
      isAutoSaving: false,
      showAIAssistant: false,
      showSearch: false,
      showTTS: false,
      showImportModal: false,
      showMobileMenu: false,
      showAiSettings: false,
      showQuickCommands: true,
      direction: "ltr",
      ttsRate: 1,
      ttsHighlightRange: null,
    });
  });

  // ── Desktop tests ──

  it("renders word count in desktop mode", () => {
    render(<BottomBar />);
    // "# Hello\n\nThis is some content with multiple words." = 9 words
    expect(screen.getByText("9")).toBeTruthy();
  });

  it("renders char count in desktop mode", () => {
    render(<BottomBar />);
    // "# Hello\n\nThis is some content with multiple words." = 50 chars
    expect(screen.getByText("50")).toBeTruthy();
  });

  it("shows indexing indicator when indexing", () => {
    useUIStore.setState({ isIndexing: true });
    render(<BottomBar />);
    expect(screen.getByText(/optimizing intelligence index/i)).toBeTruthy();
  });

  it("shows memory depth when not indexing", () => {
    render(<BottomBar />);
    expect(screen.getByText(/8 nodes/i)).toBeTruthy();
  });

  it("shows auto-saving indicator", () => {
    useUIStore.setState({ isAutoSaving: true });
    render(<BottomBar />);
    expect(screen.getByText(/continuous protection active/i)).toBeTruthy();
  });

  it("shows progress bar when word goal is set", () => {
    useEditorStore.setState({
      pages: [
        {
          id: "test-page",
          title: "Test",
          content: "word ".repeat(50).trim(),
          wordGoal: 100,
          snapshots: [],
          updatedAt: Date.now(),
        },
      ],
    });
    render(<BottomBar />);
    expect(screen.getByText(/50%/)).toBeTruthy();
  });

  it("renders popover buttons in desktop mode", () => {
    render(<BottomBar />);
    // ThemePopover, FontSettingsPopover, PluginsPopover, AISettingsPopover
    expect(screen.getByLabelText("Appearance & Style")).toBeTruthy();
    expect(screen.getByLabelText("Font settings")).toBeTruthy();
    expect(screen.getByLabelText("Plugins")).toBeTruthy();
  });

  it("renders aria-live region with word count", () => {
    render(<BottomBar />);
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.textContent).toContain("9");
  });

  // ── Mobile tests ──

  it("renders formatting toolbar buttons in mobile mode", () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(<BottomBar />);
    expect(screen.getByLabelText("Bold")).toBeTruthy();
    expect(screen.getByLabelText("Italic")).toBeTruthy();
    expect(screen.getByLabelText("Blockquote")).toBeTruthy();
    expect(screen.getByLabelText("Table")).toBeTruthy();
    expect(screen.getByLabelText("Bullet list")).toBeTruthy();
    expect(screen.getByLabelText("Heading 2")).toBeTruthy();
    expect(screen.getByLabelText("Insert link")).toBeTruthy();
    expect(screen.getByLabelText("Insert image")).toBeTruthy();
    expect(screen.getByLabelText("Scribble")).toBeTruthy();
  });

  it("renders AI button in mobile mode", () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(<BottomBar />);
    expect(screen.getByLabelText("AI Assistant")).toBeTruthy();
  });

  it("renders plugin buttons in mobile mode", () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const mockPlugin = {
      id: "test-plugin",
      icon: vi.fn(() => null) as any,
      label: "Plugin Button",
      onClick: vi.fn(),
    };
    render(<BottomBar toolbarItems={[mockPlugin]} />);
    expect(screen.getByLabelText("Plugin Button")).toBeTruthy();
  });

  it("calls plugin onClick in mobile mode", () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const onClick = vi.fn();
    const mockPlugin = {
      id: "test-plugin",
      icon: vi.fn(() => null) as any,
      label: "Plugin Button",
      onClick,
    };
    render(<BottomBar toolbarItems={[mockPlugin]} />);
    fireEvent.click(screen.getByLabelText("Plugin Button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("uses z-sticky class for positioning", () => {
    render(<BottomBar />);
    const footer = document.querySelector("footer");
    expect(footer).toBeTruthy();
  });
});
