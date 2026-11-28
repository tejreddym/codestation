"use client";

import { useState, useEffect } from "react";
import { validateCoupon, type CouponValidationResult } from "@/lib/coupons";
import {
  INDIVIDUAL_PRICING,
  TEAM_PRICING,
  TEAM_SEAT_TIERS,
  type CheckoutPlanId,
  type TeamSeatTier,
} from "@/lib/license/pricing";
import type { ActiveDevice, LicensePlan, LicensePlanType } from "@/lib/license/types";
import styles from "./ProSubscriptionManager.module.css";
import { useCopy } from "./ui/useCopy";

interface VerifyResult {
  valid: boolean;
  tier?: string;
  plan?: LicensePlan;
  planType?: LicensePlanType;
  seatLimit?: number;
  orgName?: string;
  expiresAt?: number | null;
  deviceCount?: number;
  maxDevices?: number;
  devices?: ActiveDevice[];
  message?: string;
}

interface GenerateResult {
  success: boolean;
  key?: string;
  plan?: LicensePlan;
  planType?: LicensePlanType;
  seatLimit?: number;
  orgName?: string;
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
  const [seatActionLoading, setSeatActionLoading] = useState<string | null>(null);
  const [seatActionMessage, setSeatActionMessage] = useState<string | null>(null);

  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlanId>("monthly");
  const [teamSeats, setTeamSeats] = useState<TeamSeatTier>(5);
  const [orgName, setOrgName] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GenerateResult | null>(
    null,
  );
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedMcpConfig, setCopiedMcpConfig] = useState(false);
  const [downloadedTxt, setDownloadedTxt] = useState(false);
  const { copy } = useCopy();

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] =
    useState<CouponValidationResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const selectedTeamPricing = TEAM_PRICING[teamSeats];
  const activeCheckoutPricing =
    selectedPlan === "team"
      ? selectedTeamPricing
      : INDIVIDUAL_PRICING[selectedPlan];

  function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!couponInput.trim()) return;

    const result = validateCoupon(
      couponInput,
      activeCheckoutPricing.plan,
      activeCheckoutPricing.amountPaise,
    );

    if (result.valid) {
      setAppliedCoupon(result);
      setCouponError(null);
    } else {
      setAppliedCoupon(null);
      setCouponError(result.message || "Invalid coupon code.");
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  }

  function handleSelectPlan(plan: CheckoutPlanId) {
    setSelectedPlan(plan);
    if (plan !== "monthly" && appliedCoupon) {
      setAppliedCoupon(null);
      setCouponError(
        "Coupon CS50FIRST was removed because it is valid only for the Monthly Pro plan.",
      );
    } else {
      setCouponError(null);
    }
  }

  // Load Razorpay checkout script on mount
  useEffect(() => {
    if (typeof window !== "undefined" && !window.Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  async function runVerifyRequest(rawKey: string) {
    const cleanKey = rawKey.trim();
    if (!cleanKey) {
      setVerifyResult({
        valid: false,
        message: "Enter your license key (e.g. CS-PRO-XXXX-XXXX-XXXX or CS-TEAM-XXXX-XXXX-XXXX) to check seat usage.",
      });
      setSeatActionMessage(null);
      return;
    }

    setVerifyLoading(true);
    setVerifyResult(null);
    setSeatActionMessage(null);

    try {
      const res = await fetch("/api/v1/license/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: cleanKey }),
      });
      const data = (await res.json()) as VerifyResult;
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

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    await runVerifyRequest(verifyKeyInput);
  }

  async function handleRevokeSeat(options: { deviceId?: string; resetAll?: boolean }) {
    const cleanKey = verifyKeyInput.trim();
    if (!cleanKey) return;

    const actionKey = options.resetAll ? "reset_all" : options.deviceId || "revoke";
    setSeatActionLoading(actionKey);
    setSeatActionMessage(null);

    try {
      const res = await fetch("/api/v1/license/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: cleanKey,
          ...(options.resetAll ? { resetAll: true } : { deviceId: options.deviceId }),
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        deviceCount?: number;
        maxDevices?: number;
        seatLimit?: number;
        devices?: ActiveDevice[];
      };

      if (res.ok && data.success) {
        setVerifyResult((prev) =>
          prev
            ? {
                ...prev,
                deviceCount: data.deviceCount ?? 0,
                maxDevices: data.maxDevices ?? prev.maxDevices,
                seatLimit: data.seatLimit ?? prev.seatLimit,
                devices: data.devices ?? [],
              }
            : prev,
        );
        setSeatActionMessage(data.message || "Seat updated successfully.");
      } else {
        setSeatActionMessage(data.message || "Could not revoke device seat.");
      }
    } catch (err) {
      setSeatActionMessage(
        err instanceof Error ? err.message : "Network error while revoking device seat.",
      );
    } finally {
      setSeatActionLoading(null);
    }
  }

  async function handleRazorpayCheckout() {
    setCheckoutLoading(true);
    setCheckoutError(null);
    setGeneratedResult(null);

    try {
      const basePaise = activeCheckoutPricing.amountPaise;
      const amountPaise =
        appliedCoupon?.valid && selectedPlan === "monthly"
          ? appliedCoupon.discountedAmountPaise!
          : basePaise;
      const cleanOrgName = orgName.trim();

      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          plan: activeCheckoutPricing.plan,
          planType: activeCheckoutPricing.planType,
          seatLimit: activeCheckoutPricing.seatLimit,
          ...(selectedPlan === "team" && cleanOrgName ? { orgName: cleanOrgName } : {}),
          couponCode: appliedCoupon?.valid ? appliedCoupon.code : undefined,
        }),
      });

      if (!orderRes.ok) {
        const errData = (await orderRes.json().catch(() => ({}))) as Record<
          string,
          any
        >;
        throw new Error(
          errData.error || `Failed to create order (Status ${orderRes.status})`,
        );
      }

      const orderData = (await orderRes.json()) as Record<string, any>;

      if (!window.Razorpay) {
        throw new Error(
          "Razorpay SDK is loading. Please check your internet connection and try again.",
        );
      }

      const options = {
        key: orderData.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Code Station Pro",
        description:
          selectedPlan === "monthly"
            ? "Monthly Pro Subscription (3 devices)"
            : selectedPlan === "lifetime"
              ? "Lifetime Pro License (3 devices)"
              : `Team Pro License (${activeCheckoutPricing.seatLimit} seats)`,
        order_id: orderData.order_id,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: activeCheckoutPricing.plan,
                planType: activeCheckoutPricing.planType,
                seatLimit: activeCheckoutPricing.seatLimit,
                ...(selectedPlan === "team" && cleanOrgName
                  ? { orgName: cleanOrgName }
                  : {}),
              }),
            });

            const verifyData = (await verifyRes.json()) as Record<string, any>;

            if (verifyRes.ok && verifyData.success) {
              setGeneratedResult({
                success: true,
                key: verifyData.licenseKey,
                plan: verifyData.plan,
                planType: verifyData.planType,
                seatLimit: verifyData.seatLimit,
                orgName: verifyData.orgName,
                expiresAt: verifyData.expiresAt,
                message:
                  "Payment successful! Your Code Station Pro key has been generated.",
              });
            } else {
              setCheckoutError(
                verifyData.error || "Payment signature verification failed.",
              );
            }
          } catch (err: any) {
            setCheckoutError(
              err.message || "Network error while verifying payment.",
            );
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
        setCheckoutError(
          response.error?.description || "Payment failed. Please try again.",
        );
        setCheckoutLoading(false);
      });

      rzp.open();
    } catch (err: any) {
      setCheckoutError(err.message || "Failed to initiate Razorpay checkout.");
      setCheckoutLoading(false);
    }
  }

  async function copyToClipboard(text: string) {
    if (!(await copy(text))) return;
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function buildMcpConfigJson(licenseKey: string): string {
    return JSON.stringify(
      {
        mcpServers: {
          codestation: {
            command: "npx",
            args: ["-y", "codestation-mcp"],
            env: {
              CODESTATION_LICENSE_KEY: licenseKey,
            },
          },
        },
      },
      null,
      2,
    );
  }

  async function copyMcpConfig(licenseKey: string) {
    if (!(await copy(buildMcpConfigJson(licenseKey)))) return;
    setCopiedMcpConfig(true);
    setTimeout(() => setCopiedMcpConfig(false), 2000);
  }

  function downloadLicenseTxt(res: GenerateResult) {
    if (!res.key) return;
    const content = [
      "CODE STATION PRO / TEAM LICENSE BACKUP",
      "======================================",
      `License Key: ${res.key}`,
      `Plan:        ${(res.plan ?? "pro").toUpperCase()}`,
      `Type:        ${res.planType === "team" ? "TEAM" : "INDIVIDUAL"}`,
      `Seat Limit:  ${res.seatLimit ?? 3}`,
      ...(res.orgName ? [`Org Name:    ${res.orgName}`] : []),
      `Expires:     ${res.expiresAt ? new Date(res.expiresAt).toISOString() : "Lifetime (Never Expires)"}`,
      "",
      "1. Activate Terminal CLI & Cache 14-Day Offline Grace:",
      `   npx codestation-mcp login ${res.key}`,
      "",
      "2. One-Click Cursor / Claude / Windsurf Setup:",
      `   npx codestation-mcp setup --key ${res.key}`,
      "",
      "3. MCP JSON Config (Cursor / Claude Desktop / Windsurf):",
      buildMcpConfigJson(res.key),
      "",
      "Support & Key Recovery: hello@codestation.in (keep your Razorpay Payment ID)",
      "",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "codestation-license.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloadedTxt(true);
    setTimeout(() => setDownloadedTxt(false), 2500);
  }

  const checkoutButtonLabel = checkoutLoading
    ? "Opening Razorpay..."
    : appliedCoupon?.valid && selectedPlan === "monthly"
      ? `Pay ₹${Math.round(appliedCoupon.discountedAmountPaise! / 100)} with Razorpay (50% OFF Applied)`
      : `Pay ₹${activeCheckoutPricing.amountInr} with Razorpay${
          selectedPlan === "team" ? ` (Team · ${activeCheckoutPricing.seatLimit} seats)` : ""
        }`;

  return (
    <div className={styles.container}>
      {/* Pricing Cards */}
      <div className={styles.pricingGrid}>
        <div
          className={`${styles.planCard} ${selectedPlan === "monthly" ? styles.selected : ""}`}
        >
          <div>
            <div className={styles.planHeader}>
              <span className={styles.badge}>POPULAR</span>
              <h3>Monthly Pro</h3>
              <div className={styles.priceContainer}>
                <span className={styles.priceInr}>₹{INDIVIDUAL_PRICING.monthly.amountInr}</span>
                <span className={styles.pricePeriod}>/ month (India)</span>
              </div>
              <div className={styles.priceGlobal}>
                or {INDIVIDUAL_PRICING.monthly.usdDisplay} globally
              </div>
            </div>
            <ul className={styles.featuresList}>
              <li>✓ Full access to local MCP &amp; CLI tools</li>
              <li>✓ Up to 3 personal devices</li>
              <li>✓ 14-day offline grace cache (~/.codestation/license.json)</li>
              <li>✓ All 304 pure-Node + PDF/XLSX/ZIP file tools</li>
              <li>✓ Multi-dialect SQL, IANA timezones &amp; business days</li>
              <li>✓ Zero login or password required</li>
            </ul>
          </div>
          <button
            type="button"
            className={styles.selectBtn}
            aria-pressed={selectedPlan === "monthly"}
            onClick={() => handleSelectPlan("monthly")}
          >
            {selectedPlan === "monthly"
              ? appliedCoupon?.valid
                ? "Selected Monthly (₹99)"
                : "Selected Plan"
              : `Choose Monthly (₹${INDIVIDUAL_PRICING.monthly.amountInr})`}
          </button>
        </div>

        <div
          className={`${styles.planCard} ${selectedPlan === "lifetime" ? styles.selected : ""}`}
        >
          <div>
            <div className={styles.planHeader}>
              <span className={styles.badgeAlt}>BEST VALUE</span>
              <h3>Lifetime Access</h3>
              <div className={styles.priceContainer}>
                <span className={styles.priceInr}>₹{INDIVIDUAL_PRICING.lifetime.amountInr}</span>
                <span className={styles.pricePeriod}>one-time (India)</span>
              </div>
              <div className={styles.priceGlobal}>
                or {INDIVIDUAL_PRICING.lifetime.usdDisplay} globally
              </div>
            </div>
            <ul className={styles.featuresList}>
              <li>✓ Everything in Monthly Pro</li>
              <li>✓ Up to 3 personal devices</li>
              <li>✓ Lifetime perpetual license</li>
              <li>✓ Never expires, no recurring charges</li>
              <li>✓ All future stations &amp; tools included</li>
              <li>✓ Direct priority feature requests</li>
            </ul>
          </div>
          <button
            type="button"
            className={styles.selectBtn}
            aria-pressed={selectedPlan === "lifetime"}
            onClick={() => handleSelectPlan("lifetime")}
          >
            {selectedPlan === "lifetime"
              ? "Selected Plan"
              : `Choose Lifetime (₹${INDIVIDUAL_PRICING.lifetime.amountInr})`}
          </button>
        </div>

        <div
          className={`${styles.planCard} ${selectedPlan === "team" ? styles.selected : ""}`}
          data-testid="team-plan-card"
        >
          <div>
            <div className={styles.planHeader}>
              <span className={styles.badge}>TEAM &amp; ORG</span>
              <h3>Team Multi-Seat</h3>
              <div className={styles.priceContainer}>
                <span className={styles.priceInr}>₹{selectedTeamPricing.amountInr}</span>
                <span className={styles.pricePeriod}>
                  / month ({teamSeats} seats)
                </span>
              </div>
              <div className={styles.priceGlobal}>
                or {selectedTeamPricing.usdDisplay} globally
              </div>
            </div>

            <div className={styles.seatSelector} role="group" aria-label="Team seat tier">
              {TEAM_SEAT_TIERS.map((tierSeats) => (
                <button
                  key={tierSeats}
                  type="button"
                  className={`${styles.seatOptionBtn} ${
                    teamSeats === tierSeats ? styles.seatOptionActive : ""
                  }`}
                  aria-pressed={teamSeats === tierSeats}
                  onClick={() => {
                    setTeamSeats(tierSeats);
                    handleSelectPlan("team");
                  }}
                >
                  {tierSeats} seats · ₹{TEAM_PRICING[tierSeats].amountInr}
                </button>
              ))}
            </div>

            <ul className={styles.featuresList}>
              <li>✓ Shared team key with 5, 10, or 25 seats</li>
              <li>✓ Organization / team name metadata</li>
              <li>✓ Per-seat revocation &amp; self-serve reset</li>
              <li>✓ Everything in Individual Pro MCP &amp; CLI</li>
              <li>✓ Zero user accounts, hash-only KV storage</li>
            </ul>
          </div>
          <button
            type="button"
            className={styles.selectBtn}
            aria-pressed={selectedPlan === "team"}
            onClick={() => handleSelectPlan("team")}
          >
            {selectedPlan === "team"
              ? `Selected Team (${teamSeats} seats)`
              : `Choose Team (${teamSeats} seats · ₹${selectedTeamPricing.amountInr})`}
          </button>
        </div>
      </div>

      {/* Razorpay Standard Web Checkout Action Box */}
      <section className={styles.actionBox}>
        <div className={styles.boxHeader}>
          <h3>Pay with Razorpay (Instant Login-Free Key)</h3>
          <p>
            No registration or account creation needed. Complete checkout via
            UPI, Cards, NetBanking, or Wallets. Your cryptographic key is
            issued immediately and stored only via one-way SHA-256 hashing.
          </p>
        </div>

        {selectedPlan === "team" && (
          <div className={styles.teamMetaRow}>
            <label className={styles.orgLabel}>
              Organization / Team Name (optional)
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Platform Engineering"
                maxLength={80}
                className={styles.orgInput}
              />
            </label>
          </div>
        )}

        {/* Coupon Code Section */}
        <div className={styles.couponSection}>
          {appliedCoupon?.valid ? (
            <div className={styles.couponBadge}>
              <span>
                ✓ Coupon <strong>{appliedCoupon.code}</strong> applied: 50% OFF
                (₹199 → ₹
                {Math.round(appliedCoupon.discountedAmountPaise! / 100)})
              </span>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className={styles.couponRemoveBtn}
                aria-label="Remove coupon"
              >
                Remove
              </button>
            </div>
          ) : (
            <form onSubmit={handleApplyCoupon} className={styles.couponForm}>
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Have a coupon? (e.g. CS50FIRST)"
                className={styles.couponInput}
                aria-label="Coupon code"
                autoComplete="off"
              />
              <button type="submit" className={styles.couponApplyBtn}>
                Apply
              </button>
            </form>
          )}
          {couponError && (
            <div className={styles.couponError}>{couponError}</div>
          )}
        </div>

        <div className={styles.checkoutAction}>
          <button
            type="button"
            className={styles.generateButton}
            onClick={handleRazorpayCheckout}
            disabled={checkoutLoading}
          >
            {checkoutButtonLabel}
          </button>
          <p className={styles.currencyNote}>
            Processed in INR (₹
            {appliedCoupon?.valid && selectedPlan === "monthly"
              ? Math.round(appliedCoupon.discountedAmountPaise! / 100)
              : activeCheckoutPricing.amountInr}
            ) via Razorpay UPI / International Cards — approx.{" "}
            <strong>{activeCheckoutPricing.usdDisplay}</strong>. Webhook failover
            guarantees instant key provisioning even if your tab closes mid-redirect.
          </p>
        </div>

        <div className={styles.guaranteeBox} data-testid="pro-guarantee-box">
          <div>
            <strong>7-Day Guarantee</strong>
            <span>Full refund if Pro MCP tools do not work in your workflow.</span>
          </div>
          <div>
            <strong>Human Support</strong>
            <span>
              Email <a href="mailto:hello@codestation.in">hello@codestation.in</a>{" "}
              with your Payment ID anytime.
            </span>
          </div>
          <div>
            <strong>Zero-Account Privacy</strong>
            <span>Only one-way SHA-256 key hashes touch Cloudflare KV.</span>
          </div>
        </div>

        {checkoutError && (
          <div className={`${styles.resultBanner} ${styles.invalid}`} role="alert">
            <strong>Payment Notice</strong>
            <p>{checkoutError}</p>
          </div>
        )}

        {generatedResult?.success && generatedResult.key && (
          <div className={styles.generatedKeyBox} data-testid="generated-key-box">
            <div className={styles.keyNotice}>
              <strong>Payment Verified! Save your key now:</strong> This
              plaintext key is shown only once and will never be displayed
              again.
            </div>
            <div className={styles.keyDisplay}>
              <code>{generatedResult.key}</code>
              <div className={styles.keyActions}>
                <button
                  type="button"
                  className={styles.keyCopyBtn}
                  onClick={() => copyToClipboard(generatedResult.key!)}
                >
                  {copiedKey ? "✓ Copied Key" : "Copy Key"}
                </button>
                <button
                  type="button"
                  className={styles.keyDownloadBtn}
                  onClick={() => downloadLicenseTxt(generatedResult)}
                >
                  {downloadedTxt
                    ? "✓ Downloaded .txt"
                    : "Download codestation-license.txt"}
                </button>
              </div>
            </div>
            <div className={styles.expiryInfo}>
              Plan: <strong>{generatedResult.plan?.toUpperCase()}</strong> •
              Type:{" "}
              <strong>
                {generatedResult.planType === "team" ? "TEAM" : "INDIVIDUAL"}
              </strong>{" "}
              • Seats:{" "}
              <strong>{generatedResult.seatLimit ?? 3}</strong>
              {generatedResult.orgName && (
                <>
                  {" "}
                  • Org: <strong>{generatedResult.orgName}</strong>
                </>
              )}{" "}
              • Validity:{" "}
              <strong>
                {generatedResult.expiresAt
                  ? new Date(generatedResult.expiresAt).toLocaleDateString()
                  : "Lifetime (Never Expires)"}
              </strong>
            </div>

            <div className={styles.recoveryNotice}>
              ⚠️ <strong>Backup this key safely:</strong> Code Station does not
              store plaintext keys. Download{" "}
              <code>codestation-license.txt</code> above or email{" "}
              <a href="mailto:hello@codestation.in">hello@codestation.in</a>{" "}
              with your Razorpay Payment ID if you ever need a key reset.
            </div>

            <div className={styles.cliSnippet}>
              <div className={styles.cliSnippetHeader}>
                <label>Ready-to-Paste MCP Config (Cursor / Claude Desktop / Windsurf):</label>
                <button
                  type="button"
                  className={styles.keyCopyBtn}
                  onClick={() => copyMcpConfig(generatedResult.key!)}
                >
                  {copiedMcpConfig ? "✓ MCP Config Copied" : "Copy MCP Config"}
                </button>
              </div>
              <pre>{buildMcpConfigJson(generatedResult.key)}</pre>
            </div>
          </div>
        )}
      </section>

      {/* License & Seat Management Box */}
      <section id="manage" className={styles.actionBox}>
        <div className={styles.boxHeader}>
          <h3>Verify &amp; Manage License Seats</h3>
          <p>
            Check validity, expiration, organization metadata, and active seat
            usage. License holders can revoke individual stale devices or reset
            all active slots cleanly.
          </p>
        </div>

        <form onSubmit={handleVerify} className={styles.verifyForm}>
          <input
            type="text"
            placeholder="CS-PRO-XXXX-XXXX-XXXX"
            aria-label="Code Station Pro license key"
            value={verifyKeyInput}
            onChange={(e) => setVerifyKeyInput(e.target.value)}
            className={styles.inputField}
          />
          <button
            type="submit"
            className={styles.verifyBtn}
            disabled={verifyLoading}
          >
            {verifyLoading ? "Checking..." : "Verify & Manage"}
          </button>
        </form>

        {verifyResult && (
          <div
            className={`${styles.resultBanner} ${verifyResult.valid ? styles.valid : styles.invalid}`}
            role={verifyResult.valid ? "status" : "alert"}
          >
            <div>
              <strong>
                {verifyResult.valid
                  ? verifyResult.planType === "team"
                    ? "Active Team License"
                    : "Active Pro License"
                  : "Verification Notice"}
              </strong>
              <p>{verifyResult.message}</p>
              {!verifyResult.valid && !verifyResult.devices?.length && (
                <small>
                  Check key spelling (<code>CS-PRO-...</code> or{" "}
                  <code>CS-TEAM-...</code>), or email{" "}
                  <a href="mailto:hello@codestation.in">hello@codestation.in</a>{" "}
                  with your Razorpay Payment ID for recovery.
                </small>
              )}
              {(verifyResult.valid || (verifyResult.devices?.length ?? 0) > 0) && (
                <small>
                  Plan: {verifyResult.plan?.toUpperCase()} • Type:{" "}
                  {verifyResult.planType === "team" ? "Team" : "Individual"} •
                  Seats:{" "}
                  {verifyResult.deviceCount ??
                    verifyResult.devices?.length ??
                    0}{" "}
                  / {verifyResult.seatLimit ?? verifyResult.maxDevices ?? 3}
                  {verifyResult.orgName ? ` • Org: ${verifyResult.orgName}` : ""} •
                  Expires:{" "}
                  {verifyResult.expiresAt
                    ? new Date(verifyResult.expiresAt).toLocaleDateString()
                    : "Lifetime"}
                </small>
              )}
            </div>

            {(verifyResult.valid || (verifyResult.devices?.length ?? 0) > 0) && (
              <div className={styles.seatManager}>
                <div className={styles.seatManagerHeader}>
                  <span>
                    Active seats (
                    {verifyResult.devices?.length ?? verifyResult.deviceCount ?? 0} /{" "}
                    {verifyResult.seatLimit ?? verifyResult.maxDevices ?? 3})
                  </span>
                  <div className={styles.keyActions}>
                    <button
                      type="button"
                      className={styles.revokeSeatBtn}
                      disabled={verifyLoading || seatActionLoading !== null}
                      onClick={() => void runVerifyRequest(verifyKeyInput)}
                    >
                      {verifyLoading ? "Refreshing..." : "Refresh Seats"}
                    </button>
                    {(verifyResult.devices?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        className={styles.resetSeatsBtn}
                        disabled={seatActionLoading !== null}
                        onClick={() => void handleRevokeSeat({ resetAll: true })}
                      >
                        {seatActionLoading === "reset_all"
                          ? "Resetting..."
                          : "Reset All Seats"}
                      </button>
                    )}
                  </div>
                </div>

                {verifyResult.devices && verifyResult.devices.length > 0 ? (
                  <ul className={styles.deviceList}>
                    {verifyResult.devices.map((device) => (
                      <li key={device.id} className={styles.deviceRow}>
                        <div className={styles.deviceMeta}>
                          <strong>{device.name || "Unknown device"}</strong>
                          <small>
                            ID: <code>{device.id}</code> · Last active:{" "}
                            {new Date(device.lastSeen).toLocaleDateString()}
                          </small>
                        </div>
                        <button
                          type="button"
                          className={styles.revokeSeatBtn}
                          disabled={seatActionLoading !== null}
                          onClick={() =>
                            void handleRevokeSeat({ deviceId: device.id })
                          }
                        >
                          {seatActionLoading === device.id
                            ? "Revoking..."
                            : "Revoke Seat"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.emptySeats}>
                    No active devices are currently bound to this license key.
                  </p>
                )}

                {seatActionMessage && (
                  <p className={styles.seatStatus} role="status" aria-live="polite">
                    {seatActionMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
