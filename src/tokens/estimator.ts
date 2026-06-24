import { encode } from "gpt-tokenizer";

/** GPT-4 / Claude-style context window reference for savings estimate */
export const DEFAULT_CONTEXT_WINDOW = 128_000;

export function countTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}

export function computeMetrics(
  original: string,
  optimized: string,
  contextWindow = DEFAULT_CONTEXT_WINDOW,
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

  return {
    original: originalTokens,
    optimized: optimizedTokens,
    reductionPercent,
    tokensSaved,
    contextWindowSavedPercent,
  };
}
