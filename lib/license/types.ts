export type LicensePlan = "monthly" | "lifetime" | "annual" | "team";
export type LicensePlanType = "individual" | "team";
export type LicenseStatusState = "active" | "revoked" | "expired";

export interface ActiveDevice {
  id: string; // Hashed or client-generated device/machine fingerprint
  lastSeen: number;
  name?: string;
}

export interface LicenseRecord {
  status: LicenseStatusState;
  tier: "pro";
  plan: LicensePlan;
  planType?: LicensePlanType; // Default/inferred: "team" for team plans, otherwise "individual"
  seatLimit?: number; // Default: 3 for individual; 5 | 10 | 25 for team
  orgName?: string;
  createdAt: number;
  expiresAt: number | null; // null for lifetime
  orderId?: string;
  notes?: string;
  maxDevices?: number; // Backward-compatible alias kept synchronized with seatLimit
  devices?: ActiveDevice[];
}

export interface OrderProvisioningRecord {
  orderId: string;
  paymentId: string;
  keyHash: string;
  plan: LicensePlan;
  planType: LicensePlanType;
  seatLimit: number;
  orgName?: string;
  createdAt: number;
  expiresAt: number | null;
  provisionedBy: "verify-payment" | "webhook";
  clientClaimed: boolean;
  webhookEvent?: string;
  pendingKey?: string; // Cleared automatically as soon as client claims key
}

export interface VerificationResponse {
  valid: boolean;
  tier?: "pro" | "free";
  plan?: LicensePlan;
  planType?: LicensePlanType;
  seatLimit?: number;
  orgName?: string;
  expiresAt?: number | null;
  message?: string;
  deviceCount?: number;
  maxDevices?: number;
  devices?: ActiveDevice[];
  cachedUntil?: number;
}
