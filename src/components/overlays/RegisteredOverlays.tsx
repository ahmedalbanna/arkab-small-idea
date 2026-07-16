import type { ComponentType } from "react";
import type { PluginOverlay } from "../../plugins/types";
import { useSettingsStore } from "../../stores/settingsStore";

interface RegisteredOverlaysProps {
  overlays: PluginOverlay[];
}

/**
 * Renders every overlay contributed by plugins whose `show` predicate (if any)
 * currently returns true. Overlays are self-contained React components that
 * read what they need from stores / the `AppApi` context, so no extra props
 * are passed here.
 */
export function RegisteredOverlays({ overlays }: RegisteredOverlaysProps) {
  // Re-evaluate overlay `show` predicates whenever plugin settings change
  // (e.g. a setting toggles an overlay's visibility).
  useSettingsStore((s) => s.pluginSettings);

  return (
    <>
      {overlays.map((overlay) => {
        if (overlay.show && !overlay.show()) return null;
        const Component = overlay.component as ComponentType;
        return <Component key={overlay.id} />;
      })}
    </>
  );
}
