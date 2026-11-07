import { parse } from 'parse5';
import { normalizeWhitespace, truncate } from '../util.js';

const RAW_TEXT_TAGS = new Set(['script', 'style', 'noscript', 'template', 'textarea', 'title']);

const VALID_ROLES = new Set([
  'alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote', 'button', 'caption',
  'cell', 'checkbox', 'code', 'columnheader', 'combobox', 'complementary', 'contentinfo',
  'definition', 'deletion', 'dialog', 'directory', 'document', 'emphasis', 'feed', 'figure',
  'form', 'generic', 'grid', 'gridcell', 'group', 'heading', 'img', 'insertion', 'link', 'list',
  'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'menu', 'menubar', 'menuitem',
  'menuitemcheckbox', 'menuitemradio', 'meter', 'navigation', 'none', 'note', 'option',
  'paragraph', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
  'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider', 'spinbutton', 'status',
  'strong', 'subscript', 'superscript', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term',
  'textbox', 'time', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem',
]);

const ABSTRACT_ROLES = new Set([
  'command', 'composite', 'input', 'landmark', 'range', 'roletype', 'section', 'sectionhead',
  'select', 'structure', 'widget', 'window',
]);

const INTERACTIVE_ROLES = new Set([
  'button', 'checkbox', 'combobox', 'gridcell', 'link', 'listbox', 'menuitem',
  'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'scrollbar', 'searchbox', 'slider',
  'spinbutton', 'switch', 'tab', 'textbox', 'treeitem',
]);

const LANDMARK_ROLES = new Set([
  'banner', 'complementary', 'contentinfo', 'form', 'main', 'navigation', 'region', 'search',
]);

const CONTENT_NAME_ROLES = new Set([
  'button', 'cell', 'checkbox', 'columnheader', 'gridcell', 'heading', 'link', 'menuitem',
  'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'row', 'rowheader', 'switch', 'tab',
  'tooltip', 'treeitem', 'term', 'definition', 'paragraph',
]);

export function parseHtml(html) {
  return parse(String(html ?? ''), { sourceCodeLocationInfo: true });
}

export function isElement(node) {
  return Boolean(node && node.tagName && node.nodeName && !node.nodeName.startsWith('#'));
}

export function parentElement(node) {
  let current = node?.parentNode ?? null;
  while (current && !isElement(current)) current = current.parentNode ?? null;
  return current;
}

export function isText(node) {
  return Boolean(node && node.nodeName === '#text');
}

export function tagName(node) {
  return isElement(node) ? node.tagName.toLowerCase() : '';
}

export function attr(node, name) {
  if (!isElement(node)) return undefined;
  const wanted = String(name).toLowerCase();
  const found = node.attrs?.find((entry) => entry.name.toLowerCase() === wanted);
  return found ? found.value : undefined;
}

export function hasAttr(node, name) {
  if (!isElement(node)) return false;
  const wanted = String(name).toLowerCase();
  return Boolean(node.attrs?.some((entry) => entry.name.toLowerCase() === wanted));
}

export function attrMap(node) {
  const map = {};
  if (!isElement(node)) return map;
  for (const entry of node.attrs ?? []) map[entry.name.toLowerCase()] = entry.value;
  return map;
}

export function childElements(node) {
  return (node?.childNodes ?? []).filter(isElement);
}

export function elementChildren(node) {
  return childElements(node);
}

export function walk(root, visit, options = {}) {
  const includeTemplates = options.includeTemplates ?? false;
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    const result = visit(node);
    if (result === false) continue;
    if (isElement(node) && node.tagName === 'template' && node.content && includeTemplates) {
      stack.push(node.content);
    }
    const children = node.childNodes;
    if (!children) continue;
    for (let i = children.length - 1; i >= 0; i -= 1) stack.push(children[i]);
  }
}

export function findAll(root, predicate) {
  const found = [];
  walk(root, (node) => {
    if (isElement(node) && predicate(node)) found.push(node);
  });
  return found;
}

export function closest(node, predicate) {
  let current = node?.parentNode;
  while (current) {
    if (isElement(current) && predicate(current)) return current;
    current = current.parentNode;
  }
  return null;
}

export function ancestors(node) {
  const result = [];
  let current = node?.parentNode;
  while (current) {
    if (isElement(current)) result.push(current);
    current = current.parentNode;
  }
  return result;
}

export function rawText(node) {
  if (!node) return '';
  if (isText(node)) return node.value ?? '';
  let output = '';
  walk(node, (current) => {
    if (isText(current)) output += current.value ?? '';
  });
  return output;
}

export function textContent(node, options = {}) {
  const skipHidden = options.skipHidden ?? true;
  const skipRaw = options.skipRawTextTags ?? true;
  let output = '';
  const visit = (current, isRoot = false) => {
    if (!current) return;
    if (isText(current)) {
      output += current.value ?? '';
      return;
    }
    if (!isElement(current)) {
      for (const child of current.childNodes ?? []) visit(child, false);
      return;
    }
    const tag = tagName(current);
    if (skipRaw && RAW_TEXT_TAGS.has(tag) && !isRoot) return;
    if (skipHidden && (hasAttr(current, 'hidden') || attr(current, 'aria-hidden') === 'true')) return;
    for (const child of current.childNodes ?? []) visit(child, false);
  };
  visit(node, true);
  return normalizeWhitespace(output);
}

export function sourceLocation(node) {
  const loc = node?.sourceCodeLocation;
  if (!loc) return { line: 1, column: 1, startOffset: 0, endOffset: 0 };
  return {
    line: loc.startLine ?? 1,
    column: loc.startCol ?? 1,
    startOffset: loc.startOffset ?? 0,
    endOffset: loc.endOffset ?? loc.startOffset ?? 0,
  };
}

export function sourceSnippet(source, node, max = 220) {
  if (!source || !node?.sourceCodeLocation) return '';
  const { startOffset = 0, endOffset = startOffset } = node.sourceCodeLocation;
  const raw = source.slice(startOffset, Math.min(endOffset || startOffset + max, startOffset + max * 2));
  return truncate(raw.replace(/\s+/g, ' ').trim(), max);
}

export function buildIdIndex(doc) {
  const index = new Map();
  const duplicates = [];
  walk(doc, (node) => {
    if (!isElement(node)) return;
    const id = attr(node, 'id');
    if (!id) return;
    if (index.has(id)) {
      duplicates.push({ id, node, previous: index.get(id) });
    } else {
      index.set(id, node);
    }
  });
  return { byId: index, duplicates };
}

export function idsReferenced(value) {
  return String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function getExplicitRole(el) {
  const raw = attr(el, 'role');
  if (!raw) return null;
  const tokens = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (ABSTRACT_ROLES.has(token)) continue;
    if (VALID_ROLES.has(token)) return token;
  }
  return null;
}

export function hasInvalidRole(el) {
  const raw = attr(el, 'role');
  if (!raw) return false;
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => !VALID_ROLES.has(token) || ABSTRACT_ROLES.has(token));
}

function isDescendantOf(el, predicate) {
  return Boolean(closest(el, predicate));
}

export function getImplicitRole(el) {
  const tag = tagName(el);
  switch (tag) {
    case 'a':
    case 'area':
      return hasAttr(el, 'href') ? 'link' : 'generic';
    case 'article':
      return 'article';
    case 'aside':
      return 'complementary';
    case 'button':
      return 'button';
    case 'datalist':
      return 'listbox';
    case 'dd':
      return 'definition';
    case 'details':
    case 'fieldset':
      return 'group';
    case 'dialog':
      return 'dialog';
    case 'dt':
      return 'term';
    case 'figure':
      return 'figure';
    case 'footer':
      return isDescendantOf(el, (node) => ['article', 'aside', 'main', 'nav', 'section'].includes(tagName(node)))
        ? 'generic'
        : 'contentinfo';
    case 'form':
      return hasAccessibleLabel(el) ? 'form' : 'generic';
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return 'heading';
    case 'header':
      return isDescendantOf(el, (node) => ['article', 'aside', 'main', 'nav', 'section'].includes(tagName(node)))
        ? 'generic'
        : 'banner';
    case 'hr':
      return 'separator';
    case 'html':
      return 'document';
    case 'img': {
      const alt = attr(el, 'alt');
      if (alt === '' && !hasAttr(el, 'tabindex')) return 'presentation';
      return 'img';
    }
    case 'input': {
      const type = (attr(el, 'type') || 'text').toLowerCase();
      if (type === 'button' || type === 'submit' || type === 'reset' || type === 'image') return 'button';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'range') return 'slider';
      if (type === 'number') return 'spinbutton';
      if (type === 'search') return 'searchbox';
      if (type === 'email' || type === 'tel' || type === 'url' || type === 'text' || type === 'password') return 'textbox';
      if (type === 'hidden') return null;
      return 'textbox';
    }
    case 'li':
      return 'listitem';
    case 'main':
      return 'main';
    case 'math':
      return 'math';
    case 'menu':
    case 'ol':
    case 'ul':
      return 'list';
    case 'meter':
      return 'meter';
    case 'nav':
      return 'navigation';
    case 'optgroup':
      return 'group';
    case 'option':
      return 'option';
    case 'output':
      return 'status';
    case 'p':
      return 'paragraph';
    case 'progress':
      return 'progressbar';
    case 'section':
      return hasAccessibleLabel(el) ? 'region' : 'generic';
    case 'select': {
      const multiple = hasAttr(el, 'multiple');
      const size = Number.parseInt(attr(el, 'size') ?? '0', 10);
      return multiple || size > 1 ? 'listbox' : 'combobox';
    }
    case 'summary':
      return 'button';
    case 'table':
      return 'table';
    case 'tbody':
    case 'thead':
    case 'tfoot':
      return 'rowgroup';
    case 'td':
      return 'cell';
    case 'th': {
      const scope = (attr(el, 'scope') || '').toLowerCase();
      if (scope === 'row' || scope === 'rowgroup') return 'rowheader';
      return 'columnheader';
    }
    case 'textarea':
      return 'textbox';
    case 'tr':
      return 'row';
    case 'video':
    case 'audio':
      return null;
    case 'svg':
      return 'img';
    default:
      return 'generic';
  }
}

export function getRole(el) {
  return getExplicitRole(el) ?? getImplicitRole(el);
}

export function hasAccessibleLabel(el) {
  return Boolean(
    attr(el, 'aria-label')?.trim() ||
      attr(el, 'aria-labelledby')?.trim() ||
      attr(el, 'title')?.trim() ||
      (tagName(el) === 'section' && attr(el, 'aria-label')),
  );
}

export function isInteractiveRole(role) {
  return INTERACTIVE_ROLES.has(role);
}

export function isLandmarkRole(role) {
  return LANDMARK_ROLES.has(role);
}

export function isHiddenFromAT(el) {
  let current = el;
  while (isElement(current)) {
    if (attr(current, 'aria-hidden') === 'true') return true;
    if (hasAttr(current, 'hidden')) return true;
    const style = (attr(current, 'style') || '').replace(/\s+/g, '').toLowerCase();
    if (/(?:^|;)display:none(?:;|!|$)/.test(style)) return true;
    if (/(?:^|;)visibility:hidden(?:;|!|$)/.test(style)) return true;
    current = current.parentNode;
  }
  return false;
}

export function isDisabled(el) {
  let current = el;
  while (isElement(current)) {
    if (hasAttr(current, 'disabled') || attr(current, 'aria-disabled') === 'true') return true;
    current = current.parentNode;
  }
  return false;
}

export function isNativelyFocusable(el) {
  const tag = tagName(el);
  if (tag === 'a' || tag === 'area') return hasAttr(el, 'href');
  if (tag === 'button' || tag === 'select' || tag === 'textarea' || tag === 'summary') return !isDisabled(el);
  if (tag === 'input') return (attr(el, 'type') || '').toLowerCase() !== 'hidden' && !isDisabled(el);
  if (tag === 'iframe') return true;
  if (tag === 'audio' || tag === 'video') return hasAttr(el, 'controls');
  if (tag === 'object') return true;
  return false;
}

export function tabIndexValue(el) {
  const raw = attr(el, 'tabindex');
  if (raw === undefined || raw === null || raw === '') return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isFocusable(el) {
  if (hasAttr(el, 'inert') || closest(el, (node) => hasAttr(node, 'inert'))) return false;
  if (isDisabled(el)) return false;
  const tabindex = tabIndexValue(el);
  if (tabindex !== null) return tabindex >= 0;
  if (tagName(el) === 'a') return hasAttr(el, 'href');
  if (tagName(el) === 'area') return hasAttr(el, 'href');
  if (tagName(el) === 'input') return (attr(el, 'type') || '').toLowerCase() !== 'hidden';
  return isNativelyFocusable(el);
}

export function isProgrammaticallyFocusable(el) {
  const tabindex = tabIndexValue(el);
  if (tabindex !== null) return true;
  return isNativelyFocusable(el);
}

export function focusableDescendants(el) {
  return findAll(el, (node) => node !== el && isFocusable(node));
}

function resolveLabelledBy(el, ctx, seen = new Set()) {
  const ids = idsReferenced(attr(el, 'aria-labelledby'));
  if (!ids.length) return '';
  const parts = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const target = ctx?.byId?.get(id);
    if (!target) continue;
    if (attr(target, 'aria-label')?.trim()) {
      parts.push(attr(target, 'aria-label').trim());
    } else {
      parts.push(nameFromContent(target, ctx, seen, isHiddenFromAT(target) || Boolean(ctx?.styleOf?.(target)?.hidden)));
    }
  }
  return normalizeWhitespace(parts.join(' '));
}

export function nameFromContent(el, ctx, seen = new Set(), includeHidden = false) {
  if (!el) return '';
  if (isText(el)) return el.value ?? '';
  if (!isElement(el)) {
    return (el.childNodes ?? []).map((child) => nameFromContent(child, ctx, seen, includeHidden)).join(' ');
  }
  if (!includeHidden && (isHiddenFromAT(el) || ctx?.styleOf?.(el)?.hidden)) return '';
  if (['script', 'style', 'template', 'noscript'].includes(tagName(el))) return '';
  const label = resolveLabelledBy(el, ctx, seen);
  if (label) return label;
  if (attr(el, 'aria-label')?.trim()) return normalizeWhitespace(attr(el, 'aria-label'));
  const tag = tagName(el);
  if (tag === 'img' || tag === 'area') return normalizeWhitespace(attr(el, 'alt') ?? '');
  if (tag === 'svg') {
    const title = findAll(el, (node) => tagName(node) === 'title')[0];
    if (title) return textContent(title);
  }
  if (tag === 'input') {
    const type = (attr(el, 'type') || 'text').toLowerCase();
    if (type === 'button' || type === 'submit' || type === 'reset') return normalizeWhitespace(attr(el, 'value') ?? '');
    if (type === 'image') return normalizeWhitespace(attr(el, 'alt') ?? '');
    return '';
  }
  if (tag === 'br') return ' ';
  const parts = [];
  for (const child of el.childNodes ?? []) parts.push(nameFromContent(child, ctx, seen, includeHidden));
  return normalizeWhitespace(parts.join(' '));
}

function labelTextFor(el, ctx) {
  if (!ctx) return '';
  const tag = tagName(el);
  if (!['input', 'select', 'textarea', 'meter', 'progress', 'output'].includes(tag)) return '';
  if (tag === 'input' && ['button', 'submit', 'reset', 'image', 'hidden'].includes((attr(el, 'type') || 'text').toLowerCase())) {
    return '';
  }
  const parts = [];
  const explicit = attr(el, 'id');
  if (explicit) {
    const labels = ctx.labelsByFor?.get(explicit) ?? [];
    for (const label of labels) parts.push(nameFromContent(label, ctx));
  }
  const wrapping = closest(el, (node) => tagName(node) === 'label');
  if (wrapping) parts.push(nameFromContent(wrapping, ctx));
  return normalizeWhitespace(parts.join(' '));
}

export function accessibleName(el, ctx = {}) {
  const labelledBy = resolveLabelledBy(el, ctx);
  if (labelledBy) return { name: labelledBy, source: 'aria-labelledby' };

  const ariaLabel = attr(el, 'aria-label');
  if (ariaLabel?.trim()) {
    return { name: normalizeWhitespace(ariaLabel), source: 'aria-label' };
  }

  const tag = tagName(el);
  if (tag === 'img' || tag === 'area') {
    const alt = attr(el, 'alt');
    if (alt !== undefined) return { name: normalizeWhitespace(alt), source: 'alt' };
  }
  if (tag === 'input') {
    const type = (attr(el, 'type') || 'text').toLowerCase();
    if (type === 'image') {
      const alt = attr(el, 'alt') || attr(el, 'value');
      if (alt) return { name: normalizeWhitespace(alt), source: 'alt' };
    }
    if (['button', 'submit', 'reset'].includes(type)) {
      const value = attr(el, 'value');
      if (value !== undefined) return { name: normalizeWhitespace(value), source: 'value' };
    }
  }
  if (tag === 'fieldset') {
    const legend = findAll(el, (node) => tagName(node) === 'legend')[0];
    if (legend) return { name: textContent(legend), source: 'legend' };
  }
  if (tag === 'table') {
    const caption = findAll(el, (node) => tagName(node) === 'caption')[0];
    if (caption) return { name: textContent(caption), source: 'caption' };
  }
  if (tag === 'svg') {
    const title = findAll(el, (node) => tagName(node) === 'title')[0];
    if (title) return { name: textContent(title), source: 'title' };
  }
  const labels = labelTextFor(el, ctx);
  if (labels) return { name: labels, source: 'label' };

  if (tag === 'iframe') {
    const title = attr(el, 'title');
    if (title !== undefined) return { name: normalizeWhitespace(title), source: 'title' };
  }

  if (tag === 'title' || tag === 'caption' || tag === 'legend' || tag === 'label' || tag === 'figcaption') {
    return { name: textContent(el), source: 'text' };
  }

  const role = getRole(el);
  if (CONTENT_NAME_ROLES.has(role) || ['label', 'legend', 'caption', 'title', 'figcaption'].includes(tag)) {
    const content = nameFromContent(el, ctx);
    if (content) return { name: content, source: 'content' };
  }

  const title = attr(el, 'title');
  if (title?.trim()) return { name: normalizeWhitespace(title), source: 'title' };

  const placeholder = attr(el, 'placeholder');
  if (placeholder?.trim()) return { name: normalizeWhitespace(placeholder), source: 'placeholder' };

  return { name: '', source: 'none' };
}

export function hasWeakName(el, ctx) {
  const result = accessibleName(el, ctx);
  return result.source === 'placeholder' || result.source === 'title';
}

export function headingLevel(el) {
  const tag = tagName(el);
  if (/^h[1-6]$/.test(tag)) return Number(tag[1]);
  if (attr(el, 'role') === 'heading') {
    const level = Number.parseInt(attr(el, 'aria-level') ?? '', 10);
    return Number.isFinite(level) && level > 0 ? level : 2;
  }
  return null;
}

export function isVisibleText(el) {
  if (isHiddenFromAT(el)) return false;
  return textContent(el).length > 0;
}

export function getLabelableDescendants(root) {
  return findAll(root, (node) =>
    ['input', 'select', 'textarea', 'meter', 'progress', 'output'].includes(tagName(node)),
  ).filter((node) => (attr(node, 'type') || '').toLowerCase() !== 'hidden');
}

export function buildContext(doc) {
  const { byId, duplicates } = buildIdIndex(doc);
  const labelsByFor = new Map();
  for (const label of findAll(doc, (node) => tagName(node) === 'label')) {
    const target = attr(label, 'for');
    if (!target) continue;
    const list = labelsByFor.get(target) ?? [];
    list.push(label);
    labelsByFor.set(target, list);
  }
  return { doc, byId, duplicates, labelsByFor };
}

export function collectTextNodes(element) {
  const output = [];
  walk(element, (node) => {
    if (isText(node)) output.push(node);
  });
  return output;
}

export function hashElement(node) {
  if (!isElement(node)) return '';
  const attrs = (node.attrs ?? [])
    .map((entry) => `${entry.name}=${entry.value}`)
    .sort()
    .join('|');
  return `${tagName(node)}|${attrs}`;
}

export function elementPath(el) {
  const parts = [];
  let current = el;
  while (isElement(current)) {
    const tag = tagName(current);
    const id = attr(current, 'id');
    if (id) {
      parts.unshift(`${tag}#${id}`);
      break;
    }
    const siblings = (current.parentNode?.childNodes ?? []).filter(
      (node) => isElement(node) && tagName(node) === tag,
    );
    const index = siblings.indexOf(current) + 1;
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
    current = current.parentNode;
  }
  return parts.join(' > ');
}

export function isLandmark(el) {
  return isLandmarkRole(getRole(el));
}

export { VALID_ROLES, INTERACTIVE_ROLES, LANDMARK_ROLES };
