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
import {
  encodeWavFromChannels,
  computeWaveformPeaks,
  formatAudioTime,
} from "@/lib/tools/audio/engine";
import styles from "./QrBarcodeStation.module.css";

export default function QrBarcodeStation({ toolId }: { toolId: QrBarcodeToolId }) {
  const definition = getQrBarcodeDefinition(toolId)!;

  // QR Generator state
  const [qrType, setQrType] = useState<"text" | "wifi" | "upi" | "vcard">("text");
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

  // Signature pad state
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState("#151713");
  const [penWidth, setPenWidth] = useState(3);
  const [hasSignature, setHasSignature] = useState(false);

  // Audio Trimmer state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

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

  // Signature pad drawing handlers
  function startDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);

    setIsDrawing(true);
    setHasSignature(true);
    canvas.setPointerCapture(e.pointerId);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = sigCanvasRef.current;
    if (canvas) canvas.releasePointerCapture(e.pointerId);
  }

  function clearSignature() {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function downloadSignature(transparent = true) {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;

    if (transparent) {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "digital_signature.png";
      a.click();
    } else {
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(canvas, 0, 0);
        const url = exportCanvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = "digital_signature_white.png";
        a.click();
      }
    }
  }

  async function handleAudioUpload(file: File) {
    setAudioError(null);
    setAudioFile(file);
    try {
      const buffer = await file.arrayBuffer();
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) throw new Error("Web Audio API is not supported in this browser.");
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      const decoded = await ctx.decodeAudioData(buffer.slice(0));
      setAudioBuffer(decoded);
      setAudioDuration(decoded.duration);
      setTrimStart(0);
      setTrimEnd(Math.min(30, decoded.duration));

      const peaks = computeWaveformPeaks(decoded.getChannelData(0), 120);
      setWaveformPeaks(peaks);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Failed to decode audio file.");
      setAudioBuffer(null);
    }
  }

  function renderWaveform(peaks: number[], start: number, end: number, duration: number) {
    const canvas = waveformCanvasRef.current;
    if (!canvas || peaks.length === 0 || duration <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const startRatio = start / duration;
    const endRatio = end / duration;
    const barWidth = w / peaks.length;

    for (let i = 0; i < peaks.length; i++) {
      const barRatio = i / peaks.length;
      const isSelected = barRatio >= startRatio && barRatio <= endRatio;
      ctx.fillStyle = isSelected ? "#D9F975" : "#717B65";
      const barHeight = Math.max(3, peaks[i] * (h - 16));
      const y = (h - barHeight) / 2;
      ctx.fillRect(i * barWidth, y, Math.max(1, barWidth - 1.5), barHeight);
    }
  }

  useEffect(() => {
    if (waveformPeaks.length > 0 && audioDuration > 0) {
      renderWaveform(waveformPeaks, trimStart, trimEnd, audioDuration);
    }
  }, [waveformPeaks, trimStart, trimEnd, audioDuration]);

  function toggleAudioPlayback() {
    if (!audioBuffer || !audioContextRef.current) return;
    const ctx = audioContextRef.current;

    if (isPlayingAudio) {
      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.stop();
        } catch {}
      }
      setIsPlayingAudio(false);
      return;
    }

    try {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      const dur = Math.max(0.05, trimEnd - trimStart);
      source.start(0, trimStart, dur);
      source.onended = () => {
        setIsPlayingAudio(false);
      };
      activeSourceRef.current = source;
      setIsPlayingAudio(true);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Playback error");
    }
  }

  function downloadTrimmedWav() {
    if (!audioBuffer) return;
    try {
      const channels: Float32Array[] = [];
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        channels.push(audioBuffer.getChannelData(ch));
      }
      const startSample = Math.floor(trimStart * audioBuffer.sampleRate);
      const endSample = Math.floor(trimEnd * audioBuffer.sampleRate);
      const wavBytes = encodeWavFromChannels(channels, audioBuffer.sampleRate, startSample, endSample);

      const blob = new Blob([wavBytes as unknown as BlobPart], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const originalName = audioFile ? audioFile.name.replace(/\.[^/.]+$/, "") : "audio";
      a.download = `${originalName}-trimmed.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Failed to encode WAV.");
    }
  }

  function downloadSvg(svgString: string, filename: string) {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPng(dataUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  return (
    <div className={styles.container}>
      <section className={styles.card}>
        <div className={styles.header}>
          <h2>{definition.name}</h2>
          <p>{definition.description}</p>
        </div>

        <div className={styles.body}>
          {/* TOOL 1: QR CODE GENERATOR */}
          {toolId === "qr-code-generator" && (
            <div className={styles.grid}>
              <div className={styles.formCol}>
                <div className={styles.field}>
                  <label htmlFor="qr-type-select" className={styles.label}>Template Type</label>
                  <select
                    id="qr-type-select"
                    value={qrType}
                    onChange={(e) => setQrType(e.target.value as any)}
                    className={styles.select}
                  >
                    <option value="text">URL or Plain Text</option>
                    <option value="wifi">WiFi Network Access</option>
                    <option value="upi">UPI Payment (India)</option>
                    <option value="vcard">vCard Digital Contact</option>
                  </select>
                </div>

                {qrType === "text" && (
                  <div className={styles.field}>
                    <label htmlFor="qr-text-content" className={styles.label}>URL or Text Content</label>
                    <textarea
                      id="qr-text-content"
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      className={styles.textarea}
                      placeholder="https://example.com"
                    />
                  </div>
                )}

                {qrType === "wifi" && (
                  <>
                    <div className={styles.field}>
                      <label htmlFor="wifi-ssid-input" className={styles.label}>Network Name (SSID)</label>
                      <input
                        id="wifi-ssid-input"
                        type="text"
                        value={wifiSsid}
                        onChange={(e) => setWifiSsid(e.target.value)}
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="wifi-pass-input" className={styles.label}>WiFi Password</label>
                      <input
                        id="wifi-pass-input"
                        type="text"
                        value={wifiPass}
                        onChange={(e) => setWifiPass(e.target.value)}
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="wifi-enc-select" className={styles.label}>Security Mode</label>
                      <select
                        id="wifi-enc-select"
                        value={wifiEnc}
                        onChange={(e) => setWifiEnc(e.target.value as any)}
                        className={styles.select}
                      >
                        <option value="WPA">WPA / WPA2 / WPA3</option>
                        <option value="WEP">WEP</option>
                        <option value="nopass">None (Open Network)</option>
                      </select>
                    </div>
                  </>
                )}

                {qrType === "upi" && (
                  <>
                    <div className={styles.field}>
                      <label htmlFor="upi-vpa-input" className={styles.label}>UPI ID / VPA</label>
                      <input
                        id="upi-vpa-input"
                        type="text"
                        value={upiVpa}
                        onChange={(e) => setUpiVpa(e.target.value)}
                        placeholder="user@okhdfcbank"
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="upi-name-input" className={styles.label}>Payee Name</label>
                      <input
                        id="upi-name-input"
                        type="text"
                        value={upiName}
                        onChange={(e) => setUpiName(e.target.value)}
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="upi-amount-input" className={styles.label}>Amount (₹ INR)</label>
                      <input
                        id="upi-amount-input"
                        type="number"
                        value={upiAmount}
                        onChange={(e) => setUpiAmount(e.target.value)}
                        className={styles.input}
                      />
                    </div>
                  </>
                )}

                {qrType === "vcard" && (
                  <>
                    <div className={styles.field}>
                      <label htmlFor="vcard-name-input" className={styles.label}>Full Name</label>
                      <input
                        id="vcard-name-input"
                        type="text"
                        value={vcardName}
                        onChange={(e) => setVcardName(e.target.value)}
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="vcard-email-input" className={styles.label}>Email Address</label>
                      <input
                        id="vcard-email-input"
                        type="email"
                        value={vcardEmail}
                        onChange={(e) => setVcardEmail(e.target.value)}
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="vcard-phone-input" className={styles.label}>Phone Number</label>
                      <input
                        id="vcard-phone-input"
                        type="tel"
                        value={vcardPhone}
                        onChange={(e) => setVcardPhone(e.target.value)}
                        className={styles.input}
                      />
                    </div>
                  </>
                )}

                <div className={styles.colorRow}>
                  <div className={styles.colorPicker}>
                    <label htmlFor="qr-dark-color" className={styles.label}>Foreground</label>
                    <input
                      id="qr-dark-color"
                      type="color"
                      value={qrDark}
                      onChange={(e) => setQrDark(e.target.value)}
                    />
                  </div>
                  <div className={styles.colorPicker}>
                    <label htmlFor="qr-light-color" className={styles.label}>Background</label>
                    <input
                      id="qr-light-color"
                      type="color"
                      value={qrLight}
                      onChange={(e) => setQrLight(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="qr-ecc-select" className={styles.label}>Error Correction Level</label>
                  <select
                    id="qr-ecc-select"
                    value={qrEcc}
                    onChange={(e) => setQrEcc(e.target.value as QrErrorCorrection)}
                    className={styles.select}
                  >
                    <option value="L">Low (7% recovery)</option>
                    <option value="M">Medium (15% recovery)</option>
                    <option value="Q">Quartile (25% recovery)</option>
                    <option value="H">High (30% recovery - best for logos)</option>
                  </select>
                </div>
              </div>

              {/* QR Preview Column */}
              <div className={styles.previewCol}>
                {qrPngUrl && (
                  <img src={qrPngUrl} alt="QR Code Preview" className={styles.previewImage} />
                )}
                <div className={styles.previewActions}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => downloadPng(qrPngUrl, "qrcode.png")}
                  >
                    Download PNG
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => downloadSvg(qrSvg, "qrcode.svg")}
                  >
                    Download SVG
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TOOL 2: QR CODE READER / SCANNER */}
          {toolId === "qr-code-reader" && (
            <div className={styles.formCol}>
              <div className={styles.field}>
                <span className={styles.label}>Upload QR Code Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleQrFile(e.target.files[0]);
                  }}
                  className={styles.input}
                />
              </div>

              {scanError && <div className={styles.errorBanner}>{scanError}</div>}

              {scannedResult && (
                <div className={styles.decodedBox}>
                  <strong style={{ color: "var(--green)" }}>✓ QR Code Decoded</strong>
                  <div className={styles.decodedContent}>{scannedResult}</div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => navigator.clipboard.writeText(scannedResult)}
                    >
                      Copy to Clipboard
                    </button>
                    {scannedResult.startsWith("http") && (
                      <a
                        href={scannedResult}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.primaryBtn}
                        style={{ display: "inline-block", textDecoration: "none" }}
                      >
                        Open Link ↗
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TOOL 3: BARCODE GENERATOR */}
          {toolId === "barcode-generator" && (
            <div className={styles.grid}>
              <div className={styles.formCol}>
                <div className={styles.field}>
                  <label htmlFor="barcode-data-input" className={styles.label}>Barcode Data / Number</label>
                  <input
                    id="barcode-data-input"
                    type="text"
                    value={barcodeValue}
                    onChange={(e) => setBarcodeValue(e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="barcode-format-select" className={styles.label}>Standard Barcode Encoding</label>
                  <select
                    id="barcode-format-select"
                    value={barcodeFormat}
                    onChange={(e) => setBarcodeFormat(e.target.value as any)}
                    className={styles.select}
                  >
                    <option value="CODE128">Code 128 (General & Shipping)</option>
                    <option value="EAN13">EAN-13 (13 Digits International Retail)</option>
                    <option value="UPC">UPC-A (12 Digits Retail)</option>
                    <option value="CODE39">Code 39 (Alphanumeric)</option>
                  </select>
                </div>
              </div>

              <div className={styles.previewCol}>
                <svg ref={barcodeSvgRef} style={{ maxWidth: "100%", height: "auto", background: "white", padding: "10px", borderRadius: "4px" }} />
                <div className={styles.previewActions} style={{ marginTop: "14px" }}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => {
                      if (barcodeSvgRef.current) {
                        const serializer = new XMLSerializer();
                        const svgStr = serializer.serializeToString(barcodeSvgRef.current);
                        downloadSvg(svgStr, "barcode.svg");
                      }
                    }}
                  >
                    Download SVG
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TOOL 4: DIGITAL SIGNATURE PAD */}
          {toolId === "signature-pad" && (
            <div className={styles.formCol}>
              <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "8px" }}>
                <div className={styles.colorPicker}>
                  <label htmlFor="sig-pen-color" className={styles.label}>Ink Color</label>
                  <input
                    id="sig-pen-color"
                    type="color"
                    value={penColor}
                    onChange={(e) => setPenColor(e.target.value)}
                  />
                </div>
                <div className={styles.field} style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
                  <label htmlFor="pen-width-range" className={styles.label}>Stroke Width</label>
                  <input
                    id="pen-width-range"
                    type="range"
                    min="1"
                    max="8"
                    value={penWidth}
                    onChange={(e) => setPenWidth(Number(e.target.value))}
                  />
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>{penWidth}px</span>
                </div>
              </div>

              <div className={styles.canvasWrap}>
                <canvas
                  ref={sigCanvasRef}
                  width={600}
                  height={220}
                  className={styles.signatureCanvas}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => downloadSignature(true)}
                  disabled={!hasSignature}
                >
                  Download Transparent PNG
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => downloadSignature(false)}
                  disabled={!hasSignature}
                >
                  Download White Background PNG
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={clearSignature}
                  style={{ color: "var(--red)" }}
                >
                  Clear Canvas
                </button>
              </div>
            </div>
          )}

          {/* TOOL 5: AUDIO TRIMMER & CUTTER */}
          {toolId === "audio-trimmer" && (
            <div className={styles.formCol}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="audio-file-input">
                  Select Audio File (MP3, WAV, AAC, OGG, M4A)
                </label>
                <input
                  id="audio-file-input"
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
                  className={styles.input}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleAudioUpload(file);
                  }}
                />
              </div>

              {audioError && <div className={styles.errorBanner}>{audioError}</div>}

              {audioBuffer && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Waveform &amp; Selected Region</label>
                    <canvas
                      ref={waveformCanvasRef}
                      width={700}
                      height={120}
                      className={styles.waveformCanvas}
                    />
                    <div className={styles.timeDisplay}>
                      <span>Start: {formatAudioTime(trimStart)}</span>
                      <span>Total: {formatAudioTime(audioDuration)}</span>
                      <span>End: {formatAudioTime(trimEnd)}</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="trim-start-range">
                        Start Time ({trimStart.toFixed(1)}s)
                      </label>
                      <input
                        id="trim-start-range"
                        type="range"
                        min={0}
                        max={Math.max(0, trimEnd - 0.1)}
                        step={0.1}
                        value={trimStart}
                        onChange={(e) => setTrimStart(parseFloat(e.target.value))}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="trim-end-range">
                        End Time ({trimEnd.toFixed(1)}s)
                      </label>
                      <input
                        id="trim-end-range"
                        type="range"
                        min={trimStart + 0.1}
                        max={audioDuration}
                        step={0.1}
                        value={trimEnd}
                        onChange={(e) => setTrimEnd(parseFloat(e.target.value))}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", marginTop: "12px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={toggleAudioPlayback}
                    >
                      {isPlayingAudio ? "Stop Preview" : "Play Selection"}
                    </button>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={downloadTrimmedWav}
                    >
                      Download Trimmed WAV
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
