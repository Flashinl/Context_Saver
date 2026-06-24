import type Parser from "tree-sitter";

export interface Replacement {
  start: number;
  end: number;
  text: string;
}

export function applyReplacements(source: string, replacements: Replacement[]): string {
  if (replacements.length === 0) return source;
  const deduped = dedupeNestedReplacements(replacements);
  let result = source;
  const sorted = [...deduped].sort((a, b) => b.start - a.start);
  for (const rep of sorted) {
    result = result.slice(0, rep.start) + rep.text + result.slice(rep.end);
  }
  return result;
}

export function dedupeNestedReplacements(replacements: Replacement[]): Replacement[] {
  const sorted = [...replacements].sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Replacement[] = [];

  for (const rep of sorted) {
    const isNested = kept.some(
      (k) =>
        rep.start >= k.start &&
        rep.end <= k.end &&
        !(rep.start === k.start && rep.end === k.end),
    );
    if (!isNested) kept.push(rep);
  }

  return kept;
}

export function bodyStub(language: "python" | "cstyle", compact: boolean): string {
  if (language === "python") return ": ...";
  return compact ? "{}" : "{/*...*/}";
}

export function findExportDeclaration(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
  return (
    node.namedChildren.find((c) =>
      [
        "function_declaration",
        "lexical_declaration",
        "class_declaration",
        "interface_declaration",
        "type_alias_declaration",
        "enum_declaration",
      ].includes(c.type),
    ) ?? null
  );
}
