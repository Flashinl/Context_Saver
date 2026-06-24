import type Parser from "tree-sitter";
import type { SupportedLanguage } from "../types.js";
import { parseSource, walkTree } from "../parser/tree-sitter-parser.js";

interface ByteRange {
  start: number;
  end: number;
}

const PROTECTED_NODE_TYPES = new Set([
  "string",
  "string_fragment",
  "string_literal",
  "template_string",
  "template_literal",
  "regex",
  "regex_pattern",
  "interpreted_string_literal",
  "raw_string_literal",
  "concatenated_string",
]);

const COMMENT_NODE_TYPES = new Set(["comment"]);

/**
 * Strip comments using tree-sitter to identify string/template/regex spans.
 * All removals are computed against the original source in one pass so byte
 * offsets stay consistent.
 */
export function stripComments(
  source: string,
  language: SupportedLanguage,
): string {
  const tree = parseSource(language, source);
  const protectedRanges = mergeRanges(collectProtectedRanges(tree.rootNode));
  const docstringRanges =
    language === "python" ? collectPythonDocstringRanges(tree.rootNode) : [];

  const removalRanges: ByteRange[] = [];

  walkTree(tree.rootNode, (node) => {
    if (COMMENT_NODE_TYPES.has(node.type)) {
      removalRanges.push({ start: node.startIndex, end: node.endIndex });
    }
  });

  removalRanges.push(...scanCommentRanges(source, language, protectedRanges));

  if (language === "python") {
    removalRanges.push(...docstringRanges);
  }

  return removeRanges(source, mergeRanges(removalRanges));
}

function collectProtectedRanges(root: Parser.SyntaxNode): ByteRange[] {
  const ranges: ByteRange[] = [];

  walkTree(root, (node) => {
    if (PROTECTED_NODE_TYPES.has(node.type)) {
      ranges.push({ start: node.startIndex, end: node.endIndex });
    }
  });

  return ranges;
}

function collectPythonDocstringRanges(root: Parser.SyntaxNode): ByteRange[] {
  const ranges: ByteRange[] = [];

  const firstDocstring = (block: Parser.SyntaxNode) => {
    for (let i = 0; i < block.namedChildCount; i++) {
      const child = block.namedChild(i)!;
      if (child.type === "expression_statement") {
        const str = child.namedChildren[0];
        if (str?.type === "string") {
          ranges.push({ start: child.startIndex, end: child.endIndex });
        }
        break;
      }
      if (child.type !== "comment") break;
    }
  };

  if (root.type === "module") firstDocstring(root);

  walkTree(root, (node) => {
    if (node.type === "function_definition" || node.type === "class_definition") {
      const body = node.childForFieldName("body");
      if (body) firstDocstring(body);
    }
  });

  return ranges;
}

function scanCommentRanges(
  source: string,
  language: SupportedLanguage,
  protectedRanges: ByteRange[],
): ByteRange[] {
  const removals: ByteRange[] = [];
  let i = 0;

  while (i < source.length) {
    if (inRange(i, protectedRanges)) {
      i++;
      continue;
    }

    const ch = source[i]!;
    const next = source[i + 1];

    if (language === "python") {
      if (ch === "#") {
        const start = i;
        while (i < source.length && source[i] !== "\n") i++;
        removals.push({ start, end: i });
        continue;
      }
      i++;
      continue;
    }

    if (ch === "/" && next === "/") {
      const start = i;
      i += 2;
      while (i < source.length && source[i] !== "\n") i++;
      removals.push({ start, end: i });
      continue;
    }

    if (ch === "/" && next === "*") {
      const start = i;
      i += 2;
      while (i < source.length) {
        if (source[i] === "*" && source[i + 1] === "/") {
          i += 2;
          break;
        }
        i++;
      }
      removals.push({ start, end: i });
      continue;
    }

    i++;
  }

  return removals;
}

function removeRanges(source: string, ranges: ByteRange[]): string {
  if (ranges.length === 0) return source;
  const sorted = [...ranges].sort((a, b) => b.start - a.start);
  let result = source;
  for (const range of sorted) {
    result = result.slice(0, range.start) + result.slice(range.end);
  }
  return result;
}

function mergeRanges(ranges: ByteRange[]): ByteRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: ByteRange[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push(cur);
    }
  }

  return merged;
}

function inRange(index: number, ranges: ByteRange[]): boolean {
  for (const r of ranges) {
    if (index >= r.start && index < r.end) return true;
    if (r.start > index) break;
  }
  return false;
}
