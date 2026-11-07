import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accessibleName,
  buildContext,
  findAll,
  getRole,
  parseHtml,
  tagName,
  textContent,
} from '../src/core/html.js';
import { contrastRatio, createStyleResolver, cssSummary, parseColor, parseCss, selectorMatches } from '../src/core/css.js';
import { parseArgs } from '../src/cli.js';

function doc(html) {
  return parseHtml(html);
}

test('textContent reads the title element itself', () => {
  const document = doc('<html><head><title>My page</title></head><body><p>Body</p></body></html>');
  const title = findAll(document, (node) => tagName(node) === 'title')[0];
  assert.equal(textContent(title), 'My page');
});

test('accessible name comes from alt text inside a link', () => {
  const document = doc('<a href="/"><img src="logo.png" alt="Northwind home"></a>');
  const context = buildContext(document);
  const link = findAll(document, (node) => tagName(node) === 'a')[0];
  assert.equal(accessibleName(link, context).name, 'Northwind home');
  assert.equal(accessibleName(link, context).source, 'content');
});

test('label for/id association is resolved', () => {
  const document = doc('<label for="email">Email address</label><input id="email" type="email">');
  const context = buildContext(document);
  const input = findAll(document, (node) => tagName(node) === 'input')[0];
  assert.equal(accessibleName(input, context).name, 'Email address');
  assert.equal(accessibleName(input, context).source, 'label');
});

test('wrapping labels are resolved', () => {
  const document = doc('<label>Country <input name="country"></label>');
  const context = buildContext(document);
  const input = findAll(document, (node) => tagName(node) === 'input')[0];
  assert.equal(accessibleName(input, context).name, 'Country');
});

test('aria-labelledby wins over visible content', () => {
  const document = doc('<span id="label">Delete file</span><button aria-labelledby="label">X</button>');
  const context = buildContext(document);
  const button = findAll(document, (node) => tagName(node) === 'button')[0];
  assert.equal(accessibleName(button, context).name, 'Delete file');
  assert.equal(accessibleName(button, context).source, 'aria-labelledby');
});

test('table content is not used as the table name', () => {
  const document = doc('<table><tr><td>Plan</td><td>Price</td></tr></table>');
  const context = buildContext(document);
  const table = findAll(document, (node) => tagName(node) === 'table')[0];
  assert.equal(accessibleName(table, context).name, '');
  assert.equal(getRole(table), 'table');
});

test('caption becomes the table name', () => {
  const document = doc('<table><caption>Prices</caption><tr><td>9</td></tr></table>');
  const context = buildContext(document);
  const table = findAll(document, (node) => tagName(node) === 'table')[0];
  assert.equal(accessibleName(table, context).name, 'Prices');
});

test('landmark content is not used as the landmark name', () => {
  const document = doc('<nav><a href="/">Home</a><a href="/about">About</a></nav>');
  const context = buildContext(document);
  const nav = findAll(document, (node) => tagName(node) === 'nav')[0];
  assert.equal(accessibleName(nav, context).name, '');
});

test('dialog body text is not used as the dialog name', () => {
  const document = doc('<div role="dialog"><h2>Cookie settings</h2><button>Accept</button></div>');
  const context = buildContext(document);
  const dialog = findAll(document, (node) => getRole(node) === 'dialog')[0];
  assert.equal(accessibleName(dialog, context).name, '');
});

test('empty aria-label falls back to visible text', () => {
  const document = doc('<button aria-label="">Save</button>');
  const context = buildContext(document);
  const button = findAll(document, (node) => tagName(node) === 'button')[0];
  assert.equal(accessibleName(button, context).name, 'Save');
});

test('role mapping covers native controls', () => {
  const document = doc('<input type="checkbox"><select multiple><option>A</option></select><h2>Title</h2>');
  const roles = findAll(document, (node) => node.tagName).map((node) => getRole(node));
  assert.ok(roles.includes('checkbox'));
  assert.ok(roles.includes('listbox'));
  assert.ok(roles.includes('heading'));
});

test('CSS colours and contrast are calculated', () => {
  assert.deepEqual(parseColor('#fff'), [255, 255, 255, 1]);
  assert.deepEqual(parseColor('rgb(0 0 0 / 50%)'), [0, 0, 0, 0.5]);
  const ratio = contrastRatio([0, 0, 0, 1], [255, 255, 255, 1]);
  assert.ok(ratio > 20.9 && ratio < 21.1);
});

test('CSS selector matching supports descendant and class selectors', () => {
  const document = doc('<div class="card"><p class="text">Hello</p></div>');
  const p = findAll(document, (node) => tagName(node) === 'p')[0];
  assert.equal(selectorMatches(p, '.card .text'), true);
  assert.equal(selectorMatches(p, 'div > p.text'), true);
  assert.equal(selectorMatches(p, '.missing'), false);
});

test('stylesheet parsing resolves a simple cascade', () => {
  const sheet = parseCss('.card { color: #ffffff; background-color: #000000; } .card { font-size: 20px; }');
  assert.equal(sheet.rules.length, 2);
  const document = doc('<div class="card">Hi</div>');
  const card = findAll(document, (node) => tagName(node) === 'div')[0];
  const resolve = createStyleResolver([sheet]);
  const style = resolve(card);
  assert.deepEqual(style.color, [255, 255, 255, 1]);
  assert.deepEqual(style.backgroundColor, [0, 0, 0, 1]);
  assert.equal(style.fontSize, 20);
});

test('focus outline removal is detected', () => {
  const sheet = parseCss('*:focus { outline: none; }');
  const summary = cssSummary([sheet]);
  assert.equal(summary.focusRemoveRules.length, 1);
  assert.match(summary.focusRemoveRules[0].selector, /focus/);
});

test('background shorthand with a function colour is parsed', () => {
  const sheet = parseCss('.a { background: rgb(0 0 0 / 50%); color: #fff; }');
  const document = doc('<div class="a">Hi</div>');
  const element = findAll(document, (node) => tagName(node) === 'div')[0];
  const style = createStyleResolver([sheet])(element);
  assert.deepEqual(style.color, [255, 255, 255, 1]);
  assert.equal(style.backgroundColor[3], 1);
  assert.equal(style.backgroundColor[0] < 255, true);
});

test('CLI flags parse into camelCase options', () => {
  const args = parseArgs([
    './dist',
    '--render',
    '--crawl',
    '3',
    '--ignore',
    'img-alt,css-order',
    '--no-color',
    '--format=html',
  ]);
  assert.deepEqual(args._, ['./dist']);
  assert.equal(args.render, true);
  assert.equal(args.crawl, '3');
  assert.deepEqual(args.ignore, ['img-alt', 'css-order']);
  assert.equal(args.color, false);
  assert.equal(args.format, 'html');
});

test('CLI format shortcuts are normalised', () => {
  assert.equal(parseArgs(['--md']).format, 'markdown');
  assert.equal(parseArgs(['--sarif']).format, 'sarif');
});
