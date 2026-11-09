import { localDefinition, type LocalField, type LocalDefinition } from "./local-contract";

export const compressionToolIds = [
  "zip-extractor",
  "zip-creator",
  "gzip-compressor",
  "gzip-decompressor",
  "tar-inspector",
] as const;

export type CompressionToolId = (typeof compressionToolIds)[number];

const notice =
  "Zero-server archive processing. Extraction, creation, compression, and inspection execute 100% locally in your browser with native streams and fflate.";

const define = (
  id: CompressionToolId,
  title: string,
  fields: LocalField[],
  outputs: string[],
  defaults: Record<string, unknown> = {},
  extra: string[] = []
): LocalDefinition<CompressionToolId> =>
  localDefinition(id, title, "Compression", fields, outputs, defaults, [notice, ...extra], "Process");

export const compressionTools: readonly LocalDefinition<CompressionToolId>[] = [
  define(
    "zip-extractor",
    "ZIP Extractor & Viewer",
    [
      {
        name: "file",
        label: "ZIP file",
        control: "file",
        accept: ".zip,application/zip,application/x-zip-compressed",
      },
    ],
    ["Archive tree view", "File preview", "Extracted files download"],
    {},
    [
      "Inspect, browse folder trees, preview text files and images, and extract individual files or the whole archive. Zero uploads, 100% in-browser.",
    ]
  ),
  define(
    "zip-creator",
    "ZIP Archive Creator",
    [
      {
        name: "files",
        label: "Files to compress",
        control: "files",
        accept: "*/*",
      },
      {
        name: "level",
        label: "Compression level (0-9)",
        control: "select",
        options: ["0 - Store", "1 - Fastest", "6 - Default", "9 - Maximum"],
      },
    ],
    ["Generated .zip archive", "Compression ratio stats", "Direct ZIP download"],
    { level: "6 - Default" },
    [
      "Pack and compress multiple files into a standard .zip archive entirely in memory with configurable compression levels 0-9.",
    ]
  ),
  define(
    "gzip-compressor",
    "Gzip / Deflate Compressor",
    [
      {
        name: "input",
        label: "Text or binary input",
        control: "textarea",
      },
      {
        name: "format",
        label: "Compression algorithm",
        control: "select",
        options: ["gzip", "deflate"],
      },
      {
        name: "level",
        label: "Compression level",
        control: "select",
        options: ["1 - Fast", "6 - Balanced", "9 - Max"],
      },
    ],
    ["Base64 compressed string", "Downloadable .gz file", "Compression ratio stats"],
    { format: "gzip", level: "6 - Balanced" },
    [
      "Compress text or binary payloads using the native browser CompressionStream Web API with client-side fflate fallback. Output Base64 or download .gz.",
    ]
  ),
  define(
    "gzip-decompressor",
    "Gzip / Deflate Decompressor",
    [
      {
        name: "input",
        label: "Base64 string or compressed file",
        control: "textarea",
      },
      {
        name: "format",
        label: "Algorithm detection",
        control: "select",
        options: ["auto", "gzip", "deflate"],
      },
    ],
    ["Decompressed text preview", "Decompressed binary download", "Size metrics"],
    { format: "auto" },
    [
      "Decompress Gzip and Deflate archives in memory from Base64 strings or .gz/.zz files using native DecompressionStream and fflate fallback.",
    ]
  ),
  define(
    "tar-inspector",
    "TAR / TAR.GZ Inspector",
    [
      {
        name: "file",
        label: "TAR or TAR.GZ file",
        control: "file",
        accept: ".tar,.tar.gz,.tgz,application/x-tar,application/gzip",
      },
    ],
    ["Archive file list", "UNIX permissions & timestamps", "Selective extraction", "ZIP export"],
    {},
    [
      "Inspect uncompressed and gzip-compressed TAR archives (.tar, .tar.gz, .tgz). View UNIX file modes, sizes, and timestamps, and selectively extract files or export to ZIP.",
    ]
  ),
];

export const getCompressionDefinition = (id: string) =>
  compressionTools.find((tool) => tool.id === id);

export const isCompressionToolId = (id: string): id is CompressionToolId =>
  (compressionToolIds as readonly string[]).includes(id);
