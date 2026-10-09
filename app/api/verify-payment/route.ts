import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getRazorpayCredentials, verifySignature } from "@/lib/razorpay";
import { generateLicenseKey } from "@/lib/license/hash";
import { saveLicense } from "@/lib/license/storage";
import type { LicensePlan } from "@/lib/license/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}


export async function POST(request: Request) {
  try {
    const { keySecret } = getRazorpayCredentials();

    if (!keySecret) {
      return NextResponse.json(
        { error: "Razorpay credentials not configured on server" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const orderId = body.razorpay_order_id || body.order_id;
    const paymentId = body.razorpay_payment_id || body.payment_id;
    const signature = body.razorpay_signature || body.signature;
    const plan: LicensePlan = body.plan === "lifetime" ? "lifetime" : "monthly";

    // Validate presence of required fields
    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        {
          error: "Missing required verification fields. Expected order_id, payment_id, and signature.",
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Verify HMAC-SHA256 signature
    const isValid = verifySignature(orderId, paymentId, signature, keySecret);

    if (!isValid) {
      return NextResponse.json(
        {
          error: "Payment verification failed. Invalid signature.",
          verified: false,
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Generate Pro license key and persist one-way SHA-256 hash in Cloudflare KV
    const licenseKey = generateLicenseKey();
    const now = Date.now();
    const expiresAt = plan === "lifetime" ? null : now + 30 * 86400 * 1000;

    await saveLicense(licenseKey, {
      status: "active",
      tier: "pro",
      plan,
      createdAt: now,
      expiresAt,
      orderId,
      notes: `Razorpay payment ${paymentId}`,
    });

    return NextResponse.json(
      {
        success: true,
        verified: true,
        message: "Payment verified successfully",
        licenseKey,
        plan,
        createdAt: now,
        expiresAt,
        payment_id: paymentId,
        order_id: orderId,
      },
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Error verifying payment signature";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
