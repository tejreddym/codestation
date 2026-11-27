"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getQrBarcodeDefinition, type QrBarcodeToolId } from "@/config/qr-barcode-tools";
import {
  generateQrCodeSvg,
  generateQrCodeDataUrl,
  decodeQrCode,
  formatWifiPayload,
  formatUpiPayload,
  formatVCardPayload,
  type QrErrorCorrection,
} from "@/lib/tools/qr-barcode/engine";
import { Button, ButtonLink } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { CanvasStage } from "./ui/CanvasStage";
import { DropZone } from "./ui/DropZone";
import { Field, Hint } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { ColorInput, Select, Textarea, TextInput } from "./ui/controls";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import { downloadBlob } from "./ui/useDownload";
import { useCopy } from "./ui/useCopy";
import ui from "./ui/ui.module.css";
import styles from "./QrBarcodeStation.module.css";

export default function QrBarcodeStation({ toolId }: { toolId: QrBarcodeToolId }) {
  const definition = getQrBarcodeDefinition(toolId)!;
  const singleColumn = toolId === "qr-code-reader";

  // QR Generator state
  const [qrType, setQrType] = useState<"text" | "wifi" | "upi" | "vcard">("text");
  const { copy, message: copyMessage } = useCopy();
  const [textContent, setTextContent] = useState("https://codestation.in");
  const [wifiSsid, setWifiSsid] = useState("MyHomeNetwork");
  const [wifiPass, setWifiPass] = useState("MyPassword123");
  const [wifiEnc, setWifiEnc] = useState<"WPA" | "WEP" | "nopass">("WPA");
  const [upiVpa, setUpiVpa] = useState("developer@upi");
  const [upiName, setUpiName] = useState("Code Station");
  const [upiAmount, setUpiAmount] = useState("199");
  const [vcardName, setVcardName] = useState("Jane Doe");
  const [vcardEmail, setVcardEmail] = useState("jane@example.com");
  const [vcardPhone, setVcardPhone] = useState("+91 98765 43210");

  const [qrEcc, setQrEcc] = useState<QrErrorCorrection>("M");
  const [qrDark, setQrDark] = useState("#151713");
  const [qrLight, setQrLight] = useState("#ffffff");

  const [qrSvg, setQrSvg] = useState<string>("");
  const [qrPngUrl, setQrPngUrl] = useState<string>("");

  // QR Scanner state
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Barcode state
  const [barcodeValue, setBarcodeValue] = useState("123456789012");
  const [barcodeFormat, setBarcodeFormat] = useState<"CODE128" | "EAN13" | "UPC" | "CODE39">("CODE128");
  const barcodeSvgRef = useRef<SVGSVGElement>(null);

  // Compute active QR payload
  const getActivePayload = useCallback(() => {
    if (qrType === "wifi") {
      return formatWifiPayload({ ssid: wifiSsid, password: wifiPass, encryption: wifiEnc });
    }
    if (qrType === "upi") {
      return formatUpiPayload({ vpa: upiVpa, name: upiName, amount: upiAmount, note: "Code Station" });
    }
    if (qrType === "vcard") {
      return formatVCardPayload({ name: vcardName, email: vcardEmail, phone: vcardPhone });
    }
    return textContent.trim() || "https://codestation.in";
  }, [qrType, wifiSsid, wifiPass, wifiEnc, upiVpa, upiName, upiAmount, vcardName, vcardEmail, vcardPhone, textContent]);

  // Generate QR on parameter changes
  useEffect(() => {
    if (toolId !== "qr-code-generator") return;
    const payload = getActivePayload();
    let isCancelled = false;

    async function runGen() {
      try {
        const svg = await generateQrCodeSvg(payload, {
          errorCorrectionLevel: qrEcc,
          color: { dark: qrDark, light: qrLight },
        });
        const png = await generateQrCodeDataUrl(payload, {
          errorCorrectionLevel: qrEcc,
          color: { dark: qrDark, light: qrLight },
        });
        if (!isCancelled) {
          setQrSvg(svg);
          setQrPngUrl(png);
        }
      } catch {
        // Fallback / invalid characters
      }
    }

    runGen();
    return () => {
      isCancelled = true;
    };
  }, [toolId, getActivePayload, qrEcc, qrDark, qrLight]);

  // Generate Barcode on parameter changes
  useEffect(() => {
    if (toolId !== "barcode-generator") return;
    async function loadBarcode() {
      try {
        const JsBarcode = (await import("jsbarcode")).default;
        if (barcodeSvgRef.current && barcodeValue.trim()) {
          JsBarcode(barcodeSvgRef.current, barcodeValue.trim(), {
            format: barcodeFormat,
            lineColor: "#151713",
            width: 2,
            height: 80,
            displayValue: true,
            font: "monospace",
            fontSize: 14,
            background: "#ffffff",
          });
        }
      } catch {
        // Invalid digits for selected format
      }
    }
    loadBarcode();
  }, [toolId, barcodeValue, barcodeFormat]);

  // Handle QR image file decode
  function handleQrFile(file: File) {
    setScanError(null);
    setScannedResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const decoded = decodeQrCode(imgData);
        if (decoded && decoded.text) {
          setScannedResult(decoded.text);
        } else {
          setScanError("No valid QR code could be detected in this image.");
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function downloadSvg(svgString: string, filename: string) {
    downloadBlob(svgString, filename, "image/svg+xml;charset=utf-8");
  }

  function downloadPng(dataUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  return (
    <ToolLayout kind={singleColumn ? "data" : "form"} className={styles.container}>
      <Panel title={definition.name} headingId={`${toolId}-heading`} padded>
        <Hint>{definition.description}</Hint>

        {/* TOOL 1: QR CODE GENERATOR */}
        {toolId === "qr-code-generator" && (
          <>
            <Field id="qr-type-select" label="Template Type">
              <Select id="qr-type-select" value={qrType} onChange={e => setQrType(e.target.value as "text" | "wifi" | "upi" | "vcard")}>
                <option value="text">URL or Plain Text</option>
                <option value="wifi">WiFi Network Access</option>
                <option value="upi">UPI Payment (India)</option>
                <option value="vcard">vCard Digital Contact</option>
              </Select>
            </Field>

            {qrType === "text" && (
              <Field id="qr-text-content" label="URL or Text Content">
                <Textarea id="qr-text-content" className={styles.compactTextarea} value={textContent} onChange={e => setTextContent(e.target.value)} placeholder="https://example.com" />
              </Field>
            )}

            {qrType === "wifi" && (
              <>
                <Field id="wifi-ssid-input" label="Network Name (SSID)">
                  <TextInput id="wifi-ssid-input" type="text" value={wifiSsid} onChange={e => setWifiSsid(e.target.value)} />
                </Field>
                <Field id="wifi-pass-input" label="WiFi Password">
                  <TextInput id="wifi-pass-input" type="text" value={wifiPass} onChange={e => setWifiPass(e.target.value)} />
                </Field>
                <Field id="wifi-enc-select" label="Security Mode">
                  <Select id="wifi-enc-select" value={wifiEnc} onChange={e => setWifiEnc(e.target.value as "WPA" | "WEP" | "nopass")}>
                    <option value="WPA">WPA / WPA2 / WPA3</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">None (Open Network)</option>
                  </Select>
                </Field>
              </>
            )}

            {qrType === "upi" && (
              <>
                <Field id="upi-vpa-input" label="UPI ID / VPA">
                  <TextInput id="upi-vpa-input" type="text" value={upiVpa} onChange={e => setUpiVpa(e.target.value)} placeholder="user@okhdfcbank" />
                </Field>
                <Field id="upi-name-input" label="Payee Name">
                  <TextInput id="upi-name-input" type="text" value={upiName} onChange={e => setUpiName(e.target.value)} />
                </Field>
                <Field id="upi-amount-input" label="Amount (₹ INR)">
                  <TextInput id="upi-amount-input" type="number" value={upiAmount} onChange={e => setUpiAmount(e.target.value)} />
                </Field>
              </>
            )}

            {qrType === "vcard" && (
              <>
                <Field id="vcard-name-input" label="Full Name">
                  <TextInput id="vcard-name-input" type="text" value={vcardName} onChange={e => setVcardName(e.target.value)} />
                </Field>
                <Field id="vcard-email-input" label="Email Address">
                  <TextInput id="vcard-email-input" type="email" value={vcardEmail} onChange={e => setVcardEmail(e.target.value)} />
                </Field>
                <Field id="vcard-phone-input" label="Phone Number">
                  <TextInput id="vcard-phone-input" type="tel" value={vcardPhone} onChange={e => setVcardPhone(e.target.value)} />
                </Field>
              </>
            )}

            <div className={styles.colorRow}>
              <Field id="qr-dark-color" label="Foreground">
                <ColorInput id="qr-dark-color" value={qrDark} onChange={e => setQrDark(e.target.value)} />
              </Field>
              <Field id="qr-light-color" label="Background">
                <ColorInput id="qr-light-color" value={qrLight} onChange={e => setQrLight(e.target.value)} />
              </Field>
            </div>

            <Field id="qr-ecc-select" label="Error Correction Level">
              <Select id="qr-ecc-select" value={qrEcc} onChange={e => setQrEcc(e.target.value as QrErrorCorrection)}>
                <option value="L">Low (7% recovery)</option>
                <option value="M">Medium (15% recovery)</option>
                <option value="Q">Quartile (25% recovery)</option>
                <option value="H">High (30% recovery - best for logos)</option>
              </Select>
            </Field>
          </>
        )}

        {/* TOOL 2: QR CODE READER / SCANNER */}
        {toolId === "qr-code-reader" && (
          <>
            <DropZone label="Upload QR Code Image" accept="image/*" onFiles={files => { if (files[0]) handleQrFile(files[0]); }}>
              <span>Upload QR Code Image</span>
              <span className={ui.hint}>Choose a PNG, JPG or WebP image containing a QR code.</span>
            </DropZone>

            {scanError && <Callout kind="error">{scanError}</Callout>}

            {scannedResult && (
              <>
                <pre className={ui.output} tabIndex={0} aria-label="Decoded QR content">{scannedResult}</pre>
                <div className={ui.actions}>
                  <Button onClick={() => void copy(scannedResult)}>Copy to Clipboard</Button>
                  {scannedResult.startsWith("http") && <ButtonLink variant="primary" href={scannedResult} target="_blank" rel="noreferrer">Open Link ↗</ButtonLink>}
                </div>
                <StatusLine>{copyMessage}</StatusLine>
              </>
            )}
          </>
        )}

        {/* TOOL 3: BARCODE GENERATOR */}
        {toolId === "barcode-generator" && (
          <>
            <Field id="barcode-data-input" label="Barcode Data / Number">
              <TextInput id="barcode-data-input" type="text" value={barcodeValue} onChange={e => setBarcodeValue(e.target.value)} />
            </Field>
            <Field id="barcode-format-select" label="Standard Barcode Encoding">
              <Select id="barcode-format-select" value={barcodeFormat} onChange={e => setBarcodeFormat(e.target.value as "CODE128" | "EAN13" | "UPC" | "CODE39")}>
                <option value="CODE128">Code 128 (General &amp; Shipping)</option>
                <option value="EAN13">EAN-13 (13 Digits International Retail)</option>
                <option value="UPC">UPC-A (12 Digits Retail)</option>
                <option value="CODE39">Code 39 (Alphanumeric)</option>
              </Select>
            </Field>
          </>
        )}
      </Panel>

      {toolId === "qr-code-generator" && (
        <Panel title="QR preview" headingId="qr-preview-heading" padded>
          <CanvasStage
            kind="bitmap"
            label="QR code preview"
            background="plain"
            footer={<div className={styles.previewActions}>
              <Button variant="primary" size="sm" disabled={!qrPngUrl} onClick={() => downloadPng(qrPngUrl, "qrcode.png")}>Download PNG</Button>
              <Button size="sm" disabled={!qrSvg} onClick={() => downloadSvg(qrSvg, "qrcode.svg")}>Download SVG</Button>
            </div>}
          >
            {qrPngUrl
              ? /* eslint-disable-next-line @next/next/no-img-element */
                <img src={qrPngUrl} alt="QR Code Preview" className={styles.qrImage} />
              : <Hint>QR code preview appears here.</Hint>}
          </CanvasStage>
        </Panel>
      )}

      {toolId === "barcode-generator" && (
        <Panel title="Barcode preview" headingId="barcode-preview-heading" padded>
          <CanvasStage
            kind="svg"
            label="Barcode preview"
            background="plain"
            footer={<Button size="sm" onClick={() => {
              if (barcodeSvgRef.current) {
                const serializer = new XMLSerializer();
                const svgStr = serializer.serializeToString(barcodeSvgRef.current);
                downloadSvg(svgStr, "barcode.svg");
              }
            }}>Download SVG</Button>}
          >
            <svg ref={barcodeSvgRef} className={styles.barcodeImage} role="img" aria-label="Generated barcode" />
          </CanvasStage>
        </Panel>
      )}
    </ToolLayout>
  );
}
