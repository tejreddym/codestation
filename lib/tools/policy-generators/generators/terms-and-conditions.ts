/**
 * Terms and Conditions Generator Engine
 * Enforceability, IP rights, DMCA, UCC warranty disclaimers, arbitration, and class action waiver.
 * Code Station — Browser-Native Developer Tools
 */

import { cleanPositiveNumber, cleanStr } from "../serializers";
import {
  PolicyDocument,
  PolicyMetadata,
  PolicySection,
  PolicySubsection,
  TermsAndConditionsOptions,
} from "../types";

export function generateTermsAndConditions(
  rawOptions: Record<string, unknown> = {}
): PolicyDocument {
  const opts = rawOptions as TermsAndConditionsOptions;

  const today = new Date().toISOString().split("T")[0];
  const companyName = cleanStr(opts.companyName, "[Company Name]");
  const appName = cleanStr(opts.appName, opts.companyName ? String(opts.companyName) : "[Application Name]");
  const websiteUrl = cleanStr(opts.websiteUrl, "[https://example.com]");
  const contactEmail = cleanStr(opts.contactEmail, "[legal@example.com]");
  const physicalAddress = cleanStr(opts.physicalAddress, "[Company Address]");
  const effectiveDate = cleanStr(opts.effectiveDate, today);
  const lastUpdatedDate = cleanStr(opts.lastUpdatedDate, effectiveDate);
  const minimumAge = cleanPositiveNumber(opts.minimumAge, 13);
  const governingCountry = cleanStr(opts.governingCountry, "United States");
  const governingStateOrCity = cleanStr(opts.governingStateOrCity, "State of Delaware");
  const serviceDescription = cleanStr(
    opts.serviceDescription,
    `software applications, digital tools, platform APIs, and web services operated via ${websiteUrl}`
  );

  const metadata: PolicyMetadata = {
    toolId: "terms-and-conditions-generator",
    title: "Terms and Conditions",
    companyName,
    appName,
    websiteUrl,
    contactEmail,
    physicalAddress,
    country: governingCountry,
    stateOrProvince: governingStateOrCity,
    effectiveDate,
    lastUpdatedDate,
  };

  const sections: PolicySection[] = [];

  // ==========================================================================
  // Section 1: Agreement to Terms
  // ==========================================================================
  sections.push({
    id: "agreement-to-terms",
    title: "Agreement to Terms",
    paragraphs: [
      `These Terms and Conditions ("Terms") constitute a legally binding contractual agreement made between you, whether personally or on behalf of an entity ("you" or "User"), and ${companyName} ("Company", "we", "us", or "our"), concerning your access to and use of ${websiteUrl} and ${appName}, including any associated media channels, APIs, and mobile services (collectively, the "Services").`,
      `By accessing, registering for, or using our Services, you agree that you have read, understood, and accept to be bound by all of these Terms. IF YOU DO NOT AGREE WITH ALL OF THESE TERMS, YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICES AND MUST DISCONTINUE USE IMMEDIATELY.`,
    ],
    callout: {
      type: "warning",
      title: "Mandatory Arbitration & Class Action Waiver Notice",
      text: "PLEASE BE ADVISED THAT SECTION 13 OF THESE TERMS CONTAINS A BINDING INDIVIDUAL ARBITRATION CLAUSE AND CLASS ACTION WAIVER. THEY GOVERN THE RESOLUTION OF DISPUTES BETWEEN YOU AND THE COMPANY AND SIGNIFICANTLY AFFECT YOUR LEGAL RIGHTS, INCLUDING WAIVING THE RIGHT TO SUE IN COURT OR PARTICIPATE IN A CLASS ACTION.",
    },
  });

  // ==========================================================================
  // Section 2: Eligibility and Legal Capacity
  // ==========================================================================
  sections.push({
    id: "eligibility",
    title: "Eligibility and Legal Capacity",
    paragraphs: [
      `The Services are intended solely for users who are at least ${minimumAge} years of age. By accessing or using the Services, you represent and warrant that you are at least ${minimumAge} years old and possess the legal authority and capacity to enter into these Terms.`,
      `If you are entering into these Terms on behalf of a company, partnership, or other corporate organization, you represent and warrant that you have full legal authority to bind that entity to these Terms, in which case the terms "you" and "User" shall refer to such entity.`,
    ],
  });

  // ==========================================================================
  // Section 3: User Accounts and Credential Security
  // ==========================================================================
  if (opts.hasUserAccounts !== false) {
    sections.push({
      id: "user-accounts",
      title: "User Accounts and Credential Security",
      paragraphs: [
        "To access certain features of the Services, you may be required to register for an account. You agree to provide accurate, current, and complete registration information and to promptly update such information as necessary.",
        "You are solely responsible for maintaining the confidentiality of your account credentials, passwords, and multi-factor authentication tokens. You accept full responsibility for all activities, transactions, and charges incurred under your account.",
        `You agree to notify ${companyName} immediately at ${contactEmail} upon discovering any unauthorized access, security compromise, or breach of your account credentials. We reserve the right to suspend, terminate, or reclaim any username or account that violates these Terms or infringes on third-party trademark rights.`,
      ],
    });
  }

  // ==========================================================================
  // Section 4: Acceptable Use Policy & Prohibited Activities
  // ==========================================================================
  const prohibitedList = Array.isArray(opts.prohibitedUses) && opts.prohibitedUses.length > 0
    ? opts.prohibitedUses
    : [
        "Engaging in any unlawful, fraudulent, defamatory, or deceptive practices.",
        "Systematically scraping, crawling, spidering, data mining, or harvesting content without our prior express written consent.",
        "Decompiling, disassembling, reverse engineering, or attempting to discover the source code of our software or algorithms.",
        "Circumventing, disabling, or interfering with security features, authentication tokens, rate limits, or access controls.",
        "Uploading, transmitting, or distributing viruses, worms, Trojan horses, spyware, or malicious code payloads.",
        "Launching denial-of-service (DoS/DDoS) attacks or imposing unreasonable loads on platform infrastructure.",
        "Impersonating another person, entity, employee, or representative of the Company.",
        "Using the Services to transmit unauthorized commercial advertising, promotional spam, or unsolicited bulk messaging.",
      ];

  sections.push({
    id: "acceptable-use",
    title: "Acceptable Use Policy and Prohibited Activities",
    paragraphs: [
      `You may not access or use the Services for any purpose other than that for which we make them available. As a condition of your license to use the Services, you covenant and agree that you will not:`,
    ],
    bulletPoints: prohibitedList,
  });

  // ==========================================================================
  // Section 5: Intellectual Property Rights
  // ==========================================================================
  sections.push({
    id: "intellectual-property",
    title: "Intellectual Property Rights and Proprietary Ownership",
    paragraphs: [
      `Unless otherwise indicated in writing, the Services, including all underlying source code, object code, databases, platform software, web applications, algorithms, user interface designs, audio, video, text, photographs, graphics, trademarks, service marks, and logos (collectively, the "Proprietary Content"), are owned exclusively by ${companyName} or licensed to us, and are protected by copyright, trademark, trade dress, and patent laws across domestic and international jurisdictions.`,
      `Subject to your continuous compliance with these Terms, ${companyName} grants you a limited, non-exclusive, non-transferable, non-sublicensable, revocable license to access and use the Services solely for your internal business operations or personal non-commercial use.`,
      `Any suggestions, feedback, enhancement requests, or recommendations you provide to us regarding the Services ("Feedback") shall become the sole and exclusive property of ${companyName}. We shall be entitled to the unrestricted use and dissemination of Feedback for any purpose without acknowledgment or compensation to you.`,
    ],
  });

  // ==========================================================================
  // Section 6: User-Generated Content & License Grant
  // ==========================================================================
  if (opts.hasUserContent !== false) {
    sections.push({
      id: "user-generated-content",
      title: "User-Generated Content and License Grant",
      paragraphs: [
        `You may have opportunities to create, upload, post, or submit text, comments, data, code snippets, or other materials ("User Content") through our Services. You retain all copyright and proprietary rights you hold in your User Content.`,
        `By posting or transmitting User Content to or through the Services, you grant to ${companyName} a worldwide, irrevocable, perpetual, non-exclusive, royalty-free, fully paid, transferable, and sublicensable license to host, store, cache, reproduce, modify, adapt, publish, translate, and distribute such User Content in connection with operating, providing, and improving the Services.`,
        `You represent and warrant that your User Content does not infringe, misappropriate, or violate any patent, copyright, trademark, trade secret, privacy, or moral rights of any third party. We reserve the absolute right, but assume no obligation, to pre-screen, monitor, edit, or remove any User Content at our sole discretion without notice.`,
      ],
    });
  }

  // ==========================================================================
  // Section 7: DMCA & Copyright Infringement Notice
  // ==========================================================================
  if (opts.includeDmca !== false) {
    const dmcaEmail = cleanStr(opts.dmcaAgentEmail, contactEmail);
    sections.push({
      id: "dmca-copyright",
      title: "Digital Millennium Copyright Act (DMCA) Notice & Policy",
      paragraphs: [
        `We respect the intellectual property rights of others. In accordance with the Digital Millennium Copyright Act (17 U.S.C. § 512), if you believe in good faith that any content hosted on our Services infringes your copyrighted work, you or your designated agent may submit a formal notification to our Designated Copyright Agent at ${dmcaEmail}.`,
        `Your written DMCA Takedown Notice must include the following statutory requirements:`,
      ],
      bulletPoints: [
        "A physical or electronic signature of a person authorized to act on behalf of the owner of the copyright interest.",
        "Identification of the copyrighted work claimed to have been infringed, or a representative list of works.",
        "Identification of the material claimed to be infringing, with specific URLs or sufficient detail to enable us to locate the material.",
        "Your contact information, including physical postal address, telephone number, and email address.",
        "A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.",
        "A statement made under penalty of perjury that the information in the notification is accurate and that you are authorized to act on behalf of the copyright owner.",
      ],
      subsections: [
        {
          id: "repeat-infringer-policy",
          title: "Repeat Infringer Policy",
          paragraphs: [
            "In appropriate circumstances, we will terminate the accounts of users who are repeat copyright infringers or who repeatedly infringe third-party intellectual property rights.",
          ],
        },
      ],
    });
  }

  // ==========================================================================
  // Section 8: Fees, Subscriptions & Renewals
  // ==========================================================================
  if (opts.hasSubscriptions) {
    sections.push({
      id: "billing-subscriptions",
      title: "Subscriptions, Fees, and Automatic Renewal",
      paragraphs: [
        "Certain tiers of our Services are offered on a recurring subscription basis. By purchasing a subscription, you agree to pay all applicable recurring subscription fees, taxes, and transaction charges in accordance with the billing terms in effect at the time of purchase.",
        "AUTOMATIC RENEWAL: Unless you cancel your subscription at least twenty-four (24) hours prior to the conclusion of your current billing period, your subscription will automatically renew for an additional billing interval (e.g., monthly or annually), and you authorize us to charge your payment method on file.",
        `You may cancel your subscription at any time via your account settings dashboard or by contacting support at ${contactEmail}. Cancellation takes effect at the end of the current paid billing cycle.`,
      ],
    });
  }

  // ==========================================================================
  // Section 9: Term and Termination
  // ==========================================================================
  sections.push({
    id: "term-and-termination",
    title: "Term and Termination",
    paragraphs: [
      "These Terms shall remain in full force and effect while you access or utilize the Services.",
      `WITHOUT LIMITING ANY OTHER PROVISION OF THESE TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES (INCLUDING BLOCKING CERTAIN IP ADDRESSES) TO ANY PERSON FOR ANY REASON, INCLUDING WITHOUT LIMITATION FOR BREACH OF ANY REPRESENTATION, WARRANTY, OR COVENANT CONTAINED IN THESE TERMS OR ANY APPLICABLE LAW.`,
      "Upon termination of your account or access rights, your right to use the Services immediately terminates. All provisions of these Terms which by their nature should survive termination shall survive, including intellectual property ownership, warranty disclaimers, indemnity, limitations of liability, and dispute resolution.",
    ],
  });

  // ==========================================================================
  // Section 10: Disclaimer of Warranties ("AS IS")
  // ==========================================================================
  sections.push({
    id: "warranty-disclaimer",
    title: "Disclaimer of Warranties ('AS IS')",
    paragraphs: [
      `THE SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE LAW, ${companyName.toUpperCase()} AND ITS DIRECTORS, OFFICERS, EMPLOYEES, AFFILIATES, AND AGENTS EXPRESSLY DISCLAIM ALL WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.`,
      `WE MAKE NO WARRANTY THAT THE SERVICES WILL MEET YOUR REQUIREMENTS, BE UNINTERRUPTED, TIMELY, SECURE, ACCURATE, FREE OF DEFECTS OR MALWARE, OR ERROR-FREE, OR THAT ANY ERRORS OR DEFECTS WILL BE CORRECTED.`,
    ],
    callout: {
      type: "legal",
      title: "Statutory Consumer Carve-Out",
      text: "SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF IMPLIED WARRANTIES OR LIMITATIONS ON STATUTORY CONSUMER RIGHTS, SO THE ABOVE EXCLUSIONS MAY NOT APPLY TO YOU IN CERTAIN REGIONS.",
    },
  });

  // ==========================================================================
  // Section 11: Limitation of Liability
  // ==========================================================================
  const liabilityCapAmount = cleanStr(opts.liabilityFixedAmount, "$100.00 USD");
  const liabilityCapText = opts.limitationOfLiabilityType === "total_fees_paid"
    ? `THE TOTAL AGGREGATE FEES ACTUALLY PAID BY YOU TO ${companyName.toUpperCase()} UNDER THESE TERMS IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM`
    : `THE GREATER OF THE FEES PAID BY YOU TO ${companyName.toUpperCase()} IN THE TWELVE (12) MONTHS PRIOR TO THE CLAIM OR ${liabilityCapAmount}`;

  sections.push({
    id: "limitation-of-liability",
    title: "Limitation of Liability",
    paragraphs: [
      `TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT SHALL ${companyName.toUpperCase()}, ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS, SUPPLIERS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF PROFITS, REVENUE, DATA, GOODWILL, WORK STOPPAGE, SYSTEM FAILURE, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH YOUR ACCESS TO, USE OF, OR INABILITY TO USE THE SERVICES.`,
      `IN NO EVENT SHALL THE TOTAL AGGREGATE LIABILITY OF ${companyName.toUpperCase()} TO YOU FOR ALL CLAIMS, LIABILITIES, LOSSES, AND CAUSES OF ACTION EXCEED ${liabilityCapText}.`,
      "THE LIMITATIONS IN THIS SECTION APPLY REGARDLESS OF THE LEGAL THEORY ASSERTED (TORT, CONTRACT, STRICT LIABILITY, OR OTHERWISE), EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES, AND EVEN IF ANY REMEDY FAILS OF ITS ESSENTIAL PURPOSE.",
    ],
  });

  // ==========================================================================
  // Section 12: Indemnification
  // ==========================================================================
  sections.push({
    id: "indemnification",
    title: "Indemnification",
    paragraphs: [
      `You agree to defend, indemnify, and hold harmless ${companyName}, its parent, subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees from and against any and all loss, damage, liability, claim, demand, action, or expense (including reasonable attorneys' fees and court costs) brought by any third party arising out of or related to:`,
    ],
    bulletPoints: [
      "Your access to or use of the Services.",
      "Your breach or violation of any provision of these Terms or applicable legal statutes.",
      "Your User Content or any infringement of third-party intellectual property or privacy rights.",
      "Any overt harmful act toward any other user of the Services with whom you connected via the Services.",
    ],
  });

  // ==========================================================================
  // Section 13: Dispute Resolution & Binding Arbitration
  // ==========================================================================
  const arbitrationProvider = cleanStr(opts.arbitrationProvider, "AAA");
  const optOutDays = cleanPositiveNumber(opts.arbitrationOptOutDays, 30);

  const subsections13: PolicySubsection[] = [
    {
      id: "informal-negotiation",
      title: "Mandatory Informal Negotiation Period",
      paragraphs: [
        `To expedite resolution and control the cost of any dispute, controversy, or claim arising out of or related to these Terms (each a "Dispute"), you and ${companyName} agree to first attempt to negotiate any Dispute informally for at least thirty (30) calendar days before initiating arbitration. Informal negotiations commence upon receipt of written notice from one party to the other.`,
      ],
    },
    {
      id: "binding-arbitration",
      title: "Binding Individual Arbitration",
      paragraphs: [
        `If a Dispute is not resolved through informal negotiations, it shall be finally and exclusively resolved by binding individual arbitration administered by the ${arbitrationProvider} under its Commercial Arbitration Rules and Consumer Due Process Protocol.`,
        `ARBITRATION MEANS THAT YOU WAIVE YOUR RIGHT TO A TRIAL BY JURY IN COURT. The arbitrator's award shall be final and binding, and judgment upon the award rendered by the arbitrator may be entered in any court having jurisdiction thereof.`,
      ],
    },
    {
      id: "class-action-waiver",
      title: "Class Action and Jury Trial Waiver",
      paragraphs: [
        `YOU AND ${companyName.toUpperCase()} AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, CONSOLIDATED, OR REPRESENTATIVE PROCEEDING. THE ARBITRATOR MAY NOT CONSOLIDATE MORE THAN ONE PERSON'S CLAIMS.`,
      ],
      callout: {
        type: "warning",
        title: "Class Action Waiver",
        text: "There shall be no right or authority for any dispute to be arbitrated or litigated on a class-action or representative basis.",
      },
    },
    {
      id: "arbitration-opt-out",
      title: `${optOutDays}-Day Right to Opt Out`,
      paragraphs: [
        `You have the right to opt out of the provisions of this Arbitration Agreement by sending written notice of your decision to opt out to ${contactEmail} within ${optOutDays} calendar days of first accepting these Terms. Your notice must include your name, account username, and an unequivocal statement that you wish to opt out of binding arbitration.`,
      ],
    },
  ];

  sections.push({
    id: "dispute-resolution",
    title: "Dispute Resolution and Binding Arbitration",
    paragraphs: [
      "Please read this section carefully as it limits the manner in which you can seek relief from us.",
    ],
    subsections: subsections13,
  });

  // ==========================================================================
  // Section 14: Governing Law and Venue
  // ==========================================================================
  sections.push({
    id: "governing-law",
    title: "Governing Law and Jurisdiction",
    paragraphs: [
      `These Terms and your use of the Services are governed by and construed in accordance with the substantive laws of the ${governingStateOrCity}, ${governingCountry}, without giving effect to any principles of conflicts of law.`,
      `To the extent that any lawsuit or court proceeding is permitted under these Terms (or if you successfully exercise your 30-day arbitration opt-out right), you and ${companyName} irrevocably consent and submit to the exclusive personal jurisdiction and venue of the state and federal courts located within the ${governingStateOrCity}, ${governingCountry}.`,
    ],
  });

  // ==========================================================================
  // Section 15: General Provisions
  // ==========================================================================
  sections.push({
    id: "general-provisions",
    title: "General Provisions",
    bulletPoints: [
      "Entire Agreement: These Terms and any policies posted by us on the Services constitute the entire agreement and understanding between you and us.",
      "Severability: If any provision of these Terms is determined to be unlawful, void, or unenforceable, that provision shall be deemed severable and shall not affect the validity and enforceability of remaining provisions.",
      "No Waiver: Our failure to exercise or enforce any right or provision of these Terms shall not operate as a waiver of such right or provision.",
      "Assignment: You may not assign or transfer your rights or obligations under these Terms without our prior written consent. We may assign our rights and obligations without restriction.",
      "Force Majeure: We shall not be liable for any delay or failure to perform resulting from causes outside our reasonable control, including acts of God, war, pandemic, terrorism, power outages, or telecommunications failures.",
    ],
  });

  // ==========================================================================
  // Section 16: Legal Contact Information
  // ==========================================================================
  sections.push({
    id: "contact-information",
    title: "Legal Inquiries and Contact Information",
    paragraphs: [
      `In order to resolve a complaint regarding the Services or to receive further information regarding use of the Services, please contact our legal counsel:`,
    ],
    bulletPoints: [
      `Company Name: ${companyName}`,
      `Application: ${appName}`,
      `Legal Notices Email: ${contactEmail}`,
      `Website: ${websiteUrl}`,
      physicalAddress !== "[Company Address]" ? `Physical Address: ${physicalAddress}` : `Address: Available upon formal inquiry`,
    ],
  });

  return {
    id: "terms-and-conditions",
    title: "Terms and Conditions",
    metadata,
    sections,
  };
}
