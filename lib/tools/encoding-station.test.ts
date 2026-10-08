import { describe, expect, it } from "vitest";
import { tools } from "../../config/tools";
import {
  decodeAscii, decodeBase32, decodeBase58, decodeBase64Url, decodeBinary, decodeDataUri,
  decodeHtmlEntities, decodeOctal, decodePunycode, decodeUnicodeEscapes, decodeUrlComponent,
  encodeAscii, encodeBase32, encodeBase58, encodeBase64Url, encodeBinary, encodeDataUri,
  encodeHtmlEntities, encodeOctal, encodePunycode, encodeUnicodeEscapes, encodeUrlComponent,
  runEncoding,
} from "./encoding-station";

describe("Encoding Station", () => {
  it("round-trips UTF-8 through binary, Base32, Base58, and Base64 URL", () => {
    const value = "Hello, 世界 🚀";
    expect(decodeBinary(encodeBinary(value))).toBe(value);
    expect(decodeBase32(encodeBase32(value))).toBe(value);
    expect(decodeBase58(encodeBase58(value))).toBe(value);
    expect(decodeBase64Url(encodeBase64Url(value))).toBe(value);
    expect(encodeBase32("foo")).toBe("MZXW6===");
  });

  it("supports ASCII, octal, hexadecimal-compatible dispatch, and Unicode escapes", () => {
    expect(decodeAscii(encodeAscii("Code Station"))).toBe("Code Station");
    expect(decodeOctal(encodeOctal("Code Station"))).toBe("Code Station");
    expect(decodeUnicodeEscapes(encodeUnicodeEscapes("Code 🚀"))).toBe("Code 🚀");
    expect(runEncoding("hex", "decode", "43 6f 64 65")).toBe("Code");
  });

  it("handles URI, entity, URL component, and Punycode conversions", () => {
    expect(decodeDataUri(encodeDataUri("hello world"))).toBe("hello world");
    expect(decodeDataUri("data:text/plain;base64,SGVsbG8=")).toBe("Hello");
    expect(decodeHtmlEntities(encodeHtmlEntities("<Code & Station>"))).toBe("<Code & Station>");
    expect(decodeUrlComponent(encodeUrlComponent("a value?"))).toBe("a value?");
    expect(encodePunycode("münich")).toBe("xn--mnich-kva");
    expect(decodePunycode("xn--mnich-kva")).toBe("münich");
  });

  it("accepts empty text for byte-oriented encodings", () => {
    expect(decodeBinary(encodeBinary(""))).toBe("");
    expect(decodeAscii(encodeAscii(""))).toBe("");
    expect(decodeOctal(encodeOctal(""))).toBe("");
  });

  it("keeps directional encoding tools paired", () => {
    for (const id of ["base32-encoder", "base58-encoder", "base64-url-encoder", "data-uri-encoder", "html-entity-encoder", "unicode-escape-encoder", "url-component-encoder", "hexadecimal-encoder"] as const) {
      const tool = tools.find((candidate) => candidate.id === id);
      const opposite = tool?.pairedTool && tools.find((candidate) => candidate.id === tool.pairedTool);
      expect(tool?.pairId).toBe(opposite?.pairId);
      expect(tool?.pairedTool).toBe(opposite?.id);
    }
  });
});
