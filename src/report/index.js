import { getRule, ruleSummary, RULES } from '../rules/index.js';
import { renderHtml } from './html.js';
import { renderJson } from './json.js';
import { renderManual, renderManualMarkdown } from './manual.js';
import { renderMarkdown } from './markdown.js';
import { renderPretty } from './pretty.js';
import { renderSarif } from './sarif.js';

export const FORMATS = ['pretty', 'json', 'sarif', 'html', 'markdown'];

export function normalizeFormat(format) {
  const value = String(format ?? 'pretty').toLowerCase();
  if (value === 'md') return 'markdown';
  if (FORMATS.includes(value)) return value;
  throw new Error(`Unknown report format "${format}". Use one of: ${FORMATS.join(', ')}.`);
}

export function renderReport(report, format, options = {}) {
  switch (normalizeFormat(format)) {
    case 'json':
      return renderJson(report);
    case 'sarif':
      return renderSarif(report);
    case 'markdown':
      return renderMarkdown(report);
    case 'html':
      return renderHtml(report, options);
    default:
      return renderPretty(report, options);
  }
}

export function formatFromExtension(file) {
  const extension = String(file).toLowerCase().split('.').pop();
  if (extension === 'html' || extension === 'htm') return 'html';
  if (extension === 'json') return 'json';
  if (extension === 'sarif') return 'sarif';
  if (extension === 'md' || extension === 'markdown') return 'markdown';
  return 'pretty';
}

export function defaultOutputPath(format) {
  switch (format) {
    case 'html':
      return 'a11ylens-report.html';
    case 'sarif':
      return 'a11ylens-report.sarif';
    case 'markdown':
      return 'a11ylens-report.md';
    case 'json':
      return 'a11ylens-report.json';
    default:
      return null;
  }
}

export function renderRules(rules, options = {}) {
  if (options.json) return `${JSON.stringify(rules.map(ruleSummaryOf), null, 2)}\n`;
  const styler = options.styler;
  const color = (name, text) => (styler ? styler[name](text) : text);
  const lines = [];
  const grouped = new Map();
  for (const rule of rules) {
    if (!grouped.has(rule.category)) grouped.set(rule.category, []);
    grouped.get(rule.category).push(rule);
  }
  lines.push('');
  lines.push(color('bold', `A11yLens rules — ${rules.length} checks`));
  lines.push(color('gray', 'Static rules run on source; render rules run on the Chrome accessibility tree.'));
  lines.push('');
  for (const [category, entries] of [...grouped.entries()].sort()) {
    lines.push(color('bold', category));
    for (const rule of entries) {
      const severity = rule.severity.padEnd(7);
      const wcag = rule.wcag.length ? `${rule.level} ${rule.wcag.join(',')}` : 'best practice';
      lines.push(
        `  ${color(severity === 'error' ? 'red' : severity === 'warning' ? 'yellow' : 'blue', severity)} ${rule.id.padEnd(30)} ${rule.title}`,
      );
      lines.push(color('gray', `          ${wcag}${rule.renderOnly ? ' · rendered only' : rule.checkSource ? ' · source only' : ''}`));
    }
    lines.push('');
  }
  lines.push(color('gray', 'Explain a rule: a11ylens explain <rule-id>'));
  return `${lines.join('\n')}\n`;
}

function ruleSummaryOf(rule) {
  return ruleSummary().find((entry) => entry.id === rule.id) ?? {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    severity: rule.severity,
    wcag: rule.wcag,
    level: rule.level,
    description: rule.description,
    srImpact: rule.srImpact,
    help: rule.help,
    helpUrl: rule.helpUrl,
  };
}

export function renderExplain(rule) {
  const lines = [];
  lines.push('');
  lines.push(`${rule.title}`);
  lines.push('='.repeat(Math.min(72, rule.title.length)));
  lines.push('');
  lines.push(`ID:        ${rule.id}`);
  lines.push(`Category:  ${rule.category}`);
  lines.push(`Severity:  ${rule.severity}`);
  lines.push(`WCAG:      ${rule.wcag.length ? `${rule.wcag.join(', ')} (level ${rule.level})` : 'best practice'}`);
  lines.push(`Engine:    ${rule.renderOnly ? 'rendered Chrome + accessibility tree' : rule.checkSource ? 'source/component scan' : 'static HTML/CSS scan'}`);
  lines.push('');
  lines.push('What it checks');
  lines.push(rule.description);
  lines.push('');
  lines.push('Screen reader impact');
  lines.push(rule.srImpact);
  if (rule.manual?.length) {
    lines.push('');
    lines.push('How to test manually');
    for (const step of rule.manual) lines.push(`  - ${step}`);
  }
  lines.push('');
  lines.push('How to fix');
  lines.push(rule.help);
  if (rule.helpUrl) {
    lines.push('');
    lines.push(`Reference: ${rule.helpUrl}`);
  }
  lines.push('');
  lines.push('Get all rules: a11ylens rules');
  return `${lines.join('\n')}\n`;
}

export { renderManual, renderManualMarkdown, getRule, RULES };
