import { localDefinition, type LocalField, type LocalDefinition } from "./local-contract";

export const cryptoPkiToolIds = [
  "aes-crypto",
  "rsa-key-generator",
  "jwt-signer-verifier",
  "csr-inspector",
  "csp-builder",
] as const;

export type CryptoPkiToolId = (typeof cryptoPkiToolIds)[number];

const notice =
  "100% in-browser cryptographic processing using Web Crypto API. Private keys, passphrases, AES-GCM payloads, and certificate requests are calculated client-side and never sent to any server.";

const define = (
  id: CryptoPkiToolId,
  title: string,
  fields: LocalField[],
  outputs: string[],
  defaults: Record<string, unknown> = {},
  extra: string[] = [],
  action = "Process"
): LocalDefinition<CryptoPkiToolId> =>
  localDefinition(id, title, "WebPKI & Advanced Cryptography", fields, outputs, defaults, [notice, ...extra], action);

export const cryptoPkiTools: readonly LocalDefinition<CryptoPkiToolId>[] = [
  define(
    "aes-crypto",
    "AES-GCM Encrypt & Decrypt",
    [
      { name: "mode", label: "Operation Mode", control: "select", options: ["Encrypt", "Decrypt"] },
      { name: "keyMode", label: "Key Mode", control: "select", options: ["Passphrase (PBKDF2)", "Raw Key (Hex/Base64)"] },
      { name: "keyLength", label: "Key Length", control: "select", options: ["256-bit", "128-bit"] },
      { name: "input", label: "Plaintext or Encrypted Payload", control: "textarea" },
      { name: "passphrase", label: "Passphrase", control: "text", optional: true },
      { name: "rawKey", label: "Raw Secret Key (Hex or Base64)", control: "text", optional: true },
      { name: "iv", label: "Initialization Vector (12-byte Hex, Optional)", control: "text", optional: true },
      { name: "aad", label: "Additional Authenticated Data (AAD, Optional)", control: "text", optional: true },
    ],
    [
      "Ciphertext (Base64)",
      "Ciphertext (Hex)",
      "Authentication Tag (128-bit)",
      "Initialization Vector (IV / Nonce)",
      "JSON Bundle Format",
      "Decrypted Plaintext",
    ],
    {
      mode: "Encrypt",
      keyMode: "Passphrase (PBKDF2)",
      keyLength: "256-bit",
      input: "Confidential payload for Web Crypto AES-GCM encryption.",
      passphrase: "correct-horse-battery-staple",
      rawKey: "",
      iv: "",
      aad: "",
    },
    [],
    "Encrypt / Decrypt"
  ),
  define(
    "rsa-key-generator",
    "RSA Key Pair Generator",
    [
      { name: "keySize", label: "Key Size", control: "select", options: ["2048-bit", "3072-bit", "4096-bit"] },
    ],
    [
      "PKCS#8 Private Key PEM",
      "SPKI Public Key PEM",
      "SHA-256 Public Key Fingerprint",
      "Key Metadata (Modulus & Exponent)",
    ],
    { keySize: "2048-bit" },
    [],
    "Generate Key Pair"
  ),
  define(
    "jwt-signer-verifier",
    "JWT Signer & Verifier",
    [
      { name: "mode", label: "Operation Mode", control: "select", options: ["Sign JWT", "Verify JWT"] },
      { name: "algorithm", label: "Algorithm", control: "select", options: ["HS256", "HS384", "HS512", "RS256"] },
      { name: "header", label: "Header (JSON)", control: "textarea" },
      { name: "payload", label: "Payload (JSON)", control: "textarea" },
      { name: "token", label: "Compact JWT Token", control: "textarea", optional: true },
      { name: "secret", label: "Secret Key (or RSA Private Key PEM)", control: "textarea" },
      { name: "publicKey", label: "RSA Public Key PEM (for RS256 Verification)", control: "textarea", optional: true },
    ],
    [
      "Compact JWT Token",
      "Cryptographic Signature Validity",
      "Decoded Header JSON",
      "Decoded Payload JSON",
      "Claims Validation (exp, nbf, clock skew)",
    ],
    {
      mode: "Sign JWT",
      algorithm: "HS256",
      header: '{\n  "alg": "HS256",\n  "typ": "JWT"\n}',
      payload: '{\n  "sub": "user_12345",\n  "name": "Alice Developer",\n  "admin": true,\n  "iat": 1700000000,\n  "exp": 1800000000\n}',
      token: "",
      secret: "your-256-bit-secret",
      publicKey: "",
    },
    [],
    "Sign / Verify JWT"
  ),
  define(
    "csr-inspector",
    "CSR (Certificate Signing Request) Inspector",
    [
      { name: "input", label: "PKCS#10 PEM or Base64 DER", control: "textarea" },
    ],
    [
      "Subject Distinguished Name (DN)",
      "Subject Alternative Names (SANs)",
      "Public Key Algorithm & Modulus",
      "Cryptographic Self-Signature Validity",
      "Parsed ASN.1 Structure",
    ],
    {
      input:
        "-----BEGIN CERTIFICATE REQUEST-----\nMIIDATCCAekCAQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWEx\nFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xFDASBgNVBAoMC0NvZGVTdGF0aW9uMRQw\nEgYDVQQLDAtFbmdpbmVlcmluZzEUMBIGA1UEAwwLZXhhbXBsZS5jb20wggEiMA0G\nCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDJmvSQ210ROEgCHZMq1LW/zonwJsZZ\n1qUYgGC07Zph+zxX5kpZG51jcVmz1TlufkD9J4NQA9Y+6GMa08CL+33C4JlMV7D7\neQ7KpYYpnWlwOtN+K4juD1gCL0bhEaYiuzSQPDud1kwiXIswRerAVj7nf0hBvU9p\ngI64lLJFo3nd/DBtgn+Ddk6ttbvNPvBymo4nci4uIOySL9TxQF9fty7ytpN65shA\nyeYIx9T/k8G0L01iRUQ0ad9R2Rqsmtt+YsV6fVdwy94sjvZ9sUAePSZGsskpmUnN\n/hZMuPJvudSsqNeTdbUWRzqw643jSoYijG16EPkDHBmLyS299WsDq+z1AgMBAAGg\nQDA+BgkqhkiG9w0BCQ4xMTAvMC0GA1UdEQQmMCSCC2V4YW1wbGUuY29tgg93d3cu\nZXhhbXBsZS5jb22HBMCoAWQwDQYJKoZIhvcNAQELBQADggEBAL5qqIhyUM+fazXC\nBGT5khvCtIUMJsshMHXFW+IcjTmF5VG1GtnZ3Oey5+Z3vTJ3PcUiJpovQ6+HPoct\nO6ec405DIoggf660Q56AMSk3khoaAdWcq3guMFJcSP4+0afKF7kYzbESRAVccsRz\n/n7dHfXCedJzDrsdUyIucidxFVhwrLzBRv0MmjRDXEtSCDMiP+dosJWMxbPkS/HW\nhS5G+58QVDKcFgWaZ7HIKbu0tNLKiCqP06/dH5vf+fldF54PvIq1/fQjCiTx0qF/\n7FGRe334sHNay2UjDWxMWN/IAHqCWKfGJ6fE2Vv8qr+TTOziUscwC0e00zrGaeuX\nlQKOGyc=\n-----END CERTIFICATE REQUEST-----",
    },
    [],
    "Inspect CSR"
  ),
  define(
    "csp-builder",
    "CSP (Content Security Policy) Builder",
    [
      { name: "defaultSrc", label: "default-src", control: "text" },
      { name: "scriptSrc", label: "script-src", control: "text" },
      { name: "styleSrc", label: "style-src", control: "text" },
      { name: "imgSrc", label: "img-src", control: "text" },
      { name: "connectSrc", label: "connect-src", control: "text" },
      { name: "fontSrc", label: "font-src", control: "text" },
      { name: "objectSrc", label: "object-src", control: "text" },
      { name: "frameAncestors", label: "frame-ancestors", control: "text" },
      { name: "baseUri", label: "base-uri", control: "text" },
    ],
    [
      "HTTP Header String",
      "Security Audit Score & Grade",
      "Actionable Risk Warnings",
      "HTML Meta Tag Equivalent",
      "Nginx Configuration Directive",
      "Next.js Headers Configuration",
    ],
    {
      defaultSrc: "'self'",
      scriptSrc: "'self'",
      styleSrc: "'self'",
      imgSrc: "'self' data:",
      connectSrc: "'self'",
      fontSrc: "'self'",
      objectSrc: "'none'",
      frameAncestors: "'none'",
      baseUri: "'self'",
    },
    [],
    "Build Policy"
  ),
];

export const getCryptoPkiDefinition = (id: string) => cryptoPkiTools.find((tool) => tool.id === id);
export const isCryptoPkiToolId = (id: string): id is CryptoPkiToolId =>
  (cryptoPkiToolIds as readonly string[]).includes(id);
