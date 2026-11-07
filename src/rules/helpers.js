import {
  accessibleName,
  attr,
  closest,
  elementPath,
  findAll,
  getRole,
  hasAttr,
  headingLevel,
  isDisabled,
  isElement,
  isFocusable,
  isHiddenFromAT,
  tagName,
  textContent,
} from '../core/html.js';

export function finding(node, message, extra = {}) {
  return { node, message, ...extra };
}

export function fileFinding(file, line, message, extra = {}) {
  return { file, line, message, ...extra };
}

export function isVisible(el, ctx) {
  if (isHiddenFromAT(el)) return false;
  const style = ctx?.styleOf?.(el);
  if (style?.hidden) return false;
  if (style?.opacity === 0) return false;
  return true;
}

export function visibleElements(doc, ctx, predicate) {
  return findAll(doc, (el) => isVisible(el, ctx) && predicate(el));
}

export function nameOf(el, ctx) {
  return accessibleName(el, ctx ?? {}).name;
}

export function isFullDocument(ctx) {
  return findAll(ctx.doc, (el) => tagName(el) === 'html').length > 0;
}

export function textOf(el) {
  return textContent(el);
}

export function selectorOf(el) {
  return elementPath(el);
}

export function isTextEntry(el) {
  const tag = tagName(el);
  if (tag === 'textarea') return true;
  if (tag !== 'input') return false;
  const type = (attr(el, 'type') || 'text').toLowerCase();
  return !['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio', 'file', 'range', 'color'].includes(type);
}

export function isInteractive(el) {
  return (
    isFocusable(el) ||
    ['button', 'a', 'input', 'select', 'textarea', 'summary'].includes(tagName(el))
  );
}

export function hasEventHandler(el, names = ['onclick', 'onmousedown', 'onkeydown', 'onkeyup', 'ontouchstart']) {
  return names.some((name) => hasAttr(el, name));
}

export function accessibleLabel(el, ctx) {
  return accessibleName(el, ctx).name;
}

export function isNamed(el, ctx) {
  return accessibleName(el, ctx).name.trim().length > 0;
}

export function closestLabel(el) {
  return closest(el, (node) => tagName(node) === 'label');
}

export function ancestorFieldset(el) {
  return closest(el, (node) => tagName(node) === 'fieldset');
}

export function isDisabledControl(el) {
  return isDisabled(el);
}

export function isDecorative(el) {
  const role = (attr(el, 'role') || '').toLowerCase();
  return role === 'presentation' || role === 'none' || attr(el, 'aria-hidden') === 'true';
}

export function nodesInOrder(doc, predicate) {
  return findAll(doc, predicate);
}

export function elementRole(el) {
  return getRole(el);
}

export { isElement };
