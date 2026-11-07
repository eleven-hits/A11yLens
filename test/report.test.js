import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../src/config.js';
import { discoverFiles } from '../src/scan/walker.js';
import { scanStatic } from '../src/scan/engine.js';
import { renderHtml } from '../src/report/html.js';
import { renderJson } from '../src/report/json.js';
import { renderMarkdown } from '../src/report/markdown.js';
import { renderSarif } from '../src/report/sarif.js';
import { renderManual } from '../src/report/manual.js';
import { renderRules, renderExplain, getRule } from '../src/report/index.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

async function reportFor(name) {
  const root = path.join(ROOT, 'examples', name);
  const config = { ...defaultConfig(), quiet: true };
  const discovery = await discoverFiles(root, config);
  return scanStatic(root, config, { discovery });
}

test('JSON report round-trips', async () => {
  const report = await reportFor('broken-site');
  const parsed = JSON.parse(renderJson(report));
  assert.equal(parsed.tool.name, 'A11yLens');
  assert.equal(parsed.summary.total, report.findings.length);
  assert.equal(parsed.findings.length, report.findings.length);
});

test('SARIF report exposes rules and physical locations', async () => {
  const report = await reportFor('broken-site');
  const sarif = JSON.parse(renderSarif(report));
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].results.length, report.findings.length);
  assert.ok(sarif.runs[0].tool.driver.rules.length > 0);
  for (const result of sarif.runs[0].results) {
    assert.ok(result.ruleId);
    assert.ok(result.locations[0].physicalLocation.region.startLine >= 1);
    assert.ok(['error', 'warning', 'note'].includes(result.level));
  }
});

test('HTML report is self-contained and escapes finding text', async () => {
  const report = await reportFor('broken-site');
  const clone = JSON.parse(JSON.stringify(report));
  clone.findings[0].message = '<script>alert(1)</script>';
  const html = renderHtml(clone);
  assert.match(html, /^<!doctype html>/);
  assert.ok(html.includes('data-severity="error"'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('Manual screen reader protocol'));
  assert.ok(html.includes('aria-live'));
});

test('Markdown report includes summary, findings and manual protocol', async () => {
  const report = await reportFor('broken-site');
  const markdown = renderMarkdown(report);
  assert.match(markdown, /# A11yLens Accessibility Audit/);
  assert.match(markdown, /## Findings/);
  assert.match(markdown, /## Manual screen reader test protocol/);
  assert.match(markdown, /img-alt/);
});

test('manual plan includes finding-specific steps', async () => {
  const report = await reportFor('broken-site');
  const manual = renderManual(report, { findingsOnly: true });
  assert.match(manual, /CHECKS FOR THE FINDINGS/);
  assert.match(manual, /img-alt/);
  assert.match(manual, /NVDA: press G/);
});

test('rules list and explain output are available', () => {
  const rules = renderRules([getRule('img-alt')], { json: false });
  assert.match(rules, /img-alt/);
  const explain = renderExplain(getRule('img-alt'));
  assert.match(explain, /WCAG: +1\.1\.1/);
  assert.match(explain, /Screen reader impact/);
});

test('rendered findings can be merged without breaking the summary', async () => {
  const report = await reportFor('broken-site');
  const before = report.summary.total;
  const { mergeDynamic } = await import('../src/scan/engine.js');
  mergeDynamic(
    report,
    {
      info: { enabled: true, pageCount: 1, browser: 'Test', axeVersion: '4.14.0' },
      pages: [],
      findings: [
        {
          id: 'abc',
          ruleId: 'axe/test',
          title: 'Test',
          category: 'axe',
          severity: 'error',
          message: 'Rendered test finding',
          file: 'http://localhost/',
          line: 0,
          column: 1,
          selector: 'main',
          snippet: '',
          wcag: ['1.1.1'],
          level: 'A',
          description: '',
          help: '',
          helpUrl: '',
          srImpact: '',
          manual: [],
          engine: 'axe',
          data: null,
        },
      ],
      checks: 1,
      rulesExecuted: ['axe/test'],
      errors: [],
    },
    {},
  );
  assert.equal(report.summary.total, before + 1);
  assert.equal(report.dynamic.enabled, true);
});
