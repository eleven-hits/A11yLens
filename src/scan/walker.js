import fs from 'node:fs/promises';
import path from 'node:path';
import { matchesAny, toPosix } from '../util.js';

export const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'bower_components', 'vendor', 'coverage',
  '.next', '.nuxt', '.svelte-kit', '.astro', '.output', '.cache', '.parcel-cache',
  '.turbo', '.vercel', 'test-results', 'playwright-report', '.idea', '.vscode',
  'tmp', 'temp', 'reports', '.a11ylens-cache', '.yarn', '.pnpm-store',
]);

const HTML_EXT = new Set(['.html', '.htm', '.xhtml']);
const SOURCE_EXT = new Set(['.jsx', '.tsx', '.vue', '.svelte', '.astro']);
const JS_EXT = new Set(['.js', '.ts', '.mjs', '.cjs']);
const CSS_EXT = new Set(['.css']);
const SKIP_FILE = /\.(min|bundle|chunk)\.(js|css)$|\.d\.ts$|\.map$/i;

async function isProbablyText(file, limit = 8192) {
  const handle = await fs.open(file, 'r');
  try {
    const buffer = Buffer.alloc(limit);
    const { bytesRead } = await handle.read(buffer, 0, limit, 0);
    if (!bytesRead) return true;
    for (let i = 0; i < bytesRead; i += 1) {
      if (buffer[i] === 0) return false;
    }
    return true;
  } finally {
    await handle.close();
  }
}

export async function discoverFiles(root, options = {}) {
  const include = options.include ?? [];
  const exclude = options.exclude ?? [];
  const scanJs = options.scanJs ?? false;
  const maxFileSize = options.maxFileSize ?? 4 * 1024 * 1024;
  const result = { html: [], sources: [], css: [], skipped: [], root };
  const stack = [root];
  const visited = new Set();

  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      result.skipped.push({ file: dir, reason: error.code ?? 'READ_ERROR' });
      continue;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = toPosix(path.relative(root, full));
      if (entry.isSymbolicLink()) {
        result.skipped.push({ file: rel, reason: 'SYMLINK' });
        continue;
      }
      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
        if (exclude.length && matchesAny(exclude, rel)) continue;
        const real = path.resolve(full);
        if (visited.has(real)) continue;
        visited.add(real);
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (SKIP_FILE.test(entry.name)) continue;
      if (include.length && !matchesAny(include, rel)) continue;
      if (exclude.length && matchesAny(exclude, rel)) continue;
      const extension = path.extname(entry.name).toLowerCase();
      const isCandidate =
        HTML_EXT.has(extension) ||
        SOURCE_EXT.has(extension) ||
        CSS_EXT.has(extension) ||
        (scanJs && JS_EXT.has(extension));
      if (!isCandidate) continue;
      let stats;
      try {
        stats = await fs.stat(full);
      } catch {
        continue;
      }
      if (stats.size > maxFileSize) {
        result.skipped.push({ file: rel, reason: 'TOO_LARGE' });
        continue;
      }
      try {
        if (!(await isProbablyText(full))) {
          result.skipped.push({ file: rel, reason: 'BINARY' });
          continue;
        }
      } catch {
        result.skipped.push({ file: rel, reason: 'UNREADABLE' });
        continue;
      }
      if (HTML_EXT.has(extension)) result.html.push(full);
      else if (CSS_EXT.has(extension)) result.css.push(full);
      else result.sources.push(full);
    }
  }

  result.html.sort();
  result.sources.sort();
  result.css.sort();
  return result;
}

export async function readTextFile(file) {
  const content = await fs.readFile(file, 'utf8');
  return content.replace(/^\uFEFF/, '');
}

export function isLocalHref(href) {
  if (!href) return false;
  const value = href.trim();
  if (!value) return false;
  if (/^(https?:)?\/\//i.test(value)) return false;
  if (/^(data|mailto|tel|javascript|blob):/i.test(value)) return false;
  if (value.startsWith('#')) return false;
  return true;
}
