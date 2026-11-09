import { describe, expect, it } from "vitest";
import {
  bytesToHex,
  hexToBytes,
  bytesToBase64,
  base64ToBytes,
  base64UrlEncode,
  base64UrlDecode,
  formatPem,
  parsePem,
  getRandomBytes,
  generateAesKey,
  encryptAesGcm,
  decryptAesGcm,
  generateRsaKeyPair,
  signJwt,
  verifyJwt,
  parseCsr,
  buildCspHeader,
  DEFAULT_CSP_DIRECTIVES,
} from "./engine";

describe("crypto-pki engine: byte utilities", () => {
  it("converts bytes to hex and back", () => {
    const bytes = new Uint8Array([0, 15, 16, 255, 128, 42]);
    const hex = bytesToHex(bytes);
    expect(hex).toBe("000f10ff802a");
    const restored = hexToBytes(hex);
    expect(restored).toEqual(bytes);
  });

  it("throws on invalid hex string length", () => {
    expect(() => hexToBytes("abc")).toThrow("Invalid hex string: length must be even");
  });

  it("converts bytes to base64 and back", () => {
    const text = "Hello Web Crypto World!";
    const bytes = new TextEncoder().encode(text);
    const b64 = bytesToBase64(bytes);
    const restored = base64ToBytes(b64);
    expect(new TextDecoder().decode(restored)).toBe(text);
  });

  it("converts base64url and handles URL-unsafe characters", () => {
    const bytes = new Uint8Array([251, 255, 254]); // produces + and / in standard base64
    const b64url = base64UrlEncode(bytes);
    expect(b64url).not.toContain("+");
    expect(b64url).not.toContain("/");
    expect(b64url).not.toContain("=");
    const decoded = base64UrlDecode(b64url);
    expect(decoded).toEqual(bytes);
  });

  it("formats and parses PEM containers", () => {
    const raw = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const b64 = bytesToBase64(raw);
    const pem = formatPem(b64, "TEST CERTIFICATE");
    expect(pem).toContain("-----BEGIN TEST CERTIFICATE-----");
    expect(pem).toContain("-----END TEST CERTIFICATE-----");
    const parsed = parsePem(pem);
    expect(parsed).toEqual(raw);
  });

  it("generates random bytes of requested length", () => {
    const r12 = getRandomBytes(12);
    expect(r12.length).toBe(12);
    const r16 = getRandomBytes(16);
    expect(r16.length).toBe(16);
  });
});

describe("crypto-pki engine: AES-GCM crypto", () => {
  it("generates 128-bit and 256-bit AES keys", () => {
    const key128 = generateAesKey(128);
    expect(hexToBytes(key128.hex).length).toBe(16);
    const key256 = generateAesKey(256);
    expect(hexToBytes(key256.hex).length).toBe(32);
  });

  it("encrypts and decrypts with PBKDF2 passphrase (256-bit AES-GCM)", async () => {
    const secretMessage = "Top Secret WebPKI Information";
    const passphrase = "correct-horse-battery-staple";

    const encResult = await encryptAesGcm(secretMessage, {
      mode: "passphrase",
      keyLength: 256,
      passphrase,
    });

    expect(encResult.ciphertext).toBeDefined();
    expect(encResult.iv).toBeDefined();
    expect(encResult.tag).toBeDefined();
    expect(encResult.salt).toBeDefined();
    expect(encResult.combined).toContain(":");

    // Decrypt using the combined string
    const decrypted = await decryptAesGcm(encResult.combined, {
      mode: "passphrase",
      keyLength: 256,
      passphrase,
    });

    expect(decrypted).toBe(secretMessage);
  });

  it("encrypts and decrypts with 128-bit AES-GCM", async () => {
    const secretMessage = "128-bit GCM Test Message";
    const passphrase = "short-password";

    const encResult = await encryptAesGcm(secretMessage, {
      mode: "passphrase",
      keyLength: 128,
      passphrase,
    });

    const decrypted = await decryptAesGcm(encResult.combined, {
      mode: "passphrase",
      keyLength: 128,
      passphrase,
    });

    expect(decrypted).toBe(secretMessage);
  });

  it("encrypts and decrypts with raw key (Hex)", async () => {
    const secretMessage = "Raw key authenticated payload";
    const rawKey = generateAesKey(256).hex;

    const encResult = await encryptAesGcm(secretMessage, {
      mode: "raw",
      keyLength: 256,
      rawKey,
    });

    // Decrypt using JSON bundle format
    const decrypted = await decryptAesGcm(encResult.jsonBundle, {
      mode: "raw",
      keyLength: 256,
      rawKey,
    });

    expect(decrypted).toBe(secretMessage);
  });

  it("supports Additional Authenticated Data (AAD) and detects tampering", async () => {
    const message = "Header-authenticated message";
    const rawKey = generateAesKey(256).hex;
    const aad = "user-id=98765;session=xyz";

    const encResult = await encryptAesGcm(message, {
      mode: "raw",
      keyLength: 256,
      rawKey,
      aad,
    });

    // Decrypt with matching AAD succeeds
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
        rawKey,
      }
    );
    expect(decrypted).toBe(message);

    // Decrypt with mismatched AAD fails gracefully with authentication tag mismatch error
    await expect(
      decryptAesGcm(
        {
          ciphertext: encResult.ciphertext,
          iv: encResult.iv,
          tag: encResult.tag,
          aad: "user-id=MALICIOUS_USER;session=xyz",
          encoding: "base64",
        },
        {
          mode: "raw",
          keyLength: 256,
          rawKey,
        }
      )
    ).rejects.toThrow("authentication tag mismatch or corrupted ciphertext");
  });

  it("handles corrupted ciphertext or wrong passphrase gracefully", async () => {
    const secretMessage = "Integrity check message";
    const passphrase = "valid-passphrase";

    const encResult = await encryptAesGcm(secretMessage, {
      mode: "passphrase",
      passphrase,
    });

    // Wrong passphrase
    await expect(
      decryptAesGcm(encResult.combined, {
        mode: "passphrase",
        passphrase: "wrong-passphrase-attempt",
      })
    ).rejects.toThrow("authentication tag mismatch or corrupted ciphertext");

    // Tampered combined string
    const tampered = encResult.combined.slice(0, -4) + "ffff";
    await expect(
      decryptAesGcm(tampered, {
        mode: "passphrase",
        passphrase,
      })
    ).rejects.toThrow("authentication tag mismatch or corrupted ciphertext");
  });
});

describe("crypto-pki engine: RSA Key Generator", () => {
  it("generates 2048-bit RSA key pair with valid PEM exports", async () => {
    const keyPair = await generateRsaKeyPair(2048);

    expect(keyPair.modulusLength).toBe(2048);
    expect(keyPair.publicExponent).toBe(65537);
    expect(keyPair.privateKeyPem).toContain("-----BEGIN PRIVATE KEY-----");
    expect(keyPair.privateKeyPem).toContain("-----END PRIVATE KEY-----");
    expect(keyPair.publicKeyPem).toContain("-----BEGIN PUBLIC KEY-----");
    expect(keyPair.publicKeyPem).toContain("-----END PUBLIC KEY-----");
    expect(keyPair.fingerprint).toMatch(/^SHA256:[0-9a-f:]{95}$/);
  });
});

describe("crypto-pki engine: JWT Signer & Verifier", () => {
  it("signs and verifies HS256 JWT tokens", async () => {
    const header = { alg: "HS256" as const, typ: "JWT" };
    const payload = {
      sub: "1234567890",
      name: "John Doe",
      admin: true,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const secret = "my-ultra-secure-hmac-secret-key-32";

    const token = await signJwt(header, payload, secret);
    expect(token.split(".").length).toBe(3);

    const verification = await verifyJwt(token, secret);
    expect(verification.valid).toBe(true);
    expect(verification.signatureValid).toBe(true);
    expect(verification.expired).toBe(false);
    expect(verification.payload.name).toBe("John Doe");
    expect(verification.payload.sub).toBe("1234567890");
  });

  it("signs and verifies HS384 and HS512 JWT tokens", async () => {
    const secret = "shared-secret-key-for-hmac";
    for (const alg of ["HS384", "HS512"] as const) {
      const token = await signJwt(
        { alg, typ: "JWT" },
        { sub: `test-${alg}`, exp: Math.floor(Date.now() / 1000) + 1800 },
        secret
      );
      const res = await verifyJwt(token, secret);
      expect(res.valid).toBe(true);
      expect(res.header.alg).toBe(alg);
    }
  });

  it("signs and verifies RS256 JWT tokens using RSA key pair", async () => {
    const rsaKeys = await generateRsaKeyPair(2048);

    const header = { alg: "RS256" as const, typ: "JWT" };
    const payload = {
      sub: "rsa-user-999",
      role: "pki-administrator",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const token = await signJwt(header, payload, rsaKeys.privateKeyPem);
    expect(token).toBeDefined();

    // Verify using SPKI public key PEM
    const res = await verifyJwt(token, rsaKeys.publicKeyPem);
    expect(res.valid).toBe(true);
    expect(res.signatureValid).toBe(true);
    expect(res.payload.role).toBe("pki-administrator");

    // Verification with wrong public key fails
    const anotherKeyPair = await generateRsaKeyPair(2048);
    const wrongRes = await verifyJwt(token, anotherKeyPair.publicKeyPem);
    expect(wrongRes.valid).toBe(false);
    expect(wrongRes.signatureValid).toBe(false);
  });

  it("detects expired tokens (exp in past)", async () => {
    const secret = "secret123";
    const token = await signJwt(
      { alg: "HS256" },
      { sub: "user1", exp: Math.floor(Date.now() / 1000) - 100 },
      secret
    );

    const res = await verifyJwt(token, secret, { clockSkew: 10 });
    expect(res.signatureValid).toBe(true);
    expect(res.expired).toBe(true);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Token expired");
  });

  it("detects not-yet-valid tokens (nbf in future)", async () => {
    const secret = "secret123";
    const token = await signJwt(
      { alg: "HS256" },
      { sub: "user1", nbf: Math.floor(Date.now() / 1000) + 500 },
      secret
    );

    const res = await verifyJwt(token, secret, { clockSkew: 10 });
    expect(res.signatureValid).toBe(true);
    expect(res.notBeforeValid).toBe(false);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Token not active");
  });

  it("fails on malformed token", async () => {
    const res = await verifyJwt("not-a-valid-token", "secret");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Malformed JWT");
  });
});

describe("crypto-pki engine: CSR Inspector", () => {
  const sampleCsrPem = `-----BEGIN CERTIFICATE REQUEST-----
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

  it("parses Subject DN fields from PKCS#10 CSR", async () => {
    const details = await parseCsr(sampleCsrPem);

    expect(details.version).toBe(1);
    expect(details.subject.commonName).toBe("example.com");
    expect(details.subject.organization).toBe("CodeStation");
    expect(details.subject.organizationalUnit).toBe("Engineering");
    expect(details.subject.locality).toBe("San Francisco");
    expect(details.subject.stateOrProvince).toBe("California");
    expect(details.subject.country).toBe("US");
  });

  it("extracts Subject Alternative Names (SANs) from CSR extensions", async () => {
    const details = await parseCsr(sampleCsrPem);

    expect(details.subjectAltNames).toContain("DNS:example.com");
    expect(details.subjectAltNames).toContain("DNS:www.example.com");
    expect(details.subjectAltNames).toContain("IP:192.168.1.100");
  });

  it("extracts public key details and verifies self-signature cryptographically", async () => {
    const details = await parseCsr(sampleCsrPem);

    expect(details.publicKey.algorithm).toBe("RSA Encryption");
    expect(details.publicKey.bitLength).toBe(2048);
    expect(details.publicKey.exponent).toBe(65537);
    expect(details.signatureAlgorithm).toBe("sha256WithRSAEncryption");
    expect(details.signatureValid).toBe(true);
    expect(details.signatureVerificationNote).toContain("Valid self-signature");
  });

  it("throws clear error on malformed PEM", async () => {
    await expect(parseCsr("-----BEGIN INVALID-----\n123\n-----END INVALID-----")).rejects.toThrow();
  });
});

describe("crypto-pki engine: CSP Builder", () => {
  it("builds a secure default Content-Security-Policy with grade A+", () => {
    const result = buildCspHeader(DEFAULT_CSP_DIRECTIVES);

    expect(result.headerString).toContain("default-src 'self'");
    expect(result.headerString).toContain("script-src 'self'");
    expect(result.headerString).toContain("object-src 'none'");
    expect(result.headerString).toContain("upgrade-insecure-requests");
    expect(result.grade).toBe("A+");
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.warnings.length).toBe(0);
    expect(result.metaHtml).toContain('<meta http-equiv="Content-Security-Policy"');
    expect(result.nginxConfig).toContain('add_header Content-Security-Policy "');
  });

  it("flags critical warning and lowers grade when unsafe-inline is used in script-src", () => {
    const directives = {
      ...DEFAULT_CSP_DIRECTIVES,
      "script-src": ["'self'", "'unsafe-inline'"],
    };

    const result = buildCspHeader(directives);
    expect(result.headerString).toContain("script-src 'self' 'unsafe-inline'");

    const inlineWarning = result.warnings.find(
      (w) => w.directive === "script-src" && w.severity === "critical"
    );
    expect(inlineWarning).toBeDefined();
    expect(inlineWarning?.message).toContain("'unsafe-inline' enables arbitrary inline scripts");
    expect(result.score).toBeLessThan(90);
  });

  it("flags critical warning when unsafe-eval is used in script-src", () => {
    const directives = {
      ...DEFAULT_CSP_DIRECTIVES,
      "script-src": ["'self'", "'unsafe-eval'"],
    };

    const result = buildCspHeader(directives);
    const evalWarning = result.warnings.find(
      (w) => w.directive === "script-src" && w.message.includes("'unsafe-eval'")
    );
    expect(evalWarning).toBeDefined();
    expect(evalWarning?.severity).toBe("critical");
  });

  it("flags warning when object-src is missing or not none", () => {
    const directives = {
      ...DEFAULT_CSP_DIRECTIVES,
      "object-src": ["'self'"],
    };

    const result = buildCspHeader(directives);
    const objWarning = result.warnings.find((w) => w.directive === "object-src");
    expect(objWarning).toBeDefined();
    expect(objWarning?.recommendation).toContain("object-src 'none'");
  });
});
