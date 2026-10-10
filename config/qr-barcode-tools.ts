import { localDefinition, type LocalField, type LocalDefinition } from "./local-contract";

export const qrBarcodeToolIds = [
  "qr-code-generator",
  "qr-code-reader",
  "barcode-generator",
  "signature-pad",
] as const;

export type QrBarcodeToolId = (typeof qrBarcodeToolIds)[number];

const notice =
  "Zero-server generation and scanning. All codes and signatures are processed completely within your browser canvas and Web APIs.";

const define = (
  id: QrBarcodeToolId,
  title: string,
  fields: LocalField[],
  outputs: string[],
  defaults: Record<string, unknown> = {},
  extra: string[] = []
): LocalDefinition<QrBarcodeToolId> =>
  localDefinition(id, title, "QR & Barcode", fields, outputs, defaults, [notice, ...extra], "Generate");

export const qrBarcodeTools: readonly LocalDefinition<QrBarcodeToolId>[] = [
  define(
    "qr-code-generator",
    "QR Code Generator",
    [
      {
        name: "type",
        label: "Payload type",
        control: "select",
        options: ["URL / Plain Text", "WiFi Network", "UPI Payment", "vCard Contact"],
      },
      { name: "content", label: "Content / URL", control: "textarea" },
      {
        name: "ecc",
        label: "Error correction",
        control: "select",
        options: ["Low (7%)", "Medium (15%)", "Quartile (25%)", "High (30%)"],
      },
    ],
    ["QR Code Preview", "SVG Download", "PNG Download"],
    { type: "URL / Plain Text", content: "https://codestation.in", ecc: "Medium (15%)" },
    ["Create custom high-resolution QR codes with customizable colors, error correction, and instant SVG/PNG export."]
  ),
  define(
    "qr-code-reader",
    "QR Code Scanner & Reader",
    [
      {
        name: "image",
        label: "QR Code image",
        control: "file",
        accept: "image/*",
      },
    ],
    ["Decoded payload", "Detected format"],
    {},
    ["Drop or select any QR code image to decode text, URLs, credentials, or UPI payments locally."]
  ),
  define(
    "barcode-generator",
    "Barcode Generator",
    [
      { name: "value", label: "Barcode data / number", control: "text" },
      {
        name: "format",
        label: "Barcode format",
        control: "select",
        options: ["CODE128", "EAN13", "UPC", "CODE39"],
      },
    ],
    ["Barcode Preview", "SVG Download", "PNG Download"],
    { value: "123456789012", format: "CODE128" },
    ["Generate linear barcodes for retail, shipping, and inventory with standard 1D encodings."]
  ),
  define(
    "signature-pad",
    "Digital Signature Pad",
    [],
    ["Signature canvas", "Transparent PNG Download"],
    {},
    ["Draw your signature with mouse, stylus, or touch, and export a clean, transparent PNG."]
  ),
];

export const getQrBarcodeDefinition = (id: string) => qrBarcodeTools.find((tool) => tool.id === id);
export const isQrBarcodeToolId = (id: string): id is QrBarcodeToolId =>
  (qrBarcodeToolIds as readonly string[]).includes(id);
