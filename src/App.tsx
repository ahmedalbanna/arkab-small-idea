/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMediaQuery } from "./lib/utils";
import type { EditorRef } from "./components/ProseMirrorEditor";
import { useEditorStore } from "./stores/editorStore";
import { useUIStore } from "./stores/uiStore";
import { useAIUIStore } from "./stores/aiUIStore";
import { useSettingsStore } from "./stores/settingsStore";
import { setIntentHandler } from "./plugins/intents";
import { runAiAction } from "./plugins/ai";
import type { AIAssistantAction } from "./services/aiService";
import type { LoadedPlugins } from "./plugins";
import { PluginProvider, type AppApi } from "./plugins/appContext";
import { setEditorRefs } from "./plugins/editorAccess";
import { RegisteredOverlays } from "./components/overlays/RegisteredOverlays";
import { RegisteredHosts } from "./components/overlays/RegisteredHosts";
import { PluginRegistryProvider } from "./plugins/registryContext";
import { EditorCommandBusProvider } from "./plugins/editorCommandContext";

// Components
import { AppShell } from "./components/layout/AppShell";
import { BottomBar } from "./components/layout/BottomBar";
import { MobileMenu } from "./components/navigation/MobileMenu";
import { EditorContainer } from "./components/editor/EditorContainer";
import { FloatingToolbar } from "./components/navigation/FloatingToolbar";
import { ImportModal } from "./components/overlays/ImportModal";
import { ExportDialog } from "./components/overlays/ExportDialog";

export default function App() {
  const { pages, activeFocusedPageId, setPageContent } = useEditorStore();

  // Ref for multiple editors
  const editorRefs = useRef<Record<string, EditorRef | null>>({});

  // For compatibility with single-doc logic, we'll use the "focused" page
  const activePage = pages.find((p) => p.id === activeFocusedPageId) || pages[0];

  const { direction, setDirection } = useUIStore();

  const { theme, fontSize, lineHeight, maxWidth, fontFamily, headingColor } = useSettingsStore();

  useEffect(() => {
    document.documentElement.style.setProperty("--heading-color", headingColor);
    document.documentElement.style.setProperty("--minimal-accent", headingColor);
  }, [headingColor]);

  useEffect(() => {
    setEditorRefs(editorRefs);
  }, []);

  const isMobile = useMediaQuery("(max-width: 768px)");

  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    const validateFocus = () => {
      const { pages, activeFocusedPageId } = useEditorStore.getState();
      // If the focused page id points to a page that no longer exists,
      // reset it to the first page (fixes P2).
      if (activeFocusedPageId && !pages.some((p) => p.id === activeFocusedPageId)) {
        useEditorStore.getState().setActiveFocusedPageId(pages[0]?.id ?? null);
      }
    };
    setHasHydrated(useEditorStore.persist.hasHydrated()); // eslint-disable-line react-hooks/set-state-in-effect
    if (useEditorStore.persist.hasHydrated()) {
      validateFocus();
    }
    const unsub = useEditorStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
      validateFocus();
    });
    return unsub;
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      alert("Please upload image files.");
      return;
    }

    const promises = imageFiles.map((file) => {
      return new Promise<{ src: string; name: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({ src: event.target?.result as string, name: file.name });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then((results) => {
      if (activePage) {
        if (results.length > 1) {
          editorRefs.current[activePage.id]?.insertGallery(results.map((r) => r.src));
        } else {
          editorRefs.current[activePage.id]?.insertImage(results[0].src, results[0].name);
        }
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.setAttribute("data-theme", isSystemDark ? "dark" : "light");
    } else {
      root.setAttribute("data-theme", theme);
    }
    root.style.setProperty("--minimal-font", fontFamily);
    root.style.setProperty("--editor-font-size", `${fontSize}px`);
    root.style.setProperty("--editor-line-height", lineHeight.toString());
    root.style.setProperty("--editor-max-width", maxWidth);
  }, [theme, fontFamily, fontSize, lineHeight, maxWidth]);

  // Bridge the intent system to actual store mutations. Every plugin emits
  // intents via emitIntent(); this handler translates them into concrete
  // store calls so plugins never import stores directly.
  useEffect(() => {
    setIntentHandler((intent) => {
      const aiUI = useAIUIStore.getState();
      const ui = useUIStore.getState();
      switch (intent.type) {
        case "showCommandPalette":
          aiUI.setCommandPaletteOpen(true);
          break;
        case "hideCommandPalette":
          aiUI.setCommandPaletteOpen(false);
          break;
        case "showSearch":
          ui.setSearch(true);
          break;
        case "hideSearch":
          ui.setSearch(false);
          break;
        case "showShortcuts":
          aiUI.setShowShortcuts(true);
          break;
        case "hideShortcuts":
          aiUI.setShowShortcuts(false);
          break;
        case "showQuickCommands":
          ui.setQuickCommands(true);
          break;
        case "hideQuickCommands":
          ui.setQuickCommands(false);
          break;
        case "showTTS":
          ui.setTTS(true);
          break;
        case "hideTTS":
          ui.setTTS(false);
          break;
        case "runAIAction":
          runAiAction(
            intent.actionId as AIAssistantAction,
            intent.customInstruction,
            intent.editorId,
          );
          break;
      }
    });
    return () => setIntentHandler(null);
  }, []);

  // Expose the live editors to UI plugins (overlays) via context.
  const appApi = useMemo<AppApi>(
    () => ({
      getEditorRef: (pageId?: string) => {
        const id = pageId ?? activeFocusedPageId;
        return id ? (editorRefs.current[id] ?? null) : null;
      },
      getActivePageId: () => activeFocusedPageId,
    }),
    [activeFocusedPageId],
  );

  const overlayPluginsRef = useRef<LoadedPlugins | null>(null);
  const [overlayPlugins, setOverlayPlugins] = useState<
    LoadedPlugins["collectors"]["overlays"] | null
  >(null);
  const [hostPlugins, setHostPlugins] = useState<LoadedPlugins["collectors"]["hosts"] | null>(null);
  const handleEditorLoaded = useCallback((loaded: LoadedPlugins) => {
    const prev = overlayPluginsRef.current;
    // Only refresh overlays/hosts when the enabled plugin set actually changes
    // (e.g. a feature was toggled), avoiding re-mounts on identical reloads.
    const key = (l: LoadedPlugins) =>
      l.collectors.overlays
        .map((o) => o.id)
        .sort()
        .join(",") +
      "|" +
      l.collectors.hosts
        .map((h) => (h as { name?: string }).name || "")
        .sort()
        .join(",");
    if (prev && key(prev) === key(loaded)) {
      overlayPluginsRef.current = loaded;
      return;
    }
    overlayPluginsRef.current = loaded;
    setOverlayPlugins(loaded.collectors.overlays);
    setHostPlugins(loaded.collectors.hosts);
  }, []);

  if (!hasHydrated) return null;

  return (
    <PluginRegistryProvider>
      <EditorCommandBusProvider>
        <PluginProvider
          appApi={appApi}
          // eslint-disable-next-line react-hooks/refs
          pluginContext={overlayPluginsRef.current?.context ?? null}
        >
          <AppShell dir={direction}>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageUpload}
              multiple
            />

            <MobileMenu />

            <EditorContainer
              editorRefs={editorRefs}
              fileInputRef={fileInputRef}
              onLoaded={handleEditorLoaded}
            />

            {!isMobile && (
              <FloatingToolbar
                direction={direction}
                setDirection={setDirection}
                // eslint-disable-next-line react-hooks/refs
                toolbarItems={overlayPluginsRef.current?.context?.toolbarItems ?? []}
                // eslint-disable-next-line react-hooks/refs
                pluginContext={overlayPluginsRef.current?.context ?? null}
              />
            )}

            <BottomBar
              fileInputRef={fileInputRef}
              // eslint-disable-next-line react-hooks/refs
              toolbarItems={overlayPluginsRef.current?.context?.toolbarItems ?? []}
              // eslint-disable-next-line react-hooks/refs
              pluginContext={overlayPluginsRef.current?.context ?? null}
            />

            <ImportModal
              onImport={(content) => {
                if (activePage) {
                  setPageContent(activePage.id, content);
                  editorRefs.current[activePage.id]?.setMarkdown(content);
                }
              }}
            />

            <ExportDialog />

            <RegisteredHosts hosts={hostPlugins ?? []} />
            <RegisteredOverlays overlays={overlayPlugins ?? []} />
          </AppShell>
        </PluginProvider>
      </EditorCommandBusProvider>
    </PluginRegistryProvider>
  );
}
