// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { compressionTools, compressionToolIds } from "./compression-tools";
import { getStation } from "./stations";
import ToolPage, { generateMetadata } from "@/app/tools/[slug]/page";

vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);

it("registers exactly 5 Compression tools", () => {
  expect(compressionTools).toHaveLength(5);
  expect(compressionToolIds).toEqual([
    "zip-extractor",
    "zip-creator",
    "gzip-compressor",
    "gzip-decompressor",
    "tar-inspector",
  ]);
  const station = getStation("compression");
  expect(station).toMatchObject({
    id: "compression",
    name: "Compression",
    route: "/stations/compression",
    toolCount: 5,
  });
});

it.each(compressionTools)("$id public direct metadata/contract", async (tool) => {
  const params = Promise.resolve({ slug: tool.slug });
  expect(await generateMetadata({ params })).toMatchObject({
    title: tool.seo.title,
    alternates: { canonical: `/tools/${tool.slug}` },
  });
  render(await ToolPage({ params }));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name);
  expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "How to use it?" })).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Browse the Compression station →" }).getAttribute("href")
  ).toBe("/stations/compression");
});
