// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdsterraGlobalScripts from "./AdsterraGlobalScripts";
import NativeAd from "./NativeAd";
import { adsterraScripts } from "@/config/ads";

describe("Adsterra Next Script loading", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ADS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_ADS_SOCIAL_BAR_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_ADS_NATIVE_ENABLED", "true");
  });

  afterEach(() => {
    cleanup();
    document.querySelectorAll('script[data-nscript="afterInteractive"]').forEach(script => script.remove());
    vi.unstubAllEnvs();
  });

  it("keeps one global script per stable ID through Strict Mode and a remount", () => {
    const scripts = () => [...document.querySelectorAll<HTMLScriptElement>('script[data-nscript="afterInteractive"]')];
    const first = render(<StrictMode><><AdsterraGlobalScripts /><NativeAd /></></StrictMode>);

    expect(scripts().map(script => script.id)).toEqual([
      adsterraScripts.socialBar.id,
      adsterraScripts.native.id,
    ]);
    expect(new Set(scripts().map(script => script.id)).size).toBe(2);
    expect(document.querySelectorAll(`#${adsterraScripts.native.containerId}`)).toHaveLength(1);

    first.unmount();
    render(<AdsterraGlobalScripts />);
    expect(scripts()).toHaveLength(2);
    expect(new Set(scripts().map(script => script.id)).size).toBe(2);
  });
});
