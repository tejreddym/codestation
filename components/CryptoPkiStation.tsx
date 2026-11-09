"use client";

import { useState } from "react";
import {
  getCryptoPkiDefinition,
  type CryptoPkiToolId,
} from "@/config/crypto-pki-tools";
import {
  encryptAesGcm,
  decryptAesGcm,
  generateAesKey,
  getRandomBytes,
  bytesToHex,
  generateRsaKeyPair,
  signJwt,
  verifyJwt,
  parseCsr,
  buildCspHeader,
  DEFAULT_CSP_DIRECTIVES,
  type AesResult,
  type RsaKeyPairPem,
  type JwtVerifyResult,
  type CsrDetails,
  type CspDirectives,
  type CspHeaderResult,
  type JwtAlgorithm,
} from "@/lib/tools/crypto-pki/engine";
import { useToolHandoff } from "./WorkbenchProvider";
import styles from "./CryptoPkiStation.module.css";

interface CryptoPkiStationProps {
  toolId: CryptoPkiToolId;
}

export default function CryptoPkiStation({ toolId }: CryptoPkiStationProps) {
  const definition = getCryptoPkiDefinition(toolId)!;

  // Global UI state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function downloadText(content: string, filename: string, type = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --------------------------------------------------------------------------
  // Tool 1: AES-GCM
  // --------------------------------------------------------------------------
  const [aesOpMode, setAesOpMode] = useState<"Encrypt" | "Decrypt">("Encrypt");
  const [aesKeyMode, setAesKeyMode] = useState<"passphrase" | "raw">("passphrase");
  const [aesKeyLength, setAesKeyLength] = useState<128 | 256>(256);
  const [aesInput, setAesInput] = useState(
    (definition?.localContract?.defaults?.input as string) ||
      "Confidential payload for Web Crypto AES-GCM encryption."
  );
  const [aesPassphrase, setAesPassphrase] = useState("correct-horse-battery-staple");
  const [aesRawKey, setAesRawKey] = useState("");
  const [aesIv, setAesIv] = useState("");
  const [aesAad, setAesAad] = useState("");
  const [aesResult, setAesResult] = useState<AesResult | null>(null);
  const [aesDecryptedText, setAesDecryptedText] = useState<string | null>(null);
  const [aesError, setAesError] = useState<string | null>(null);
  const [aesBusy, setAesBusy] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  // Tool handoff support for triage pre-fill
  useToolHandoff("aes-crypto", (text) => {
    setAesInput(text);
    if (text.includes(":") || text.startsWith("{")) {
      setAesOpMode("Decrypt");
    }
  });

  function handleGenerateAesKey() {
    const key = generateAesKey(aesKeyLength);
    setAesRawKey(key.hex);
  }

  function handleGenerateAesIv() {
    const ivBytes = getRandomBytes(12);
    setAesIv(bytesToHex(ivBytes));
  }

  async function handleExecuteAes() {
    setAesError(null);
    setAesBusy(true);
    try {
      if (aesOpMode === "Encrypt") {
        setAesDecryptedText(null);
        const res = await encryptAesGcm(aesInput, {
          mode: aesKeyMode,
          keyLength: aesKeyLength,
          passphrase: aesPassphrase,
          rawKey: aesRawKey,
          iv: aesIv || undefined,
          aad: aesAad || undefined,
        });
        setAesResult(res);
      } else {
        setAesResult(null);
        const decrypted = await decryptAesGcm(aesInput, {
          mode: aesKeyMode,
          keyLength: aesKeyLength,
          passphrase: aesPassphrase,
          rawKey: aesRawKey,
        });
        setAesDecryptedText(decrypted);
      }
    } catch (err) {
      setAesError((err as Error).message);
    } finally {
      setAesBusy(false);
    }
  }

  // --------------------------------------------------------------------------
  // Tool 2: RSA Key Generator
  // --------------------------------------------------------------------------
  const [rsaKeySize, setRsaKeySize] = useState<2048 | 3072 | 4096>(2048);
  const [rsaResult, setRsaResult] = useState<RsaKeyPairPem | null>(null);
  const [rsaBusy, setRsaBusy] = useState(false);
  const [rsaError, setRsaError] = useState<string | null>(null);

  async function handleGenerateRsa() {
    setRsaError(null);
    setRsaBusy(true);
    try {
      const keys = await generateRsaKeyPair(rsaKeySize);
      setRsaResult(keys);
    } catch (err) {
      setRsaError((err as Error).message);
    } finally {
      setRsaBusy(false);
    }
  }

  // --------------------------------------------------------------------------
  // Tool 3: JWT Signer & Verifier
  // --------------------------------------------------------------------------
  const [jwtOpMode, setJwtOpMode] = useState<"Sign JWT" | "Verify JWT">("Sign JWT");
  const [jwtAlgorithm, setJwtAlgorithm] = useState<JwtAlgorithm>("HS256");
  const [jwtHeader, setJwtHeader] = useState('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
  const [jwtPayload, setJwtPayload] = useState(
    '{\n  "sub": "user_12345",\n  "name": "Alice Developer",\n  "admin": true,\n  "iat": ' +
      Math.floor(Date.now() / 1000) +
      ',\n  "exp": ' +
      Math.floor(Date.now() / 1000 + 3600) +
      "\n}"
  );
  const [jwtSecret, setJwtSecret] = useState("your-256-bit-secret");
  const [jwtPublicKey, setJwtPublicKey] = useState("");
  const [jwtTokenInput, setJwtTokenInput] = useState("");
  const [jwtClockSkew, setJwtClockSkew] = useState(60);
  const [jwtSignedToken, setJwtSignedToken] = useState<string | null>(null);
  const [jwtVerifyResult, setJwtVerifyResult] = useState<JwtVerifyResult | null>(null);
  const [jwtError, setJwtError] = useState<string | null>(null);
  const [jwtBusy, setJwtBusy] = useState(false);

  useToolHandoff("jwt-signer-verifier", (text) => {
    setJwtTokenInput(text);
    setJwtOpMode("Verify JWT");
  });

  function handleSetJwtAlgorithm(alg: JwtAlgorithm) {
    setJwtAlgorithm(alg);
    try {
      const parsed = JSON.parse(jwtHeader);
      parsed.alg = alg;
      setJwtHeader(JSON.stringify(parsed, null, 2));
    } catch {
      setJwtHeader(`{\n  "alg": "${alg}",\n  "typ": "JWT"\n}`);
    }
  }

  function handleQuickTimestamp(type: "now" | "1h" | "24h" | "7d") {
    try {
      const parsed = JSON.parse(jwtPayload);
      const now = Math.floor(Date.now() / 1000);
      parsed.iat = now;
      if (type === "1h") parsed.exp = now + 3600;
      if (type === "24h") parsed.exp = now + 86400;
      if (type === "7d") parsed.exp = now + 86400 * 7;
      setJwtPayload(JSON.stringify(parsed, null, 2));
    } catch {
      // ignore
    }
  }

  async function handleExecuteJwt() {
    setJwtError(null);
    setJwtBusy(true);
    try {
      if (jwtOpMode === "Sign JWT") {
        setJwtVerifyResult(null);
        const headerObj = JSON.parse(jwtHeader);
        headerObj.alg = jwtAlgorithm;
        const payloadObj = JSON.parse(jwtPayload);
        const token = await signJwt(headerObj, payloadObj, jwtSecret);
        setJwtSignedToken(token);
      } else {
        setJwtSignedToken(null);
        const keyOrSecret = jwtAlgorithm === "RS256" ? jwtPublicKey : jwtSecret;
        const res = await verifyJwt(jwtTokenInput, keyOrSecret, { clockSkew: jwtClockSkew });
        setJwtVerifyResult(res);
      }
    } catch (err) {
      setJwtError((err as Error).message);
    } finally {
      setJwtBusy(false);
    }
  }

  // --------------------------------------------------------------------------
  // Tool 4: CSR Inspector
  // --------------------------------------------------------------------------
  const [csrInput, setCsrInput] = useState(
    (definition?.localContract?.defaults?.input as string) || ""
  );
  const [csrResult, setCsrResult] = useState<CsrDetails | null>(null);
  const [csrError, setCsrError] = useState<string | null>(null);
  const [csrBusy, setCsrBusy] = useState(false);
  const [showAsn1Tree, setShowAsn1Tree] = useState(false);

  useToolHandoff("csr-inspector", (text) => {
    setCsrInput(text);
  });

  async function handleInspectCsr() {
    setCsrError(null);
    setCsrBusy(true);
    try {
      const details = await parseCsr(csrInput);
      setCsrResult(details);
    } catch (err) {
      setCsrError((err as Error).message);
    } finally {
      setCsrBusy(false);
    }
  }

  // --------------------------------------------------------------------------
  // Tool 5: CSP Builder
  // --------------------------------------------------------------------------
  const [cspDirectives, setCspDirectives] = useState<CspDirectives>(DEFAULT_CSP_DIRECTIVES);
  const [cspResult, setCspResult] = useState<CspHeaderResult>(() =>
    buildCspHeader(DEFAULT_CSP_DIRECTIVES)
  );

  function handleDirectiveTokenToggle(directive: keyof CspDirectives, token: string) {
    setCspDirectives((prev) => {
      const current = (prev[directive] as string[]) || [];
      const updated = current.includes(token)
        ? current.filter((t) => t !== token)
        : [...current, token];
      const next = { ...prev, [directive]: updated };
      setCspResult(buildCspHeader(next));
      return next;
    });
  }

  function handleCustomDomainAdd(directive: keyof CspDirectives, val: string) {
    if (!val.trim()) return;
    setCspDirectives((prev) => {
      const current = (prev[directive] as string[]) || [];
      const tokensToAdd = val.split(/\s+/).filter(Boolean);
      const updated = Array.from(new Set([...current, ...tokensToAdd]));
      const next = { ...prev, [directive]: updated };
      setCspResult(buildCspHeader(next));
      return next;
    });
  }

  function handleUpgradeInsecureToggle() {
    setCspDirectives((prev) => {
      const next = { ...prev, "upgrade-insecure-requests": !prev["upgrade-insecure-requests"] };
      setCspResult(buildCspHeader(next));
      return next;
    });
  }

  return (
    <div
      className={styles.container}
      data-webmcp-tool={toolId}
      data-webmcp-category="WebPKI & Advanced Cryptography"
      data-webmcp-slug={toolId}
    >
      <div className={styles.noticeBanner}>
        <span>🔒</span>
        <span>
          100% In-Browser Cryptography. Operations execute locally using Web Crypto API. Private
          keys and passphrases never leave your browser.
        </span>
      </div>

      {/* =====================================================================
          Tool 1: AES-GCM Encrypt & Decrypt
          ===================================================================== */}
      {toolId === "aes-crypto" && (
        <>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>AES-GCM Configuration</span>
              <div className={styles.tabs}>
                <button
                  type="button"
                  className={`${styles.tab} ${aesOpMode === "Encrypt" ? styles.tabActive : ""}`}
                  onClick={() => setAesOpMode("Encrypt")}
                >
                  Encrypt
                </button>
                <button
                  type="button"
                  className={`${styles.tab} ${aesOpMode === "Decrypt" ? styles.tabActive : ""}`}
                  onClick={() => setAesOpMode("Decrypt")}
                >
                  Decrypt
                </button>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="aes-key-mode">Key Derivation Mode</label>
                <select
                  id="aes-key-mode"
                  className={styles.select}
                  value={aesKeyMode}
                  onChange={(e) => setAesKeyMode(e.target.value as "passphrase" | "raw")}
                >
                  <option value="passphrase">PBKDF2 Passphrase (SHA-256, 100k iters)</option>
                  <option value="raw">Raw AES Key (Hex / Base64)</option>
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="aes-key-length">Key Length</label>
                <select
                  id="aes-key-length"
                  className={styles.select}
                  value={aesKeyLength}
                  onChange={(e) => setAesKeyLength(Number(e.target.value) as 128 | 256)}
                >
                  <option value="256">256-bit (AES-256-GCM - High Security)</option>
                  <option value="128">128-bit (AES-128-GCM - Standard)</option>
                </select>
              </div>
            </div>

            {aesKeyMode === "passphrase" ? (
              <div className={styles.field}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label htmlFor="aes-passphrase">Passphrase / Password</label>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "var(--accent)" }}
                    onClick={() => setShowPassphrase(!showPassphrase)}
                  >
                    {showPassphrase ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  id="aes-passphrase"
                  type={showPassphrase ? "text" : "password"}
                  className={styles.input}
                  value={aesPassphrase}
                  onChange={(e) => setAesPassphrase(e.target.value)}
                  placeholder="Enter strong passphrase..."
                />
              </div>
            ) : (
              <div className={styles.field}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="aes-raw-key">Raw Key ({aesKeyLength / 8} bytes Hex or Base64)</label>
                  <button
                    type="button"
                    className={styles.button}
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={handleGenerateAesKey}
                  >
                    Generate Random Key
                  </button>
                </div>
                <input
                  id="aes-raw-key"
                  type="text"
                  className={styles.input}
                  value={aesRawKey}
                  onChange={(e) => setAesRawKey(e.target.value)}
                  placeholder="Enter or generate raw key..."
                />
              </div>
            )}

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="aes-iv">IV / Nonce (12-byte Hex, Optional)</label>
                  {aesOpMode === "Encrypt" && (
                    <button
                      type="button"
                      className={styles.button}
                      style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={handleGenerateAesIv}
                    >
                      Random IV
                    </button>
                  )}
                </div>
                <input
                  id="aes-iv"
                  type="text"
                  className={styles.input}
                  value={aesIv}
                  onChange={(e) => setAesIv(e.target.value)}
                  placeholder="Auto-generated if empty"
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="aes-aad">Additional Authenticated Data (AAD, Optional)</label>
                <input
                  id="aes-aad"
                  type="text"
                  className={styles.input}
                  value={aesAad}
                  onChange={(e) => setAesAad(e.target.value)}
                  placeholder="Plaintext AAD..."
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="aes-input">
                {aesOpMode === "Encrypt"
                  ? "Plaintext to Encrypt"
                  : "Ciphertext Payload (JSON bundle or 'salt:iv:ciphertext:tag')"}
              </label>
              <textarea
                id="aes-input"
                className={styles.textarea}
                value={aesInput}
                onChange={(e) => setAesInput(e.target.value)}
                placeholder={
                  aesOpMode === "Encrypt"
                    ? "Enter message to encrypt..."
                    : "Paste JSON bundle or combined format..."
                }
              />
            </div>

            <div className={styles.buttonGroup}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={handleExecuteAes}
                disabled={aesBusy}
              >
                {aesBusy ? "Processing..." : aesOpMode === "Encrypt" ? "Encrypt Data" : "Decrypt Data"}
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  setAesInput("");
                  setAesResult(null);
                  setAesDecryptedText(null);
                  setAesError(null);
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {aesError && (
            <div className={styles.errorBanner}>
              <strong>Error:</strong> {aesError}
            </div>
          )}

          {aesResult && (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>AES-GCM Encryption Output</span>
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>Encrypted &amp; Authenticated</span>
              </div>

              <div className={styles.resultsCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={styles.statLabel}>Combined Portable String (Hex)</span>
                  <button
                    type="button"
                    className={styles.button}
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => copyText(aesResult.combined, "combined")}
                  >
                    {copiedId === "combined" ? "Copied!" : "Copy String"}
                  </button>
                </div>
                <div className={styles.codeOutput}>{aesResult.combined}</div>
              </div>

              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>IV / Nonce (12 Bytes Hex)</span>
                  <span className={styles.statValue}>{aesResult.iv}</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Authentication Tag (16 Bytes Hex)</span>
                  <span className={styles.statValue}>{aesResult.tag}</span>
                </div>
                {aesResult.salt && (
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>PBKDF2 Salt (16 Bytes Hex)</span>
                    <span className={styles.statValue}>{aesResult.salt}</span>
                  </div>
                )}
              </div>

              <div className={styles.resultsCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={styles.statLabel}>Full JSON Bundle</span>
                  <div className={styles.buttonGroup}>
                    <button
                      type="button"
                      className={styles.button}
                      style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => copyText(aesResult.jsonBundle, "bundle")}
                    >
                      {copiedId === "bundle" ? "Copied!" : "Copy JSON"}
                    </button>
                    <button
                      type="button"
                      className={styles.button}
                      style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => downloadText(aesResult.jsonBundle, "encrypted_payload.json")}
                    >
                      Download .json
                    </button>
                  </div>
                </div>
                <div className={styles.codeOutput}>{aesResult.jsonBundle}</div>
              </div>
            </div>
          )}

          {aesDecryptedText !== null && (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>Decrypted Plaintext Output</span>
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>Tag Verified (128-bit Match)</span>
              </div>
              <div className={styles.resultsCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={styles.statLabel}>Authenticated Result</span>
                  <button
                    type="button"
                    className={styles.button}
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => copyText(aesDecryptedText, "decrypted")}
                  >
                    {copiedId === "decrypted" ? "Copied!" : "Copy Plaintext"}
                  </button>
                </div>
                <div className={styles.codeOutput}>{aesDecryptedText}</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          Tool 2: RSA Key Pair Generator
          ===================================================================== */}
      {toolId === "rsa-key-generator" && (
        <>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>RSA Key Pair Generator</span>
              <span className={`${styles.badge} ${styles.badgeInfo}`}>Web Crypto Subtle</span>
            </div>

            <div className={styles.formRow}>
              <div className={styles.field} style={{ maxWidth: "260px" }}>
                <label htmlFor="rsa-key-size">Modulus Length (Bits)</label>
                <select
                  id="rsa-key-size"
                  className={styles.select}
                  value={rsaKeySize}
                  onChange={(e) => setRsaKeySize(Number(e.target.value) as 2048 | 3072 | 4096)}
                >
                  <option value="2048">2048-bit (Standard / Fast)</option>
                  <option value="3072">3072-bit (Recommended NIST)</option>
                  <option value="4096">4096-bit (Maximum Security)</option>
                </select>
              </div>

              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  onClick={handleGenerateRsa}
                  disabled={rsaBusy}
                >
                  {rsaBusy ? "Generating Key Pair in Browser..." : "Generate RSA Key Pair"}
                </button>
              </div>
            </div>

            {rsaBusy && (
              <div className={styles.noticeBanner}>
                <span>⏳</span>
                <span>
                  Generating {rsaKeySize}-bit RSA key pair client-side with crypto.subtle.generateKey...
                </span>
              </div>
            )}
          </div>

          {rsaError && (
            <div className={styles.errorBanner}>
              <strong>Error:</strong> {rsaError}
            </div>
          )}

          {rsaResult && (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>Generated RSA Key Pair</span>
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                  {rsaResult.modulusLength}-Bit Key Pair
                </span>
              </div>

              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Key Length</span>
                  <span className={styles.statValue}>{rsaResult.modulusLength} bits</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Public Exponent</span>
                  <span className={styles.statValue}>{rsaResult.publicExponent} (0x10001)</span>
                </div>
                <div className={styles.statCard} style={{ gridColumn: "1 / -1" }}>
                  <span className={styles.statLabel}>SPKI Public Key SHA-256 Fingerprint</span>
                  <span className={styles.statValue}>{rsaResult.fingerprint}</span>
                </div>
              </div>

              {/* Public Key Card */}
              <div className={styles.resultsCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={styles.statLabel}>Public Key (SPKI PEM)</span>
                  <div className={styles.buttonGroup}>
                    <button
                      type="button"
                      className={styles.button}
                      style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => copyText(rsaResult.publicKeyPem, "rsa-pub")}
                    >
                      {copiedId === "rsa-pub" ? "Copied!" : "Copy Public Key"}
                    </button>
                    <button
                      type="button"
                      className={styles.button}
                      style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => downloadText(rsaResult.publicKeyPem, "id_rsa.pub")}
                    >
                      Download id_rsa.pub
                    </button>
                  </div>
                </div>
                <div className={styles.codeOutput}>{rsaResult.publicKeyPem}</div>
              </div>

              {/* Private Key Card */}
              <div className={styles.resultsCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={styles.statLabel}>Private Key (PKCS#8 PEM)</span>
                  <div className={styles.buttonGroup}>
                    <button
                      type="button"
                      className={styles.button}
                      style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => copyText(rsaResult.privateKeyPem, "rsa-priv")}
                    >
                      {copiedId === "rsa-priv" ? "Copied!" : "Copy Private Key"}
                    </button>
                    <button
                      type="button"
                      className={styles.button}
                      style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => downloadText(rsaResult.privateKeyPem, "id_rsa.pem")}
                    >
                      Download id_rsa.pem
                    </button>
                  </div>
                </div>
                <div className={styles.codeOutput}>{rsaResult.privateKeyPem}</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          Tool 3: JWT Signer & Verifier
          ===================================================================== */}
      {toolId === "jwt-signer-verifier" && (
        <>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>JWT Signer &amp; Verifier</span>
              <div className={styles.tabs}>
                <button
                  type="button"
                  className={`${styles.tab} ${jwtOpMode === "Sign JWT" ? styles.tabActive : ""}`}
                  onClick={() => setJwtOpMode("Sign JWT")}
                >
                  Sign JWT
                </button>
                <button
                  type="button"
                  className={`${styles.tab} ${jwtOpMode === "Verify JWT" ? styles.tabActive : ""}`}
                  onClick={() => setJwtOpMode("Verify JWT")}
                >
                  Verify JWT
                </button>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.field} style={{ maxWidth: "220px" }}>
                <label htmlFor="jwt-alg">Algorithm</label>
                <select
                  id="jwt-alg"
                  className={styles.select}
                  value={jwtAlgorithm}
                  onChange={(e) => handleSetJwtAlgorithm(e.target.value as JwtAlgorithm)}
                >
                  <option value="HS256">HS256 (HMAC-SHA256)</option>
                  <option value="HS384">HS384 (HMAC-SHA384)</option>
                  <option value="HS512">HS512 (HMAC-SHA512)</option>
                  <option value="RS256">RS256 (RSA-SHA256)</option>
                </select>
              </div>

              {jwtOpMode === "Verify JWT" && (
                <div className={styles.field} style={{ maxWidth: "200px" }}>
                  <label htmlFor="jwt-skew">Clock Skew Tolerance (sec)</label>
                  <input
                    id="jwt-skew"
                    type="number"
                    min={0}
                    max={600}
                    className={styles.input}
                    value={jwtClockSkew}
                    onChange={(e) => setJwtClockSkew(Number(e.target.value))}
                  />
                </div>
              )}
            </div>

            {jwtOpMode === "Sign JWT" ? (
              <>
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label htmlFor="jwt-header">Header (JSON)</label>
                    <textarea
                      id="jwt-header"
                      className={styles.textarea}
                      style={{ minHeight: "100px" }}
                      value={jwtHeader}
                      onChange={(e) => setJwtHeader(e.target.value)}
                    />
                  </div>

                  <div className={styles.field}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label htmlFor="jwt-payload">Payload (JSON)</label>
                      <div className={styles.buttonGroup}>
                        <button
                          type="button"
                          className={styles.button}
                          style={{ padding: "0.15rem 0.4rem", fontSize: "0.72rem" }}
                          onClick={() => handleQuickTimestamp("1h")}
                        >
                          +1h
                        </button>
                        <button
                          type="button"
                          className={styles.button}
                          style={{ padding: "0.15rem 0.4rem", fontSize: "0.72rem" }}
                          onClick={() => handleQuickTimestamp("24h")}
                        >
                          +24h
                        </button>
                      </div>
                    </div>
                    <textarea
                      id="jwt-payload"
                      className={styles.textarea}
                      style={{ minHeight: "100px" }}
                      value={jwtPayload}
                      onChange={(e) => setJwtPayload(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="jwt-secret">
                    {jwtAlgorithm === "RS256"
                      ? "RSA Private Key (PKCS#8 PEM)"
                      : "HMAC Secret Key"}
                  </label>
                  <textarea
                    id="jwt-secret"
                    className={styles.textarea}
                    style={{ minHeight: "80px" }}
                    value={jwtSecret}
                    onChange={(e) => setJwtSecret(e.target.value)}
                    placeholder={
                      jwtAlgorithm === "RS256"
                        ? "-----BEGIN PRIVATE KEY-----\n..."
                        : "Enter HMAC shared secret..."
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <div className={styles.field}>
                  <label htmlFor="jwt-token-input">Encoded Compact JWT (header.payload.signature)</label>
                  <textarea
                    id="jwt-token-input"
                    className={styles.textarea}
                    style={{ minHeight: "100px" }}
                    value={jwtTokenInput}
                    onChange={(e) => setJwtTokenInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="jwt-verify-secret">
                    {jwtAlgorithm === "RS256"
                      ? "RSA Public Key (SPKI PEM)"
                      : "HMAC Secret Key"}
                  </label>
                  <textarea
                    id="jwt-verify-secret"
                    className={styles.textarea}
                    style={{ minHeight: "80px" }}
                    value={jwtAlgorithm === "RS256" ? jwtPublicKey : jwtSecret}
                    onChange={(e) =>
                      jwtAlgorithm === "RS256"
                        ? setJwtPublicKey(e.target.value)
                        : setJwtSecret(e.target.value)
                    }
                    placeholder={
                      jwtAlgorithm === "RS256"
                        ? "-----BEGIN PUBLIC KEY-----\n..."
                        : "Enter HMAC shared secret..."
                    }
                  />
                </div>
              </>
            )}

            <div className={styles.buttonGroup}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={handleExecuteJwt}
                disabled={jwtBusy}
              >
                {jwtBusy ? "Processing..." : jwtOpMode === "Sign JWT" ? "Sign JWT" : "Verify JWT"}
              </button>
            </div>
          </div>

          {jwtError && (
            <div className={styles.errorBanner}>
              <strong>Error:</strong> {jwtError}
            </div>
          )}

          {jwtSignedToken && (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>Signed Compact JWT</span>
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                  {jwtAlgorithm} Signed
                </span>
              </div>
              <div className={styles.resultsCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={styles.statLabel}>Token String</span>
                  <button
                    type="button"
                    className={styles.button}
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => copyText(jwtSignedToken, "jwt-token")}
                  >
                    {copiedId === "jwt-token" ? "Copied!" : "Copy JWT"}
                  </button>
                </div>
                <div className={styles.codeOutput}>{jwtSignedToken}</div>
              </div>
            </div>
          )}

          {jwtVerifyResult && (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>JWT Verification Result</span>
                <span
                  className={`${styles.badge} ${
                    jwtVerifyResult.valid
                      ? styles.badgeSuccess
                      : jwtVerifyResult.signatureValid
                      ? styles.badgeWarning
                      : styles.badgeDanger
                  }`}
                >
                  {jwtVerifyResult.valid
                    ? "Verified & Valid"
                    : jwtVerifyResult.signatureValid
                    ? "Signature Valid (Claim Error)"
                    : "Invalid Signature"}
                </span>
              </div>

              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Cryptographic Signature</span>
                  <span
                    className={styles.statValue}
                    style={{ color: jwtVerifyResult.signatureValid ? "var(--green)" : "var(--red)" }}
                  >
                    {jwtVerifyResult.signatureValid ? "Valid" : "Mismatch / Failed"}
                  </span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Expiration Status</span>
                  <span
                    className={styles.statValue}
                    style={{ color: jwtVerifyResult.expired ? "var(--red)" : "var(--green)" }}
                  >
                    {jwtVerifyResult.expired
                      ? "Expired"
                      : jwtVerifyResult.expiresAt
                      ? "Active"
                      : "No Expiration Set"}
                  </span>
                </div>
                {jwtVerifyResult.expiresAt && (
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Expires At</span>
                    <span className={styles.statValue}>
                      {jwtVerifyResult.expiresAt.toISOString()}
                    </span>
                  </div>
                )}
                {jwtVerifyResult.issuedAt && (
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Issued At</span>
                    <span className={styles.statValue}>
                      {jwtVerifyResult.issuedAt.toISOString()}
                    </span>
                  </div>
                )}
              </div>

              {jwtVerifyResult.error && (
                <div className={styles.errorBanner}>
                  <strong>Claim Alert:</strong> {jwtVerifyResult.error}
                </div>
              )}

              <div className={styles.formGrid}>
                <div className={styles.resultsCard}>
                  <span className={styles.statLabel}>Decoded Header</span>
                  <div className={styles.codeOutput}>
                    {JSON.stringify(jwtVerifyResult.header, null, 2)}
                  </div>
                </div>
                <div className={styles.resultsCard}>
                  <span className={styles.statLabel}>Decoded Payload</span>
                  <div className={styles.codeOutput}>
                    {JSON.stringify(jwtVerifyResult.payload, null, 2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          Tool 4: CSR (PKCS#10) Inspector
          ===================================================================== */}
      {toolId === "csr-inspector" && (
        <>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>PKCS#10 Certificate Signing Request</span>
              <span className={`${styles.badge} ${styles.badgeInfo}`}>ASN.1 DER Parser</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="csr-input">CSR Input (PEM format or Base64 DER)</label>
              <textarea
                id="csr-input"
                className={styles.textarea}
                style={{ minHeight: "160px" }}
                value={csrInput}
                onChange={(e) => setCsrInput(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE REQUEST-----..."
              />
            </div>

            <div className={styles.buttonGroup}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={handleInspectCsr}
                disabled={csrBusy}
              >
                {csrBusy ? "Parsing ASN.1..." : "Inspect CSR"}
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  setCsrInput(
                    "-----BEGIN CERTIFICATE REQUEST-----\nMIIDATCCAekCAQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWEx\nFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xFDASBgNVBAoMC0NvZGVTdGF0aW9uMRQw\nEgYDVQQLDAtFbmdpbmVlcmluZzEUMBIGA1UEAwwLZXhhbXBsZS5jb20wggEiMA0G\nCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDJmvSQ210ROEgCHZMq1LW/zonwJsZZ\n1qUYgGC07Zph+zxX5kpZG51jcVmz1TlufkD9J4NQA9Y+6GMa08CL+33C4JlMV7D7\neQ7KpYYpnWlwOtN+K4juD1gCL0bhEaYiuzSQPDud1kwiXIswRerAVj7nf0hBvU9p\ngI64lLJFo3nd/DBtgn+Ddk6ttbvNPvBymo4nci4uIOySL9TxQF9fty7ytpN65shA\nyeYIx9T/k8G0L01iRUQ0ad9R2Rqsmtt+YsV6fVdwy94sjvZ9sUAePSZGsskpmUnN\n/hZMuPJvudSsqNeTdbUWRzqw643jSoYijG16EPkDHBmLyS299WsDq+z1AgMBAAGg\nQDA+BgkqhkiG9w0BCQ4xMTAvMC0GA1UdEQQmMCSCC2V4YW1wbGUuY29tgg93d3cu\nZXhhbXBsZS5jb22HBMCoAWQwDQYJKoZIhvcNAQELBQADggEBAL5qqIhyUM+fazXC\nBGT5khvCtIUMJsshMHXFW+IcjTmF5VG1GtnZ3Oey5+Z3vTJ3PcUiJpovQ6+HPoct\nO6ec405DIoggf660Q56AMSk3khoaAdWcq3guMFJcSP4+0afKF7kYzbESRAVccsRz\n/n7dHfXCedJzDrsdUyIucidxFVhwrLzBRv0MmjRDXEtSCDMiP+dosJWMxbPkS/HW\nhS5G+58QVDKcFgWaZ7HIKbu0tNLKiCqP06/dH5vf+fldF54PvIq1/fQjCiTx0qF/\n7FGRe334sHNay2UjDWxMWN/IAHqCWKfGJ6fE2Vv8qr+TTOziUscwC0e00zrGaeuX\nlQKOGyc=\n-----END CERTIFICATE REQUEST-----"
                  );
                }}
              >
                Load Sample CSR
              </button>
            </div>
          </div>

          {csrError && (
            <div className={styles.errorBanner}>
              <strong>Parse Error:</strong> {csrError}
            </div>
          )}

          {csrResult && (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>CSR Inspection Details</span>
                <span
                  className={`${styles.badge} ${
                    csrResult.signatureValid ? styles.badgeSuccess : styles.badgeWarning
                  }`}
                >
                  {csrResult.signatureValid ? "Self-Signature Valid" : "Self-Signature Unverified"}
                </span>
              </div>

              {/* Subject DN Card */}
              <div className={styles.resultsCard}>
                <span className={styles.statLabel}>Subject Distinguished Name (DN)</span>
                <span className={styles.statValue} style={{ fontSize: "1rem" }}>
                  {csrResult.subjectString || "Empty Subject"}
                </span>

                <div className={styles.statGrid} style={{ marginTop: "0.5rem" }}>
                  {csrResult.subject.commonName && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Common Name (CN)</span>
                      <span className={styles.statValue}>{csrResult.subject.commonName}</span>
                    </div>
                  )}
                  {csrResult.subject.organization && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Organization (O)</span>
                      <span className={styles.statValue}>{csrResult.subject.organization}</span>
                    </div>
                  )}
                  {csrResult.subject.organizationalUnit && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Organizational Unit (OU)</span>
                      <span className={styles.statValue}>{csrResult.subject.organizationalUnit}</span>
                    </div>
                  )}
                  {csrResult.subject.locality && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Locality (L)</span>
                      <span className={styles.statValue}>{csrResult.subject.locality}</span>
                    </div>
                  )}
                  {csrResult.subject.stateOrProvince && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>State / Province (ST)</span>
                      <span className={styles.statValue}>{csrResult.subject.stateOrProvince}</span>
                    </div>
                  )}
                  {csrResult.subject.country && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Country (C)</span>
                      <span className={styles.statValue}>{csrResult.subject.country}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* SANs */}
              {csrResult.subjectAltNames.length > 0 && (
                <div className={styles.resultsCard}>
                  <span className={styles.statLabel}>
                    Subject Alternative Names (SANs) — {csrResult.subjectAltNames.length} Total
                  </span>
                  <div className={styles.tagChipContainer}>
                    {csrResult.subjectAltNames.map((san) => (
                      <span key={san} className={styles.tagChip}>
                        {san}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Public Key & Signature Details */}
              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Public Key Algorithm</span>
                  <span className={styles.statValue}>
                    {csrResult.publicKey.algorithm}{" "}
                    {csrResult.publicKey.bitLength && `(${csrResult.publicKey.bitLength}-bit)`}
                  </span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Signature Algorithm</span>
                  <span className={styles.statValue}>{csrResult.signatureAlgorithm}</span>
                </div>
                <div className={styles.statCard} style={{ gridColumn: "1 / -1" }}>
                  <span className={styles.statLabel}>Public Key SHA-256 Fingerprint</span>
                  <span className={styles.statValue}>{csrResult.publicKey.fingerprintSha256}</span>
                </div>
              </div>

              {/* Collapsible ASN.1 Summary */}
              <div className={styles.resultsCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={styles.statLabel}>ASN.1 Syntax Tree</span>
                  <button
                    type="button"
                    className={styles.button}
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => setShowAsn1Tree(!showAsn1Tree)}
                  >
                    {showAsn1Tree ? "Hide Tree" : "View ASN.1 Tree"}
                  </button>
                </div>
                {showAsn1Tree && <div className={styles.asn1Box}>{csrResult.asn1Tree}</div>}
              </div>
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          Tool 5: CSP (Content Security Policy) Builder
          ===================================================================== */}
      {toolId === "csp-builder" && (
        <>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Content Security Policy Builder</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span
                  className={`${styles.gradeCircle} ${
                    cspResult.grade === "A+" || cspResult.grade === "A"
                      ? styles.gradeA
                      : cspResult.grade === "B"
                      ? styles.gradeB
                      : cspResult.grade === "C"
                      ? styles.gradeC
                      : styles.gradeF
                  }`}
                >
                  {cspResult.grade}
                </span>
                <span className={styles.statLabel}>Score: {cspResult.score}/100</span>
              </div>
            </div>

            {/* Warnings Alert */}
            {cspResult.warnings.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {cspResult.warnings.map((w, idx) => (
                  <div
                    key={idx}
                    className={`${styles.warningItem} ${
                      w.severity === "critical"
                        ? styles.warningCritical
                        : w.severity === "warning"
                        ? styles.warningModerate
                        : styles.warningInfo
                    }`}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>
                        {w.severity.toUpperCase()}: {w.directive}
                      </strong>
                    </div>
                    <span>{w.message}</span>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      💡 Recommendation: {w.recommendation}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Directives Editor */}
            <div className={styles.resultsCard}>
              <span className={styles.statLabel}>Directives Configuration</span>

              {/* script-src */}
              <div className={styles.field}>
                <label>
                  script-src (Controls JavaScript origins — critical for XSS prevention)
                </label>
                <div className={styles.tagChipContainer}>
                  {["'self'", "'none'", "'unsafe-inline'", "'unsafe-eval'", "https:"].map((token) => {
                    const isChecked = (cspDirectives["script-src"] || []).includes(token);
                    return (
                      <button
                        key={token}
                        type="button"
                        className={`${styles.button} ${isChecked ? styles.buttonPrimary : ""}`}
                        style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
                        onClick={() => handleDirectiveTokenToggle("script-src", token)}
                      >
                        {token}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* style-src */}
              <div className={styles.field}>
                <label>style-src (Controls stylesheets &amp; inline styles)</label>
                <div className={styles.tagChipContainer}>
                  {["'self'", "'none'", "'unsafe-inline'", "https:"].map((token) => {
                    const isChecked = (cspDirectives["style-src"] || []).includes(token);
                    return (
                      <button
                        key={token}
                        type="button"
                        className={`${styles.button} ${isChecked ? styles.buttonPrimary : ""}`}
                        style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
                        onClick={() => handleDirectiveTokenToggle("style-src", token)}
                      >
                        {token}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* default-src */}
              <div className={styles.field}>
                <label>default-src (Fallback for unspecified fetch directives)</label>
                <div className={styles.tagChipContainer}>
                  {["'self'", "'none'", "*"].map((token) => {
                    const isChecked = (cspDirectives["default-src"] || []).includes(token);
                    return (
                      <button
                        key={token}
                        type="button"
                        className={`${styles.button} ${isChecked ? styles.buttonPrimary : ""}`}
                        style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
                        onClick={() => handleDirectiveTokenToggle("default-src", token)}
                      >
                        {token}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* object-src & frame-ancestors */}
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>object-src (Plugin / Flash control)</label>
                  <div className={styles.tagChipContainer}>
                    {["'none'", "'self'"].map((token) => {
                      const isChecked = (cspDirectives["object-src"] || []).includes(token);
                      return (
                        <button
                          key={token}
                          type="button"
                          className={`${styles.button} ${isChecked ? styles.buttonPrimary : ""}`}
                          style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
                          onClick={() => handleDirectiveTokenToggle("object-src", token)}
                        >
                          {token}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.field}>
                  <label>frame-ancestors (Clickjacking protection)</label>
                  <div className={styles.tagChipContainer}>
                    {["'none'", "'self'"].map((token) => {
                      const isChecked = (cspDirectives["frame-ancestors"] || []).includes(token);
                      return (
                        <button
                          key={token}
                          type="button"
                          className={`${styles.button} ${isChecked ? styles.buttonPrimary : ""}`}
                          style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
                          onClick={() => handleDirectiveTokenToggle("frame-ancestors", token)}
                        >
                          {token}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Checkboxes */}
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={!!cspDirectives["upgrade-insecure-requests"]}
                  onChange={handleUpgradeInsecureToggle}
                />
                <span>upgrade-insecure-requests (Forces HTTPS for all subresources)</span>
              </label>
            </div>
          </div>

          {/* Generated Header & Configs */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Generated CSP Header</span>
              <button
                type="button"
                className={styles.button}
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                onClick={() => copyText(cspResult.headerString, "csp-header")}
              >
                {copiedId === "csp-header" ? "Copied!" : "Copy Header"}
              </button>
            </div>
            <div className={styles.codeOutput}>{cspResult.headerString}</div>

            <div className={styles.formGrid} style={{ marginTop: "0.75rem" }}>
              <div className={styles.resultsCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={styles.statLabel}>HTML &lt;meta&gt; Tag</span>
                  <button
                    type="button"
                    className={styles.button}
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => copyText(cspResult.metaHtml, "meta-html")}
                  >
                    {copiedId === "meta-html" ? "Copied!" : "Copy HTML"}
                  </button>
                </div>
                <div className={styles.codeOutput}>{cspResult.metaHtml}</div>
              </div>

              <div className={styles.resultsCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={styles.statLabel}>Nginx Configuration</span>
                  <button
                    type="button"
                    className={styles.button}
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => copyText(cspResult.nginxConfig, "nginx")}
                  >
                    {copiedId === "nginx" ? "Copied!" : "Copy Nginx"}
                  </button>
                </div>
                <div className={styles.codeOutput}>{cspResult.nginxConfig}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
