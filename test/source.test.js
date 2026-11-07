import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  getAttributeValue,
  hasAttribute,
  maskOutsideRange,
  scanTags,
  templateRange,
} from '../src/rules/source.js';
import { loadConfig } from '../src/config.js';

test('tag scanner handles multiline JSX attributes', () => {
  const source = `<button
    className="icon"
    aria-label="Close dialog"
    onClick={() => close()}
  >
    <svg viewBox="0 0 16 16" />
  </button>`;
  const tags = scanTags(source, ['button', 'svg']);
  assert.equal(tags.length, 2);
  assert.equal(tags[0].tag, 'button');
  assert.equal(hasAttribute(tags[0].attributeText, 'aria-label'), true);
  assert.equal(getAttributeValue(tags[0].attributeText, 'aria-label'), 'Close dialog');
});

test('tag scanner ignores HTML and JSX comments', () => {
  const source = `<!-- <img src="old.png"> -->\n{/* <img src="jsx.png"> */}\n<img src="real.png" alt="Real">`;
  const tags = scanTags(source, ['img']);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].line, 3);
});

test('Vue script content is masked but template offsets are preserved', () => {
  const source = `<template>\n  <img src="hero.jpg">\n</template>\n<script>\nconst fake = "<img src='no.png'>";\n</script>`;
  const range = templateRange(source);
  assert.ok(range);
  const masked = maskOutsideRange(source, range);
  const tags = scanTags(masked, ['img']);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].line, 2);
});

test('Vue binding syntax is recognised as an attribute', () => {
  const source = '<template><img :alt="product.name" :src="product.image"></template>';
  const tags = scanTags(source, ['img']);
  assert.equal(hasAttribute(tags[0].attributeText, 'alt'), true);
});

test('config file is loaded and merged', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'a11ylens-config-'));
  await fs.writeFile(
    path.join(dir, '.a11ylensrc.json'),
    JSON.stringify({ ignoreRules: ['img-alt'], render: true, crawl: 2 }),
    'utf8',
  );
  const { config, file } = await loadConfig(dir);
  assert.ok(file.endsWith('.a11ylensrc.json'));
  assert.deepEqual(config.ignoreRules, ['img-alt']);
  assert.equal(config.render, true);
  assert.equal(config.crawl, 2);
  assert.equal(config.failOn, 'error');
  await fs.rm(dir, { recursive: true, force: true });
});
