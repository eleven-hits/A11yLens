import fs from 'node:fs/promises';
import path from 'node:path';
import {
  accessibleName,
  attr,
  buildContext,
  elementPath,
  findAll,
  getRole,
  headingLevel,
  isElement,
  parseHtml,
  rawText,
  sourceLocation,
  sourceSnippet,
  tagName,
  textContent,
} from '../core/html.js';
import { createStyleResolver, cssSummary, parseCss } from '../core/css.js';
import { SOURCE_RULES, STATIC_RULES } from '../rules/index.js';
import { maskOutsideRange, templateRange, scanTags } from '../rules/source.js';
import { isRuleIgnored, severityOverride } from '../config.js';
import { clamp, countBy, isSubPath, normalizeWhitespace, relativeTo, sha1, toPosix } from '../util.js';
import { isLocalHref, readTextFile } from './walker.js';

export const TOOL_VERSION = '1.0.1';

export async function scanStatic(root, config, options = {}) {
  const started = Date.now();
  const discovery = options.discovery;
  if (!discovery) throw new Error('scanStatic requires discovered files');

  const findings = [];
  const errors = [];
  const pages = [];
  const checksRef = { count: 0 };
  const rulesExecuted = new Set();
  const cssCache = new Map();

  for (const file of discovery.html) {
    const relFile = relativeTo(root, file);
    let source = '';
    try {
      source = await readTextFile(file);
    } catch (error) {
      errors.push({ file: relFile, message: `Could not read file: ${error.message}` });
      continue;
    }
    let doc;
    try {
      doc = parseHtml(source);
    } catch (error) {
      errors.push({ file: relFile, message: `Could not parse HTML: ${error.message}` });
      continue;
    }
    const base = buildContext(doc);
    const sheets = await loadPageStylesheets(doc, file, root, config, cssCache, errors);
    const styleOf = createStyleResolver(sheets);
    const css = cssSummary(sheets);
    const ctx = {
      ...base,
      doc,
      source,
      file,
      relFile,
      root,
      styleOf,
      sheets,
      css,
    };

    pages.push(buildPageSummary(ctx, relFile));

    for (const rule of STATIC_RULES) {
      if (!config.checkCss && rule.tags.includes('styles')) continue;
      if (isRuleIgnored(rule.id, config.ignoreRules)) continue;
      const override = severityOverride(config, rule.id);
      if (override === 'off') continue;
      checksRef.count += 1;
      rulesExecuted.add(rule.id);
      let raw;
      try {
        raw = rule.check(ctx) ?? [];
      } catch (error) {
        errors.push({ file: relFile, ruleId: rule.id, message: `Rule crashed: ${error.message}` });
        continue;
      }
      for (const item of raw) {
        if (!item) continue;
        const normalized = normalizeStaticFinding(item, rule, ctx, relFile, override);
        if (normalized) findings.push(normalized);
      }
    }
  }

  if (config.checkCss) {
    for (const cssFile of discovery.css) {
      const absolute = path.resolve(cssFile);
      if (cssCache.has(absolute)) continue;
      let sheet = cssCache.get(absolute);
      if (!sheet) {
        try {
          sheet = parseCss(await readTextFile(absolute), { file: absolute });
          cssCache.set(absolute, sheet);
        } catch (error) {
          errors.push({ file: relativeTo(root, absolute), message: `Could not read stylesheet: ${error.message}` });
          continue;
        }
      }
      const emptyDoc = parseHtml('<!doctype html><html lang="en"><head></head><body></body></html>');
      const base = buildContext(emptyDoc);
      const relFile = relativeTo(root, absolute);
      const ctx = {
        ...base,
        doc: emptyDoc,
        source: '',
        file: absolute,
        relFile,
        root,
        styleOf: () => null,
        sheets: [sheet],
        css: cssSummary([sheet]),
      };
      for (const rule of STATIC_RULES.filter((entry) => entry.tags.includes('styles'))) {
        if (isRuleIgnored(rule.id, config.ignoreRules)) continue;
        const override = severityOverride(config, rule.id);
        if (override === 'off') continue;
        checksRef.count += 1;
        rulesExecuted.add(rule.id);
        let raw;
        try {
          raw = rule.check(ctx) ?? [];
        } catch (error) {
          errors.push({ file: relFile, ruleId: rule.id, message: `Rule crashed: ${error.message}` });
          continue;
        }
        for (const item of raw) {
          if (!item) continue;
          const normalized = normalizeStaticFinding(item, rule, ctx, relFile, override);
          if (normalized) findings.push(normalized);
        }
      }
    }
  }

  if (config.scanSource) {
    for (const file of discovery.sources) {
      const relFile = relativeTo(root, file);
      let source = '';
      try {
        source = await readTextFile(file);
      } catch (error) {
        errors.push({ file: relFile, message: `Could not read file: ${error.message}` });
        continue;
      }
      if (isMinified(source)) continue;
      let scanSource = source;
      if (file.toLowerCase().endsWith('.vue')) {
        const range = templateRange(source);
        if (range) scanSource = maskOutsideRange(source, range);
      }
      try { scanTags(scanSource, [], null, file); } catch (error) {
        errors.push({ file: relFile, message: error.message });
        continue;
      }
      const ctx = { source: scanSource, file, relFile, root };
      for (const rule of SOURCE_RULES) {
        if (isRuleIgnored(rule.id, config.ignoreRules)) continue;
        const override = severityOverride(config, rule.id);
        if (override === 'off') continue;
        checksRef.count += 1;
        rulesExecuted.add(rule.id);
        let raw;
        try {
          raw = rule.checkSource(ctx) ?? [];
        } catch (error) {
          errors.push({ file: relFile, ruleId: rule.id, message: `Rule crashed: ${error.message}` });
          continue;
        }
        for (const item of raw) {
          if (!item) continue;
          const line = item.line ?? 1;
          const finding = baseFinding(rule, {
            message: item.message,
            file: relFile,
            line,
            column: item.column ?? 1,
            selector: '',
            snippet: snippetFromSource(source, line),
            override,
            engine: 'source',
          });
          findings.push(finding);
        }
      }
    }
  }

  const uniqueFindings = dedupeFindings(findings, root);
  const report = {
    tool: { name: 'A11yLens', version: TOOL_VERSION },
    root,
    startedAt: new Date(started).toISOString(),
    durationMs: 0,
    files: {
      html: discovery.html.map((file) => relativeTo(root, file)),
      source: discovery.sources.map((file) => relativeTo(root, file)),
      css: discovery.css.map((file) => relativeTo(root, file)),
      skipped: discovery.skipped.map((entry) => ({ ...entry, file: toPosix(entry.file) })),
    },
    pages,
    findings: uniqueFindings,
    errors,
    checks: checksRef.count,
    rulesExecuted: [...rulesExecuted].sort(),
    dynamic: { enabled: false },
  };
  recomputeSummary(report);
  report.durationMs = Date.now() - started;
  return report;
}

function normalizeStaticFinding(item, rule, ctx, relFile, override) {
  let line = item.line;
  let column = item.column;
  let selector = item.selector ?? '';
  let snippet = item.snippet ?? '';
  let file = item.file ? (path.isAbsolute(item.file) ? relativeTo(ctx.root, item.file) : toPosix(item.file)) : relFile;

  if (item.node) {
    const location = sourceLocation(item.node);
    line = location.line;
    column = location.column;
    if (!selector && isElement(item.node)) selector = elementPath(item.node);
    if (!snippet) snippet = sourceSnippet(ctx.source, item.node);
  }

  if (item.file && item.file !== ctx.file) {
    line = item.line ?? 1;
    column = item.column ?? 1;
  }

  if (!item.message) return null;

  return baseFinding(rule, {
    message: item.message,
    file,
    line: line ?? 1,
    column: column ?? 1,
    selector,
    snippet,
    override,
    engine: 'static',
    data: item.data ?? null,
  });
}

function baseFinding(rule, options) {
  const severity = options.override && options.override !== 'off' ? options.override : rule.severity;
  const finding = {
    id: '',
    ruleId: rule.id,
    title: rule.title,
    category: rule.category,
    severity,
    message: options.message,
    file: options.file,
    line: options.line,
    column: options.column ?? 1,
    selector: options.selector ?? '',
    snippet: options.snippet ?? '',
    wcag: rule.wcag,
    level: rule.level,
    description: rule.description,
    help: rule.help,
    helpUrl: rule.helpUrl,
    srImpact: rule.srImpact,
    manual: rule.manual ?? [],
    engine: options.engine,
    data: options.data ?? null,
  };
  finding.id = fingerprint(finding);
  return finding;
}

export function fingerprint(finding) {
  const anchor = finding.selector || normalizeWhitespace(finding.snippet) || String(finding.line);
  return sha1(`${finding.ruleId}|${finding.file}|${anchor}`).slice(0, 16);
}

function snippetFromSource(source, line) {
  const lines = source.split(/\r?\n/);
  return normalizeWhitespace(lines[line - 1] ?? '').slice(0, 200);
}

function isMinified(source) {
  const lines = source.split(/\r?\n/);
  const sample = lines.slice(0, 40);
  const average = sample.reduce((total, line) => total + line.length, 0) / Math.max(1, sample.length);
  return average > 600 || (lines.length < 5 && source.length > 8000);
}

async function loadPageStylesheets(doc, file, root, config, cache, errors) {
  const sheets = [];
  const styles = findAll(
    doc,
    (el) => tagName(el) === 'style' || (tagName(el) === 'link' && /\bstylesheet\b/i.test(attr(el, 'rel') ?? '') && isLocalHref(attr(el, 'href'))),
  );
  for (const link of styles) {
    if (tagName(link) === 'style') {
      const content = rawText(link);
      if (!content.trim()) continue;
      const startLine = sourceLocation(link).line;
      const sheet = parseCss(content, { file });
      sheet.inline = true;
      sheet.startLine = startLine;
      for (const rule of sheet.rules) rule.line += startLine - 1;
      sheets.push(sheet);
      continue;
    }
    const href = attr(link, 'href') ?? '';
    const clean = href.split('?')[0].split('#')[0];
    let resolved;
    try {
      const pathname = decodeURIComponent(clean);
      resolved = pathname.startsWith('/') ? path.resolve(root, `.${pathname}`) : path.resolve(path.dirname(file), pathname);
    } catch {
      continue;
    }
    if (!isSubPath(root, resolved)) continue;
    if (cache.has(resolved)) {
      sheets.push(cache.get(resolved));
      continue;
    }
    try {
      const content = await readTextFile(resolved);
      const sheet = parseCss(content, { file: resolved });
      cache.set(resolved, sheet);
      sheets.push(sheet);
    } catch (error) {
      errors.push({ file: relativeTo(root, file), message: `Could not read stylesheet ${href}: ${error.message}` });
    }
  }
  return sheets;
}

function buildPageSummary(ctx, relFile) {
  const { doc } = ctx;
  const title = findAll(doc, (el) => tagName(el) === 'title')[0];
  const html = findAll(doc, (el) => tagName(el) === 'html')[0];
  const headings = findAll(doc, (el) => headingLevel(el) !== null).map((el) => ({
    level: headingLevel(el),
    text: textContent(el).slice(0, 120),
    line: sourceLocation(el).line,
    hidden: false,
  }));
  const landmarks = findAll(doc, (el) => getRole(el) && ['main', 'navigation', 'banner', 'contentinfo', 'complementary', 'search', 'form', 'region'].includes(getRole(el)))
    .map((el) => ({
      role: getRole(el),
      name: accessibleName(el, ctx).name.slice(0, 120),
      line: sourceLocation(el).line,
    }));
  const images = findAll(doc, (el) => tagName(el) === 'img');
  return {
    file: relFile,
    url: null,
    title: title ? textContent(title) : '',
    lang: html ? attr(html, 'lang') ?? '' : '',
    headings,
    landmarks,
    counts: {
      headings: headings.length,
      landmarks: landmarks.length,
      images: images.length,
      imagesWithoutAlt: images.filter((img) => !attr(img, 'alt')).length,
      links: findAll(doc, (el) => tagName(el) === 'a' && attr(el, 'href') !== undefined).length,
      forms: findAll(doc, (el) => tagName(el) === 'form').length,
      iframes: findAll(doc, (el) => tagName(el) === 'iframe').length,
      ariaLive: findAll(doc, (el) => attr(el, 'aria-live') !== undefined || ['alert', 'status', 'log'].includes(getRole(el))).length,
    },
  };
}

export function dedupeFindings(findings, root) {
  const seen = new Set();
  const output = [];
  for (const finding of findings) {
    const key = `${finding.ruleId}|${finding.file}|${finding.line}|${finding.selector}|${finding.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(finding);
  }
  output.sort(compareFindings);
  return output;
}

export function compareFindings(a, b) {
  const order = { error: 0, warning: 1, info: 2 };
  return (
    (order[a.severity] ?? 3) - (order[b.severity] ?? 3) ||
    String(a.file).localeCompare(String(b.file)) ||
    (a.line ?? 0) - (b.line ?? 0) ||
    String(a.ruleId).localeCompare(String(b.ruleId))
  );
}

export function recomputeSummary(report) {
  const pageCount = Math.max(1, report.pages.length);
  const counts = countBy(report.findings, (finding) => finding.severity);
  const errors = counts.error ?? 0;
  const warnings = counts.warning ?? 0;
  const infos = counts.info ?? 0;
  const penalty = (errors * 3 + warnings * 0.5 + infos * 0.1) / pageCount;
  const score = clamp(Math.round(100 - penalty), 0, 100);
  const executed = report.rulesExecuted ?? [];
  const failing = new Set(
    report.findings.map((finding) => (finding.ruleId.startsWith('axe/') ? 'axe' : finding.ruleId)),
  );
  const failedRules = new Set((report.errors ?? []).map((error) => error.ruleId));
  const rulesPassed = executed.filter((ruleId) => !failing.has(ruleId) && !failedRules.has(ruleId)).length;
  report.summary = {
    errors,
    warnings,
    infos,
    total: report.findings.length,
    score,
    checks: report.checks ?? 0,
    passed: rulesPassed,
    rules: executed.length,
    pages: report.pages.length,
    files: report.files.html.length + report.files.source.length + report.files.css.length,
  };
  report.score = score;
  return report;
}

export function limitReportFindings(report, maxFindings = 0) {
  const findings = maxFindings > 0 ? report.findings.slice(0, maxFindings) : report.findings;
  return { ...report, findings, truncated: report.findings.length - findings.length };
}

export function applyBaseline(report, baseline, root) {
  if (!baseline?.fingerprints?.length) return report;
  const known = new Set(baseline.fingerprints);
  const kept = [];
  const suppressed = [];
  for (const finding of report.findings) {
    const id = finding.id || fingerprint(finding);
    if (known.has(id)) suppressed.push(finding);
    else kept.push(finding);
  }
  report.findings = kept;
  report.baseline = { suppressed: suppressed.length };
  recomputeSummary(report);
  return report;
}

export function buildBaseline(report) {
  return {
    tool: 'A11yLens',
    version: TOOL_VERSION,
    generatedAt: new Date().toISOString(),
    fingerprints: [...new Set(report.findings.map((finding) => finding.id || fingerprint(finding)))].sort(),
  };
}

export function mergeDynamic(report, dynamic, config) {
  if (!dynamic) return report;
  report.dynamic = dynamic.info;
  report.durationMs = (report.durationMs ?? 0) + (dynamic.info?.durationMs ?? 0);
  if (dynamic.errors?.length) report.errors.push(...dynamic.errors);
  for (const page of dynamic.pages ?? []) {
    const existing = report.pages.find((entry) => entry.url === page.url || entry.file === page.file);
    if (existing) {
      existing.url = page.url;
      existing.render = {
        title: page.title,
        outline: page.outline,
        counts: page.counts,
        axeViolations: page.axeViolations,
      };
    } else {
      report.pages.push(page);
    }
  }
  for (const finding of dynamic.findings ?? []) {
    if (isRuleIgnored(finding.ruleId, config?.ignoreRules ?? [])) continue;
    const override = severityOverride(config ?? {}, finding.ruleId);
    if (override === 'off') continue;
    if (override) finding.severity = override;
    report.findings.push({ ...finding, id: finding.id || fingerprint(finding) });
  }
  report.findings = dedupeFindings(report.findings, report.root);
  report.checks += dynamic.checks ?? 0;
  for (const ruleId of dynamic.rulesExecuted ?? []) {
    if (!report.rulesExecuted.includes(ruleId)) report.rulesExecuted.push(ruleId);
  }
  recomputeSummary(report);
  return report;
}

export { loadPageStylesheets };
