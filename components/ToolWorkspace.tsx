"use client";

import dynamic from "next/dynamic";
import { isDateTimeToolId } from "@/config/date-time-tools";
import { isJsonDataToolId } from "@/config/json-data-tools";
import { isEncodingToolId } from "@/config/encoding-tools";
import { isSecurityToolId } from "@/config/security-tools";
import { isRegexToolId } from "@/config/regex-tools";
import { isTextToolId } from "@/config/text-tools";
import { isCronToolId } from "@/config/cron-tools";
import { isSqlToolId } from "@/config/sql-tools";
import { isWebToolId } from "@/config/web-tools";
import { isApiToolId } from "@/config/api-tools";
import { isImageToolId } from "@/config/image-tools";
import { isSpreadsheetToolId } from "@/config/spreadsheet-tools";
import { isMarkdownToolId } from "@/config/markdown-tools";
import { isColorToolId } from "@/config/color-tools";
import { isNumericToolId } from "@/config/numeric-contracts";
import { isExtendedToolId } from "@/config/extended-tools";
import { isPdfToolId } from "@/config/pdf-tools";
import { isQrBarcodeToolId } from "@/config/qr-barcode-tools";
import { isAudioToolId } from "@/config/audio-tools";
import { isCodeToolId } from "@/config/code-tools";
import { isNetworkToolId } from "@/config/network-tools";
import { isCssPlaygroundToolId } from "@/config/css-playground-tools";
import { isDevMathToolId } from "@/config/dev-math-tools";
import type { RegisteredToolId } from "@/config/tools";

const DevMathStation = dynamic(() => import("./DevMathStation"), {
  loading: () => <p role="status">Loading Developer Math controls…</p>,
});

const CssPlaygroundStation = dynamic(() => import("./CssPlaygroundStation"), {
  loading: () => <p role="status">Loading CSS playground controls…</p>,
});

const NetworkStation = dynamic(() => import("./NetworkStation"), {
  loading: () => <p role="status">Loading Network &amp; DevOps controls…</p>,
});

const CodeGenStation = dynamic(() => import("./CodeGenStation"), {
  loading: () => <p role="status">Loading Code Generation controls…</p>,
});

const PdfStation = dynamic(() => import("./PdfStation"), {
  loading: () => <p role="status">Loading PDF controls…</p>,
});

const QrBarcodeStation = dynamic(() => import("./QrBarcodeStation"), {
  loading: () => <p role="status">Loading QR &amp; Barcode controls…</p>,
});

const AudioStation = dynamic(() => import("./AudioStation"), {
  loading: () => <p role="status">Loading Audio controls…</p>,
});

const ExtendedStation = dynamic(() => import("./ExtendedStation"), {
  loading: () => <p role="status">Loading tool controls…</p>,
});

const DateTimeStation = dynamic(() => import("./DateTimeStation"), {
  loading: () => <p role="status">Loading Date &amp; Time controls…</p>,
});
const ToolWorkbench = dynamic(() => import("./ToolWorkbench"), {
  loading: () => <p role="status">Loading tool controls…</p>,
});
const JsonDataStation = dynamic(() => import("./JsonDataStation"), {
  loading: () => <p role="status">Loading JSON &amp; Data controls…</p>,
});
const EncodingStation = dynamic(() => import("./EncodingStation"), {
  loading: () => <p role="status">Loading Encoding controls…</p>,
});
const SecurityStation = dynamic(() => import("./SecurityStation"), {
  loading: () => <p role="status">Loading Security &amp; Crypto controls…</p>,
});
const RegexStation = dynamic(() => import("./RegexWorkspace"), {
  loading: () => <p role="status">Loading JavaScript Regex controls…</p>,
});
const TextWorkspace = dynamic(() => import("./TextWorkspace"), {
  loading: () => <p role="status">Loading Text controls…</p>,
});
const CronStation = dynamic(() => import("./CronStation"), {
  loading: () => <p role="status">Loading Cron controls…</p>,
});
const SqlDatabaseStation = dynamic(() => import("./SqlDatabaseStation"), {
  loading: () => <p role="status">Loading SQL &amp; Database controls…</p>,
});
const WebStation = dynamic(() => import("./WebStation"), {
  loading: () => <p role="status">Loading Web controls…</p>,
});

/** Lazy client boundaries keep the existing all-station workbench off new date tools. */
const ApiStation = dynamic(() => import("./ApiStation"), {
  loading: () => <p role="status">Loading API controls…</p>,
});
const NumericStation = dynamic(() => import("./NumericStation"), {
  loading: () => <p role="status">Loading numeric converter controls…</p>,
});
export default function ToolWorkspace({ toolId }: { toolId: RegisteredToolId }) {
  if (isDevMathToolId(toolId)) return <DevMathStation key={toolId} toolId={toolId} />;
  if (isCssPlaygroundToolId(toolId)) return <CssPlaygroundStation key={toolId} toolId={toolId} />;
  if (isNetworkToolId(toolId)) return <NetworkStation key={toolId} toolId={toolId} />;
  if (isCodeToolId(toolId)) return <CodeGenStation key={toolId} toolId={toolId} />;
  if (isPdfToolId(toolId)) return <PdfStation key={toolId} toolId={toolId} />;
  if (isQrBarcodeToolId(toolId)) return <QrBarcodeStation key={toolId} toolId={toolId} />;
  if (isAudioToolId(toolId)) return <AudioStation key={toolId} toolId={toolId} />;
  if (isExtendedToolId(toolId)) return <ExtendedStation key={toolId} toolId={toolId} />;
  if (isNumericToolId(toolId)) return <NumericStation key={toolId} toolId={toolId} />;
  if (isSpreadsheetToolId(toolId)) return <SpreadsheetStation key={toolId} toolId={toolId} />;
  if (isMarkdownToolId(toolId)) return <MarkdownStation key={toolId} toolId={toolId} />;
  if (isColorToolId(toolId)) return <ColorCssStation key={toolId} toolId={toolId} />;
  if (isImageToolId(toolId)) return <ImageStation key={toolId} toolId={toolId} />;
  if (isApiToolId(toolId)) return <ApiStation key={toolId} toolId={toolId} />;
  if (isWebToolId(toolId)) return <WebStation key={toolId} toolId={toolId} />;
  if (isSqlToolId(toolId)) return <SqlDatabaseStation key={toolId} toolId={toolId} />;
  if (isCronToolId(toolId)) return <CronStation key={toolId} toolId={toolId} />;
  if (isTextToolId(toolId)) return <TextWorkspace key={toolId} toolId={toolId} />;
  if (isRegexToolId(toolId)) return <RegexStation key={toolId} toolId={toolId} />;
  if (isSecurityToolId(toolId)) return <SecurityStation key={toolId} toolId={toolId} />;
  if (isEncodingToolId(toolId)) return <EncodingStation key={toolId} toolId={toolId} />;
  if (isJsonDataToolId(toolId)) return <JsonDataStation key={toolId} toolId={toolId} />;
  return isDateTimeToolId(toolId)
    ? <DateTimeStation key={toolId} toolId={toolId} />
    : <ToolWorkbench key={toolId} toolId={toolId as any} />;
}
const ImageStation = dynamic(() => import("./ImageStation"), { loading: () => <p role="status">Loading Image controls…</p> });
const SpreadsheetStation = dynamic(() => import("./SpreadsheetStation"), { loading: () => <p role="status">Loading Spreadsheet controls…</p> });
const MarkdownStation = dynamic(() => import("./MarkdownStation"), { loading: () => <p role="status">Loading Markdown controls…</p> });
const ColorCssStation = dynamic(() => import("./ColorCssStation"), { loading: () => <p role="status">Loading Color &amp; CSS controls…</p> });
