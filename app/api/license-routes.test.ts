import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { clearTestStore } from "@/lib/license/storage";
import { POST as createOrderPost } from "./create-order/route";
import { POST as verifyPaymentPost } from "./verify-payment/route";
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
});
