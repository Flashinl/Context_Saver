import { encode } from "gpt-tokenizer";

/** GPT-4 / Claude-style context window reference for savings estimate */
export const DEFAULT_CONTEXT_WINDOW = 128_000;

/** Default input-token price: GPT-4o ($2.50 / 1M input tokens) */
export const DEFAULT_PRICE_PER_MILLION = 2.5;

export function countTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}

export function estimateCostUsd(tokens: number, pricePerMillion = DEFAULT_PRICE_PER_MILLION): number {
  return (tokens / 1_000_000) * pricePerMillion;
}

export function formatCostUsd(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(2)}`;
}

export function computeMetrics(
  original: string,
  optimized: string,
  contextWindow = DEFAULT_CONTEXT_WINDOW,
  pricePerMillion = DEFAULT_PRICE_PER_MILLION,
) {
  const originalTokens = countTokens(original);
  const optimizedTokens = countTokens(optimized);
  const tokensSaved = Math.max(0, originalTokens - optimizedTokens);
  const reductionPercent =
    originalTokens === 0
      ? 0
      : Number(((tokensSaved / originalTokens) * 100).toFixed(2));
  const contextWindowSavedPercent =
    contextWindow === 0
      ? 0
      : Number(((tokensSaved / contextWindow) * 100).toFixed(2));
  const estimatedCostSaved = estimateCostUsd(tokensSaved, pricePerMillion);

  return {
    original: originalTokens,
    optimized: optimizedTokens,
    reductionPercent,
    tokensSaved,
    contextWindowSavedPercent,
    estimatedCostSaved,
  };
}
