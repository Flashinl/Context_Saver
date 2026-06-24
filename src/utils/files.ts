import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { detectLanguage } from "../parser/languages.js";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  "__pycache__",
  ".venv",
  "venv",
]);

export async function collectSourceFiles(paths: string[]): Promise<string[]> {
  const files = new Set<string>();

  for (const input of paths) {
    const abs = resolve(input);
    const info = await stat(abs).catch(() => null);
    if (!info) continue;

    if (info.isFile()) {
      if (detectLanguage(abs)) files.add(abs);
      continue;
    }

    if (info.isDirectory()) {
      for (const file of await walkDirectory(abs)) {
        files.add(file);
      }
    }
  }

  return [...files].sort();
}

async function walkDirectory(dir: string): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...(await walkDirectory(full)));
      continue;
    }

    if (entry.isFile() && detectLanguage(full)) {
      found.push(full);
    }
  }

  return found;
}

export function relPath(file: string, cwd = process.cwd()): string {
  const normalized = resolve(file);
  const base = resolve(cwd);
  return normalized.startsWith(base) ? normalized.slice(base.length + 1) : file;
}
