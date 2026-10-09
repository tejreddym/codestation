import { NextResponse } from "next/server";
import { getRazorpayClient, getRazorpayCredentials } from "@/lib/razorpay";

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
    const { keyId, keySecret } = getRazorpayCredentials();

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay credentials are not configured on the server" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const rawAmount = Number(body.amount);
    const currency = (body.currency || "INR").toUpperCase();
    const plan = body.plan === "lifetime" ? "lifetime" : "monthly";

    // Amount validation: minimum 100 paise (₹1.00)
    if (!Number.isFinite(rawAmount) || rawAmount < 100) {
      return NextResponse.json(
        { error: "Invalid amount. Minimum amount is 100 paise (₹1.00)." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const amount = Math.round(rawAmount);
    const receipt = body.receipt || `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const razorpay = getRazorpayClient();

    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt,
      notes: {
        product: "Code Station Pro",
        plan,
      },
    });

    return NextResponse.json(
      {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: keyId,
      },
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (error: any) {
    const message = error?.error?.description || error?.message || "Failed to create Razorpay order";
    const statusCode = error?.statusCode || 500;

    return NextResponse.json(
      { error: message },
      { status: statusCode, headers: CORS_HEADERS }
    );
  }
}
