import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildContext, parseHtml } from '../src/core/html.js';
import { createStyleResolver, parseCss } from '../src/core/css.js';
import { RULE_BY_ID } from '../src/rules/index.js';
import { defaultConfig } from '../src/config.js';
import { scanStatic } from '../src/scan/engine.js';
import { discoverFiles } from '../src/scan/walker.js';
import { renderExplain } from '../src/report/index.js';
import { renderManual } from '../src/report/manual.js';

function check(id, html, css = '') {
  const ctx = buildContext(parseHtml(html));
  ctx.styleOf = createStyleResolver([parseCss(css)]);
  return RULE_BY_ID.get(id).check(ctx);
}

test('ARIA value validation accepts defined tokens and finite numeric values', () => {
  const html = '<div aria-checked="mixed" aria-expanded="undefined" aria-live="polite" aria-relevant="additions text" aria-valuenow="-0.5" aria-rowcount="-1" aria-level="2"></div>';
  assert.deepEqual(check('aria-valid-attr-value', html), []);
});

test('ARIA value validation catches boolean, list and numeric mistakes', () => {
  const issues = check('aria-valid-attr-value', '<div aria-expanded="yes" aria-live="loud" aria-relevant="text unknown" aria-valuenow="NaN" aria-colindex="1.5" aria-valuemax="Infinity"></div>');
  assert.equal(issues.length, 6);
  assert.ok(issues.every((issue) => issue.data.attribute.startsWith('aria-')));
  assert.deepEqual(check('aria-valid-attr-value', '<div aria-valuenow="" aria-label="Free text" aria-description="Any description"></div>'), []);
});

test('ARIA relationships report each missing target and preserve Unicode ids', () => {
  const issues = check('aria-idref-missing', '<div id="açıklama"></div><input aria-controls="açıklama absent" aria-errormessage="error"><div aria-owns="açıklama"></div>');
  assert.equal(issues.length, 2);
  assert.deepEqual(issues[0].data.missing, ['absent']);
  assert.deepEqual(issues[1].data.missing, ['error']);
});

test('ARIA ranges reject inverted bounds and out-of-range current values', () => {
  const issues = check('aria-range', '<div role="slider" aria-valuemin="10" aria-valuemax="5" aria-valuenow="7"></div><div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="101"></div>');
  assert.equal(issues.length, 2);
  assert.match(issues[0].message, /exceeds/);
  assert.match(issues[1].message, /outside/);
  assert.deepEqual(check('aria-range', '<div role="progressbar" aria-valuemin="0" aria-valuemax="100"></div><div aria-valuemin="-1" aria-valuemax="1" aria-valuenow="0.5"></div>'), []);
});

test('autocomplete accepts ordered shipping, contact and webauthn tokens', () => {
  const html = '<input autocomplete="section-checkout shipping street-address"><input autocomplete="home email"><textarea autocomplete="username webauthn"></textarea><select autocomplete="country-name"></select><input type="hidden" autocomplete="email"><input autocomplete="off">';
  assert.deepEqual(check('autocomplete-invalid', html), []);
});

test('autocomplete catches invalid spelling, ordering and incompatible prefixes', () => {
  const html = '<input autocomplete="email-address"><input autocomplete="email shipping"><input autocomplete="home given-name"><input type="hidden" autocomplete="on"><select autocomplete="username webauthn"></select><input autocomplete="">';
  assert.equal(check('autocomplete-invalid', html).length, 6);
});

test('label in name reports mismatched visible control text', () => {
  const issues = check('label-in-name', '<button aria-label="Delete item">Save changes</button><a href="/" aria-label="Account">Sign in</a>');
  assert.equal(issues.length, 2);
  assert.equal(issues[0].data.visibleLabel, 'Save changes');
});

test('label in name accepts case, punctuation, parenthetical and Unicode variations', () => {
  const html = '<button aria-label="next">Next…</button><button aria-label="Save changes to profile">Save changes</button><button aria-label="Name">Name (required)</button><button aria-label="Überblick öffnen">Überblick öffnen</button><button aria-label="Close">×</button><button aria-label="Bold">B</button>';
  assert.deepEqual(check('label-in-name', html), []);
});

test('label in name excludes hidden and visually hidden label text', () => {
  const html = '<button aria-label="Save">Save<span hidden>Hidden</span><span class="sr-only">Extra instructions</span></button>';
  assert.deepEqual(check('label-in-name', html, '.sr-only{position:absolute;width:1px;height:1px}'), []);
});

test('new rules integrate with reports, overrides, ignores and manual plans', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'a11ylens-validation-'));
  t.after(async () => {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.writeFile(path.join(root, 'index.html'), '<button aria-label="Delete" aria-expanded="yes">Save changes</button><input aria-controls="missing" autocomplete="email-address">');
  const config = { ...defaultConfig(), rules: { 'aria-valid-attr-value': 'warning' }, ignoreRules: ['autocomplete-invalid'] };
  const report = await scanStatic(root, config, { discovery: await discoverFiles(root, config) });
  assert.equal(report.errors.length, 0);
  const valueFinding = report.findings.find((finding) => finding.ruleId === 'aria-valid-attr-value');
  assert.equal(valueFinding.severity, 'warning');
  assert.equal(valueFinding.data.attribute, 'aria-expanded');
  assert.ok(!report.findings.some((finding) => finding.ruleId === 'autocomplete-invalid'));
  assert.ok(report.findings.some((finding) => finding.ruleId === 'label-in-name'));
  assert.match(renderExplain(RULE_BY_ID.get('aria-range')), /aria-valuenow/);
  assert.match(renderManual(report, { findingsOnly: true }), /label-in-name/);
});
