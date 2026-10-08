// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConverterSessionProvider, useConverterSession } from "./ConverterSession";
describe("memory-only converter sessions", () => {
  it("preserves source by family and version, then clears deterministically", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <ConverterSessionProvider>{children}</ConverterSessionProvider>;
    const { result } = renderHook(() => useConverterSession(), { wrapper });
    const file = new File(["source"], "source.txt", { type: "text/plain" });
    act(() => result.current.set({ family: "image-raster", format: "png", value: file }));
    expect(result.current.get("image-raster")).toMatchObject({ format: "png", value: file, version: 1 });
    act(() => result.current.set({ family: "image-raster", format: "png", value: file }));
    expect(result.current.get("image-raster")?.version).toBe(2);
    act(() => result.current.clear("image-raster")); expect(result.current.get("image-raster")).toBeUndefined();
  });
});
