import { describe, it, expect } from "vitest";
import { curlToCode } from "./curl-to-code";

describe("curlToCode Universal Generator", () => {
  const sampleCurl = `curl -X POST "https://api.example.com/v1/items" -H "Content-Type: application/json" -H "Authorization: Bearer my-secret-token" -d '{"name":"Widget","quantity":5}'`;

  it("converts cURL to TypeScript fetch with auth redacted by default", async () => {
    const res = await curlToCode(sampleCurl, "fetch");
    expect(res.language).toBe("typescript");
    expect(res.code).toContain('fetch("https://api.example.com/v1/items"');
    expect(res.code).toContain('method: "POST"');
    expect(res.code).toContain('"Authorization": "Bearer [REDACTED]"');
  });

  it("preserves literal auth token when redactAuth: false", async () => {
    const res = await curlToCode(sampleCurl, "fetch", { redactAuth: false });
    expect(res.code).toContain('"Authorization": "Bearer my-secret-token"');
  });

  it("converts cURL to TypeScript axios", async () => {
    const res = await curlToCode(sampleCurl, "axios");
    expect(res.language).toBe("typescript");
    expect(res.code).toContain('import axios from "axios";');
    expect(res.code).toContain('method: "POST"');
    expect(res.code).toContain('url: "https://api.example.com/v1/items"');
  });

  it("converts cURL to Python requests", async () => {
    const res = await curlToCode(sampleCurl, "python");
    expect(res.language).toBe("python");
    expect(res.code).toContain("import requests");
    expect(res.code).toContain('requests.request(');
  });

  it("converts cURL to Go net/http", async () => {
    const res = await curlToCode(sampleCurl, "go");
    expect(res.language).toBe("go");
    expect(res.code).toContain("package main");
    expect(res.code).toContain('net/http');
    expect(res.code).toContain('http.NewRequest("POST", "https://api.example.com/v1/items"');
  });

  it("handles insecure TLS flag and emits warning", async () => {
    const curlInsecure = `curl -k "https://api.example.com/health"`;
    const res = await curlToCode(curlInsecure, "fetch");
    expect(res.warnings.some(w => w.includes("--insecure"))).toBe(true);
    expect(res.code).toContain('fetch("https://api.example.com/health"');
  });

  it("handles cookies and redirects", async () => {
    const curlCookies = `curl -L -b "session_id=abc123" "https://example.com/dashboard"`;
    const res = await curlToCode(curlCookies, "fetch");
    expect(res.warnings.some(w => w.includes("--location"))).toBe(true);
    expect(res.code).toContain('"Cookie": "session_id=abc123"');
  });

  it("handles unsupported flags by warning instead of crashing", async () => {
    const curlRetry = `curl --retry 3 "https://example.com/api"`;
    const res = await curlToCode(curlRetry, "fetch");
    expect(res.warnings.some(w => w.includes("--retry"))).toBe(true);
  });

  it("rejects empty command safely", async () => {
    await expect(curlToCode("")).rejects.toThrow(/cannot be empty/);
  });
});
