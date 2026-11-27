import { describe, expect, it } from "vitest";
import {
  MAX_PERMALINK_HASH_LENGTH,
  buildToolPermalinkUrl,
  decodePermalinkHash,
  encodeToolPermalink,
  extractPermalinkToken,
  fromBase64Url,
  toBase64Url,
} from "./permalink";

describe("URL hash state permalinks", () => {
  it("encodes and decodes Unicode input and control options", async () => {
    const encoded = await encodeToolPermalink({
      input: '{"station":"Code Station 🚀","values":[1,2,3]}',
      controls: { indent: 2, sortKeys: true, nested: { mode: "strict" } },
    });

    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.hash.startsWith("#state=")).toBe(true);

    const decoded = await decodePermalinkHash(encoded.hash);
    expect(decoded).toEqual({
      v: 1,
      input: '{"station":"Code Station 🚀","values":[1,2,3]}',
      controls: { indent: 2, sortKeys: true, nested: { mode: "strict" } },
    });
  });

  it("supports plain base64url fallback encoding/decoding and #s= short alias", async () => {
    const encoded = await encodeToolPermalink(
      {
        input: "hello world",
        controls: { uppercase: true },
      },
      { compress: false }
    );

    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.token.startsWith("p.")).toBe(true);

    const shortAliasHash = encoded.hash.replace("#state=", "#s=");
    expect(extractPermalinkToken(shortAliasHash)).toBe(encoded.token);

    const decoded = await decodePermalinkHash(`https://codestation.in/tools/base64-encoder${shortAliasHash}`);
    expect(decoded).toEqual({
      v: 1,
      input: "hello world",
      controls: { uppercase: true },
    });
  });

  it("uses deflate-raw compression when CompressionStream reduces payload size", async () => {
    const repetitive = "Code Station private developer workbench\n".repeat(40);
    const compressed = await encodeToolPermalink({ input: repetitive }, { compress: true });
    const plain = await encodeToolPermalink({ input: repetitive }, { compress: false });

    expect(compressed.ok).toBe(true);
    expect(plain.ok).toBe(true);
    if (!compressed.ok || !plain.ok) return;

    if (typeof CompressionStream === "function") {
      expect(compressed.token.startsWith("z.")).toBe(true);
      expect(compressed.hash.length).toBeLessThan(plain.hash.length);
    }

    const decoded = await decodePermalinkHash(compressed.hash);
    expect(decoded?.input).toBe(repetitive);
  });

  it("skips File, Blob, ArrayBuffer, and function inputs cleanly", async () => {
    const file = new File(["binary"], "secret.bin", { type: "application/octet-stream" });
    const blob = new Blob(["abc"]);
    const buffer = new ArrayBuffer(8);

    const binaryOnly = await encodeToolPermalink({
      input: file,
      controls: {
        file,
        blob,
        buffer,
        fn: () => "skip",
      },
    });
    expect(binaryOnly.ok).toBe(false);
    if (!binaryOnly.ok) {
      expect(binaryOnly.reason).toBe("empty");
    }

    const mixed = await encodeToolPermalink({
      input: "safe-text",
      controls: {
        file,
        algorithm: "SHA-256",
      },
    });
    expect(mixed.ok).toBe(true);
    if (!mixed.ok) return;

    const decoded = await decodePermalinkHash(mixed.hash);
    expect(decoded).toEqual({
      v: 1,
      input: "safe-text",
      controls: { algorithm: "SHA-256" },
    });
  });

  it("enforces the maximum encoded permalink hash length (8 KB default)", async () => {
    // High-entropy PRNG output resists deflate-raw compression to reliably exceed 8 KB
    let seed = 0x12345678;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:,.<>?";
    let highEntropy = "";
    for (let i = 0; i < 16000; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      highEntropy += alphabet[seed % alphabet.length];
    }

    const result = await encodeToolPermalink({ input: highEntropy });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too-large");
      expect(result.maxLength).toBe(MAX_PERMALINK_HASH_LENGTH);
      expect(result.message).toMatch(/too large/i);
    }
  });

  it("builds full permalink URLs without duplicating stale hashes", async () => {
    const result = await buildToolPermalinkUrl("https://codestation.in/tools/json-formatter#old", {
      input: '{"a":1}',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url.startsWith("https://codestation.in/tools/json-formatter#state=")).toBe(true);
    expect(result.url).not.toContain("#old");
  });

  it("fails gracefully and returns null on malformed, truncated, or invalid hashes", async () => {
    expect(await decodePermalinkHash("")).toBeNull();
    expect(await decodePermalinkHash("#other=123")).toBeNull();
    expect(await decodePermalinkHash("#state=!!!not-base64!!!")).toBeNull();
    expect(await decodePermalinkHash("#state=z.AAAA")).toBeNull();
    expect(await decodePermalinkHash(`#state=p.${toBase64Url(new TextEncoder().encode("not-json"))}`)).toBeNull();
    expect(await decodePermalinkHash(`#state=p.${toBase64Url(new TextEncoder().encode(JSON.stringify({ v: 99, input: "x" })))}`)).toBeNull();
    expect(await decodePermalinkHash(`#state=p.${toBase64Url(new TextEncoder().encode(JSON.stringify({ v: 1, input: 123 })))}`)).toBeNull();
    expect(fromBase64Url("invalid$chars")).toBeNull();
  });
});
