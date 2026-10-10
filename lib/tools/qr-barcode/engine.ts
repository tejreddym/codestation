import QRCode from "qrcode";
import jsQR from "jsqr";

export type QrErrorCorrection = "L" | "M" | "Q" | "H";

export interface QrOptions {
  errorCorrectionLevel?: QrErrorCorrection;
  margin?: number;
  width?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

export interface WifiQrConfig {
  ssid: string;
  password?: string;
  encryption?: "WPA" | "WEP" | "nopass";
  hidden?: boolean;
}

export interface UpiQrConfig {
  vpa: string;
  name?: string;
  amount?: string | number;
  note?: string;
}

export interface VCardConfig {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  website?: string;
}

/**
 * Formats standard WiFi connection payload.
 */
export function formatWifiPayload(config: WifiQrConfig): string {
  const enc = config.encryption || "WPA";
  const pass = config.password ? `;P:${config.password}` : "";
  const hidden = config.hidden ? ";H:true" : "";
  return `WIFI:S:${config.ssid};T:${enc}${pass}${hidden};;`;
}

/**
 * Formats Indian UPI payment payload for instant scan-to-pay apps.
 */
export function formatUpiPayload(config: UpiQrConfig): string {
  const params = new URLSearchParams();
  params.set("pa", config.vpa.trim());
  if (config.name) params.set("pn", config.name.trim());
  if (config.amount && Number(config.amount) > 0) {
    params.set("am", Number(config.amount).toFixed(2));
  }
  if (config.note) params.set("tn", config.note.trim());
  params.set("cu", "INR");
  return `upi://pay?${params.toString()}`;
}

/**
 * Formats standard vCard 3.0 contact payload.
 */
export function formatVCardPayload(config: VCardConfig): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${config.name}`, `N:;${config.name};;;`];
  if (config.email) lines.push(`EMAIL;TYPE=INTERNET:${config.email}`);
  if (config.phone) lines.push(`TEL;TYPE=CELL:${config.phone}`);
  if (config.company) lines.push(`ORG:${config.company}`);
  if (config.title) lines.push(`TITLE:${config.title}`);
  if (config.website) lines.push(`URL:${config.website}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

/**
 * Generates an SVG string representation of a QR code.
 */
export async function generateQrCodeSvg(text: string, options: QrOptions = {}): Promise<string> {
  if (!text || !text.trim()) {
    throw new Error("Text is required to generate a QR code.");
  }
  return await QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: options.errorCorrectionLevel || "M",
    margin: options.margin ?? 4,
    width: options.width ?? 300,
    color: {
      dark: options.color?.dark || "#000000",
      light: options.color?.light || "#ffffff",
    },
  });
}

/**
 * Generates a PNG Data URL of a QR code.
 */
export async function generateQrCodeDataUrl(text: string, options: QrOptions = {}): Promise<string> {
  if (!text || !text.trim()) {
    throw new Error("Text is required to generate a QR code.");
  }
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: options.errorCorrectionLevel || "M",
    margin: options.margin ?? 4,
    width: options.width ?? 300,
    color: {
      dark: options.color?.dark || "#000000",
      light: options.color?.light || "#ffffff",
    },
  });
}

/**
 * Decodes a QR code from raw pixel ImageData.
 */
export function decodeQrCode(imageData: ImageData): { text: string } | null {
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  if (code && code.data) {
    return { text: code.data };
  }
  return null;
}
