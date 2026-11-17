// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { buildHomeMetadata, homeBrandedTitle, homeFaqs, homeTitle } from "@/app/home-metadata";

const origin = "https://code-station.example.test";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("homepage SEO metadata", () => {
  it("builds a keyword title, a 150-160 character description and an origin-guarded canonical", async () => {
    const metadata = buildHomeMetadata(origin, true);
    expect(metadata.title).toEqual({ absolute: homeBrandedTitle });
    const title = homeBrandedTitle;
    expect(title).toContain("381");
    expect(title).toContain("Developer Tools");
    expect(title.match(/\| Code Station/g)).toHaveLength(1);
    const description = String(metadata.description);
    expect(description.length).toBeGreaterThanOrEqual(150);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toContain("381");
    expect(description).toContain("30 stations");
    expect(description).toContain("no uploads");
    expect(metadata.alternates?.canonical).toBe(`${origin}/`);
    expect(metadata.openGraph).toMatchObject({ url: origin, siteName: "Code Station", type: "website" });
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({ url: `${origin}/brand/social/social-landscape-light-1200x630.png`, width: 1200, height: 630 }),
    ]);
    expect(metadata.twitter).toMatchObject({ card: "summary", title: homeTitle });
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it("omits origin-dependent canonical, Open Graph and Twitter tags without a verified origin", async () => {
    const metadata = buildHomeMetadata(undefined, false);
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();
    expect(metadata.twitter).toBeUndefined();
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("renders WebSite, WebApplication and FAQPage structured data whose answers match visible copy", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin);
    vi.stubEnv("SITE_INDEXING", "index");
    vi.resetModules();
    const { default: HomePage } = await import("@/app/page");
    const { container } = render(<HomePage />);

    const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')];
    expect(scripts).toHaveLength(1);
    const schema = JSON.parse(scripts[0].innerHTML) as Array<Record<string, unknown>>;
    expect(schema.map(entry => entry["@type"])).toEqual(["WebSite", "WebApplication", "FAQPage"]);
    expect(schema[0]).toMatchObject({ name: "Code Station", url: origin });
    expect(schema[1]).toMatchObject({
      "@type": "WebApplication",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "All (Web Browser)",
      browserRequirements: "Requires JavaScript. 100% in-browser. Zero server uploads.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    });
    const faq = schema[2] as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };
    expect(faq.mainEntity.map(item => item.name)).toEqual(homeFaqs.map(item => item.question));
    expect(faq.mainEntity.map(item => item.acceptedAnswer.text)).toEqual(homeFaqs.map(item => item.answer));

    const visibleText = container.textContent ?? "";
    for (const item of homeFaqs) {
      expect(visibleText).toContain(item.question);
      expect(visibleText).toContain(item.answer);
    }
  });

  it("keeps a single h1 and does not emit a global canonical from the layout", () => {
    const { container } = render(<HomePage />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelector("h1")?.textContent).toContain("Less friction.");
    const layout = readFileSync("app/layout.tsx", "utf8");
    expect(layout).not.toMatch(/alternates\s*:\s*\{\s*canonical/);
  });

  it("keeps current homepage and site copy on the 370+/381/30 baseline", () => {
    const sources = ["app/page.tsx", "components/HomeSearch.tsx", "config/site.ts", "components/DocsRepo.tsx"]
      .map(file => readFileSync(file, "utf8"))
      .join("\n");
    expect(sources).not.toMatch(/300\+ browser|29 stations|29 STATIONS|Image owns 29 tools/);
    expect(sources).toContain("381");
    expect(sources).toMatch(/370\+/);
    expect(sources).toContain("30 stations");
  });
});
