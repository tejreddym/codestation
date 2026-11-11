/**
 * Disclaimer Generator Engine
 * Professional advice disclaimers, FTC affiliate disclosures, Amazon Associates clause, and UCC warranty exclusions.
 * Code Station — Browser-Native Developer Tools
 */

import { cleanStr } from "../serializers";
import {
  DisclaimerOptions,
  PolicyDocument,
  PolicyMetadata,
  PolicySection,
  PolicySubsection,
} from "../types";

export function generateDisclaimer(
  rawOptions: Record<string, unknown> = {}
): PolicyDocument {
  const opts = rawOptions as DisclaimerOptions;

  const today = new Date().toISOString().split("T")[0];
  const companyName = cleanStr(opts.companyName, "[Company Name]");
  const appName = cleanStr(opts.appName, opts.companyName ? String(opts.companyName) : "[Application Name]");
  const websiteUrl = cleanStr(opts.websiteUrl, "[https://example.com]");
  const contactEmail = cleanStr(opts.contactEmail, "[legal@example.com]");
  const physicalAddress = cleanStr(opts.physicalAddress, "[Company Address]");
  const effectiveDate = cleanStr(opts.effectiveDate, today);
  const lastUpdatedDate = cleanStr(opts.lastUpdatedDate, effectiveDate);

  const metadata: PolicyMetadata = {
    toolId: "disclaimer-generator",
    title: "Disclaimer",
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
  // Section 1: General Informational Disclaimer
  // ==========================================================================
  sections.push({
    id: "general-disclaimer",
    title: "General Informational Disclaimer",
    paragraphs: [
      `The information provided by ${companyName} ("we", "us", or "our") on ${websiteUrl} and via ${appName} (collectively, the "Services") is for general informational and educational purposes only.`,
      `All information on the Services is provided in good faith; however, we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the Services.`,
    ],
  });

  // ==========================================================================
  // Section 2: Assumption of Risk ("Use at Your Own Risk")
  // ==========================================================================
  sections.push({
    id: "risk-assumption",
    title: "Assumption of Risk ('Use at Your Own Risk')",
    paragraphs: [
      `Your use of the Services and your reliance on any information, tools, code, data, or documents provided through the Services is solely at your own risk.`,
    ],
    callout: {
      type: "warning",
      title: "Notice: Assumption of Risk",
      text: `UNDER NO CIRCUMSTANCES SHALL ${companyName.toUpperCase()} HAVE ANY LIABILITY TO YOU FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF THE SERVICES OR RELIANCE ON ANY INFORMATION PROVIDED ON THE SERVICES. YOUR USE OF THE SERVICES AND YOUR RELIANCE ON ANY INFORMATION IS SOLELY AT YOUR OWN RISK.`,
    },
  });

  // ==========================================================================
  // Section 3: Professional Advice Disclaimers
  // ==========================================================================
  const activeDisclaimers = Array.isArray(opts.disclaimerTypes)
    ? opts.disclaimerTypes
    : (Array.isArray(opts.professionalDisclaimers) ? opts.professionalDisclaimers : []);

  const profSubsections: PolicySubsection[] = [];

  if (activeDisclaimers.includes("legal")) {
    profSubsections.push({
      id: "legal-advice-disclaimer",
      title: "Legal Advice Disclaimer",
      paragraphs: [
        `The Services cannot and do not contain formal legal advice. Legal information, contract templates, and automated policy documents are provided for general educational purposes only and are not a substitute for professional legal advice.`,
        `Accordingly, before taking any actions based upon such information, we encourage you to consult with licensed legal professionals in your jurisdiction. The use or reliance of any information contained on the Services does not create an attorney-client relationship between you and ${companyName}.`,
      ],
      callout: {
        type: "legal",
        title: "No Attorney-Client Relationship",
        text: "Accessing this website or generating policy documents does not create an attorney-client privilege or legal representation relationship. Always have legal documents reviewed by licensed counsel.",
      },
    });
  }

  if (activeDisclaimers.includes("financial") || activeDisclaimers.includes("tax")) {
    profSubsections.push({
      id: "financial-tax-disclaimer",
      title: "Financial and Investment Advice Disclaimer",
      paragraphs: [
        `The Services cannot and do not contain investment, financial, trading, or tax advice. Financial information and calculators are provided for general informational purposes only and are not a substitute for professional financial advice.`,
        `We are not registered investment advisers, broker-dealers, or financial analysts. Past performance is no guarantee of future returns. Investing in securities, cryptocurrencies, or digital assets involves substantial risk of loss, including the possible loss of principal. Consult a certified financial planner or CPA prior to making investment decisions.`,
      ],
    });
  }

  if (activeDisclaimers.includes("medical")) {
    profSubsections.push({
      id: "medical-advice-disclaimer",
      title: "Medical and Healthcare Advice Disclaimer",
      paragraphs: [
        `The Services cannot and do not contain medical or healthcare advice. The health, wellness, and medical information is provided for general informational and educational purposes only and is not a substitute for professional advice.`,
        `Accordingly, before taking any actions based upon such information, we encourage you to consult with appropriate medical professionals. We do not provide any kind of medical advice. THE STATEMENTS ON THIS WEBSITE HAVE NOT BEEN EVALUATED BY THE FOOD AND DRUG ADMINISTRATION (FDA) OR ANY OTHER REGULATORY AUTHORITY. THEY ARE NOT INTENDED TO DIAGNOSE, TREAT, CURE, OR PREVENT ANY DISEASE OR HEALTH CONDITION.`,
      ],
      callout: {
        type: "warning",
        title: "Medical Emergencies",
        text: "IF YOU THINK YOU MAY HAVE A MEDICAL EMERGENCY, CALL YOUR DOCTOR, GO TO THE EMERGENCY DEPARTMENT, OR CALL 911 (OR YOUR LOCAL EMERGENCY NUMBER) IMMEDIATELY.",
      },
    });
  }

  if (activeDisclaimers.includes("fitness")) {
    profSubsections.push({
      id: "fitness-nutritional-disclaimer",
      title: "Fitness and Nutritional Disclaimer",
      paragraphs: [
        `The Services may offer health, fitness, workout, and nutritional information and is designed for educational purposes only. You should not rely on this information as a substitute for, nor does it replace, professional medical advice, diagnosis, or treatment.`,
        `Physical exercise, fitness routines, and nutritional changes carry inherent risk of bodily injury or physiological strain. Consult your physician before starting any new fitness program. By participating in these exercises or fitness activities, you represent that you are in good physical health and voluntarily assume all risks of injury.`,
      ],
    });
  }

  if (profSubsections.length > 0) {
    sections.push({
      id: "professional-disclaimers",
      title: "Professional Advice Disclaimers",
      paragraphs: [
        `Depending on the subject matter discussed, specific professional disclaimers apply:`,
      ],
      subsections: profSubsections,
    });
  }

  // ==========================================================================
  // Section 4: External Links Disclaimer
  // ==========================================================================
  if (opts.includeExternalLinks !== false && opts.externalLinks !== false) {
    sections.push({
      id: "external-links",
      title: "External Links Disclaimer",
      paragraphs: [
        `The Services may contain (or you may be sent through the Services to) links to other websites or content belonging to or originating from third parties or links to websites and features in banners or other advertising. Such external links are not investigated, monitored, or checked for accuracy, adequacy, validity, reliability, availability, or completeness by us.`,
        `WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR THE ACCURACY OR RELIABILITY OF ANY INFORMATION OFFERED BY THIRD-PARTY WEBSITES LINKED THROUGH THE SITE OR ANY WEBSITE OR FEATURE LINKED IN ANY BANNER OR OTHER ADVERTISING. WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY TRANSACTION BETWEEN YOU AND THIRD-PARTY PROVIDERS OF PRODUCTS OR SERVICES.`,
      ],
    });
  }

  // ==========================================================================
  // Section 5: FTC Affiliate Marketing & Sponsored Content Disclosure
  // ==========================================================================
  const hasAffiliate = opts.hasAffiliateLinks === true || opts.affiliateLinks === true || opts.isAmazonAssociate === true;
  const isAmazon = opts.isAmazonAssociate === true;
  const hasSponsored = opts.hasSponsoredContent === true || opts.sponsoredPosts === true;

  if (hasAffiliate || hasSponsored) {
    const affiliateParagraphs: string[] = [
      `In compliance with the Federal Trade Commission (FTC) guidelines concerning the use of endorsements and testimonials in advertising (16 CFR Part 255), please be advised that our Services may engage in affiliate marketing and may contain affiliate links.`,
    ];

    if (hasAffiliate) {
      affiliateParagraphs.push(
        `This means that if you click on an affiliate link and make a purchase, ${companyName} may receive an affiliate commission at no additional cost to you. We only recommend products or services that we believe add genuine value to our users.`
      );
    }

    if (isAmazon) {
      affiliateParagraphs.push(
        `AMAZON ASSOCIATES DISCLOSURE: ${companyName} is a participant in the Amazon Services LLC Associates Program, an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com. As an Amazon Associate I earn from qualifying purchases.`
      );
    }

    if (hasSponsored) {
      affiliateParagraphs.push(
        `From time to time, we may publish sponsored posts, reviews, or partner content. Any sponsored content is explicitly identified as such. The views and opinions expressed in sponsored articles are purely those of the authors and do not influence our editorial integrity.`
      );
    }

    sections.push({
      id: "affiliate-disclosure",
      title: "Affiliate Marketing and Sponsored Content Disclosure",
      paragraphs: affiliateParagraphs,
      callout: isAmazon
        ? {
            type: "legal",
            title: "FTC Affiliate Notice",
            text: "As an Amazon Associate I earn from qualifying purchases.",
          }
        : undefined,
    });
  }

  // ==========================================================================
  // Section 6: Testimonials & Results Disclaimer
  // ==========================================================================
  if (opts.includeTestimonials === true || opts.testimonials === true) {
    sections.push({
      id: "testimonials-disclaimer",
      title: "Testimonials and Results Disclaimer",
      paragraphs: [
        `The Services may contain testimonials, reviews, or case studies by users of our products and services. These testimonials reflect the real-life experiences and opinions of such users. However, the experiences are personal to those particular users and may not necessarily be representative of all users of our products and services.`,
        `WE DO NOT CLAIM, AND YOU SHOULD NOT ASSUME, THAT ALL USERS WILL EXPERIENCE THE SAME RESULTS. YOUR INDIVIDUAL RESULTS MAY VARY SIGNIFICANTLY.`,
      ],
    });
  }

  // ==========================================================================
  // Section 7: Errors and Omissions Disclaimer
  // ==========================================================================
  if (opts.includeErrorsAndOmissions !== false && opts.errorsAndOmissions !== false) {
    sections.push({
      id: "errors-and-omissions",
      title: "Errors and Omissions Disclaimer",
      paragraphs: [
        `While we have made every attempt to ensure that the information contained in this site has been obtained from reliable sources, ${companyName} is not responsible for any errors or omissions, or for the results obtained from the use of this information. All information in this site is provided "as is", with no guarantee of completeness, accuracy, timeliness, or of the results obtained from the use of this information.`,
        `Information on the Services may contain technical inaccuracies, typographical errors, or out-of-date content. We reserve the right to modify or update any information at any time without prior notice.`,
      ],
    });
  }

  // ==========================================================================
  // Section 8: Disclaimer of Warranties and Limitation of Liability
  // ==========================================================================
  if (opts.includeWarrantyLimitation !== false && opts.warrantyExclusion !== false) {
    sections.push({
      id: "warranty-exclusion",
      title: "Disclaimer of Warranties and Limitation of Liability",
      paragraphs: [
        `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, ALL MATERIALS, TOOLS, SOFTWARE, AND INFORMATION ON THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.`,
        `IN NO EVENT SHALL ${companyName.toUpperCase()}, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR ACCESS TO, USE OF, OR INABILITY TO USE THE SERVICES.`,
      ],
      callout: {
        type: "legal",
        title: "UCC § 2-316 Disclaimer of Warranties",
        text: `ALL GOODS, SERVICES, AND SOFTWARE ARE PROVIDED WITHOUT WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.`,
      },
    });
  }

  // ==========================================================================
  // Section 9: Contact Information
  // ==========================================================================
  sections.push({
    id: "contact-information",
    title: "Contact Information",
    paragraphs: [
      `Should you have any feedback, comments, requests for technical support, or other inquiries regarding this Disclaimer, please contact us:`,
    ],
    bulletPoints: [
      `Company: ${companyName}`,
      `Application: ${appName}`,
      `Website: ${websiteUrl}`,
      `Email: ${contactEmail}`,
      physicalAddress !== "[Company Address]" ? `Address: ${physicalAddress}` : `Address: Available upon formal inquiry`,
    ],
  });

  return {
    id: "disclaimer",
    title: "Disclaimer",
    metadata,
    sections,
  };
}
