import { ColorError, type Color, type ColorResult, type ColorValues } from "./types";

const NUMBER = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?";
const NUMBER_RE = new RegExp(`^${NUMBER}$`);

const fail = (message: string, field?: string): never => {
  throw new ColorError(message, field);
};

const number = (value: string, field: string): number => {
  const token = value.trim();
  if (!NUMBER_RE.test(token)) fail(`Enter a finite ${field}.`, field);
  const parsed = Number(token);
  if (!Number.isFinite(parsed)) fail(`Enter a finite ${field}.`, field);
  return parsed;
};

const bounded = (value: number, min: number, max: number, message: string, field: string): number => {
  if (value < min || value > max) fail(message, field);
  return value;
};

const alphaValue = (value: string | undefined): number => {
  if (value === undefined) return 1;
  const token = value.trim();
  if (token.endsWith("%")) {
    const percentage = number(token.slice(0, -1), "alpha");
    return bounded(percentage, 0, 100, "Alpha must be 0–1 or 0–100%.", "alpha") / 100;
  }
  return bounded(number(token, "alpha"), 0, 1, "Alpha must be 0–1 or 0–100%.", "alpha");
};

const parseHex = (value: string): Color | null => {
  const match = /^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value.trim());
  if (!match) return null;
  const short = match[1];
  const full = short.length <= 4 ? short.split("").map((part) => part + part).join("") : short;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
  };
};

type FunctionParts = { channels: string[]; alpha?: string };

/** Split either legacy comma syntax or modern space/slash syntax, but never a mixture. */
const functionParts = (body: string, field: string): FunctionParts => {
  const source = body.trim();
  const slashCount = (source.match(/\//g) ?? []).length;
  if (slashCount > 1) fail(`Use one slash before the ${field} alpha value.`, field);

  if (slashCount === 1) {
    if (source.includes(",")) fail(`Do not mix comma and slash ${field} syntax.`, field);
    const slash = source.indexOf("/");
    const channelSource = source.slice(0, slash).trim();
    const alpha = source.slice(slash + 1).trim();
    if (!alpha) fail("Enter an alpha value.", "alpha");
    const channels = channelSource.split(/\s+/).filter(Boolean);
    if (channels.length !== 3) fail(`${field} requires three color channels.`, field);
    return { channels, alpha };
  }

  if (source.includes(",")) {
    const parts = source.split(",").map((part) => part.trim());
    if (parts.some((part) => !part)) fail(`${field} contains an empty value.`, field);
    if (parts.length !== 3 && parts.length !== 4) fail(`${field} requires three channels and optional alpha.`, field);
    return { channels: parts.slice(0, 3), alpha: parts[3] };
  }

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length !== 3) fail(`${field} requires three channels and optional alpha.`, field);
  return { channels: parts };
};

const parseRgbChannel = (value: string): number => {
  const token = value.trim();
  if (token.endsWith("%")) {
    const percentage = number(token.slice(0, -1), "RGB channel");
    return bounded(percentage, 0, 100, "RGB percentages must be 0–100%.", "color") * 255 / 100;
  }
  return bounded(number(token, "RGB channel"), 0, 255, "RGB channels must be 0–255 or 0–100%.", "color");
};

const parseRgb = (value: string): Color | null => {
  const match = /^(rgba?)\((.*)\)$/i.exec(value.trim());
  if (!match) return null;
  const parts = functionParts(match[2], "RGB");
  return {
    r: parseRgbChannel(parts.channels[0]),
    g: parseRgbChannel(parts.channels[1]),
    b: parseRgbChannel(parts.channels[2]),
    a: alphaValue(parts.alpha),
  };
};

const parseHsl = (value: string): Color | null => {
  const match = /^(hsla?)\((.*)\)$/i.exec(value.trim());
  if (!match) return null;
  const parts = functionParts(match[2], "HSL");
  const hueToken = parts.channels[0].replace(/deg$/i, "");
  if (!NUMBER_RE.test(hueToken.trim())) fail("Hue must be a number or a degree value.", "color");
  const hue = number(hueToken, "hue");
  const saturationToken = parts.channels[1];
  const lightnessToken = parts.channels[2];
  if (!saturationToken.endsWith("%") || !lightnessToken.endsWith("%")) {
    fail("HSL saturation and lightness must be percentages from 0 to 100.", "color");
  }
  const saturation = bounded(number(saturationToken.slice(0, -1), "saturation"), 0, 100, "HSL saturation and lightness must be percentages from 0 to 100.", "color");
  const lightness = bounded(number(lightnessToken.slice(0, -1), "lightness"), 0, 100, "HSL saturation and lightness must be percentages from 0 to 100.", "color");
  const h = (((hue % 360) + 360) % 360) / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (input: number): number => {
    let t = input;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: channel(h + 1 / 3) * 255, g: channel(h) * 255, b: channel(h - 1 / 3) * 255, a: alphaValue(parts.alpha) };
};

export function parseColor(value: string): Color {
  if (typeof value !== "string" || !value.trim()) fail("Enter a supported sRGB color.", "color");
  const input = value.trim();
  const parsed = parseHex(input) ?? parseRgb(input) ?? parseHsl(input);
  if (!parsed) return fail("Use HEX, RGB/RGBA, or HSL/HSLA sRGB syntax.", "color");
  return parsed;
}

const byte = (value: number): string => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0").toUpperCase();

export function toHex(color: Color): string {
  const base = `#${byte(color.r)}${byte(color.g)}${byte(color.b)}`;
  return color.a < 1 ? `${base}${byte(color.a * 255)}` : base;
}

export function toRgb(color: Color): string {
  const channels = [color.r, color.g, color.b].map((value) => Math.round(Math.min(255, Math.max(0, value))));
  return color.a < 1 ? `rgba(${channels.join(", ")}, ${Number(color.a.toFixed(4))})` : `rgb(${channels.join(", ")})`;
}

type HslValues = { h: number; s: number; l: number; a: number };

const hslValues = (color: Color): HslValues => {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;
  if (delta === 0) return { h: 0, s: 0, l: l * 100, a: color.a };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100, a: color.a };
};

export function toHsl(color: Color): string {
  const values = hslValues(color);
  const output = `hsl(${Number(values.h.toFixed(3))} ${Number(values.s.toFixed(3))}% ${Number(values.l.toFixed(3))}%`;
  return color.a < 1 ? `${output} / ${Number(color.a.toFixed(4))})` : `${output})`;
}

const fromHsl = (h: number, s: number, l: number, a: number): Color => {
  const hue = (((h % 360) + 360) % 360) / 360;
  const saturation = Math.min(100, Math.max(0, s)) / 100;
  const lightness = Math.min(100, Math.max(0, l)) / 100;
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channel = (input: number): number => {
    let t = input;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return saturation === 0
    ? { r: lightness * 255, g: lightness * 255, b: lightness * 255, a }
    : { r: channel(hue + 1 / 3) * 255, g: channel(hue) * 255, b: channel(hue - 1 / 3) * 255, a };
};

const format = (color: Color, output: string): string => {
  if (output === "HEX") return toHex(color);
  if (output === "RGB") return toRgb(color);
  if (output === "HSL") return toHsl(color);
  return fail("Choose HEX, RGB, or HSL output.", "outputFormat");
};

type Stop = { color: Color; position: number; order: number };

const cssStops = (raw: string): Stop[] => {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2 || lines.length > 12) fail("Use 2–12 color stops.", "stops");
  return lines.map((line, order) => {
    const match = new RegExp(`^(.+?)\\s+(${NUMBER})%$`).exec(line);
    if (!match) return fail(`Stop ${order + 1} must be COLOR POSITION%.`, "stops");
    const position = bounded(number(match[2], "stop position"), 0, 100, "Stop positions must be 0–100%.", "stops");
    return { color: parseColor(match[1]), position, order };
  }).sort((left, right) => left.position - right.position || left.order - right.order);
};

const palette = (seed: Color, scheme: string): Color[] => {
  const base = hslValues(seed);
  if (scheme === "Monochromatic") {
    return [base.l - 25, base.l - 12, base.l, base.l + 12, base.l + 25].map((lightness) => fromHsl(base.h, base.s, Math.min(95, Math.max(5, lightness)), base.a));
  }
  const offsets = scheme === "Complementary" ? [0, 180] : scheme === "Split-complementary" ? [0, 150, 210] : scheme === "Triadic" ? [0, 120, 240] : [0, 30, 60, 90, 120];
  return offsets.map((offset) => fromHsl(base.h + offset, base.s, base.l, base.a));
};

const composite = (top: Color, bottom: Color): Color => {
  const alpha = top.a + bottom.a * (1 - top.a);
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / alpha,
    g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / alpha,
    b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / alpha,
    a: alpha,
  };
};

const luminance = (color: Color): number => {
  const channels = [color.r, color.g, color.b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const cssLength = (token: string, field: string): number => {
  const match = new RegExp(`^(${NUMBER})(?:px)?$`).exec(token.trim());
  if (!match) return fail(`${field} must be a number in px units.`, field);
  return number(match[1], field);
};

const serializeLength = (value: number): string => value === 0 ? "0" : `${value}px`;

const pickerAlpha = (value: unknown): number | undefined => {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const percentage = number(String(value), "alpha");
  return bounded(percentage, 0, 100, "Alpha must be between 0 and 100.", "alpha") / 100;
};

export async function runColor(id: string, values: ColorValues): Promise<ColorResult> {
  if (id === "color-converter" || id === "color-picker") {
    const parsed = parseColor(String(values.color ?? ""));
    const alpha = id === "color-picker" ? pickerAlpha(values.alpha) : undefined;
    const color = alpha === undefined ? parsed : { ...parsed, a: alpha };
    const output = id === "color-converter" ? String(values.outputFormat ?? "RGB") : "HEX";
    const converted = format(color, output);
    return { data: { detectedSource: "sRGB", hex: toHex(color), rgb: toRgb(color), hsl: toHsl(color), alpha: color.a, converted }, text: converted };
  }

  if (id === "palette-generator") {
    const scheme = String(values.scheme ?? "Analogous");
    if (!["Analogous", "Complementary", "Split-complementary", "Triadic", "Monochromatic"].includes(scheme)) fail("Choose a supported palette scheme.", "scheme");
    const colors = palette(parseColor(String(values.color ?? "")), scheme);
    const output = colors.map((color, index) => ({ name: `--palette-${index + 1}`, hex: toHex(color), rgb: toRgb(color), hsl: toHsl(color) }));
    return { data: { palette: output, css: output.map((entry) => `  ${entry.name}: ${entry.hex};`).join("\n"), json: JSON.stringify(output, null, 2) }, text: output.map((entry) => entry.hex).join("\n") };
  }

  if (id === "contrast-checker") {
    const foreground = parseColor(String(values.foreground ?? ""));
    const background = parseColor(String(values.background ?? ""));
    const backdrop = parseColor(String(values.backdrop ?? "#FFFFFF"));
    if (backdrop.a !== 1) fail("Backdrop must be opaque.", "backdrop");
    const effectiveBackground = composite(background, backdrop);
    const effectiveForeground = composite(foreground, effectiveBackground);
    const ratio = (Math.max(luminance(effectiveForeground), luminance(effectiveBackground)) + 0.05) / (Math.min(luminance(effectiveForeground), luminance(effectiveBackground)) + 0.05);
    return {
      data: {
        ratio,
        displayRatio: ratio.toFixed(2),
        effectiveForeground: toHex(effectiveForeground),
        effectiveBackground: toHex(effectiveBackground),
        normalAA: ratio >= 4.5,
        normalAAA: ratio >= 7,
        largeAA: ratio >= 3,
        largeAAA: ratio >= 4.5,
      },
      text: `Contrast ratio: ${ratio.toFixed(2)}:1`,
    };
  }

  if (id === "css-gradient-generator") {
    const type = String(values.type ?? "Linear");
    if (type !== "Linear" && type !== "Radial") fail("Choose Linear or Radial gradient type.", "type");
    const angle = bounded(number(String(values.angle ?? 90), "angle"), 0, 360, "Linear angle must be 0–360 degrees.", "angle");
    const stops = cssStops(String(values.stops ?? ""));
    const serialized = stops.map((stop) => `${toRgb(stop.color)} ${stop.position}%`).join(", ");
    const css = type === "Radial" ? `radial-gradient(circle, ${serialized})` : `linear-gradient(${angle}deg, ${serialized})`;
    return { data: { css, stops: stops.map((stop) => ({ color: toHex(stop.color), position: stop.position })) }, text: css };
  }

  if (id === "box-shadow-generator") {
    const lines = String(values.layers ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 1 || lines.length > 8) fail("Enter 1–8 shadow layers.", "layers");
    const serialized = lines.map((line, index) => {
      const tokens = line.split(/\s+/);
      const inset = tokens[0]?.toLowerCase() === "inset";
      const offset = inset ? tokens.slice(1) : tokens;
      if (offset.length < 5) fail(`Shadow layer ${index + 1} needs x y blur spread color.`, "layers");
      const x = cssLength(offset[0], "offset");
      const y = cssLength(offset[1], "offset");
      const blur = cssLength(offset[2], "blur");
      const spread = cssLength(offset[3], "spread");
      if (blur < 0) fail("Blur radius cannot be negative.", "layers");
      const color = parseColor(offset.slice(4).join(" "));
      return `${inset ? "inset " : ""}${serializeLength(x)} ${serializeLength(y)} ${serializeLength(blur)} ${serializeLength(spread)} ${toRgb(color)}`;
    }).join(",\n");
    return { data: { css: serialized }, text: serialized };
  }

  if (id === "border-radius-generator") {
    const unit = String(values.unit ?? "px");
    const mode = String(values.mode ?? "Uniform");
    if (unit !== "px" && unit !== "%") fail("Radius unit must be px or %.", "unit");
    if (mode !== "Uniform" && mode !== "Independent corners" && mode !== "Elliptical") fail("Choose a supported radius mode.", "mode");
    const raw = String(values.values ?? "").trim();
    if (!raw) fail("Enter valid radius values.", "values");
    const tokens = raw.split(/\s+/);
    const valuesOut = tokens.map((token) => {
      const match = new RegExp(`^(${NUMBER})(px|%)?$`).exec(token);
      if (!match || (match[2] !== undefined && match[2] !== unit)) return fail(`Radius values must use ${unit} units.`, "values");
      const value = number(match[1], "radius");
      if (value < 0) fail("Radius cannot be negative.", "values");
      return `${value}${unit}`;
    });
    if (mode === "Uniform" && valuesOut.length !== 1) fail("Uniform mode requires one value.", "values");
    if (mode === "Independent corners" && valuesOut.length !== 4) fail("Independent corners require four values.", "values");
    if (mode === "Elliptical" && valuesOut.length !== 8) fail("Elliptical mode requires eight values.", "values");
    const css = mode === "Uniform"
      ? `border-radius: ${valuesOut[0]};`
      : mode === "Independent corners"
        ? `border-radius: ${valuesOut.join(" ")};`
        : `border-radius: ${valuesOut.slice(0, 4).join(" ")} / ${valuesOut.slice(4).join(" ")};`;
    return { data: { css }, text: css };
  }

  return fail("Unsupported Color & CSS tool.");
}
