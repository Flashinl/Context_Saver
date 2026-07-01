#!/usr/bin/env node
/**
 * Run compression benchmarks for README reporting.
 * Usage: npx tsx scripts/benchmark.ts
 */
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { optimizeSource } from "../src/pipeline/index.js";
import { flagsFromPreset } from "../src/presets.js";
import type { CompressionPreset, SupportedLanguage } from "../src/types.js";
import { detectLanguage } from "../src/parser/languages.js";

const BENCH_DIR = join(import.meta.dirname, "../tests/benchmarks");
const FILES = [
  "express-controller.ts",
  "react-hook.ts",
  "python-service.py",
];

const PRESETS: CompressionPreset[] = ["safe", "balanced", "aggressive"];

async function main() {
  const rows: string[] = [];

  for (const file of FILES) {
    const path = join(BENCH_DIR, file);
    const source = await readFile(path, "utf-8");
    const language = detectLanguage(path) as SupportedLanguage;
    const label = file.replace(/\.(ts|py)$/, "").replace(/-/g, " ");

    for (const preset of PRESETS) {
      const result = optimizeSource(source, language, flagsFromPreset(preset));
      const m = result.metrics;
      rows.push(
        `| ${label} | ${preset} | ${m.original} | ${m.optimized} | ${m.reductionPercent}% |`,
      );
    }
  }

  console.log("| File | Preset | Before | After | Saved |");
  console.log("|------|--------|--------|-------|-------|");
  for (const row of rows) console.log(row);
}

main();
