import type { LicensePlan, LicensePlanType } from "./types";

export const INDIVIDUAL_SEAT_LIMIT = 3;
export const TEAM_SEAT_TIERS = [5, 10, 25] as const;
export type TeamSeatTier = (typeof TEAM_SEAT_TIERS)[number];

export type CheckoutPlanId = "monthly" | "lifetime" | "team";

export interface PricingTierConfig {
  id: string;
  label: string;
  plan: LicensePlan;
  planType: LicensePlanType;
  seatLimit: number;
  amountPaise: number;
  amountInr: number;
  usdDisplay: string;
  periodLabel: string;
  durationMs: number | null;
}

export const INDIVIDUAL_PRICING: Record<"monthly" | "lifetime", PricingTierConfig> = {
  monthly: {
    id: "monthly",
    label: "Monthly Pro",
    plan: "monthly",
    planType: "individual",
    seatLimit: INDIVIDUAL_SEAT_LIMIT,
    amountPaise: 19900,
    amountInr: 199,
    usdDisplay: "$2.99 / month",
    periodLabel: "/ month (India)",
    durationMs: 30 * 86400 * 1000,
  },
  lifetime: {
    id: "lifetime",
    label: "Lifetime Access",
    plan: "lifetime",
    planType: "individual",
    seatLimit: INDIVIDUAL_SEAT_LIMIT,
    amountPaise: 99900,
    amountInr: 999,
    usdDisplay: "$19.00 one-time",
    periodLabel: "one-time (India)",
    durationMs: null,
  },
};

export const TEAM_PRICING: Record<TeamSeatTier, PricingTierConfig> = {
  5: {
    id: "team-5",
    label: "Team (5 Seats)",
    plan: "team",
    planType: "team",
    seatLimit: 5,
    amountPaise: 79900,
    amountInr: 799,
    usdDisplay: "$11.99 / month",
    periodLabel: "/ month (5 seats)",
    durationMs: 30 * 86400 * 1000,
  },
  10: {
    id: "team-10",
    label: "Team (10 Seats)",
    plan: "team",
    planType: "team",
    seatLimit: 10,
    amountPaise: 149900,
    amountInr: 1499,
    usdDisplay: "$22.99 / month",
    periodLabel: "/ month (10 seats)",
    durationMs: 30 * 86400 * 1000,
  },
  25: {
    id: "team-25",
    label: "Team (25 Seats)",
    plan: "team",
    planType: "team",
    seatLimit: 25,
    amountPaise: 349900,
    amountInr: 3499,
    usdDisplay: "$49.99 / month",
    periodLabel: "/ month (25 seats)",
    durationMs: 30 * 86400 * 1000,
  },
};

export const PRO_PRICING_PLANS = {
  individual: INDIVIDUAL_PRICING,
  team: TEAM_PRICING,
} as const;

export function isValidTeamSeatTier(value: unknown): value is TeamSeatTier {
  return value === 5 || value === 10 || value === 25;
}

export interface PlanSelectionInput {
  plan?: unknown;
  planType?: unknown;
  seatLimit?: unknown;
}

export type PlanResolutionResult =
  | { ok: true; pricing: PricingTierConfig }
  | { ok: false; error: string };

/**
 * Resolves checkout/order parameters into an authoritative pricing configuration.
 * Preserves legacy `plan: "monthly" | "lifetime"` calls while supporting team seat tiers.
 */
export function resolvePlanPricing(input: PlanSelectionInput): PlanResolutionResult {
  const rawPlan = typeof input.plan === "string" ? input.plan.trim().toLowerCase() : "";
  const rawType = typeof input.planType === "string" ? input.planType.trim().toLowerCase() : "";

  if (
    rawPlan === "team" ||
    rawType === "team" ||
    rawPlan === "team-5" ||
    rawPlan === "team-10" ||
    rawPlan === "team-25"
  ) {
    let requestedSeats: number | undefined;
    if (rawPlan === "team-5") requestedSeats = 5;
    else if (rawPlan === "team-10") requestedSeats = 10;
    else if (rawPlan === "team-25") requestedSeats = 25;
    else if (input.seatLimit !== undefined && input.seatLimit !== null && input.seatLimit !== "") {
      requestedSeats = Number(input.seatLimit);
    } else {
      requestedSeats = 5;
    }

    if (!isValidTeamSeatTier(requestedSeats)) {
      return {
        ok: false,
        error: `Unsupported team seatLimit "${String(input.seatLimit)}". Supported team tiers are 5, 10, or 25 seats.`,
      };
    }

    return { ok: true, pricing: TEAM_PRICING[requestedSeats] };
  }

  if (rawPlan === "lifetime") {
    return { ok: true, pricing: INDIVIDUAL_PRICING.lifetime };
  }

  if (rawPlan === "" || rawPlan === "monthly") {
    return { ok: true, pricing: INDIVIDUAL_PRICING.monthly };
  }

  return {
    ok: false,
    error: `Unsupported plan "${String(input.plan)}". Expected monthly, lifetime, or team.`,
  };
}
