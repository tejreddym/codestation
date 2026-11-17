import { describe, expect, it } from "vitest";
import { dispatchToolExecution } from "./dispatcher";

describe("PDF WebMCP dispatcher", () => {
  it.each(["pdf-to-text", "pdf-to-images", "pdf-reorder-pages"])(
    "returns an honest manual-file notice for %s",
    async (toolId) => {
      const payload = JSON.parse(await dispatchToolExecution(toolId, "", { range: "1-2" })) as {
        status: string;
        category: string;
        canonicalUrl: string;
        notice: string;
      };
      expect(payload).toMatchObject({
        status: "manual-file-required",
        category: "PDF",
        canonicalUrl: `https://codestation.in/tools/${toolId}`,
      });
      expect(payload.notice).toMatch(/file picker/);
      expect(payload.notice).toMatch(/WebMCP cannot read a file/);
      expect(payload.notice).toMatch(/no document is processed by this call/);
    },
  );

  it("keeps the generic fallback for other registered PDF tools", async () => {
    const payload = JSON.parse(await dispatchToolExecution("pdf-merge", "local-test")) as {
      status: string;
      echo?: string;
    };
    expect(payload.status).toBe("ready");
    expect(payload.echo).toBe("local-test");
  });
});
