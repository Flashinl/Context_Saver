import type {
  OptimizationFlags,
  ParseContext,
  PipelineResult,
  SupportedLanguage,
} from "../types.js";
import { parseSource } from "../parser/tree-sitter-parser.js";
import {
  stripComments,
  minifyWhitespace,
  stubImports,
  skeletonize,
  collapseTypes,
  collapseLiterals,
} from "../optimizers/index.js";
import { computeMetrics } from "../tokens/estimator.js";
import { isValidSyntax } from "../parser/index.js";

function needsAstPass(flags: OptimizationFlags): boolean {
  return flags.stubImports || flags.collapseTypes || flags.skeletonMode;
}

export function optimizeSource(
  source: string,
  language: SupportedLanguage,
  flags: OptimizationFlags,
  contextWindow?: number,
): PipelineResult {
  const started = performance.now();
  let current = source;

  if (flags.stripComments) {
    current = stripComments(current, language);
  }

  if (needsAstPass(flags)) {
    let root = parseSource(language, current).rootNode;

    if (flags.stubImports) {
      current = stubImports(current, language, root);
      root = parseSource(language, current).rootNode;
    }

    if (flags.collapseTypes) {
      current = collapseTypes(current, language, root);
      root = parseSource(language, current).rootNode;
    }

    if (flags.skeletonMode) {
      current = skeletonize(current, language, root, true);
    }
  }

  if (flags.collapseLiterals) {
    current = collapseLiterals(current);
  }

  if (flags.minifyWhitespace) {
    current = minifyWhitespace(current, language);
  }

  const metrics = computeMetrics(source, current, contextWindow);

  return {
    original: source,
    optimized: current,
    language,
    metrics,
    flags,
    elapsedMs: Math.round(performance.now() - started),
  };
}

export function optimizeContext(ctx: ParseContext, flags: OptimizationFlags): PipelineResult {
  return optimizeSource(ctx.source, ctx.language, flags);
}

export function assertSyntaxValid(language: SupportedLanguage, source: string): boolean {
  return isValidSyntax(language, source);
}
