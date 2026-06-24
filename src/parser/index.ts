export { detectLanguage, isSupportedLanguage } from "./languages.js";
export {
  parseSource,
  isValidSyntax,
  collectNodeTexts,
  walkTree,
  getParser,
} from "./tree-sitter-parser.js";
