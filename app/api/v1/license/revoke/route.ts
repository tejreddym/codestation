import { NextResponse } from "next/server";
import { revokeLicenseDevice } from "@/lib/license/storage";

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

    if (!key || typeof key !== "string" || !key.trim()) {
      return NextResponse.json(
        { success: false, message: "Missing license key in request body" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const resetAll = body.resetAll === true || body.action === "reset_devices";
    const deviceId =
      typeof body.deviceId === "string" ? body.deviceId.trim() : undefined;

    if (!resetAll && !deviceId) {
      return NextResponse.json(
        {
          success: false,
          message: "Provide a deviceId to revoke or set resetAll: true.",
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const result = await revokeLicenseDevice(key, { deviceId, resetAll });

    if (!result.found) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (result.status === "revoked") {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    if (!result.revoked) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          plan: result.plan,
          planType: result.planType,
          seatLimit: result.seatLimit,
          orgName: result.orgName,
          deviceCount: result.deviceCount,
          maxDevices: result.maxDevices,
          devices: result.devices,
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        plan: result.plan,
        planType: result.planType,
        seatLimit: result.seatLimit,
        orgName: result.orgName,
        deviceCount: result.deviceCount,
        maxDevices: result.maxDevices,
        devices: result.devices,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to revoke license seat";
    return NextResponse.json(
      { success: false, message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
