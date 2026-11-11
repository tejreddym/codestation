// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import PolicyGeneratorsStation from "./PolicyGeneratorsStation";

afterEach(cleanup);

describe("PolicyGeneratorsStation Component", () => {
  it("renders Privacy Policy Generator with form controls, navigation, and live preview", () => {
    render(<PolicyGeneratorsStation toolId="privacy-policy-generator" />);
    expect(screen.getByRole("heading", { name: "Privacy Policy Generator", level: 1 })).toBeDefined();
    expect(screen.getByLabelText(/Entity \/ Company Name/i)).toBeDefined();
    expect(screen.getByLabelText(/GDPR Disclosures/i)).toBeDefined();
    expect(screen.getByRole("tab", { name: /Preview/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /markdown/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /html/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /text/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /json/i })).toBeDefined();
  });

  it("renders Terms and Conditions Generator with dispute resolution and user account controls", () => {
    render(<PolicyGeneratorsStation toolId="terms-and-conditions-generator" />);
    expect(screen.getByRole("heading", { name: "Terms and Conditions Generator", level: 1 })).toBeDefined();
    expect(screen.getByLabelText(/Dispute Resolution Forum/i)).toBeDefined();
    expect(screen.getByLabelText(/User Account Registration/i)).toBeDefined();
    expect(screen.getByLabelText(/DMCA Safe Harbor Notice/i)).toBeDefined();
  });

  it("renders Cookie Policy Generator with 4-pillar classification toggles", () => {
    render(<PolicyGeneratorsStation toolId="cookie-policy-generator" />);
    expect(screen.getByRole("heading", { name: "Cookie Policy Generator", level: 1 })).toBeDefined();
    expect(screen.getByLabelText(/Essential Cookies/i)).toBeDefined();
    expect(screen.getByLabelText(/Analytics & Performance/i)).toBeDefined();
    expect(screen.getByLabelText(/Functional Preferences/i)).toBeDefined();
    expect(screen.getByLabelText(/Targeted Advertising/i)).toBeDefined();
  });

  it("renders Disclaimer Generator with advice exclusion checkboxes", () => {
    render(<PolicyGeneratorsStation toolId="disclaimer-generator" />);
    expect(screen.getByRole("heading", { name: "Legal & Professional Disclaimer Generator", level: 1 })).toBeDefined();
    expect(screen.getByLabelText(/Legal Advice Disclaimer/i)).toBeDefined();
    expect(screen.getByLabelText(/Financial Advice Disclaimer/i)).toBeDefined();
    expect(screen.getByLabelText(/Medical \/ Health Disclaimer/i)).toBeDefined();
    expect(screen.getByLabelText(/FTC Affiliate Disclosure/i)).toBeDefined();
  });

  it("renders Refund Policy Generator with stance options and return days", () => {
    render(<PolicyGeneratorsStation toolId="refund-policy-generator" />);
    expect(screen.getByRole("heading", { name: "Refund & Cancellation Policy Generator", level: 1 })).toBeDefined();
    expect(screen.getByLabelText(/Policy Stance/i)).toBeDefined();
    expect(screen.getByLabelText(/Return Window \(Days\)/i)).toBeDefined();
    expect(screen.getByLabelText(/Return Shipping Costs/i)).toBeDefined();
  });

  it("switches format tabs and updates displayed output", () => {
    render(<PolicyGeneratorsStation toolId="privacy-policy-generator" />);

    // Switch to Markdown tab
    const mdTab = screen.getByRole("tab", { name: /markdown/i });
    fireEvent.click(mdTab);
    expect(screen.getByText(/# Privacy Policy/i)).toBeDefined();

    // Switch to Plain Text tab
    const textTab = screen.getByRole("tab", { name: /text/i });
    fireEvent.click(textTab);
    expect(screen.getByText(/1\. INTRODUCTION AND SCOPE/i)).toBeDefined();

    // Switch to JSON tab
    const jsonTab = screen.getByRole("tab", { name: /json/i });
    fireEvent.click(jsonTab);
    expect(screen.getByText(/"privacy-policy-generator"/i)).toBeDefined();
  });

  it("switches industry presets dynamically", () => {
    render(<PolicyGeneratorsStation toolId="privacy-policy-generator" />);
    const presetSelect = screen.getByLabelText(/Preset Profile:/i);

    fireEvent.change(presetSelect, { target: { value: "ecommerce" } });
    expect((screen.getByLabelText(/Entity \/ Company Name/i) as HTMLInputElement).value).toBe(
      "Artisan Goods Co."
    );

    fireEvent.change(presetSelect, { target: { value: "blog" } });
    expect((screen.getByLabelText(/Entity \/ Company Name/i) as HTMLInputElement).value).toBe(
      "TechDispatch Media LLC"
    );
  });

  it("copies to clipboard with feedback", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<PolicyGeneratorsStation toolId="privacy-policy-generator" />);
    const copyBtn = screen.getByLabelText(/Copy policy text to clipboard/i);
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalled();
    expect(await screen.findByText("Copied!")).toBeDefined();
  });
});
