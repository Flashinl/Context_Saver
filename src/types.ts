export type SupportedLanguage = "javascript" | "typescript" | "python";

export type CompressionPreset = "safe" | "balanced" | "aggressive";

export interface OptimizationFlags {
  stripComments: boolean;
  minifyWhitespace: boolean;
  stubImports: boolean;
  /** Collapse interfaces, enums, and large type aliases */
  collapseTypes: boolean;
  /** Replace function and method bodies with signature stubs */
  skeletonMode: boolean;
  /** Collapse long string literals to empty quotes (aggressive) */
  collapseLiterals: boolean;
}

export const DEFAULT_FLAGS: OptimizationFlags = {
  stripComments: true,
  minifyWhitespace: true,
  stubImports: true,
  collapseTypes: false,
  skeletonMode: false,
  collapseLiterals: false,
};

export interface TokenMetrics {
  original: number;
  optimized: number;
  reductionPercent: number;
  tokensSaved: number;
  contextWindowSavedPercent: number;
  estimatedCostSaved: number;
}

export interface PipelineResult {
  original: string;
  optimized: string;
  language: SupportedLanguage;
  metrics: TokenMetrics;
  flags: OptimizationFlags;
  elapsedMs: number;
}

export interface ParseContext {
  source: string;
  language: SupportedLanguage;
}
