export type EmbedTheme = "auto" | "light" | "dark";

export const EMBED_HEIGHT_PRESETS = [420, 520, 640, 760] as const;
export const DEFAULT_EMBED_ORIGIN = "https://codestation.in";

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function normalizeEmbedHeight(height: number): number {
  if (!Number.isFinite(height)) return 520;
  return Math.max(280, Math.min(1600, Math.round(height)));
}

export function buildEmbedUrl(options: {
  slug: string;
  origin?: string;
  theme?: EmbedTheme;
  hash?: string;
}): string {
  const cleanOrigin = (options.origin || DEFAULT_EMBED_ORIGIN).replace(/\/+$/, "");
  const encodedSlug = encodeURIComponent(options.slug.replace(/^\/+|\/+$/g, ""));
  const query =
    options.theme === "light" || options.theme === "dark"
      ? `?theme=${options.theme}`
      : "";
  const hash =
    options.hash && (options.hash.startsWith("#state=") || options.hash.startsWith("#s="))
      ? options.hash
      : "";
  return `${cleanOrigin}/embed/${encodedSlug}${query}${hash}`;
}

export function buildEmbedIframeSnippet(options: {
  slug: string;
  title: string;
  theme?: EmbedTheme;
  height?: number;
  origin?: string;
  hash?: string;
}): string {
  const src = buildEmbedUrl({
    slug: options.slug,
    origin: options.origin,
    theme: options.theme ?? "auto",
    hash: options.hash,
  });
  const height = normalizeEmbedHeight(options.height ?? 520);
  const frameTitle = `${options.title} — Code Station`;
  return `<iframe src="${escapeHtmlAttr(src)}" title="${escapeHtmlAttr(frameTitle)}" width="100%" height="${height}" loading="lazy" allow="clipboard-write" style="border:1px solid #d4d4d8;border-radius:12px;"></iframe>`;
}
