#!/usr/bin/env node
/**
 * Copies the pdf.js runtime assets the browser needs into public/pdfjs/.
 *
 * Only the files we actually reference are published: the module worker,
 * character maps and the standard-font data. Nothing is fetched from a CDN.
 * The script is idempotent and runs after install and before the app build.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(projectRoot, "node_modules", "pdfjs-dist");
const targetRoot = join(projectRoot, "public", "pdfjs");
const workerSource = join(sourceRoot, "build", "pdf.worker.min.mjs");

if (!existsSync(workerSource)) {
  console.error(
    "[pdfjs-assets] node_modules/pdfjs-dist/build/pdf.worker.min.mjs is missing. " +
      "Run `npm install` before copying PDF.js assets.",
  );
  process.exit(1);
}

mkdirSync(targetRoot, { recursive: true });

function countFiles(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) =>
    entry.isFile(),
  ).length;
}

function copyDirectory(name) {
  const from = join(sourceRoot, name);
  const to = join(targetRoot, name);
  if (!existsSync(from)) {
    console.error(`[pdfjs-assets] Missing asset directory: ${from}`);
    process.exit(1);
  }
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  return countFiles(to);
}

const workerBytes = statSync(workerSource).size;
cpSync(workerSource, join(targetRoot, "pdf.worker.min.mjs"));
const cmapCount = copyDirectory("cmaps");
const fontCount = copyDirectory("standard_fonts");

console.log(
  `[pdfjs-assets] public/pdfjs ready: worker ${workerBytes} bytes, ` +
    `${cmapCount} cmaps, ${fontCount} standard fonts.`,
);
