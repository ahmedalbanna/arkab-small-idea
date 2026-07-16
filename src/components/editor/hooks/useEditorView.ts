import { useEffect, useLayoutEffect, type MutableRefObject, type RefObject } from "react";
import { EditorState, PluginKey } from "prosemirror-state";
import { DOMSerializer, Slice, type Schema, type Node } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import { cn } from "../../../lib/utils";
import { createCollabPlugin } from "../../../lib/collabPlugin";
import { searchPluginKey } from "../../../plugins/search";
import { editorSerializer } from "./useMarkdownSerializer";
import type { LoadedPlugins } from "../../../plugins";
import type { SlashMenuState, ContextMenuState } from "../../../stores/aiUIStore";

interface EditorViewParams {
  editorRef: RefObject<HTMLDivElement | null>;
  viewRef: RefObject<EditorView | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  loaded: LoadedPlugins | null;
  editorSchema: Schema;
  parseMarkdownDoc: (md: string) => Node;
  collab?: {
    enabled: boolean;
    docId: string;
    username?: string;
  };
  placeholder?: string;
  direction?: "ltr" | "rtl";
  isTypewriter?: boolean;
  /** Initial markdown content used to seed the document on (re)build. */
  value: string;
  /** Latest props snapshot, kept in a ref to avoid stale closures. */
  latestProps: MutableRefObject<any>;
  /** Stale snapshot captured at editor build time (mirrors prior closure). */
  slashMenu: SlashMenuState;
  setSlashMenu: (
    v: SlashMenuState | ((prev: SlashMenuState) => SlashMenuState),
  ) => void;
  setContextMenu: (
    v: ContextMenuState | ((prev: ContextMenuState) => ContextMenuState),
  ) => void;
  /** Guards external prop updates from echoing back out via onChange. */
  isUpdatingFromProps: MutableRefObject<boolean>;
}

/**
 * Creates and destroys the ProseMirror `EditorView`, and wires the editor DOM
 * event listeners (outside-click to dismiss the context menu, scroll
 * forwarding).
 *
 * The view is rebuilt only when `loaded` changes (i.e. the plugin set or schema
 * changed) — all values it closes over are captured at that moment, mirroring
 * the previous inline behavior. Other prop changes (value, search, focus mode)
 * are handled by the dedicated sync hooks via transactions / `setProps`.
 */
export function useEditorView({
  editorRef,
  viewRef,
  containerRef,
  loaded,
  editorSchema,
  parseMarkdownDoc,
  collab,
  placeholder,
  direction,
  isTypewriter,
  value,
  latestProps,
  slashMenu,
  setSlashMenu,
  setContextMenu,
  isUpdatingFromProps,
}: EditorViewParams): void {
  // Close menus on outside click
  useEffect(() => {
    const handleClick = () => {
      setContextMenu((prev) => ({ ...prev, show: false }));
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [setContextMenu]);

  useEffect(() => {
    if (!editorRef.current) return;

    const scrollContainer = editorRef.current.parentElement;
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (latestProps.current.onScroll) {
        latestProps.current.onScroll();
      }
    };

    scrollContainer.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    return () =>
      scrollContainer.removeEventListener("scroll", handleScroll);
  }, [editorRef, latestProps]);

  useLayoutEffect(() => {
    if (!editorRef.current) return;
    if (!loaded) return;

    // Plugins and node views contributed by the plugin system: core base
    // plugins, feature plugins (math, search, heading, ...), the editor UI
    // plugins (side menu, context menu, bubble menu, TTS highlight,
    // typewriter, focus mode) and the AI keymap — all surfaced through
    // PluginContext. The editor no longer defines any ProseMirror plugins
    // inline.
    const { editorPlugins, nodeViews } = loaded.context;

    // Collaboration plugin
    const collabInstance = collab?.enabled
      ? createCollabPlugin({
          docId: collab.docId,
          username: collab.username,
        })
      : null;

    const state = EditorState.create({
      schema: editorSchema,
      doc:
        parseMarkdownDoc(value) || editorSchema.nodes.doc.createAndFill()!,
      plugins: [
        ...(collabInstance ? collabInstance.plugins : []),
        // All ProseMirror plugins — core base plugins, feature plugins, the
        // editor UI plugins (side menu, context menu, bubble menu, TTS
        // highlight, typewriter, focus mode) and the AI keymap — are
        // contributed by the plugin system and surfaced through
        // PluginContext.editorPlugins. The editor defines none inline.
        ...editorPlugins,
      ],
    });

    const view = new EditorView(editorRef.current, {
      state,
      attributes: {
        class: cn("ProseMirror", isTypewriter && "typewriter-mode"),
        "data-placeholder": placeholder || "Start writing...",
        dir: direction,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Markdown editor",
        spellcheck: "true",
      },
      nodeViews: {
        ...nodeViews,
      },
      clipboardSerializer: DOMSerializer.fromSchema(editorSchema),
      clipboardTextSerializer(slice) {
        return editorSerializer.serialize(
          editorSchema.nodes.doc.create(null, slice.content),
        );
      },
      clipboardTextParser(text, $context) {
        // Detect if text is markdown-like
        const isMarkdown = /[#*`\[]|^\s*[-+]\s|^\s*\d+\.\s/m.test(text);
        if (isMarkdown) {
          return new Slice(parseMarkdownDoc(text).content, 0, 0);
        }
        // Fallback to default parsing which might just be plain text
        return new Slice(parseMarkdownDoc(text).content, 0, 0);
      },
      dispatchTransaction(tr) {
        const newState = this.state.apply(tr);
        this.updateState(newState);

        // Slash menu query detection
        if (slashMenu.show) {
          const { selection, doc } = newState;
          // Check if the trigger slash is still there
          const charBefore = doc.textBetween(
            Math.max(0, slashMenu.pos - 1),
            Math.max(0, slashMenu.pos),
          );

          // If cursor moves before the slash, slash is deleted, or selection is not empty, hide menu
          if (
            selection.from < slashMenu.pos ||
            charBefore !== "/" ||
            !selection.empty
          ) {
            setSlashMenu((prev) => ({ ...prev, show: false, query: "" }));
          } else {
            const text = doc.textBetween(slashMenu.pos, selection.from);
            // Limit query length or check for spaces to hide menu
            if (text.includes(" ") || text.length > 50) {
              setSlashMenu((prev) => ({ ...prev, show: false, query: "" }));
            } else {
              setSlashMenu((prev) => ({ ...prev, query: text }));
            }
          }
        }

        // Track search metadata
        if (latestProps.current.onSearchMetadata) {
          const searchState = searchPluginKey.getState(newState);
          if (searchState) {
            const count = searchState.decorations.find().length;
            latestProps.current.onSearchMetadata(
              count,
              latestProps.current.searchOptions.currentMatchIndex,
            );
          }
        }

        if (tr.docChanged && !isUpdatingFromProps.current) {
          const markdown = editorSerializer.serialize(newState.doc);
          latestProps.current.onChange(markdown);
        }

        if (!tr.selection.eq(this.state.selection)) {
          latestProps.current.onSelectionChange?.({
            from: tr.selection.from,
            to: tr.selection.to,
          });
        }
      },
      handleKeyDown(view, event) {
        if (latestProps.current.onKeyDown) {
          latestProps.current.onKeyDown(event as any);
        }

        // Slash command detection
        if (event.key === "/") {
          const { selection } = view.state;
          if (selection.empty) {
            const $from = selection.$from;
            const before = $from.parent.textContent.substring(
              0,
              $from.parentOffset,
            );
            const isStartOfLine = $from.parentOffset === 0;
            const isAfterSpace = before.endsWith(" ");

            if (isStartOfLine || isAfterSpace) {
              const coords = view.coordsAtPos(selection.from);
              const editorRect =
                containerRef.current?.getBoundingClientRect();
              if (editorRect) {
                setSlashMenu({
                  x: coords.left - editorRect.left,
                  y: coords.bottom - editorRect.top + 5,
                  show: true,
                  pos: selection.from + 1, // Start query AFTER the slash
                  query: "",
                });
              }
            }
          }
        } else if (event.key === "Escape") {
          setSlashMenu((prev) => ({ ...prev, show: false }));
        }

        return false;
      },
      handleDrop(view, event) {
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
          const imageFiles = Array.from(files).filter((f) =>
            f.type.startsWith("image/"),
          );
          if (imageFiles.length === 0) return false;

          const pos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          const insertPos = pos ? pos.pos : view.state.selection.from;

          if (imageFiles.length > 1) {
            // Create a gallery
            const promises = imageFiles.map((file) => {
              return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(file);
              });
            });

            Promise.all(promises).then((srcs) => {
              const imageNodes = srcs.map((src) =>
                editorSchema.nodes.image.create({ src }),
              );
              const galleryNode = editorSchema.nodes.gallery.create(
                { layout: "grid" },
                imageNodes,
              );
              view.dispatch(view.state.tr.insert(insertPos, galleryNode));
            });
          } else {
            // Single image
            const reader = new FileReader();
            reader.onload = (e) => {
              const src = e.target?.result as string;
              const node = editorSchema.nodes.image.create({ src });
              view.dispatch(view.state.tr.insert(insertPos, node));
            };
            reader.readAsDataURL(imageFiles[0]);
          }
          event.preventDefault();
          return true;
        }
        return false;
      },
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain");
        const html = event.clipboardData?.getData("text/html");

        // Handle images
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
              const file = items[i].getAsFile();
              if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const src = e.target?.result as string;
                  const node = editorSchema.nodes.image.create({ src });
                  view.dispatch(view.state.tr.replaceSelectionWith(node));
                };
                reader.readAsDataURL(file);
                return true;
              }
            }
          }
        }

        if (text && /^https?:\/\/[^\s$.?#].[^\s]*$/.test(text.trim())) {
          // If selecting text, we can wrap it as a link instead of prompting
          const { from, to } = view.state.selection;
          if (from !== to) {
            const tr = view.state.tr.addMark(
              from,
              to,
              editorSchema.marks.link.create({ href: text.trim() }),
            );
            view.dispatch(tr);
            return true;
          }

          const confirmed = window.confirm(
            "Detected a URL. Would you like to insert it as a Markdown link?",
          );
          if (confirmed) {
            const label =
              window.prompt("Enter link label:", "Link") || "Link";
            const markdownLink = `[${label}](${text.trim()})`;
            const node = parseMarkdownDoc(markdownLink);
            view.dispatch(view.state.tr.replaceSelectionWith(node));
            return true;
          }
        }
        return false;
      },
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      // Release plugin resources (intervals, subscriptions, listeners)
      // before the editor is rebuilt or unmounted.
      loaded.registry.destroyAll();
    };
  }, [loaded]); // Rebuild when plugins finish loading
}
