// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import ToolPage, { generateMetadata, generateStaticParams } from "@/app/tools/[slug]/page";
import nextConfig from "../next.config";
import { encodingTools, encodingToolIds, encodingLegacyRedirects, getEncodingDefinition } from "./encoding-tools";
import { tools, getTool } from "./tools";

vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);
const expectedSlugs = `base64-encoder base64-decoder url-encoder url-decoder url-component-encoder url-component-decoder jwt-decoder html-encoder html-decoder html-entity-encoder html-entity-decoder text-to-unicode unicode-to-text unicode-escape-encoder unicode-escape-decoder text-to-hex hex-to-text hexadecimal-encoder hexadecimal-decoder binary-encoder binary-decoder text-to-ascii ascii-to-text base32-encoder base32-decoder base58-encoder base58-decoder base64-url-encoder base64-url-decoder data-uri-encoder data-uri-decoder punycode-encoder punycode-decoder text-to-octal octal-to-text`.split(" ");

describe("Encoding canonical registry and page contracts", () => {
  it("registers exactly all 35 specified routes once through the existing registry", () => {
    expect(encodingTools.map(tool => tool.slug).sort()).toEqual(expectedSlugs.sort());
    expect([...encodingToolIds].sort()).toEqual(expectedSlugs.sort());
    expect(tools.filter(tool => tool.category === "Encoding")).toEqual([...encodingTools]);
    expect(new Set(tools.map(tool => tool.id)).size).toBe(tools.length);
    expect(new Set(tools.map(tool => tool.slug)).size).toBe(tools.length);
    expect(new Set(encodingTools.map(tool => tool.description)).size).toBe(35);
  });
  it.each(encodingTools)("$slug has synchronized canonical, title, H1, related links and factual content", async tool => {
    const params = Promise.resolve({ slug: tool.slug });
    expect(await generateMetadata({ params })).toMatchObject({ title: tool.name, description: tool.description, alternates: { canonical: `/tools/${tool.slug}` }, robots: { index: false, follow: false } });
    expect(generateStaticParams()).toContainEqual({ slug: tool.slug });
    render(await ToolPage({ params }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name);
    expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How to use it" })).toBeTruthy();
    const crumbs = within(screen.getByRole("navigation", { name: "Breadcrumb" })).getAllByRole("link");
    expect(crumbs.at(-1)?.getAttribute("href")).toBe(`/tools/${tool.slug}`);
    const related = within(screen.getByRole("navigation", { name: "Related tools" })).getAllByRole("link");
    for (const link of related) expect(getTool(link.getAttribute("href")!.replace("/tools/", ""))?.category).toBe("Encoding");
    expect(tool.encodingContract.fields.map(field => field.name)).toEqual(tool.slug === "data-uri-encoder" ? ["mime", "input"] : ["input"]);
    if (tool.pairedTool) {
      const paired = getEncodingDefinition(tool.pairedTool)!;
      expect(paired.pairedTool).toBe(tool.id); expect(paired.pairId).toBe(tool.pairId);
      expect(paired.name).not.toBe(tool.name); expect(paired.description).not.toBe(tool.description);
      expect(paired.encodingContract.fields.at(-1)?.label).not.toBe(tool.encodingContract.fields.at(-1)?.label);
      expect(paired.encodingContract.example.input).not.toBe(tool.encodingContract.example.input);
      expect(paired.encodingContract.action).not.toBe(tool.encodingContract.action);
      expect(paired.encodingContract.outputLabel).not.toBe(tool.encodingContract.outputLabel);
      expect(related.some(link => link.getAttribute("href") === `/tools/${paired.slug}`)).toBe(true);
    }
  });
  it.each(Object.entries(encodingLegacyRedirects))("redirects legacy %s to %s without duplicate tools", async (source, destination) => {
    expect(getTool(source)).toBeUndefined();
    expect(await nextConfig.redirects!()).toContainEqual({ source: `/tools/${source}`, destination: `/tools/${destination}`, permanent: true });
  });
  it("uses existing theme tokens, stacking, focus and touch rules (static CSS check)", () => {
    const css = readFileSync("components/EncodingStation.module.css", "utf8");
    expect(css).toContain("max-width: 760px");
    expect(css).toContain("var(--surface)"); expect(css).toContain("var(--ink)");
    expect(css).toContain("min-height: 44px"); expect(css).toContain(":focus-visible");
    expect(css).toContain("minmax(0, 1fr)"); expect(css).toContain("overflow-wrap: anywhere");
  });
});
