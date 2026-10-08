import { afterEach, describe, expect, it, vi } from "vitest";
import { canvasFor, decode, verifyOutput } from "./native";
import { rasterBytes } from "./test-fixtures";

describe("native adapter lifetime and unavailable-feature boundaries (mocked)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it("releases URL/image references on successful image-element fallback", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-test"), revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const removeAttribute = vi.fn();
    class MockImage {
      onload: (() => void) | null = null; onerror: (() => void) | null = null; naturalWidth = 4; naturalHeight = 2;
      removeAttribute = removeAttribute;
      set src(value: string) { expect(value).toBe("blob:local-test"); this.onload?.(); }
    }
    vi.stubGlobal("Image", MockImage);
    const decoded = await decode(new Blob([rasterBytes()], { type: "image/png" })); expect(decoded.width).toBe(4); decoded.release();
    expect(createObjectURL).toHaveBeenCalledOnce(); expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-test"); expect(removeAttribute).toHaveBeenCalledWith("src");
    expect((decoded.source as unknown as MockImage).onload).toBeNull();
  });
  it.each(["error", "oversized"])("releases fallback URL on %s", async mode => {
    vi.stubGlobal("createImageBitmap", undefined); vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-test"); const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {}); const removeAttribute = vi.fn();
    class MockImage {
      onload: (() => void) | null = null; onerror: (() => void) | null = null; naturalWidth = mode === "oversized" ? 8193 : 4; naturalHeight = 2;
      removeAttribute = removeAttribute;
      set src(_: string) { if (mode === "error") this.onerror?.(); else this.onload?.(); }
    }
    vi.stubGlobal("Image", MockImage); await expect(decode(new Blob())).rejects.toThrow(); expect(revoke).toHaveBeenCalledOnce(); expect(removeAttribute).toHaveBeenCalledOnce();
  });
  it("closes a bitmap if its postdecode dimensions violate the bound", async () => {
    const close = vi.fn(); vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 8193, height: 1, close })));
    await expect(decode(new Blob())).rejects.toThrow(/Dimensions/); expect(close).toHaveBeenCalledOnce();
  });
  it("truthfully errors when there is no native decoder", async () => {
    vi.stubGlobal("createImageBitmap", undefined); vi.stubGlobal("Image", undefined); await expect(decode(new Blob())).rejects.toThrow(/unavailable/);
  });
  it.each(["null", "throw"])("releases canvas on unavailable context %s", mode => {
    const canvas = { width: 0, height: 0, getContext: () => { if (mode === "throw") throw new Error("no"); return null; } };
    vi.stubGlobal("document", { createElement: () => canvas }); expect(() => canvasFor(4, 2)).toThrow(/unavailable/); expect(canvas.width).toBe(0); expect(canvas.height).toBe(0);
  });
  it("rejects output dimension mismatches even with a matching MIME", async () => {
    await expect(verifyOutput(new Blob([rasterBytes()], { type: "image/png" }), "image/png", 8, 4)).rejects.toThrow(/dimensions/);
  });
});
