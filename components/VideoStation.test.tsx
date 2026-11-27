// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import VideoStation from "./VideoStation";

afterEach(cleanup);

describe("Video station adapter", () => {
  it.each(["light", "dark"])("renders the existing video thumbnail workspace in %s theme", async theme => {
    document.documentElement.dataset.theme = theme;
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<VideoStation toolId="video-thumbnail-generator" />);
    const file = (await screen.findByLabelText("Video file")) as HTMLInputElement;
    expect(file.id).toBe("video-thumbnail-file");
    expect(file.accept).toContain("video/*");
    expect(screen.getByText("Choose a local video, then capture the playhead frame or evenly spaced thumbnails.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Capture current frame" })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    document.documentElement.removeAttribute("data-theme");
  });

  it.each(["light", "dark"])("renders the video trimmer workspace in %s theme with zero network traffic", async theme => {
    document.documentElement.dataset.theme = theme;
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<VideoStation toolId="video-trimmer" />);
    expect(screen.getByText("Choose a local video file (.mp4, .webm, .mov, .m4v, .ogv) to trim in your browser.")).toBeTruthy();
    expect(screen.getByText("Select Video File")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Video Preview & Timeline" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Precision Trim Points" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Export Settings" })).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    document.documentElement.removeAttribute("data-theme");
  });
});
