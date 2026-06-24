import pc from "picocolors";
import type { TokenMetrics } from "../types.js";
import { DEFAULT_CONTEXT_WINDOW, formatCostUsd } from "../tokens/estimator.js";

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function renderSummaryCard(
  metrics: TokenMetrics,
  fileLabel: string,
  contextWindow = DEFAULT_CONTEXT_WINDOW,
  elapsedMs?: number,
): string {
  const width = 50;
  const pad = (s: string) => s.padEnd(width);

  const lines = [
    pc.bold(" compression summary"),
    "",
    `  ${pc.dim("input")}      ${formatNumber(metrics.original)} tokens`,
    `  ${pc.dim("output")}     ${pc.green(formatNumber(metrics.optimized))} tokens`,
    `  ${pc.dim("saved")}      ${pc.green(formatNumber(metrics.tokensSaved))} (${metrics.reductionPercent}%)`,
    `  ${pc.dim("api cost")}   ${pc.green(formatCostUsd(metrics.estimatedCostSaved))} estimated savings`,
    `  ${pc.dim("window")}    ${metrics.contextWindowSavedPercent}% of ${formatNumber(contextWindow)}`,
    `  ${pc.dim("file")}       ${fileLabel}`,
  ];

  if (elapsedMs !== undefined) {
    lines.push(`  ${pc.dim("time")}       ${elapsedMs}ms`);
  }

  const body = lines.map((l) => pc.dim("│") + " " + pad(l) + pc.dim("│")).join("\n");

  return `\n${pc.dim("┌" + "─".repeat(width + 2) + "┐")}\n${body}\n${pc.dim("└" + "─".repeat(width + 2) + "┘")}\n`;
}

export function renderMultiFileSummary(
  files: Array<{ path: string; metrics: TokenMetrics }>,
  contextWindow = DEFAULT_CONTEXT_WINDOW,
  elapsedMs?: number,
): string {
  const totals = files.reduce(
    (acc, f) => ({
      original: acc.original + f.metrics.original,
      optimized: acc.optimized + f.metrics.optimized,
      tokensSaved: acc.tokensSaved + f.metrics.tokensSaved,
      estimatedCostSaved: acc.estimatedCostSaved + f.metrics.estimatedCostSaved,
    }),
    { original: 0, optimized: 0, tokensSaved: 0, estimatedCostSaved: 0 },
  );

  const reductionPercent =
    totals.original === 0
      ? 0
      : Number(((totals.tokensSaved / totals.original) * 100).toFixed(2));

  const contextWindowSavedPercent = Number(
    ((totals.tokensSaved / contextWindow) * 100).toFixed(2),
  );

  return renderSummaryCard(
    {
      original: totals.original,
      optimized: totals.optimized,
      reductionPercent,
      tokensSaved: totals.tokensSaved,
      contextWindowSavedPercent,
      estimatedCostSaved: totals.estimatedCostSaved,
    },
    `${files.length} files`,
    contextWindow,
    elapsedMs,
  );
}
