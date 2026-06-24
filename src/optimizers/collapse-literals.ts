const MIN_COLLAPSE_LENGTH = 32;

/**
 * Replace long string/template literals with empty placeholders.
 * Only used in aggressive mode — the model still sees that a literal exists.
 */
export function collapseLiterals(source: string): string {
  let result = "";
  let i = 0;
  let state: "code" | "single" | "double" | "template" = "code";
  let templateBraceDepth = 0;
  let literalStart = 0;
  let quote: "'" | '"' | "`" | null = null;

  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];

    if (state === "code") {
      if (ch === "'" || ch === '"' || ch === "`") {
        quote = ch;
        literalStart = i;
        state = ch === "'" ? "single" : ch === '"' ? "double" : "template";
        if (ch === "`") templateBraceDepth = 0;
        i++;
        continue;
      }
      result += ch;
      i++;
      continue;
    }

    if (state === "single" || state === "double") {
      if (ch === "\\" && next !== undefined) {
        i += 2;
        continue;
      }
      if ((state === "single" && ch === "'") || (state === "double" && ch === '"')) {
        const literal = source.slice(literalStart, i + 1);
        result += literal.length >= MIN_COLLAPSE_LENGTH ? (quote === "'" ? "''" : '""') : literal;
        state = "code";
        quote = null;
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (state === "template") {
      if (ch === "\\" && next !== undefined) {
        i += 2;
        continue;
      }
      if (ch === "$" && next === "{") {
        templateBraceDepth++;
        i += 2;
        continue;
      }
      if (ch === "}" && templateBraceDepth > 0) {
        templateBraceDepth--;
        i++;
        continue;
      }
      if (ch === "`" && templateBraceDepth === 0) {
        const literal = source.slice(literalStart, i + 1);
        result += literal.length >= MIN_COLLAPSE_LENGTH ? "``" : literal;
        state = "code";
        quote = null;
        i++;
        continue;
      }
      i++;
    }
  }

  return result;
}
