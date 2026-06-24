import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import type { SupportedLanguage } from "../types.js";

type TreeLanguage = Parser.Language;

const tsParser = new Parser();
tsParser.setLanguage(TypeScript.typescript as TreeLanguage);

const tsxParser = new Parser();
tsxParser.setLanguage(TypeScript.tsx as TreeLanguage);

const jsParser = new Parser();
jsParser.setLanguage(JavaScript as TreeLanguage);

const pyParser = new Parser();
pyParser.setLanguage(Python as TreeLanguage);

export function getParser(language: SupportedLanguage, source: string): Parser {
  const looksLikeTypeScript =
    /:\s*[\w\[\]|{<>,\s.?]+/.test(source) ||
    /\binterface\s+\w+/.test(source) ||
    /\btype\s+\w+\s*=/.test(source);

  if (language === "typescript" || (language === "javascript" && looksLikeTypeScript)) {
    return source.includes("React") || /<[A-Z]/.test(source) ? tsxParser : tsParser;
  }
  if (language === "javascript") return jsParser;
  return pyParser;
}

export function parseSource(language: SupportedLanguage, source: string) {
  const parser = getParser(language, source);
  return parser.parse(source);
}

export function isValidSyntax(language: SupportedLanguage, source: string): boolean {
  try {
    const tree = parseSource(language, source);
    return tree.rootNode.hasError === false;
  } catch {
    return false;
  }
}

export function collectNodeTexts(
  node: Parser.SyntaxNode,
  types: Set<string>,
): string[] {
  const results: string[] = [];
  const walk = (current: Parser.SyntaxNode) => {
    if (types.has(current.type)) {
      results.push(current.text);
    }
    for (let i = 0; i < current.namedChildCount; i++) {
      walk(current.namedChild(i)!);
    }
  };
  walk(node);
  return results;
}

export function walkTree(
  node: Parser.SyntaxNode,
  visit: (node: Parser.SyntaxNode) => void,
): void {
  visit(node);
  for (let i = 0; i < currentChildCount(node); i++) {
    const child = childAt(node, i);
    if (child) walkTree(child, visit);
  }
}

function currentChildCount(node: Parser.SyntaxNode): number {
  return node.childCount;
}

function childAt(node: Parser.SyntaxNode, index: number): Parser.SyntaxNode | null {
  return node.child(index);
}
