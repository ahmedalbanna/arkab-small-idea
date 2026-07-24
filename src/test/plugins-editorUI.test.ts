import { describe, it, expect, vi, afterEach } from "vitest";
import { editorUIPlugin } from "../plugins/editorUI";
import { aiPlugin, selectBlock, setAiActionHandler, runAiAction } from "../plugins/ai";
import { useAIUIStore } from "../stores/aiUIStore";
import { useUIStore } from "../stores/uiStore";
import type { PluginContext } from "../plugins/types";
import type { Plugin } from "prosemirror-state";
import { defaultEditorCommandBus } from "../plugins/editorCommandBus";

// Mock TextSelection.create so selectBlock can be tested without
// a full ProseMirror document mock.
vi.mock("prosemirror-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("prosemirror-state")>();
  return {
    ...actual,
    TextSelection: {
      ...actual.TextSelection,
      create: vi.fn(() => ({ from: 0, to: 0 })),
    },
  };
});

function fakeContext(): PluginContext {
  return {
    editor: { getView: () => null, isReady: () => false, focus: () => {} },
    commandBus: defaultEditorCommandBus,
    stores: { aiUI: useAIUIStore, ui: useUIStore } as any,
    schema: {} as any,
    registerProsePlugin: () => {},
    registerNodeView: () => {},
    registerToolbarItem: () => {},
    registerCommand: () => {},
    registerOverlay: () => {},
    registerSetting: () => {},
    registerHost: () => {},
    emitIntent: () => {},
    editorPlugins: [],
    nodeViews: {},
    toolbarItems: [],
    commands: [],
    settings: [],
  };
}

function resolve(plugins: (Plugin | (() => Plugin))[]): Plugin[] {
  return plugins.map((p) => (typeof p === "function" ? p() : p));
}

afterEach(() => {
  setAiActionHandler("test-editor", null);
  useAIUIStore.setState({
    sideMenu: { y: 0, show: false, pos: 0, editorId: "" },
    bubbleMenu: { x: 0, y: 0, show: false, editorId: "" },
    contextMenu: { x: 0, y: 0, show: false, pos: 0, editorId: "" },
  });
});

describe("editorUI plugin", () => {
  it("registers the editor-shell ProseMirror plugins", () => {
    const registered: (Plugin | (() => Plugin))[] = [];
    const ctx = {
      ...fakeContext(),
      registerProsePlugin: (p: any) => registered.push(p),
    };
    editorUIPlugin.init(ctx);
    // side menu, context menu, bubble menu, active formats, tts highlight
    expect(resolve(registered).length).toBe(5);
  });

  it("dispatches side menu state to the store on mousemove", () => {
    const registered: (Plugin | (() => Plugin))[] = [];
    const ctx = {
      ...fakeContext(),
      registerProsePlugin: (p: any) => registered.push(p),
    };
    editorUIPlugin.init(ctx);
    const plugins = resolve(registered);
    const sideMenu = plugins.find((p) => p.props?.handleDOMEvents?.mousemove);
    expect(sideMenu).toBeDefined();

    const setSideMenu = vi.spyOn(useAIUIStore.getState(), "setSideMenu");
    const view: any = {
      posAtCoords: () => ({ pos: 5 }),
      state: {
        doc: {
          resolve: () => ({
            depth: 2,
            node: () => ({ type: { name: "paragraph" } }),
            before: () => 0,
          }),
        },
      },
      coordsAtPos: () => ({ top: 100 }),
      dom: { getBoundingClientRect: () => ({ top: 0 }) },
    };
    (sideMenu!.props!.handleDOMEvents!.mousemove as any)(view, {
      clientX: 10,
      clientY: 10,
    } as any);
    expect(setSideMenu).toHaveBeenCalled();
  });

  it("scopes menu state by editor id so concurrent editors don't share menus", () => {
    const registered: (Plugin | (() => Plugin))[] = [];
    const ctx = {
      ...fakeContext(),
      editor: {
        getView: () => null,
        isReady: () => false,
        focus: () => {},
        editorId: "editor-A",
      },
      registerProsePlugin: (p: any) => registered.push(p),
    };
    editorUIPlugin.init(ctx as any);
    const plugins = resolve(registered);
    const sideMenuPlugin = plugins.find((p) => p.props?.handleDOMEvents?.mousemove);
    const view: any = {
      posAtCoords: () => ({ pos: 5 }),
      state: {
        doc: {
          resolve: () => ({
            depth: 2,
            node: () => ({ type: { name: "heading" } }),
            before: () => 0,
          }),
        },
      },
      coordsAtPos: () => ({ top: 100 }),
      dom: { getBoundingClientRect: () => ({ top: 0 }) },
    };
    (sideMenuPlugin!.props!.handleDOMEvents!.mousemove as any)(view, {
      clientX: 10,
      clientY: 10,
    } as any);

    // The menu is stamped with the owning editor's id.
    const side = useAIUIStore.getState().sideMenu;
    expect(side.show).toBe(true);
    expect(side.editorId).toBe("editor-A");

    // Another editor gate on its own id must ignore this menu.
    expect(side.show && side.editorId === "editor-B").toBe(false);
  });
});

describe("ai plugin keymap", () => {
  it("registers the AI keymap ProseMirror plugin", () => {
    const registered: (Plugin | (() => Plugin))[] = [];
    const ctx = {
      ...fakeContext(),
      registerProsePlugin: (p: any) => registered.push(p),
    };
    aiPlugin.init(ctx);
    // The ai plugin registers exactly one ProseMirror plugin: the keymap.
    expect(registered.length).toBe(1);
    const plugins = resolve(registered);
    expect(typeof plugins[0].props?.handleKeyDown).toBe("function");
  });

  it("selectBlock selects the block for a collapsed cursor", () => {
    const dispatch = vi.fn();
    const setSelection = vi.fn().mockReturnThis();
    const state: any = {
      selection: {
        from: 8,
        to: 8,
        $from: { start: () => 5, end: () => 20 },
      },
      tr: {
        setSelection,
      },
      doc: {},
    };
    // With dispatch provided, the block selection should be dispatched.
    const handled = selectBlock(state, dispatch);
    expect(handled).toBe(true);
    expect(setSelection).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalled();
  });

  it("selectBlock returns true without dispatch for collapsed cursor", () => {
    const state: any = {
      selection: {
        from: 8,
        to: 8,
        $from: { start: () => 5, end: () => 20 },
      },
      tr: {
        setSelection: vi.fn().mockReturnThis(),
      },
      doc: {
        textBetween: () => "block text",
      },
    };
    // dispatch left undefined — the block-selection branch is skipped, but the
    // handler must still report it handled the key.
    const handled = selectBlock(state, undefined);
    expect(handled).toBe(true);
    expect(state.tr.setSelection).not.toHaveBeenCalled();
  });
});

describe("inline draft bridge", () => {
  it("routes runAiAction to the registered handler and stops when cleared", () => {
    const handler = vi.fn();
    setAiActionHandler("test-editor", handler);
    runAiAction("improve", undefined, "test-editor");
    expect(handler).toHaveBeenCalledWith("improve", undefined);

    setAiActionHandler("test-editor", null);
    runAiAction("summarize", undefined, "test-editor");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
