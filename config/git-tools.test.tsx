// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { getTool, tools } from "./tools";
import { getStation } from "./stations";
import ToolPage, { generateMetadata } from "@/app/tools/[slug]/page";

vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);

describe("Git station census", () => {
  it("lists seven owned tools plus the shared gitignore generator", () => {
    const station = getStation("git");
    expect(station).toMatchObject({ route: "/stations/git", toolCount: 8 });
    expect(tools.filter(tool => tool.category === "Git & Version Control")).toHaveLength(7);
    expect(station?.toolList).toContain("conflict-parse");
    expect(station?.toolList).toContain("gitignore-generator");
    expect(getTool("conflict-parse")?.category).toBe("Git & Version Control");
    expect(getTool("gitignore-generator")?.category).not.toBe("Git & Version Control");
  });

  it("routes the recategorised conflict resolver to the Git station", async () => {
    const params = Promise.resolve({ slug: "conflict-parse" });
    expect(await generateMetadata({ params })).toMatchObject({ alternates: { canonical: "/tools/conflict-parse" } });
    render(await ToolPage({ params }));
    expect(screen.getByRole("link", { name: "Browse the Git & Version Control station →" }).getAttribute("href")).toBe("/stations/git");
  });
});
