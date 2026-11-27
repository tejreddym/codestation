import { describe, expect, it } from "vitest";
import { metadataForRoute } from "@/config/site";
import { ogImagePathForRoute, resolveOgCardData } from "./card-data";

describe("dynamic Open Graph social card data", () => {
  it("resolves tool cards with station badge, description, and local branding", () => {
    const data = resolveOgCardData({ type: "tool", slug: "json-formatter" });
    expect(data.isDefault).toBe(false);
    expect(data.title).toBe("JSON Formatter");
    expect(data.badge).toBe("JSON & DATA");
    expect(data.footerBadge).toBe("100% Local · Browser-Only");
    expect(data.brandHost).toBe("codestation.in");
    expect(data.description.length).toBeGreaterThan(20);
  });

  it("resolves station cards with tool counts and falls back to default home card", () => {
    const station = resolveOgCardData({ type: "station", slug: "encoding" });
    expect(station.isDefault).toBe(false);
    expect(station.title).toBe("Encoding Station");
    expect(station.badge).toContain("TOOLS");

    const fallback = resolveOgCardData({ type: "tool", slug: "non-existent-tool" });
    expect(fallback.isDefault).toBe(true);
    expect(fallback.title).toBe("Code Station");
  });

  it("wires openGraph.images and twitter.images for tool and station routes", () => {
    expect(ogImagePathForRoute("/tools/json-formatter")).toBe("/og?type=tool&slug=json-formatter");
    expect(ogImagePathForRoute("/stations/json-data")).toBe("/og?type=station&slug=json-data");

    const toolMeta = metadataForRoute("/tools/json-formatter", "JSON Formatter", "Format JSON locally.");
    expect(toolMeta.openGraph?.images).toEqual([
      expect.objectContaining({ url: expect.stringContaining("/og?type=tool&slug=json-formatter"), width: 1200, height: 630 }),
    ]);
    expect(toolMeta.twitter).toMatchObject({
      card: "summary_large_image",
      images: [expect.stringContaining("/og?type=tool&slug=json-formatter")],
    });
  });
});
