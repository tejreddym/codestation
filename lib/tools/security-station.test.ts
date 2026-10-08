import { describe, expect, it } from "vitest";
import { compareHashes, crc32, md5, nanoid, parseUuid, sha1, sha256, ulid } from "./security-station";

describe("Security Station", () => {
  it("supports known legacy and CRC32 vectors", async () => {
    expect(md5("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(sha1("abc")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(crc32("123456789")).toBe("cbf43926");
    expect(await sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("parses UUIDs and generates constrained identifiers", () => {
    expect(parseUuid("550e8400-e29b-41d4-a716-446655440000")).toMatchObject({ version: 4, variant: "RFC 4122" });
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(nanoid(32)).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("compares hashes without case sensitivity", () => expect(compareHashes("ABcd", "abcd")).toBe(true));
});
