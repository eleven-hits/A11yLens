import path from 'node:path';
import crypto from 'node:crypto';

export const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };

export const SEVERITY_WEIGHT = { error: 10, warning: 3, info: 1 };

export function severityRank(severity) {
  return SEVERITY_ORDER[severity] ?? 3;
}

export function normalizeWhitespace(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(value, max = 160) {
  const text = String(value ?? '');
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}\u2026`;
}

export function sha1(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex');
}

export function toPosix(value) {
  return String(value).split(path.sep).join('/');
}

export function relativeTo(root, file) {
  const rel = path.relative(root, file);
  return toPosix(rel || path.basename(file));
}

export function isSubPath(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

export function matchGlob(pattern, value) {
  const target = toPosix(value).replace(/^\.\//, '');
  let glob = toPosix(String(pattern)).replace(/^\.\//, '');
  if (!glob.includes('/')) glob = `**/${glob}`;
  let source = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === '*') {
      if (glob[i + 1] === '*') {
        i += 1;
        if (glob[i + 1] === '/') {
          i += 1;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else if (char === '{') {
      const end = glob.indexOf('}', i);
      if (end === -1) {
        source += '\\{';
      } else {
        const parts = glob
          .slice(i + 1, end)
          .split(',')
          .map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&'));
        source += `(?:${parts.join('|')})`;
        i = end;
      }
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`, 'i').test(target);
}

export function matchesAny(patterns, value) {
  return patterns.some((pattern) => matchGlob(pattern, value));
}

export function lineColFromOffset(text, offset) {
  const limit = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let column = 1;
  for (let i = 0; i < limit; i += 1) {
    if (text[i] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

export function snippetAt(text, line, maxLength = 180) {
  const lines = String(text).split(/\r?\n/);
  const raw = lines[line - 1] ?? '';
  return truncate(raw.trim(), maxLength);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatMs(ms) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function createStyler(enabled) {
  const wrap = (code, text) => (enabled ? `\u001b[${code}m${text}\u001b[0m` : text);
  return {
    bold: (text) => wrap('1', text),
    dim: (text) => wrap('2', text),
    red: (text) => wrap('31', text),
    green: (text) => wrap('32', text),
    yellow: (text) => wrap('33', text),
    blue: (text) => wrap('34', text),
    magenta: (text) => wrap('35', text),
    cyan: (text) => wrap('36', text),
    gray: (text) => wrap('90', text),
    bgRed: (text) => wrap('41;97', text),
    bgYellow: (text) => wrap('43;30', text),
    bgBlue: (text) => wrap('44;97', text),
  };
}

export function severityColor(severity) {
  if (severity === 'error') return 'red';
  if (severity === 'warning') return 'yellow';
  return 'blue';
}

export function severityLabel(severity) {
  if (severity === 'error') return 'ERROR';
  if (severity === 'warning') return 'WARN';
  return 'INFO';
}

export function locationLabel(finding) {
  const file = finding.file ?? '';
  if (!file) return '';
  return finding.line > 0 ? `${file}:${finding.line}` : `${file} (rendered)`;
}

export function parseNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) return override ?? base;
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = isPlainObject(value) && isPlainObject(base[key]) ? deepMerge(base[key], value) : value;
  }
  return result;
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
