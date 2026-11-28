import { NextResponse } from "next/server";
import { getRazorpayWebhookSecret, verifyWebhookSignature } from "@/lib/razorpay";
import { generateLicenseKey } from "@/lib/license/hash";
import {
  INDIVIDUAL_PRICING,
  TEAM_PRICING,
  resolvePlanPricing,
} from "@/lib/license/pricing";
import {
  getOrderProvisioning,
  sanitizeOrgName,
  saveLicense,
  saveOrderProvisioning,
} from "@/lib/license/storage";

const HANDLED_EVENTS = new Set(["payment.captured", "order.paid"]);

function inferPlanFromNotesAndAmount(
  notes: Record<string, unknown>,
  amountPaise?: unknown
) {
  if (notes.plan || notes.planType || notes.seatLimit) {
    const resolved = resolvePlanPricing({
      plan: notes.plan,
      planType: notes.planType,
      seatLimit: notes.seatLimit,
    });
    if (resolved.ok) return resolved.pricing;
  }

  const amt = typeof amountPaise === "number" ? amountPaise : Number(amountPaise);
  if (Number.isFinite(amt)) {
    if (amt === INDIVIDUAL_PRICING.lifetime.amountPaise) {
      return INDIVIDUAL_PRICING.lifetime;
    }
    for (const tier of Object.values(TEAM_PRICING)) {
      if (amt === tier.amountPaise) return tier;
    }
  }
  return INDIVIDUAL_PRICING.monthly;
}

export async function POST(request: Request) {
  try {
    const webhookSecret = getRazorpayWebhookSecret();
    if (!webhookSecret) {
      return NextResponse.json(
        { error: "RAZORPAY_WEBHOOK_SECRET is not configured on the server." },
        { status: 500 }
      );
    }

    const signature = request.headers.get("x-razorpay-signature")?.trim() ?? "";
    const rawBody = await request.text();

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json(
        { error: "Invalid Razorpay webhook signature." },
        { status: 401 }
      );
    }

    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody) as Record<string, any>;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON webhook payload." },
        { status: 400 }
      );
    }

    const event = typeof payload.event === "string" ? payload.event : "";
    if (!HANDLED_EVENTS.has(event)) {
      return NextResponse.json(
        { received: true, ignored: true, event },
        { status: 200 }
      );
    }

    const paymentEntity = payload?.payload?.payment?.entity ?? {};
    const orderEntity = payload?.payload?.order?.entity ?? {};
    const orderId =
      typeof orderEntity.id === "string" && orderEntity.id.trim()
        ? orderEntity.id.trim()
        : typeof paymentEntity.order_id === "string"
          ? paymentEntity.order_id.trim()
          : "";
    const paymentId =
      typeof paymentEntity.id === "string" ? paymentEntity.id.trim() : "";

    if (!orderId) {
      return NextResponse.json(
        { error: "Webhook payload missing order_id." },
        { status: 400 }
      );
    }

    // Idempotent check by order_id — ensures at most one license per order
    const existing = await getOrderProvisioning(orderId);
    if (existing) {
      return NextResponse.json(
        {
          received: true,
          idempotent: true,
          provisioned: false,
          event,
          order_id: orderId,
          keyHash: existing.keyHash,
          plan: existing.plan,
          planType: existing.planType,
          seatLimit: existing.seatLimit,
        },
        { status: 200 }
      );
    }

    const mergedNotes: Record<string, unknown> = {
      ...(orderEntity.notes && typeof orderEntity.notes === "object"
        ? orderEntity.notes
        : {}),
      ...(paymentEntity.notes && typeof paymentEntity.notes === "object"
        ? paymentEntity.notes
        : {}),
    };

    const pricing = inferPlanFromNotesAndAmount(
      mergedNotes,
      paymentEntity.amount ?? orderEntity.amount
    );
    const orgName = sanitizeOrgName(mergedNotes.orgName);
    const licenseKey = generateLicenseKey(
      pricing.planType === "team" ? "CS-TEAM" : "CS-PRO"
    );
    const now = Date.now();
    const expiresAt =
      pricing.durationMs === null ? null : now + pricing.durationMs;

    const { keyHash } = await saveLicense(licenseKey, {
      status: "active",
      tier: "pro",
      plan: pricing.plan,
      planType: pricing.planType,
      seatLimit: pricing.seatLimit,
      maxDevices: pricing.seatLimit,
      ...(orgName ? { orgName } : {}),
      createdAt: now,
      expiresAt,
      orderId,
      notes: `Razorpay webhook ${event} (${paymentId || "no-payment-id"})`,
    });

    await saveOrderProvisioning({
      orderId,
      paymentId,
      keyHash,
      plan: pricing.plan,
      planType: pricing.planType,
      seatLimit: pricing.seatLimit,
      ...(orgName ? { orgName } : {}),
      createdAt: now,
      expiresAt,
      provisionedBy: "webhook",
      clientClaimed: false,
      webhookEvent: event,
      pendingKey: licenseKey,
    });

    return NextResponse.json(
      {
        received: true,
        idempotent: false,
        provisioned: true,
        event,
        order_id: orderId,
        payment_id: paymentId,
        keyHash,
        plan: pricing.plan,
        planType: pricing.planType,
        seatLimit: pricing.seatLimit,
        ...(orgName ? { orgName } : {}),
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
