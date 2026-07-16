// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, act } from "@testing-library/react";
import {
  PluginRegistryContext,
  useSetPluginEnabled,
  usePluginRegistry,
  useSetPluginRegistry,
} from "../plugins/registryContext";
import { PluginRegistry } from "../plugins/registry";
import { useSettingsStore } from "../stores/settingsStore";

describe("PluginRegistryContext", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("useSetPluginEnabled toggles the active registry and persists the preference", () => {
    const registry = new PluginRegistry();
    const enable = vi.spyOn(registry, "enable");
    const disable = vi.spyOn(registry, "disable");
    // Spy (without call-through) so the shared settings store isn't mutated.
    const storeSpy = vi.spyOn(useSettingsStore.getState(), "setPluginEnabled");

    let toggle: (id: string, enabled: boolean) => void = () => {};
    function Consumer() {
      toggle = useSetPluginEnabled();
      return null;
    }

    render(
      <PluginRegistryContext.Provider
        value={{ registry, setRegistry: () => {} }}
      >
        <Consumer />
      </PluginRegistryContext.Provider>,
    );

    act(() => toggle("math", false));
    expect(disable).toHaveBeenCalledWith("math");
    expect(storeSpy).toHaveBeenCalledWith("math", false);

    act(() => toggle("math", true));
    expect(enable).toHaveBeenCalledWith("math");
    expect(storeSpy).toHaveBeenCalledWith("math", true);
  });

  it("useSetPluginEnabled is safe without a provider (persists, no registry)", () => {
    const storeSpy = vi.spyOn(useSettingsStore.getState(), "setPluginEnabled");

    let toggle: (id: string, enabled: boolean) => void = () => {};
    function Consumer() {
      toggle = useSetPluginEnabled();
      return null;
    }

    render(<Consumer />);

    expect(() => act(() => toggle("math", false))).not.toThrow();
    expect(storeSpy).toHaveBeenCalledWith("math", false);
  });

  it("usePluginRegistry / useSetPluginRegistry read and write the context", () => {
    let registryValue: ReturnType<typeof usePluginRegistry> = null;
    let publish: ReturnType<typeof useSetPluginRegistry> = () => {};
    function Consumer() {
      registryValue = usePluginRegistry();
      publish = useSetPluginRegistry();
      return null;
    }

    const setRegistry = vi.fn();
    const registry = new PluginRegistry();
    render(
      <PluginRegistryContext.Provider value={{ registry: null, setRegistry }}>
        <Consumer />
      </PluginRegistryContext.Provider>,
    );

    expect(registryValue).toBeNull();
    act(() => publish(registry));
    expect(setRegistry).toHaveBeenCalledWith(registry);
  });
});
