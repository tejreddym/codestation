// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import {
  detectTools,
  detectClipboardContent,
  detectionLimit,
  type Detection,
} from "./detection";
import { getTool } from "@/config/tools";
import ClipboardOmniTriage from "@/components/ClipboardOmniTriage";
import { WorkbenchProvider } from "@/components/WorkbenchProvider";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/components/useSafeNavigation", () => ({
  useSafePathname: () => "/workbench",
  useSafeRouter: () => ({ push }),
}));

describe("Milestone 2: Smart Clipboard Omni-Triage - 13-Format Detection", () => {
  // Format 1: JSON
  describe("Format 1: JSON", () => {
    it("detects valid JSON object with high confidence and multiple tool matches", () => {
      const input = '{"name": "Code Station", "version": 1, "features": ["detection", "web-mcp"]}';
      const result = detectClipboardContent(input);

      expect(result.format).toBe("JSON");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(98);
      expect(result.topMatch?.slug).toBe("json-formatter");
      expect(result.matches.map(m => m.slug)).toEqual([
        "json-formatter",
        "json-tree-viewer",
        "json-validator",
      ]);
      expect(getTool("json-formatter")).toBeDefined();
    });

    it("detects valid JSON array with high confidence", () => {
      const input = '[{"id": 1, "name": "Item A"}, {"id": 2, "name": "Item B"}]';
      const result = detectClipboardContent(input);

      expect(result.format).toBe("JSON");
      expect(result.confidence).toBe("high");
      expect(result.topMatch?.slug).toBe("json-formatter");
    });

    it("detects malformed JSON with possible confidence", () => {
      const input = "{ key: unquotedValue, missingQuotes: true, }";
      const result = detectClipboardContent(input);

      expect(result.format).toBe("JSON");
      expect(result.confidence).toBe("possible");
      expect(result.score).toBe(65);
      expect(result.topMatch?.slug).toBe("json-validator");
    });
  });

  // Format 2: JWT
  describe("Format 2: JWT", () => {
    it("detects valid JWT structure with high confidence", () => {
      const jwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const result = detectClipboardContent(jwt);

      expect(result.format).toBe("JWT");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(99);
      expect(result.topMatch?.slug).toBe("jwt-decoder");
      expect(getTool("jwt-decoder")).toBeDefined();
    });

    it("does not classify non-JSON 3-segment string as JWT", () => {
      const badJwt = "foo.bar.baz";
      const result = detectClipboardContent(badJwt);

      expect(result.format).not.toBe("JWT");
      expect(result.confidence).toBe("possible");
    });
  });

  // Format 3: Unix Timestamp
  describe("Format 3: Unix Timestamp (10 or 13 digits)", () => {
    it("detects 10-digit Unix timestamp (seconds) with high confidence", () => {
      const timestamp = "1728000000";
      const result = detectClipboardContent(timestamp);

      expect(result.format).toBe("Unix Timestamp");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(94);
      expect(result.topMatch?.slug).toBe("unix-timestamp-converter");
      expect(result.matches.some(m => m.slug === "timestamp-to-date")).toBe(true);
      expect(getTool("unix-timestamp-converter")).toBeDefined();
    });

    it("detects 13-digit Unix timestamp (milliseconds) with high confidence", () => {
      const timestampMs = "1728000000000";
      const result = detectClipboardContent(timestampMs);

      expect(result.format).toBe("Unix Timestamp");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(96);
      expect(result.topMatch?.slug).toBe("unix-milliseconds-converter");
      expect(getTool("unix-milliseconds-converter")).toBeDefined();
    });

    it("handles negative Unix timestamp", () => {
      const negativeSec = "-0000000001";
      const result = detectClipboardContent(negativeSec);

      expect(result.format).toBe("Unix Timestamp");
      expect(result.confidence).toBe("high");
    });
  });

  // Format 4: CIDR / IP Range
  describe("Format 4: CIDR / IP Range", () => {
    it("detects IPv4 CIDR subnet with high confidence", () => {
      const cidr = "192.168.1.0/24";
      const result = detectClipboardContent(cidr);

      expect(result.format).toBe("CIDR / IP Range");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(98);
      expect(result.topMatch?.slug).toBe("cidr-calculator");
      expect(getTool("cidr-calculator")).toBeDefined();
    });

    it("detects IPv4 address range with high confidence", () => {
      const range = "10.0.0.1 - 10.0.0.254";
      const result = detectClipboardContent(range);

      expect(result.format).toBe("CIDR / IP Range");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(96);
      expect(result.topMatch?.slug).toBe("cidr-calculator");
    });

    it("detects standalone IPv4 address", () => {
      const ip = "172.16.254.1";
      const result = detectClipboardContent(ip);

      expect(result.format).toBe("CIDR / IP Range");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(92);
      expect(result.topMatch?.slug).toBe("cidr-calculator");
    });

    it("detects IPv6 address and CIDR prefix", () => {
      const ipv6Cidr = "2001:db8::/32";
      const result = detectClipboardContent(ipv6Cidr);

      expect(result.format).toBe("CIDR / IP Range");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(95);
      expect(result.topMatch?.slug).toBe("ipv4-to-ipv6");
    });
  });

  // Format 5: Cron Expression
  describe("Format 5: Cron Expression", () => {
    it("detects standard 5-field cron expression", () => {
      const cron = "0 9 * * 1-5";
      const result = detectClipboardContent(cron);

      expect(result.format).toBe("Cron Expression");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(95);
      expect(result.topMatch?.slug).toBe("cron-explainer");
      expect(result.matches.some(m => m.slug === "cron-validator")).toBe(true);
      expect(getTool("cron-explainer")).toBeDefined();
    });

    it("detects 6-field seconds-extended cron expression", () => {
      const cron6 = "*/15 * * * * *";
      const result = detectClipboardContent(cron6);

      expect(result.format).toBe("Cron Expression");
      expect(result.confidence).toBe("high");
      expect(result.topMatch?.slug).toBe("cron-explainer");
    });

    it("detects cron shortcuts (@hourly, @daily)", () => {
      const hourly = "@hourly";
      const result = detectClipboardContent(hourly);

      expect(result.format).toBe("Cron Expression");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(98);
      expect(result.topMatch?.slug).toBe("cron-explainer");
    });

    it("does not classify non-cron words as cron", () => {
      const sentence = "quick brown fox jumps over";
      const result = detectClipboardContent(sentence);

      expect(result.format).not.toBe("Cron Expression");
      expect(result.confidence).toBe("possible");
    });
  });

  // Format 6: Git Merge Conflict Markers
  describe("Format 6: Git Merge Conflict Markers", () => {
    it("detects Git merge conflict markers with 99% score", () => {
      const conflict = `<<<<<<< HEAD
const theme = 'dark';
=======
const theme = 'light';
>>>>>>> main`;
      const result = detectClipboardContent(conflict);

      expect(result.format).toBe("Git Merge Conflict");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(99);
      expect(result.topMatch?.slug).toBe("conflict-parse");
      expect(getTool("conflict-parse")).toBeDefined();
    });
  });

  // Format 7: PEM Certificate / Key
  describe("Format 7: PEM Certificate / Key", () => {
    it("detects PEM certificate block with high confidence", () => {
      const pem = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAL9W32X...
-----END CERTIFICATE-----`;
      const result = detectClipboardContent(pem);

      expect(result.format).toBe("PEM Certificate / Key");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(99);
      expect(result.topMatch?.slug).toBe("cert-inspector");
      expect(getTool("cert-inspector")).toBeDefined();
    });

    it("detects PEM private key block", () => {
      const pemKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0...
-----END RSA PRIVATE KEY-----`;
      const result = detectClipboardContent(pemKey);

      expect(result.format).toBe("PEM Certificate / Key");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(99);
      expect(result.topMatch?.slug).toBe("cert-inspector");
    });
  });

  // Format 8: Base64 Data (including Data URLs)
  describe("Format 8: Base64 Data (including Data URLs)", () => {
    it("detects Base64 data URL with high confidence", () => {
      const dataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const result = detectClipboardContent(dataUrl);

      expect(result.format).toBe("Base64 Data URL");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(96);
      expect(result.topMatch?.slug).toBe("data-uri-decoder");
      expect(getTool("data-uri-decoder")).toBeDefined();
    });

    it("detects Gzip Base64 archive with possible confidence", () => {
      const gzipB64 = "H4sICAAAAAAA/w==";
      const result = detectClipboardContent(gzipB64);

      expect(result.format).toBe("Base64 Gzip");
      expect(result.confidence).toBe("possible");
      expect(result.score).toBe(85);
      expect(result.topMatch?.slug).toBe("gzip-decompressor");
    });

    it("detects printable Base64 string with possible confidence", () => {
      const b64 = "SGVsbG8gd29ybGQ=";
      const result = detectClipboardContent(b64);

      expect(result.format).toBe("Base64");
      expect(result.confidence).toBe("possible");
      expect(result.score).toBe(80);
      expect(result.topMatch?.slug).toBe("base64-decoder");
    });
  });

  // Format 9: URL
  describe("Format 9: URL", () => {
    it("detects valid HTTPS URL with high confidence", () => {
      const url = "https://github.com/codestation/dev-tools?tab=readme";
      const result = detectClipboardContent(url);

      expect(result.format).toBe("URL");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(98);
      expect(result.topMatch?.slug).toBe("url-parser");
      expect(getTool("url-parser")).toBeDefined();
    });

    it("does not auto-route non-http protocols like file:// or javascript:", () => {
      expect(detectClipboardContent("file:///etc/passwd").confidence).toBe("possible");
      expect(detectClipboardContent("javascript:alert(1)").confidence).toBe("possible");
    });
  });

  // Format 10: UUID
  describe("Format 10: UUID", () => {
    it("detects standard v4 UUID with high confidence", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = detectClipboardContent(uuid);

      expect(result.format).toBe("UUID");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(99);
      expect(result.topMatch?.slug).toBe("uuid-parser");
      expect(getTool("uuid-parser")).toBeDefined();
    });
  });

  // Format 11: Hex Color
  describe("Format 11: Hex Color", () => {
    it("detects 6-character hex color (#D9F975)", () => {
      const hex = "#D9F975";
      const result = detectClipboardContent(hex);

      expect(result.format).toBe("Hex Color");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(98);
      expect(result.topMatch?.slug).toBe("color-converter");
      expect(getTool("color-converter")).toBeDefined();
    });

    it("detects 3-character hex color (#abc)", () => {
      const hex3 = "#abc";
      const result = detectClipboardContent(hex3);

      expect(result.format).toBe("Hex Color");
      expect(result.confidence).toBe("high");
      expect(result.topMatch?.slug).toBe("color-converter");
    });

    it("detects 8-character hex color with alpha (#12345678)", () => {
      const hex8 = "#12345678";
      const result = detectClipboardContent(hex8);

      expect(result.format).toBe("Hex Color");
      expect(result.confidence).toBe("high");
    });

    it("rejects invalid 5-character hex (#abcde)", () => {
      const result = detectClipboardContent("#abcde");
      expect(result.confidence).toBe("possible");
    });
  });

  // Format 12: Markdown
  describe("Format 12: Markdown", () => {
    it("detects Markdown table structure with high confidence", () => {
      const table = `| Tool | Station | Available |
| --- | --- | --- |
| json-formatter | Structured Data | Yes |
| color-converter | Color & CSS | Yes |`;
      const result = detectClipboardContent(table);

      expect(result.format).toBe("Markdown");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(92);
      expect(result.topMatch?.slug).toBe("markdown-preview");
      expect(getTool("markdown-preview")).toBeDefined();
    });

    it("detects fenced code block Markdown with high confidence", () => {
      const codeBlock = `\`\`\`typescript
const greeting: string = "Hello, world!";
console.log(greeting);
\`\`\``;
      const result = detectClipboardContent(codeBlock);

      expect(result.format).toBe("Markdown");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(92);
      expect(result.topMatch?.slug).toBe("markdown-preview");
    });

    it("detects multi-feature Markdown (headings, links, lists)", () => {
      const mdDoc = `# Project Overview

Welcome to the documentation. See [Code Station Guide](https://example.com).

- Feature 1
- Feature 2`;
      const result = detectClipboardContent(mdDoc);

      expect(result.format).toBe("Markdown");
      expect(result.confidence).toBe("high");
      expect(result.topMatch?.slug).toBe("markdown-preview");
    });
  });

  // Format 13: SQL
  describe("Format 13: SQL", () => {
    it("detects SELECT query with high confidence", () => {
      const sql = "SELECT department, COUNT(*), AVG(salary) FROM employees WHERE status = 'active' GROUP BY department;";
      const result = detectClipboardContent(sql);

      expect(result.format).toBe("SQL");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(94);
      expect(result.topMatch?.slug).toBe("sql-formatter");
      expect(result.matches.some(m => m.slug === "sql-validator")).toBe(true);
      expect(getTool("sql-formatter")).toBeDefined();
    });

    it("detects INSERT query with high confidence", () => {
      const sqlInsert = "INSERT INTO users (username, email) VALUES ('alice', 'alice@example.com');";
      const result = detectClipboardContent(sqlInsert);

      expect(result.format).toBe("SQL");
      expect(result.confidence).toBe("high");
      expect(result.score).toBe(94);
      expect(result.topMatch?.slug).toBe("sql-formatter");
    });

    it("detects CREATE TABLE DDL statement", () => {
      const sqlDdl = "CREATE TABLE products (id INT PRIMARY KEY, name VARCHAR(255), price DECIMAL(10,2));";
      const result = detectClipboardContent(sqlDdl);

      expect(result.format).toBe("SQL");
      expect(result.confidence).toBe("high");
    });
  });

  // Fallback & Bounds
  describe("Fallback and Boundaries", () => {
    it("classifies unrecognized text as Plain Text with possible confidence", () => {
      const plain = "The quick brown fox jumps over the lazy dog";
      const result = detectClipboardContent(plain);

      expect(result.format).toBe("Plain Text");
      expect(result.confidence).toBe("possible");
      expect(result.score).toBe(30);
      expect(result.topMatch?.slug).toBe("text-counter");
    });

    it("returns empty matches for blank or whitespace-only input", () => {
      expect(detectClipboardContent("").matches).toEqual([]);
      expect(detectClipboardContent("   \n\t  ").matches).toEqual([]);
      expect(detectClipboardContent("").topMatch).toBeNull();
    });

    it("throws error when exceeding character limit", () => {
      expect(() => detectTools("a".repeat(detectionLimit + 1))).toThrow(
        "200,000 characters"
      );
    });

    it("attaches numeric percentage score and format string to all Detection objects", () => {
      const detections: Detection[] = detectTools('{"test": 123}');
      for (const d of detections) {
        expect(typeof d.score).toBe("number");
        expect(d.score).toBeGreaterThanOrEqual(0);
        expect(d.score).toBeLessThanOrEqual(100);
        expect(typeof d.format).toBe("string");
        expect(d.format.length).toBeGreaterThan(0);
        expect(["high", "possible"]).toContain(d.confidence);
      }
    });
  });
});

describe("Milestone 2: ClipboardOmniTriage Component UI & Interactions", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    push.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders with required placeholder and shortcut hint", () => {
    render(
      React.createElement(WorkbenchProvider, null, React.createElement(ClipboardOmniTriage))
    );

    const input = screen.getByPlaceholderText(
      "📋 Paste anything here to auto-detect format… (Cmd/Ctrl + V)"
    );
    expect(input).toBeDefined();
    expect(screen.getByText("Smart Clipboard Omni-Triage")).toBeDefined();
  });

  it("focuses input when Cmd/Ctrl + Shift + V is pressed", () => {
    render(
      React.createElement(WorkbenchProvider, null, React.createElement(ClipboardOmniTriage))
    );

    const input = screen.getByPlaceholderText(
      "📋 Paste anything here to auto-detect format… (Cmd/Ctrl + V)"
    ) as HTMLTextAreaElement;

    // Dispatch global shortcut event
    fireEvent.keyDown(window, {
      key: "v",
      code: "KeyV",
      metaKey: true,
      shiftKey: true,
    });

    expect(document.activeElement).toBe(input);
  });

  it("displays visual format badge and confidence score upon entering text", async () => {
    render(
      React.createElement(WorkbenchProvider, null, React.createElement(ClipboardOmniTriage))
    );

    const input = screen.getByPlaceholderText(
      "📋 Paste anything here to auto-detect format… (Cmd/Ctrl + V)"
    );

    fireEvent.change(input, { target: { value: '{"key": "value"}' } });

    await waitFor(() => {
      expect(screen.getByText("JSON")).toBeDefined();
      expect(screen.getByText("High Confidence")).toBeDefined();
      expect(screen.getByText("Confidence: 98%")).toBeDefined();
    });
  });

  it("one-click deep links to tool route with input prefill and persists in sessionStorage", async () => {
    render(
      React.createElement(WorkbenchProvider, null, React.createElement(ClipboardOmniTriage))
    );

    const input = screen.getByPlaceholderText(
      "📋 Paste anything here to auto-detect format… (Cmd/Ctrl + V)"
    );

    fireEvent.change(input, { target: { value: "192.168.1.0/24" } });

    await waitFor(() => {
      expect(screen.getByText("CIDR / IP Range")).toBeDefined();
    });

    const openBtn = screen.getByRole("button", { name: /Open in CIDR Subnet Calculator/i });
    fireEvent.click(openBtn);

    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("/tools/cidr-calculator?input=192.168.1.0%2F24")
    );

    // Verify sessionStorage persistence
    const storedHistory = sessionStorage.getItem("codestation_triage_history");
    expect(storedHistory).toBeTruthy();
    expect(storedHistory).toContain("192.168.1.0/24");
    expect(storedHistory).toContain("CIDR / IP Range");

    const pendingInput = sessionStorage.getItem("codestation_pending_input");
    expect(pendingInput).toBeTruthy();
    expect(JSON.parse(pendingInput!).slug).toBe("cidr-calculator");
  });

  it("clears input on clear button click", async () => {
    render(
      React.createElement(WorkbenchProvider, null, React.createElement(ClipboardOmniTriage))
    );

    const input = screen.getByPlaceholderText(
      "📋 Paste anything here to auto-detect format… (Cmd/Ctrl + V)"
    ) as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: "#D9F975" } });
    expect(input.value).toBe("#D9F975");

    const clearBtn = screen.getByTitle("Clear input");
    fireEvent.click(clearBtn);

    expect(input.value).toBe("");
  });
});
