import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { defaultConfig, validateConfig } from '../src/config.js';
import { discoverFiles } from '../src/scan/walker.js';
import { scanStatic, applyBaseline, buildBaseline, mergeDynamic, limitReportFindings } from '../src/scan/engine.js';
import { parseHtml, buildContext, accessibleName } from '../src/core/html.js';
import { parseCss, createStyleResolver, selectorMatches } from '../src/core/css.js';
import { serveDirectory } from '../src/render/serve.js';
import { scanTags, hasAttribute, getAttributeValue } from '../src/rules/source.js';
import { parseArgs } from '../src/cli.js';
import { renderHtml } from '../src/report/html.js';
import { renderMarkdown } from '../src/report/markdown.js';
import { renderSarif } from '../src/report/sarif.js';
import { CDP } from '../src/render/cdp.js';

const execute = promisify(execFile);
const CLI = fileURLToPath(new URL('../bin/a11ylens.js', import.meta.url));
const page = (body, head = '') => `<!doctype html><html lang="en"><head><title>Regression audit</title>${head}</head><body><a href="#main">Skip to main content</a><main id="main"><h1>Regression audit</h1>${body}</main></body></html>`;

async function temporaryDirectory(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'a11ylens-regression-'));
  t.after(async () => {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}

async function scan(t, body, head = '') {
  const root = await temporaryDirectory(t);
  await fs.writeFile(path.join(root, 'index.html'), page(body, head));
  const config = defaultConfig();
  const report = await scanStatic(root, config, { discovery: await discoverFiles(root, config) });
  return { root, report, config };
}

async function cli(root, args = []) {
  try {
    const result = await execute(process.execPath, [CLI, root, '--format', 'json', '--quiet', ...args]);
    return { ...result, code: 0 };
  } catch (error) {
    if (!Number.isInteger(error.code)) throw error;
    return error;
  }
}

test('report limits preserve findings, summaries and baseline generation', async (t) => {
  const { root, report, config } = await scan(t, '<button id="known"></button><img id="new" src="missing.png">');
  const baseline = { fingerprints: [report.findings[0].id] };
  mergeDynamic(report, { findings: [], pages: [], checks: 0, rulesExecuted: [], info: { enabled: true } }, { ...config, maxFindings: 1 });
  assert.equal(report.findings.length, 2);
  applyBaseline(report, baseline, root);
  assert.equal(report.findings.length, 1);
  assert.equal(report.summary.errors, 1);
  assert.equal(buildBaseline(report).fingerprints.length, 1);
  const limited = limitReportFindings(report, 1);
  assert.equal(limited.summary.errors, 1);
  assert.equal(report.findings.length, 1);
});

test('static CLI report limits do not change exit codes or baseline contents', async (t) => {
  const { root } = await scan(t, '<button></button><img src="missing.png">');
  const result = await cli(root, ['--max-findings', '1']);
  const report = JSON.parse(result.stdout);
  assert.equal(result.code, 1);
  assert.equal(report.findings.length, 1);
  assert.equal(report.summary.errors, 2);
  assert.equal(report.truncated, 1);
  await cli(root, ['--max-findings', '1', '--update-baseline']);
  const baseline = JSON.parse(await fs.readFile(path.join(root, '.a11ylens-baseline.json'), 'utf8'));
  assert.equal(baseline.fingerprints.length, 2);
});

test('a failed requested render returns a tool error and cannot update a baseline', async (t) => {
  const { root } = await scan(t, '');
  const args = ['--render', '--browser', path.join(root, 'missing-browser')];
  const result = await cli(root, args);
  assert.equal(result.code, 2);
  const report = JSON.parse(result.stdout);
  assert.ok(report.errors.some((error) => error.message.includes('Rendered scan failed')));
  assert.match(renderHtml(report), /Audit incomplete/);
  assert.match(renderMarkdown(report), /Audit incomplete/);
  assert.equal(JSON.parse(renderSarif(report)).runs[0].invocations[0].executionSuccessful, false);
  const update = await cli(root, [...args, '--update-baseline']);
  assert.equal(update.code, 2);
  await assert.rejects(fs.stat(path.join(root, '.a11ylens-baseline.json')), { code: 'ENOENT' });
});

test('malformed fragments do not crash or disable missing-target checks', async (t) => {
  const { report } = await scan(t, '<a href="#%">Malformed</a><a href="#missing">Missing</a>');
  assert.equal(report.errors.length, 0);
  assert.equal(report.findings.filter((finding) => finding.ruleId === 'anchor-target-missing').length, 2);
});

test('unknown options, invalid severities and malformed numbers are rejected', async (t) => {
  assert.throws(() => parseArgs(['--fail-onn', 'error']), /Unknown option/);
  assert.throws(() => parseArgs(['--no-unknown']), /Unknown option/);
  assert.throws(() => parseArgs(['--render=maybe']), /true or false/);
  for (const overrides of [{ failOn: 'typo' }, { crawl: 0 }, { timeout: -1 }, { minScore: 101 }, { maxFindings: 1.5 }, { render: 'false' }]) {
    assert.throws(() => validateConfig({ ...defaultConfig(), ...overrides }));
  }
  const { root } = await scan(t, '<button></button>');
  for (const args of [['--fail-on', 'typo'], ['--max-findings', '2x'], ['--min-score', '101']]) assert.equal((await cli(root, args)).code, 2);
});

test('invalid baseline data fails explicitly', async (t) => {
  const { root } = await scan(t, '');
  const file = path.join(root, '.a11ylens-baseline.json');
  for (const content of ['{', '{"fingerprints":"bad"}', '{"fingerprints":[42]}']) {
    await fs.writeFile(file, content);
    assert.equal((await cli(root)).code, 2);
  }
});

test('the local server rejects directory links escaping the site root', async (t) => {
  const root = await temporaryDirectory(t);
  const outside = await temporaryDirectory(t);
  await fs.writeFile(path.join(outside, 'secret.txt'), 'outside-content');
  const link = path.join(root, 'linked');
  await fs.symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  const server = await serveDirectory(root);
  t.after(() => server.close());
  const result = await fetch(new URL('linked/secret.txt', server.url));
  assert.equal(result.status, 403);
  assert.equal(await result.text(), 'Forbidden');
  await fs.unlink(link);
});

test('the local server preserves valid internal links, HEAD and SPA routes', async (t) => {
  const root = await temporaryDirectory(t);
  await fs.writeFile(path.join(root, 'index.html'), 'home');
  await fs.mkdir(path.join(root, 'pages'));
  await fs.writeFile(path.join(root, 'pages', 'next.html'), 'next');
  await fs.symlink(path.join(root, 'pages'), path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const server = await serveDirectory(root, { spa: true });
  t.after(() => server.close());
  assert.equal(await (await fetch(new URL('linked/next.html', server.url))).text(), 'next');
  assert.equal(await (await fetch(new URL('route', server.url))).text(), 'home');
  assert.equal((await fetch(server.url, { method: 'HEAD' })).status, 200);
  await fs.unlink(path.join(root, 'linked'));
});

test('CSS specificity uses matching selectors and stylesheet document order', () => {
  const ctx = buildContext(parseHtml('<p id="item" class="target" data-name="two words">Text</p>'));
  const el = ctx.byId.get('item');
  const first = parseCss('#unused, .target {color:white} .target {color:black}');
  assert.deepEqual(createStyleResolver([first])(el).color, [0, 0, 0, 1]);
  const sheets = [parseCss('.unused{color:red}.target{color:white}'), parseCss('.target{color:black}')];
  assert.deepEqual(createStyleResolver(sheets)(el).color, [0, 0, 0, 1]);
  assert.equal(selectorMatches(el, '[data-name="two words"]'), true);
  assert.equal(selectorMatches(el, 'main [data-name="two > words"]'), false);
});

test('root-relative CSS is loaded and style/link source order is preserved', async (t) => {
  const root = await temporaryDirectory(t);
  await fs.writeFile(path.join(root, 'style.css'), '.text {color:#eee;background:white}');
  await fs.writeFile(path.join(root, 'index.html'), page('<p class="text">Low contrast</p>', '<style>.text {color:black;background:white}</style><link rel="stylesheet" href="/style.css">'));
  const config = defaultConfig();
  const report = await scanStatic(root, config, { discovery: await discoverFiles(root, config) });
  assert.equal(report.errors.length, 0);
  assert.ok(report.findings.some((finding) => finding.ruleId === 'css-contrast'));
});

test('a focus indicator on links does not hide missing button focus', async (t) => {
  const { report } = await scan(t, '<button>Save</button>', '<style>button:focus{outline:none} a:focus{outline:2px solid red}</style>');
  assert.ok(report.findings.some((finding) => finding.ruleId === 'css-focus-outline'));
  const repaired = await scan(t, '<button>Save</button>', '<style>button:focus{outline:none} button:focus-visible{outline:2px solid red}</style>');
  assert.ok(!repaired.report.findings.some((finding) => finding.ruleId === 'css-focus-outline'));
});

test('hidden descendants do not name controls but directly referenced hidden labels do', async (t) => {
  const { report } = await scan(t, '<button id="hidden"><span hidden>Save</span></button><button id="css"><span style="display:none">Delete</span></button><span id="label" hidden>Hidden label</span><button id="named" aria-labelledby="label"></button>');
  const buttons = report.findings.filter((finding) => finding.ruleId === 'button-name');
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every((finding) => finding.selector !== 'button#named'));
});

test('empty ARIA names fall back while genuinely unnamed fields are errors', async (t) => {
  const { report } = await scan(t, '<button aria-label="">Save</button><input aria-label=""><input type="button" aria-label="Save">');
  assert.equal(report.findings.filter((finding) => finding.ruleId === 'form-label').length, 1);
  assert.ok(!report.findings.some((finding) => finding.ruleId === 'button-name' || finding.ruleId === 'input-button-name'));
});

test('inert on the hidden container or descendants prevents focus false positives', async (t) => {
  const { report } = await scan(t, '<div inert aria-hidden="true"><button>Save</button></div><div aria-hidden="true"><div inert><button>Delete</button></div></div>');
  assert.ok(!report.findings.some((finding) => finding.ruleId === 'aria-hidden-focus'));
});

test('source parsing ignores JavaScript strings and comments while keeping real JSX offsets', () => {
  const source = '// <img src="comment.png">\nconst text = "<img src=\'string.png\'>";\nconst regex = /<img>/;\nexport const Card = () => <img src="real.png"/>;';
  const tags = scanTags(source, ['img'], null, 'Card.tsx');
  assert.equal(tags.length, 1);
  assert.equal(tags[0].line, 4);
  assert.equal(getAttributeValue(tags[0].attributeText, 'src'), 'real.png');
  assert.equal(hasAttribute(' title="fake aria-label=Save alt=value" src="real.png"', 'alt'), false);
  assert.equal(hasAttribute(' title="fake aria-label=Save"', 'aria-label'), false);
  assert.equal(hasAttribute(' onClick={() => run({nested: {value: 1}})} alt="Real"', 'alt'), true);
});

test('default configuration instances do not share mutable arrays', () => {
  const config = defaultConfig();
  config.ignoreRules.push('img-alt');
  assert.deepEqual(defaultConfig().ignoreRules, []);
});

test('closing CDP cancels event waits and rejects further work', async () => {
  const cdp = new CDP('ws://127.0.0.1/unused');
  const wait = cdp.once('Page.loadEventFired', 30000);
  cdp.close();
  await assert.rejects(wait, /connection closed/);
  assert.equal(cdp.eventWaiters.size, 0);
  assert.equal(cdp.listeners.size, 0);
  await assert.rejects(cdp.send('Page.enable'), /connection is closed/);
});

test('invalid component syntax cannot produce a successful CI audit', async (t) => {
  const { root } = await scan(t, '');
  await fs.writeFile(path.join(root, 'Broken.jsx'), 'export const View = () => <button');
  const result = await cli(root);
  assert.equal(result.code, 2);
  assert.match(JSON.parse(result.stdout).errors[0].message, /Could not parse component source/);
});

test('Windows PowerShell launcher forwards paths, flags and failure exit codes', { skip: process.platform !== 'win32' }, async (t) => {
  const { root } = await scan(t, '');
  const launcher = fileURLToPath(new URL('../platforms/windows/run.ps1', import.meta.url));
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher, root, '--json', '--quiet'];
  const clean = await execute('powershell.exe', args);
  assert.equal(JSON.parse(clean.stdout).summary.total, 0);
  await fs.writeFile(path.join(root, 'index.html'), page('<button></button>'));
  await assert.rejects(execute('powershell.exe', args), (error) => error.code === 1 && JSON.parse(error.stdout).summary.errors === 1);
});

test('POSIX launchers resolve absolute and relative symlinks with spaces in paths', { skip: process.platform === 'win32' }, async (t) => {
  const root = await temporaryDirectory(t);
  const linkDirectory = path.join(root, 'launcher links');
  await fs.mkdir(linkDirectory);
  const cleanSite = fileURLToPath(new URL('../examples/clean-site', import.meta.url));
  for (const platform of ['linux', 'macos']) {
    const launcher = fileURLToPath(new URL(`../platforms/${platform}/a11ylens`, import.meta.url));
    const absoluteLink = path.join(linkDirectory, `${platform}-absolute`);
    const relativeLink = path.join(linkDirectory, `${platform}-relative`);
    await fs.symlink(launcher, absoluteLink);
    await fs.symlink(path.basename(absoluteLink), relativeLink);
    const version = await execute('sh', [absoluteLink, '--version']);
    assert.match(version.stdout, /^A11yLens \d+\.\d+\.\d+/);
    const scan = await execute('sh', [relativeLink, cleanSite, '--json', '--quiet']);
    const report = JSON.parse(scan.stdout);
    assert.equal(report.summary.total, 0);
    assert.equal(report.errors.length, 0);
  }
});
