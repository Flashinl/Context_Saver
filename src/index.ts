#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { detectLanguage } from "./parser/index.js";
import { optimizeSource, assertSyntaxValid } from "./pipeline/index.js";
import { promptForOptions, flagsFromCliArgs } from "./cli/prompts.js";
import { renderSummaryCard, renderMultiFileSummary } from "./cli/summary.js";
import { collectSourceFiles, relPath } from "./utils/files.js";
import type { CompressionPreset, OptimizationFlags, PipelineResult } from "./types.js";

const program = new Command();

program
  .name("context-diet")
  .description("Compress source files for LLM context — fast, local, no API calls")
  .version("1.2.0")
  .argument("[paths...]", "Files or directories to compress")
  .option("-i, --interactive", "Prompt for options")
  .option(
    "-p, --preset <level>",
    "safe | balanced | aggressive",
    "balanced",
  )
  .option("--no-comments", "Keep comments")
  .option("--no-whitespace", "Keep formatting")
  .option("--no-imports", "Keep import statements")
  .option("--skeleton", "Strip function bodies (implies aggressive)")
  .option("--all", "Alias for --preset aggressive")
  .option("-o, --output <dir>", "Write .diet files to this directory")
  .option("-w, --context-window <n>", "Window size for savings estimate", "128000")
  .option("--price-per-million <usd>", "Input token price per 1M tokens (default: 2.50)", "2.5")
  .option("--print", "Print compressed source to stdout")
  .option("--quiet", "Summary only, no per-file noise")
  .action(async (paths: string[], options) => {
    try {
      await run(paths, options);
    } catch (err) {
      console.error(pc.red("error:"), err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

interface RunOptions {
  interactive?: boolean;
  preset?: string;
  comments?: boolean;
  whitespace?: boolean;
  imports?: boolean;
  skeleton?: boolean;
  all?: boolean;
  output?: string;
  contextWindow?: string;
  pricePerMillion?: string;
  print?: boolean;
  quiet?: boolean;
}

async function run(argvPaths: string[], options: RunOptions) {
  let inputPaths = argvPaths.map((p) => resolve(p));
  let flags: OptimizationFlags;
  let contextWindow = Number(options.contextWindow ?? 128_000);
  const pricePerMillion = Math.max(0, Number(options.pricePerMillion ?? 2.5));
  if (Number.isNaN(pricePerMillion)) {
    console.error(pc.red("error: --price-per-million must be a number"));
    process.exit(1);
  }
  let writeOutput = Boolean(options.output);
  const outputDir = options.output ? resolve(options.output) : undefined;

  if (options.interactive || inputPaths.length === 0) {
    const prompted = await promptForOptions(inputPaths);
    inputPaths = prompted.files.map((f: string) => resolve(f));
    flags = prompted.flags;
    contextWindow = prompted.contextWindow;
    writeOutput = prompted.writeOutput;
  } else {
    const preset = options.all
      ? "aggressive"
      : (options.preset as CompressionPreset) ?? "balanced";
    flags = flagsFromCliArgs({
      preset,
      comments: options.comments,
      whitespace: options.whitespace,
      imports: options.imports,
      skeleton: options.skeleton,
      all: options.all,
    });
  }

  const filePaths = await collectSourceFiles(inputPaths);
  if (filePaths.length === 0) {
    console.error(pc.red("No supported source files found."));
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(pc.bold("context-diet") + pc.dim(` · ${filePaths.length} file(s) · preset ${describePreset(flags)}`));
  }

  const results: Array<{ path: string; result: PipelineResult }> = [];
  let totalMs = 0;

  for (const filePath of filePaths) {
    const language = detectLanguage(filePath)!;
    const source = await readFile(filePath, "utf-8");
    const result = optimizeSource(source, language, flags, contextWindow, pricePerMillion);
    totalMs += result.elapsedMs;

    if (!assertSyntaxValid(language, result.optimized) && !options.quiet) {
      console.warn(pc.yellow(`warn: syntax check failed for ${relPath(filePath)}`));
    }

    results.push({ path: filePath, result });

    if (options.print) {
      console.log(pc.dim(`--- ${relPath(filePath)} ---`));
      console.log(result.optimized);
      console.log();
    }

    if (writeOutput && outputDir) {
      await mkdir(outputDir, { recursive: true });
      const outName = relPath(filePath).replace(/[/\\]/g, "__") + ".diet";
      const outPath = join(outputDir, outName);
      await writeFile(outPath, result.optimized, "utf-8");
      if (!options.quiet) console.log(pc.green(`wrote ${outPath}`));
    }
  }

  if (results.length === 1) {
    const { path, result } = results[0]!;
    console.log(renderSummaryCard(result.metrics, relPath(path), contextWindow, result.elapsedMs));
  } else {
    console.log(
      renderMultiFileSummary(
        results.map((r) => ({ path: r.path, metrics: r.result.metrics })),
        contextWindow,
        totalMs,
      ),
    );
  }
}

function describePreset(flags: OptimizationFlags): string {
  if (flags.skeletonMode) return "aggressive";
  if (flags.collapseTypes) return "balanced";
  return "safe";
}

program.parse();
