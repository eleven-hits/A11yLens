import fs from 'node:fs/promises';
import path from 'node:path';
import { deepMerge, isPlainObject } from './util.js';

export const DEFAULT_CONFIG = {
  include: [],
  exclude: [],
  ignoreRules: [],
  rules: {},
  render: false,
  url: null,
  crawl: 5,
  maxDepth: 2,
  browser: null,
  headless: true,
  sandbox: true,
  wait: 600,
  timeout: 30000,
  spa: false,
  servePort: 0,
  failOn: 'error',
  format: 'pretty',
  output: null,
  maxFindings: 0,
  minScore: null,
  baseline: null,
  updateBaseline: false,
  scanJs: false,
  scanSource: true,
  checkCss: true,
  color: true,
  quiet: false,
  verbose: false,
  screenReader: 'all',
  ignoreAxe: [],
  axeTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
  reportTitle: 'A11yLens Accessibility Audit',
};

const CONFIG_FILES = ['.a11ylensrc.json', '.a11ylensrc', 'a11ylens.config.json'];

export async function findConfigFile(startDir) {
  let current = path.resolve(startDir);
  for (let depth = 0; depth < 8; depth += 1) {
    for (const name of CONFIG_FILES) {
      const candidate = path.join(current, name);
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) return candidate;
      } catch {
      }
    }
    const packageFile = path.join(current, 'package.json');
    try {
      const raw = await fs.readFile(packageFile, 'utf8');
      const pkg = JSON.parse(raw);
      if (pkg.a11ylens && isPlainObject(pkg.a11ylens)) return packageFile;
    } catch {
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export async function loadConfig(startDir, explicitPath = null) {
  const file = explicitPath ? path.resolve(explicitPath) : await findConfigFile(startDir);
  if (!file) return { config: defaultConfig(), file: null };
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read config file ${file}: ${error.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Config file ${file} is not valid JSON: ${error.message}`);
  }
  if (path.basename(file) === 'package.json') parsed = parsed.a11ylens ?? {};
  if (!isPlainObject(parsed)) throw new Error('Configuration must be a JSON object.');
  return { config: deepMerge(defaultConfig(), sanitizeConfig(parsed)), file };
}

function sanitizeConfig(input) {
  const config = { ...input };
  if (config.ignore && !config.ignoreRules) config.ignoreRules = config.ignore;
  delete config.ignore;
  for (const key of ['include', 'exclude', 'ignoreRules', 'axeTags', 'ignoreAxe']) {
    if (config[key] !== undefined && !Array.isArray(config[key])) {
      config[key] = typeof config[key] === 'string' ? [config[key]] : [];
    }
  }
  return config;
}

export function isRuleIgnored(ruleId, ignoreRules = []) {
  return ignoreRules.some((pattern) => {
    if (pattern === ruleId) return true;
    if (pattern.endsWith('*')) return ruleId.startsWith(pattern.slice(0, -1));
    return false;
  });
}

export function severityOverride(config, ruleId) {
  const entry = config.rules?.[ruleId];
  if (entry === undefined) return null;
  if (entry === 'off' || entry === false) return 'off';
  if (entry === 'error' || entry === 'warning' || entry === 'info') return entry;
  if (isPlainObject(entry)) {
    if (entry.enabled === false) return 'off';
    if (['error', 'warning', 'info'].includes(entry.severity)) return entry.severity;
  }
  return null;
}

export function defaultConfig() {
  return structuredClone(DEFAULT_CONFIG);
}

export function validateConfig(config) {
  if (!['error', 'warning', 'info', 'none'].includes(config.failOn)) throw new Error('failOn must be error, warning, info or none.');
  if (!['pretty', 'json', 'sarif', 'html', 'markdown', 'md'].includes(config.format)) throw new Error('Unknown report format.');
  const ranges = { crawl: [1, 10000], maxDepth: [0, 1000], wait: [0, 3600000], timeout: [1, 3600000], servePort: [0, 65535], maxFindings: [0, Number.MAX_SAFE_INTEGER], minScore: [0, 100], maxFileSize: [1, Number.MAX_SAFE_INTEGER] };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const value = config[key];
    if (value === undefined || (key === 'minScore' && value === null)) continue;
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${key} must be an integer between ${min} and ${max}.`);
  }
  for (const key of ['include', 'exclude', 'ignoreRules', 'axeTags', 'ignoreAxe']) {
    if (!Array.isArray(config[key]) || config[key].some((value) => typeof value !== 'string' || !value.trim())) throw new Error(`${key} must contain non-empty strings.`);
  }
  for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIG)) {
    if (typeof defaultValue === 'boolean' && typeof config[key] !== 'boolean') throw new Error(`${key} must be a boolean.`);
  }
  for (const key of ['url', 'browser', 'output', 'baseline']) {
    if (config[key] !== null && typeof config[key] !== 'string') throw new Error(`${key} must be a string or null.`);
  }
  if (config.url) {
    let url;
    try { url = new URL(config.url); } catch { throw new Error('url must be an absolute HTTP or HTTPS URL.'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('url must use HTTP or HTTPS.');
  }
  if (!isPlainObject(config.rules)) throw new Error('rules must be an object.');
  for (const [ruleId, entry] of Object.entries(config.rules)) {
    if (['off', 'error', 'warning', 'info', false].includes(entry)) continue;
    if (isPlainObject(entry) && (entry.enabled === undefined || typeof entry.enabled === 'boolean') && (entry.severity === undefined || ['error', 'warning', 'info'].includes(entry.severity))) continue;
    throw new Error(`Invalid rule configuration for ${ruleId}.`);
  }
  return config;
}
