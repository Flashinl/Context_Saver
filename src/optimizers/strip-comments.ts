import type { SupportedLanguage } from "../types.js";

/**
 * Remove comments while preserving content inside string literals.
 * Handles line comments, block comments, JSDoc, and Python docstrings.
 */
export function stripComments(
  source: string,
  language: SupportedLanguage,
): string {
  if (language === "python") {
    return stripPythonComments(source);
  }
  return stripCStyleComments(source);
}

function stripCStyleComments(source: string): string {
  let result = "";
  let i = 0;
  let state:
    | "code"
    | "single"
    | "double"
    | "template"
    | "line_comment"
    | "block_comment" = "code";
  let templateBraceDepth = 0;

  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];

    switch (state) {
      case "code":
        if (ch === "/" && next === "/") {
          state = "line_comment";
          i += 2;
          continue;
        }
        if (ch === "/" && next === "*") {
          state = "block_comment";
          i += 2;
          continue;
        }
        if (ch === "'") {
          state = "single";
          result += ch;
          i++;
          continue;
        }
        if (ch === '"') {
          state = "double";
          result += ch;
          i++;
          continue;
        }
        if (ch === "`") {
          state = "template";
          templateBraceDepth = 0;
          result += ch;
          i++;
          continue;
        }
        result += ch;
        i++;
        break;

      case "single":
        result += ch;
        if (ch === "\\" && next !== undefined) {
          result += next;
          i += 2;
          continue;
        }
        if (ch === "'") state = "code";
        i++;
        break;

      case "double":
        result += ch;
        if (ch === "\\" && next !== undefined) {
          result += next;
          i += 2;
          continue;
        }
        if (ch === '"') state = "code";
        i++;
        break;

      case "template":
        result += ch;
        if (ch === "\\" && next !== undefined) {
          result += next;
          i += 2;
          continue;
        }
        if (ch === "$" && next === "{") {
          templateBraceDepth++;
          result += next;
          i += 2;
          continue;
        }
        if (ch === "}" && templateBraceDepth > 0) {
          templateBraceDepth--;
        }
        if (ch === "`" && templateBraceDepth === 0) state = "code";
        i++;
        break;

      case "line_comment":
        if (ch === "\n") {
          result += ch;
          state = "code";
        }
        i++;
        break;

      case "block_comment":
        if (ch === "*" && next === "/") {
          state = "code";
          i += 2;
          continue;
        }
        if (ch === "\n") result += ch;
        i++;
        break;
    }
  }

  return result;
}

function stripPythonComments(source: string): string {
  let result = "";
  let i = 0;
  let state: "code" | "single" | "double" | "triple_single" | "triple_double" | "comment" =
    "code";

  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];
    const third = source[i + 2];

    switch (state) {
      case "code":
        if (ch === "#") {
          state = "comment";
          i++;
          continue;
        }
        if (ch === "'" && next === "'" && third === "'") {
          state = "triple_single";
          i += 3;
          continue;
        }
        if (ch === '"' && next === '"' && third === '"') {
          state = "triple_double";
          i += 3;
          continue;
        }
        if (ch === "'") {
          state = "single";
          result += ch;
          i++;
          continue;
        }
        if (ch === '"') {
          state = "double";
          result += ch;
          i++;
          continue;
        }
        result += ch;
        i++;
        break;

      case "single":
        result += ch;
        if (ch === "\\" && next !== undefined) {
          result += next;
          i += 2;
          continue;
        }
        if (ch === "'") state = "code";
        i++;
        break;

      case "double":
        result += ch;
        if (ch === "\\" && next !== undefined) {
          result += next;
          i += 2;
          continue;
        }
        if (ch === '"') state = "code";
        i++;
        break;

      case "triple_single":
        if (ch === "'" && next === "'" && third === "'") {
          state = "code";
          i += 3;
          continue;
        }
        i++;
        break;

      case "triple_double":
        if (ch === '"' && next === '"' && third === '"') {
          state = "code";
          i += 3;
          continue;
        }
        i++;
        break;

      case "comment":
        if (ch === "\n") {
          result += ch;
          state = "code";
        }
        i++;
        break;
    }
  }

  return result;
}
