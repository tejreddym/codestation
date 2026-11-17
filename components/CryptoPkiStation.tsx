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
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { Checkbox, Select, TextInput, Textarea } from "./ui/controls";
import { Field } from "./ui/Field";
import { OutputText } from "./ui/OutputPanel";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import { useCopy } from "./ui/useCopy";
import { downloadBlob } from "./ui/useDownload";
import { cx } from "./ui/cx";
import styles from "./CryptoPkiStation.module.css";

interface CryptoPkiStationProps {
  toolId: CryptoPkiToolId;
}

function CopyButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" onClick={onClick}>
      Copy {label}
    </Button>
  );
}

export default function CryptoPkiStation({ toolId }: CryptoPkiStationProps) {
  const definition = getCryptoPkiDefinition(toolId)!;
  const { copy, message: copyMessage } = useCopy();

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

  function handleUpgradeInsecureToggle() {
    setCspDirectives((prev) => {
      const next = { ...prev, "upgrade-insecure-requests": !prev["upgrade-insecure-requests"] };
      setCspResult(buildCspHeader(next));
      return next;
    });
  }

  const tokenRow = (directive: keyof CspDirectives, tokens: string[]) => (
    <div className={styles.tokenRow}>
      {tokens.map((token) => {
        const isChecked = ((cspDirectives[directive] as string[]) || []).includes(token);
        return (
          <Button
            key={token}
            size="sm"
            variant={isChecked ? "primary" : "secondary"}
            aria-pressed={isChecked}
            onClick={() => handleDirectiveTokenToggle(directive, token)}
          >
            {token}
          </Button>
        );
      })}
    </div>
  );

  return (
    <div
      data-webmcp-tool={toolId}
      data-webmcp-category="WebPKI & Advanced Cryptography"
      data-webmcp-slug={toolId}
    >
      <PrivacyNote>
        🔒 100% in-browser cryptography. Operations execute locally using the Web Crypto API;
        private keys and passphrases never leave your browser.
      </PrivacyNote>

      <ToolLayout kind="form">
        {/* =====================================================================
            Tool 1: AES-GCM Encrypt & Decrypt
            ===================================================================== */}
        {toolId === "aes-crypto" && (
          <>
            <Panel
              title="AES-GCM Configuration"
              padded
              actions={
                <div className={styles.segmented}>
                  {(["Encrypt", "Decrypt"] as const).map((mode) => (
                    <Button
                      key={mode}
                      size="sm"
                      variant={aesOpMode === mode ? "primary" : "ghost"}
                      aria-pressed={aesOpMode === mode}
                      onClick={() => setAesOpMode(mode)}
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
              }
            >
              <div className={styles.configGrid}>
                <Field id="aes-key-mode" label="Key Derivation Mode">
                  <Select
                    id="aes-key-mode"
                    value={aesKeyMode}
                    onChange={(e) => setAesKeyMode(e.target.value as "passphrase" | "raw")}
                  >
                    <option value="passphrase">PBKDF2 Passphrase (SHA-256, 100k iters)</option>
                    <option value="raw">Raw AES Key (Hex / Base64)</option>
                  </Select>
                </Field>

                <Field id="aes-key-length" label="Key Length">
                  <Select
                    id="aes-key-length"
                    value={aesKeyLength}
                    onChange={(e) => setAesKeyLength(Number(e.target.value) as 128 | 256)}
                  >
                    <option value="256">256-bit (AES-256-GCM — High Security)</option>
                    <option value="128">128-bit (AES-128-GCM — Standard)</option>
                  </Select>
                </Field>
              </div>

              {aesKeyMode === "passphrase" ? (
                <Field id="aes-passphrase" label="Passphrase / Password">
                  <div className={styles.inlineActions}>
                    <TextInput
                      id="aes-passphrase"
                      type={showPassphrase ? "text" : "password"}
                      value={aesPassphrase}
                      onChange={(e) => setAesPassphrase(e.target.value)}
                      placeholder="Enter strong passphrase..."
                      autoComplete="off"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-pressed={showPassphrase}
                      onClick={() => setShowPassphrase(!showPassphrase)}
                    >
                      {showPassphrase ? "Hide" : "Show"}
                    </Button>
                  </div>
                </Field>
              ) : (
                <Field
                  id="aes-raw-key"
                  label={`Raw Key (${aesKeyLength / 8} bytes Hex or Base64)`}
                >
                  <div className={styles.inlineActions}>
                    <TextInput
                      id="aes-raw-key"
                      type="text"
                      value={aesRawKey}
                      onChange={(e) => setAesRawKey(e.target.value)}
                      placeholder="Enter or generate raw key..."
                      autoComplete="off"
                    />
                    <Button size="sm" onClick={handleGenerateAesKey}>
                      Generate Random Key
                    </Button>
                  </div>
                </Field>
              )}

              <div className={styles.configGrid}>
                <Field id="aes-iv" label="IV / Nonce (12-byte Hex, Optional)">
                  <div className={styles.inlineActions}>
                    <TextInput
                      id="aes-iv"
                      type="text"
                      value={aesIv}
                      onChange={(e) => setAesIv(e.target.value)}
                      placeholder="Auto-generated if empty"
                      autoComplete="off"
                    />
                    {aesOpMode === "Encrypt" && (
                      <Button size="sm" onClick={handleGenerateAesIv}>
                        Random IV
                      </Button>
                    )}
                  </div>
                </Field>

                <Field id="aes-aad" label="Additional Authenticated Data (AAD, Optional)">
                  <TextInput
                    id="aes-aad"
                    type="text"
                    value={aesAad}
                    onChange={(e) => setAesAad(e.target.value)}
                    placeholder="Plaintext AAD..."
                  />
                </Field>
              </div>

              <Field
                id="aes-input"
                label={
                  aesOpMode === "Encrypt"
                    ? "Plaintext to Encrypt"
                    : "Ciphertext Payload (JSON bundle or 'salt:iv:ciphertext:tag')"
                }
              >
                <Textarea
                  id="aes-input"
                  value={aesInput}
                  onChange={(e) => setAesInput(e.target.value)}
                  placeholder={
                    aesOpMode === "Encrypt"
                      ? "Enter message to encrypt..."
                      : "Paste JSON bundle or combined format..."
                  }
                />
              </Field>

              <div className={styles.inlineActions}>
                <Button variant="primary" onClick={handleExecuteAes} disabled={aesBusy}>
                  {aesBusy ? "Processing..." : aesOpMode === "Encrypt" ? "Encrypt Data" : "Decrypt Data"}
                </Button>
                <Button
                  onClick={() => {
                    setAesInput("");
                    setAesResult(null);
                    setAesDecryptedText(null);
                    setAesError(null);
                  }}
                >
                  Clear
                </Button>
              </div>
            </Panel>

            {aesError && (
              <Callout kind="error">
                <strong>Error:</strong> {aesError}
              </Callout>
            )}

            {aesResult && (
              <Panel title="AES-GCM Encryption Output" padded>
                <section className={styles.resultBlock} aria-label="Combined portable ciphertext">
                  <div className={styles.resultBlockHead}>
                    <span className={styles.resultLabel}>Combined Portable String (Hex)</span>
                    <CopyButton label="String" onClick={() => void copy(aesResult.combined)} />
                  </div>
                  <OutputText label="Combined portable string" value={aesResult.combined} />
                </section>

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

                <section className={styles.resultBlock} aria-label="Full JSON bundle">
                  <div className={styles.resultBlockHead}>
                    <span className={styles.resultLabel}>Full JSON Bundle</span>
                    <div className={styles.inlineActions}>
                      <CopyButton label="JSON" onClick={() => void copy(aesResult.jsonBundle)} />
                      <Button
                        size="sm"
                        onClick={() =>
                          downloadBlob(aesResult.jsonBundle, "encrypted_payload.json", "application/json")
                        }
                      >
                        Download .json
                      </Button>
                    </div>
                  </div>
                  <OutputText label="Full JSON bundle" value={aesResult.jsonBundle} />
                </section>
              </Panel>
            )}

            {aesDecryptedText !== null && (
              <Panel title="Decrypted Plaintext Output" padded>
                <section className={styles.resultBlock} aria-label="Authenticated plaintext">
                  <div className={styles.resultBlockHead}>
                    <span className={styles.resultLabel}>Authenticated Result</span>
                    <CopyButton label="Plaintext" onClick={() => void copy(aesDecryptedText)} />
                  </div>
                  <OutputText label="Decrypted plaintext" value={aesDecryptedText} />
                </section>
              </Panel>
            )}
          </>
        )}

        {/* =====================================================================
            Tool 2: RSA Key Pair Generator
            ===================================================================== */}
        {toolId === "rsa-key-generator" && (
          <>
            <Panel title="RSA Key Pair Generator" padded>
              <div className={styles.configRow}>
                <Field id="rsa-key-size" label="Modulus Length (Bits)" className={styles.keySizeField}>
                  <Select
                    id="rsa-key-size"
                    value={rsaKeySize}
                    onChange={(e) => setRsaKeySize(Number(e.target.value) as 2048 | 3072 | 4096)}
                  >
                    <option value="2048">2048-bit (Standard / Fast)</option>
                    <option value="3072">3072-bit (Recommended NIST)</option>
                    <option value="4096">4096-bit (Maximum Security)</option>
                  </Select>
                </Field>
                <Button variant="primary" onClick={handleGenerateRsa} disabled={rsaBusy}>
                  {rsaBusy ? "Generating Key Pair in Browser..." : "Generate RSA Key Pair"}
                </Button>
              </div>

              {rsaBusy && (
                <Callout kind="info">
                  ⏳ Generating {rsaKeySize}-bit RSA key pair client-side with
                  crypto.subtle.generateKey...
                </Callout>
              )}
            </Panel>

            {rsaError && (
              <Callout kind="error">
                <strong>Error:</strong> {rsaError}
              </Callout>
            )}

            {rsaResult && (
              <Panel title={`Generated RSA Key Pair (${rsaResult.modulusLength}-Bit)`} padded>
                <div className={styles.statGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Key Length</span>
                    <span className={styles.statValue}>{rsaResult.modulusLength} bits</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Public Exponent</span>
                    <span className={styles.statValue}>{rsaResult.publicExponent} (0x10001)</span>
                  </div>
                  <div className={cx(styles.statCard, styles.spanAll)}>
                    <span className={styles.statLabel}>SPKI Public Key SHA-256 Fingerprint</span>
                    <span className={styles.statValue}>{rsaResult.fingerprint}</span>
                  </div>
                </div>

                <section className={styles.resultBlock} aria-label="Public key">
                  <div className={styles.resultBlockHead}>
                    <span className={styles.resultLabel}>Public Key (SPKI PEM)</span>
                    <div className={styles.inlineActions}>
                      <CopyButton label="Public Key" onClick={() => void copy(rsaResult.publicKeyPem)} />
                      <Button
                        size="sm"
                        onClick={() => downloadBlob(rsaResult.publicKeyPem, "id_rsa.pub")}
                      >
                        Download id_rsa.pub
                      </Button>
                    </div>
                  </div>
                  <OutputText label="Public key" value={rsaResult.publicKeyPem} />
                </section>

                <section className={styles.resultBlock} aria-label="Private key">
                  <div className={styles.resultBlockHead}>
                    <span className={styles.resultLabel}>Private Key (PKCS#8 PEM)</span>
                    <div className={styles.inlineActions}>
                      <CopyButton label="Private Key" onClick={() => void copy(rsaResult.privateKeyPem)} />
                      <Button
                        size="sm"
                        onClick={() => downloadBlob(rsaResult.privateKeyPem, "id_rsa.pem")}
                      >
                        Download id_rsa.pem
                      </Button>
                    </div>
                  </div>
                  <OutputText label="Private key" value={rsaResult.privateKeyPem} />
                </section>
              </Panel>
            )}
          </>
        )}

        {/* =====================================================================
            Tool 3: JWT Signer & Verifier
            ===================================================================== */}
        {toolId === "jwt-signer-verifier" && (
          <>
            <Panel
              title="JWT Signer & Verifier"
              padded
              actions={
                <div className={styles.segmented}>
                  {(["Sign JWT", "Verify JWT"] as const).map((mode) => (
                    <Button
                      key={mode}
                      size="sm"
                      variant={jwtOpMode === mode ? "primary" : "ghost"}
                      aria-pressed={jwtOpMode === mode}
                      onClick={() => setJwtOpMode(mode)}
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
              }
            >
              <div className={styles.configRow}>
                <Field id="jwt-alg" label="Algorithm" className={styles.algorithmField}>
                  <Select
                    id="jwt-alg"
                    value={jwtAlgorithm}
                    onChange={(e) => handleSetJwtAlgorithm(e.target.value as JwtAlgorithm)}
                  >
                    <option value="HS256">HS256 (HMAC-SHA256)</option>
                    <option value="HS384">HS384 (HMAC-SHA384)</option>
                    <option value="HS512">HS512 (HMAC-SHA512)</option>
                    <option value="RS256">RS256 (RSA-SHA256)</option>
                  </Select>
                </Field>

                {jwtOpMode === "Verify JWT" && (
                  <Field id="jwt-skew" label="Clock Skew Tolerance (sec)" className={styles.skewField}>
                    <TextInput
                      id="jwt-skew"
                      type="number"
                      min={0}
                      max={600}
                      value={jwtClockSkew}
                      onChange={(e) => setJwtClockSkew(Number(e.target.value))}
                    />
                  </Field>
                )}
              </div>

              {jwtOpMode === "Sign JWT" ? (
                <>
                  <div className={styles.configGrid}>
                    <Field id="jwt-header" label="Header (JSON)">
                      <Textarea
                        id="jwt-header"
                        value={jwtHeader}
                        onChange={(e) => setJwtHeader(e.target.value)}
                      />
                    </Field>

                    <Field id="jwt-payload" label="Payload (JSON)">
                      <Textarea
                        id="jwt-payload"
                        value={jwtPayload}
                        onChange={(e) => setJwtPayload(e.target.value)}
                      />
                      <div className={styles.inlineActions}>
                        <Button size="sm" onClick={() => handleQuickTimestamp("1h")}>
                          +1h
                        </Button>
                        <Button size="sm" onClick={() => handleQuickTimestamp("24h")}>
                          +24h
                        </Button>
                      </div>
                    </Field>
                  </div>

                  <Field
                    id="jwt-secret"
                    label={jwtAlgorithm === "RS256" ? "RSA Private Key (PKCS#8 PEM)" : "HMAC Secret Key"}
                  >
                    <Textarea
                      id="jwt-secret"
                      value={jwtSecret}
                      onChange={(e) => setJwtSecret(e.target.value)}
                      placeholder={
                        jwtAlgorithm === "RS256"
                          ? "-----BEGIN PRIVATE KEY-----\n..."
                          : "Enter HMAC shared secret..."
                      }
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field
                    id="jwt-token-input"
                    label="Encoded Compact JWT (header.payload.signature)"
                  >
                    <Textarea
                      id="jwt-token-input"
                      value={jwtTokenInput}
                      onChange={(e) => setJwtTokenInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    />
                  </Field>

                  <Field
                    id="jwt-verify-secret"
                    label={jwtAlgorithm === "RS256" ? "RSA Public Key (SPKI PEM)" : "HMAC Secret Key"}
                  >
                    <Textarea
                      id="jwt-verify-secret"
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
                  </Field>
                </>
              )}

              <div className={styles.inlineActions}>
                <Button variant="primary" onClick={handleExecuteJwt} disabled={jwtBusy}>
                  {jwtBusy ? "Processing..." : jwtOpMode === "Sign JWT" ? "Sign JWT" : "Verify JWT"}
                </Button>
              </div>
            </Panel>

            {jwtError && (
              <Callout kind="error">
                <strong>Error:</strong> {jwtError}
              </Callout>
            )}

            {jwtSignedToken && (
              <Panel title={`Signed Compact JWT (${jwtAlgorithm})`} padded>
                <section className={styles.resultBlock} aria-label="Signed token">
                  <div className={styles.resultBlockHead}>
                    <span className={styles.resultLabel}>Token String</span>
                    <CopyButton label="JWT" onClick={() => void copy(jwtSignedToken)} />
                  </div>
                  <OutputText label="Signed token" value={jwtSignedToken} />
                </section>
              </Panel>
            )}

            {jwtVerifyResult && (
              <Panel
                title="JWT Verification Result"
                padded
                actions={
                  jwtVerifyResult.valid ? (
                    <span className={styles.badgeSuccess}>Verified &amp; Valid</span>
                  ) : jwtVerifyResult.signatureValid ? (
                    <span className={styles.badgeWarning}>Signature Valid (Claim Error)</span>
                  ) : (
                    <span className={styles.badgeDanger}>Invalid Signature</span>
                  )
                }
              >
                <div className={styles.statGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Cryptographic Signature</span>
                    <span
                      className={cx(
                        styles.statValue,
                        jwtVerifyResult.signatureValid ? styles.positive : styles.negative
                      )}
                    >
                      {jwtVerifyResult.signatureValid ? "Valid" : "Mismatch / Failed"}
                    </span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Expiration Status</span>
                    <span
                      className={cx(
                        styles.statValue,
                        jwtVerifyResult.expired ? styles.negative : styles.positive
                      )}
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
                      <span className={styles.statValue}>{jwtVerifyResult.expiresAt.toISOString()}</span>
                    </div>
                  )}
                  {jwtVerifyResult.issuedAt && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Issued At</span>
                      <span className={styles.statValue}>{jwtVerifyResult.issuedAt.toISOString()}</span>
                    </div>
                  )}
                </div>

                {jwtVerifyResult.error && (
                  <Callout kind="warning">
                    <strong>Claim Alert:</strong> {jwtVerifyResult.error}
                  </Callout>
                )}

                <div className={styles.configGrid}>
                  <section className={styles.resultBlock} aria-label="Decoded header">
                    <span className={styles.resultLabel}>Decoded Header</span>
                    <OutputText
                      label="Decoded header"
                      value={JSON.stringify(jwtVerifyResult.header, null, 2)}
                    />
                  </section>
                  <section className={styles.resultBlock} aria-label="Decoded payload">
                    <span className={styles.resultLabel}>Decoded Payload</span>
                    <OutputText
                      label="Decoded payload"
                      value={JSON.stringify(jwtVerifyResult.payload, null, 2)}
                    />
                  </section>
                </div>
              </Panel>
            )}
          </>
        )}

        {/* =====================================================================
            Tool 4: CSR (PKCS#10) Inspector
            ===================================================================== */}
        {toolId === "csr-inspector" && (
          <>
            <Panel title="PKCS#10 Certificate Signing Request" padded>
              <Field id="csr-input" label="CSR Input (PEM format or Base64 DER)">
                <Textarea
                  id="csr-input"
                  value={csrInput}
                  onChange={(e) => setCsrInput(e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE REQUEST-----..."
                />
              </Field>

              <div className={styles.inlineActions}>
                <Button variant="primary" onClick={handleInspectCsr} disabled={csrBusy}>
                  {csrBusy ? "Parsing ASN.1..." : "Inspect CSR"}
                </Button>
                <Button
                  onClick={() => {
                    setCsrInput(
                      "-----BEGIN CERTIFICATE REQUEST-----\nMIIDATCCAekCAQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWEx\nFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xFDASBgNVBAoMC0NvZGVTdGF0aW9uMRQw\nEgYDVQQLDAtFbmdpbmVlcmluZzEUMBIGA1UEAwwLZXhhbXBsZS5jb20wggEiMA0G\nCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDJmvSQ210ROEgCHZMq1LW/zonwJsZZ\n1qUYgGC07Zph+zxX5kpZG51jcVmz1TlufkD9J4NQA9Y+6GMa08CL+33C4JlMV7D7\neQ7KpYYpnWlwOtN+K4juD1gCL0bhEaYiuzSQPDud1kwiXIswRerAVj7nf0hBvU9p\ngI64lLJFo3nd/DBtgn+Ddk6ttbvNPvBymo4nci4uIOySL9TxQF9fty7ytpN65shA\nyeYIx9T/k8G0L01iRUQ0ad9R2Rqsmtt+YsV6fVdwy94sjvZ9sUAePSZGsskpmUnN\n/hZMuPJvudSsqNeTdbUWRzqw643jSoYijG16EPkDHBmLyS299WsDq+z1AgMBAAGg\nQDA+BgkqhkiG9w0BCQ4xMTAvMC0GA1UdEQQmMCSCC2V4YW1wbGUuY29tgg93d3cu\nZXhhbXBsZS5jb22HBMCoAWQwDQYJKoZIhvcNAQELBQADggEBAL5qqIhyUM+fazXC\nBGT5khvCtIUMJsshMHXFW+IcjTmF5VG1GtnZ3Oey5+Z3vTJ3PcUiJpovQ6+HPoct\nO6ec405DIoggf660Q56AMSk3khoaAdWcq3guMFJcSP4+0afKF7kYzbESRAVccsRz\n/n7dHfXCedJzDrsdUyIucidxFVhwrLzBRv0MmjRDXEtSCDMiP+dosJWMxbPkS/HW\nhS5G+58QVDKcFgWaZ7HIKbu0tNLKiCqP06/dH5vf+fldF54PvIq1/fQjCiTx0qF/\n7FGRe334sHNay2UjDWxMWN/IAHqCWKfGJ6fE2Vv8qr+TTOziUscwC0e00zrGaeuX\nlQKOGyc=\n-----END CERTIFICATE REQUEST-----"
                    );
                  }}
                >
                  Load Sample CSR
                </Button>
              </div>
            </Panel>

            {csrError && (
              <Callout kind="error">
                <strong>Parse Error:</strong> {csrError}
              </Callout>
            )}

            {csrResult && (
              <Panel
                title="CSR Inspection Details"
                padded
                actions={
                  csrResult.signatureValid ? (
                    <span className={styles.badgeSuccess}>Self-Signature Valid</span>
                  ) : (
                    <span className={styles.badgeWarning}>Self-Signature Unverified</span>
                  )
                }
              >
                <section className={styles.resultBlock} aria-label="Subject distinguished name">
                  <span className={styles.resultLabel}>Subject Distinguished Name (DN)</span>
                  <span className={styles.subjectValue}>
                    {csrResult.subjectString || "Empty Subject"}
                  </span>

                  <div className={styles.statGrid}>
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
                </section>

                {csrResult.subjectAltNames.length > 0 && (
                  <section className={styles.resultBlock} aria-label="Subject alternative names">
                    <span className={styles.resultLabel}>
                      Subject Alternative Names (SANs) — {csrResult.subjectAltNames.length} Total
                    </span>
                    <div className={styles.tagList}>
                      {csrResult.subjectAltNames.map((san) => (
                        <span key={san} className={styles.tagChip}>
                          {san}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

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
                  <div className={cx(styles.statCard, styles.spanAll)}>
                    <span className={styles.statLabel}>Public Key SHA-256 Fingerprint</span>
                    <span className={styles.statValue}>{csrResult.publicKey.fingerprintSha256}</span>
                  </div>
                </div>

                <section className={styles.resultBlock} aria-label="ASN.1 syntax tree">
                  <div className={styles.resultBlockHead}>
                    <span className={styles.resultLabel}>ASN.1 Syntax Tree</span>
                    <Button
                      size="sm"
                      aria-expanded={showAsn1Tree}
                      onClick={() => setShowAsn1Tree(!showAsn1Tree)}
                    >
                      {showAsn1Tree ? "Hide Tree" : "View ASN.1 Tree"}
                    </Button>
                  </div>
                  {showAsn1Tree && <pre className={styles.asn1Box}>{csrResult.asn1Tree}</pre>}
                </section>
              </Panel>
            )}
          </>
        )}

        {/* =====================================================================
            Tool 5: CSP (Content Security Policy) Builder
            ===================================================================== */}
        {toolId === "csp-builder" && (
          <>
            <Panel
              title="Content Security Policy Builder"
              padded
              actions={
                <div className={styles.gradeGroup}>
                  <span
                    className={cx(
                      styles.gradeCircle,
                      cspResult.grade === "A+" || cspResult.grade === "A"
                        ? styles.gradeA
                        : cspResult.grade === "B"
                        ? styles.gradeB
                        : cspResult.grade === "C"
                        ? styles.gradeC
                        : styles.gradeF
                    )}
                    aria-label={`Security grade ${cspResult.grade}`}
                  >
                    {cspResult.grade}
                  </span>
                  <span className={styles.statLabel}>Score: {cspResult.score}/100</span>
                </div>
              }
            >
              {cspResult.warnings.length > 0 && (
                <div className={styles.warningStack}>
                  {cspResult.warnings.map((w, idx) => (
                    <div
                      key={idx}
                      className={cx(
                        styles.warningItem,
                        w.severity === "critical"
                          ? styles.warningCritical
                          : w.severity === "warning"
                          ? styles.warningModerate
                          : styles.warningInfo
                      )}
                    >
                      <strong>
                        {w.severity.toUpperCase()}: {w.directive}
                      </strong>
                      <span>{w.message}</span>
                      <span className={styles.warningRecommendation}>
                        💡 Recommendation: {w.recommendation}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <fieldset className={styles.directiveGroup}>
                <legend className={styles.resultLabel}>Directives Configuration</legend>

                <div className={styles.directiveField}>
                  <span className={styles.directiveLabel}>
                    script-src (Controls JavaScript origins — critical for XSS prevention)
                  </span>
                  {tokenRow("script-src", ["'self'", "'none'", "'unsafe-inline'", "'unsafe-eval'", "https:"])}
                </div>

                <div className={styles.directiveField}>
                  <span className={styles.directiveLabel}>
                    style-src (Controls stylesheets &amp; inline styles)
                  </span>
                  {tokenRow("style-src", ["'self'", "'none'", "'unsafe-inline'", "https:"])}
                </div>

                <div className={styles.directiveField}>
                  <span className={styles.directiveLabel}>
                    default-src (Fallback for unspecified fetch directives)
                  </span>
                  {tokenRow("default-src", ["'self'", "'none'", "*"])}
                </div>

                <div className={styles.configGrid}>
                  <div className={styles.directiveField}>
                    <span className={styles.directiveLabel}>object-src (Plugin / Flash control)</span>
                    {tokenRow("object-src", ["'none'", "'self'"])}
                  </div>

                  <div className={styles.directiveField}>
                    <span className={styles.directiveLabel}>
                      frame-ancestors (Clickjacking protection)
                    </span>
                    {tokenRow("frame-ancestors", ["'none'", "'self'"])}
                  </div>
                </div>

                <Checkbox
                  checked={!!cspDirectives["upgrade-insecure-requests"]}
                  onChange={handleUpgradeInsecureToggle}
                  label="upgrade-insecure-requests (Forces HTTPS for all subresources)"
                />
              </fieldset>
            </Panel>

            <Panel
              title="Generated CSP Header"
              padded
              actions={<CopyButton label="Header" onClick={() => void copy(cspResult.headerString)} />}
            >
              <OutputText label="Generated CSP header" value={cspResult.headerString} />

              <div className={styles.configGrid}>
                <section className={styles.resultBlock} aria-label="HTML meta tag">
                  <div className={styles.resultBlockHead}>
                    <span className={styles.resultLabel}>HTML &lt;meta&gt; Tag</span>
                    <CopyButton label="HTML" onClick={() => void copy(cspResult.metaHtml)} />
                  </div>
                  <OutputText label="HTML meta tag" value={cspResult.metaHtml} />
                </section>

                <section className={styles.resultBlock} aria-label="Nginx configuration">
                  <div className={styles.resultBlockHead}>
                    <span className={styles.resultLabel}>Nginx Configuration</span>
                    <CopyButton label="Nginx" onClick={() => void copy(cspResult.nginxConfig)} />
                  </div>
                  <OutputText label="Nginx configuration" value={cspResult.nginxConfig} />
                </section>
              </div>
            </Panel>
          </>
        )}

      </ToolLayout>
      <StatusLine>{copyMessage}</StatusLine>
    </div>
  );
}
