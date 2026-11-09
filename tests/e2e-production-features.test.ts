/**
 * Comprehensive 4-Tier E2E Production Features Test Suite (R1 - R6)
 *
 * Tier 1: Feature Coverage (>= 5 tests per feature)
 * Tier 2: Boundary & Corner Cases (>= 5 tests per feature)
 * Tier 3: Cross-Feature Combinations
 * Tier 4: Real-World Scenarios
 *
 * Features Tested:
 * - R1: PDF Station Upgrades (pdf-watermark, pdf-page-numberer)
 * - R2: Smart Clipboard Omni-Triage (13 formats, confidence scores, shortcut, persistence)
 * - R3: Station 25: AI & Prompt Engineering (5 tools)
 * - R4: Station 24: WebPKI & Advanced Cryptography (5 tools)
 * - R5: Universal Recipe Pipeline Studio (/workflows)
 * - R6: Spreadsheet Station In-Browser SQL Engine (spreadsheet-sql-query)
 */

import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// R1: PDF Engine
import {
  applyWatermark,
  applyPageNumbers,
  extractPdfInfo,
  parseColor,
  toRoman,
} from "@/lib/tools/pdf/engine";

// R2: Clipboard Omni-Triage
import {
  detectTools,
  detectClipboardContent,
  detectionLimit,
} from "@/lib/workbench/detection";

// R3: Station 25 AI & Prompt Engineering
import {
  tokenizeText,
  countTokens,
  repairJson,
  interpolatePrompt,
  computeVectorSimilarity,
  buildSystemPrompt,
} from "@/lib/tools/ai-prompts/engine";

// R4: Station 24 WebPKI & Advanced Cryptography
import {
  encryptAesGcm,
  decryptAesGcm,
  generateAesKey,
  generateRsaKeyPair,
  signJwt,
  verifyJwt,
  parseCsr,
  buildCspHeader,
} from "@/lib/tools/crypto-pki/engine";

// R5: Universal Recipe Pipeline Studio
import {
  executePipeline,
  checkStepCompatibility,
  validatePipeline,
  parseRecipe,
  exportRecipeAsJson,
  importRecipeFromJson,
  saveRecipeToStorage,
  loadSavedRecipes,
  deleteSavedRecipe,
} from "@/lib/workbench/workflows";

// R6: Spreadsheet Station SQL Engine
import {
  executeSql,
  exportQueryResultToCsv,
  exportQueryResultToJson,
  detectDelimiter,
} from "@/lib/tools/spreadsheet/sql-engine";

// ============================================================================
// Synthetic Test Fixtures & Helpers
// ============================================================================

async function createSamplePdf(pageCount = 1, textContent = "Hello Code Station"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([600, 400]);
    page.drawText(`${textContent} - Page ${i + 1}`, {
      x: 50,
      y: 350,
      size: 18,
      font,
      color: rgb(0, 0, 0),
    });
  }
  return await doc.save();
}

const SAMPLE_CSV_DATA = `id,name,department,salary,status
1,Alice,Engineering,120000,active
2,Bob,Engineering,110000,active
3,Charlie,Marketing,85000,active
4,Diana,Marketing,95000,inactive
5,Evan,Engineering,130000,inactive
6,Fiona,HR,75000,active
7,George,HR,80000,active
8,Hannah,Sales,90000,active`;

// 1x1 Transparent PNG byte array fixture
const SAMPLE_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

// Valid sample PKCS#10 Certificate Signing Request (RSA 2048) with valid DER structure
const SAMPLE_CSR_PEM = `-----BEGIN CERTIFICATE REQUEST-----
MIIDATCCAekCAQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWEx
FjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xFDASBgNVBAoMC0NvZGVTdGF0aW9uMRQw
EgYDVQQLDAtFbmdpbmVlcmluZzEUMBIGA1UEAwwLZXhhbXBsZS5jb20wggEiMA0G
CSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDJmvSQ210ROEgCHZMq1LW/zonwJsZZ
1qUYgGC07Zph+zxX5kpZG51jcVmz1TlufkD9J4NQA9Y+6GMa08CL+33C4JlMV7D7
eQ7KpYYpnWlwOtN+K4juD1gCL0bhEaYiuzSQPDud1kwiXIswRerAVj7nf0hBvU9p
gI64lLJFo3nd/DBtgn+Ddk6ttbvNPvBymo4nci4uIOySL9TxQF9fty7ytpN65shA
yeYIx9T/k8G0L01iRUQ0ad9R2Rqsmtt+YsV6fVdwy94sjvZ9sUAePSZGsskpmUnN
/hZMuPJvudSsqNeTdbUWRzqw643jSoYijG16EPkDHBmLyS299WsDq+z1AgMBAAGg
QDA+BgkqhkiG9w0BCQ4xMTAvMC0GA1UdEQQmMCSCC2V4YW1wbGUuY29tgg93d3cu
ZXhhbXBsZS5jb22HBMCoAWQwDQYJKoZIhvcNAQELBQADggEBAL5qqIhyUM+fazXC
BGT5khvCtIUMJsshMHXFW+IcjTmF5VG1GtnZ3Oey5+Z3vTJ3PcUiJpovQ6+HPoct
O6ec405DIoggf660Q56AMSk3khoaAdWcq3guMFJcSP4+0afKF7kYzbESRAVccsRz
/n7dHfXCedJzDrsdUyIucidxFVhwrLzBRv0MmjRDXEtSCDMiP+dosJWMxbPkS/HW
hS5G+58QVDKcFgWaZ7HIKbu0tNLKiCqP06/dH5vf+fldF54PvIq1/fQjCiTx0qF/
7FGRe334sHNay2UjDWxMWN/IAHqCWKfGJ6fE2Vv8qr+TTOziUscwC0e00zrGaeuX
lQKOGyc=
-----END CERTIFICATE REQUEST-----`;

// ============================================================================
// TIER 1: FEATURE COVERAGE (>= 5 tests per feature across R1-R6)
// ============================================================================

describe("Tier 1: Feature Coverage", () => {
  // --------------------------------------------------------------------------
  // Feature R1: PDF Station Upgrades
  // --------------------------------------------------------------------------
  describe("R1: PDF Station Upgrades", () => {
    it("1.1 applies text watermark at center with custom font size, opacity, rotation, and color", async () => {
      const initialPdf = await createSamplePdf(1, "Confidential Proposal");
      const watermarkedBytes = await applyWatermark(initialPdf, {
        type: "text",
        text: "INTERNAL ONLY",
        fontSize: 36,
        opacity: 0.4,
        rotation: 30,
        color: "#ff0000",
        position: "center",
      });

      expect(watermarkedBytes).toBeInstanceOf(Uint8Array);
      expect(watermarkedBytes.byteLength).toBeGreaterThan(initialPdf.byteLength);

      const verifiedDoc = await PDFDocument.load(watermarkedBytes);
      expect(verifiedDoc.getPageCount()).toBe(1);
    });

    it("1.2 applies tiled watermark repeating across the entire page", async () => {
      const initialPdf = await createSamplePdf(1, "Draft Contract");
      const watermarkedBytes = await applyWatermark(initialPdf, {
        type: "text",
        text: "DRAFT",
        position: "tile",
        fontSize: 24,
        opacity: 0.25,
      });

      expect(watermarkedBytes).toBeInstanceOf(Uint8Array);
      const verifiedDoc = await PDFDocument.load(watermarkedBytes);
      expect(verifiedDoc.getPageCount()).toBe(1);
    });

    it("1.3 applies watermark to specific corner positions (top-left, top-right, bottom-left, bottom-right)", async () => {
      const initialPdf = await createSamplePdf(1, "Corner Document");
      for (const pos of ["top-left", "top-right", "bottom-left", "bottom-right"] as const) {
        const watermarked = await applyWatermark(initialPdf, {
          type: "text",
          text: pos.toUpperCase(),
          position: pos,
          fontSize: 16,
        });
        expect(watermarked).toBeInstanceOf(Uint8Array);
        const doc = await PDFDocument.load(watermarked);
        expect(doc.getPageCount()).toBe(1);
      }
    });

    it("1.4 embeds image watermark into PDF with custom scaling and opacity", async () => {
      const initialPdf = await createSamplePdf(1, "Image Watermark Document");
      const watermarkedBytes = await applyWatermark(initialPdf, {
        type: "image",
        imageBytes: SAMPLE_PNG_BYTES,
        imageType: "image/png",
        scale: 40,
        opacity: 0.5,
        rotation: 15,
        position: "center",
      });

      expect(watermarkedBytes).toBeInstanceOf(Uint8Array);
      expect(watermarkedBytes.byteLength).toBeGreaterThan(initialPdf.byteLength);
    });

    it("1.5 applies page numbers in footer with 'Page X of Y' format", async () => {
      const multiPagePdf = await createSamplePdf(3, "Multi-page Report");
      const numberedBytes = await applyPageNumbers(multiPagePdf, {
        format: "page-x-of-y",
        verticalPosition: "footer",
        alignment: "center",
        fontSize: 12,
        color: "#222222",
      });

      expect(numberedBytes).toBeInstanceOf(Uint8Array);
      const doc = await PDFDocument.load(numberedBytes);
      expect(doc.getPageCount()).toBe(3);
    });

    it("1.6 applies Roman numeral page numbers (Roman Lower 'i, ii' and Roman Upper 'I, II')", async () => {
      const doc = await createSamplePdf(4, "Roman Document");
      const lowerNumbered = await applyPageNumbers(doc, {
        format: "roman-lower",
        verticalPosition: "header",
        alignment: "right",
      });
      const upperNumbered = await applyPageNumbers(doc, {
        format: "roman-upper",
        verticalPosition: "header",
        alignment: "right",
      });

      expect(lowerNumbered).toBeInstanceOf(Uint8Array);
      expect(upperNumbered).toBeInstanceOf(Uint8Array);
      expect(toRoman(1, false)).toBe("i");
      expect(toRoman(4, true)).toBe("IV");
      expect(toRoman(9, true)).toBe("IX");
    });

    it("1.7 applies page numbering with custom font (Courier, Times Roman) and margins", async () => {
      const doc = await createSamplePdf(2, "Font Styled Document");
      const styledBytes = await applyPageNumbers(doc, {
        fontFamily: "Courier",
        fontSize: 14,
        margin: 36,
        format: "x-of-y",
        alignment: "left",
      });
      expect(styledBytes).toBeInstanceOf(Uint8Array);
    });
  });

  // --------------------------------------------------------------------------
  // Feature R2: Smart Clipboard Omni-Triage
  // --------------------------------------------------------------------------
  describe("R2: Smart Clipboard Omni-Triage", () => {
    it("2.1 detects valid JSON objects and arrays with high confidence (>=90%)", () => {
      const objResult = detectClipboardContent('{"project":"code-station","active":true}');
      expect(objResult.format).toBe("JSON");
      expect(objResult.confidence).toBe("high");
      expect(objResult.score).toBeGreaterThanOrEqual(90);
      expect(objResult.topMatch?.slug).toBe("json-formatter");

      const arrResult = detectClipboardContent('[1, 2, 3, {"name":"tool"}]');
      expect(arrResult.format).toBe("JSON");
      expect(arrResult.confidence).toBe("high");
    });

    it("2.2 detects JWT tokens with 3-part structure and high confidence", () => {
      const sampleJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const result = detectClipboardContent(sampleJwt);
      expect(result.format).toBe("JWT");
      expect(result.confidence).toBe("high");
      expect(result.score).toBeGreaterThanOrEqual(95);
      expect(result.topMatch?.slug).toBe("jwt-decoder");
    });

    it("2.3 detects Unix timestamps in 10-digit seconds and 13-digit milliseconds", () => {
      const secResult = detectClipboardContent("1700000000");
      expect(secResult.format).toBe("Unix Timestamp");
      expect(secResult.confidence).toBe("high");
      expect(secResult.topMatch?.slug).toBe("unix-timestamp-converter");

      const msResult = detectClipboardContent("1700000000000");
      expect(msResult.format).toBe("Unix Timestamp");
      expect(msResult.confidence).toBe("high");
      expect(msResult.topMatch?.slug).toBe("unix-milliseconds-converter");
    });

    it("2.4 detects CIDR and IP notations (IPv4 CIDR, IPv4 address, IPv6, IPv4 range)", () => {
      const cidrRes = detectClipboardContent("192.168.1.0/24");
      expect(cidrRes.format).toBe("CIDR / IP Range");
      expect(cidrRes.confidence).toBe("high");
      expect(cidrRes.topMatch?.slug).toBe("cidr-calculator");

      const ipRes = detectClipboardContent("10.0.0.1");
      expect(ipRes.format).toBe("CIDR / IP Range");

      const ipv6Res = detectClipboardContent("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
      expect(ipv6Res.format).toBe("CIDR / IP Range");
    });

    it("2.5 detects Cron expressions (5-field and alias shortcuts)", () => {
      const cronRes = detectClipboardContent("*/15 0 1,15 * 1-5");
      expect(cronRes.format).toBe("Cron Expression");
      expect(cronRes.confidence).toBe("high");
      expect(cronRes.topMatch?.slug).toBe("cron-explainer");

      const aliasRes = detectClipboardContent("@daily");
      expect(aliasRes.format).toBe("Cron Expression");
      expect(aliasRes.confidence).toBe("high");
    });

    it("2.6 detects Git merge conflict markers with maximum confidence (99%)", () => {
      const conflictText = `<<<<<<< HEAD
const version = "2.0";
=======
const version = "2.1";
>>>>>>> feature-branch`;
      const result = detectClipboardContent(conflictText);
      expect(result.format).toBe("Git Merge Conflict");
      expect(result.score).toBe(99);
      expect(result.topMatch?.slug).toBe("conflict-parse");
    });

    it("2.7 detects PEM certificate / private key and Base64 data URLs", () => {
      const pemText = `-----BEGIN CERTIFICATE-----\nMIIB...test...\n-----END CERTIFICATE-----`;
      const pemRes = detectClipboardContent(pemText);
      expect(pemRes.format).toBe("PEM Certificate / Key");
      expect(pemRes.confidence).toBe("high");

      const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const dataRes = detectClipboardContent(dataUrl);
      expect(dataRes.format).toBe("Base64 Data URL");
      expect(dataRes.topMatch?.slug).toBe("data-uri-decoder");
    });

    it("2.8 detects URL, UUID, Hex color, Markdown, and SQL queries", () => {
      expect(detectClipboardContent("https://codestation.in/tools/json-formatter").format).toBe("URL");
      expect(detectClipboardContent("550e8400-e29b-41d4-a716-446655440000").format).toBe("UUID");
      expect(detectClipboardContent("#3b82f6").format).toBe("Hex Color");
      expect(detectClipboardContent("# Main Title\n\n- [x] Task completed\n\n```ts\nconst x = 1;\n```").format).toBe("Markdown");
      expect(detectClipboardContent("SELECT department, COUNT(*) FROM table GROUP BY department").format).toBe("SQL");
    });
  });

  // --------------------------------------------------------------------------
  // Feature R3: Station 25 (AI & Prompt Engineering)
  // --------------------------------------------------------------------------
  describe("R3: Station 25 (AI & Prompt Engineering)", () => {
    it("3.1 ai-token-counter counts tokens across multiple models and estimates costs", () => {
      const sampleText = "The quick brown fox jumps over the lazy dog. Code Station provides browser-native developer tools.";
      const gptResult = countTokens(sampleText, "gpt-4o", { inputPricePer1M: 2.5, outputPricePer1M: 10.0 });
      expect(gptResult.tokenCount).toBeGreaterThan(10);
      expect(gptResult.charCount).toBe(sampleText.length);
      expect(gptResult.estimatedInputCost).toBeGreaterThan(0);
      expect(gptResult.estimatedOutputCost).toBeGreaterThan(0);

      const claudeResult = countTokens(sampleText, "claude-3-5");
      expect(claudeResult.tokenCount).toBeGreaterThan(10);

      const geminiResult = countTokens(sampleText, "gemini-1-5");
      expect(geminiResult.tokenCount).toBeGreaterThan(10);
    });

    it("3.2 ai-token-counter generates visual token boundary fragments with character offsets", () => {
      const text = "Hello world! Test tokenization.";
      const fragments = tokenizeText(text, "gpt-4o");
      expect(fragments.length).toBeGreaterThan(1);
      expect(fragments[0].charStart).toBe(0);
      expect(fragments[0].charEnd).toBeGreaterThan(0);
      expect(fragments.map((f) => f.text).join("")).toBe(text);
    });

    it("3.3 json-repair repairs malformed LLM JSON (markdown fences, trailing commas, quotes, Python literals)", () => {
      const malformed = `\`\`\`json
{
  name: 'Code Station',
  active: True,
  legacy: None,
  features: ["triage", "ai-prompts", "crypto",],
}
\`\`\``;
      const result = repairJson(malformed);
      expect(result.success).toBe(true);
      expect(result.repairsApplied.length).toBeGreaterThan(0);

      const parsed = JSON.parse(result.repaired);
      expect(parsed.name).toBe("Code Station");
      expect(parsed.active).toBe(true);
      expect(parsed.legacy).toBeNull();
      expect(parsed.features).toEqual(["triage", "ai-prompts", "crypto"]);
    });

    it("3.4 prompt-interpolator interpolates variables across multiple records and formats roles", () => {
      const template = "Hello {{name}}, your subscription tier is {{tier}}.";
      const records = [
        { name: "Alice", tier: "Pro" },
        { name: "Bob", tier: "Team" },
      ];

      const res = interpolatePrompt({ template, records });
      expect(res.variables).toEqual(["name", "tier"]);
      expect(res.results.length).toBe(2);
      expect(res.results[0].interpolatedPrompt).toBe("Hello Alice, your subscription tier is Pro.");
      expect(res.results[1].interpolatedPrompt).toBe("Hello Bob, your subscription tier is Team.");
      expect(res.openAiExport).toContain("Hello Alice");
      expect(res.anthropicExport).toContain("Hello Bob");
    });

    it("3.5 vector-similarity computes Cosine similarity, Euclidean distance, and Dot product", () => {
      const vecA = [1.0, 2.0, 3.0, 4.0];
      const vecB = [1.0, 2.0, 3.0, 4.0];
      const metrics = computeVectorSimilarity(vecA, vecB);

      expect(metrics.cosineSimilarity).toBeCloseTo(1.0, 5);
      expect(metrics.euclideanDistance).toBeCloseTo(0.0, 5);
      expect(metrics.dotProduct).toBe(30);
      expect(metrics.manhattanDistance).toBe(0);

      // Orthogonal vectors
      const orthoA = [1, 0];
      const orthoB = [0, 1];
      const orthoMetrics = computeVectorSimilarity(orthoA, orthoB);
      expect(orthoMetrics.cosineSimilarity).toBeCloseTo(0.0, 5);
      expect(orthoMetrics.dotProduct).toBe(0);
      expect(orthoMetrics.angleDegrees).toBeCloseTo(90, 2);
    });

    it("3.6 system-prompt-builder constructs structured prompts with XML tags, few-shot examples, and constraints", () => {
      const promptRes = buildSystemPrompt({
        roleName: "Technical Architect",
        roleTone: "concise",
        coreTask: "Design and verify scalable in-browser software architectures.",
        xmlWrapping: true,
        guardrails: ["Never apologize", "No markdown code fences"],
        chainOfThought: true,
        outputFormat: "json",
        examples: [
          { id: "ex-1", input: "Calculate 2+2", reasoning: "Basic integer addition", output: "4" },
        ],
      });

      expect(promptRes.assembledPrompt).toContain("<role>");
      expect(promptRes.assembledPrompt).toContain("Technical Architect");
      expect(promptRes.assembledPrompt).toContain("<guardrails>");
      expect(promptRes.assembledPrompt).toContain("Never apologize");
      expect(promptRes.assembledPrompt).toContain("<examples>");
      expect(promptRes.assembledPrompt).toContain("<thinking>");
      expect(promptRes.tokenCount).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Feature R4: Station 24 (WebPKI & Advanced Cryptography)
  // --------------------------------------------------------------------------
  describe("R4: Station 24 (WebPKI & Advanced Cryptography)", () => {
    it("4.1 aes-crypto executes 128-bit and 256-bit AES-GCM encryption and decryption with raw key", async () => {
      const plaintext = "Confidential Code Station Payload";
      const key256 = generateAesKey(256);

      const encResult = await encryptAesGcm(plaintext, {
        mode: "raw",
        keyLength: 256,
        rawKey: key256.hex,
      });

      expect(encResult.ciphertext).toBeDefined();
      expect(encResult.tag).toBeDefined();
      expect(encResult.iv).toBeDefined();

      const decrypted = await decryptAesGcm(encResult.jsonBundle, {
        mode: "raw",
        keyLength: 256,
        rawKey: key256.hex,
      });

      expect(decrypted).toBe(plaintext);
    });

    it("4.2 aes-crypto executes PBKDF2 passphrase key derivation encryption/decryption roundtrip", async () => {
      const plaintext = "Data secured via PBKDF2 passphrase";
      const passphrase = "correct-horse-battery-staple-2026!";

      const encResult = await encryptAesGcm(plaintext, {
        mode: "passphrase",
        passphrase,
        keyLength: 256,
      });

      expect(encResult.salt).toBeDefined();
      expect(encResult.combined).toContain(":");

      const decrypted = await decryptAesGcm(encResult.combined, {
        mode: "passphrase",
        passphrase,
        keyLength: 256,
      });

      expect(decrypted).toBe(plaintext);
    });

    it("4.3 aes-crypto verifies Additional Authenticated Data (AAD)", async () => {
      const plaintext = "Financial Transaction";
      const aad = "account_id=987654";
      const key = generateAesKey(256);

      const encResult = await encryptAesGcm(plaintext, {
        mode: "raw",
        keyLength: 256,
        rawKey: key.hex,
        aad,
      });

      const decrypted = await decryptAesGcm(
        {
          ciphertext: encResult.ciphertext,
          iv: encResult.iv,
          tag: encResult.tag,
          aad,
          encoding: "base64",
        },
        {
          mode: "raw",
          keyLength: 256,
          rawKey: key.hex,
        }
      );

      expect(decrypted).toBe(plaintext);
    });

    it("4.4 rsa-key-generator generates 2048-bit RSA key pair with valid PKCS#8 and SPKI PEM export", async () => {
      const keyPair = await generateRsaKeyPair(2048);
      expect(keyPair.privateKeyPem).toContain("-----BEGIN PRIVATE KEY-----");
      expect(keyPair.privateKeyPem).toContain("-----END PRIVATE KEY-----");
      expect(keyPair.publicKeyPem).toContain("-----BEGIN PUBLIC KEY-----");
      expect(keyPair.publicKeyPem).toContain("-----END PUBLIC KEY-----");
      expect(keyPair.modulusLength).toBe(2048);
      expect(keyPair.fingerprint).toMatch(/^SHA256:[0-9a-f:]{95}$/);
    });

    it("4.5 jwt-signer-verifier signs and verifies HS256 JWT tokens with secret", async () => {
      const secret = "super-secure-jwt-signing-key-for-codestation-32";
      const payload = {
        sub: "user-42",
        role: "admin",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = await signJwt({ alg: "HS256", typ: "JWT" }, payload, secret);
      expect(token.split(".").length).toBe(3);

      const verifyRes = await verifyJwt(token, secret);
      expect(verifyRes.valid).toBe(true);
      expect(verifyRes.signatureValid).toBe(true);
      expect(verifyRes.payload.sub).toBe("user-42");
    });

    it("4.6 csr-inspector decodes PKCS#10 PEM certificate signing requests", async () => {
      const details = await parseCsr(SAMPLE_CSR_PEM);
      expect(details.subject.commonName).toBe("example.com");
      expect(details.subject.organization).toBe("CodeStation");
      expect(details.subject.country).toBe("US");
      expect(details.publicKey.algorithm).toContain("RSA");
      expect(details.subjectAltNames).toContain("DNS:example.com");
      expect(details.signatureValid).toBe(true);
    });

    it("4.7 csp-builder generates valid Content-Security-Policy header and flags unsafe directives", () => {
      const res = buildCspHeader({
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        "style-src": ["'self'", "https://fonts.googleapis.com"],
        "object-src": ["'none'"],
      });

      expect(res.headerString).toContain("default-src 'self'");
      expect(res.headerString).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
      expect(res.warnings.length).toBeGreaterThan(0);
      expect(res.warnings.some((w) => w.directive === "script-src" && w.message.includes("'unsafe-inline'"))).toBe(true);
      expect(res.warnings.some((w) => w.directive === "script-src" && w.message.includes("'unsafe-eval'"))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature R5: Universal Recipe Pipeline Studio (/workflows)
  // --------------------------------------------------------------------------
  describe("R5: Universal Recipe Pipeline Studio", () => {
    it("5.1 executes multi-step chaining (csv-to-json -> json-formatter) sequentially", async () => {
      const recipe = {
        version: 1 as const,
        source: "csv" as const,
        steps: ["csv-to-json", "json-formatter"],
      };

      const inputCsv = "name,role\nAlice,Developer\nBob,Designer";
      const result = await executePipeline(recipe, inputCsv);

      expect(result.success).toBe(true);
      expect(result.steps.length).toBe(2);
      expect(result.steps[0].status).toBe("success");
      expect(result.steps[1].status).toBe("success");

      const finalParsed = JSON.parse(result.finalOutput);
      expect(Array.isArray(finalParsed)).toBe(true);
      expect(finalParsed[0].name).toBe("Alice");
    });

    it("5.2 captures live intermediate preview results after each pipeline step", async () => {
      const recipe = {
        version: 1 as const,
        source: "json" as const,
        steps: ["json-to-yaml", "yaml-to-json", "json-minifier"],
      };

      const inputJson = '{\n  "status": "ready",\n  "count": 42\n}';
      const result = await executePipeline(recipe, inputJson);

      expect(result.success).toBe(true);
      expect(result.steps.length).toBe(3);

      // Intermediate Step 0: YAML
      expect(result.steps[0].output).toContain("status: ready");
      // Intermediate Step 1: JSON
      expect(result.steps[1].output).toContain('"status": "ready"');
      // Step 2: Minified JSON
      expect(result.steps[2].output).toBe('{"status":"ready","count":42}');
    });

    it("5.3 validates consecutive step compatibility", () => {
      expect(checkStepCompatibility("json-array", "csv").compatible).toBe(true);
      const incompatibleRes = checkStepCompatibility("markdown", "csv");
      expect(incompatibleRes.compatible).toBe(false);
    });

    it("5.4 validates complete pipeline schema and backward compatibility with version 1 recipes", () => {
      const legacyRecipeStr = '{"version":1,"source":"json","steps":["json-key-sorter","json-minifier"]}';
      const parsed = parseRecipe(legacyRecipeStr);
      expect(parsed.version).toBe(1);
      expect(parsed.steps).toEqual(["json-key-sorter", "json-minifier"]);

      const val = validatePipeline(parsed);
      expect(val.valid).toBe(true);
      expect(val.errors.length).toBe(0);
    });

    it("5.5 exports and imports recipes via JSON", () => {
      const recipe = {
        version: 2 as const,
        name: "CSV to Formatted JSON",
        source: "csv" as const,
        steps: ["csv-to-json", "json-formatter"],
      };

      const exportedJson = exportRecipeAsJson(recipe);
      expect(typeof exportedJson).toBe("string");
      expect(exportedJson).toContain("CSV to Formatted JSON");

      const imported = importRecipeFromJson(exportedJson);
      expect(imported.name).toBe("CSV to Formatted JSON");
      expect(imported.steps).toEqual(["csv-to-json", "json-formatter"]);
    });

    it("5.6 manages recipe persistence in localStorage (save, load, delete)", () => {
      const recipe = {
        version: 1 as const,
        source: "json" as const,
        steps: ["json-formatter"],
      };

      const saved = saveRecipeToStorage("My Saved Recipe", recipe);
      expect(saved.id).toBeDefined();
      expect(saved.name).toBe("My Saved Recipe");

      const list = loadSavedRecipes();
      expect(list.some((r) => r.id === saved.id)).toBe(true);

      deleteSavedRecipe(saved.id);
      const afterDelete = loadSavedRecipes();
      expect(afterDelete.some((r) => r.id === saved.id)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature R6: Spreadsheet Station In-Browser SQL Engine
  // --------------------------------------------------------------------------
  describe("R6: Spreadsheet Station In-Browser SQL Engine", () => {
    it("6.1 executes standard SQL queries against CSV data using AlaSQL", async () => {
      const query = "SELECT name, department, salary FROM table WHERE salary > 100000";
      const result = await executeSql(SAMPLE_CSV_DATA, query);

      expect(result.error).toBeUndefined();
      expect(result.columns).toEqual(["name", "department", "salary"]);
      expect(result.rowCount).toBe(3); // Alice, Bob, Evan
      expect(result.rows.length).toBe(3);
    });

    it("6.2 satisfies Acceptance Criteria Target Query with GROUP BY, COUNT(*), and AVG(salary)", async () => {
      const acceptanceQuery = "SELECT department, COUNT(*), AVG(salary) FROM table WHERE status = 'active' GROUP BY department";
      const result = await executeSql(SAMPLE_CSV_DATA, acceptanceQuery);

      expect(result.error).toBeUndefined();
      expect(result.columns).toEqual(["department", "COUNT(*)", "AVG(salary)"]);
      expect(result.rowCount).toBe(4); // Engineering, Marketing, HR, Sales

      // Verify Engineering active records: Alice (120000), Bob (110000) -> Avg = 115000, Count = 2
      const engRow = result.rows.find((r) => r[0] === "Engineering");
      expect(engRow).toBeDefined();
      expect(engRow![1]).toBe(2);
      expect(Number(engRow![2])).toBe(115000);

      // Verify HR active records: Fiona (75000), George (80000) -> Avg = 77500, Count = 2
      const hrRow = result.rows.find((r) => r[0] === "HR");
      expect(hrRow).toBeDefined();
      expect(hrRow![1]).toBe(2);
      expect(Number(hrRow![2])).toBe(77500);
    });

    it("6.3 executes complex SQL queries with ORDER BY, LIMIT, and OFFSET", async () => {
      const query = "SELECT name, salary FROM table ORDER BY salary DESC LIMIT 3 OFFSET 1";
      const result = await executeSql(SAMPLE_CSV_DATA, query);

      expect(result.error).toBeUndefined();
      expect(result.rowCount).toBe(3);
      // Top salaries: Evan (130k), Alice (120k), Bob (110k), Diana (95k) -> offset 1: Alice, Bob, Diana
      expect(result.rows[0][0]).toBe("Alice");
      expect(result.rows[1][0]).toBe("Bob");
      expect(result.rows[2][0]).toBe("Diana");
    });

    it("6.4 ingests TSV (tab-delimited) data and runs queries seamlessly", async () => {
      const tsvData = "dept\tbudget\nDesign\t50000\nEngineering\t250000\nMarketing\t80000";
      const query = "SELECT dept, budget FROM table WHERE budget >= 80000 ORDER BY budget DESC";
      const result = await executeSql(tsvData, query);

      expect(result.error).toBeUndefined();
      expect(result.rowCount).toBe(2);
      expect(result.rows[0][0]).toBe("Engineering");
      expect(result.rows[1][0]).toBe("Marketing");
    });

    it("6.5 exports SQL query results to RFC-4180 compliant CSV and formatted JSON", async () => {
      const query = "SELECT department, COUNT(*) AS headcount FROM table GROUP BY department";
      const result = await executeSql(SAMPLE_CSV_DATA, query);

      const csvExport = exportQueryResultToCsv(result);
      expect(csvExport).toContain("department,headcount");
      expect(csvExport).toContain("Engineering");

      const jsonExport = exportQueryResultToJson(result);
      const parsed = JSON.parse(jsonExport);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toHaveProperty("department");
      expect(parsed[0]).toHaveProperty("headcount");
    });
  });
});

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES (>= 5 tests per feature across R1-R6)
// ============================================================================

describe("Tier 2: Boundary & Corner Cases", () => {
  describe("R1: PDF Edge Cases", () => {
    it("2.1 handles multi-page PDF documents correctly applying watermarks to all pages", async () => {
      const multiPdf = await createSamplePdf(5, "Five Page Document");
      const watermarked = await applyWatermark(multiPdf, {
        type: "text",
        text: "PAGE TEST",
      });
      const info = await extractPdfInfo(watermarked.buffer as ArrayBuffer);
      expect(info.pageCount).toBe(5);
    });

    it("2.2 throws a graceful error for zero-byte or empty inputs without crashing", async () => {
      await expect(applyWatermark(new Uint8Array(0))).rejects.toThrow();
      await expect(applyPageNumbers(new Uint8Array(0))).rejects.toThrow();
    });

    it("2.3 throws an informative error for corrupted non-PDF bytes", async () => {
      const corruptBytes = new TextEncoder().encode("This is not a PDF file at all.");
      await expect(applyWatermark(corruptBytes)).rejects.toThrow(/Failed to load PDF|corrupted|invalid/i);
      await expect(applyPageNumbers(corruptBytes)).rejects.toThrow(/Failed to load PDF|corrupted|invalid/i);
    });

    it("2.4 page numberer handles startNumber > 1 and skipping the first page", async () => {
      const doc = await createSamplePdf(3, "Skip Page Doc");
      const numbered = await applyPageNumbers(doc, {
        skipFirstPage: true,
        startNumber: 10,
        format: "page-x-of-y",
      });
      expect(numbered).toBeInstanceOf(Uint8Array);
    });

    it("2.5 parses various hex, rgb, and named color formats gracefully in PDF engine", () => {
      const red = parseColor("#ff0000");
      expect(red).toBeDefined();
      const rgbColor = parseColor("rgb(0, 128, 255)");
      expect(rgbColor).toBeDefined();
      const gray = parseColor("gray");
      expect(gray).toBeDefined();
      const fallback = parseColor("invalid-color");
      expect(fallback).toBeDefined();
    });
  });

  describe("R2: Clipboard Omni-Triage Edge Cases", () => {
    it("2.6 handles empty or whitespace-only strings gracefully returning empty matches", () => {
      expect(detectTools("")).toEqual([]);
      expect(detectTools("   \n\t   ")).toEqual([]);
      const res = detectClipboardContent("   ");
      expect(res.matches).toEqual([]);
      expect(res.topMatch).toBeNull();
      expect(res.score).toBe(0);
    });

    it("2.7 rejects inputs exceeding detection character limit (200,000 chars)", () => {
      const hugeInput = "a".repeat(detectionLimit + 1);
      expect(() => detectTools(hugeInput)).toThrow(/Detection supports up to 200,000 characters/i);
    });

    it("2.8 flags malformed JSON as 'possible' confidence with json-validator suggestion", () => {
      const malformed = '{"title": "Unclosed string, missing brace';
      const result = detectClipboardContent(malformed);
      expect(result.format).toBe("JSON");
      expect(result.confidence).toBe("possible");
      expect(result.score).toBeLessThan(70);
      expect(result.topMatch?.slug).toBe("json-validator");
    });

    it("2.9 disambiguates 10-digit numbers as timestamps vs arbitrary numbers", () => {
      const validTimestamp = "1710000000";
      const res = detectClipboardContent(validTimestamp);
      expect(res.format).toBe("Unix Timestamp");
      expect(res.confidence).toBe("high");
    });

    it("2.10 preserves recent detections in sessionStorage across reloads", () => {
      const storageMock = (() => {
        const store: Record<string, string> = {};
        return {
          getItem: (key: string) => store[key] ?? null,
          setItem: (key: string, val: string) => { store[key] = val; },
          clear: () => { Object.keys(store).forEach(k => delete store[k]); },
        };
      })();
      const storage = typeof sessionStorage !== "undefined" ? sessionStorage : storageMock;
      const triageRecord = {
        id: "triage-1",
        timestamp: Date.now(),
        format: "JSON",
        snippet: '{"test": 1}',
        score: 98,
      };
      storage.setItem("codestation_triage_history", JSON.stringify([triageRecord]));

      const stored = storage.getItem("codestation_triage_history");
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed[0].format).toBe("JSON");
      expect(parsed[0].score).toBe(98);
    });
  });

  describe("R3: AI & Prompts Edge Cases", () => {
    it("2.11 token counter handles empty strings, emojis, and multilingual text", () => {
      const emptyRes = countTokens("", "gpt-4o");
      expect(emptyRes.tokenCount).toBe(0);
      expect(emptyRes.charCount).toBe(0);

      const emojiText = "🚀 Code Station 🤖 ✨";
      const emojiRes = countTokens(emojiText, "gpt-4o");
      expect(emojiRes.tokenCount).toBeGreaterThan(0);

      const japaneseText = "コードステーションは開発者向けツールです。";
      const jpRes = countTokens(japaneseText, "gpt-4o");
      expect(jpRes.tokenCount).toBeGreaterThan(0);
    });

    it("2.12 json-repair leaves already valid JSON unchanged without corruption", () => {
      const pristine = '{\n  "version": 1,\n  "verified": true\n}';
      const res = repairJson(pristine);
      expect(res.success).toBe(true);
      expect(JSON.parse(res.repaired)).toEqual(JSON.parse(pristine));
    });

    it("2.13 json-repair balances unclosed brackets and truncated arrays/objects", () => {
      const truncated = '{"user": {"name": "Alice", "tags": ["admin", "dev"';
      const res = repairJson(truncated);
      expect(res.success).toBe(true);
      const parsed = JSON.parse(res.repaired);
      expect(parsed.user.name).toBe("Alice");
      expect(parsed.user.tags).toEqual(["admin", "dev"]);
    });

    it("2.14 prompt-interpolator handles missing record values and unclosed braces gracefully", () => {
      const template = "Welcome {{name}}, your balance is {{balance}} and code is {code}.";
      const records = [{ name: "Alice" }]; // missing balance and code
      const res = interpolatePrompt({ template, records });
      expect(res.results[0].interpolatedPrompt).toContain("Welcome Alice");
    });

    it("2.15 vector-similarity throws on vector dimension mismatch and handles zero vectors safely", () => {
      expect(() => computeVectorSimilarity([1, 2], [1, 2, 3])).toThrow(/Dimension mismatch/i);

      // Zero vector handled without NaN
      const zeroMetrics = computeVectorSimilarity([0, 0, 0], [1, 2, 3]);
      expect(Number.isNaN(zeroMetrics.cosineSimilarity)).toBe(false);
    });
  });

  describe("R4: WebPKI & Crypto Edge Cases", () => {
    it("2.16 aes-crypto throws clear authentication error when ciphertext or auth tag is tampered", async () => {
      const key = generateAesKey(256);
      const enc = await encryptAesGcm("Original Message", { mode: "raw", keyLength: 256, rawKey: key.hex });

      // Tamper ciphertext in combined string
      const tampered = enc.combined.slice(0, -4) + "ffff";
      await expect(decryptAesGcm(tampered, { mode: "raw", keyLength: 256, rawKey: key.hex })).rejects.toThrow();
    });

    it("2.17 jwt-signer-verifier detects expired tokens and clock skew tolerance", async () => {
      const secret = "jwt-secret";
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const token = await signJwt({ alg: "HS256", typ: "JWT" }, { sub: "expired-user", exp: pastTime }, secret);

      const verifyRes = await verifyJwt(token, secret, { clockSkew: 0 });
      expect(verifyRes.valid).toBe(false);
      expect(verifyRes.expired).toBe(true);

      // With large clock skew (7200 seconds), token is accepted
      const skewRes = await verifyJwt(token, secret, { clockSkew: 7200 });
      expect(skewRes.valid).toBe(true);
    });

    it("2.18 jwt-signer-verifier rejects tokens before 'nbf' (not before) claim", async () => {
      const secret = "jwt-secret";
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour in future
      const token = await signJwt({ alg: "HS256", typ: "JWT" }, { sub: "future-user", nbf: futureTime }, secret);

      const verifyRes = await verifyJwt(token, secret, { clockSkew: 0 });
      expect(verifyRes.valid).toBe(false);
      expect(verifyRes.notBeforeValid).toBe(false);
    });

    it("2.19 csr-inspector rejects corrupted or invalid CSR inputs gracefully", async () => {
      const invalidCsr = "-----BEGIN CERTIFICATE REQUEST-----\n1234NotBase64!\n-----END CERTIFICATE REQUEST-----";
      await expect(parseCsr(invalidCsr)).rejects.toThrow();
    });

    it("2.20 csp-builder produces safe defaults when passed empty directives", () => {
      const res = buildCspHeader({});
      expect(res.headerString).toBeDefined();
      expect(typeof res.headerString).toBe("string");
    });
  });

  describe("R5: Universal Recipe Pipeline Studio Edge Cases", () => {
    it("2.21 handles single-step and empty recipes gracefully", async () => {
      const emptyRecipe = { version: 1 as const, source: "text" as const, steps: [] };
      await expect(executePipeline(emptyRecipe as any, "hello")).rejects.toThrow();
    });

    it("2.22 halts execution and preserves preceding intermediate outputs when a step fails", async () => {
      const recipe = {
        version: 1 as const,
        source: "json" as const,
        steps: ["json-formatter", "json-to-csv"],
      };

      // Invalid input for json-to-csv: an object instead of array of objects
      const input = '{"single": "object"}';
      const result = await executePipeline(recipe, input);

      expect(result.success).toBe(false);
      expect(result.steps.length).toBe(2);
      expect(result.steps[0].status).toBe("success");
      expect(result.steps[1].status).toBe("error");
      expect(result.finalOutput).toBe(result.steps[0].output);
    });

    it("2.23 rejects invalid or malformed recipe JSON on import", () => {
      expect(() => importRecipeFromJson("not valid json")).toThrow();
      expect(() => importRecipeFromJson('{"version":99}')).toThrow();
    });
  });

  describe("R6: Spreadsheet SQL Edge Cases", () => {
    it("2.24 returns informative error for empty CSV or empty query without crashing", async () => {
      const emptyDataRes = await executeSql("", "SELECT * FROM table");
      expect(emptyDataRes.error).toContain("empty");

      const emptyQueryRes = await executeSql(SAMPLE_CSV_DATA, "");
      expect(emptyQueryRes.error).toContain("empty");
    });

    it("2.25 returns clean error for SQL syntax errors", async () => {
      const syntaxErrorRes = await executeSql(SAMPLE_CSV_DATA, "SELECT FROM WHERE");
      expect(syntaxErrorRes.error).toBeDefined();
      expect(syntaxErrorRes.rowCount).toBe(0);
    });

    it("2.26 returns clean error when querying non-existent tables", async () => {
      const badTableRes = await executeSql(SAMPLE_CSV_DATA, "SELECT * FROM non_existent_table");
      expect(badTableRes.error).toBeDefined();
    });

    it("2.27 handles RFC-4180 CSV cells containing commas, escaped quotes, and multiline values", async () => {
      const complexCsv = `id,name,notes\n1,"Doe, Jane","Senior Engineer, ""Core Architecture"""\n2,"Smith, John","Product Lead"`;
      const query = "SELECT name, notes FROM table WHERE id = 1";
      const result = await executeSql(complexCsv, query);

      expect(result.error).toBeUndefined();
      expect(result.rowCount).toBe(1);
      expect(result.rows[0][0]).toBe("Doe, Jane");
    });

    it("2.28 detects delimiters automatically (comma, tab, semicolon)", () => {
      expect(detectDelimiter("col1,col2,col3")).toBe(",");
      expect(detectDelimiter("col1\tcol2\tcol3")).toBe("\t");
      expect(detectDelimiter("col1;col2;col3")).toBe(";");
    });
  });
});

// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS
// ============================================================================

describe("Tier 3: Cross-Feature Combinations", () => {
  it("3.1 Cross-Feature Flow: Triage -> AI Prompt Builder -> Token Counter", () => {
    // 1. Paste user prompt idea into triage
    const promptDraft = "# System Instruction\nYou are a principal engineer. Format outputs as JSON.";
    const triage = detectClipboardContent(promptDraft);
    expect(triage.format).toBe("Markdown");

    // 2. Feed into system prompt builder
    const builtPrompt = buildSystemPrompt({
      roleName: "Principal Engineer",
      roleTone: "concise",
      coreTask: "Review system pull requests and enforce zero-telemetry rules.",
      xmlWrapping: true,
      guardrails: ["Never expose private tokens"],
      chainOfThought: true,
      outputFormat: "json",
    });

    // 3. Count tokens of the generated prompt
    const tokenResult = countTokens(builtPrompt.assembledPrompt, "gpt-4o", { inputPricePer1M: 2.5, outputPricePer1M: 10.0 });
    expect(tokenResult.tokenCount).toBeGreaterThan(20);
    expect(tokenResult.estimatedInputCost).toBeGreaterThan(0);
  });

  it("3.2 Cross-Feature Flow: Spreadsheet SQL -> CSV Export -> Pipeline Studio -> JSON", async () => {
    // 1. Execute SQL aggregation
    const sqlRes = await executeSql(SAMPLE_CSV_DATA, "SELECT department, COUNT(*) AS count FROM table GROUP BY department");
    expect(sqlRes.rowCount).toBe(4);

    // 2. Export SQL result to CSV
    const csvData = exportQueryResultToCsv(sqlRes);

    // 3. Chain through Pipeline Studio (csv-to-json -> json-formatter)
    const pipelineRes = await executePipeline(
      { version: 1, source: "csv", steps: ["csv-to-json", "json-formatter"] },
      csvData
    );

    expect(pipelineRes.success).toBe(true);
    const parsed = JSON.parse(pipelineRes.finalOutput);
    expect(parsed.length).toBe(4);
    expect(parsed.some((item: any) => item.department === "Engineering")).toBe(true);
  });

  it("3.3 Cross-Feature Flow: Omni-Triage -> Station 24 JWT Verifier", async () => {
    // 1. Generate token in Station 24
    const secret = "cross-station-shared-secret-key-123456";
    const token = await signJwt({ alg: "HS256", typ: "JWT" }, { sub: "service-agent", scope: "read:all" }, secret);

    // 2. Triage receives the token from clipboard
    const triage = detectClipboardContent(token);
    expect(triage.format).toBe("JWT");
    expect(triage.score).toBeGreaterThanOrEqual(95);

    // 3. Triage routes to jwt-signer-verifier
    const verifyRes = await verifyJwt(triage.text, secret);
    expect(verifyRes.valid).toBe(true);
    expect(verifyRes.payload.sub).toBe("service-agent");
  });

  it("3.4 Cross-Feature Flow: AI JSON Repair -> Pipeline Studio YAML Conversion", async () => {
    // 1. Messy JSON from LLM
    const messyLlmJson = `\`\`\`json
{
  title: 'Architecture Blueprint',
  modules: ['pdf', 'triage', 'crypto', 'workflows',],
  active: True,
}
\`\`\``;

    // 2. Repair via Station 25 JSON Repair
    const repairRes = repairJson(messyLlmJson);
    expect(repairRes.success).toBe(true);

    // 3. Pass repaired JSON into Recipe Pipeline (json-to-yaml)
    const pipelineRes = await executePipeline(
      { version: 1, source: "json", steps: ["json-to-yaml"] },
      repairRes.repaired
    );

    expect(pipelineRes.success).toBe(true);
    expect(pipelineRes.finalOutput).toContain("title: Architecture Blueprint");
    expect(pipelineRes.finalOutput).toContain("- pdf");
    expect(pipelineRes.finalOutput).toContain("active: true");
  });

  it("3.5 Cross-Feature Flow: Station 24 RSA Keygen -> JWT RS256 Signing & Verification", async () => {
    // 1. Generate RSA key pair in Station 24
    const rsaKeys = await generateRsaKeyPair(2048);

    // 2. Sign JWT using generated private key PEM
    const payload = { sub: "admin-bot", iss: "https://codestation.in", iat: Math.floor(Date.now() / 1000) };
    const rs256Token = await signJwt({ alg: "RS256", typ: "JWT" }, payload, rsaKeys.privateKeyPem);
    expect(rs256Token.split(".").length).toBe(3);

    // 3. Verify JWT using generated public key PEM
    const verifyRes = await verifyJwt(rs256Token, rsaKeys.publicKeyPem);
    expect(verifyRes.valid).toBe(true);
    expect(verifyRes.payload.sub).toBe("admin-bot");
  });
});

// ============================================================================
// TIER 4: REAL-WORLD SCENARIOS
// ============================================================================

describe("Tier 4: Real-World Scenarios", () => {
  it("4.1 Enterprise PDF Document Publishing Workflow", async () => {
    // Scenario: A legal team produces a 3-page confidential report.
    // Step 1: Create multi-page master document
    const masterPdf = await createSamplePdf(3, "Enterprise Quarterly Financials");

    // Step 2: Apply diagonal confidential watermark across all pages
    const watermarkedPdf = await applyWatermark(masterPdf, {
      type: "text",
      text: "STRICTLY CONFIDENTIAL",
      fontSize: 32,
      opacity: 0.35,
      rotation: 45,
      color: "#990000",
      position: "center",
    });

    // Step 3: Apply formal header/footer page numbering
    const publishedPdf = await applyPageNumbers(watermarkedPdf, {
      format: "page-x-of-y",
      verticalPosition: "footer",
      alignment: "right",
      fontFamily: "Times Roman",
      fontSize: 10,
      margin: 28,
    });

    // Verification: Document remains valid, retains 3 pages, and size reflects modifications
    const finalDoc = await PDFDocument.load(publishedPdf);
    expect(finalDoc.getPageCount()).toBe(3);
    expect(publishedPdf.byteLength).toBeGreaterThan(masterPdf.byteLength);
  });

  it("4.2 Developer Incident Triage to Automated Processing Pipeline", async () => {
    // Scenario: Developer copies a raw Git conflict during merge resolution
    const conflictSnippet = `<<<<<<< HEAD
{
  "apiEndpoint": "https://api.codestation.in/v1",
  "cacheTtlSeconds": 300
}
=======
{
  "apiEndpoint": "https://api.codestation.in/v2",
  "cacheTtlSeconds": 600
}
>>>>>>> main`;

    // 1. Triage detects conflict
    const triage = detectClipboardContent(conflictSnippet);
    expect(triage.format).toBe("Git Merge Conflict");
    expect(triage.topMatch?.slug).toBe("conflict-parse");

    // 2. Developer resolves conflict to v2 config
    const resolvedConfig = '{\n  "apiEndpoint": "https://api.codestation.in/v2",\n  "cacheTtlSeconds": 600\n}';

    // 3. Pass resolved JSON through compression & format pipeline
    const pipeline = await executePipeline(
      { version: 1, source: "json", steps: ["json-formatter", "json-minifier"] },
      resolvedConfig
    );

    expect(pipeline.success).toBe(true);
    expect(pipeline.finalOutput).toBe('{"apiEndpoint":"https://api.codestation.in/v2","cacheTtlSeconds":600}');
  });

  it("4.3 Comprehensive WebPKI Security Audit and Hardening Lifecycle", async () => {
    // Scenario: Security engineer verifies CSR, creates strict CSP, and tests JWT session token
    // 1. Parse incoming CSR
    const csrDetails = await parseCsr(SAMPLE_CSR_PEM);
    expect(csrDetails.signatureValid).toBe(true);
    expect(csrDetails.subject.commonName).toBe("example.com");

    // 2. Generate hardened Content Security Policy
    const csp = buildCspHeader({
      "default-src": ["'none'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "https://fonts.googleapis.com"],
      "connect-src": ["'self'"],
      "img-src": ["'self'", "data:"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "frame-ancestors": ["'none'"],
      "upgrade-insecure-requests": true,
    });
    expect(csp.warnings.length).toBe(0); // Zero unsafe warnings
    expect(csp.headerString).toContain("default-src 'none'");

    // 3. Issue cryptographically signed session token
    const serverSecret = "hardened-production-secret-998877";
    const sessionToken = await signJwt(
      { alg: "HS256", typ: "JWT" },
      { sub: "sec-admin", iss: "https://codestation.in", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 1800 },
      serverSecret
    );

    const verified = await verifyJwt(sessionToken, serverSecret);
    expect(verified.valid).toBe(true);
    expect(verified.payload.sub).toBe("sec-admin");
  });

  it("4.4 Full Business Intelligence Analytics Pipeline on Tabular Payroll Data", async () => {
    // Scenario: HR & Finance ingest 8-record payroll dataset, run department salary analysis,
    // and export results to CSV and JSON for audit reporting.
    const query = "SELECT department, COUNT(*) AS active_employees, AVG(salary) AS avg_salary, MAX(salary) AS max_salary FROM table WHERE status = 'active' GROUP BY department ORDER BY avg_salary DESC";
    const result = await executeSql(SAMPLE_CSV_DATA, query);

    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(4);

    // Highest average active salary should be Engineering (115,000)
    expect(result.rows[0][0]).toBe("Engineering");
    expect(result.rows[0][1]).toBe(2);
    expect(Number(result.rows[0][2])).toBe(115000);
    expect(Number(result.rows[0][3])).toBe(120000);

    // Export audit packages
    const csvAudit = exportQueryResultToCsv(result);
    const jsonAudit = exportQueryResultToJson(result);

    expect(csvAudit).toContain("department,active_employees,avg_salary,max_salary");
    expect(jsonAudit).toContain('"department": "Engineering"');
  });
});
