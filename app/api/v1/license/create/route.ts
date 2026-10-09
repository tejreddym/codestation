import { NextResponse } from "next/server";
import { generateLicenseKey } from "@/lib/license/hash";
import { saveLicense } from "@/lib/license/storage";
import type { LicensePlan } from "@/lib/license/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Webhook-Secret",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const secret = request.headers.get("X-Webhook-Secret") || body.secret;
    const expectedSecret = process.env.LICENSE_GENERATOR_SECRET;

    // Guard endpoint if an explicit secret is configured in production
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const plan: LicensePlan = body.plan === "lifetime" ? "lifetime" : "monthly";
    const orderId: string = body.orderId || `ord_${Date.now().toString(36)}`;

    // Generate fresh key
    const rawKey = generateLicenseKey();

    // Validity: 30 days for monthly, null for lifetime
    const now = Date.now();
    const expiresAt = plan === "lifetime" ? null : now + 30 * 86400 * 1000;

    // Save one-way hash in Cloudflare KV
    await saveLicense(rawKey, {
      status: "active",
      tier: "pro",
      plan,
      createdAt: now,
      expiresAt,
      orderId,
    });

    return NextResponse.json(
      {
        success: true,
        key: rawKey, // Shown once to the user
        plan,
        createdAt: now,
        expiresAt,
        message: "License generated successfully and stored securely via one-way hash.",
      },
      {
        status: 201,
        headers: CORS_HEADERS,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error generating license";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
