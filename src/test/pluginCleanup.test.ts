import { afterEach, describe, expect, it, vi } from "vitest";
import { PluginRegistry } from "../plugins/registry";
import { addPluginLogSink, type PluginLogEntry } from "../plugins/logger";
import type { InkPlugin } from "../plugins/types";

function makePlugin(
  overrides: Partial<InkPlugin> &
    Pick<InkPlugin, "id" | "name" | "version" | "init">,
): InkPlugin {
  return { ...overrides };
}

async function initRegistry(
  registry: PluginRegistry,
  plugins: InkPlugin[],
): Promise<void> {
  for (const p of plugins) registry.register(p);
  await registry.initAll(
    async () => ({ schema: {} as any, context: {} as any }),
  );
}

describe("PluginRegistry cleanup contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("destroyAll tears down every initialized plugin and reports no leaks", async () => {
    const destroy = vi.fn();
    const registry = new PluginRegistry();
    await initRegistry(registry, [
      makePlugin({ id: "a", name: "A", version: "1", init: () => {}, destroy }),
      makePlugin({ id: "b", name: "B", version: "1", init: () => {}, destroy }),
    ]);

    const leaked = registry.destroyAll();

    expect(destroy).toHaveBeenCalledTimes(2);
    expect(leaked).toEqual([]);
  });

  it("disable tears down immediately and is idempotent (no double-free)", async () => {
    const destroy = vi.fn();
    const registry = new PluginRegistry();
    await initRegistry(registry, [
      makePlugin({ id: "x", name: "X", version: "1", init: () => {}, destroy }),
    ]);

    // Toggling a plugin off must immediately invoke its cleanup.
    registry.disable("x");
    expect(destroy).toHaveBeenCalledTimes(1);

    // A second toggle must NOT call destroy again (idempotent).
    registry.disable("x");
    expect(destroy).toHaveBeenCalledTimes(1);

    // Re-enabling resets the lifecycle so it can be re-initialized later.
    registry.enable("x");
    expect(registry.getEnabled().some((p) => p.id === "x")).toBe(true);
  });

  it("a resource-holding plugin releases its resource on destroy (no leak)", async () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const registry = new PluginRegistry();
    await initRegistry(registry, [
      makePlugin({
        id: "timer",
        name: "Timer",
        version: "1",
        init: () => {
          intervalId = setInterval(() => {}, 1000);
        },
        destroy: () => {
          if (intervalId) clearInterval(intervalId);
        },
      }),
    ]);

    registry.destroyAll();
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(intervalId).not.toBeNull();
  });

  it("verifyCleanup logs a structured warning for an initialized plugin that was never destroyed", async () => {
    const entries: PluginLogEntry[] = [];
    const unsub = addPluginLogSink((e) => entries.push(e));
    try {
      const registry = new PluginRegistry();
      await initRegistry(registry, [
        makePlugin({ id: "leaky", name: "Leaky", version: "1", init: () => {} }),
      ]);

      // Intentionally skip destroyAll — the detector must surface the leak.
      const leaked = registry.verifyCleanup();
      expect(leaked).toContain("leaky");

      const leakEntry = entries.find((e) => e.event === "leak");
      expect(leakEntry).toBeTruthy();
      expect(leakEntry!.level).toBe("warn");
      expect(leakEntry!.meta).toEqual({ leaked: ["leaky"] });
    } finally {
      unsub();
    }
  });
});
