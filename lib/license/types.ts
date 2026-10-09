export type LicensePlan = "monthly" | "lifetime" | "annual";
export type LicenseStatusState = "active" | "revoked" | "expired";

export interface LicenseRecord {
  status: LicenseStatusState;
  tier: "pro";
  plan: LicensePlan;
  createdAt: number;
  expiresAt: number | null; // null for lifetime
  orderId?: string;
  notes?: string;
}

export interface VerificationResponse {
  valid: boolean;
  tier?: "pro" | "free";
  plan?: LicensePlan;
  expiresAt?: number | null;
  message?: string;
  cachedUntil?: number;
}
