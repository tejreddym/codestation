import { describe, expect, it } from "vitest";
import { capabilitiesFor, capabilityForRoute, conversionCapabilities } from "./conversion-capabilities";
import { getTool } from "./tools";
describe("smart converter capability registry", () => {
  it("has unique implemented routes and genuine target metadata", () => {
    const duplicateRoutes = conversionCapabilities.filter(item => item.route === "/tools/color-converter");
    expect(new Set(conversionCapabilities.filter(item => item.route !== "/tools/color-converter").map(item => item.route)).size).toBe(conversionCapabilities.length - duplicateRoutes.length);
    for (const item of conversionCapabilities) { expect(item.route).toMatch(/^\/tools\//); if (item.routeMode !== "stable-numeric") expect(item.source).not.toBe(item.target); }
    for (const item of conversionCapabilities) expect(getTool(item.route.slice("/tools/".length))).toBeTruthy();
    expect(capabilityForRoute("/tools/png-to-webp")).toMatchObject({ family: "image-raster", source: "png", target: "webp", mime: "image/webp" });
  });
  it("filters targets by validated source family", () => {
    expect(capabilitiesFor("image-raster", "png").map(item => item.target)).toEqual(["jpg", "webp"]);
    expect(capabilitiesFor("spreadsheet", "xlsx").map(item => item.target)).toEqual(["csv", "json", "tsv"]);
    expect(capabilitiesFor("markdown", "html").map(item => item.target)).toEqual(["markdown"]);
  });
});
