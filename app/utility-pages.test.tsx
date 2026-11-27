// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import NotFound from "./not-found";
import GlobalRouteError from "./error";
import Loading from "./loading";
import ContactPage from "./contact/page";
import AccessibilityPage from "./accessibility/page";
import PrivacyPage from "./privacy/page";
import TermsPage from "./terms/page";
import LicensesPage from "./licenses/page";
import SiteFooter from "@/components/SiteFooter";
import { operatorMetadata, PENDING_OPERATOR_FIELDS } from "@/lib/legal/operator";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("utility, fallback, and operator-wired legal pages", () => {
  it("centralizes operator metadata and flags pending owner fields", () => {
    expect(operatorMetadata.supportEmail).toBe("hello@codestation.in");
    expect(operatorMetadata.securityEmail).toBe("security@codestation.in");
    expect(operatorMetadata.hasPendingFields).toBe(true);
    expect(PENDING_OPERATOR_FIELDS.length).toBeGreaterThan(0);
  });

  it("renders custom 404 page with /tools and station navigation links", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: /could not find/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse all tools" }).getAttribute("href")).toBe("/tools");
    expect(screen.getByRole("link", { name: "View all stations" }).getAttribute("href")).toBe("/#categories");
  });

  it("renders client error boundary with reset action and digest", () => {
    const reset = vi.fn();
    const err = Object.assign(new Error("boom"), { digest: "CS-DIGEST-123" });
    render(<GlobalRouteError error={err} reset={reset} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("CS-DIGEST-123")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders accessible loading boundary", () => {
    render(<Loading />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-busy")).toBe("true");
  });

  it("renders /contact, /accessibility, /privacy, /terms, and /licenses using centralized metadata", () => {
    for (const Page of [ContactPage, AccessibilityPage, PrivacyPage, TermsPage, LicensesPage]) {
      const { unmount } = render(<Page />);
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
      expect(document.body.textContent).toContain(operatorMetadata.supportEmail);
      unmount();
    }
  });

  it("exposes /contact, /accessibility, and /compare links in the shared footer", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Contact" }).getAttribute("href")).toBe("/contact");
    expect(screen.getByRole("link", { name: "Accessibility" }).getAttribute("href")).toBe("/accessibility");
    expect(screen.getByRole("link", { name: "Compare" }).getAttribute("href")).toBe("/compare");
  });

  it("renders /compare hub and versus pages with FAQPage JSON-LD when indexing is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codestation.in");
    vi.stubEnv("SITE_INDEXING", "index");
    vi.resetModules();

    const [
      { default: CompareHubPage },
      { default: CompareItToolsPage },
      { default: CompareCyberChefPage },
      { default: CompareDevToysPage },
    ] = await Promise.all([
      import("./compare/page"),
      import("./compare/it-tools/page"),
      import("./compare/cyberchef/page"),
      import("./compare/devtoys/page"),
    ]);

    for (const Page of [CompareHubPage, CompareItToolsPage, CompareCyberChefPage, CompareDevToysPage]) {
      const { container, unmount } = render(<Page />);
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
      const jsonLd = container.querySelector('script[type="application/ld+json"]');
      expect(jsonLd).not.toBeNull();
      expect(JSON.parse(jsonLd!.innerHTML)["@type"]).toBe("FAQPage");
      unmount();
    }
  });
});
