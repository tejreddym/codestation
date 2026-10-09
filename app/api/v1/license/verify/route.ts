import { NextResponse } from "next/server";
import { verifyLicenseKey } from "@/lib/license/storage";

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
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const key = body.key || body.licenseKey;

    if (!key || typeof key !== "string") {
      return NextResponse.json(
        { valid: false, message: "Missing license key in request body" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const result = await verifyLicenseKey(key);

    return NextResponse.json(
      {
        valid: result.valid,
        tier: result.tier,
        plan: result.plan,
        expiresAt: result.expiresAt,
        message: result.message,
      },
      {
        status: result.valid ? 200 : 403,
        headers: CORS_HEADERS,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal verification error";
    return NextResponse.json(
      { valid: false, message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
