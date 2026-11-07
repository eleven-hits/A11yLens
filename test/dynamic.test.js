import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../src/config.js';
import { discoverFiles } from '../src/scan/walker.js';
import { scanStatic } from '../src/scan/engine.js';
import { runDynamicScan } from '../src/render/dynamic.js';
import { findBrowser } from '../src/render/browser.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildBaseline, applyBaseline, mergeDynamic } from '../src/scan/engine.js';

const execute = promisify(execFile);
const page = (body) => `<!doctype html><html lang="en"><head><title>Rendered regression</title></head><body><a href="#main">Skip to main content</a><main id="main"><h1>Rendered regression</h1>${body}</main></body></html>`;

async function fixture(t, body) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'a11ylens-dynamic-'));
  t.after(async () => {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.writeFile(path.join(root, 'index.html'), page(body));
  return root;
}

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const enabled = process.env.A11Y_TEST_RENDER === '1' && Boolean(findBrowser());

test('rendered Chrome scan sees axe, the accessibility tree and keyboard focus', { skip: !enabled, timeout: 180000 }, async () => {
  const root = path.join(ROOT, 'examples', 'broken-site');
  const config = { ...defaultConfig(), quiet: true, crawl: 1, maxDepth: 0, wait: 300, timeout: 60000 };
  const discovery = await discoverFiles(root, config);
  const report = await scanStatic(root, config, { discovery });
  const dynamic = await runDynamicScan({ root, config, discovery, report });
  assert.equal(dynamic.pages.length, 1);
  assert.ok(dynamic.info.axeVersion, 'axe-core version should be reported');
  assert.ok(dynamic.info.pageCount === 1);
  const ids = new Set(dynamic.findings.map((finding) => finding.ruleId));
  assert.ok(ids.has('axe/image-alt'));
  assert.ok(ids.has('ax-empty-name'));
  assert.ok(ids.has('render-order'));
  assert.ok(dynamic.pages[0].outline.length > 0);
});

test('rendered crawl deduplicates queued links and reports HTTP failures', { skip: !enabled, timeout: 120000 }, async (t) => {
  const root = await fixture(t, '<a href="second.html">Second</a><a href="second.html#part">Second again</a><a href="third.html">Third</a><a href="missing.html">Missing</a><form><input aria-label="Query"></form><script>document.body.dataset.ready="true"</script>');
  await fs.writeFile(path.join(root, 'second.html'), page('<h2 id="part">Second</h2>'));
  await fs.writeFile(path.join(root, 'third.html'), page('Third'));
  const result = await runDynamicScan({ root, config: { ...defaultConfig(), axe: false, crawl: 4, maxDepth: 1, wait: 0 } });
  assert.deepEqual(result.pages.map((entry) => entry.file), ['index.html', 'second.html', 'third.html']);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /HTTP 404/);
  assert.match(result.errors[0].file, /missing\.html$/);
  assert.ok(result.findings.some((entry) => entry.ruleId === 'render-no-live-region'));
});

test('axe findings are per element so baselines cannot hide newly added violations', { skip: !enabled, timeout: 120000 }, async (t) => {
  const root = await fixture(t, '<img id="existing" src="data:image/png;base64,">');
  const config = { ...defaultConfig(), crawl: 1, wait: 0 };
  const original = await runDynamicScan({ root, config });
  const baseline = buildBaseline({ findings: original.findings.filter((entry) => entry.ruleId === 'axe/image-alt') });
  await fs.writeFile(path.join(root, 'index.html'), page('<img id="existing" src="data:image/png;base64,"><img id="new" src="data:image/png;base64,">'));
  const dynamic = await runDynamicScan({ root, config });
  const imageFindings = dynamic.findings.filter((entry) => entry.ruleId === 'axe/image-alt');
  assert.equal(imageFindings.length, 2);
  assert.notEqual(imageFindings[0].id, imageFindings[1].id);
  const discovery = await discoverFiles(root, config);
  const report = await scanStatic(root, config, { discovery });
  mergeDynamic(report, dynamic, config);
  applyBaseline(report, baseline, root);
  const remaining = report.findings.filter((entry) => entry.ruleId === 'axe/image-alt');
  assert.equal(remaining.length, 1);
  assert.match(remaining[0].selector, /new/);
});

test('rendered CLI limits retain new failures after baseline suppression', { skip: !enabled, timeout: 120000 }, async (t) => {
  const root = await fixture(t, '<button id="existing"></button><img id="new" src="data:image/png;base64,">');
  const config = defaultConfig();
  const report = await scanStatic(root, config, { discovery: await discoverFiles(root, config) });
  await fs.writeFile(path.join(root, '.a11ylens-baseline.json'), JSON.stringify({ fingerprints: [report.findings[0].id] }));
  let result;
  try {
    await execute(process.execPath, [path.join(ROOT, 'bin/a11ylens.js'), root, '--render', '--no-axe', '--crawl', '1', '--wait', '0', '--ignore', 'ax-*,render-*', '--max-findings', '1', '--json', '--quiet']);
    assert.fail('The new image violation must fail CI.');
  } catch (error) { result = error; }
  assert.equal(result.code, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.summary.errors, 1);
  assert.equal(output.findings[0].ruleId, 'img-alt');
});
