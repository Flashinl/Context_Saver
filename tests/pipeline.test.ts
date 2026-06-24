import { describe, it, expect } from "vitest";
import { stripComments } from "../src/optimizers/strip-comments.js";
import { minifyWhitespace } from "../src/optimizers/minify-whitespace.js";
import { stubImports } from "../src/optimizers/stub-imports.js";
import { skeletonize } from "../src/optimizers/skeleton.js";
import { collapseTypes } from "../src/optimizers/collapse-types.js";
import { collapseLiterals } from "../src/optimizers/collapse-literals.js";
import { optimizeSource } from "../src/pipeline/index.js";
import { countTokens, computeMetrics } from "../src/tokens/estimator.js";
import { isValidSyntax, parseSource } from "../src/parser/index.js";
import { flagsFromPreset } from "../src/presets.js";

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

describe("stripComments", () => {
  it("removes comments but keeps string literals", () => {
    const result = stripComments(TS_SAMPLE, "typescript");
    expect(result).not.toContain("// Header");
    expect(result).not.toContain("/**");
    expect(result).toContain("`/users/${id}`");
  });
});

describe("stubImports", () => {
  it("collapses imports to a single summary line", () => {
    const stripped = stripComments(TS_SAMPLE, "typescript");
    const result = stubImports(stripped, "typescript");
    expect(result).toMatch(/\/\/ imports:/);
    expect(result).toContain("axios");
    expect(result).not.toMatch(/^import /m);
  });
});

describe("collapseTypes", () => {
  it("stubs interface bodies", () => {
    const root = parseSource("typescript", TS_SAMPLE).rootNode;
    const result = collapseTypes(TS_SAMPLE, "typescript", root);
    expect(result).toContain("interface User");
    expect(result).toContain("{}");
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

describe("collapseLiterals", () => {
  it("shortens long strings", () => {
    const long = `const x = "${"a".repeat(40)}";`;
    const result = collapseLiterals(long);
    expect(result).toBe('const x = "";');
  });
});

describe("presets", () => {
  it("safe keeps logic, aggressive skeletons", () => {
    const safe = optimizeSource(TS_SAMPLE, "typescript", flagsFromPreset("safe"));
    const aggressive = optimizeSource(TS_SAMPLE, "typescript", flagsFromPreset("aggressive"));

    expect(safe.optimized).toContain("axios.get");
    expect(aggressive.optimized).not.toContain("axios.get");
    expect(aggressive.metrics.optimized).toBeLessThan(safe.metrics.optimized);
  });

  it("balanced sits between safe and aggressive", () => {
    const safe = optimizeSource(TS_SAMPLE, "typescript", flagsFromPreset("safe"));
    const balanced = optimizeSource(TS_SAMPLE, "typescript", flagsFromPreset("balanced"));
    const aggressive = optimizeSource(TS_SAMPLE, "typescript", flagsFromPreset("aggressive"));

    expect(balanced.metrics.optimized).toBeLessThan(safe.metrics.optimized);
    expect(aggressive.metrics.optimized).toBeLessThanOrEqual(balanced.metrics.optimized);
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

  it("records elapsed time", () => {
    const result = optimizeSource(TS_SAMPLE, "typescript", flagsFromPreset("safe"));
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });
});

describe("token estimator", () => {
  it("counts and diffs tokens", () => {
    expect(countTokens("hello world")).toBeGreaterThan(0);
    const metrics = computeMetrics(TS_SAMPLE, "x", 128_000);
    expect(metrics.original).toBeGreaterThan(metrics.optimized);
  });
});
