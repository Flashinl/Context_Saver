import { extname } from "node:path";
import type { SupportedLanguage } from "../types.js";

const EXTENSION_MAP: Record<string, SupportedLanguage> = {
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".pyw": "python",
};

export function detectLanguage(filePath: string): SupportedLanguage | null {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] ?? null;
}

export function isSupportedLanguage(
  language: string,
): language is SupportedLanguage {
  return language === "javascript" || language === "typescript" || language === "python";
}
