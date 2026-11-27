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

  it("returns manual-file notice for video-trimmer without arguments", async () => {
    const payload = JSON.parse(await dispatchToolExecution("video-trimmer")) as {
      status: string;
      category: string;
      canonicalUrl: string;
      notice: string;
    };
    expect(payload).toMatchObject({
      status: "manual-file-required",
      category: "Video",
      canonicalUrl: "https://codestation.in/tools/video-trimmer",
    });
    expect(payload.notice).toMatch(/file picker/);
    expect(payload.notice).toMatch(/all trimming stays in the browser/);
  });

  it("calculates trim specification for video-trimmer with start and end times", async () => {
    const payload = JSON.parse(
      await dispatchToolExecution("video-trimmer", "", { start: 2, end: 8.5, fps: 30 })
    ) as {
      status: string;
      category: string;
      canonicalUrl: string;
      trimSpecification: {
        startTime: number;
        endTime: number;
        durationSeconds: number;
        fps: number;
        totalFrames: number;
      };
      notice: string;
    };
    expect(payload.status).toBe("ready");
    expect(payload.category).toBe("Video");
    expect(payload.canonicalUrl).toBe("https://codestation.in/tools/video-trimmer");
    expect(payload.trimSpecification).toEqual({
      startTime: 2,
      endTime: 8.5,
      durationSeconds: 6.5,
      fps: 30,
      totalFrames: 195,
    });
    expect(payload.notice).toMatch(/zero server uploads/);
  });

  it("returns manual-file notice for video-trimmer with invalid or negative start time", async () => {
    const payloadNegative = JSON.parse(
      await dispatchToolExecution("video-trimmer", "", { start: -5, end: 5, fps: 30 })
    ) as { status: string };
    expect(payloadNegative.status).toBe("manual-file-required");

    const payloadInverted = JSON.parse(
      await dispatchToolExecution("video-trimmer", "", { start: 10, end: 5, fps: 30 })
    ) as { status: string };
    expect(payloadInverted.status).toBe("manual-file-required");
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

  it("calculates invoice totals and returns structured payload for invoice-generator", async () => {
    const payload = JSON.parse(
      await dispatchToolExecution("invoice-generator", "", {
        invoiceNumber: "INV-TEST-001",
        currency: "USD",
        currencySymbol: "$",
        taxRate: 10,
        discount: 50,
        discountType: "fixed",
        items: [
          { id: "1", description: "Design Sprint", quantity: 1, unitPrice: 500 },
          { id: "2", description: "Code Review", quantity: 2, unitPrice: 250 },
        ],
      })
    ) as {
      category: string;
      invoiceNumber: string;
      totals: {
        subtotal: number;
        discountAmount: number;
        taxableAmount: number;
        taxAmount: number;
        total: number;
      };
      canonicalUrl: string;
    };

    expect(payload.category).toBe("Productivity");
    expect(payload.invoiceNumber).toBe("INV-TEST-001");
    // Subtotal: 500 + 500 = 1000
    // Discount: 50
    // Taxable: 950
    // Tax (10%): 95
    // Total: 950 + 95 = 1045
    expect(payload.totals.subtotal).toBe(1000);
    expect(payload.totals.discountAmount).toBe(50);
    expect(payload.totals.taxableAmount).toBe(950);
    expect(payload.totals.taxAmount).toBe(95);
    expect(payload.totals.total).toBe(1045);
    expect(payload.canonicalUrl).toBe("https://codestation.in/tools/invoice-generator");
  });
});
