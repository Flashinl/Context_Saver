import { readdir, stat, open } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { detectLanguage } from "../parser/languages.js";
import {
  isBinaryExtension,
  isLockfile,
  isIgnored,
  loadGitignore,
} from "./ignore.js";

export async function collectSourceFiles(paths: string[]): Promise<string[]> {
  const files = new Set<string>();
  const cwd = process.cwd();

  for (const input of paths) {
    const abs = resolve(input);
    const info = await stat(abs).catch(() => null);
    if (!info) continue;

    const root = info.isDirectory() ? abs : dirname(abs);
    const ig = await loadGitignore(root);

    if (info.isFile()) {
      if (await isProcessableFile(abs, cwd, ig)) files.add(abs);
      continue;
    }

    for (const file of await walkDirectory(abs, cwd, ig)) {
      files.add(file);
    }
  }

  return [...files].sort();
}

async function walkDirectory(
  dir: string,
  cwd: string,
  ig: Awaited<ReturnType<typeof loadGitignore>>,
): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = relative(cwd, full).replace(/\\/g, "/");

    if (isIgnored(rel, ig) || isIgnored(`${rel}/`, ig)) continue;

    if (entry.isDirectory()) {
      found.push(...(await walkDirectory(full, cwd, ig)));
      continue;
    }

    if (entry.isFile() && (await isProcessableFile(full, cwd, ig))) {
      found.push(full);
    }
  }

  return found;
}

async function isProcessableFile(
  filePath: string,
  cwd: string,
  ig: Awaited<ReturnType<typeof loadGitignore>>,
): Promise<boolean> {
  const name = filePath.split(/[/\\]/).pop() ?? "";
  const rel = relative(cwd, filePath).replace(/\\/g, "/");

  if (isLockfile(name)) return false;
  if (isBinaryExtension(filePath)) return false;
  if (isIgnored(rel, ig)) return false;
  if (!detectLanguage(filePath)) return false;
  if (await looksBinary(filePath)) return false;

  return true;
}

async function looksBinary(filePath: string): Promise<boolean> {
  let handle;
  try {
    handle = await open(filePath, "r");
    const buf = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(buf, 0, 8192, 0);
    if (bytesRead === 0) return false;

    let nonText = 0;
    for (let i = 0; i < bytesRead; i++) {
      const byte = buf[i]!;
      if (byte === 0) return true;
      if (byte < 9 || (byte > 13 && byte < 32)) nonText++;
    }
    return nonText / bytesRead > 0.3;
  } catch {
    return true;
  } finally {
    await handle?.close();
  }
}

function dirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx === -1 ? "." : normalized.slice(0, idx);
}

export function relPath(file: string, cwd = process.cwd()): string {
  const normalized = resolve(file);
  const base = resolve(cwd);
  return normalized.startsWith(base) ? normalized.slice(base.length + 1) : file;
}
