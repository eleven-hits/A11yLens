import {
  accessibleName,
  attr,
  closest,
  findAll,
  focusableDescendants,
  getExplicitRole,
  getRole,
  hasAttr,
  hasInvalidRole,
  isFocusable,
  tagName,
} from '../core/html.js';
import { finding, isVisible } from './helpers.js';

const KNOWN_ARIA = new Set([
  'activedescendant', 'atomic', 'autocomplete', 'braillelabel', 'brailleroledescription', 'busy',
  'checked', 'colcount', 'colindex', 'colspan', 'controls', 'current', 'describedby', 'description',
  'details', 'disabled', 'dropeffect', 'errormessage', 'expanded', 'flowto', 'grabbed', 'haspopup',
  'hidden', 'invalid', 'keyshortcuts', 'label', 'labelledby', 'level', 'live', 'modal', 'multiline',
  'multiselectable', 'orientation', 'owns', 'placeholder', 'posinset', 'pressed', 'readonly',
  'relevant', 'required', 'roledescription', 'rowcount', 'rowindex', 'rowspan', 'selected',
  'setsize', 'sort', 'valuemax', 'valuemin', 'valuenow', 'valuetext',
]);

const REQUIRED_STATES = {
  checkbox: ['aria-checked'],
  switch: ['aria-checked'],
  radio: ['aria-checked'],
  menuitemcheckbox: ['aria-checked'],
  menuitemradio: ['aria-checked'],
  combobox: ['aria-expanded'],
  slider: ['aria-valuenow'],
  spinbutton: ['aria-valuenow'],
  scrollbar: ['aria-controls', 'aria-valuenow'],
  heading: ['aria-level'],
  tab: ['aria-selected'],
};

const ALLOWED_ATTRS = {
  'aria-checked': new Set(['checkbox', 'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'switch', 'treeitem']),
  'aria-pressed': new Set(['button']),
  'aria-selected': new Set(['columnheader', 'gridcell', 'option', 'row', 'rowheader', 'tab', 'treeitem']),
  'aria-valuenow': new Set(['meter', 'progressbar', 'scrollbar', 'separator', 'slider', 'spinbutton']),
  'aria-valuemin': new Set(['meter', 'progressbar', 'scrollbar', 'separator', 'slider', 'spinbutton']),
  'aria-valuemax': new Set(['meter', 'progressbar', 'scrollbar', 'separator', 'slider', 'spinbutton']),
  'aria-valuetext': new Set(['meter', 'progressbar', 'scrollbar', 'separator', 'slider', 'spinbutton']),
  'aria-level': new Set(['heading', 'listitem', 'row', 'treeitem']),
  'aria-multiselectable': new Set(['grid', 'listbox', 'tablist', 'tree']),
  'aria-required': new Set(['checkbox', 'combobox', 'gridcell', 'listbox', 'radiogroup', 'spinbutton', 'switch', 'textbox', 'tree']),
  'aria-sort': new Set(['columnheader', 'rowheader']),
  'aria-expanded': new Set([
    'application', 'button', 'checkbox', 'combobox', 'columnheader', 'gridcell', 'link', 'listbox',
    'menuitem', 'row', 'rowheader', 'switch', 'tab', 'treeitem',
  ]),
  'aria-orientation': new Set(['listbox', 'menu', 'menubar', 'radiogroup', 'scrollbar', 'select', 'slider', 'tablist', 'toolbar', 'tree']),
};

const REQUIRED_CHILDREN = {
  listbox: ['option', 'group'],
  radiogroup: ['radio'],
  tablist: ['tab'],
  menu: ['menuitem', 'menuitemcheckbox', 'menuitemradio', 'group'],
  menubar: ['menuitem', 'menuitemcheckbox', 'menuitemradio', 'group'],
  tree: ['treeitem', 'group'],
  grid: ['row', 'rowgroup'],
  table: ['row', 'rowgroup'],
  tabpanel: [],
};

const NATIVE_INTERACTIVE = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary', 'details']);

export const ariaRules = [
  {
    id: 'aria-role-invalid',
    title: 'Unknown or abstract ARIA role',
    category: 'aria',
    severity: 'error',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'aria'],
    description: 'role must be a concrete ARIA role. Abstract roles (widget, landmark, input, range) and typos are ignored by browsers.',
    help: 'Use a valid role such as button, navigation, dialog or status. Prefer native HTML elements.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'The element falls back to its native role (often "generic"), so the intended widgets are not announced.',
    check(ctx) {
      return findAll(ctx.doc, (el) => hasInvalidRole(el)).map((el) =>
        finding(el, `The role "${attr(el, 'role')}" is not a valid concrete ARIA role.`),
      );
    },
  },
  {
    id: 'aria-hidden-focus',
    title: 'Focusable content is hidden from assistive technology',
    category: 'aria',
    severity: 'error',
    wcag: ['4.1.2', '2.1.1'],
    level: 'A',
    tags: ['static', 'aria'],
    description:
      'aria-hidden="true" hides a subtree from screen readers but not from the keyboard. Focusable elements inside it become invisible focus stops.',
    help: 'Remove aria-hidden from the container, or add inert/disabled and tabindex="-1" to the focusable children while it is hidden.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact:
      'Keyboard focus moves to an element that the screen reader does not announce. The user loses focus entirely and may think the page froze.',
    manual: [
      'Tab through the area. If focus disappears and the screen reader says nothing, this is the failure.',
      'NVDA: enable Visual Highlight in Settings > Vision and watch for focus landing on an unannounced element.',
    ],
    check(ctx) {
      return findAll(ctx.doc, (el) => attr(el, 'aria-hidden') === 'true')
        .filter((el) => !ctx.styleOf?.(el)?.hidden && !hasAttr(el, 'inert') && !closest(el, (node) => hasAttr(node, 'inert')))
        .map((el) => {
          const focusables = focusableDescendants(el).filter((node) => !ctx.styleOf?.(node)?.hidden);
          if (isFocusable(el)) focusables.unshift(el);
          if (!focusables.length) return null;
          return finding(
            focusables[0],
            `aria-hidden="true" hides ${focusables.length} focusable element(s) from screen readers while they remain keyboard reachable.`,
          );
        })
        .filter(Boolean);
    },
  },
  {
    id: 'aria-hidden-body',
    title: 'The whole page is hidden from assistive technology',
    category: 'aria',
    severity: 'error',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'aria'],
    description: 'aria-hidden="true" on <body> erases the entire page from the accessibility tree.',
    help: 'Remove aria-hidden from body. Hide only the specific overlay or inactive region.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'Screen readers see an empty document. The user is left with silence.',
    check(ctx) {
      return findAll(ctx.doc, (el) => tagName(el) === 'body' && attr(el, 'aria-hidden') === 'true').map((body) =>
        finding(body, '<body aria-hidden="true"> removes the whole page from the accessibility tree.'),
      );
    },
  },
  {
    id: 'aria-label-empty',
    title: 'ARIA name attribute is empty',
    category: 'aria',
    severity: 'warning',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'aria'],
    description: 'Empty ARIA name attributes do not provide a label. Browsers may fall back to native labels or visible text.',
    help: 'Remove the empty attribute, or provide a meaningful value. Use aria-hidden="true" if the element is decorative.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'If no native label or visible text provides a fallback, the element is announced without a name.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        const label = attr(el, 'aria-label');
        const labelledby = attr(el, 'aria-labelledby');
        return (label !== undefined && !label.trim()) || (labelledby !== undefined && !labelledby.trim());
      }).map((el) =>
        finding(
          el,
          attr(el, 'aria-label') !== undefined
            ? 'This element has an empty aria-label. Remove it or provide a meaningful name.'
            : 'This element has an empty aria-labelledby.',
        ),
      );
    },
  },
  {
    id: 'aria-labelledby-missing',
    title: 'aria-labelledby points to a missing element',
    category: 'aria',
    severity: 'warning',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'aria'],
    description: 'Every id in aria-labelledby must exist. Missing references leave the element unnamed.',
    help: 'Fix the id, or remove aria-labelledby and use aria-label or visible text.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'The element is announced with no name, or with a partial name if only some ids resolve.',
    check(ctx) {
      return findAll(ctx.doc, (el) => attr(el, 'aria-labelledby')?.trim())
        .map((el) => {
          const missing = attr(el, 'aria-labelledby')
            .trim()
            .split(/\s+/)
            .filter((id) => !ctx.byId.has(id));
          if (!missing.length) return null;
          return finding(el, `aria-labelledby references missing id(s): ${missing.join(', ')}.`);
        })
        .filter(Boolean);
    },
  },
  {
    id: 'aria-describedby-missing',
    title: 'aria-describedby points to a missing element',
    category: 'aria',
    severity: 'info',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'aria'],
    description: 'Every id in aria-describedby must exist, otherwise help text and error messages are not announced.',
    help: 'Fix the id or remove the reference.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'Instructions or error text attached to the field are silently dropped.',
    check(ctx) {
      return findAll(ctx.doc, (el) => attr(el, 'aria-describedby')?.trim())
        .map((el) => {
          const missing = attr(el, 'aria-describedby')
            .trim()
            .split(/\s+/)
            .filter((id) => !ctx.byId.has(id));
          if (!missing.length) return null;
          return finding(el, `aria-describedby references missing id(s): ${missing.join(', ')}.`);
        })
        .filter(Boolean);
    },
  },
  {
    id: 'aria-required-attr',
    title: 'ARIA role is missing a required state',
    category: 'aria',
    severity: 'error',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'aria'],
    description:
      'Roles such as checkbox, combobox, slider and heading require specific aria-* states. Without them the widget is incomplete.',
    help: 'Add the required attribute, for example aria-checked for role="checkbox" or aria-expanded for role="combobox".',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'Screen readers announce the role but not its state, so users cannot tell whether a checkbox is checked or a menu expanded.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        const role = getExplicitRole(el);
        if (!role || !REQUIRED_STATES[role]) return false;
        return REQUIRED_STATES[role].some((attribute) => !hasAttr(el, attribute));
      }).map((el) => {
        const role = getExplicitRole(el);
        const missing = REQUIRED_STATES[role].filter((attribute) => !hasAttr(el, attribute));
        return finding(el, `role="${role}" requires ${missing.join(' and ')}.`);
      });
    },
  },
  {
    id: 'aria-allowed-attr',
    title: 'ARIA attribute is not allowed on this role',
    category: 'aria',
    severity: 'warning',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'aria'],
    description: 'Some aria-* attributes only apply to specific roles. Browsers ignore the ones that do not.',
    help: 'Remove the unsupported attribute or move it to an element with the correct role.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'The state the author tried to expose is not announced at all.',
    check(ctx) {
      const results = [];
      for (const el of findAll(ctx.doc, (node) => Boolean(getRole(node)) && ALLOWED_ATTRS_ARIA(node))) {
        const role = getRole(el);
        if (!role) continue;
        for (const [attribute, roles] of Object.entries(ALLOWED_ATTRS)) {
          if (attr(el, attribute) === undefined) continue;
          if (roles.has(role)) continue;
          results.push(finding(el, `${attribute} is not supported on role="${role}".`));
        }
      }
      return results;
    },
  },
  {
    id: 'aria-unknown-attr',
    title: 'Unknown aria-* attribute',
    category: 'aria',
    severity: 'warning',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'aria'],
    description: 'Attribute names that are not part of ARIA 1.2 are ignored by browsers and screen readers.',
    help: 'Check the attribute spelling against the ARIA specification. Common typos: aria-lable, aria-describeby, aria-role.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'The intended state or label is silently ignored.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        const names = (el.attrs ?? []).map((entry) => entry.name.toLowerCase()).filter((name) => name.startsWith('aria-'));
        return names.some((name) => !KNOWN_ARIA.has(name.slice(5)));
      }).map((el) => {
        const unknown = (el.attrs ?? [])
          .map((entry) => entry.name.toLowerCase())
          .filter((name) => name.startsWith('aria-') && !KNOWN_ARIA.has(name.slice(5)));
        return finding(el, `Unknown ARIA attribute(s): ${unknown.join(', ')}.`);
      });
    },
  },
  {
    id: 'role-presentation-focusable',
    title: 'Interactive element is marked as presentational',
    category: 'aria',
    severity: 'error',
    wcag: ['4.1.2', '2.1.1'],
    level: 'A',
    tags: ['static', 'aria'],
    description: 'role="presentation" or "none" is ignored on focusable elements, so the element keeps a role that contradicts the markup.',
    help: 'Remove the presentational role from the interactive element, or replace it with a real button/link.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'The element is announced with a role the author did not intend, often as a plain link or button with no name.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        const role = getExplicitRole(el);
        return ['presentation', 'none'].includes(role) && isFocusable(el);
      }).map((el) => finding(el, `role="${getExplicitRole(el)}" is ignored because this element is focusable.`));
    },
  },
  {
    id: 'interactive-role-focusable',
    title: 'Custom widget cannot receive keyboard focus',
    category: 'aria',
    severity: 'warning',
    wcag: ['2.1.1'],
    level: 'A',
    tags: ['static', 'aria'],
    description: 'An element with an interactive ARIA role must be keyboard focusable (tabindex="0" or a native control).',
    help: 'Use the native element, or add tabindex="0" and keyboard handlers for Enter and Space.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    srImpact: 'The widget appears in the accessibility tree but cannot be reached with Tab, so screen reader users must use virtual cursor navigation and cannot operate it.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        const role = getExplicitRole(el);
        if (!['button', 'checkbox', 'combobox', 'link', 'menuitem', 'option', 'radio', 'slider', 'switch', 'tab', 'textbox'].includes(role)) return false;
        if (NATIVE_INTERACTIVE.has(tagName(el))) return false;
        return !isFocusable(el);
      }).map((el) => finding(el, `role="${getExplicitRole(el)}" needs tabindex="0" and keyboard handlers on a <${tagName(el)}>.`));
    },
  },
  {
    id: 'click-handler-noninteractive',
    title: 'Click handler on a non-interactive element',
    category: 'aria',
    severity: 'warning',
    wcag: ['2.1.1', '4.1.2'],
    level: 'A',
    tags: ['static', 'aria'],
    description:
      'A click handler on a div or span is not keyboard operable and has no role. The static scan cannot see handlers added with addEventListener, so verify before fixing.',
    help: 'Use <button type="button"> for actions. If a custom element is unavoidable, add role, tabindex="0" and Enter/Space handling.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    srImpact: 'Screen readers may not expose the element as interactive, and keyboard users cannot activate it.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        if (!hasAttr(el, 'onclick')) return false;
        if (NATIVE_INTERACTIVE.has(tagName(el))) return false;
        return !hasAttr(el, 'onkeydown') && !hasAttr(el, 'onkeyup') && !hasAttr(el, 'onkeypress');
      }).map((el) => finding(el, `This <${tagName(el)}> has an inline onclick but no keyboard handler.`));
    },
  },
  {
    id: 'dialog-name',
    title: 'Dialog has no accessible name',
    category: 'aria',
    severity: 'warning',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'aria'],
    description: 'A dialog needs aria-labelledby pointing to its heading, or aria-label.',
    help: 'Add aria-labelledby="dialog-title" to the dialog and give the heading that id.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'The dialog is announced as "dialog" with no title, so users do not know what opened or what it is for.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        if (!isVisible(el, ctx)) return false;
        const role = getRole(el);
        return tagName(el) === 'dialog' || role === 'dialog' || role === 'alertdialog';
      })
        .filter((el) => !accessibleName(el, ctx).name)
        .map((el) => finding(el, 'This dialog has no accessible name.'));
    },
  },
  {
    id: 'progress-name',
    title: 'Progress bar or meter has no name',
    category: 'aria',
    severity: 'warning',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'aria'],
    description: 'A progress indicator needs a label so users know what is progressing.',
    help: 'Add aria-label="Upload progress" or aria-labelledby pointing to a visible label.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'The value is announced without context: "50 percent" of what?',
    check(ctx) {
      return findAll(ctx.doc, (el) => ['progress', 'meter'].includes(tagName(el)) || getRole(el) === 'progressbar')
        .filter((el) => isVisible(el, ctx) && !accessibleName(el, ctx).name)
        .map((el) => finding(el, 'This progress indicator has no accessible name.'));
    },
  },
  {
    id: 'aria-required-children',
    title: 'ARIA container is missing required children',
    category: 'aria',
    severity: 'warning',
    wcag: ['1.3.1', '4.1.2'],
    level: 'A',
    tags: ['static', 'aria'],
    description:
      'Composite roles must own particular children: listbox → option, tablist → tab, radiogroup → radio, tree → treeitem, grid/table → row.',
    help: 'Add the required child roles, or use the matching native HTML element.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    srImpact: 'Screen readers may not enter the composite widget, or announce an empty group with no items.',
    check(ctx) {
      const results = [];
      for (const el of findAll(ctx.doc, (node) => {
        const role = getRole(node);
        return role && REQUIRED_CHILDREN[role] && REQUIRED_CHILDREN[role].length > 0;
      })) {
        const role = getRole(el);
        const expected = REQUIRED_CHILDREN[role];
        const children = findAll(el, (child) => expected.includes(getRole(child)));
        if (!children.length) {
          results.push(finding(el, `role="${role}" should contain ${expected.map((item) => `role="${item}"`).join(' or ')}.`));
        }
      }
      return results;
    },
  },
];

function ALLOWED_ATTRS_ARIA(node) {
  return Object.keys(ALLOWED_ATTRS).some((attribute) => attr(node, attribute) !== undefined);
}

export { KNOWN_ARIA };
