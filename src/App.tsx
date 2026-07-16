/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMediaQuery } from "./lib/utils";
import { EditorRef } from "./components/ProseMirrorEditor";
import { useEditorStore } from "./stores/editorStore";
import { useUIStore } from "./stores/uiStore";
import { useSettingsStore } from "./stores/settingsStore";
import type { LoadedPlugins } from "./plugins";
import { PluginProvider, type AppApi } from "./plugins/appContext";
import { setEditorRefs } from "./plugins/editorAccess";
import { RegisteredOverlays } from "./components/overlays/RegisteredOverlays";
import { RegisteredHosts } from "./components/overlays/RegisteredHosts";

// Components
import { MobileMenu } from "./components/navigation/MobileMenu";
import { EditorContainer } from "./components/editor/EditorContainer";
import { FloatingToolbar } from "./components/navigation/FloatingToolbar";
import { SettingsModal } from "./components/overlays/SettingsModal";
import { ImportModal } from "./components/overlays/ImportModal";
import { MobileToolbar } from "./components/navigation/MobileToolbar";
import { WorkspacePlacement } from "./components/navigation/WorkspacePlacement";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";

export default function App() {
  const { pages, activeFocusedPageId, setPageContent } = useEditorStore();

  // Ref for multiple editors
  const editorRefs = useRef<Record<string, EditorRef | null>>({});

  // For compatibility with single-doc logic, we'll use the "focused" page
  const activePage =
    pages.find((p) => p.id === activeFocusedPageId) || pages[0];

  const { showPages, direction, setDirection } = useUIStore();

  const {
    theme,
    fontSize,
    lineHeight,
    maxWidth,
    fontFamily,
    headingColor,
  } = useSettingsStore();

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
    setHasHydrated(useEditorStore.persist.hasHydrated());
    const unsub = useEditorStore.persist.onFinishHydration(() =>
      setHasHydrated(true),
    );
    return unsub;
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
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
          editorRefs.current[activePage.id]?.insertGallery(
            results.map((r) => r.src),
          );
        } else {
          editorRefs.current[activePage.id]?.insertImage(
            results[0].src,
            results[0].name,
          );
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
  const [hostPlugins, setHostPlugins] = useState<
    LoadedPlugins["collectors"]["hosts"] | null
  >(null);
  const handleEditorLoaded = useCallback((loaded: LoadedPlugins) => {
    const prev = overlayPluginsRef.current;
    // Only refresh overlays/hosts when the enabled plugin set actually changes
    // (e.g. a feature was toggled), avoiding re-mounts on identical reloads.
    const key = (l: LoadedPlugins) =>
      l.collectors.overlays.map((o) => o.id).sort().join(",") +
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
    <PluginProvider
      appApi={appApi}
      pluginContext={overlayPluginsRef.current?.context ?? null}
    >
      <div
        dir={direction}
        className={cn(
          "h-screen overflow-hidden bg-minimal-bg text-minimal-text font-sans flex flex-col selection:bg-minimal-accent/20 transition-colors duration-500",
          "",
        )}
      >
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
            toolbarItems={overlayPluginsRef.current?.context?.toolbarItems ?? []}
            pluginContext={overlayPluginsRef.current?.context ?? null}
          />
        )}

        <AnimatePresence>{showPages && <WorkspacePlacement />}</AnimatePresence>

        {isMobile && (
          <MobileToolbar
            fileInputRef={fileInputRef}
            toolbarItems={overlayPluginsRef.current?.context?.toolbarItems ?? []}
            pluginContext={overlayPluginsRef.current?.context ?? null}
          />
        )}

        <SettingsModal
          pluginSettings={overlayPluginsRef.current?.context?.settings ?? []}
        />

        <ImportModal
          onImport={(content) => {
            if (activePage) {
              setPageContent(activePage.id, content);
              editorRefs.current[activePage.id]?.setMarkdown(content);
            }
          }}
        />

        <RegisteredHosts hosts={hostPlugins ?? []} />
        <RegisteredOverlays overlays={overlayPlugins ?? []} />
      </div>
    </PluginProvider>
  );
}
