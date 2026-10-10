import { describe, it, expect } from "vitest";
import {
  formatWifiPayload,
  formatUpiPayload,
  formatVCardPayload,
  generateQrCodeSvg,
  generateQrCodeDataUrl,
} from "./engine";

describe("QR & Barcode Engine", () => {
  it("formats WiFi credentials correctly", () => {
    const payload = formatWifiPayload({
      ssid: "CodeStationOffice",
      password: "secretPassword123",
      encryption: "WPA",
    });
    expect(payload).toBe("WIFI:S:CodeStationOffice;T:WPA;P:secretPassword123;;");
  });

  it("formats UPI payment payload correctly", () => {
    const payload = formatUpiPayload({
      vpa: "codestation@upi",
      name: "Code Station",
      amount: "199",
      note: "Monthly Pro",
    });
    expect(payload).toContain("pa=codestation%40upi");
    expect(payload).toContain("am=199.00");
    expect(payload).toContain("cu=INR");
  });

  it("formats vCard 3.0 payload correctly", () => {
    const payload = formatVCardPayload({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+1234567890",
      company: "Tech Corp",
    });
    expect(payload).toContain("BEGIN:VCARD");
    expect(payload).toContain("FN:Jane Doe");
    expect(payload).toContain("EMAIL;TYPE=INTERNET:jane@example.com");
    expect(payload).toContain("END:VCARD");
  });

  it("generates QR code SVG string", async () => {
    const svg = await generateQrCodeSvg("https://codestation.in", {
      color: { dark: "#151713", light: "#d9f975" },
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("#151713");
  });

  it("generates QR code Data URL", async () => {
    const dataUrl = await generateQrCodeDataUrl("https://codestation.in");
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
