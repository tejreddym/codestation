// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ToolPage, { generateMetadata, generateStaticParams } from "@/app/tools/[slug]/page";
import nextConfig from "../next.config";
import { securityTools, securityLegacyRedirects } from "./security-tools";
import { getTool, tools } from "./tools";
import { extendedTools } from "./extended-tools";

vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);
const expectedFields: Record<string, string[]> = {
  "uuid-generator": ["version"], "uuid-parser": ["input"], "password-generator": ["length", "uppercase", "lowercase", "numbers", "symbols"],
  "sha-256-generator": ["input"], "sha-384-generator": ["input"], "sha-512-generator": ["input"], "sha-1-generator": ["input"], "md5-generator": ["input"],
  "hmac-generator": ["message", "secret", "algorithm"], "crc32-generator": ["input"], "checksum-generator": ["input", "algorithm"], "hash-compare": ["hashA", "hashB"],
  "file-hash-generator": ["file", "algorithm"], "entropy-calculator": ["input"], "password-strength-checker": ["input"], "ulid-generator": [], "nanoid-generator": ["length"],
  "random-number-generator": ["minimum", "maximum", "count"], "random-string-generator": ["length", "characterSet"], "secure-token-generator": ["bytes", "encoding"],
  "hex-random-generator": ["bytes"], "secret-key-generator": ["keySize"],
};
describe("Security exact registry and route contracts", () => {
  it("contains 22 station identities plus the recategorised env-audit", () => {
    expect(securityTools.map(tool => tool.slug).sort()).toEqual(Object.keys(expectedFields).sort());
    expect(extendedTools.filter(tool => tool.category === "Security").map(tool => tool.id)).toEqual(["env-audit"]);
    expect(tools.filter(tool => tool.category === "Security").map(tool => tool.id)).toEqual([...securityTools.map(tool => tool.id), "env-audit"]);
    expect(new Set(tools.map(tool => tool.id)).size).toBe(tools.length);
    expect(new Set(tools.map(tool => tool.slug)).size).toBe(tools.length);
    expect(new Set(securityTools.map(tool => tool.description)).size).toBe(22);
  });
  it.each(securityTools)("$slug has exact fields and unique direct-route metadata/content", async tool => {
    expect(tool.securityContract.fields.map(field => field.name)).toEqual(expectedFields[tool.slug]);
    const params = Promise.resolve({ slug: tool.slug });
    expect(await generateMetadata({ params })).toMatchObject({ title: tool.seo.title, description: tool.description, alternates: { canonical: `/tools/${tool.slug}` }, robots: { index: false, follow: false } });
    expect(generateStaticParams()).toContainEqual({ slug: tool.slug });
    render(await ToolPage({ params }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name);
    expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How to use it" })).toBeTruthy();
    const links = within(screen.getByRole("navigation", { name: "Related tools" })).getAllByRole("link");
    for (const link of links) expect(getTool(link.getAttribute("href")!.replace("/tools/", ""))?.category).toBe("Security");
  });
  it("exposes exactly the specified algorithm/version/key-size choices", () => {
    const options = (slug: string, field: string) => securityTools.find(tool => tool.slug === slug)!.securityContract.fields.find(item => item.name === field)?.options;
    expect(options("uuid-generator", "version")).toEqual(["4", "7"]);
    expect(options("hmac-generator", "algorithm")).toEqual(["HMAC-SHA-256", "HMAC-SHA-384", "HMAC-SHA-512"]);
    expect(options("checksum-generator", "algorithm")).toEqual(["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512", "CRC32"]);
    expect(options("file-hash-generator", "algorithm")).toEqual(["SHA-1", "SHA-256", "SHA-384", "SHA-512"]);
    expect(options("secret-key-generator", "keySize")).toEqual(["128", "192", "256"]);
  });
  it.each(Object.entries(securityLegacyRedirects))("redirects legacy %s to %s", async (source, destination) => {
    expect(getTool(source)).toBeUndefined();
    expect(await nextConfig.redirects!()).toContainEqual({ source: `/tools/${source}`, destination: `/tools/${destination}`, permanent: true });
  });
  it("uses the shared output, focus and responsive contracts", () => {
    const css = readFileSync("components/SecurityStation.module.css", "utf8");
    const shared = readFileSync("components/ui/ui.module.css", "utf8");
    const tokens = readFileSync("app/styles/tokens.css", "utf8");
    expect(css).toContain("var(--space-4)");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(shared).toContain("white-space: pre-wrap");
    expect(shared).toMatch(/overflow: auto/);
    expect(shared).toContain("min-height: var(--control-h-md)");
    expect(shared).toContain(":focus-visible");
    expect(tokens).toContain("--surface");
    expect(tokens).toContain("--ink");
  });
});
