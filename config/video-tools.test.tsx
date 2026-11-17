// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { videoTools, videoToolIds } from "./video-tools";
import { imageTools } from "./image-tools";
import { getTool, tools } from "./tools";
import { getStation } from "./stations";
import ToolPage, { generateMetadata, generateStaticParams } from "@/app/tools/[slug]/page";

vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);

describe("Video station and tool contracts", () => {
  it("owns exactly one video tool and exposes a dedicated station", () => {
    expect(videoToolIds).toEqual(["video-thumbnail-generator"]);
    expect(videoTools).toHaveLength(1);
    expect(tools.filter(tool => tool.category === "Video").map(tool => tool.id)).toEqual(videoToolIds);
    expect(getStation("video")).toMatchObject({ name: "Video", route: "/stations/video", toolCount: 1, toolList: ["video-thumbnail-generator"] });
    expect(getStation("video")?.relatedStations).toEqual(["image", "audio", "productivity"]);
    expect((imageTools as readonly { id: string }[]).some(tool => tool.id === "video-thumbnail-generator")).toBe(false);
    expect(getStation("image")?.toolList).not.toContain("video-thumbnail-generator");
  });

  it("keeps metadata and renders the canonical Video station link", async () => {
    const tool = videoTools[0];
    const params = Promise.resolve({ slug: tool.slug });
    expect(generateStaticParams()).toContainEqual({ slug: tool.slug });
    expect(await generateMetadata({ params })).toMatchObject({ title: tool.seo.title, alternates: { canonical: `/tools/${tool.slug}` } });
    expect(String(tool.seo.title)).not.toContain("| Code Station");
    render(await ToolPage({ params }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name);
    expect(screen.getByRole("link", { name: "Browse the Video station →" }).getAttribute("href")).toBe("/stations/video");
    expect(getTool(tool.slug)?.category).toBe("Video");
  });
});
