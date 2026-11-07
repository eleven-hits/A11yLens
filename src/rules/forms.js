import {
  accessibleName,
  attr,
  closest,
  findAll,
  getRole,
  hasAttr,
  tagName,
  textContent,
} from '../core/html.js';
import { finding, isTextEntry, isVisible, nameOf } from './helpers.js';

const LABELABLE = new Set(['input', 'select', 'textarea']);
const SKIP_INPUT_TYPES = new Set(['hidden', 'submit', 'reset', 'button', 'image']);
const IDENTITY_AUTOCOMPLETE = [
  { type: 'password', pattern: /password|passwd|pwd|parola|şifre/i, severity: 'warning', token: 'current-password or new-password' },
  { type: 'email', pattern: /email|e-mail|eposta|e-posta/i, severity: 'warning', token: 'email' },
  { type: 'tel', pattern: /phone|tel|mobile|telefon|gsm/i, severity: 'info', token: 'tel' },
  { type: 'text', pattern: /first.?name|last.?name|full.?name|given.?name|family.?name|name|ad|soyad/i, severity: 'info', token: 'given-name / family-name / name' },
  { type: 'text', pattern: /address|street|city|postal|zip|country|adres|şehir|posta/i, severity: 'info', token: 'street-address / address-level2 / postal-code / country-name' },
];

export const formRules = [
  {
    id: 'form-label',
    title: 'Form control has no label',
    category: 'forms',
    severity: 'error',
    wcag: ['3.3.2', '4.1.2'],
    level: 'A',
    tags: ['static', 'forms'],
    description:
      'Every input, select and textarea needs a programmatic label: <label for>, a wrapping <label>, aria-label or aria-labelledby.',
    help: 'Add <label for="id">Email</label> and match it with the control id. Use aria-label only when a visible label is impossible.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
    srImpact:
      'Screen readers announce "edit text" with no name. When several fields exist, the user cannot tell which one is focused. Voice control users cannot say "click Email".',
    manual: [
      'NVDA: press F to move between form fields and listen to the label announced before the field role.',
      'VoiceOver: use the form rotor and check every field has a label.',
    ],
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        if (!LABELABLE.has(tagName(el)) || !isVisible(el, ctx)) return false;
        if (tagName(el) === 'input' && SKIP_INPUT_TYPES.has((attr(el, 'type') || 'text').toLowerCase())) return false;
        return true;
      })
        .map((control) => ({ control, name: accessibleName(control, ctx) }))
        .filter(({ name }) => !name.name)
        .map(({ control }) =>
          finding(control, `This ${controlKind(control)} has no label, aria-label or aria-labelledby.`),
        );
    },
  },
  {
    id: 'form-placeholder-label',
    title: 'Placeholder is used instead of a label',
    category: 'forms',
    severity: 'warning',
    wcag: ['3.3.2', '4.1.2'],
    level: 'A',
    tags: ['static', 'forms'],
    description:
      'Placeholder text disappears as soon as the user types, is low contrast, and is not a reliable label.',
    help: 'Add a persistent visible <label>. Keep the placeholder only as an example of the expected format.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
    srImpact:
      'Some screen readers announce the placeholder as a description, not a name. Once text is entered, the user can no longer confirm what the field is for.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        if (!LABELABLE.has(tagName(el)) || !isVisible(el, ctx)) return false;
        if (tagName(el) === 'input' && SKIP_INPUT_TYPES.has((attr(el, 'type') || 'text').toLowerCase())) return false;
        return true;
      })
        .map((control) => ({ control, name: accessibleName(control, ctx) }))
        .filter(({ name }) => name.source === 'placeholder' || name.source === 'title')
        .map(({ control, name }) =>
          finding(
            control,
            name.source === 'placeholder'
              ? `This field is named only by its placeholder "${attr(control, 'placeholder')}". Add a real label.`
              : `This field is named only by its title attribute. Add a visible label.`,
          ),
        );
    },
  },
  {
    id: 'label-for-missing',
    title: 'Label points to a missing control',
    category: 'forms',
    severity: 'warning',
    wcag: ['1.3.1', '3.3.2'],
    level: 'A',
    tags: ['static', 'forms'],
    description: 'label[for] must match the id of a form control. A broken reference leaves the control unlabeled.',
    help: 'Match for="field-id" to the control id, or wrap the control inside the label.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
    srImpact: 'The label is not associated with any control, so the field is announced without a name.',
    check(ctx) {
      return findAll(ctx.doc, (el) => tagName(el) === 'label' && (attr(el, 'for') || '').trim())
        .filter((label) => !ctx.byId.has(attr(label, 'for').trim()))
        .map((label) =>
          finding(label, `The label points to "${attr(label, 'for')}", but no element has that id.`),
        );
    },
  },
  {
    id: 'label-empty',
    title: 'Label has no text',
    category: 'forms',
    severity: 'warning',
    wcag: ['1.3.1', '3.3.2'],
    level: 'A',
    tags: ['static', 'forms'],
    description: 'An empty label leaves its control without a name.',
    help: 'Add text to the label, or use aria-label on the control if the design cannot show a visible label.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
    srImpact: 'The associated control is announced with no name.',
    check(ctx) {
      return findAll(ctx.doc, (el) => tagName(el) === 'label' && isVisible(el, ctx))
        .filter((label) => !accessibleName(label, ctx).name && !findAll(label, (child) => LABELABLE.has(tagName(child))).length)
        .map((label) => finding(label, 'This label has no text.'));
    },
  },
  {
    id: 'input-button-name',
    title: 'Input button has no value',
    category: 'forms',
    severity: 'error',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'forms'],
    description: 'input type="button" and explicit empty values on submit/reset inputs produce unnamed buttons.',
    help: 'Set value="Search" (or the action name). For submit/reset, either omit value to keep the browser default or set a meaningful one.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'The button is announced as "button" with no purpose.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        if (tagName(el) !== 'input') return false;
        const type = (attr(el, 'type') || '').toLowerCase();
        return ['button', 'submit', 'reset'].includes(type) && isVisible(el, ctx);
      })
        .filter((el) => {
          if (accessibleName(el, ctx).name) return false;
          const value = attr(el, 'value');
          if (value === undefined) return (attr(el, 'type') || '').toLowerCase() === 'button';
          return !value.trim();
        })
        .map((el) => finding(el, 'This input button has an empty value and no accessible name.'));
    },
  },
  {
    id: 'fieldset-legend',
    title: 'Radio or checkbox group has no group label',
    category: 'forms',
    severity: 'warning',
    wcag: ['1.3.1', '3.3.2'],
    level: 'A',
    tags: ['static', 'forms'],
    description:
      'Groups of radios or checkboxes need a <fieldset> with <legend>, or role="radiogroup"/"group" with an accessible name.',
    help: 'Wrap the group in <fieldset><legend>Delivery method</legend>…</fieldset>.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    srImpact:
      'Screen readers announce each option without the question it belongs to. Users hear "Standard, radio button" and do not know what they are choosing.',
    check(ctx) {
      const groups = new Map();
      for (const control of findAll(ctx.doc, (el) => tagName(el) === 'input' && ['radio', 'checkbox'].includes((attr(el, 'type') || '').toLowerCase()))) {
        const name = attr(control, 'name');
        if (!name) continue;
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(control);
      }
      const results = [];
      for (const [name, controls] of groups) {
        if (controls.length < 2) continue;
        const first = controls[0];
        const fieldset = closest(first, (el) => tagName(el) === 'fieldset');
        const legend = fieldset ? findAll(fieldset, (el) => tagName(el) === 'legend')[0] : null;
        const groupRole = closest(first, (el) => ['radiogroup', 'group'].includes(getRole(el)));
        if (fieldset) continue;
        if (legend && textContent(legend)) continue;
        if (groupRole && nameOf(groupRole, ctx)) continue;
        results.push(
          finding(first, `The "${name}" group has ${controls.length} options but no fieldset/legend or labeled group role.`),
        );
      }
      return results;
    },
  },
  {
    id: 'fieldset-legend-missing',
    title: 'Fieldset has no legend',
    category: 'forms',
    severity: 'warning',
    wcag: ['1.3.1'],
    level: 'A',
    tags: ['static', 'forms'],
    description: 'A fieldset without a legend groups controls without telling the user what the group means.',
    help: 'Add <legend> as the first child of the fieldset.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    srImpact: 'Screen readers announce "group" with no name before the controls.',
    check(ctx) {
      return findAll(ctx.doc, (el) => tagName(el) === 'fieldset' && isVisible(el, ctx))
        .filter((fieldset) => {
          const legend = findAll(fieldset, (el) => tagName(el) === 'legend')[0];
          return !legend || !textContent(legend);
        })
        .map((fieldset) => finding(fieldset, 'This fieldset has no legend.'));
    },
  },
  {
    id: 'autocomplete-missing',
    title: 'Identity field has no autocomplete token',
    category: 'forms',
    severity: 'info',
    wcag: ['1.3.5'],
    level: 'AA',
    tags: ['static', 'forms'],
    description:
      'WCAG 1.3.5 asks authors to identify the purpose of common input fields with autocomplete tokens so browsers and assistive tech can fill them.',
    help: 'Add autocomplete="email", autocomplete="current-password", autocomplete="given-name", and so on.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html',
    srImpact:
      'Users with cognitive or motor disabilities cannot rely on browser autofill. Screen reader users must type the same information repeatedly.',
    check(ctx) {
      const results = [];
      for (const input of findAll(ctx.doc, (el) => tagName(el) === 'input' && isTextEntry(el) && !hasAttr(el, 'disabled'))) {
        if (attr(input, 'autocomplete')?.trim()) continue;
        const type = (attr(input, 'type') || 'text').toLowerCase();
        const hint = `${attr(input, 'name') || ''} ${attr(input, 'id') || ''} ${attr(input, 'placeholder') || ''}`;
        for (const entry of IDENTITY_AUTOCOMPLETE) {
          if (type !== entry.type && !(entry.type === 'text' && type === 'text')) continue;
          if (!entry.pattern.test(hint)) continue;
          results.push(
            finding(input, `This ${type} field looks like an identity field but has no autocomplete attribute (expected ${entry.token}).`, {
              severity: entry.severity,
            }),
          );
          break;
        }
      }
      return results;
    },
  },
  {
    id: 'form-live-region',
    title: 'Forms have no live region for errors or status',
    category: 'forms',
    severity: 'info',
    wcag: ['4.1.3', '3.3.1'],
    level: 'AA',
    tags: ['static', 'forms'],
    description:
      'Validation errors and success messages inserted after submit are silent unless they are in a live region (role="alert" or aria-live).',
    help: 'Add a persistent container with role="alert" or aria-live="polite" and put error text into it after submit.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html',
    srImpact:
      'The form appears to do nothing after submission. Screen reader users resubmit repeatedly because the error message is never announced.',
    check(ctx) {
      const forms = findAll(ctx.doc, (el) => tagName(el) === 'form');
      if (!forms.length) return [];
      const live = findAll(ctx.doc, (el) => hasAttr(el, 'aria-live') || ['alert', 'status', 'log'].includes(getRole(el)));
      if (live.length) return [];
      return [finding(forms[0], 'This page has forms but no aria-live region or alert role. Dynamic errors and status messages may be silent.')];
    },
  },
];

export { LABELABLE };

function controlKind(el) {
  const tag = tagName(el);
  if (tag === 'select') return 'select control';
  if (tag === 'textarea') return 'text area';
  const type = (attr(el, 'type') || 'text').toLowerCase();
  if (type === 'checkbox') return 'checkbox';
  if (type === 'radio') return 'radio button';
  if (type === 'range') return 'slider';
  if (type === 'number') return 'number field';
  if (type === 'search') return 'search field';
  if (type === 'email') return 'email field';
  if (type === 'tel') return 'phone field';
  if (type === 'url') return 'URL field';
  if (type === 'password') return 'password field';
  return 'text field';
}
