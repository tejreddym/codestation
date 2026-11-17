/** Safe names for browser downloads and ZIP entries. */

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_STEM_LENGTH = 80;

function stripExtension(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  return base.replace(/\.[^.]+$/, "");
}

/**
 * Produces a portable file stem (no extension): path components, control
 * characters and reserved filesystem characters are removed, whitespace is
 * collapsed, and the result is bounded in length.
 */
export function sanitizeFileStem(name: string, fallback = "document"): string {
  let stem = stripExtension(String(name ?? ""))
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^[\s.-]+|[\s.-]+$/g, "");

  if (stem.length > MAX_STEM_LENGTH) {
    stem = stem.slice(0, MAX_STEM_LENGTH).replace(/[\s.-]+$/g, "");
  }

  if (!stem) stem = fallback;
  if (WINDOWS_RESERVED.test(stem)) stem = `${stem}-file`;
  return stem;
}

/** Builds a download or ZIP entry name such as `report-pages.zip`. */
export function buildOutputName(sourceName: string, suffix: string, extension: string): string {
  const stem = sanitizeFileStem(sourceName);
  const safeSuffix = sanitizeFileStem(suffix, "output");
  const safeExtension = extension.replace(/^\.+/, "").replace(/[^a-z0-9]/gi, "") || "bin";
  return `${stem}-${safeSuffix}.${safeExtension}`;
}
