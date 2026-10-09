export interface CouponValidationResult {
  valid: boolean;
  code?: string;
  discountPercent?: number;
  discountedAmountPaise?: number;
  originalAmountPaise?: number;
  message?: string;
}

export const ACTIVE_COUPONS = {
  CS50FIRST: {
    code: "CS50FIRST",
    discountPercent: 50,
    validUntil: new Date("2026-10-31T23:59:59Z").getTime(),
    applicablePlan: "monthly",
    description: "50% off on 1-month Monthly Pro subscription (valid till Oct 31, 2026)",
  },
} as const;

/**
 * Validates a coupon code against active campaigns, plans, and expiration timestamps.
 */
export function validateCoupon(
  rawCode: string | undefined | null,
  plan: "monthly" | "lifetime",
  baseAmountPaise: number
): CouponValidationResult {
  if (!rawCode || !rawCode.trim()) {
    return { valid: false, message: "No coupon code provided" };
  }

  const normalized = rawCode.trim().toUpperCase();
  const coupon = ACTIVE_COUPONS[normalized as keyof typeof ACTIVE_COUPONS];

  if (!coupon) {
    return { valid: false, message: "Invalid coupon code." };
  }

  const now = Date.now();
  if (now > coupon.validUntil) {
    return {
      valid: false,
      message: `Coupon code ${coupon.code} expired on Oct 31, 2026.`,
    };
  }

  if (coupon.applicablePlan && coupon.applicablePlan !== plan) {
    return {
      valid: false,
      message: `Coupon ${coupon.code} is valid only for the 1-month Monthly Pro plan.`,
    };
  }

  // 50% discount calculation (for ₹199 / 19900 paise -> ₹99 / 9900 paise, rounded to clean whole rupees)
  const rawDiscounted = baseAmountPaise * ((100 - coupon.discountPercent) / 100);
  const discountedAmountPaise = Math.floor(rawDiscounted / 100) * 100;

  return {
    valid: true,
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    originalAmountPaise: baseAmountPaise,
    discountedAmountPaise,
    message: `${coupon.discountPercent}% discount applied!`,
  };
}
