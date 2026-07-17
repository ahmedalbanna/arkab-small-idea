import { describe, it, expect, vi, afterEach } from "vitest";
import { editorUIPlugin } from "../plugins/editorUI";
import {
  aiPlugin,
  selectBlockAndOpenPopover,
  setAiActionHandler,
  runAiAction,
} from "../plugins/ai";
import { useAIUIStore } from "../stores/aiUIStore";
import type { PluginContext } from "../plugins/types";
import type { Plugin } from "prosemirror-state";

function fakeContext(): PluginContext {
  return {
    editor: { getView: () => null, isReady: () => false, focus: () => {} },
    stores: {} as any,
    schema: {} as any,
    registerProsePlugin: () => {},
    registerNodeView: () => {},
    registerToolbarItem: () => {},
    registerCommand: () => {},
    registerOverlay: () => {},
    registerSetting: () => {},
    registerHost: () => {},
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
  setAiActionHandler(null);
  useAIUIStore.setState({
    sideMenu: { y: 0, show: false, pos: 0 },
    bubbleMenu: { x: 0, y: 0, show: false },
    contextMenu: { x: 0, y: 0, show: false, pos: 0 },
    showAiPopover: false,
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
    // side menu, context menu, bubble menu, tts highlight, typewriter, focus mode
    expect(resolve(registered).length).toBe(6);
  });

  it("registers the focus-mode and typewriter toolbar items", () => {
    const items: any[] = [];
    const ctx = { ...fakeContext(), registerToolbarItem: (i: any) => items.push(i) };
    editorUIPlugin.init(ctx);
    const ids = items.map((i) => i.id).sort();
    expect(ids).toEqual(["focus-mode", "typewriter"]);
    // Toggling is wired to the AI UI store and reflects active state.
    const focus = items.find((i) => i.id === "focus-mode");
    expect(typeof focus.onClick).toBe("function");
    expect(typeof focus.isActive).toBe("function");
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

  it("selectBlockAndOpenPopover opens the popover for a collapsed cursor", () => {
    useAIUIStore.setState({ showAiPopover: false });
    const open = vi.spyOn(useAIUIStore.getState(), "setShowAiPopover");
    const state: any = {
      selection: {
        from: 8,
        to: 8,
        $from: { start: () => 5, end: () => 20 },
      },
    };
    // dispatch left undefined — the block-selection branch is skipped, but the
    // popover must still open and the handler must report it handled the key.
    const handled = selectBlockAndOpenPopover(state, undefined);
    expect(handled).toBe(true);
    expect(open).toHaveBeenCalledWith(true);
  });
});

describe("inline draft bridge", () => {
  it("routes runAiAction to the registered handler and stops when cleared", () => {
    const handler = vi.fn();
    setAiActionHandler(handler);
    runAiAction("improve");
    expect(handler).toHaveBeenCalledWith("improve");

    setAiActionHandler(null);
    runAiAction("summarize");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
