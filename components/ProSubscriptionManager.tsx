"use client";

import { useState, useEffect } from "react";
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

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function ProSubscriptionManager() {
  const [verifyKeyInput, setVerifyKeyInput] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "lifetime">("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GenerateResult | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Load Razorpay checkout script on mount
  useEffect(() => {
    if (typeof window !== "undefined" && !window.Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

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

  async function handleRazorpayCheckout() {
    setCheckoutLoading(true);
    setCheckoutError(null);
    setGeneratedResult(null);

    try {
      // 1. Create order on backend
      const amountPaise = selectedPlan === "monthly" ? 19900 : 99900;
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          plan: selectedPlan,
        }),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to create order (Status ${orderRes.status})`);
      }

      const orderData = await orderRes.json();

      if (!window.Razorpay) {
        throw new Error("Razorpay SDK is loading. Please check your internet connection and try again.");
      }

      // 2. Open Razorpay Checkout modal
      const options = {
        key: orderData.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Code Station Pro",
        description: selectedPlan === "monthly" ? "Monthly Pro Subscription" : "Lifetime Pro License",
        order_id: orderData.order_id,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            // 3. Verify signature on backend and issue license key
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: selectedPlan,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok && verifyData.success) {
              setGeneratedResult({
                success: true,
                key: verifyData.licenseKey,
                plan: verifyData.plan,
                expiresAt: verifyData.expiresAt,
                message: "Payment successful! Your Code Station Pro key has been generated.",
              });
            } else {
              setCheckoutError(verifyData.error || "Payment signature verification failed.");
            }
          } catch (err: any) {
            setCheckoutError(err.message || "Network error while verifying payment.");
          } finally {
            setCheckoutLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setCheckoutLoading(false);
          },
        },
        theme: {
          color: "#476511",
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", function (response: any) {
        setCheckoutError(response.error?.description || "Payment failed. Please try again.");
        setCheckoutLoading(false);
      });

      rzp.open();
    } catch (err: any) {
      setCheckoutError(err.message || "Failed to initiate Razorpay checkout.");
      setCheckoutLoading(false);
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

      {/* Razorpay Standard Web Checkout Action Box */}
      <section className={styles.actionBox}>
        <div className={styles.boxHeader}>
          <h4>Pay with Razorpay (Instant Login-Free Key)</h4>
          <p>
            No registration or account creation needed. Complete the checkout via UPI, Cards, NetBanking,
            or Wallets. Your cryptographic key is issued immediately and verified via Cloudflare edge one-way hashing.
          </p>
        </div>

        <div className={styles.checkoutAction}>
          <button
            type="button"
            className={styles.generateButton}
            onClick={handleRazorpayCheckout}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? "Opening Razorpay..." : `Pay ${selectedPlan === "monthly" ? "₹199 with Razorpay" : "₹999 with Razorpay"}`}
          </button>
        </div>

        {checkoutError && (
          <div className={`${styles.resultBanner} ${styles.invalid}`}>
            <strong>Payment Notice</strong>
            <p>{checkoutError}</p>
          </div>
        )}

        {generatedResult?.success && generatedResult.key && (
          <div className={styles.generatedKeyBox}>
            <div className={styles.keyNotice}>
              <strong>Payment Verified! Save your key now:</strong> This plaintext key is shown only once and will never be displayed again.
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
