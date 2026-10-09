import { describe, it, expect } from "vitest";
import { validateCoupon } from "./coupons";

describe("Coupon Engine (CS50FIRST)", () => {
  it("validates CS50FIRST on 1-month Monthly Pro plan", () => {
    const result = validateCoupon("CS50FIRST", "monthly", 19900);
    expect(result.valid).toBe(true);
    expect(result.code).toBe("CS50FIRST");
    expect(result.discountPercent).toBe(50);
    expect(result.originalAmountPaise).toBe(19900);
    expect(result.discountedAmountPaise).toBe(9900);
  });

  it("handles case-insensitive and trimmed codes", () => {
    const result = validateCoupon("  cs50first  ", "monthly", 19900);
    expect(result.valid).toBe(true);
    expect(result.code).toBe("CS50FIRST");
    expect(result.discountPercent).toBe(50);
  });

  it("rejects coupon on lifetime plan", () => {
    const result = validateCoupon("CS50FIRST", "lifetime", 99900);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("valid only for the 1-month Monthly Pro plan");
  });

  it("rejects invalid coupons", () => {
    const result = validateCoupon("FAKECODE100", "monthly", 19900);
    expect(result.valid).toBe(false);
    expect(result.message).toBe("Invalid coupon code.");
  });

  it("rejects empty coupon code", () => {
    const result = validateCoupon("", "monthly", 19900);
    expect(result.valid).toBe(false);
  });
});
