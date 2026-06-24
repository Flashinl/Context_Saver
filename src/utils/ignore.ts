import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ignore, { type Ignore } from "ignore";

const LOCKFILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "Cargo.lock",
  "Gemfile.lock",
  "poetry.lock",
  "composer.lock",
]);

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".svg",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".mp3", ".mp4", ".wav", ".avi", ".mov",
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".exe", ".dll", ".so", ".dylib", ".bin", ".wasm",
  ".class", ".jar", ".pyc", ".pyo", ".o", ".a",
]);

const cache = new Map<string, Ignore>();

export function isLockfile(name: string): boolean {
  return LOCKFILES.has(name);
}

export function isBinaryExtension(filePath: string): boolean {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return false;
  return BINARY_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
}

export async function loadGitignore(root: string): Promise<Ignore> {
  const abs = resolve(root);
  if (cache.has(abs)) return cache.get(abs)!;

  const ig = ignore();
  let dir = abs;

  while (true) {
    const gitignorePath = join(dir, ".gitignore");
    if (existsSync(gitignorePath)) {
      try {
        const content = await readFile(gitignorePath, "utf-8");
        ig.add(content);
      } catch {
        // unreadable .gitignore — skip
      }
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  ig.add(["node_modules/", "dist/", "build/", ".git/"]);
  cache.set(abs, ig);
  return ig;
}

export function isIgnored(relPath: string, ig: Ignore): boolean {
  const normalized = relPath.replace(/\\/g, "/");
  return ig.ignores(normalized);
}
