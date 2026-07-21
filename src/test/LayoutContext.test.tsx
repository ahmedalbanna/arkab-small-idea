// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  LayoutProvider,
  useLayout,
  type PanelId,
} from "../components/layout/LayoutContext";
import { useUIStore } from "../stores/uiStore";

afterEach(cleanup);

/**
 * A test helper component that reads layout context and renders it as text
 * so we can assert on it.
 */
function LayoutConsumer({ id }: { id: string }) {
  const layout = useLayout();
  return (
    <div data-testid={`layout-${id}`}>
      <span data-testid="active-panel">{layout.activePanel ?? "null"}</span>
      <span data-testid="is-modal-open">{String(layout.isModalOpen)}</span>
    </div>
  );
}

describe("LayoutContext", () => {
  beforeEach(() => {
    // Reset uiStore to defaults
    useUIStore.setState({
      showAIAssistant: false,
      showSearch: false,
      showTOC: false,
      showPages: false,
      showSemanticFolders: false,
      showTTS: false,
      showSettings: false,
      showImportModal: false,
      showMobileMenu: false,
      showAiSettings: false,
      showQuickCommands: true,
      direction: "ltr",
      isIndexing: false,
      indexedChunks: 0,
      indexedEpisodes: 0,
      isAutoSaving: false,
      ttsRate: 1,
      ttsHighlightRange: null,
    });
  });

  it("provides context to children", () => {
    render(
      <LayoutProvider>
        <LayoutConsumer id="test" />
      </LayoutProvider>,
    );
    expect(screen.getByTestId("active-panel").textContent).toBe("null");
  });

  it("throws when useLayout is used outside LayoutProvider", () => {
    // Suppress console.error for the expected error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<LayoutConsumer id="fail" />)).toThrow(
      "useLayout must be used within a <LayoutProvider>",
    );
    spy.mockRestore();
  });

  it("derives activePanel from uiStore — ai panel", () => {
    useUIStore.setState({ showAIAssistant: true });
    render(
      <LayoutProvider>
        <LayoutConsumer id="ai-test" />
      </LayoutProvider>,
    );
    expect(screen.getByTestId("active-panel").textContent).toBe("ai");
  });

  it("derives activePanel from uiStore — search panel", () => {
    useUIStore.setState({ showSearch: true });
    render(
      <LayoutProvider>
        <LayoutConsumer id="search-test" />
      </LayoutProvider>,
    );
    expect(screen.getByTestId("active-panel").textContent).toBe("search");
  });

  it("derives activePanel from uiStore — toc panel", () => {
    useUIStore.setState({ showTOC: true });
    render(
      <LayoutProvider>
        <LayoutConsumer id="toc-test" />
      </LayoutProvider>,
    );
    expect(screen.getByTestId("active-panel").textContent).toBe("toc");
  });

  it("derives activePanel from uiStore — workspace panel", () => {
    useUIStore.setState({ showPages: true });
    render(
      <LayoutProvider>
        <LayoutConsumer id="ws-test" />
      </LayoutProvider>,
    );
    expect(screen.getByTestId("active-panel").textContent).toBe("workspace");
  });

  it("derives activePanel from uiStore — semantic panel", () => {
    useUIStore.setState({ showSemanticFolders: true });
    render(
      <LayoutProvider>
        <LayoutConsumer id="sem-test" />
      </LayoutProvider>,
    );
    expect(screen.getByTestId("active-panel").textContent).toBe("semantic");
  });

  it("derives activePanel from uiStore — tts panel", () => {
    useUIStore.setState({ showTTS: true });
    render(
      <LayoutProvider>
        <LayoutConsumer id="tts-test" />
      </LayoutProvider>,
    );
    expect(screen.getByTestId("active-panel").textContent).toBe("tts");
  });

  it("returns null activePanel when no panels are open (default)", () => {
    render(
      <LayoutProvider>
        <LayoutConsumer id="default-test" />
      </LayoutProvider>,
    );
    expect(screen.getByTestId("active-panel").textContent).toBe("null");
  });

  it("derives isModalOpen from settings modal", () => {
    useUIStore.setState({ showSettings: true });
    render(
      <LayoutProvider>
        <LayoutConsumer id="modal-test" />
      </LayoutProvider>,
    );
    expect(screen.getByTestId("is-modal-open").textContent).toBe("true");
  });

  it("derives isModalOpen from import modal", () => {
    useUIStore.setState({ showImportModal: true });
    render(
      <LayoutProvider>
        <LayoutConsumer id="modal-import-test" />
      </LayoutProvider>,
    );
    expect(screen.getByTestId("is-modal-open").textContent).toBe("true");
  });

  it("provides zScale constants", () => {
    let capturedZScale: unknown;
    function Capture() {
      const layout = useLayout();
      capturedZScale = layout.zScale;
      return null;
    }
    render(
      <LayoutProvider>
        <Capture />
      </LayoutProvider>,
    );
    expect(capturedZScale).toBeDefined();
    expect(capturedZScale).toHaveProperty("base", 0);
    expect(capturedZScale).toHaveProperty("command", 200);
  });

  it("closePanel sets active panel via the uiStore", () => {
    let layout: ReturnType<typeof useLayout> | undefined;
    function Action() {
      layout = useLayout();
      return null;
    }
    useUIStore.setState({ showAIAssistant: true });
    render(
      <LayoutProvider>
        <Action />
      </LayoutProvider>,
    );

    layout!.closePanel();
    expect(useUIStore.getState().showAIAssistant).toBe(false);
  });

  it("openPanel closes other panels before opening", () => {
    let layout: ReturnType<typeof useLayout> | undefined;
    function Action() {
      layout = useLayout();
      return null;
    }
    useUIStore.setState({ showSearch: true });
    render(
      <LayoutProvider>
        <Action />
      </LayoutProvider>,
    );

    layout!.openPanel("ai");
    expect(useUIStore.getState().showSearch).toBe(false);
    expect(useUIStore.getState().showAIAssistant).toBe(true);
  });

  it("togglePanel opens a closed panel and closes others", () => {
    let layout: ReturnType<typeof useLayout> | undefined;
    function Action() {
      layout = useLayout();
      return null;
    }
    useUIStore.setState({ showTOC: true });
    render(
      <LayoutProvider>
        <Action />
      </LayoutProvider>,
    );

    layout!.togglePanel("workspace");
    expect(useUIStore.getState().showTOC).toBe(false);
    expect(useUIStore.getState().showPages).toBe(true);
  });

  it("togglePanel closes an already-open panel", () => {
    let layout: ReturnType<typeof useLayout> | undefined;
    function Action() {
      layout = useLayout();
      return null;
    }
    useUIStore.setState({ showTTS: true });
    render(
      <LayoutProvider>
        <Action />
      </LayoutProvider>,
    );

    layout!.togglePanel("tts");
    expect(useUIStore.getState().showTTS).toBe(false);
  });
});
