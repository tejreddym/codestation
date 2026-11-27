import { NextResponse } from "next/server";
import { getRazorpayClient, getRazorpayCredentials } from "@/lib/razorpay";
import { validateCoupon } from "@/lib/coupons";
import { resolvePlanPricing } from "@/lib/license/pricing";
import { sanitizeOrgName } from "@/lib/license/storage";

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
    const currency = (body.currency || "INR").toUpperCase();
    const resolved = resolvePlanPricing({
      plan: body.plan,
      planType: body.planType,
      seatLimit: body.seatLimit,
    });

    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { pricing } = resolved;
    const orgName = sanitizeOrgName(body.orgName);
    const hasCustomAmount =
      body.amount !== undefined &&
      body.amount !== null &&
      body.amount !== "" &&
      Number.isFinite(Number(body.amount));

    // Team plans in INR always use authoritative server-side pricing
    let finalAmount =
      pricing.planType === "team" && currency === "INR"
        ? pricing.amountPaise
        : hasCustomAmount
          ? Math.round(Number(body.amount))
          : pricing.amountPaise;

    const couponCode =
      typeof body.couponCode === "string" ? body.couponCode.trim() : undefined;
    let appliedCoupon: string | undefined;

    if (couponCode) {
      const couponResult = validateCoupon(couponCode, pricing.plan, finalAmount);
      if (!couponResult.valid) {
        return NextResponse.json(
          { error: couponResult.message || "Invalid coupon code." },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      finalAmount = couponResult.discountedAmountPaise!;
      appliedCoupon = couponResult.code;
    }

    // Amount validation: minimum 100 paise (₹1.00)
    if (!Number.isFinite(finalAmount) || finalAmount < 100) {
      return NextResponse.json(
        { error: "Invalid amount. Minimum amount is 100 paise (₹1.00)." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const receipt =
      body.receipt ||
      `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const razorpay = getRazorpayClient();

    const order = await razorpay.orders.create({
      amount: finalAmount,
      currency,
      receipt,
      notes: {
        product: "Code Station Pro",
        plan: pricing.plan,
        planType: pricing.planType,
        seatLimit: String(pricing.seatLimit),
        ...(orgName ? { orgName } : {}),
        ...(appliedCoupon ? { coupon: appliedCoupon } : {}),
      },
    });

    return NextResponse.json(
      {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: keyId,
        coupon_applied: appliedCoupon,
        plan: pricing.plan,
        planType: pricing.planType,
        seatLimit: pricing.seatLimit,
        ...(orgName ? { orgName } : {}),
      },
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (error: any) {
    const message =
      error?.error?.description ||
      error?.message ||
      "Failed to create Razorpay order";
    const statusCode = error?.statusCode || 500;

    return NextResponse.json(
      { error: message },
      { status: statusCode, headers: CORS_HEADERS }
    );
  }
}
