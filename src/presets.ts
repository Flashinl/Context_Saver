import type { CompressionPreset, OptimizationFlags } from "./types.js";

const SAFE: OptimizationFlags = {
  stripComments: true,
  minifyWhitespace: true,
  stubImports: true,
  collapseTypes: false,
  skeletonMode: false,
  collapseLiterals: false,
};

const BALANCED: OptimizationFlags = {
  ...SAFE,
  collapseTypes: true,
};

const AGGRESSIVE: OptimizationFlags = {
  ...BALANCED,
  skeletonMode: true,
  collapseLiterals: true,
};

const PRESET_MAP: Record<CompressionPreset, OptimizationFlags> = {
  safe: SAFE,
  balanced: BALANCED,
  aggressive: AGGRESSIVE,
};

export function flagsFromPreset(preset: CompressionPreset): OptimizationFlags {
  return { ...PRESET_MAP[preset] };
}

export function resolveFlags(input: Partial<OptimizationFlags> & { preset?: CompressionPreset }): OptimizationFlags {
  const base = input.preset ? flagsFromPreset(input.preset) : { ...SAFE };
  return { ...base, ...input };
}

export function presetLabel(preset: CompressionPreset): string {
  switch (preset) {
    case "safe":
      return "safe — strip noise, keep logic";
    case "balanced":
      return "balanced — collapse type declarations";
    case "aggressive":
      return "aggressive — skeleton signatures only";
  }
}
