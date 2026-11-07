import {
  accessibleName,
  attr,
  findAll,
  getRole,
  hasAttr,
  headingLevel,
  isElement,
  tagName,
  textContent,
} from '../core/html.js';
import { normalizeWhitespace } from '../util.js';
import { finding, isFullDocument, isVisible, nameOf, visibleElements } from './helpers.js';

const SKIP_TEXT =
  /\b(skip (to )?(the )?(main|content)|skip navigation|jump to (the )?(main|content)|ana içeriğe|içeriğe atla)\b/i;
const VAGUE_LINK_TEXT = new Set([
  'click here', 'here', 'click', 'read more', 'more', 'learn more', 'this link', 'link',
  'continue', 'details', 'download', 'go', 'see more', 'view more', 'this page', 'this',
  'daha fazla', 'buraya', 'tıkla', 'devam', 'bu link', 'bağlantı',
]);

function isFragment(ctx) {
  return !isFullDocument(ctx);
}

export const documentRules = [
  {
    id: 'html-lang',
    title: 'Page language is missing or invalid',
    category: 'document',
    severity: 'error',
    wcag: ['3.1.1'],
    level: 'A',
    tags: ['static', 'document'],
    description:
      'The <html> element needs a valid lang attribute so screen readers choose the right voice, pronunciation rules and braille table.',
    help: 'Set lang on <html>, for example lang="en" or lang="tr".',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html',
    srImpact:
      'NVDA, JAWS and VoiceOver fall back to the system language. Words are pronounced with the wrong phonemes and braille output may use the wrong table.',
    manual: [
      'NVDA: open the speech dialog (NVDA+Ctrl+V) and confirm the synthesizer language changes when the page loads.',
      'VoiceOver: with the rotor on, check that the voice does not switch to the wrong language when reading the page.',
    ],
    check(ctx) {
      if (isFragment(ctx)) return [];
      const html = findAll(ctx.doc, (el) => tagName(el) === 'html')[0];
      if (!html) return [];
      const lang = normalizeWhitespace(attr(html, 'lang') ?? '');
      if (!lang) {
        return [finding(html, 'The <html> element has no lang attribute. Assistive technology cannot pick the correct pronunciation.')];
      }
      if (!/^[a-z]{2,3}(-[a-zA-Z0-9]{2,8})*$/i.test(lang)) {
        return [finding(html, `The lang value "${lang}" is not a valid BCP 47 language tag (for example "en", "en-US", "tr").`)];
      }
      return [];
    },
  },
  {
    id: 'document-title',
    title: 'Page title is missing or empty',
    category: 'document',
    severity: 'error',
    wcag: ['2.4.2'],
    level: 'A',
    tags: ['static', 'document'],
    description:
      'Every page needs a unique, descriptive <title>. It is the first thing a screen reader announces and the label used in the tab list.',
    help: 'Add a <title> that names the page and the site, for example "Checkout - Example Store".',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html',
    srImpact:
      'Screen readers announce the title when a page loads and when switching browser tabs. An empty title is announced as "untitled" or as the raw URL.',
    check(ctx) {
      if (isFragment(ctx)) return [];
      const title = findAll(ctx.doc, (el) => tagName(el) === 'title')[0];
      const value = title ? textContent(title) : '';
      if (!value) return [finding(title ?? ctx.doc, 'The document has no non-empty <title>.')];
      if (/^(untitled|document|page|new page)$/i.test(value)) {
        return [finding(title, `The title "${value}" does not describe this page.`)];
      }
      return [];
    },
  },
  {
    id: 'meta-viewport-zoom',
    title: 'Zoom is disabled in the viewport meta tag',
    category: 'document',
    severity: 'error',
    wcag: ['1.4.4'],
    level: 'AA',
    tags: ['static', 'document'],
    description:
      'user-scalable=no or a maximum-scale below 2 prevents low-vision users from zooming the page.',
    help: 'Remove user-scalable=no and allow at least maximum-scale=5 (or omit maximum-scale).',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html',
    srImpact:
      'Screen magnifier users and low-vision screen reader users cannot enlarge text. Zoom is often the only way to read a page with a screen reader and magnification together.',
    check(ctx) {
      return findAll(ctx.doc, (el) => tagName(el) === 'meta' && (attr(el, 'name') || '').toLowerCase() === 'viewport')
        .map((meta) => {
          const content = (attr(meta, 'content') || '').toLowerCase();
          if (/user-scalable\s*=\s*(no|0)/.test(content)) {
            return finding(meta, 'The viewport meta tag disables pinch zoom with user-scalable=no.');
          }
          const max = content.match(/maximum-scale\s*=\s*([\d.]+)/);
          if (max && Number.parseFloat(max[1]) < 2) {
            return finding(meta, `The viewport limits zoom to maximum-scale=${max[1]}; WCAG 1.4.4 needs at least 200% zoom.`);
          }
          return null;
        })
        .filter(Boolean);
    },
  },
  {
    id: 'duplicate-id',
    title: 'Duplicate id attribute',
    category: 'document',
    severity: 'warning',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'document'],
    description:
      'ids must be unique. Duplicate ids break aria-labelledby, aria-describedby, label[for] and in-page links.',
    help: 'Give every element a unique id, or use aria-labelledby with a unique id.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact:
      'A screen reader may announce the wrong label, skip a control, or read the first matching element instead of the intended one.',
    check(ctx) {
      return ctx.duplicates.map((entry) =>
        finding(entry.node, `The id "${entry.id}" is used more than once on this page.`),
      );
    },
  },
  {
    id: 'tabindex-positive',
    title: 'Positive tabindex changes the focus order',
    category: 'document',
    severity: 'warning',
    wcag: ['2.4.3'],
    level: 'A',
    tags: ['static', 'document'],
    description:
      'tabindex greater than zero removes an element from the natural tab order and puts it first, which almost always creates illogical focus order.',
    help: 'Use tabindex="0" to make an element focusable and place it in DOM order. Reorder the DOM instead of using positive values.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html',
    srImpact:
      'Keyboard and screen reader users jump around the page in an order that does not match the visual layout, losing context.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        const value = Number.parseInt(attr(el, 'tabindex') ?? '', 10);
        return Number.isFinite(value) && value > 0;
      }).map((el) => finding(el, `tabindex="${attr(el, 'tabindex')}" puts this element ahead of the natural focus order.`));
    },
  },
  {
    id: 'skip-link',
    title: 'No skip link to the main content',
    category: 'document',
    severity: 'warning',
    wcag: ['2.4.1'],
    level: 'A',
    tags: ['static', 'document'],
    description:
      'A skip link lets keyboard and screen reader users jump past repeated navigation. It should be the first focusable element on the page.',
    help: 'Add a link such as <a class="skip" href="#main">Skip to main content</a> at the start of <body>, and give the main element id="main".',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html',
    srImpact:
      'Screen reader users must listen to every navigation link on every page before reaching the content. On a large menu this can take minutes.',
    manual: [
      'Press Tab once after the page loads. The first focusable element should be the skip link.',
      'Activate it with Enter. Focus should move into the main content, not merely scroll the page.',
    ],
    check(ctx) {
      if (isFragment(ctx)) return [];
      const links = findAll(ctx.doc, (el) => tagName(el) === 'a' && (attr(el, 'href') || '').startsWith('#'));
      const target = (href) => {
        const id = href.slice(1);
        if (!id) return null;
        return ctx.byId.get(id) ?? null;
      };
      const hasSkip = links.some((link) => {
        if (!isVisible(link, ctx)) return false;
        const name = nameOf(link, ctx);
        const href = attr(link, 'href') || '';
        const dest = target(href);
        const pointsAtMain = dest && (tagName(dest) === 'main' || getRole(dest) === 'main');
        return SKIP_TEXT.test(name) || pointsAtMain;
      });
      if (hasSkip) return [];
      return [finding(ctx.doc, 'No skip link was found. Add a same-page link to the main content as the first focusable element.')];
    },
  },
  {
    id: 'landmark-main',
    title: 'No main landmark',
    category: 'document',
    severity: 'warning',
    wcag: ['1.3.1'],
    level: 'A',
    tags: ['static', 'document'],
    description:
      'A <main> element or role="main" lets assistive technology jump straight to the primary content.',
    help: 'Wrap the primary content in <main id="main"> (one per page).',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    srImpact:
      'Screen reader landmark navigation (NVDA D, JAWS R, VoiceOver rotor) has no main region, so users cannot bypass the header and navigation.',
    check(ctx) {
      if (isFragment(ctx)) return [];
      const main = findAll(ctx.doc, (el) => tagName(el) === 'main' || getRole(el) === 'main');
      if (main.length) return [];
      return [finding(ctx.doc, 'The page has no <main> landmark.')];
    },
  },
  {
    id: 'landmark-unique',
    title: 'Multiple landmarks of the same type are unlabeled',
    category: 'document',
    severity: 'info',
    wcag: ['1.3.1'],
    level: 'A',
    tags: ['static', 'document'],
    description:
      'When a page has more than one navigation, complementary, form, region or contentinfo landmark, each one needs a distinct accessible name.',
    help: 'Add aria-label="Primary" / aria-label="Footer" (or aria-labelledby) to each repeated landmark.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    srImpact:
      'Screen readers list landmarks by role and name. Unnamed duplicates are announced identically, so users cannot tell the main navigation from the footer navigation.',
    check(ctx) {
      if (isFragment(ctx)) return [];
      const groups = new Map();
      for (const el of findAll(ctx.doc, (node) => isVisible(node, ctx))) {
        const role = getRole(el);
        if (!['navigation', 'complementary', 'contentinfo', 'form', 'region', 'search', 'banner'].includes(role)) continue;
        if (!groups.has(role)) groups.set(role, []);
        groups.get(role).push(el);
      }
      const results = [];
      for (const [role, elements] of groups) {
        if (elements.length < 2) continue;
        const unnamed = elements.filter((el) => !nameOf(el, ctx));
        for (const el of unnamed.slice(0, 3)) {
          results.push(
            finding(
              el,
              `This ${role} landmark has no accessible name, but the page has ${elements.length} ${role} landmarks.`,
            ),
          );
        }
      }
      return results;
    },
  },
  {
    id: 'heading-order',
    title: 'Heading levels skip a level',
    category: 'document',
    severity: 'warning',
    wcag: ['1.3.1'],
    level: 'A',
    tags: ['static', 'document'],
    description:
      'Headings must form a logical outline. Jumping from h2 to h4 makes the document structure ambiguous.',
    help: 'Use the next heading level (h2 then h3). Style with CSS instead of choosing a heading level for its size.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    srImpact:
      'Screen reader users navigate by heading level (NVDA 2, JAWS 2, VoiceOver rotor). Missing levels make it harder to understand where a section sits in the hierarchy.',
    check(ctx) {
      if (isFragment(ctx)) return [];
      const headings = findAll(ctx.doc, (el) => {
        const level = headingLevel(el);
        return level !== null && isVisible(el, ctx);
      });
      const results = [];
      let previous = null;
      for (const heading of headings) {
        const level = headingLevel(heading);
        if (previous !== null && level > previous + 1) {
          results.push(
            finding(heading, `Heading level jumps from h${previous} to h${level}. Use h${previous + 1} or restructure the outline.`),
          );
        }
        previous = level;
      }
      return results;
    },
  },
  {
    id: 'heading-empty',
    title: 'Heading has no text',
    category: 'document',
    severity: 'error',
    wcag: ['1.3.1', '2.4.6'],
    level: 'A',
    tags: ['static', 'document'],
    description: 'An empty heading is still exposed to assistive technology and creates a dead stop in the outline.',
    help: 'Remove the empty heading or add meaningful text. Decorative headings should not be headings.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html',
    srImpact: 'Screen readers announce "heading level 2" with no name, which sounds like a broken section.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        const level = headingLevel(el);
        return level !== null && isVisible(el, ctx) && !accessibleName(el, ctx).name;
      }).map((el) => finding(el, `The h${headingLevel(el)} heading has no accessible text.`));
    },
  },
  {
    id: 'page-h1',
    title: 'Page has no h1 heading',
    category: 'document',
    severity: 'info',
    wcag: ['1.3.1'],
    level: 'A',
    tags: ['static', 'document'],
    description: 'A single h1 gives the page a clear top-level title in the heading outline.',
    help: 'Add one visible h1 that describes the page. Do not use an h1 just for visual size.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    srImpact: 'Screen reader users who list headings (NVDA Insert+F7) see no top-level entry for the page.',
    check(ctx) {
      if (isFragment(ctx)) return [];
      const h1 = findAll(ctx.doc, (el) => tagName(el) === 'h1' && isVisible(el, ctx));
      if (h1.length) return [];
      return [finding(ctx.doc, 'The page has no visible h1.')];
    },
  },
  {
    id: 'meta-refresh',
    title: 'Page refreshes or redirects automatically',
    category: 'document',
    severity: 'error',
    wcag: ['2.2.1', '3.2.5'],
    level: 'A',
    tags: ['static', 'document'],
    description:
      'A meta refresh moves the user without warning. Users cannot pause, stop or extend the time limit.',
    help: 'Remove the meta refresh. Use a server redirect for permanent moves, or give the user a link and enough time.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html',
    srImpact:
      'A screen reader may be in the middle of announcing the page when it reloads. Focus and reading position are lost.',
    check(ctx) {
      return findAll(
        ctx.doc,
        (el) => tagName(el) === 'meta' && (attr(el, 'http-equiv') || '').toLowerCase() === 'refresh',
      ).map((meta) => {
        const content = attr(meta, 'content') || '';
        const seconds = Number.parseFloat(content);
        return finding(meta, `This page refreshes automatically after ${Number.isFinite(seconds) ? seconds : 'an unknown number of'} second(s).`);
      });
    },
  },
];

export const linkRules = [
  {
    id: 'link-name',
    title: 'Link has no accessible name',
    category: 'navigation',
    severity: 'error',
    wcag: ['4.1.2', '2.4.4'],
    level: 'A',
    tags: ['static', 'navigation'],
    description:
      'Every link needs an accessible name. An image-only link needs alt text, and an icon-only link needs aria-label.',
    help: 'Add text inside the link, alt text on the image, or aria-label on the link. Do not rely on title alone.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html',
    srImpact:
      'Screen readers announce "link" with no name. The elements list shows a blank entry, so the destination cannot be identified.',
    manual: [
      'NVDA: press Insert+F7, open the Links tab and check that every entry has a meaningful name.',
      'VoiceOver: open the rotor (VO+U), choose Links and listen to each label.',
    ],
    check(ctx) {
      return visibleElements(ctx.doc, ctx, (el) => {
        if (isDecorativeLink(el)) return false;
        return (tagName(el) === 'a' && hasAttr(el, 'href')) || getRole(el) === 'link';
      })
        .filter((link) => !accessibleName(link, ctx).name)
        .map((link) => finding(link, 'This link has no accessible name. Screen readers announce only "link".'));
    },
  },
  {
    id: 'link-vague',
    title: 'Link text is not descriptive',
    category: 'navigation',
    severity: 'warning',
    wcag: ['2.4.4'],
    level: 'A',
    tags: ['static', 'navigation'],
    description:
      'Link text such as "click here" or "read more" does not describe the destination when read out of context.',
    help: 'Name the destination: "Read the 2025 accessibility report" instead of "Read more".',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html',
    srImpact:
      'Screen reader users often browse a list of links without surrounding text. Vague entries are indistinguishable from each other.',
    check(ctx) {
      return visibleElements(ctx.doc, ctx, (el) => {
        if (isDecorativeLink(el)) return false;
        return (tagName(el) === 'a' && hasAttr(el, 'href')) || getRole(el) === 'link';
      })
        .map((link) => ({ link, name: accessibleName(link, ctx).name }))
        .filter(({ name }) => name && VAGUE_LINK_TEXT.has(name.toLowerCase().replace(/[.!>»…]+$/g, '').trim()))
        .map(({ link, name }) =>
          finding(link, `The link text "${name}" does not explain where the link goes.`),
        );
    },
  },
  {
    id: 'link-placeholder-href',
    title: 'Link uses a placeholder href',
    category: 'navigation',
    severity: 'info',
    wcag: ['2.1.1'],
    level: 'A',
    tags: ['static', 'navigation'],
    description:
      'href="#" or javascript: links look like links to assistive technology but do not navigate anywhere. They are also a keyboard trap risk when they only handle clicks.',
    help: 'Use a <button> for actions and a real URL for navigation.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    srImpact: 'Screen readers announce a link, the user expects navigation, and nothing happens. The user may think the page is broken.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        if (tagName(el) !== 'a') return false;
        const href = (attr(el, 'href') || '').trim().toLowerCase();
        return href === '#' || href.startsWith('javascript:') || href === 'javascript:void(0)';
      }).map((link) => finding(link, `The link uses "${attr(link, 'href')}" as a placeholder destination.`));
    },
  },
  {
    id: 'link-target-blank',
    title: 'Link opens in a new window without warning',
    category: 'navigation',
    severity: 'info',
    wcag: ['3.2.5'],
    level: 'AAA',
    tags: ['static', 'navigation'],
    description:
      'target="_blank" changes context unexpectedly. Users should be told, and rel="noopener noreferrer" should be set.',
    help: 'Add "(opens in a new tab)" to the link text or aria-label, and rel="noopener noreferrer".',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/change-on-request.html',
    srImpact:
      'The new tab takes focus without an announcement. Screen reader users may not realize a new page opened and lose their place in the old one.',
    check(ctx) {
      return findAll(ctx.doc, (el) => tagName(el) === 'a' && (attr(el, 'target') || '').toLowerCase() === '_blank')
        .map((link) => {
          const rel = (attr(link, 'rel') || '').toLowerCase();
          const name = accessibleName(link, ctx).name;
          const mentions = /new (tab|window)|yeni (sekme|pencere)/i.test(name);
          if (mentions && /noopener|noreferrer/.test(rel)) return null;
          return finding(link, 'This link opens a new tab without warning the user or using rel="noopener noreferrer".');
        })
        .filter(Boolean);
    },
  },
  {
    id: 'anchor-target-missing',
    title: 'In-page link points to a missing target',
    category: 'navigation',
    severity: 'warning',
    wcag: ['2.4.1'],
    level: 'A',
    tags: ['static', 'navigation'],
    description: 'A fragment link whose target id does not exist goes nowhere and can confuse keyboard users.',
    help: 'Update the href or add the missing id to the target element.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html',
    srImpact: 'Activating the link does not move focus or scroll. Screen reader users hear no change and assume the link is broken.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        if (tagName(el) !== 'a') return false;
        const href = (attr(el, 'href') || '').trim();
        if (!href.startsWith('#') || href === '#' || href.startsWith('#!')) return false;
          let id;
          try { id = decodeURIComponent(href.slice(1)); } catch { return true; }
        return !ctx.byId.has(id) && id.toLowerCase() !== 'top';
      }).map((link) => finding(link, `The target "${attr(link, 'href')}" does not exist on this page.`));
    },
  },
  {
    id: 'link-same-text',
    title: 'Different links share the same text',
    category: 'navigation',
    severity: 'info',
    wcag: ['2.4.4'],
    level: 'A',
    tags: ['static', 'navigation'],
    description: 'Links with identical names but different destinations are ambiguous in a links list.',
    help: 'Make each link name unique, for example "Read the pricing guide" and "Read the security guide".',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html',
    srImpact: 'Screen reader users selecting from the links list cannot tell the entries apart.',
    check(ctx) {
      const groups = new Map();
      for (const link of visibleElements(ctx.doc, ctx, (el) => tagName(el) === 'a' && hasAttr(el, 'href'))) {
        const name = accessibleName(link, ctx).name;
        if (!name || name.length < 3) continue;
        const href = attr(link, 'href') || '';
        if (!groups.has(name)) groups.set(name, new Set());
        groups.get(name).add(href);
      }
      const results = [];
      for (const [name, hrefs] of groups) {
        if (hrefs.size < 2) continue;
        const first = findAll(ctx.doc, (el) => tagName(el) === 'a' && accessibleName(el, ctx).name === name)[0];
        results.push(finding(first, `The link text "${name}" is used for ${hrefs.size} different destinations.`));
      }
      return results;
    },
  },
  {
    id: 'nav-label',
    title: 'Multiple navigation landmarks lack labels',
    category: 'navigation',
    severity: 'warning',
    wcag: ['1.3.1'],
    level: 'A',
    tags: ['static', 'navigation'],
    description: 'When a page has more than one <nav>, each needs a distinct accessible name.',
    help: 'Add aria-label="Primary", aria-label="Breadcrumb" or aria-label="Footer" to each nav element.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    srImpact: 'Screen readers list both navigations as "navigation" with no way to choose the right one.',
    check(ctx) {
      const navs = visibleElements(ctx.doc, ctx, (el) => tagName(el) === 'nav' || getRole(el) === 'navigation');
      if (navs.length < 2) return [];
      return navs
        .filter((nav) => !accessibleName(nav, ctx).name)
        .map((nav) => finding(nav, `The page has ${navs.length} navigation landmarks but this one has no aria-label.`));
    },
  },
];

function isDecorativeLink(link) {
  if (attr(link, 'aria-hidden') === 'true') return true;
  if ((attr(link, 'role') || '').toLowerCase() === 'presentation') return true;
  return false;
}

export const structureRules = [
  {
    id: 'list-structure',
    title: 'List contains non-list children',
    category: 'structure',
    severity: 'warning',
    wcag: ['1.3.1'],
    level: 'A',
    tags: ['static', 'structure'],
    description:
      'ul and ol must contain li elements (script and template are allowed). Other children break the list semantics announced by screen readers.',
    help: 'Wrap each item in <li>. If the list is only visual, use CSS layout on divs instead of ul/ol.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    srImpact: 'Screen readers announce "list with 5 items" but the item count does not match what the user hears.',
    check(ctx) {
      return findAll(ctx.doc, (el) => ['ul', 'ol'].includes(tagName(el)) && !hasAttr(el, 'role'))
        .map((list) => {
          const invalid = (list.childNodes ?? []).filter(
            (node) =>
              node.nodeName !== '#text' &&
              node.nodeName !== '#comment' &&
              isElement(node) &&
              !['li', 'script', 'template'].includes(tagName(node)),
          );
          if (!invalid.length) return null;
          return finding(
            invalid[0],
            `This <${tagName(invalid[0])}> is a direct child of <${tagName(list)}>. Only <li> children are valid.`,
          );
        })
        .filter(Boolean);
    },
  },
  {
    id: 'table-headers',
    title: 'Data table has no header cells',
    category: 'structure',
    severity: 'warning',
    wcag: ['1.3.1'],
    level: 'A',
    tags: ['static', 'structure'],
    description:
      'A data table needs th cells (or role="columnheader"/"rowheader") so each cell can be associated with its headers.',
    help: 'Add <th scope="col"> for column headers and <th scope="row"> for row headers.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    srImpact:
      'Screen readers announce cell values without the column or row name. A user hearing "42" does not know whether it is price, quantity or stock.',
    manual: [
      'NVDA: focus a cell and press Ctrl+Alt+Arrow keys. NVDA should announce the row and column headers.',
      'VoiceOver: open the rotor, choose Tables, then move by row and column and listen for header announcements.',
    ],
    check(ctx) {
      const results = [];
      for (const table of findAll(ctx.doc, (el) => tagName(el) === 'table' && !isDecorativeTable(el))) {
        const rows = findAll(table, (el) => tagName(el) === 'tr');
        if (rows.length < 2) continue;
        const headers = findAll(table, (el) => tagName(el) === 'th' || ['columnheader', 'rowheader'].includes(getRole(el)));
        if (headers.length) continue;
        const cells = findAll(table, (el) => ['td', 'th'].includes(tagName(el)));
        if (cells.length < 4) continue;
        results.push(finding(table, `This table has ${rows.length} rows and ${cells.length} cells but no header cells.`));
      }
      return results;
    },
  },
  {
    id: 'table-caption',
    title: 'Table has no caption or accessible name',
    category: 'structure',
    severity: 'info',
    wcag: ['1.3.1'],
    level: 'A',
    tags: ['static', 'structure'],
    description: 'A caption tells screen reader users what the table is about before they enter it.',
    help: 'Add <caption> or aria-label to the table.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    srImpact: 'The table is announced as "table" with no name, so its purpose is unclear in the tables list.',
    check(ctx) {
      return findAll(ctx.doc, (el) => tagName(el) === 'table' && !isDecorativeTable(el))
        .filter((table) => findAll(table, (el) => tagName(el) === 'tr').length >= 2)
        .filter((table) => !accessibleName(table, ctx).name)
        .map((table) => finding(table, 'This data table has no <caption> and no accessible name.'));
    },
  },
  {
    id: 'th-scope',
    title: 'Header cell has no scope',
    category: 'structure',
    severity: 'info',
    wcag: ['1.3.1'],
    level: 'A',
    tags: ['static', 'structure'],
    description: 'scope tells assistive technology whether a th applies to its column or its row.',
    help: 'Add scope="col" or scope="row" to each th.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    srImpact: 'Complex tables may associate a cell with the wrong header.',
    check(ctx) {
      const results = [];
      for (const table of findAll(ctx.doc, (el) => tagName(el) === 'table' && !isDecorativeTable(el))) {
        const rows = findAll(table, (el) => tagName(el) === 'tr');
        if (rows.length < 2) continue;
        const headers = findAll(table, (el) => tagName(el) === 'th');
        const hasBoth = headers.some((th) => ['col', 'column'].includes((attr(th, 'scope') || '').toLowerCase())) &&
          headers.some((th) => ['row', 'rowgroup'].includes((attr(th, 'scope') || '').toLowerCase()));
        if (hasBoth) continue;
        for (const th of headers) {
          if (!attr(th, 'scope') && !attr(th, 'id') && rows.length > 1) {
            results.push(finding(th, 'This header cell has no scope attribute. Add scope="col" or scope="row".'));
          }
        }
      }
      return results.slice(0, 10);
    },
  },
  {
    id: 'th-empty',
    title: 'Header cell is empty',
    category: 'structure',
    severity: 'warning',
    wcag: ['1.3.1'],
    level: 'A',
    tags: ['static', 'structure'],
    description: 'An empty header cell gives nearby data cells no usable label.',
    help: 'Add header text, or use a td with aria-hidden="true" if the cell is purely decorative.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    srImpact: 'Cells in that column are announced without a column name.',
    check(ctx) {
      return findAll(ctx.doc, (el) => tagName(el) === 'th' && isVisible(el, ctx) && !textContent(el) && !accessibleName(el, ctx).name)
        .map((th) => finding(th, 'This <th> is empty, so its column or row has no announced header.'));
    },
  },
];

function isDecorativeTable(table) {
  const role = (attr(table, 'role') || '').toLowerCase();
  return role === 'presentation' || role === 'none' || attr(table, 'aria-hidden') === 'true';
}

export const semanticsRules = [...documentRules, ...linkRules, ...structureRules];
