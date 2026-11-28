import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { clearTestStore, getOrderProvisioning } from "@/lib/license/storage";
import { POST as createOrderPost } from "./create-order/route";
import { POST as verifyPaymentPost } from "./verify-payment/route";
import { POST as razorpayWebhookPost } from "./webhooks/razorpay/route";
import { POST as createLicensePost } from "./v1/license/create/route";
import { POST as verifyLicensePost } from "./v1/license/verify/route";
import { POST as revokeLicensePost } from "./v1/license/revoke/route";

const { ordersCreateMock } = vi.hoisted(() => ({
  ordersCreateMock: vi.fn(),
}));

vi.mock("razorpay", () => ({
  default: class RazorpayMock {
    orders = {
      create: ordersCreateMock,
    };
  },
}));

const TEST_KEY_ID = "rzp_test_team_123456";
const TEST_KEY_SECRET = "test_secret_abcdef_123456";
const TEST_WEBHOOK_SECRET = "whsec_test_9876543210";

function signWebhookPayload(rawBody: string, secret = TEST_WEBHOOK_SECRET): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

function webhookRequest(rawBody: string, signature?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signature !== undefined) {
    headers["x-razorpay-signature"] = signature;
  }
  return new Request("http://localhost/api/webhooks/razorpay", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

function signPayment(orderId: string, paymentId: string, secret = TEST_KEY_SECRET): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  clearTestStore();
  ordersCreateMock.mockReset();
  ordersCreateMock.mockImplementation(async (params: Record<string, any>) => ({
    id: "order_team_test_001",
    amount: params.amount,
    currency: params.currency,
  }));
  process.env.RAZORPAY_KEY_ID = TEST_KEY_ID;
  process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  delete process.env.LICENSE_GENERATOR_SECRET;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Pro & Team Licensing API Routes", () => {
  it("preserves individual monthly order and verification contracts (3 seats default)", async () => {
    const orderRes = await createOrderPost(
      jsonRequest("http://localhost/api/create-order", {
        amount: 19900,
        currency: "INR",
        plan: "monthly",
      })
    );
    expect(orderRes.status).toBe(200);
    const orderJson = (await orderRes.json()) as Record<string, any>;
    expect(orderJson.order_id).toBe("order_team_test_001");
    expect(orderJson.amount).toBe(19900);
    expect(orderJson.plan).toBe("monthly");
    expect(orderJson.planType).toBe("individual");
    expect(orderJson.seatLimit).toBe(3);

    const sig = signPayment("order_team_test_001", "pay_ind_001");
    const verifyPayRes = await verifyPaymentPost(
      jsonRequest("http://localhost/api/verify-payment", {
        razorpay_order_id: "order_team_test_001",
        razorpay_payment_id: "pay_ind_001",
        razorpay_signature: sig,
        plan: "monthly",
      })
    );
    expect(verifyPayRes.status).toBe(200);
    const verifyPayJson = (await verifyPayRes.json()) as Record<string, any>;
    expect(verifyPayJson.success).toBe(true);
    expect(verifyPayJson.licenseKey).toMatch(/^CS-PRO-/);
    expect(verifyPayJson.planType).toBe("individual");
    expect(verifyPayJson.seatLimit).toBe(3);
    expect(verifyPayJson.maxDevices).toBe(3);
  });

  it("enforces authoritative team pricing on /api/create-order and rejects invalid tiers", async () => {
    // Client attempts to tamper amount to ₹1 for a 10-seat team plan
    const res = await createOrderPost(
      jsonRequest("http://localhost/api/create-order", {
        amount: 100,
        currency: "INR",
        plan: "team",
        seatLimit: 10,
        orgName: "Acme Platform",
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, any>;
    expect(data.amount).toBe(149900);
    expect(data.plan).toBe("team");
    expect(data.planType).toBe("team");
    expect(data.seatLimit).toBe(10);
    expect(data.orgName).toBe("Acme Platform");

    // Unsupported seat tier rejected with 400
    const badTier = await createOrderPost(
      jsonRequest("http://localhost/api/create-order", {
        currency: "INR",
        plan: "team",
        seatLimit: 7,
      })
    );
    expect(badTier.status).toBe(400);
  });

  it("rejects invalid or tampered Razorpay signatures on /api/verify-payment", async () => {
    const tamperedSig = signPayment("order_team_test_001", "pay_tampered", "wrong_secret");
    const res = await verifyPaymentPost(
      jsonRequest("http://localhost/api/verify-payment", {
        razorpay_order_id: "order_team_test_001",
        razorpay_payment_id: "pay_tampered",
        razorpay_signature: tamperedSig,
        plan: "team",
        seatLimit: 5,
      })
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as Record<string, any>;
    expect(data.verified).toBe(false);
    expect(data.licenseKey).toBeUndefined();
  });

  it("issues team licenses, enforces seat limits, and supports per-seat revocation + reset", async () => {
    const createRes = await createLicensePost(
      jsonRequest("http://localhost/api/v1/license/create", {
        plan: "team",
        seatLimit: 5,
        orgName: "Orbit Labs",
      })
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as Record<string, any>;
    expect(created.plan).toBe("team");
    expect(created.planType).toBe("team");
    expect(created.seatLimit).toBe(5);
    expect(created.orgName).toBe("Orbit Labs");

    const key = created.key as string;

    // Fill 5 seats
    for (let i = 1; i <= 5; i += 1) {
      const vRes = await verifyLicensePost(
        jsonRequest("http://localhost/api/v1/license/verify", {
          key,
          deviceId: `dev_${i}`,
          deviceName: `Laptop ${i}`,
        })
      );
      expect(vRes.status).toBe(200);
    }

    // 6th seat rejected (403)
    const sixthRes = await verifyLicensePost(
      jsonRequest("http://localhost/api/v1/license/verify", {
        key,
        deviceId: "dev_6",
        deviceName: "Laptop 6",
      })
    );
    expect(sixthRes.status).toBe(403);
    const sixthJson = (await sixthRes.json()) as Record<string, any>;
    expect(sixthJson.valid).toBe(false);
    expect(sixthJson.deviceCount).toBe(5);
    expect(sixthJson.maxDevices).toBe(5);

    // Revoke dev_2 via /api/v1/license/revoke
    const revokeRes = await revokeLicensePost(
      jsonRequest("http://localhost/api/v1/license/revoke", {
        key,
        deviceId: "dev_2",
      })
    );
    expect(revokeRes.status).toBe(200);
    const revokedJson = (await revokeRes.json()) as Record<string, any>;
    expect(revokedJson.success).toBe(true);
    expect(revokedJson.deviceCount).toBe(4);

    // Unknown device returns 404
    const missingDevRes = await revokeLicensePost(
      jsonRequest("http://localhost/api/v1/license/revoke", {
        key,
        deviceId: "nonexistent_dev",
      })
    );
    expect(missingDevRes.status).toBe(404);

    // 6th seat now succeeds
    const retrySixthRes = await verifyLicensePost(
      jsonRequest("http://localhost/api/v1/license/verify", {
        key,
        deviceId: "dev_6",
        deviceName: "Laptop 6",
      })
    );
    expect(retrySixthRes.status).toBe(200);

    // Reset all devices via /api/v1/license/revoke
    const resetAllRes = await revokeLicensePost(
      jsonRequest("http://localhost/api/v1/license/revoke", {
        key,
        resetAll: true,
      })
    );
    expect(resetAllRes.status).toBe(200);
    const resetAllJson = (await resetAllRes.json()) as Record<string, any>;
    expect(resetAllJson.deviceCount).toBe(0);
    expect(resetAllJson.devices).toEqual([]);
  });

  it("verifies Razorpay webhook HMAC signatures, rejects tampered requests, and provisions idempotently", async () => {
    const webhookBody = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_webhook_001",
            order_id: "order_webhook_001",
            amount: 149900,
            notes: {
              plan: "team",
              planType: "team",
              seatLimit: "10",
              orgName: "Webhook Org",
            },
          },
        },
      },
    });

    // Reject missing or invalid signature
    const missingSig = await razorpayWebhookPost(webhookRequest(webhookBody));
    expect(missingSig.status).toBe(401);

    const badSig = await razorpayWebhookPost(webhookRequest(webhookBody, "0".repeat(64)));
    expect(badSig.status).toBe(401);

    // Valid signature provisions Team 10-seat license on first event
    const validSig = signWebhookPayload(webhookBody);
    const firstHook = await razorpayWebhookPost(webhookRequest(webhookBody, validSig));
    expect(firstHook.status).toBe(200);
    const firstJson = (await firstHook.json()) as Record<string, any>;
    expect(firstJson.received).toBe(true);
    expect(firstJson.provisioned).toBe(true);
    expect(firstJson.idempotent).toBe(false);
    expect(firstJson.seatLimit).toBe(10);
    expect(firstJson.orgName).toBe("Webhook Org");
    expect(firstJson.licenseKey).toBeUndefined();

    // Duplicate payment.captured delivery is idempotent with identical keyHash
    const dupHook = await razorpayWebhookPost(webhookRequest(webhookBody, validSig));
    expect(dupHook.status).toBe(200);
    const dupJson = (await dupHook.json()) as Record<string, any>;
    expect(dupJson.idempotent).toBe(true);
    expect(dupJson.provisioned).toBe(false);
    expect(dupJson.keyHash).toBe(firstJson.keyHash);

    // Subsequent order.paid for the same order_id is also idempotent
    const orderPaidBody = JSON.stringify({
      event: "order.paid",
      payload: {
        order: { entity: { id: "order_webhook_001", amount: 149900 } },
        payment: { entity: { id: "pay_webhook_001", order_id: "order_webhook_001" } },
      },
    });
    const orderPaidHook = await razorpayWebhookPost(
      webhookRequest(orderPaidBody, signWebhookPayload(orderPaidBody))
    );
    expect(orderPaidHook.status).toBe(200);
    const orderPaidJson = (await orderPaidHook.json()) as Record<string, any>;
    expect(orderPaidJson.idempotent).toBe(true);
    expect(orderPaidJson.keyHash).toBe(firstJson.keyHash);

    // If buyer's /api/verify-payment completes right after webhook, it returns the provisioned key & scrubs pendingKey
    const clientSig = signPayment("order_webhook_001", "pay_webhook_001");
    const claimRes = await verifyPaymentPost(
      jsonRequest("http://localhost/api/verify-payment", {
        razorpay_order_id: "order_webhook_001",
        razorpay_payment_id: "pay_webhook_001",
        razorpay_signature: clientSig,
        plan: "team",
        seatLimit: 10,
      })
    );
    expect(claimRes.status).toBe(200);
    const claimJson = (await claimRes.json()) as Record<string, any>;
    expect(claimJson.provisionedByWebhook).toBe(true);
    expect(claimJson.licenseKey).toMatch(/^CS-TEAM-/);

    const scrubbed = await getOrderProvisioning("order_webhook_001");
    expect(scrubbed?.clientClaimed).toBe(true);
    expect(scrubbed?.pendingKey).toBeUndefined();

    // Verify provisioned key works against /api/v1/license/verify
    const activeCheck = await verifyLicensePost(
      jsonRequest("http://localhost/api/v1/license/verify", {
        key: claimJson.licenseKey,
        deviceId: "team-dev-1",
      })
    );
    expect(activeCheck.status).toBe(200);
    const activeJson = (await activeCheck.json()) as Record<string, any>;
    expect(activeJson.valid).toBe(true);
    expect(activeJson.seatLimit).toBe(10);
    expect(activeJson.orgName).toBe("Webhook Org");
  });

  it("handles verify-payment first followed by webhook idempotently", async () => {
    const clientSig = signPayment("order_client_first_001", "pay_client_first_001");
    const verifyRes = await verifyPaymentPost(
      jsonRequest("http://localhost/api/verify-payment", {
        razorpay_order_id: "order_client_first_001",
        razorpay_payment_id: "pay_client_first_001",
        razorpay_signature: clientSig,
        plan: "lifetime",
      })
    );
    expect(verifyRes.status).toBe(200);
    const verifyJson = (await verifyRes.json()) as Record<string, any>;
    expect(verifyJson.licenseKey).toMatch(/^CS-PRO-/);

    const webhookBody = JSON.stringify({
      event: "order.paid",
      payload: {
        order: { entity: { id: "order_client_first_001", amount: 99900 } },
        payment: {
          entity: {
            id: "pay_client_first_001",
            order_id: "order_client_first_001",
            notes: { plan: "lifetime" },
          },
        },
      },
    });
    const hookRes = await razorpayWebhookPost(
      webhookRequest(webhookBody, signWebhookPayload(webhookBody))
    );
    expect(hookRes.status).toBe(200);
    const hookJson = (await hookRes.json()) as Record<string, any>;
    expect(hookJson.idempotent).toBe(true);
    expect(hookJson.provisioned).toBe(false);
  });
});
