import { describe, expect, it } from "vitest";
import { jpegExif } from "./metadata";
import { rasterBytes } from "./test-fixtures";

/** Synthetic APP1 fixture validates TIFF parsing only, not native decoding. */
function exif(little = true): Uint8Array {
  const bytes = new Uint8Array(48), view = new DataView(bytes.buffer);
  bytes.set([255, 216, 255, 225]); view.setUint16(4, 44); bytes.set([69, 120, 105, 102, 0, 0], 6);
  bytes.set(little ? [73, 73] : [77, 77], 12); view.setUint16(14, 42, little); view.setUint32(16, 8, little); view.setUint16(20, 2, little);
  view.setUint16(22, 0x0112, little); view.setUint16(24, 3, little); view.setUint32(26, 1, little); view.setUint16(30, 6, little);
  view.setUint16(34, 0x010f, little); view.setUint16(36, 2, little); view.setUint32(38, 4, little); bytes.set([65, 67, 77, 0], 42);
  // Four-byte next-directory pointer after the second entry.
  const complete = new Uint8Array(50); complete.set(bytes); new DataView(complete.buffer).setUint16(4, 46); return complete;
}
describe("actual bounded JPEG EXIF", () => {
  it.each([true, false])("parses real values in %s endian TIFF", little => expect(jpegExif(exif(little))).toEqual({ orientation: 6, make: "ACM" }));
  it("does not infer metadata for other images or EXIF-free JPEG", () => { expect(jpegExif(rasterBytes())).toEqual({}); expect(jpegExif(rasterBytes("image/jpeg"))).toEqual({}); });
  it("rejects malformed directory offsets and entry counts", () => {
    const badOffset = exif(); new DataView(badOffset.buffer).setUint32(16, 9999, true); expect(() => jpegExif(badOffset)).toThrow(/EXIF/);
    const badCount = exif(); new DataView(badCount.buffer).setUint16(20, 513, true); expect(() => jpegExif(badCount)).toThrow(/EXIF/);
  });
  it("rejects invalid ASCII termination and out-of-bounds values", () => {
    const badText = exif(); badText[45] = 65; expect(() => jpegExif(badText)).toThrow(/EXIF/);
    const outOfBounds = exif(); new DataView(outOfBounds.buffer).setUint32(38, 100, true); new DataView(outOfBounds.buffer).setUint32(42, 9999, true); expect(() => jpegExif(outOfBounds)).toThrow(/EXIF/);
  });
});
