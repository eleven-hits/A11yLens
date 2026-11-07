import { accessibleName, attr, findAll, getRole, hasAttr, idsReferenced, isElement, isText, tagName } from '../core/html.js';
import { normalizeWhitespace } from '../util.js';
import { finding, isVisible } from './helpers.js';

const BOOLEAN_VALUES = ['true', 'false'];
const OPTIONAL_BOOLEAN_VALUES = [...BOOLEAN_VALUES, 'undefined'];
const TRISTATE_VALUES = [...OPTIONAL_BOOLEAN_VALUES, 'mixed'];
const ARIA_TOKENS = {
  atomic: BOOLEAN_VALUES, busy: BOOLEAN_VALUES, disabled: BOOLEAN_VALUES, modal: BOOLEAN_VALUES,
  multiline: BOOLEAN_VALUES, multiselectable: BOOLEAN_VALUES, readonly: BOOLEAN_VALUES, required: BOOLEAN_VALUES,
  expanded: OPTIONAL_BOOLEAN_VALUES, grabbed: OPTIONAL_BOOLEAN_VALUES, hidden: OPTIONAL_BOOLEAN_VALUES, selected: OPTIONAL_BOOLEAN_VALUES,
  checked: TRISTATE_VALUES, pressed: TRISTATE_VALUES,
  autocomplete: ['inline', 'list', 'both', 'none'],
  current: ['page', 'step', 'location', 'date', 'time', 'true', 'false'],
  haspopup: ['false', 'true', 'menu', 'listbox', 'tree', 'grid', 'dialog'],
  invalid: ['false', 'true', 'grammar', 'spelling'],
  live: ['off', 'polite', 'assertive'],
  orientation: ['horizontal', 'vertical', 'undefined'],
  sort: ['none', 'ascending', 'descending', 'other'],
};
const ARIA_TOKEN_LISTS = {
  relevant: ['additions', 'removals', 'text', 'all'],
  dropeffect: ['copy', 'execute', 'link', 'move', 'none', 'popup'],
};
const ARIA_INTEGERS = new Set(['colcount', 'colindex', 'colspan', 'level', 'posinset', 'rowcount', 'rowindex', 'rowspan', 'setsize']);
const ARIA_NUMBERS = new Set(['valuemin', 'valuemax', 'valuenow']);
const ARIA_IDREFS = ['aria-activedescendant', 'aria-controls', 'aria-details', 'aria-errormessage', 'aria-flowto', 'aria-owns'];
const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const CONTACT_FIELDS = new Set(['tel', 'tel-country-code', 'tel-national', 'tel-area-code', 'tel-local', 'tel-local-prefix', 'tel-local-suffix', 'tel-extension', 'email', 'impp']);
const AUTOFILL_FIELDS = new Set([
  'name', 'honorific-prefix', 'given-name', 'additional-name', 'family-name', 'honorific-suffix', 'nickname',
  'username', 'new-password', 'current-password', 'one-time-code', 'organization-title', 'organization',
  'street-address', 'address-line1', 'address-line2', 'address-line3', 'address-level4', 'address-level3', 'address-level2', 'address-level1',
  'country', 'country-name', 'postal-code', 'cc-name', 'cc-given-name', 'cc-additional-name', 'cc-family-name', 'cc-number',
  'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-type', 'transaction-currency', 'transaction-amount',
  'language', 'bday', 'bday-day', 'bday-month', 'bday-year', 'sex', 'url', 'photo', ...CONTACT_FIELDS,
]);
const CONTENT_WIDGETS = new Set(['button', 'checkbox', 'gridcell', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'switch', 'tab', 'treeitem']);

function invalidAriaValue(name, value) {
  if (ARIA_TOKENS[name]) return !ARIA_TOKENS[name].includes(value.toLowerCase());
  if (ARIA_TOKEN_LISTS[name]) return value.split(/\s+/).some((token) => !ARIA_TOKEN_LISTS[name].includes(token.toLowerCase()));
  if (ARIA_INTEGERS.has(name)) return !/^[+-]?\d+$/.test(value) || !Number.isSafeInteger(Number(value));
  if (ARIA_NUMBERS.has(name)) return !NUMBER_PATTERN.test(value) || !Number.isFinite(Number(value));
  return false;
}

function hasValidAutocomplete(el) {
  const value = attr(el, 'autocomplete').trim().toLowerCase();
  const tokens = value.split(/\s+/);
  if (tokens.length === 1 && ['on', 'off'].includes(tokens[0])) return attr(el, 'type')?.toLowerCase() !== 'hidden';
  let index = 0;
  if (tokens[index]?.startsWith('section-')) index += 1;
  if (['shipping', 'billing'].includes(tokens[index])) index += 1;
  let contact = false;
  if (['home', 'work', 'mobile', 'fax', 'pager'].includes(tokens[index])) { contact = true; index += 1; }
  const field = tokens[index++];
  if (!AUTOFILL_FIELDS.has(field) || (contact && !CONTACT_FIELDS.has(field))) return false;
  if (tokens[index] === 'webauthn' && ['input', 'textarea'].includes(tagName(el))) index += 1;
  return index === tokens.length;
}

function visibleLabel(el, ctx) {
  if (isText(el)) return el.value ?? '';
  if (!isElement(el) || !isVisible(el, ctx) || ctx.styleOf?.(el)?.visuallyHidden || ['script', 'style', 'svg', 'template'].includes(tagName(el))) return '';
  return (el.childNodes ?? []).map((child) => visibleLabel(child, ctx)).join('');
}

function speechLabel(value) {
  return normalizeWhitespace(value.normalize('NFKC').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[\p{P}\p{S}]/gu, ''));
}

export const validationRules = [
  {
    id: 'aria-valid-attr-value', title: 'ARIA state or property has an invalid value', category: 'aria', severity: 'error',
    wcag: ['4.1.2'], level: 'A', tags: ['static', 'aria'],
    description: 'Checks non-empty ARIA boolean, token, token-list, integer and numeric values against their ARIA 1.2 value types.',
    help: 'Use the documented value type, such as aria-expanded="true", aria-live="polite" or a finite number for aria-valuenow.',
    helpUrl: 'https://www.w3.org/WAI/standards-guidelines/act/rules/6a7281/',
    srImpact: 'Invalid states may be ignored or replaced with defaults, so the announced state differs from the widget state.',
    check(ctx) {
      const results = [];
      for (const el of findAll(ctx.doc, () => true)) {
        for (const entry of el.attrs ?? []) {
          if (!entry.name.startsWith('aria-') || !entry.value.trim()) continue;
          if (invalidAriaValue(entry.name.slice(5), entry.value.trim())) {
            results.push(finding(el, `${entry.name}="${entry.value}" is not a valid ARIA value.`, { data: { attribute: entry.name, value: entry.value } }));
          }
        }
      }
      return results;
    },
  },
  {
    id: 'aria-idref-missing', title: 'ARIA relationship points to a missing element', category: 'aria', severity: 'warning',
    wcag: ['1.3.1', '4.1.2'], level: 'A', tags: ['static', 'aria'],
    description: 'Checks ID references in aria-activedescendant, controls, details, errormessage, flowto and owns in the current document. Runtime-created targets need rendered verification.',
    help: 'Match every referenced id to the intended element. If a target is created at runtime, verify the relationship after it is created.',
    helpUrl: 'https://www.w3.org/TR/wai-aria-1.2/#valuetype_idref',
    srImpact: 'The active item, controlled region, detailed description or validation error cannot be located through the announced relationship.',
    check(ctx) {
      const results = [];
      for (const el of findAll(ctx.doc, () => true)) {
        for (const attribute of ARIA_IDREFS) {
          const missing = idsReferenced(attr(el, attribute)).filter((id) => !ctx.byId.has(id));
          if (missing.length) results.push(finding(el, `${attribute} references missing id(s): ${missing.join(', ')}.`, { data: { attribute, missing } }));
        }
      }
      return results;
    },
  },
  {
    id: 'aria-range', title: 'ARIA range values are inconsistent', category: 'aria', severity: 'error',
    wcag: ['4.1.2'], level: 'A', tags: ['static', 'aria'],
    description: 'Checks explicit aria-valuemin, aria-valuemax and aria-valuenow for inverted bounds or a current value outside the declared range.',
    help: 'Keep aria-valuemin <= aria-valuenow <= aria-valuemax. Omit aria-valuenow for an indeterminate progress indicator.',
    helpUrl: 'https://www.w3.org/TR/wai-aria-1.2/#aria-valuenow',
    srImpact: 'A slider, meter or progress indicator announces a value that cannot exist within its stated range.',
    check(ctx) {
      const results = [];
      for (const el of findAll(ctx.doc, () => true)) {
        const values = ['aria-valuemin', 'aria-valuemax', 'aria-valuenow'].map((name) => {
          const raw = attr(el, name)?.trim();
          return raw && NUMBER_PATTERN.test(raw) && Number.isFinite(Number(raw)) ? Number(raw) : null;
        });
        const [min, max, now] = values;
        if (min !== null && max !== null && min > max) results.push(finding(el, `aria-valuemin (${min}) exceeds aria-valuemax (${max}).`));
        else if (now !== null && ((min !== null && now < min) || (max !== null && now > max))) results.push(finding(el, `aria-valuenow (${now}) is outside the declared range ${min ?? 'unbounded'} to ${max ?? 'unbounded'}.`));
      }
      return results;
    },
  },
  {
    id: 'autocomplete-invalid', title: 'Autocomplete tokens are invalid or out of order', category: 'forms', severity: 'warning',
    wcag: ['1.3.5'], level: 'AA', tags: ['static', 'forms'],
    description: 'Validates autocomplete token spelling and order, optional section and contact prefixes, hidden-input restrictions and the final webauthn token. It does not infer whether a valid token describes the intended field.',
    help: 'Use a recognized field token, for example email, given-name or section-checkout shipping street-address. Put webauthn last where supported.',
    helpUrl: 'https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill',
    srImpact: 'Browsers and assistive technology may not identify or autofill the field purpose when its autocomplete tokens are invalid.',
    check(ctx) {
      return findAll(ctx.doc, (el) => ['input', 'select', 'textarea'].includes(tagName(el)) && hasAttr(el, 'autocomplete'))
        .filter((el) => !hasValidAutocomplete(el))
        .map((el) => finding(el, `autocomplete="${attr(el, 'autocomplete')}" is not a valid ordered autocomplete token list.`));
    },
  },
  {
    id: 'label-in-name', title: 'Accessible name does not contain the visible label', category: 'forms', severity: 'warning',
    wcag: ['2.5.3'], level: 'A', tags: ['static', 'forms'],
    description: 'Compares visible text content with ARIA naming on content-named widgets. Ignores case, punctuation and parenthetical text; symbols and short or abbreviated labels need manual review.',
    help: 'Include the visible label in the accessible name, preferably at the beginning. Remove an unnecessary aria-label that replaces correct visible text.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html',
    srImpact: 'Voice control users say the label they can see, but the control is exposed under a different name and may not respond.',
    manual: ['Say the visible label using voice control and confirm that it identifies the intended control.'],
    check(ctx) {
      const results = [];
      for (const el of findAll(ctx.doc, (node) => CONTENT_WIDGETS.has(getRole(node)) && isVisible(node, ctx) && (attr(node, 'aria-label')?.trim() || attr(node, 'aria-labelledby')?.trim()))) {
        const label = normalizeWhitespace(visibleLabel(el, ctx));
        const name = accessibleName(el, ctx).name;
        const normalized = speechLabel(label);
        if (!name || !/\p{L}{2}/u.test(normalized) || /\b[A-Z]{2,}\b/.test(label)) continue;
        if (!speechLabel(name).includes(normalized)) results.push(finding(el, `The accessible name "${name}" does not contain the visible label "${label}".`, { data: { visibleLabel: label, accessibleName: name } }));
      }
      return results;
    },
  },
];
