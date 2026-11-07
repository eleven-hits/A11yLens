import { parse } from '@babel/parser';
import { lineColFromOffset } from '../util.js';

const sourceCache = { source: null, filename: null, tags: null };

function skipValue(source, start) {
  const first = source[start];
  if (first === '"' || first === "'" || first === '`') {
    let index = start + 1;
    for (; index < source.length; index += 1) {
      if (source[index] === '\\') { index += 1; continue; }
      if (source[index] === first) return index + 1;
    }
    return index;
  }
  if (first === '{') {
    let depth = 1;
    let index = start + 1;
    while (index < source.length && depth) {
      const char = source[index];
      if (char === '"' || char === "'" || char === '`') { index = skipValue(source, index); continue; }
      if (source.startsWith('/*', index)) { const end = source.indexOf('*/', index + 2); index = end < 0 ? source.length : end + 2; continue; }
      if (source.startsWith('//', index)) { const end = source.indexOf('\n', index + 2); index = end < 0 ? source.length : end + 1; continue; }
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      index += 1;
    }
    return index;
  }
  let index = start;
  while (index < source.length && !/\s|>/.test(source[index])) index += 1;
  return index;
}

function attributes(attributeText) {
  const result = new Map();
  let index = 0;
  while (index < attributeText.length) {
    while (/\s/.test(attributeText[index] ?? '') && index < attributeText.length) index += 1;
    if (index >= attributeText.length || attributeText[index] === '/') break;
    if (attributeText[index] === '{') { index = skipValue(attributeText, index); continue; }
    const match = /^[^\s=/>]+/.exec(attributeText.slice(index));
    if (!match) { index += 1; continue; }
    const name = match[0].replace(/^(?:v-bind:|:)/, '').toLowerCase();
    index += match[0].length;
    while (/\s/.test(attributeText[index] ?? '') && index < attributeText.length) index += 1;
    let value = '';
    if (attributeText[index] === '=') {
      index += 1;
      while (/\s/.test(attributeText[index] ?? '') && index < attributeText.length) index += 1;
      const end = skipValue(attributeText, index);
      const raw = attributeText.slice(index, end);
      value = /^["'`{]/.test(raw) ? raw.slice(1, -1) : raw;
      index = end;
    }
    result.set(name, value);
  }
  return result;
}

function templateTags(source) {
  const tags = [];
  const masked = source.replace(/^---[\s\S]*?^---/m, (value) => value.replace(/[^\n]/g, ' '));
  let index = 0;
  while (index < masked.length) {
    if (masked.startsWith('<!--', index) || masked.startsWith('{/*', index)) {
      const terminator = masked[index] === '<' ? '-->' : '*/}';
      const end = masked.indexOf(terminator, index + 3);
      index = end < 0 ? masked.length : end + terminator.length;
      continue;
    }
    if (masked[index] === '{') { index = skipValue(masked, index); continue; }
    const match = /^<([a-zA-Z][\w:.-]*)/.exec(masked.slice(index));
    if (!match) { index += 1; continue; }
    const start = index;
    const tag = match[1].toLowerCase();
    const attributeStart = start + match[0].length;
    index = attributeStart;
    while (index < masked.length && masked[index] !== '>') {
      if (['"', "'", '`', '{'].includes(masked[index])) index = skipValue(masked, index);
      else index += 1;
    }
    const end = Math.min(index + 1, masked.length);
    const location = lineColFromOffset(source, start);
    tags.push({ tag, start, end, attributeText: source.slice(attributeStart, index), selfClosing: /\/\s*>$/.test(source.slice(start, end)), ...location });
    index = end;
    if (tag === 'script' || tag === 'style') {
      const close = masked.toLowerCase().indexOf(`</${tag}`, index);
      index = close < 0 ? masked.length : masked.indexOf('>', close) + 1;
    }
  }
  return tags;
}

function componentTags(source, filename) {
  const isJavaScript = /\.[cm]?[jt]sx?$/i.test(filename);
  if (!isJavaScript && /\.(vue|svelte|astro)$/i.test(filename)) return templateTags(source);
  let ast;
  try {
    ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript', 'decorators-legacy'], attachComment: false, allowReturnOutsideFunction: true });
  } catch (error) {
    if (isJavaScript) throw new Error(`Could not parse component source: ${error.message}`);
    return templateTags(source);
  }
  const tags = [];
  const stack = [ast];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (node.type === 'JSXOpeningElement') {
      const name = source.slice(node.name.start, node.name.end).toLowerCase();
      tags.push({ tag: name, start: node.start, end: node.end, attributeText: source.slice(node.name.end, node.end - 1), selfClosing: node.selfClosing, line: node.loc.start.line, column: node.loc.start.column + 1 });
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) { for (const child of value) if (child?.type) stack.push(child); }
      else if (value?.type) stack.push(value);
    }
  }
  return tags.sort((a, b) => a.start - b.start);
}

export function scanTags(source, wantedTags, range = null, filename = '') {
  if (sourceCache.source !== source || sourceCache.filename !== filename) {
    const tags = componentTags(source, filename);
    Object.assign(sourceCache, { source, filename, tags });
  }
  const wanted = new Set([...wantedTags].map((tag) => tag.toLowerCase()));
  return sourceCache.tags.filter((tag) => (!wanted.size || wanted.has(tag.tag)) && tag.start >= (range?.start ?? 0) && tag.start < (range?.end ?? source.length));
}

function tagsFor(ctx, wantedTags) {
  return scanTags(ctx.source, wantedTags, null, ctx.file);
}

export function hasAttribute(attributeText, name) {
  return attributes(attributeText).has(name.toLowerCase());
}

export function getAttributeValue(attributeText, name) {
  return attributes(attributeText).get(name.toLowerCase()) ?? null;
}

export function templateRange(source) {
  const match = source.match(/<template[^>]*>/i);
  if (!match) return null;
  const start = match.index + match[0].length;
  const end = source.lastIndexOf('</template>');
  if (end <= start) return null;
  return { start, end };
}

export function innerContent(source, tag) {
  if (tag.selfClosing) return '';
  const close = source.toLowerCase().indexOf(`</${tag.tag}`, tag.end);
  if (close === -1) return '';
  return source.slice(tag.end, close);
}

export function maskOutsideRange(source, range) {
  if (!range) return source;
  const before = source.slice(0, range.start).replace(/[^\n]/g, ' ');
  const inside = source.slice(range.start, range.end);
  const after = source.slice(range.end).replace(/[^\n]/g, ' ');
  return `${before}${inside}${after}`;
}

export function visibleTextIn(inner) {
  return inner
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{[^}]*\}/g, ' text ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findingAt(tag, message, extra = {}) {
  return { file: extra.file, line: tag.line, column: tag.column, message, ...extra };
}

const CLICK_PATTERNS = [/\bonclick\s*=/, /@click(?:\.\w+)?\s*=/, /v-on:click(?:\.\w+)?\s*=/, /\bon:click(?:\|\w+)*\s*=/, /\bonclick\s*=/i];
const KEY_PATTERNS = [/\bonkeydown\s*=/, /\bonkeyup\s*=/, /@keydown(?:\.\w+)?\s*=/, /@keyup(?:\.\w+)?\s*=/, /\bon:keydown(?:\|\w+)*\s*=/, /\bonkeydown\s*=/i];

export const sourceRules = [
  {
    id: 'src-img-alt',
    title: 'JSX/Vue image is missing alt',
    category: 'source',
    severity: 'error',
    wcag: ['1.1.1'],
    level: 'A',
    tags: ['source', 'images'],
    description: 'Images in component templates need an alt prop/attribute, exactly like static HTML.',
    help: 'Add alt="description" or alt="" for decorative images. Spread props are skipped because the tool cannot verify them.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    srImpact: 'The rendered image has no accessible name, so screen readers announce the file name or skip it.',
    checkSource(ctx) {
      return tagsFor(ctx, ['img'])
        .filter((tag) => !hasAttribute(tag.attributeText, 'alt'))
        .filter((tag) => !hasAttribute(tag.attributeText, 'aria-label') && !hasAttribute(tag.attributeText, 'aria-labelledby'))
        .filter((tag) => !/\{\.\.\./.test(tag.attributeText))
        .map((tag) => findingAt(tag, '<img> has no alt prop. Add alt text or alt="" for decorative images.', { file: ctx.file }));
    },
  },
  {
    id: 'src-image-component',
    title: 'Image component is missing alt',
    category: 'source',
    severity: 'warning',
    wcag: ['1.1.1'],
    level: 'A',
    tags: ['source', 'images'],
    description: 'Framework image components (Image, NextImage, Img) still render an <img> and need alt.',
    help: 'Pass alt as a prop. If the component cannot accept alt, wrap it in a component that can.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    srImpact: 'The rendered image has no accessible name.',
    checkSource(ctx) {
      return tagsFor(ctx, ['image', 'nextimage', 'nuxtimg', 'img'])
        .filter((tag) => tag.tag !== 'img')
        .filter((tag) => !hasAttribute(tag.attributeText, 'alt'))
        .filter((tag) => !hasAttribute(tag.attributeText, 'aria-label') && !hasAttribute(tag.attributeText, 'aria-labelledby'))
        .filter((tag) => !/\{\.\.\./.test(tag.attributeText))
        .map((tag) => findingAt(tag, `<${tag.tag}> is missing an alt prop.`, { file: ctx.file }));
    },
  },
  {
    id: 'src-anchor-href',
    title: 'Anchor has no href',
    category: 'source',
    severity: 'warning',
    wcag: ['2.1.1', '4.1.2'],
    level: 'A',
    tags: ['source', 'navigation'],
    description: 'An <a> without href is not a link. Click handlers on it are not keyboard operable.',
    help: 'Use href for navigation. Use <button type="button"> for actions.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    srImpact: 'Screen readers may announce plain text instead of a link, or a link that does nothing when activated.',
    checkSource(ctx) {
      return tagsFor(ctx, ['a'])
        .filter((tag) => !hasAttribute(tag.attributeText, 'href'))
        .filter((tag) => !hasAttribute(tag.attributeText, 'name'))
        .filter((tag) => !/\{\.\.\./.test(tag.attributeText))
        .map((tag) => findingAt(tag, '<a> has no href. Use <button> for actions or add a real destination.', { file: ctx.file }));
    },
  },
  {
    id: 'src-click-noninteractive',
    title: 'Click handler on a non-interactive element',
    category: 'source',
    severity: 'error',
    wcag: ['2.1.1'],
    level: 'A',
    tags: ['source', 'keyboard'],
    description:
      'A click handler on div, span, li or similar has no keyboard equivalent and no role, so keyboard and screen reader users cannot activate it.',
    help: 'Use <button type="button">. If unavoidable, add role="button", tabIndex={0} and onKeyDown for Enter and Space.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    srImpact:
      'The control is not in the tab order or is announced as plain text. Screen reader and keyboard users cannot perform the action.',
    manual: ['Tab to the element. If focus skips it, or Enter/Space do nothing, the finding is confirmed.'],
    checkSource(ctx) {
      const tags = tagsFor(ctx, ['div', 'span', 'li', 'td', 'th', 'tr', 'p', 'section', 'article', 'header', 'footer', 'img', 'figure', 'ul']);
      return tags
        .filter((tag) => CLICK_PATTERNS.some((pattern) => pattern.test([...attributes(tag.attributeText).keys()].map((name) => `${name}=`).join(' '))))
        .filter((tag) => !KEY_PATTERNS.some((pattern) => pattern.test([...attributes(tag.attributeText).keys()].map((name) => `${name}=`).join(' '))))
        .map((tag) => {
          const hasRole = hasAttribute(tag.attributeText, 'role');
          const hasTabIndex = hasAttribute(tag.attributeText, 'tabIndex') || hasAttribute(tag.attributeText, 'tabindex');
          const detail = hasRole || hasTabIndex
            ? 'has a role/tabIndex but no keyboard handler, so Enter and Space will not activate it.'
            : 'has a click handler but no role, tabIndex or keyboard handler.';
          return findingAt(tag, `<${tag.tag}> ${detail}`, { file: ctx.file });
        });
    },
  },
  {
    id: 'src-icon-button',
    title: 'Icon-only button has no accessible name',
    category: 'source',
    severity: 'error',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['source', 'forms'],
    description: 'A button whose only child is an icon needs aria-label (or visually hidden text).',
    help: 'Add aria-label="Close" to the button, or include text inside a visually hidden span.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'Screen readers announce "button" and Voice control users cannot target it.',
    checkSource(ctx) {
      const results = [];
      for (const tag of tagsFor(ctx, ['button'])) {
        if (hasAttribute(tag.attributeText, 'aria-label') || hasAttribute(tag.attributeText, 'aria-labelledby') || hasAttribute(tag.attributeText, 'title')) {
          continue;
        }
        const inner = innerContent(ctx.source, tag);
        const text = visibleTextIn(inner);
        const hasIcon = /<(svg|icon|i\b|span[^>]*class=["'][^"']*(icon|fa-|material-icons))/i.test(inner);
        if (!text && (hasIcon || !inner.trim())) {
          results.push(findingAt(tag, 'This button has only an icon child and no aria-label.', { file: ctx.file }));
        }
      }
      return results;
    },
  },
  {
    id: 'src-label-for',
    title: 'Label is not bound to a control',
    category: 'source',
    severity: 'info',
    wcag: ['1.3.1', '3.3.2'],
    level: 'A',
    tags: ['source', 'forms'],
    description:
      'A <label> without htmlFor/for only works when it wraps the control. Component libraries often move the control out of the label.',
    help: 'Add htmlFor="field-id" (React) or for="field-id" (Vue/Svelte), or keep the input inside the label.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
    srImpact: 'The control is announced without its label.',
    checkSource(ctx) {
      return tagsFor(ctx, ['label'])
        .filter((tag) => !hasAttribute(tag.attributeText, 'htmlFor') && !hasAttribute(tag.attributeText, 'for'))
        .filter((tag) => !/\{\.\.\./.test(tag.attributeText))
        .map((tag) => findingAt(tag, '<label> has no htmlFor/for. Verify that it wraps the control.', { file: ctx.file }));
    },
  },
  {
    id: 'src-tabindex-positive',
    title: 'Positive tabIndex in component',
    category: 'source',
    severity: 'warning',
    wcag: ['2.4.3'],
    level: 'A',
    tags: ['source', 'keyboard'],
    description: 'tabIndex greater than 0 breaks the natural focus order.',
    help: 'Use tabIndex={0} and reorder the DOM instead.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html',
    srImpact: 'Keyboard and screen reader focus jump around the page.',
    checkSource(ctx) {
      const results = [];
      for (const tag of tagsFor(ctx, ['div', 'span', 'button', 'a', 'input', 'section', 'li', 'tr', 'td'])) {
        const raw = getAttributeValue(tag.attributeText, 'tabIndex') ?? getAttributeValue(tag.attributeText, 'tabindex');
        if (raw === null) continue;
        const value = Number.parseInt(raw.replace(/[{}]/g, '').trim(), 10);
        if (Number.isFinite(value) && value > 0) {
          results.push(findingAt(tag, `tabIndex={${value}} removes this element from the natural focus order.`, { file: ctx.file }));
        }
      }
      return results;
    },
  },
  {
    id: 'src-autofocus',
    title: 'Component steals focus on mount',
    category: 'source',
    severity: 'info',
    wcag: ['3.2.1'],
    level: 'A',
    tags: ['source', 'focus'],
    description: 'autoFocus moves focus without warning, often to a search field in a modal, and disorients screen reader users.',
    help: 'Avoid autoFocus. If focus must move, send it to a heading or dialog with a clear announcement.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html',
    srImpact: 'The page changes context without warning; screen reader users may not hear the new content.',
    checkSource(ctx) {
      return tagsFor(ctx, ['input', 'textarea', 'select', 'button', 'div', 'a'])
        .filter((tag) => hasAttribute(tag.attributeText, 'autoFocus') || hasAttribute(tag.attributeText, 'autofocus'))
        .map((tag) => findingAt(tag, 'This element uses autoFocus/autofocus.', { file: ctx.file }));
    },
  },
  {
    id: 'src-dangerous-html',
    title: 'Raw HTML injection bypasses accessibility checks',
    category: 'source',
    severity: 'info',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['source'],
    description: 'dangerouslySetInnerHTML can insert images without alt, links without text and broken ARIA at runtime.',
    help: 'Sanitize and validate the HTML, or render structured content with components that enforce alt text and labels.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'Injected content may be unlabeled, have broken landmarks or duplicate ids, and the build-time audit cannot see it.',
    checkSource(ctx) {
      return tagsFor(ctx, [])
        .filter((tag) => hasAttribute(tag.attributeText, 'dangerouslySetInnerHTML'))
        .map((tag) => findingAt(tag, 'dangerouslySetInnerHTML injects unverified markup.', { file: ctx.file }));
    },
  },
  {
    id: 'src-v-html',
    title: 'v-html injects unverified markup',
    category: 'source',
    severity: 'info',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['source'],
    description: 'v-html renders raw HTML that the static audit cannot check for alt text, labels or ARIA.',
    help: 'Prefer structured templates, or sanitize and test the injected content.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'Injected images and controls may be unlabeled.',
    checkSource(ctx) {
      return tagsFor(ctx, ['div', 'span', 'section', 'article', 'p'])
        .filter((tag) => hasAttribute(tag.attributeText, 'v-html'))
        .map((tag) => findingAt(tag, 'v-html renders markup that bypasses this audit.', { file: ctx.file }));
    },
  },
  {
    id: 'src-svelte-html',
    title: '{@html} injects unverified markup',
    category: 'source',
    severity: 'info',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['source'],
    description: 'Svelte {@html} renders raw HTML that the static audit cannot check.',
    help: 'Prefer normal markup, or sanitize and test the injected content.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'Injected images and controls may be unlabeled.',
    checkSource(ctx) {
      const results = [];
      const regex = /\{@html/g;
      let match;
      while ((match = regex.exec(ctx.source))) {
        const loc = lineColFromOffset(ctx.source, match.index);
        results.push({ file: ctx.file, line: loc.line, column: loc.column, message: '{@html} renders markup that bypasses this audit.' });
      }
      return results;
    },
  },
  {
    id: 'src-dialog-name',
    title: 'Dialog component has no accessible name',
    category: 'source',
    severity: 'info',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['source', 'aria'],
    description: 'Dialog and Modal components need aria-labelledby or aria-label.',
    help: 'Pass aria-labelledby="dialog-title" and give the dialog heading that id.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'The dialog opens with no announced title.',
    checkSource(ctx) {
      return tagsFor(ctx, ['dialog', 'modal', 'alertdialog', 'sheet'])
        .filter((tag) => !hasAttribute(tag.attributeText, 'aria-label') && !hasAttribute(tag.attributeText, 'aria-labelledby') && !hasAttribute(tag.attributeText, 'title'))
        .filter((tag) => !/\{\.\.\./.test(tag.attributeText))
        .map((tag) => findingAt(tag, `<${tag.tag}> has no aria-label/aria-labelledby/title.`, { file: ctx.file }));
    },
  },
  {
    id: 'src-role-button-focus',
    title: 'role="button" is not keyboard focusable',
    category: 'source',
    severity: 'warning',
    wcag: ['2.1.1'],
    level: 'A',
    tags: ['source', 'keyboard'],
    description: 'role="button" on a div/span only works if the element is focusable and handles Enter/Space.',
    help: 'Add tabIndex={0} and onKeyDown, or use <button>.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    srImpact: 'The custom button cannot be reached with Tab.',
    checkSource(ctx) {
      return tagsFor(ctx, ['div', 'span', 'li', 'section'])
        .filter((tag) => getAttributeValue(tag.attributeText, 'role') === 'button')
        .filter((tag) => !hasAttribute(tag.attributeText, 'tabIndex') && !hasAttribute(tag.attributeText, 'tabindex'))
        .map((tag) => findingAt(tag, 'role="button" needs tabIndex={0} and keyboard handling.', { file: ctx.file }));
    },
  },
];
