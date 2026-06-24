import type Parser from "tree-sitter";
import type { SupportedLanguage } from "../types.js";
import { parseSource, walkTree } from "../parser/tree-sitter-parser.js";
import {
  applyReplacements,
  bodyStub,
  findExportDeclaration,
  type Replacement,
} from "./ast-utils.js";

const JS_FN_TYPES = new Set([
  "function_declaration",
  "method_definition",
  "arrow_function",
  "function_expression",
  "generator_function_declaration",
  "lexical_declaration",
  "export_statement",
]);

export function skeletonize(
  source: string,
  language: SupportedLanguage,
  root?: Parser.SyntaxNode,
  compact = true,
): string {
  const tree = root ?? parseSource(language, source).rootNode;
  const replacements: Replacement[] = [];
  const stubLang = language === "python" ? "python" : "cstyle";
  const stub = bodyStub(stubLang, compact);

  walkTree(tree, (node) => {
    if (language === "python") {
      if (node.type === "function_definition" && !isInsideClass(node)) {
        const built = buildPythonFnStub(node);
        if (built) replacements.push(range(node, built));
      }
      return;
    }

    if (node.type === "class_declaration") {
      const built = buildClassSkeleton(node, stub);
      if (built) replacements.push(range(node, built));
      return;
    }

    if (JS_FN_TYPES.has(node.type)) {
      const built = buildJsFnStub(node, source, stub);
      if (built) replacements.push(range(node, built));
    }
  });

  return applyReplacements(source, replacements);
}

function range(node: Parser.SyntaxNode, text: string): Replacement {
  return { start: node.startIndex, end: node.endIndex, text };
}

function isInsideClass(node: Parser.SyntaxNode): boolean {
  let parent = node.parent;
  while (parent) {
    if (parent.type === "class_definition") return true;
    parent = parent.parent;
  }
  return false;
}

function buildClassSkeleton(node: Parser.SyntaxNode, stub: string): string | null {
  const name = node.childForFieldName("name")?.text ?? "Anonymous";
  const typeParams = node.childForFieldName("type_parameters")?.text ?? "";
  const heritage = node.childForFieldName("heritage")?.text ?? "";
  const body = node.childForFieldName("body");
  if (!body) return `class ${name}${typeParams}${heritage} ${stub}`;

  const members: string[] = [];
  walkTree(body, (child) => {
    if (child.type === "method_definition" || child.type === "method_signature") {
      const m = buildJsFnStub(child, child.text, stub, true);
      if (m) members.push(m);
    }
    if (child.type === "public_field_definition" || child.type === "property_signature") {
      const fieldName = child.childForFieldName("name")?.text;
      const fieldType = child.childForFieldName("type")?.text ?? "";
      if (fieldName) members.push(`${fieldName}${fieldType};`);
    }
  });

  const inner = members.length ? members.join(" ") : stub.replace(/^\{|\}$/g, "").trim() || "...";
  return `class ${name}${typeParams}${heritage}{${inner}}`;
}

function buildJsFnStub(
  node: Parser.SyntaxNode,
  source: string,
  stub: string,
  method = false,
): string | null {
  if (node.type === "export_statement") {
    const declaration = findExportDeclaration(node);
    if (!declaration) return null;
    const inner = buildJsFnStub(declaration, source, stub);
    if (!inner) return null;
    const isDefault = node.text.includes("export default");
    return `${isDefault ? "export default " : "export "}${inner.replace(/^export\s+/, "")}`;
  }

  if (node.type === "lexical_declaration") {
    const text = node.text;
    const fnMatch = text.match(
      /^(export\s+)?(async\s+)?(const|let|var)\s+(\w+)\s*(:\s*[^=]+)?\s*=\s*(async\s+)?(\([^)]*\)|\w+)\s*(?::\s*[^=]+)?\s*=>/,
    );
    if (!fnMatch) return null;
    const exportKw = fnMatch[1] ?? "";
    const asyncKw = fnMatch[2] ?? fnMatch[6] ?? "";
    const name = fnMatch[4]!;
    const typeAnn = fnMatch[5] ?? "";
    const params = fnMatch[7]!;
    return `${exportKw}${asyncKw}const ${name}${typeAnn}=${params}=>${stub}`;
  }

  const nameNode =
    node.childForFieldName("name") ??
    node.namedChildren.find((c) => c.type === "property_identifier" || c.type === "identifier");

  const name = nameNode?.text ?? "anonymous";
  const params = node.childForFieldName("parameters")?.text ?? "()";
  const returnType = resolveReturnType(node, source);
  const isAsync = /\basync\b/.test(node.text.slice(0, 24));
  const asyncPrefix = isAsync ? "async " : "";

  if (node.type === "arrow_function" || node.type === "function_expression") {
    return `${asyncPrefix}${params}${returnType}=>${stub}`;
  }

  if (node.type === "method_definition" || node.type === "method_signature" || method) {
    const kind = node.childForFieldName("kind")?.text ?? "";
    return `${kind}${asyncPrefix}${name}${params}${returnType}${stub}`;
  }

  return `${asyncPrefix}function ${name}${params}${returnType}${stub}`;
}

function resolveReturnType(node: Parser.SyntaxNode, source: string): string {
  const returnTypeNode = node.childForFieldName("return_type");
  const typeAnnotation = node.childForFieldName("type");
  if (returnTypeNode?.text) return returnTypeNode.text;
  if (typeAnnotation?.text) return typeAnnotation.text;

  const snippet = source.slice(node.startIndex, Math.min(node.endIndex, node.startIndex + 200));
  const inferred = snippet.match(/\)\s*:\s*([^{=>\n]+)/);
  return inferred?.[1] ? `: ${inferred[1].trim()}` : "";
}

function buildPythonFnStub(node: Parser.SyntaxNode): string | null {
  const name = node.childForFieldName("name")?.text ?? "anonymous";
  const params = node.childForFieldName("parameters")?.text ?? "()";
  const returnType = node.childForFieldName("return_type")?.text ?? "";

  const decorators: string[] = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child?.type === "decorator") decorators.push(child.text);
  }

  const prefix = decorators.length ? `${decorators.join("\n")}\n` : "";
  return `${prefix}def ${name}${params}${returnType ? ` -> ${returnType}` : ""}: ...`;
}

/** @deprecated use skeletonize */
export const extractTypes = skeletonize;
