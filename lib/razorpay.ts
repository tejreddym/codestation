import Razorpay from "razorpay";
import crypto from "node:crypto";

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
}

export function getRazorpayCredentials(): RazorpayCredentials {
  let keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
  let keySecret = process.env.RAZORPAY_KEY_SECRET || "";

  if (!keyId || !keySecret) {
    try {
      const { getCloudflareContext } = require("@opennextjs/cloudflare");
      const ctx = getCloudflareContext();
      if (ctx?.env) {
        keyId = keyId || ctx.env.RAZORPAY_KEY_ID || ctx.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
        keySecret = keySecret || ctx.env.RAZORPAY_KEY_SECRET || "";
      }
    } catch {
      // Cloudflare context not available in local next dev / vitest
    }
  }

  return { keyId, keySecret };
}

export function getRazorpayClient(): Razorpay {
  const { keyId, keySecret } = getRazorpayCredentials();

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are missing.");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export function getRazorpayWebhookSecret(): string {
  let webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  if (!webhookSecret) {
    try {
      const { getCloudflareContext } = require("@opennextjs/cloudflare");
      const ctx = getCloudflareContext();
      if (ctx?.env?.RAZORPAY_WEBHOOK_SECRET) {
        webhookSecret = ctx.env.RAZORPAY_WEBHOOK_SECRET;
      }
    } catch {
      // Cloudflare context not available in local next dev / vitest
    }
  }
  return webhookSecret;
}

export function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  const payload = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  if (expectedSignature.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "utf-8"),
    Buffer.from(signature, "utf-8")
  );
}

/**
 * Verifies Razorpay webhook `x-razorpay-signature` header against raw JSON request body.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!rawBody || !signature || !secret) {
    return false;
  }
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (expectedSignature.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "utf-8"),
    Buffer.from(signature, "utf-8")
  );
}

