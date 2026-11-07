import { contrastRatio, directText, formatColor, hasVisibleFocusIndicator, isLargeText, splitSelectors } from '../core/css.js';
import { findAll, isFocusable, tagName } from '../core/html.js';
import { selectorMatches } from '../core/css.js';
import { finding, fileFinding, isVisible } from './helpers.js';

export const styleRules = [
  {
    id: 'css-focus-outline',
    title: 'Focus outline is removed without a replacement',
    category: 'styles',
    severity: 'warning',
    wcag: ['2.4.7'],
    level: 'AA',
    tags: ['static', 'styles'],
    description:
      'outline: none on :focus removes the only visible focus indicator. Keyboard users cannot see where they are.',
    help: 'Keep the outline, or replace it with a clearly visible box-shadow, border or background change that meets 3:1 contrast against the background.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html',
    srImpact:
      'Screen reader users with partial sight rely on the visual focus ring while using the keyboard. Without it, focus seems to disappear.',
    manual: [
      'Press Tab through the page and watch the focused element. It must be obvious at every step.',
      'Check focus on links, buttons, form fields and custom widgets against both light and dark backgrounds.',
    ],
    check(ctx) {
      const findings = [];
      for (const entry of ctx.css?.focusRemoveRules ?? []) {
        const elements = findAll(ctx.doc, (el) => isFocusable(el) && splitSelectors(entry.selector).some((selector) => selectorMatches(el, selector, { includePseudo: ['focus', 'focus-visible'] })));
        if (elements.length && elements.every((el) => {
          const declarations = ctx.styleOf?.focusDeclarations?.(el);
          if (!declarations) return false;
          return hasVisibleFocusIndicator(declarations);
        })) continue;
        findings.push(
          fileFinding(
            entry.file,
            entry.line,
            `The selector "${entry.selector}" removes the focus outline without adding another visible indicator.`,
            { selector: entry.selector },
          ),
        );
      }
      return findings;
    },
  },
  {
    id: 'css-reduced-motion',
    title: 'Animation ignores prefers-reduced-motion',
    category: 'styles',
    severity: 'info',
    wcag: ['2.3.3'],
    level: 'AAA',
    tags: ['static', 'styles'],
    description:
      'Large or continuous motion can cause dizziness and nausea. The stylesheet defines animation or transitions but no reduced-motion override.',
    help: 'Add @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html',
    srImpact: 'Users with vestibular disorders may experience dizziness, and motion can distract from screen reader speech.',
    check(ctx) {
      const summary = ctx.css;
      if (!summary || (!summary.hasAnimation && !summary.hasTransition) || summary.hasReducedMotion) return [];
      const sheet = (ctx.sheets ?? []).find((entry) => entry.meta.hasAnimation || entry.meta.hasTransition);
      if (!sheet) return [];
      return [
        fileFinding(
          sheet.file,
          1,
          'This stylesheet animates content but has no (prefers-reduced-motion: reduce) block.',
        ),
      ];
    },
  },
  {
    id: 'css-order',
    title: 'CSS order changes the visual order',
    category: 'styles',
    severity: 'info',
    wcag: ['1.3.2'],
    level: 'A',
    tags: ['static', 'styles'],
    description:
      'The CSS order property reorders flex and grid items visually while the DOM order, which screen readers follow, stays the same.',
    help: 'Place items in the desired order in the DOM and use layout properties only for presentation that does not change reading order.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html',
    srImpact: 'Screen reader reading order and keyboard focus order diverge from what sighted users see, causing disorientation.',
    check(ctx) {
      return (ctx.css?.orderUsage ?? []).slice(0, 10).map((entry) =>
        fileFinding(entry.file, entry.line, `"${entry.selector}" uses the order property, which can desynchronize visual and reading order.`, {
          selector: entry.selector,
        }),
      );
    },
  },
  {
    id: 'css-contrast',
    title: 'Estimated text contrast is below WCAG AA',
    category: 'styles',
    severity: 'warning',
    wcag: ['1.4.3'],
    level: 'AA',
    tags: ['static', 'styles'],
    description:
      'The static stylesheet estimate resolves the text and background colours. Gradients, images, opacity and media queries can change the real result, so verify in the browser.',
    help: 'Raise the contrast to at least 4.5:1 for normal text and 3:1 for large text (18.66px bold or 24px).',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
    srImpact:
      'Low-vision users, including many screen reader users with partial sight, cannot read the text even with magnification.',
    manual: [
      'Use the browser accessibility inspector or a contrast picker on the rendered page to confirm the ratio.',
      'Test the same component in light mode, dark mode and high-contrast mode.',
    ],
    check(ctx) {
      if (!ctx.styleOf) return [];
      const results = [];
      const seen = new Set();
      const candidates = findAll(ctx.doc, (el) => {
        if (!['span', 'p', 'a', 'li', 'td', 'th', 'label', 'button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'strong', 'em', 'small', 'figcaption', 'blockquote', 'dt', 'dd'].includes(tagName(el))) return false;
        if (!isVisible(el, ctx)) return false;
        return Boolean(directText(el));
      });
      for (const el of candidates) {
        const style = ctx.styleOf(el);
        if (style.backgroundImage || style.backgroundImageBehind || !style.backgroundDeclared) continue;
        if (!style.color || !style.backgroundColor) continue;
        const ratio = contrastRatio(style.color, style.backgroundColor);
        if (ratio === null) continue;
        const threshold = isLargeText(style) ? 3 : 4.5;
        if (ratio >= threshold) continue;
        const text = directText(el).slice(0, 60);
        const key = `${formatColor(style.color)}|${formatColor(style.backgroundColor)}|${Math.round(ratio * 10)}|${text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(
          finding(
            el,
            `Estimated contrast ${ratio.toFixed(2)}:1 for "${text}" (${formatColor(style.color)} on ${formatColor(style.backgroundColor)}). WCAG AA needs ${threshold}:1.`,
            {
              data: {
                ratio: Number(ratio.toFixed(2)),
                foreground: formatColor(style.color),
                background: formatColor(style.backgroundColor),
                text,
              },
            },
          ),
        );
        if (results.length >= 20) break;
      }
      return results;
    },
  },
];
