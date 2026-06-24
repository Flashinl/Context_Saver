import type Parser from "tree-sitter";
import type { SupportedLanguage } from "../types.js";
import { walkTree } from "../parser/tree-sitter-parser.js";
import { applyReplacements, type Replacement } from "./ast-utils.js";

const TS_TYPE_NODES = new Set([
  "interface_declaration",
  "type_alias_declaration",
  "enum_declaration",
  "ambient_declaration",
]);

export function collapseTypes(
  source: string,
  language: SupportedLanguage,
  root: Parser.SyntaxNode,
): string {
  if (language === "python") return collapsePythonTypes(source, root);
  if (language === "javascript") return source;
  return collapseTsTypes(source, root);
}

function collapseTsTypes(source: string, root: Parser.SyntaxNode): string {
  const replacements: Replacement[] = [];

  walkTree(root, (node) => {
    if (!TS_TYPE_NODES.has(node.type)) return;

    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text ?? "Anonymous";

    if (node.type === "interface_declaration") {
      const typeParams = node.childForFieldName("type_parameters")?.text ?? "";
      replacements.push({
        start: node.startIndex,
        end: node.endIndex,
        text: `interface ${name}${typeParams}{}`,
      });
      return;
    }

    if (node.type === "type_alias_declaration") {
      const typeParams = node.childForFieldName("type_parameters")?.text ?? "";
      const valueNode = node.childForFieldName("type");
      const value = valueNode?.text ?? "unknown";
      if (value.length > 48) {
        replacements.push({
          start: node.startIndex,
          end: node.endIndex,
          text: `type ${name}${typeParams}=...`,
        });
      }
      return;
    }

    if (node.type === "enum_declaration") {
      replacements.push({
        start: node.startIndex,
        end: node.endIndex,
        text: `enum ${name}{...}`,
      });
    }
  });

  return applyReplacements(source, replacements);
}

function collapsePythonTypes(source: string, root: Parser.SyntaxNode): string {
  const replacements: Replacement[] = [];

  walkTree(root, (node) => {
    if (node.type !== "class_definition") return;

    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text ?? "Anonymous";
    const supers = node.childForFieldName("superclasses")?.text ?? "";
    const superClause = supers ? `(${supers})` : "";

    const methods: string[] = [];
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i)!;
      if (child.type === "function_definition") {
        const mName = child.childForFieldName("name")?.text ?? "method";
        const params = child.childForFieldName("parameters")?.text ?? "()";
        const ret = child.childForFieldName("return_type")?.text ?? "";
        methods.push(` def ${mName}${params}${ret ? ` -> ${ret}` : ""}: ...`);
      }
    }

    const body = methods.length ? `\n${methods.join("\n")}\n` : " ...";
    replacements.push({
      start: node.startIndex,
      end: node.endIndex,
      text: `class ${name}${superClause}:${body}`,
    });
  });

  return applyReplacements(source, replacements);
}
