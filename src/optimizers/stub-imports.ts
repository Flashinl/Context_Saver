import type Parser from "tree-sitter";
import type { SupportedLanguage } from "../types.js";
import { parseSource, walkTree } from "../parser/tree-sitter-parser.js";

interface ImportRange {
  start: number;
  end: number;
  modules: string[];
}

const JS_IMPORT_TYPES = new Set(["import_statement", "import_declaration"]);
const PY_IMPORT_TYPES = new Set(["import_statement", "import_from_statement"]);

export function stubImports(
  source: string,
  language: SupportedLanguage,
  root?: Parser.SyntaxNode,
): string {
  const tree = root ?? parseSource(language, source).rootNode;
  const ranges = collectImportRanges(tree, language, source);

  if (ranges.length === 0) return source;

  const modules = normalizeModules(ranges.flatMap((r) => r.modules));
  const commentPrefix = language === "python" ? "#" : "//";
  const summary = `${commentPrefix} imports: ${modules.join(",")}\n`;

  const sorted = [...ranges].sort((a, b) => b.start - a.start);
  let result = source;
  for (const range of sorted) {
    result = result.slice(0, range.start) + result.slice(range.end);
  }

  return summary + result.replace(/^\n+/, "");
}

function normalizeModules(modules: string[]): string[] {
  const packages = new Set<string>();
  for (const mod of modules) {
    const trimmed = mod.trim();
    if (!trimmed || trimmed.startsWith(".")) continue;
    const base = trimmed.split("/")[0]!.split(".")[0]!;
    if (base) packages.add(base);
  }
  return [...packages].sort();
}

function collectImportRanges(
  root: Parser.SyntaxNode,
  language: SupportedLanguage,
  source: string,
): ImportRange[] {
  const ranges: ImportRange[] = [];
  const types = language === "python" ? PY_IMPORT_TYPES : JS_IMPORT_TYPES;

  walkTree(root, (node) => {
    if (!types.has(node.type)) return;
    const modules = extractModuleNames(node, language);
    if (modules.length === 0) return;

    let start = node.startIndex;
    let end = node.endIndex;
    while (end < source.length && source[end] === "\n") end++;

    ranges.push({ start, end, modules });
  });

  return mergeOverlappingRanges(ranges);
}

function extractModuleNames(
  node: Parser.SyntaxNode,
  language: SupportedLanguage,
): string[] {
  const names: string[] = [];

  if (language === "python") {
    if (node.type === "import_statement") {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i)!;
        if (child.type === "dotted_name" || child.type === "aliased_import") {
          names.push(child.text.split(" as ")[0]!.trim());
        }
      }
    } else if (node.type === "import_from_statement") {
      const moduleNode = node.childForFieldName("module_name");
      if (moduleNode) names.push(moduleNode.text);
    }
    return names;
  }

  const text = node.text;
  const fromMatch = text.match(/from\s+['"]([^'"]+)['"]/);
  if (fromMatch?.[1]) names.push(fromMatch[1]);

  const sideEffect = text.match(/^import\s+['"]([^'"]+)['"]/);
  if (sideEffect?.[1]) names.push(sideEffect[1]);

  const clauseMatch = text.match(/import\s+(?:type\s+)?\{([^}]+)\}/);
  if (clauseMatch?.[1]) {
    const pkg = fromMatch?.[1];
    if (pkg) names.push(pkg);
    else {
      for (const part of clauseMatch[1].split(",")) {
        const sym = part.trim().split(/\s+as\s+/)[0]!.trim();
        if (sym && !sym.startsWith("type ")) names.push(sym);
      }
    }
  }

  const defaultImport = text.match(/import\s+(\w+)\s+from/);
  if (defaultImport?.[1] && fromMatch?.[1]) names.push(fromMatch[1]);

  if (names.length === 0) {
    const fallback = text.match(/['"]([^'"]+)['"]/);
    if (fallback?.[1]) names.push(fallback[1]);
  }

  return names;
}

function mergeOverlappingRanges(ranges: ImportRange[]): ImportRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: ImportRange[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      last.modules = [...new Set([...last.modules, ...current.modules])];
    } else {
      merged.push(current);
    }
  }

  return merged;
}
