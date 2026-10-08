import { createHash, createHmac, webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { securityTools } from "@/config/security-tools";
import { runSecurity } from "./index";
import { runSecurityHash, SECURITY_FILE_LIMIT } from "./hashes";
import { estimateCharacterSet, estimatePasswordStrength, generateSecurePassword, generateSecureUlid, generateSecureUuid, parseSecurityUuid, RANDOM_STRING_ALPHABETS, secureRandomInteger, secureRandomString, SYMBOL_ALPHABET, ULID_ALPHABET } from "./generators";
import type { SecurityValues } from "./types";

const run = (slug: string, values: SecurityValues, file?: File) => runSecurity(slug, { values, file });
const reference = (algorithm: string, input: string | Uint8Array) => createHash(algorithm.toLowerCase().replaceAll("-", "")).update(input).digest("hex");
const sampleFile = (content: Uint8Array = new Uint8Array([0, 1, 255])) => new File([content as BlobPart], "public-test.bin");
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("CSPRNG generators and estimates", () => {
  it.each(["4", "7"] as const)("generates UUID v%s layout with secure randomness", version => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_123);
    const values = Array.from({ length: 16 }, () => generateSecureUuid(version));
    expect(values.every(value => new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-${version}[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).test(value))).toBe(true);
    expect(new Set(values).size).toBe(16);
    if (version === "7") expect(parseInt(values[0].replaceAll("-", "").slice(0, 12), 16)).toBe(1_700_000_000_123);
    expect(parseSecurityUuid(values[0]).version).toBe(version);
  });
  it("normalizes valid UUID forms and rejects misplaced braces/reserved versions", () => {
    const canonical = "550e8400-e29b-41d4-a716-446655440000";
    for (const input of [canonical.toUpperCase(), `{${canonical}}`, `urn:uuid:${canonical}`, canonical.replaceAll("-", "")]) expect(parseSecurityUuid(input).normalized).toBe(canonical);
    for (const input of ["", `${canonical}}`, `{${canonical}`, canonical.replace("41d4", "f1d4"), "not-a-uuid"]) expect(() => parseSecurityUuid(input)).toThrow();
    expect(parseSecurityUuid("00000000-0000-0000-0000-000000000000").validity).toContain("Nil");
    expect(parseSecurityUuid("ffffffff-ffff-ffff-ffff-ffffffffffff").validity).toContain("Max");
  });
  it.each([4, 256])("password length %s includes every enabled category and no others", length => {
    for (const selected of [[true, false, false, false], [false, true, false, false], [false, false, true, false], [false, false, false, true], [true, true, true, true]]) {
      const [uppercase, lowercase, numbers, symbols] = selected;
      for (let attempt = 0; attempt < 8; attempt++) {
        const output = generateSecurePassword({ length: String(length), uppercase, lowercase, numbers, symbols });
        expect(output.length).toBe(length);
        expect(/[A-Z]/.test(output)).toBe(uppercase); expect(/[a-z]/.test(output)).toBe(lowercase);
        expect(/[0-9]/.test(output)).toBe(numbers); expect([...output].some(char => SYMBOL_ALPHABET.includes(char))).toBe(symbols);
      }
    }
  });
  it("rejects invalid password length/classes and does not use predictable randomness", () => {
    const values = { length: "4", uppercase: true, lowercase: true, numbers: true, symbols: true };
    for (const length of ["3", "257", "4.5", "NaN", ""]) expect(() => generateSecurePassword({ ...values, length })).toThrow();
    expect(() => generateSecurePassword({ ...values, uppercase: false, lowercase: false, numbers: false, symbols: false })).toThrow();
    vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Predictable randomness forbidden"); });
    expect(generateSecurePassword(values).length).toBe(4);
    vi.stubGlobal("crypto", undefined); expect(() => generateSecurePassword(values)).toThrow(/Secure random/);
  });
  it("rejects biased candidates rather than using raw modulo", () => {
    let calls = 0;
    vi.stubGlobal("crypto", { getRandomValues: (array: Uint8Array) => { array.fill(calls++ === 0 ? 255 : 0); return array; } });
    expect(secureRandomString(1, "abc")).toBe("a"); expect(calls).toBe(2);
    calls = 0;
    expect(secureRandomInteger(BigInt(0), BigInt(2))).toBe(BigInt(0)); expect(calls).toBe(2);
  });
  it.each([["5", "5", "1"], ["-100", "-1", "1000"], [String(Number.MIN_SAFE_INTEGER), String(Number.MAX_SAFE_INTEGER), "1000"]])("supports inclusive integer range/count %s %s %s", async (minimum, maximum, count) => {
    const result = await run("random-number-generator", { minimum, maximum, count });
    const values = result.text.split("\n").map(BigInt);
    expect(values).toHaveLength(Number(count));
    expect(values.every(value => value >= BigInt(minimum) && value <= BigInt(maximum))).toBe(true);
  });
  it("rejects invalid integer range and counts", async () => {
    for (const extra of [{ minimum: "2", maximum: "1" }, { minimum: "1.1" }, { maximum: "9007199254740992" }, { count: "0" }, { count: "1001" }]) {
      await expect(run("random-number-generator", { minimum: "0", maximum: "10", count: "1", ...extra })).rejects.toThrow();
    }
  });
  it("generates valid ULID timestamp/random fields and repeated outputs", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_123);
    const outputs = Array.from({ length: 16 }, () => generateSecureUlid());
    expect(outputs.every(value => /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(value))).toBe(true);
    expect(new Set(outputs).size).toBe(16);
    expect([...outputs[0].slice(0, 10)].reduce((time, char) => time * 32 + ULID_ALPHABET.indexOf(char), 0)).toBe(1_700_000_000_123);
  });
  it.each([4, 21, 256])("generates NanoID length %s with URL-safe alphabet", async length => {
    const result = await run("nanoid-generator", { length: String(length) });
    expect(result.text.length).toBe(length); expect(/^[A-Za-z0-9_-]+$/.test(result.text)).toBe(true);
    expect((await run("nanoid-generator", {})).text.length).toBe(21);
  });
  it.each(Object.entries(RANDOM_STRING_ALPHABETS))("uses exactly the %s random-string alphabet at min/max lengths", async (characterSet, alphabet) => {
    for (const length of [1, 256]) {
      const result = await run("random-string-generator", { length: String(length), characterSet });
      expect(result.text.length).toBe(length); expect([...result.text].every(char => alphabet.includes(char))).toBe(true);
    }
  });
  it.each(["Hex", "Base64URL"])("secure token %s represents exact minimum/maximum byte lengths", async encoding => {
    for (const bytes of [8, 256]) {
      const result = await run("secure-token-generator", { bytes: String(bytes), encoding });
      expect(Buffer.from(result.text, encoding === "Hex" ? "hex" : "base64url").length).toBe(bytes);
      expect((encoding === "Hex" ? /^[0-9a-f]+$/ : /^[A-Za-z0-9_-]+$/).test(result.text)).toBe(true);
    }
  });
  it("hex and generic secret keys have exact requested byte/key sizes", async () => {
    for (const bytes of [1, 256]) expect((await run("hex-random-generator", { bytes: String(bytes) })).text.length).toBe(bytes * 2);
    for (const size of [128, 192, 256]) {
      const result = await run("secret-key-generator", { keySize: String(size) });
      expect(result.parts?.[0].value.length).toBe(size / 4); expect(result.parts?.[1].value).toBe(`${size} bits`);
    }
  });
  it("entropy follows category size rather than observed Shannon frequency", () => {
    expect(estimateCharacterSet("")).toMatchObject({ length: 0, characterSetSize: 0, estimatedBits: 0 });
    expect(estimateCharacterSet("aaaa")).toMatchObject({ length: 4, characterSetSize: 26 });
    expect(estimateCharacterSet("aaaa").estimatedBits).toBe(4 * Math.log2(26));
    expect(estimateCharacterSet("aA1! ")).toMatchObject({ length: 5, characterSetSize: 95 });
    expect(estimateCharacterSet("é🚀é")).toMatchObject({ length: 3, characterSetSize: 2, estimatedBits: 3 });
    expect(estimateCharacterSet("a".repeat(100_000)).length).toBe(100_000);
  });
  it("strength penalizes short/repeated/sequential/common patterns and remains heuristic", () => {
    for (const input of ["a", "aaaaaaa", "abcabcabcabc", "abcdefghijklmnopqrstuvwxyz", "password123", "correct horse battery staple", "a".repeat(100_000)]) {
      const result = estimatePasswordStrength(input);
      expect(result.score <= 35).toBe(true); expect(result.feedback).toMatch(/estimate|guarantee/i);
    }
    expect(estimatePasswordStrength("")).toMatchObject({ score: 0, label: "Very Weak" });
    expect(estimatePasswordStrength("gT8!pL3#zQ9@vR4$").score >= 60).toBe(true);
    expect(estimatePasswordStrength("é🚀漢字é🚀").feedback.length > 0).toBe(true);
  });
});

describe("every Security tool", () => {
  it.each(securityTools)("$slug executes only its default/public-example contract", async tool => {
    const values = { ...tool.securityContract.defaults, ...tool.securityContract.example };
    const result = await run(tool.slug, values, tool.slug === "file-hash-generator" ? sampleFile() : undefined);
    expect(typeof result.text).toBe("string"); expect(result.text.length > 0).toBe(true);
    if (result.parts) expect(result.parts.map(part => part.label)).toEqual(tool.securityContract.outputs);
  });
  it.each(securityTools)("$slug rejects invalid input/state with no echoed secrets", async tool => {
    const values = { ...tool.securityContract.defaults, ...tool.securityContract.example };
    switch (tool.slug) {
      case "uuid-generator": values.version = "3"; break;
      case "uuid-parser": values.input = "SENSITIVE-marker-invalid-uuid"; break;
      case "password-generator": values.length = "3"; break;
      case "hmac-generator": values.secret = ""; break;
      case "hash-compare": values.hashA = ""; break;
      case "file-hash-generator": break;
      case "entropy-calculator": case "password-strength-checker": values.input = false; break;
      case "ulid-generator": vi.stubGlobal("crypto", undefined); break;
      case "nanoid-generator": values.length = "3"; break;
      case "random-number-generator": values.count = "0"; break;
      case "random-string-generator": values.characterSet = "SENSITIVE-marker-invalid-choice"; break;
      case "secure-token-generator": values.bytes = "7"; break;
      case "hex-random-generator": values.bytes = "0"; break;
      case "secret-key-generator": values.keySize = "512"; break;
      default: values.input = "\uD800";
    }
    const outcome = await run(tool.slug, values).then(() => null, cause => (cause as Error).message);
    expect(outcome).not.toBeNull(); expect(outcome).not.toContain("SENSITIVE-marker"); expect(outcome).not.toMatch(/\n\s+at /);
  });
  it.each(securityTools)("$slug defines empty/missing input behavior", async tool => {
    const values = Object.fromEntries(Object.entries(tool.securityContract.defaults).map(([name, value]) => [name, typeof value === "boolean" ? false : ""]));
    const validEmpty = ["sha-256-generator", "sha-384-generator", "sha-512-generator", "sha-1-generator", "md5-generator", "crc32-generator", "entropy-calculator", "password-strength-checker", "ulid-generator"].includes(tool.slug);
    if (validEmpty) expect(typeof (await run(tool.slug, values)).text).toBe("string");
    else await expect(run(tool.slug, values)).rejects.toThrow();
  });
});

describe("known hashes, HMAC and comparison", () => {
  it.each(["SHA-1", "SHA-256", "SHA-384", "SHA-512", "MD5"])("%s matches independent vectors for empty, ASCII, Unicode and large input", async algorithm => {
    const slug = algorithm.toLowerCase() + "-generator";
    for (const input of ["", "abc", "漢字🚀é\uFEFF", "a".repeat(250_000), " space\n"]) {
      const result = await run(slug, { input });
      expect(result.text).toBe(reference(algorithm, input));
      expect((await run("checksum-generator", { input, algorithm })).text).toBe(result.text);
    }
  });
  it("uses IEEE CRC32 uppercase and rejects algorithm substitutions", async () => {
    expect((await run("crc32-generator", { input: "123456789" })).text).toBe("CBF43926");
    expect((await run("crc32-generator", { input: "" })).text).toBe("00000000");
    expect((await run("checksum-generator", { input: "123456789", algorithm: "CRC32" })).text).toBe("CBF43926");
    await expect(run("checksum-generator", { input: "abc", algorithm: "SHA-999" })).rejects.toThrow(/algorithm/);
  });
  it.each(["SHA-256", "SHA-384", "SHA-512"])("HMAC-%s agrees with reference vectors including empty/Unicode message", async algorithm => {
    for (const [message, secret] of [["Hi There", "\x0b".repeat(20)], ["what do ya want for nothing?", "Jefe"], ["", "public-test-key"], ["é🚀", "秘密"]]) {
      const result = await run("hmac-generator", { message, secret, algorithm: `HMAC-${algorithm}` });
      expect(result.text).toBe(createHmac(algorithm.toLowerCase().replaceAll("-", ""), secret).update(message).digest("hex"));
    }
    await expect(run("hmac-generator", { message: "", secret: "", algorithm: `HMAC-${algorithm}` })).rejects.toThrow(/empty/);
  });
  it("never trims or normalizes hash/HMAC input and compares only trimmed, case-sensitive strings", async () => {
    expect((await run("sha-256-generator", { input: " e\u0301 " })).text).toBe(reference("SHA-256", " e\u0301 "));
    expect((await run("hash-compare", { hashA: " ABC \n", hashB: "ABC" })).text).toBe("Match");
    expect((await run("hash-compare", { hashA: "ABC", hashB: "abc" })).text).toBe("Does not match");
    await expect(run("hash-compare", { hashA: " ", hashB: "" })).rejects.toThrow();
  });
  it("fails when Web Crypto is unavailable, never substitutes a weaker algorithm", async () => {
    vi.stubGlobal("crypto", { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
    await expect(run("sha-256-generator", { input: "abc" })).rejects.toThrow(/Web Crypto/);
    await expect(run("hmac-generator", { message: "abc", secret: "public", algorithm: "HMAC-SHA-256" })).rejects.toThrow(/Web Crypto/);
  });
  it.each(["SHA-1", "SHA-256", "SHA-384", "SHA-512"])("hashes exact %s file bytes including empty, binary and 4 MiB", async algorithm => {
    for (const content of [new Uint8Array(), new TextEncoder().encode("hello\né🚀"), new Uint8Array([0, 255, 128, 7]), new Uint8Array(4 * 1024 * 1024).fill(123)]) {
      const result = await run("file-hash-generator", { algorithm }, sampleFile(content));
      expect(result.parts?.map(part => part.label)).toEqual(["File name", "File size", "Algorithm", "Hash"]);
      expect(result.parts?.[0].value).toBe("public-test.bin"); expect(result.parts?.[2].value).toBe(algorithm);
      expect(result.parts?.[3].value).toBe(reference(algorithm, content));
    }
  });
  it("rejects unsupported/oversized files before reading and wipes owned buffers", async () => {
    const read = vi.fn();
    const oversized = { name: "not-logged", size: SECURITY_FILE_LIMIT + 1, arrayBuffer: read } as unknown as File;
    await expect(run("file-hash-generator", { algorithm: "SHA-256" }, oversized)).rejects.toThrow(/64 MiB/);
    expect(read).not.toHaveBeenCalled();
    await expect(run("file-hash-generator", { algorithm: "MD5" }, sampleFile())).rejects.toThrow(/Select/);
    const buffer = new Uint8Array([1, 2, 3]);
    const file = { name: "public-test.bin", size: 3, arrayBuffer: async () => buffer.buffer } as File;
    await runSecurityHash("file-hash-generator", { values: { algorithm: "SHA-256" }, file });
    expect(Array.from(buffer)).toEqual([0, 0, 0]);
  });
});
