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

    const deviceId = body.deviceId ? String(body.deviceId) : undefined;
    const deviceName = body.deviceName ? String(body.deviceName) : undefined;

    // Support device reset action
    if (body.action === "reset_devices") {
      const { resetLicenseDevices } = await import("@/lib/license/storage");
      const reset = await resetLicenseDevices(key);
      return NextResponse.json(
        { success: reset, message: reset ? "All devices reset successfully." : "Key not found." },
        { status: reset ? 200 : 404, headers: CORS_HEADERS }
      );
    }

    const result = await verifyLicenseKey(key, deviceId, deviceName);

    return NextResponse.json(
      {
        valid: result.valid,
        tier: result.tier,
        plan: result.plan,
        expiresAt: result.expiresAt,
        message: result.message,
        deviceCount: result.deviceCount,
        maxDevices: result.maxDevices,
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
