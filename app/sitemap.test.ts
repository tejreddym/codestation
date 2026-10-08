import { readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tools } from "@/config/tools";
import { stations } from "@/config/stations";

function staticPagePaths(directory = "app", segments: string[] = []): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && !entry.name.startsWith("[") && !entry.name.startsWith("_")) {
      return staticPagePaths(join(directory, entry.name), [...segments, entry.name]);
    }
    return entry.name === "page.tsx" ? [`/${segments.join("/")}`] : [];
  });
}

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function sitemapFor(origin: string) {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin);
  vi.resetModules();
  return (await import("./sitemap")).default();
}

describe("public XML sitemap", () => {
  it("includes every static page, implemented station and canonical tool exactly once", async () => {
    const origin = "https://code-station.example.test";
    const entries = await sitemapFor(origin);
    const expected = [...new Set([
      ...staticPagePaths(),
      ...stations.map(station => station.route),
      ...tools.map(tool => `/tools/${tool.slug}`),
    ])].sort();
    expect(entries.map(entry => new URL(entry.url).pathname).sort()).toEqual(expected);
    expect(new Set(entries.map(entry => entry.url)).size).toBe(entries.length);
    expect(entries.every(entry => new URL(entry.url).origin === origin)).toBe(true);
  });

  it("excludes query variants, fragments, redirects and pending stations", async () => {
    const entries = await sitemapFor("https://code-station.example.test/");
    const urls = entries.map(entry => entry.url);
    expect(urls.every(url => !new URL(url).search && !new URL(url).hash)).toBe(true);
    expect(urls.some(url => url.endsWith("/tools/timestamp-converter"))).toBe(false);
    expect(urls.some(url => url.includes("/stations/developer-math"))).toBe(false);
    expect(urls.every(url => !url.includes(".test//"))).toBe(true);
  });

  it("does not publish invented URLs without a verified public origin", async () => {
    expect(await sitemapFor("")).toEqual([]);
    expect(await sitemapFor("http://localhost:3000")).toEqual([]);
  });
});
