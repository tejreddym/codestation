// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { imageTools } from "./image-tools";
import { getTool, tools } from "./tools";
import { getStation } from "./stations";
import ToolPage, { generateMetadata } from "@/app/tools/[slug]/page";
vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);
describe("Image contracts and routes", () => {
  it("exposes 28 genuine-capability workflows with one shared favicon and no unverified AVIF encoding", () => {
    expect(imageTools).toHaveLength(28); expect(getStation("image")?.toolCount).toBe(28);
    expect(getTool("png-to-avif")).toBeUndefined(); expect(getTool("jpg-to-avif")).toBeUndefined();
    expect(tools.filter(tool => tool.id === "favicon-generator")).toHaveLength(1);
    expect(getStation("web")?.toolList).toContain("favicon-generator");
  });
  it.each(imageTools)("$id has direct metadata, input/output declarations and reciprocal pairs", async tool => {
    const params = Promise.resolve({ slug: tool.id });
    expect(await generateMetadata({ params })).toMatchObject({ alternates: { canonical: `/tools/${tool.id}` } });
    render(await ToolPage({ params })); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name);
    expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse the Image station →" }).getAttribute("href")).toBe("/stations/image");
    if (tool.pairedTool) expect(imageTools.find(entry => entry.id === tool.pairedTool)?.pairedTool).toBe(tool.id);
  });
});
