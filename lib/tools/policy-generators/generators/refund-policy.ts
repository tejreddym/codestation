/**
 * Refund Policy Generator Engine
 * Multi-product returns (physical goods, digital downloads, SaaS subscriptions), RMA workflows, and statutory consumer rights.
 * Code Station — Browser-Native Developer Tools
 */

import { cleanPositiveNumber, cleanStr } from "../serializers";
import {
  PolicyDocument,
  PolicyMetadata,
  PolicySection,
  PolicySubsection,
  RefundPolicyOptions,
} from "../types";

export function generateRefundPolicy(
  rawOptions: Record<string, unknown> = {}
): PolicyDocument {
  const opts = rawOptions as RefundPolicyOptions;

  const today = new Date().toISOString().split("T")[0];
  const companyName = cleanStr(opts.companyName, "[Company Name]");
  const appName = cleanStr(opts.appName, opts.companyName ? String(opts.companyName) : "[Application Name]");
  const websiteUrl = cleanStr(opts.websiteUrl, "[https://example.com]");
  const contactEmail = cleanStr(opts.contactEmail, "[billing@example.com]");
  const physicalAddress = cleanStr(
    opts.physicalReturnAddress || opts.physicalAddress,
    "[Company Return Address]"
  );
  const effectiveDate = cleanStr(opts.effectiveDate, today);
  const lastUpdatedDate = cleanStr(opts.lastUpdatedDate, effectiveDate);
  const returnWindowDays = cleanPositiveNumber(opts.returnWindowDays, 30);
  const policyType = opts.policyType || "standardReturns";
  const processingDays = cleanStr(opts.processingDays, "5–10 business days");
  const inspectionDays = cleanStr(opts.inspectionDays, "3–5 business days");
  const damagedItemWindow = cleanStr(opts.damagedItemWindow, "Within 48 hours of delivery");

  const metadata: PolicyMetadata = {
    toolId: "refund-policy-generator",
    title: "Return and Refund Policy",
    companyName,
    appName,
    websiteUrl,
    contactEmail,
    physicalAddress,
    effectiveDate,
    lastUpdatedDate,
  };

  const sections: PolicySection[] = [];

  // ==========================================================================
  // Section 1: Overview and Scope
  // ==========================================================================
  sections.push({
    id: "overview",
    title: "Overview and Scope",
    paragraphs: [
      `Thank you for purchasing our products or services at ${websiteUrl} or via ${appName}, operated by ${companyName} ("we", "us", or "our").`,
      `This Return and Refund Policy sets forth the terms and procedures under which purchases may be eligible for return, exchange, store credit, or refund. By making a purchase through our Services, you acknowledge that you have reviewed and agree to the policies described herein.`,
    ],
  });

  // ==========================================================================
  // Section 2: Return Eligibility Period & Stance
  // ==========================================================================
  let stanceTitle = "Return Eligibility Period";
  const stanceParagraphs: string[] = [];
  let stanceCallout: { type: "note" | "warning" | "legal"; title?: string; text: string } | undefined;

  switch (policyType) {
    case "noRefunds":
      stanceTitle = "All Sales Final / No Refunds Policy";
      stanceParagraphs.push(
        `All purchases made on ${websiteUrl} are final, non-refundable, and non-exchangeable. We do not provide refunds, store credits, or product replacements for change-of-mind purchases or unutilized service periods.`,
        `Statutory Exception: If an item arrives damaged, defective, or incorrect, you must notify us within ${damagedItemWindow} of delivery to request an authorized replacement or statutory remedy as required by applicable consumer protection laws.`
      );
      stanceCallout = {
        type: "warning",
        title: "All Sales Final",
        text: "Except where prohibited by mandatory statutory law, all sales are strictly final. Please review product specifications carefully before completing checkout.",
      };
      break;

    case "storeCreditOnly":
      stanceTitle = "Store Credit and Exchange Only Policy";
      stanceParagraphs.push(
        `We offer a ${returnWindowDays}-day return window from the date of confirmed delivery. However, we do not issue cash or original payment method refunds. All eligible returns will be reimbursed exclusively in the form of non-expiring store credit or merchandise exchanges.`,
        `Store credit balances may be applied to any future purchase on ${websiteUrl}.`
      );
      stanceCallout = {
        type: "note",
        title: "Store Credit Only",
        text: `Returns initiated within ${returnWindowDays} days of receipt are reimbursed as store credit only. Cash refunds are not available.`,
      };
      break;

    case "conditionalRefunds":
      stanceTitle = "Conditional Refund Policy";
      stanceParagraphs.push(
        `Refunds are granted strictly under specific qualifying conditions, such as verified product defect, shipping carrier loss, failure of software functionality against documented specifications, or breach of service level agreements (SLAs).`,
        `Requests for conditional refunds must be submitted in writing within ${returnWindowDays} calendar days of purchase, accompanied by verifiable proof of defect.`
      );
      stanceCallout = {
        type: "warning",
        title: "Conditional Review Required",
        text: "Refunds are evaluated on a case-by-case basis and require technical verification before authorization.",
      };
      break;

    case "standardReturns":
    default:
      stanceTitle = "Standard Return Window";
      stanceParagraphs.push(
        `We want you to be completely satisfied with your purchase. You are entitled to cancel your order and return eligible items within ${returnWindowDays} calendar days from the date of confirmed delivery or digital entitlement.`,
        `To qualify for a refund, returned items must comply with the condition requirements and procedural steps set forth below.`
      );
      stanceCallout = {
        type: "legal",
        title: `${returnWindowDays}-Day Satisfaction Guarantee`,
        text: `Eligible items may be returned within ${returnWindowDays} days of delivery for a full refund to your original payment method.`,
      };
      break;
  }

  sections.push({
    id: "return-window-stance",
    title: stanceTitle,
    paragraphs: stanceParagraphs,
    callout: stanceCallout,
  });

  // ==========================================================================
  // Section 3: Physical Item Condition Requirements
  // ==========================================================================
  const productTypes = Array.isArray(opts.productTypes) && opts.productTypes.length > 0
    ? opts.productTypes
    : [opts.productType === "digital" ? "digitalDownloads" : (opts.productType === "saas" ? "saasSubscriptions" : "physicalGoods")];

  const hasPhysical = productTypes.includes("physicalGoods");

  if (hasPhysical) {
    sections.push({
      id: "physical-item-conditions",
      title: "Physical Item Condition Requirements",
      paragraphs: [
        "To ensure that returned physical merchandise can be processed and restocked, items must satisfy the following condition criteria upon arrival at our fulfillment center:",
      ],
      bulletPoints: [
        "Items must be in original, unused, unwashed, and undamaged condition.",
        "Items must be enclosed in their original manufacturer packaging, including all inner protective wrapping, manuals, cables, and accessories.",
        "All original manufacturer product tags, security seals, and warranty stickers must remain intact and unbroken.",
        "A valid invoice, proof of purchase, or order confirmation number must accompany the package.",
        "Items must carry an approved Return Merchandise Authorization (RMA) number clearly written on the outer shipping carton.",
      ],
    });
  }

  // ==========================================================================
  // Section 4: Non-Returnable and Non-Refundable Items
  // ==========================================================================
  const nonReturnableItems = Array.isArray(opts.nonRefundableItems) && opts.nonRefundableItems.length > 0
    ? opts.nonRefundableItems
    : [
        "Gift cards, promotional vouchers, and store credit coupons.",
        "Downloadable software licenses, license keys, and digital tokens that have been exposed or downloaded.",
        "Custom-made, personalized, or engraved merchandise.",
        "Perishable goods (such as food, beverages, flowers, or supplements).",
        "Intimate apparel, swimwear, or hygiene products where protective seals have been removed.",
        "Final sale or clearance merchandise marked 'Non-Refundable' at time of purchase.",
      ];

  sections.push({
    id: "non-returnable-items",
    title: "Non-Returnable and Exempt Items",
    paragraphs: [
      "The following categories of merchandise are strictly non-returnable and non-refundable, except where statutory consumer law provides otherwise:",
    ],
    bulletPoints: nonReturnableItems,
  });

  // ==========================================================================
  // Section 5: Digital Downloads & SaaS Subscriptions
  // ==========================================================================
  const hasDigital = productTypes.includes("digitalDownloads");
  const hasSaas = productTypes.includes("saasSubscriptions");

  if (hasDigital || hasSaas) {
    const digitalSubsections: PolicySubsection[] = [];

    if (hasDigital) {
      digitalSubsections.push({
        id: "digital-downloads",
        title: "Digital Products and Software Downloads",
        paragraphs: [
          `Due to the immediate delivery and intangible nature of digital goods (such as software, electronic books, source code, and design assets), sales of digital downloads are generally non-refundable once the download link or license key has been generated.`,
          `STATUTORY EUROPEAN RIGHT OF WITHDRAWAL WAIVER: In accordance with Article 16(m) of the EU Consumer Rights Directive (Directive 2011/83/EU), by initiating the download or access of digital content, you expressly consent to immediate performance of the contract and acknowledge that you thereby waive your statutory 14-day right of withdrawal.`,
        ],
      });
    }

    if (hasSaas) {
      const saasRuleText = opts.saasRefundRule === "trialFullRefund"
        ? "We provide a 14-day money-back guarantee for first-time subscribers. If you are unsatisfied during the first 14 days of your initial paid subscription, you may request a 100% full refund."
        : "You may cancel your recurring SaaS subscription at any time via your account billing settings. Cancellation prevents future billing charges, and you will maintain full access to the subscription features until the end of your current paid billing period. We do not provide prorated refunds for mid-billing cycle cancellations.";

      digitalSubsections.push({
        id: "saas-subscriptions",
        title: "SaaS Subscriptions and Cloud Services",
        paragraphs: [
          saasRuleText,
          `To cancel your active subscription, navigate to your account dashboard under "Billing & Plans" or email ${contactEmail}.`,
        ],
      });
    }

    sections.push({
      id: "digital-and-saas",
      title: "Digital Products and Subscription Services",
      subsections: digitalSubsections,
    });
  }

  // ==========================================================================
  // Section 6: Mobile In-App Purchases
  // ==========================================================================
  sections.push({
    id: "mobile-in-app-purchases",
    title: "Mobile and In-App Purchases",
    paragraphs: [
      `If you made a purchase or subscription through a mobile app marketplace (such as the Apple App Store or Google Play Store), the transaction was processed directly by the marketplace platform operator.`,
      `Due to platform privacy policies, ${companyName} does not possess technical authority to disburse refunds for App Store or Google Play transactions directly. You must submit refund requests directly through the appropriate marketplace:`,
    ],
    bulletPoints: [
      "Apple App Store: Request a refund via Apple's official portal at https://reportaproblem.apple.com.",
      "Google Play Store: Request a refund via Google Play support at https://support.google.com/googleplay/workflow/9813244.",
    ],
  });

  // ==========================================================================
  // Section 7: Step-by-Step Return Process (RMA)
  // ==========================================================================
  sections.push({
    id: "return-process",
    title: "Step-by-Step Return Process (RMA)",
    paragraphs: [
      `To return an eligible item, please follow this mandatory step-by-step Return Merchandise Authorization (RMA) workflow:`,
    ],
    bulletPoints: [
      `Step 1 — Request an RMA: Contact our customer care team at ${contactEmail} with your order number, item description, and reason for return.`,
      "Step 2 — Receive Instructions: Upon verification of eligibility, our team will furnish a formal RMA number and specific return packaging guidelines.",
      "Step 3 — Secure Packaging: Safely pack the merchandise in its original packaging with all documentation, and clearly write the RMA number on the exterior shipping label.",
      `Step 4 — Ship the Item: Dispatch the package via a trackable and insured shipping courier to our returns facility: ${physicalAddress}.`,
    ],
    callout: {
      type: "note",
      title: "RMA Requirement",
      text: "Packages returned without an approved RMA number clearly displayed may experience extended processing delays or be returned to sender.",
    },
  });

  // ==========================================================================
  // Section 8: Return Shipping Costs & Restocking Fees
  // ==========================================================================
  let shippingClause = "You will be responsible for paying your own shipping costs for returning your item. Return shipping costs are non-refundable. We strongly recommend utilizing a trackable shipping service and purchasing shipping insurance, as we cannot guarantee receipt of returned items.";
  if (opts.shippingFeePayer === "company") {
    shippingClause = "We will provide a prepaid return shipping label via email once your RMA request is approved. Return shipping is completely free for all authorized domestic returns.";
  } else if (opts.shippingFeePayer === "customerUnlessDefective") {
    shippingClause = "You are responsible for return shipping costs on discretionary returns. However, if the return is the result of our error (such as receiving a damaged, defective, or incorrect item), we will furnish a complimentary prepaid return shipping label.";
  }

  const restockingText = opts.restockingFee && opts.restockingFee !== "none"
    ? `A restocking fee of ${opts.restockingFee === "10percent" ? "10%" : (opts.restockingFee === "15percent" ? "15%" : "$10.00 USD")} will be deducted from your final refund amount to cover warehouse inspection and repackaging.`
    : "We do not charge any restocking fees for authorized returns.";

  sections.push({
    id: "shipping-and-fees",
    title: "Return Shipping Costs and Restocking Fees",
    paragraphs: [shippingClause, restockingText],
  });

  // ==========================================================================
  // Section 9: Inspection and Refund Disbursement
  // ==========================================================================
  sections.push({
    id: "inspection-and-refund",
    title: "Inspection and Refund Disbursement",
    paragraphs: [
      `Once your return is received and inspected at our warehouse (${inspectionDays}), we will send you an email notification confirming receipt and informing you whether your refund has been approved or rejected.`,
      `If approved, your refund will be processed immediately. A credit will automatically be applied to your original credit card or original payment method within ${processingDays}. Please note that individual banking institutions and credit card providers may require additional processing time to reflect the funds on your statement.`,
    ],
  });

  // ==========================================================================
  // Section 10: Damaged, Defective, or Incorrect Deliveries
  // ==========================================================================
  sections.push({
    id: "damaged-defective-items",
    title: "Damaged, Defective, or Incorrect Deliveries",
    paragraphs: [
      `If you receive merchandise that is defective, damaged in transit, or different from what you ordered, please contact us at ${contactEmail} ${damagedItemWindow} accompanied by clear photographic evidence of the item and shipping carton.`,
      `Upon verification, we will promptly dispatch a replacement item at zero additional cost to you, or provide a 100% full refund including all original shipping and handling charges.`,
    ],
  });

  // ==========================================================================
  // Section 11: Statutory Consumer Rights Non-Waiver
  // ==========================================================================
  sections.push({
    id: "statutory-rights",
    title: "Statutory European and UK Consumer Rights",
    paragraphs: [
      `Nothing in this commercial Return and Refund Policy is intended to limit, modify, or exclude your statutory consumer rights under the European Union Consumer Rights Directive (Directive 2011/83/EU), the United Kingdom Consumer Rights Act 2015, or any applicable state consumer warranty laws.`,
      `If you are an EU or UK consumer, you retain a statutory right to reject faulty goods within 30 days for a full refund, and a statutory right to repair or replacement for goods that develop a manufacturing fault within the legal warranty guarantee period (typically two years in the EU).`,
    ],
  });

  // ==========================================================================
  // Section 12: Contact and Return Inquiries
  // ==========================================================================
  sections.push({
    id: "contact-information",
    title: "Contact and Return Authorization Inquiries",
    paragraphs: [
      `If you have questions concerning this Return and Refund Policy or wish to initiate an RMA request, please reach out to our billing team:`,
    ],
    bulletPoints: [
      `Company: ${companyName}`,
      `Application: ${appName}`,
      `Returns & Billing Email: ${contactEmail}`,
      `Website: ${websiteUrl}`,
      `Physical Returns Center: ${physicalAddress}`,
    ],
  });

  return {
    id: "refund-policy",
    title: "Return and Refund Policy",
    metadata,
    sections,
  };
}
