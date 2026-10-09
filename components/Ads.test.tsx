// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Keep the component tests focused on the props and DOM contract. Next's real
// Script loader owns runtime deduplication; stable IDs are asserted below. The
// mock inserts a real script node after commit so React does not warn that a
// script rendered as ordinary JSX will not execute in a client test.
vi.mock("next/script", async () => {
  const React = await import("react");
  type ScriptProps = { strategy?: string; [key: string]: unknown };
  function MockScript(props: ScriptProps) {
    const host = React.useRef<HTMLSpanElement>(null);
    React.useEffect(() => {
      const { strategy: _strategy, ...attributes } = props;
      const script = document.createElement("script");
      for (const [name, value] of Object.entries(attributes)) {
        if (value !== undefined && value !== null) script.setAttribute(name, String(value));
      }
      host.current?.replaceChildren(script);
      return () => script.remove();
    }, [props]);
    return <span ref={host} data-script-host="true" />;
  }
  return { default: MockScript };
});

import AdsterraGlobalScripts from "./AdsterraGlobalScripts";
import NativeAd from "./NativeAd";
import { adsterraScripts } from "@/config/ads";

describe("Adsterra DOM contracts", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ADS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_ADS_SOCIAL_BAR_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_ADS_NATIVE_ENABLED", "true");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("renders no ad scripts or container outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { container } = render(<><AdsterraGlobalScripts /><NativeAd /></>);

    expect(container.querySelectorAll("script")).toHaveLength(0);
    expect(container.querySelector(`#${adsterraScripts.native.containerId}`)).toBeNull();
  });

  it("renders each enabled format once with the supplied attributes", () => {
    const { container } = render(<><AdsterraGlobalScripts /><NativeAd /></>);
    const scripts = [...container.querySelectorAll<HTMLScriptElement>("script")];

    expect(scripts).toHaveLength(2);
    expect(scripts.map(script => script.id)).toEqual([
      adsterraScripts.socialBar.id,
      adsterraScripts.native.id,
    ]);
    expect(scripts.map(script => script.src)).toEqual([
      adsterraScripts.socialBar.src,
      adsterraScripts.native.src,
    ]);
    expect(scripts.every(script => script.getAttribute("data-cfasync") === "false")).toBe(true);
    expect(container.querySelectorAll(`#${adsterraScripts.native.containerId}`)).toHaveLength(1);
  });

  it("removes only the format whose switch is disabled", () => {
    const { container, rerender } = render(<><AdsterraGlobalScripts /><NativeAd /></>);
    const enabledSources = () => [...container.querySelectorAll<HTMLScriptElement>("script")].map(script => script.src);

    vi.stubEnv("NEXT_PUBLIC_ADS_SOCIAL_BAR_ENABLED", "false");
    rerender(<><AdsterraGlobalScripts /><NativeAd /></>);
    expect(enabledSources()).toEqual([adsterraScripts.native.src]);
    expect(container.querySelector(`#${adsterraScripts.native.containerId}`)).not.toBeNull();

    vi.stubEnv("NEXT_PUBLIC_ADS_NATIVE_ENABLED", "false");
    rerender(<><AdsterraGlobalScripts /><NativeAd /></>);
    expect(enabledSources()).toEqual([]);
    expect(container.querySelector(`#${adsterraScripts.native.containerId}`)).toBeNull();
  });
});
