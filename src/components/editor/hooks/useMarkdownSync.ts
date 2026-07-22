import { useEffect, type MutableRefObject } from "react";
import type { CoreEditor } from "@core/CoreEditor";
import { editorSerializer } from "./useMarkdownSerializer";

interface MarkdownSyncParams {
  value: string;
  /** Shared guard so programmatic updates (e.g. `setMarkdown`) don't echo back. */
  isUpdatingFromProps: MutableRefObject<boolean>;
  /** The headless core that owns document state. */
  core: CoreEditor | undefined;
}

/**
 * Keeps the editor document in sync with the external `value` prop.
 *
 * When `value` changes and differs from the serialized current doc, the core
 * document is replaced through `core.replaceDoc` (the controlled view adopts
 * it via its `core.subscribe` listener). The `isUpdatingFromProps` guard
 * prevents the change listener in `useEditorView` from echoing the
 * programmatic update back out as an `onChange`.
 */
export function useMarkdownSync({ value, isUpdatingFromProps, core }: MarkdownSyncParams): void {
  useEffect(() => {
    if (isUpdatingFromProps.current) {
      isUpdatingFromProps.current = false; // eslint-disable-line react-hooks/immutability
      return;
    }
    if (!core) return;
    const currentMarkdown = editorSerializer.serialize(core.getState().doc);
    if (value !== currentMarkdown) {
      isUpdatingFromProps.current = true;
      core.replaceDoc(value, { recordHistory: false });
      isUpdatingFromProps.current = false;
    }
  }, [value, isUpdatingFromProps, core]);
}
