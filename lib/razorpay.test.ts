import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { verifySignature } from "@/app/api/verify-payment/route";
import { getRazorpayCredentials } from "@/lib/razorpay";

describe("Razorpay Integration", () => {
  const testSecret = "oZnLs4H38FXMcI7BHt1WH815";
  const orderId = "order_O4vL2sF5b3x0wZ";
  const paymentId = "pay_O4vL8zG7c4y1xA";

  it("loads configured Razorpay credentials", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_Tli5WVYM3S0zhH";
    process.env.RAZORPAY_KEY_SECRET = "oZnLs4H38FXMcI7BHt1WH815";
    const creds = getRazorpayCredentials();
    expect(creds.keyId).toBe("rzp_test_Tli5WVYM3S0zhH");
    expect(creds.keySecret).toBe("oZnLs4H38FXMcI7BHt1WH815");
  });

  it("verifies a valid HMAC-SHA256 signature", () => {
    const payload = `${orderId}|${paymentId}`;
    const validSignature = crypto
      .createHmac("sha256", testSecret)
      .update(payload)
      .digest("hex");

    const result = verifySignature(orderId, paymentId, validSignature, testSecret);
    expect(result).toBe(true);
  });

  it("rejects an invalid HMAC-SHA256 signature", () => {
    const fakeSignature = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const result = verifySignature(orderId, paymentId, fakeSignature, testSecret);
    expect(result).toBe(false);
  });

  it("rejects signatures with incorrect secret", () => {
    const payload = `${orderId}|${paymentId}`;
    const wrongSignature = crypto
      .createHmac("sha256", "wrong_secret_key")
      .update(payload)
      .digest("hex");

    const result = verifySignature(orderId, paymentId, wrongSignature, testSecret);
    expect(result).toBe(false);
  });
});
