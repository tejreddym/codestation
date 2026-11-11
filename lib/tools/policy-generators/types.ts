/**
 * Universal Document AST & Options Types for Policy Generators
 * Code Station — Browser-Native Developer Tools
 */

export type PolicyToolId =
  | "privacy-policy-generator"
  | "terms-and-conditions-generator"
  | "cookie-policy-generator"
  | "disclaimer-generator"
  | "refund-policy-generator";

export type PolicyOutputFormat = "text" | "markdown" | "html" | "json";

export interface PolicyCallout {
  type: "note" | "warning" | "legal";
  title?: string;
  text: string;
}

export interface PolicyTable {
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface PolicySubsection {
  id?: string;
  title: string;
  paragraphs?: string[];
  bulletPoints?: string[];
  table?: PolicyTable;
  callout?: PolicyCallout;
}

export interface PolicySection {
  id: string;
  title: string;
  paragraphs?: string[];
  bulletPoints?: string[];
  subsections?: PolicySubsection[];
  table?: PolicyTable;
  callout?: PolicyCallout;
}

export interface PolicyMetadata {
  toolId: PolicyToolId;
  title: string;
  companyName: string;
  appName?: string;
  websiteUrl: string;
  contactEmail: string;
  physicalAddress?: string;
  country?: string;
  stateOrProvince?: string;
  effectiveDate: string;
  lastUpdatedDate: string;
  [key: string]: unknown;
}

export interface PolicyDocument {
  id: string;
  title: string;
  metadata: PolicyMetadata;
  sections: PolicySection[];
}

export interface SerializerOptions {
  standaloneHtml?: boolean;
  indentSpaces?: number;
  includeMetadataBlock?: boolean;
}

export interface BasePolicyOptions {
  companyName?: string;
  appName?: string;
  websiteUrl?: string;
  contactEmail?: string;
  physicalAddress?: string;
  country?: string;
  stateOrProvince?: string;
  effectiveDate?: string;
  lastUpdatedDate?: string;
  [key: string]: unknown;
}

// ============================================================================
// Privacy Policy Types
// ============================================================================

export type LegalBasis =
  | "consent"
  | "contract"
  | "legal_obligation"
  | "legitimate_interests"
  | "vital_interests"
  | "public_task";

export type DataCategoryKey =
  | "personal_identity"
  | "account_credentials"
  | "financial_payment"
  | "device_telemetry"
  | "usage_activity"
  | "geolocation"
  | "user_content"
  | "communications";

export interface PrivacyPolicyOptions extends BasePolicyOptions {
  entityType?: "company" | "individual" | "organization";
  dpoName?: string;
  dpoEmail?: string;
  euRepresentative?: string;
  ukRepresentative?: string;
  collectedCategories?: DataCategoryKey[];
  collectsSensitiveData?: boolean;
  sensitiveDataCategories?: string[];
  usesCookies?: boolean;
  cookieCategories?: Array<"strictly_necessary" | "analytics" | "functional" | "advertising">;
  supportsDoNotTrack?: boolean;
  supportsGlobalPrivacyControl?: boolean;
  thirdPartyServices?: string[];
  hasAdvertising?: boolean;
  advertisingNetworks?: string[];
  includeGdpr?: boolean;
  legalBases?: LegalBasis[];
  internationalTransfers?: boolean;
  transferSafeguards?: Array<"sccs" | "dpf" | "adequacy">;
  includeCcpa?: boolean;
  sellsOrSharesData?: boolean;
  collectsSensitivePersonalInfoUnderCcpa?: boolean;
  includeCalOppa?: boolean;
  targetAudience?: "general" | "under13" | "mixed";
  minimumAge?: number;
  retentionDescription?: string;
  securityMeasures?: string[];
  userRights?: string[];
}

// ============================================================================
// Terms and Conditions Types
// ============================================================================

export type DisputeResolutionType = "arbitration" | "court" | "informal_then_arbitration";
export type LiabilityCapType = "twelve_months_fees_or_fixed" | "total_fees_paid" | "fixed_amount" | "no_cap";

export interface TermsAndConditionsOptions extends BasePolicyOptions {
  serviceType?: "saas" | "ecommerce" | "content" | "mobile";
  serviceDescription?: string;
  minimumAge?: number;
  hasUserAccounts?: boolean;
  accountSecurityTerms?: boolean;
  hasSubscriptions?: boolean;
  subscriptionBillingCycles?: Array<"monthly" | "annual" | "one-time">;
  autoRenewal?: boolean;
  refundPolicyCrossReference?: boolean;
  prohibitedUses?: string[];
  intellectualPropertyOwnership?: string;
  licenseGrantToUser?: string;
  feedbackOwnership?: boolean;
  hasUserContent?: boolean;
  ugcLicenseScope?: string;
  ugcModerationRights?: boolean;
  includeDmca?: boolean;
  dmcaAgentName?: string;
  dmcaAgentEmail?: string;
  dmcaAgentAddress?: string;
  terminationNoticeTerms?: string;
  warrantyDisclaimerText?: string;
  limitationOfLiabilityType?: LiabilityCapType;
  liabilityFixedAmount?: string;
  consequentialDamagesWaiver?: boolean;
  includeIndemnification?: boolean;
  governingCountry?: string;
  governingStateOrCity?: string;
  disputeResolution?: DisputeResolutionType;
  arbitrationProvider?: "AAA" | "JAMS" | "LCIA";
  classActionWaiver?: boolean;
  juryTrialWaiver?: boolean;
  arbitrationOptOutDays?: number;
}

// ============================================================================
// Cookie Policy Types
// ============================================================================

export interface CookieRow {
  name: string;
  provider: string;
  category: "Strictly Necessary" | "Analytics & Performance" | "Functional" | "Advertising & Targeting" | string;
  purpose: string;
  duration: string;
  type: "HTTP Cookie" | "Local Storage" | "Session Storage" | "Pixel / Web Beacon" | string;
}

export interface CookiePolicyOptions extends BasePolicyOptions {
  usesCookies?: boolean;
  useStrictlyNecessary?: boolean;
  useAnalytics?: boolean;
  useFunctional?: boolean;
  useAdvertising?: boolean;
  cookieCategories?: string[];
  customCookieRows?: CookieRow[];
  customCookies?: Array<{ name: string; category: string; provider: string; purpose: string; duration: string }>;
  thirdPartyTrackers?: string[];
  thirdPartyServices?: string[];
  hasCookieTable?: boolean;
  cookieBannerLink?: string;
  supportsGpc?: boolean;
  doNotTrackSupported?: boolean;
  browserGuides?: boolean;
}

// ============================================================================
// Disclaimer Types
// ============================================================================

export interface DisclaimerOptions extends BasePolicyOptions {
  includeGeneral?: boolean;
  includeRiskAssumption?: boolean;
  generalDisclaimer?: boolean;
  disclaimerTypes?: Array<"legal" | "medical" | "financial" | "fitness" | "tax">;
  professionalDisclaimers?: Array<"legal" | "medical" | "financial" | "fitness" | "tax">;
  includeExternalLinks?: boolean;
  externalLinks?: boolean;
  hasAffiliateLinks?: boolean;
  affiliateLinks?: boolean;
  isAmazonAssociate?: boolean;
  affiliatePrograms?: string[];
  hasSponsoredContent?: boolean;
  sponsoredPosts?: boolean;
  includeTestimonials?: boolean;
  testimonials?: boolean;
  fairUse?: boolean;
  includeErrorsAndOmissions?: boolean;
  errorsAndOmissions?: boolean;
  includeWarrantyLimitation?: boolean;
  warrantyExclusion?: boolean;
}

// ============================================================================
// Refund Policy Types
// ============================================================================

export interface RefundPolicyOptions extends BasePolicyOptions {
  policyType?: "standardReturns" | "noRefunds" | "storeCreditOnly" | "conditionalRefunds";
  returnWindowDays?: number;
  productType?: "physical" | "digital" | "saas" | "services";
  productTypes?: Array<
    | "physicalGoods"
    | "digitalDownloads"
    | "saasSubscriptions"
    | "professionalServices"
    | "giftCards"
  >;
  conditionRequirements?: Array<
    | "originalPackaging"
    | "unopenedUnused"
    | "tagsAttached"
    | "proofOfPurchase"
    | "rmaRequired"
    | string
  >;
  eligibilityConditions?: string[];
  nonRefundableItems?: string[];
  shippingFeePayer?: "customer" | "company" | "customerUnlessDefective";
  returnShippingCost?: "customer" | "company" | "customer-unless-defective";
  restockingFee?: "none" | "10percent" | "15percent" | "flat10" | string;
  restockingFeePercentage?: number;
  refundMethod?: "originalPayment" | "storeCredit" | "customerChoice" | "original" | "credit" | "exchange";
  processingDays?: string;
  processingTimeDays?: number;
  inspectionDays?: string;
  damagedItemWindow?: string;
  saasRefundRule?: "accessUntilCycleEnd" | "proratedRefund" | "trialFullRefund";
  saasCancellationTerms?: string;
  damagedGoodsProcedure?: string;
  physicalReturnAddress?: string;
}

// ============================================================================
// Presets Types
// ============================================================================

export type PresetVertical = "saas" | "ecommerce" | "blog" | "mobile-app";

export interface PolicyPresetItem {
  id: PresetVertical;
  name: string;
  description: string;
  privacyPolicy: PrivacyPolicyOptions | Record<string, unknown>;
  termsAndConditions: TermsAndConditionsOptions | Record<string, unknown>;
  cookiePolicy: CookiePolicyOptions | Record<string, unknown>;
  disclaimer: DisclaimerOptions | Record<string, unknown>;
  refundPolicy: RefundPolicyOptions | Record<string, unknown>;
}
