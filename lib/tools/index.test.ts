import { describe, expect, it } from "vitest";
import { tools } from "../../config/tools";
import { encodeBinary, decodeBinary, encodeBase32, decodeBase32, encodeBase58, decodeBase58, encodeBase64Url, decodeBase64Url, encodeUnicodeEscapes, decodeUnicodeEscapes, encodeOctal, decodeOctal } from "./encoding-station";
import { decodeBase64, encodeBase64, formatJson, minifyJson, validateJson, countText, generatePassword, generateUuid, jsonToYaml, yamlToJson, jsonToCsv, csvToJson, encodeHtml, decodeHtml, encodeHex, decodeHex, testRegex } from "./index";

describe("local-first tool helpers", () => {
  it("formats, validates, and minifies JSON", () => {
    expect(formatJson('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(minifyJson('{ "a": 1 }')).toBe('{"a":1}');
    expect(validateJson('{"a":true}')).toBe(true);
    expect(validateJson("not json")).toBe(false);
  });
  it("round-trips Unicode through Base64", () => expect(decodeBase64(encodeBase64("Hello, 世界"))).toBe("Hello, 世界"));
  it("counts text consistently", () => expect(countText("one two\nthree")).toEqual({ characters: 13, charactersNoSpaces: 11, words: 3, lines: 2 }));
  it("generates a UUID v4 and requested password length", () => {
    expect(generateUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(generatePassword({ length: 24, alphabet: "ab" })).toMatch(/^[ab]{24}$/);
  });
  it("rejects unsafe password requests", () => {
    expect(() => generatePassword({ length: 0 })).toThrow();
    expect(() => generatePassword({ length: 513 })).toThrow();
    expect(() => generatePassword({ length: 4, alphabet: "" })).toThrow();
  });
  it("converts JSON, YAML, and CSV with quoted values", () => {
    expect(jsonToYaml('{"name":"Code Station"}')).toContain("name: Code Station");
    expect(JSON.parse(yamlToJson("name: Code Station"))).toEqual({ name: "Code Station" });
    expect(jsonToCsv('[{"name":"Ada, Lovelace"}]')).toContain('"Ada, Lovelace"');
    expect(JSON.parse(csvToJson('name,role\n"Ada, Lovelace",Engineer'))[0].name).toBe("Ada, Lovelace");
  });
  it("handles encoding and regex inspection", () => {
    expect(decodeHtml(encodeHtml("<Code Station>"))).toBe("<Code Station>");
    expect(decodeHex(encodeHex("Hello"))).toBe("Hello");
    expect(JSON.parse(testRegex("Code", "g", "Code Station Code")).count).toBe(2);
  });
  it("keeps directional JSON Lines tools paired", () => {
    const forward = tools.find((tool) => tool.id === "json-to-jsonl");
    const reverse = tools.find((tool) => tool.id === "jsonl-to-json");
    expect(forward?.pairedTool).toBe(reverse?.id);
    expect(reverse?.pairedTool).toBe(forward?.id);
    expect(forward?.pairId).toBe(reverse?.pairId);
  });
  it("round-trips the new local encoding formats", () => {
    for (const pair of [[encodeBinary, decodeBinary], [encodeBase32, decodeBase32], [encodeBase58, decodeBase58], [encodeBase64Url, decodeBase64Url], [encodeUnicodeEscapes, decodeUnicodeEscapes], [encodeOctal, decodeOctal]] as const) expect(pair[1](pair[0]("Code Station 🚀"))).toBe("Code Station 🚀");
  });
});
