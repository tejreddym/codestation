import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adsterraScripts, isAdsterraFormatEnabled } from "./ads";

describe("Adsterra configuration", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ADS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_ADS_SOCIAL_BAR_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_ADS_NATIVE_ENABLED", "true");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("keeps the supplied URLs, stable IDs, and one native container identity", () => {
    expect(adsterraScripts.socialBar).toMatchObject({
      id: "adsterra-social-bar",
      src: "https://bauval.org/14/63bf50be8c148bc60eb10a44e5ad23b3",
    });
    expect(adsterraScripts.native).toMatchObject({
      id: "adsterra-native-banner",
      src: "https://bauval.org/21/14efe1c7efaabb7ed1d8cdc2a828d40d",
      containerId: "container-14efe1c7efaabb7ed1d8cdc2a828d40d",
    });

    const ids = Object.values(adsterraScripts).map(script => script.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("requires production and exact opt-in values", () => {
    expect(isAdsterraFormatEnabled("socialBar")).toBe(true);
    expect(isAdsterraFormatEnabled("native")).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    expect(isAdsterraFormatEnabled("socialBar")).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ADS_ENABLED", "TRUE");
    expect(isAdsterraFormatEnabled("socialBar")).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_ADS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_ADS_NATIVE_ENABLED", "1");
    expect(isAdsterraFormatEnabled("native")).toBe(false);
  });

  it("allows each format to be disabled independently", () => {
    vi.stubEnv("NEXT_PUBLIC_ADS_SOCIAL_BAR_ENABLED", "false");
    expect(isAdsterraFormatEnabled("socialBar")).toBe(false);
    expect(isAdsterraFormatEnabled("native")).toBe(true);

    vi.stubEnv("NEXT_PUBLIC_ADS_NATIVE_ENABLED", "false");
    expect(isAdsterraFormatEnabled("native")).toBe(false);
  });
});
