import type { SupportedLanguage } from "../types.js";

/**
 * Collapse redundant whitespace while preserving string literals and syntax validity.
 */
export function minifyWhitespace(
  source: string,
  language?: SupportedLanguage,
): string {
  if (language === "python") {
    return minifyPythonWhitespace(source);
  }
  return minifyCStyleWhitespace(source);
}

function minifyPythonWhitespace(source: string): string {
  const lines = source.split("\n");
  const result: string[] = [];
  let blankRun = 0;

  for (const line of lines) {
    const trimmedEnd = line.trimEnd();
    if (trimmedEnd.length === 0) {
      blankRun++;
      if (blankRun <= 1) result.push("");
      continue;
    }
    blankRun = 0;
    result.push(trimmedEnd);
  }

  return result.join("\n").trim();
}

function minifyCStyleWhitespace(source: string): string {
  let result = "";
  let i = 0;
  let state: "code" | "single" | "double" | "template" = "code";
  let templateBraceDepth = 0;
  let pendingSpace = false;

  const flushSpace = () => {
    if (pendingSpace && result.length > 0) {
      const last = result[result.length - 1];
      const needsSpace =
        last !== undefined &&
        /[a-zA-Z0-9_$)\]}]/.test(last);
      if (needsSpace) result += " ";
    }
    pendingSpace = false;
  };

  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];

    if (state === "code") {
      if (ch === "'") {
        flushSpace();
        state = "single";
        result += ch;
        i++;
        continue;
      }
      if (ch === '"') {
        flushSpace();
        state = "double";
        result += ch;
        i++;
        continue;
      }
      if (ch === "`") {
        flushSpace();
        state = "template";
        templateBraceDepth = 0;
        result += ch;
        i++;
        continue;
      }

      if (ch === "/" && next === "/") {
        flushSpace();
        result += ch + next;
        i += 2;
        while (i < source.length && source[i] !== "\n") {
          result += source[i]!;
          i++;
        }
        continue;
      }

      if (/\s/.test(ch)) {
        pendingSpace = true;
        if (ch === "\n") {
          const trimmed = result.trimEnd();
          const lastNonSpace = trimmed[trimmed.length - 1];
          if (lastNonSpace === "{" || lastNonSpace === "[" || lastNonSpace === "(") {
            pendingSpace = false;
          }
        }
        i++;
        continue;
      }

      flushSpace();

      if (ch === ";" && next === "\n") {
        result += ch;
        i += 2;
        continue;
      }

      if ((ch === "{" || ch === "}" || ch === ";" || ch === ",") && result.endsWith(" ")) {
        result = result.slice(0, -1);
      }

      result += ch;
      i++;
      continue;
    }

    result += ch;

    if (state === "single") {
      if (ch === "\\" && next !== undefined) {
        result += next;
        i += 2;
        continue;
      }
      if (ch === "'") state = "code";
    } else if (state === "double") {
      if (ch === "\\" && next !== undefined) {
        result += next;
        i += 2;
        continue;
      }
      if (ch === '"') state = "code";
    } else if (state === "template") {
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
      if (ch === "}" && templateBraceDepth > 0) templateBraceDepth--;
      if (ch === "`" && templateBraceDepth === 0) state = "code";
    }

    i++;
  }

  return result.trim();
}
