import { describe, expect, it } from "vitest";
import { dispatchToolExecution } from "./dispatcher";

describe("video and productivity WebMCP dispatcher", () => {
  it("returns an honest manual-file notice for video thumbnails", async () => {
    const payload = JSON.parse(await dispatchToolExecution("video-thumbnail-generator", "", { frames: 3 })) as {
      status: string;
      category: string;
      canonicalUrl: string;
      notice: string;
    };
    expect(payload).toMatchObject({
      status: "manual-file-required",
      category: "Image",
      canonicalUrl: "https://codestation.in/tools/video-thumbnail-generator",
    });
    expect(payload.notice).toMatch(/file picker/);
    expect(payload.notice).toMatch(/WebMCP cannot read a file/);
    expect(payload.notice).toMatch(/no frame is captured by this call/);
  });

  it("returns an honest manual-UI notice for the Pomodoro timer", async () => {
    const payload = JSON.parse(await dispatchToolExecution("pomodoro-timer")) as {
      status: string;
      category: string;
      canonicalUrl: string;
      notice: string;
    };
    expect(payload).toMatchObject({
      status: "manual-ui-required",
      category: "Productivity",
      canonicalUrl: "https://codestation.in/tools/pomodoro-timer",
    });
    expect(payload.notice).toMatch(/visible Start, Pause, Resume, Reset and Skip controls/);
    expect(payload.notice).toMatch(/no session is started by this call/);
  });
});
