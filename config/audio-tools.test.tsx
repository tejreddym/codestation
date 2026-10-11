// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { audioTools } from "./audio-tools";
import { getStation } from "./stations";
import ToolPage, { generateMetadata } from "@/app/tools/[slug]/page";

vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);

it("registers exactly 1 Audio contract", () => {
  expect(audioTools).toHaveLength(1);
  expect(getStation("audio")).toMatchObject({ route: "/stations/audio", toolCount: 1 });
});

it.each(audioTools)("$id public direct metadata/contract", async (tool) => {
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
    screen.getByRole("link", { name: "Browse the Audio station →" }).getAttribute("href")
  ).toBe("/stations/audio");
});
