import { describe, it, expect } from "vitest";
import { stripComments } from "../src/optimizers/strip-comments.js";
import { minifyWhitespace } from "../src/optimizers/minify-whitespace.js";
import { stubImports } from "../src/optimizers/stub-imports.js";
import { skeletonize } from "../src/optimizers/skeleton.js";
import { collapseTypes } from "../src/optimizers/collapse-types.js";
import { collapseLiterals } from "../src/optimizers/collapse-literals.js";
import { optimizeSource } from "../src/pipeline/index.js";
import { countTokens, computeMetrics, formatCostUsd } from "../src/tokens/estimator.js";
import { isValidSyntax, parseSource } from "../src/parser/index.js";
import { flagsFromPreset } from "../src/presets.js";
import { isLockfile, isBinaryExtension, isIgnored, loadGitignore } from "../src/utils/ignore.js";

const TS_SAMPLE = `// Header comment
import React from 'react';
import { useState, useEffect } from 'react';
import axios from 'axios';

/** Fetches user data */
export interface User {
  id: string;
  name: string;
  email: string;
}

export async function fetchUser(id: string): Promise<User> {
  const response = await axios.get(\`/users/\${id}\`);
  return response.data;
}

export const processData = (input: User[]): OutputState => {
  return input.map(u => u.name);
};
`;

const PY_SAMPLE = `"""Module docstring."""

import os
import json
from typing import List, Optional

DEBUG = True

def process_data(items: List[str]) -> Optional[str]:
    if not items:
        return None
    return json.dumps(items)

class Handler:
  def handle(self, event: dict) -> bool:
      return True
`;

describe("stripComments (AST-safe)", () => {
  it("removes comments but keeps string literals", () => {
    const result = stripComments(TS_SAMPLE, "typescript");
    expect(result).not.toContain("// Header");
    expect(result).not.toContain("/**");
    expect(result).toContain("`/users/${id}`");
  });

  it("preserves URLs inside strings (not treated as comments)", () => {
    const source = `const endpoint = "https://api.example.com/v1/users"; // real comment\nconst x = 1;`;
    const result = stripComments(source, "typescript");
    expect(result).toContain("https://api.example.com/v1/users");
    expect(result).not.toContain("real comment");
  });

  it("preserves // inside template literals", () => {
    const source = "const s = `protocol://host/path`; // trailing";
    const result = stripComments(source, "typescript");
    expect(result).toContain("protocol://host/path");
    expect(result).not.toContain("trailing");
  });

  it("removes Python docstrings via AST", () => {
    const result = stripComments(PY_SAMPLE, "python");
    expect(result).not.toContain("Module docstring");
    expect(result).not.toContain("#");
  });
});

describe("stubImports", () => {
  it("collapses imports to a single summary line", () => {
    const stripped = stripComments(TS_SAMPLE, "typescript");
    const result = stubImports(stripped, "typescript");
    expect(result).toMatch(/\/\/ imports:/);
    expect(result).not.toMatch(/^import /m);
  });
});

describe("collapseTypes", () => {
  it("stubs interface bodies", () => {
    const root = parseSource("typescript", TS_SAMPLE).rootNode;
    const result = collapseTypes(TS_SAMPLE, "typescript", root);
    expect(result).toContain("interface User");
    expect(result).not.toContain("email: string");
  });
});

describe("skeletonize", () => {
  it("replaces function bodies", () => {
    const stripped = stripComments(TS_SAMPLE, "typescript");
    const result = skeletonize(stripped, "typescript");
    expect(result).toContain("function fetchUser");
    expect(result).not.toContain("axios.get");
  });
});

describe("presets", () => {
  it("aggressive saves more tokens than safe", () => {
    const safe = optimizeSource(TS_SAMPLE, "typescript", flagsFromPreset("safe"));
    const aggressive = optimizeSource(TS_SAMPLE, "typescript", flagsFromPreset("aggressive"));
    expect(aggressive.metrics.optimized).toBeLessThan(safe.metrics.optimized);
  });
});

describe("token economics", () => {
  it("reports estimated API cost savings", () => {
    const metrics = computeMetrics(TS_SAMPLE, "x", 128_000, 2.5);
    expect(metrics.tokensSaved).toBeGreaterThan(0);
    expect(metrics.estimatedCostSaved).toBeGreaterThan(0);
    expect(formatCostUsd(metrics.estimatedCostSaved)).toMatch(/^\$/);
  });

  it("counts tokens with gpt-tokenizer", () => {
    expect(countTokens("hello world")).toBeGreaterThan(0);
  });
});

describe("gitignore and file filtering", () => {
  it("detects lockfiles", () => {
    expect(isLockfile("package-lock.json")).toBe(true);
    expect(isLockfile("app.ts")).toBe(false);
  });

  it("detects binary extensions", () => {
    expect(isBinaryExtension("logo.png")).toBe(true);
    expect(isBinaryExtension("index.ts")).toBe(false);
  });

  it("respects gitignore patterns", async () => {
    const ig = await loadGitignore(process.cwd());
    expect(isIgnored("node_modules/foo/bar.js", ig)).toBe(true);
    expect(isIgnored("dist/index.js", ig)).toBe(true);
  });
});

describe("optimizeSource", () => {
  it("validates typescript output", () => {
    const result = optimizeSource(TS_SAMPLE, "typescript", flagsFromPreset("balanced"));
    expect(isValidSyntax("typescript", result.optimized)).toBe(true);
  });

  it("validates python output", () => {
    const result = optimizeSource(PY_SAMPLE, "python", flagsFromPreset("balanced"));
    expect(isValidSyntax("python", result.optimized)).toBe(true);
  });
});
