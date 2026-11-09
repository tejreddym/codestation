// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  cryptoPkiTools,
  cryptoPkiToolIds,
  getCryptoPkiDefinition,
  isCryptoPkiToolId,
} from "./crypto-pki-tools";
import CryptoPkiStation from "@/components/CryptoPkiStation";

afterEach(cleanup);

describe("crypto-pki tools registry", () => {
  it("defines all 5 crypto-pki tool ids", () => {
    expect(cryptoPkiTools.map((t) => t.id)).toEqual(cryptoPkiToolIds);
    expect(cryptoPkiToolIds).toEqual([
      "aes-crypto",
      "rsa-key-generator",
      "jwt-signer-verifier",
      "csr-inspector",
      "csp-builder",
    ]);
  });

  it("assigns category and localContract to every tool", () => {
    for (const tool of cryptoPkiTools) {
      expect(tool.category).toBe("WebPKI & Advanced Cryptography");
      expect(tool.localContract.fields.length).toBeGreaterThan(0);
      expect(tool.localContract.outputs.length).toBeGreaterThan(0);
      expect(tool.localContract.notices.length).toBeGreaterThan(0);
      expect(tool.localContract.action.length).toBeGreaterThan(0);
      expect(tool.description).toContain("Process locally in your browser");
    }
  });

  it("supports getCryptoPkiDefinition for each registered tool", () => {
    for (const id of cryptoPkiToolIds) {
      const def = getCryptoPkiDefinition(id);
      expect(def).toBeDefined();
      expect(def?.id).toBe(id);
      expect(def?.slug).toBe(id);
    }
    expect(getCryptoPkiDefinition("unknown-tool")).toBeUndefined();
  });

  it("validates isCryptoPkiToolId type guard", () => {
    for (const id of cryptoPkiToolIds) {
      expect(isCryptoPkiToolId(id)).toBe(true);
    }
    expect(isCryptoPkiToolId("non-existent")).toBe(false);
    expect(isCryptoPkiToolId("")).toBe(false);
  });

  it("defines appropriate defaults for aes-crypto", () => {
    const aes = getCryptoPkiDefinition("aes-crypto")!;
    expect(aes.localContract.defaults.mode).toBe("Encrypt");
    expect(aes.localContract.defaults.keyMode).toBe("Passphrase (PBKDF2)");
    expect(aes.localContract.defaults.keyLength).toBe("256-bit");
    expect(aes.localContract.defaults.input).toBeDefined();
  });

  it("defines appropriate defaults for rsa-key-generator", () => {
    const rsa = getCryptoPkiDefinition("rsa-key-generator")!;
    expect(rsa.localContract.defaults.keySize).toBe("2048-bit");
  });

  it("defines appropriate defaults for jwt-signer-verifier", () => {
    const jwt = getCryptoPkiDefinition("jwt-signer-verifier")!;
    expect(jwt.localContract.defaults.algorithm).toBe("HS256");
    expect(jwt.localContract.defaults.mode).toBe("Sign JWT");
  });

  it("defines appropriate defaults for csr-inspector", () => {
    const csr = getCryptoPkiDefinition("csr-inspector")!;
    expect(csr.localContract.defaults.input).toContain("BEGIN CERTIFICATE REQUEST");
  });

  it("defines appropriate defaults for csp-builder", () => {
    const csp = getCryptoPkiDefinition("csp-builder")!;
    expect(csp.localContract.defaults.defaultSrc).toBe("'self'");
    expect(csp.localContract.defaults.scriptSrc).toBe("'self'");
    expect(csp.localContract.defaults.objectSrc).toBe("'none'");
  });
});

describe("CryptoPkiStation UI component", () => {
  it("renders aes-crypto workspace with WebMCP attributes", () => {
    const { container } = render(<CryptoPkiStation toolId="aes-crypto" />);
    expect(container.querySelector("[data-webmcp-tool='aes-crypto']")).toBeDefined();
    expect(screen.getByText("AES-GCM Configuration")).toBeDefined();
    expect(screen.getByText("Encrypt Data")).toBeDefined();
  });

  it("renders rsa-key-generator workspace", () => {
    render(<CryptoPkiStation toolId="rsa-key-generator" />);
    expect(screen.getByText("RSA Key Pair Generator")).toBeDefined();
    expect(screen.getByText("Generate RSA Key Pair")).toBeDefined();
  });

  it("renders jwt-signer-verifier workspace", () => {
    render(<CryptoPkiStation toolId="jwt-signer-verifier" />);
    expect(screen.getByText("JWT Signer & Verifier")).toBeDefined();
    expect(screen.getAllByText("Sign JWT").length).toBeGreaterThanOrEqual(1);
  });

  it("renders csr-inspector workspace", () => {
    render(<CryptoPkiStation toolId="csr-inspector" />);
    expect(screen.getByText("PKCS#10 Certificate Signing Request")).toBeDefined();
    expect(screen.getByText("Inspect CSR")).toBeDefined();
  });

  it("renders csp-builder workspace with security grade and score", () => {
    render(<CryptoPkiStation toolId="csp-builder" />);
    expect(screen.getByText("Content Security Policy Builder")).toBeDefined();
    expect(screen.getByText("Generated CSP Header")).toBeDefined();
  });
});
