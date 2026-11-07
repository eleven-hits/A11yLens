import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../src/config.js';
import { discoverFiles } from '../src/scan/walker.js';
import { applyBaseline, buildBaseline, scanStatic } from '../src/scan/engine.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

async function scanFixture(name, overrides = {}) {
  const root = path.join(ROOT, 'examples', name);
  const config = { ...defaultConfig(), quiet: true, ...overrides };
  const discovery = await discoverFiles(root, config);
  const report = await scanStatic(root, config, { discovery });
  return { report, root, discovery, config };
}

async function scanHtml(html, overrides = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'a11ylens-test-'));
  await fs.writeFile(path.join(root, 'index.html'), html, 'utf8');
  const config = { ...defaultConfig(), quiet: true, ...overrides };
  const discovery = await discoverFiles(root, config);
  const report = await scanStatic(root, config, { discovery });
  await fs.rm(root, { recursive: true, force: true });
  return report;
}

test('clean fixture has no findings', async () => {
  const { report } = await scanFixture('clean-site');
  assert.equal(report.findings.length, 0, JSON.stringify(report.findings.map((f) => f.ruleId)));
  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.warnings, 0);
  assert.equal(report.summary.score, 100);
});

test('broken fixture triggers the expected static rules', async () => {
  const { report } = await scanFixture('broken-site');
  const ids = new Set(report.findings.map((finding) => finding.ruleId));
  for (const expected of [
    'html-lang',
    'meta-viewport-zoom',
    'img-alt',
    'img-alt-filename',
    'img-alt-redundant',
    'form-label',
    'form-placeholder-label',
    'label-for-missing',
    'fieldset-legend-missing',
    'button-name',
    'iframe-title',
    'video-captions',
    'marquee-blink',
    'aria-hidden-focus',
    'aria-role-invalid',
    'aria-label-empty',
    'aria-labelledby-missing',
    'role-img-name',
    'dialog-name',
    'progress-name',
    'table-headers',
    'table-caption',
    'skip-link',
    'landmark-main',
    'tabindex-positive',
    'duplicate-id',
    'link-vague',
    'css-focus-outline',
    'css-contrast',
    'src-img-alt',
    'src-click-noninteractive',
    'src-icon-button',
    'src-anchor-href',
    'src-label-for',
    'src-tabindex-positive',
  ]) {
    assert.ok(ids.has(expected), `missing rule ${expected}`);
  }
  assert.deepEqual(report.errors, []);
  assert.ok(report.findings.every((finding) => finding.file && finding.message && finding.srImpact));
});

test('every static finding has a stable fingerprint', async () => {
  const { report } = await scanFixture('broken-site');
  const ids = report.findings.map((finding) => finding.id);
  assert.ok(ids.every((id) => typeof id === 'string' && id.length === 16));
  const again = await scanFixture('broken-site');
  assert.deepEqual(
    again.report.findings.map((finding) => finding.id),
    ids,
  );
});

test('baseline suppresses known findings', async () => {
  const { report, root } = await scanFixture('broken-site');
  const baseline = buildBaseline(report);
  const copy = JSON.parse(JSON.stringify(report));
  applyBaseline(copy, baseline, root);
  assert.equal(copy.findings.length, 0);
  assert.equal(copy.baseline.suppressed, report.findings.length);
});

test('discovery ignores node_modules and binary files', async () => {
  const { discovery } = await scanFixture('broken-site');
  assert.ok(discovery.html.length >= 1);
  assert.ok(discovery.sources.length >= 1);
  assert.ok(discovery.css.length >= 1);
  assert.ok(discovery.html.every((file) => !file.includes('node_modules')));
});

test('missing lang and empty title are reported', async () => {
  const report = await scanHtml('<html><head><title> </title></head><body><main><h1>Hi</h1></main></body></html>');
  const ids = report.findings.map((finding) => finding.ruleId);
  assert.ok(ids.includes('html-lang'));
  assert.ok(ids.includes('document-title'));
});

test('rule severity overrides and ignoreRules are applied', async () => {
  const overridden = await scanFixture('broken-site', { rules: { 'img-alt': 'warning' } });
  const imgAlt = overridden.report.findings.find((finding) => finding.ruleId === 'img-alt');
  assert.equal(imgAlt.severity, 'warning');
  const ignored = await scanFixture('broken-site', { ignoreRules: ['img-alt', 'src-*'] });
  assert.ok(!ignored.report.findings.some((finding) => finding.ruleId === 'img-alt'));
  assert.ok(!ignored.report.findings.some((finding) => finding.ruleId.startsWith('src-')));
});
