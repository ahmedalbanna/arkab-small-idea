import { useAppApi } from "../appContext";
import TableOfContents from "../../components/navigation/TableOfContents";

/** Resolves the active editor through `AppApi` and renders the outline. */
export function TableOfContentsOverlay() {
  const appApi = useAppApi();
  const editorRef = { current: appApi.getEditorRef() ?? null };
  return <TableOfContents editorRef={editorRef} />;
}
