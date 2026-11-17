import { describe, expect, it } from "vitest";
import { dispatchToolExecution } from "./dispatcher";

describe("audio WebMCP dispatcher", () => {
  it.each(["audio-trimmer", "audio-compressor", "audio-merger", "audio-converter"])(
    "returns an honest manual-file notice for %s",
    async (toolId) => {
      const payload = JSON.parse(await dispatchToolExecution(toolId, "", { threshold: -24 })) as {
        status: string;
        category: string;
        canonicalUrl: string;
        notice: string;
      };
      expect(payload).toMatchObject({
        status: "manual-file-required",
        category: "Audio",
        canonicalUrl: `https://codestation.in/tools/${toolId}`,
      });
      expect(payload.notice).toMatch(/file picker/);
      expect(payload.notice).toMatch(/WebMCP cannot read an audio file/);
      expect(payload.notice).toMatch(/no audio is processed by this call/);
    },
  );
});
