"use client";

import { useState } from "react";
import styles from "./ProSubscriptionManager.module.css";

interface VerifyResult {
  valid: boolean;
  tier?: string;
  plan?: string;
  expiresAt?: number | null;
  message?: string;
}

interface GenerateResult {
  success: boolean;
  key?: string;
  plan?: string;
  expiresAt?: number | null;
  message?: string;
}

export function ProSubscriptionManager() {
  const [verifyKeyInput, setVerifyKeyInput] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "lifetime">("monthly");
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<GenerateResult | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!verifyKeyInput.trim()) return;

    setVerifyLoading(true);
    setVerifyResult(null);

    try {
      const res = await fetch("/api/v1/license/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: verifyKeyInput.trim() }),
      });
      const data = await res.json();
      setVerifyResult(data);
    } catch (err) {
      setVerifyResult({
        valid: false,
        message: err instanceof Error ? err.message : "Failed to verify key",
      });
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerateLoading(true);
    setGeneratedResult(null);

    try {
      const res = await fetch("/api/v1/license/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const data = await res.json();
      setGeneratedResult(data);
    } catch (err) {
      setGeneratedResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to generate key",
      });
    } finally {
      setGenerateLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  return (
    <div className={styles.container}>
      {/* Pricing Cards */}
      <div className={styles.pricingGrid}>
        <div className={`${styles.planCard} ${selectedPlan === "monthly" ? styles.selected : ""}`}>
          <div className={styles.planHeader}>
            <span className={styles.badge}>POPULAR</span>
            <h3>Monthly Pro</h3>
            <div className={styles.priceContainer}>
              <span className={styles.priceInr}>₹199</span>
              <span className={styles.pricePeriod}>/ month (India)</span>
            </div>
            <div className={styles.priceGlobal}>or $2.99 / month globally</div>
          </div>
          <ul className={styles.featuresList}>
            <li>✓ Full access to local MCP server</li>
            <li>✓ Unlimited offline usage with 30-day cache</li>
            <li>✓ SHA-256, HMAC, JWT inspector</li>
            <li>✓ Multi-dialect SQL formatter</li>
            <li>✓ Accurate IANA timezones & business days</li>
            <li>✓ Zero login or password required</li>
          </ul>
          <button
            type="button"
            className={styles.selectBtn}
            onClick={() => setSelectedPlan("monthly")}
          >
            {selectedPlan === "monthly" ? "Selected Plan" : "Choose Monthly (₹199)"}
          </button>
        </div>

        <div className={`${styles.planCard} ${selectedPlan === "lifetime" ? styles.selected : ""}`}>
          <div className={styles.planHeader}>
            <span className={styles.badgeAlt}>BEST VALUE</span>
            <h3>Lifetime Access</h3>
            <div className={styles.priceContainer}>
              <span className={styles.priceInr}>₹999</span>
              <span className={styles.pricePeriod}>one-time (India)</span>
            </div>
            <div className={styles.priceGlobal}>or $19.00 one-time globally</div>
          </div>
          <ul className={styles.featuresList}>
            <li>✓ Everything in Monthly Pro</li>
            <li>✓ Lifetime perpetual license</li>
            <li>✓ Never expires, no recurring charges</li>
            <li>✓ All future stations & tools included</li>
            <li>✓ Direct priority feature requests</li>
          </ul>
          <button
            type="button"
            className={styles.selectBtn}
            onClick={() => setSelectedPlan("lifetime")}
          >
            {selectedPlan === "lifetime" ? "Selected Plan" : "Choose Lifetime (₹999)"}
          </button>
        </div>
      </div>

      {/* Instant Checkout / Generation Box */}
      <section className={styles.actionBox}>
        <div className={styles.boxHeader}>
          <h4>Get Your Pro License Key (Login-Free)</h4>
          <p>
            No registration or account creation needed. Your key is generated instantly upon payment
            and stored securely in Cloudflare using one-way SHA-256 hashing.
          </p>
        </div>

        <div className={styles.checkoutAction}>
          <button
            type="button"
            className={styles.generateButton}
            onClick={handleGenerate}
            disabled={generateLoading}
          >
            {generateLoading ? "Generating..." : `Activate ${selectedPlan === "monthly" ? "Monthly (₹199)" : "Lifetime (₹999)"} Key`}
          </button>
        </div>

        {generatedResult?.success && generatedResult.key && (
          <div className={styles.generatedKeyBox}>
            <div className={styles.keyNotice}>
              <strong>Save your key now!</strong> This plaintext key is shown only once and will never be displayed again.
            </div>
            <div className={styles.keyDisplay}>
              <code>{generatedResult.key}</code>
              <button
                type="button"
                className={styles.copyBtn}
                onClick={() => copyToClipboard(generatedResult.key!)}
              >
                {copiedKey ? "Copied!" : "Copy Key"}
              </button>
            </div>
            <div className={styles.expiryInfo}>
              Plan: <strong>{generatedResult.plan?.toUpperCase()}</strong> • Validity:{" "}
              <strong>
                {generatedResult.expiresAt
                  ? new Date(generatedResult.expiresAt).toLocaleDateString()
                  : "Lifetime (Never Expires)"}
              </strong>
            </div>

            <div className={styles.cliSnippet}>
              <label>Run with Cursor or Claude Desktop:</label>
              <pre>
{`{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "${generatedResult.key}"]
    }
  }
}`}
              </pre>
            </div>
          </div>
        )}
      </section>

      {/* Key Verifier Box */}
      <section className={styles.actionBox}>
        <div className={styles.boxHeader}>
          <h4>Already Have a Key? Verify Status</h4>
          <p>Check the validity, plan tier, and expiration date of your Code Station license key.</p>
        </div>

        <form onSubmit={handleVerify} className={styles.verifyForm}>
          <input
            type="text"
            placeholder="CS-PRO-XXXX-XXXX-XXXX"
            value={verifyKeyInput}
            onChange={(e) => setVerifyKeyInput(e.target.value)}
            className={styles.inputField}
          />
          <button type="submit" className={styles.verifyBtn} disabled={verifyLoading}>
            {verifyLoading ? "Checking..." : "Verify"}
          </button>
        </form>

        {verifyResult && (
          <div className={`${styles.resultBanner} ${verifyResult.valid ? styles.valid : styles.invalid}`}>
            <div>
              <strong>{verifyResult.valid ? "Active Pro License" : "Verification Failed"}</strong>
              <p>{verifyResult.message}</p>
              {verifyResult.valid && (
                <small>
                  Plan: {verifyResult.plan?.toUpperCase()} • Expires:{" "}
                  {verifyResult.expiresAt
                    ? new Date(verifyResult.expiresAt).toLocaleDateString()
                    : "Lifetime"}
                </small>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
