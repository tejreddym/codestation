import { describe, expect, it } from "vitest";
import { getVerifiedSiteOrigin, isIndexingEnabled, metadataForPage, siteConfig } from "./site";

describe("site origin and indexing policy", () => {
  it("accepts only a clean HTTPS origin", () => {
    expect(getVerifiedSiteOrigin("https://tools.example.test")).toBe("https://tools.example.test");
    for (const value of ["", "http://tools.example.test", "https://user:pass@tools.example.test", "https://tools.example.test/app", "https://tools.example.test/?q=x", "https://localhost", "https://127.0.0.1"]) {
      expect(getVerifiedSiteOrigin(value)).toBeUndefined();
    }
  });

  it("requires the explicit index setting and valid origin", () => {
    const origin = "https://tools.example.test";
    expect(isIndexingEnabled(origin, "index")).toBe(true);
    expect(isIndexingEnabled(origin, "true")).toBe(false);
    expect(isIndexingEnabled(undefined, "index")).toBe(false);
  });

  it("does not emit an unsafe canonical path", () => {
    const metadata = metadataForPage("/privacy?tracking=1", "Privacy", "Description");
    expect(String(metadata.alternates?.canonical ?? "")).not.toContain("tracking=1");
    expect(metadata.robots).toEqual(siteConfig.indexing ? { index: true, follow: true } : { index: false, follow: false });
  });
});
