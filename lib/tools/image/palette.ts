import { ImageError } from "./types";

export type Swatch = { hex: string; rgb: { r: number; g: number; b: number }; percentage: number };
/** Deterministic alpha-weighted k-means over bounded, evenly sampled RGB pixels. Percentages are approximate. */
export function extractPalette(pixels: Uint8ClampedArray, count: number): Swatch[] {
  if (!Number.isInteger(count) || count < 2 || count > 12) throw new ImageError("Choose 2–12 colors.", "colors");
  const samples: { rgb: number[]; weight: number }[] = [];
  const stride = Math.max(1, Math.ceil(pixels.length / 4 / 16_384));
  for (let p = 0; p + 3 < pixels.length; p += stride * 4) {
    if (pixels[p + 3]) samples.push({ rgb: [pixels[p], pixels[p + 1], pixels[p + 2]], weight: pixels[p + 3] / 255 });
  }
  if (!samples.length) throw new ImageError("The image contains no visible sampled pixels.", "file");
  const distance = (a: number[], b: number[]) => a.reduce((sum, n, i) => sum + (n - b[i]) ** 2, 0);
  const centers = [samples[0].rgb.slice()];
  while (centers.length < count) {
    let farthest = samples[0], maximum = 0;
    for (const sample of samples) {
      const d = Math.min(...centers.map(c => distance(c, sample.rgb))) * sample.weight;
      if (d > maximum) { farthest = sample; maximum = d; }
    }
    if (maximum === 0) break;
    centers.push(farthest.rgb.slice());
  }
  let weights: number[] = [];
  for (let iteration = 0; iteration < 12; iteration++) {
    const sums = centers.map(() => [0, 0, 0]); weights = centers.map(() => 0);
    for (const sample of samples) {
      let best = 0, minimum = Infinity;
      centers.forEach((center, index) => { const d = distance(center, sample.rgb); if (d < minimum) { minimum = d; best = index; } });
      weights[best] += sample.weight;
      sample.rgb.forEach((n, channel) => { sums[best][channel] += n * sample.weight; });
    }
    centers.forEach((center, i) => { if (weights[i]) center.forEach((_, c) => { center[c] = sums[i][c] / weights[i]; }); });
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return centers.map((center, i) => {
    const [r, g, b] = center.map(Math.round);
    return { hex: `#${[r, g, b].map(n => n.toString(16).padStart(2, "0")).join("").toUpperCase()}`, rgb: { r, g, b }, percentage: Math.round(weights[i] / total * 1000) / 10 };
  }).filter((_, i) => weights[i] > 0).sort((a, b) => b.percentage - a.percentage || (a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0));
}
