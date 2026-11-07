import path from 'node:path';
import { CDP, fetchJson } from './cdp.js';
import { launchBrowser, sleep } from './browser.js';
import { findSiteRoot, serveDirectory } from './serve.js';
import { loadAxe } from './axe.js';
import { fingerprint } from '../scan/engine.js';
import { RULE_BY_ID } from '../rules/index.js';
import { normalizeWhitespace, toPosix, truncate } from '../util.js';

const AX_NAME_ROLES = new Set([
  'option', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'treeitem', 'switch',
  'slider', 'spinbutton', 'searchbox', 'listbox', 'meter', 'progressbar',
]);

const TABBABLE_ROLES = new Set([
  'button', 'checkbox', 'combobox', 'link', 'radio', 'searchbox', 'slider', 'spinbutton',
  'switch', 'tab', 'textbox',
]);

const LANDMARK_ROLES = new Set(['banner', 'complementary', 'contentinfo', 'form', 'main', 'navigation', 'region', 'search']);

const AXE_SR_IMPACT = {
  'image-alt': 'The image is announced as "graphic" or by its file name, so its meaning is lost.',
  'input-image-alt': 'The image button is announced without a purpose.',
  'area-alt': 'The image map area is announced as an unnamed link.',
  'link-name': 'The link is announced with no name, so the destination is unknown.',
  'button-name': 'The button is announced with no name; voice control users cannot target it.',
  'label': 'The form field is announced without a label, so the user cannot tell what to enter.',
  'select-name': 'The select control has no accessible name.',
  'color-contrast': 'Low-vision users cannot read the text against its background.',
  'html-has-lang': 'The screen reader may use the wrong voice and braille table.',
  'html-lang-valid': 'The screen reader may switch to the wrong language.',
  'document-title': 'The page is announced without a meaningful title.',
  'frame-title': 'The iframe is announced as an unnamed frame.',
  'heading-order': 'The heading outline has gaps, making navigation by level confusing.',
  'empty-heading': 'The screen reader announces a heading level with no text.',
  'landmark-one-main': 'Landmark navigation has no main region.',
  'landmark-unique': 'Landmarks with the same role and no name cannot be told apart.',
  'region': 'Content outside landmarks is harder to reach with landmark navigation.',
  'aria-hidden-focus': 'Keyboard focus can land on content that the screen reader does not announce.',
  'aria-required-attr': 'The widget role is announced without its required state.',
  'aria-valid-attr-value': 'The state is invalid and may be ignored by the screen reader.',
  'aria-allowed-attr': 'The state is not announced because it is not valid for this role.',
  'aria-roles': 'The intended role is ignored, so the element is announced as something else.',
  'duplicate-id': 'Labelled-by and described-by references may resolve to the wrong element.',
  'tabindex': 'Focus order no longer matches the reading order.',
  'list': 'The list is not announced as a list, or its item count is wrong.',
  'listitem': 'List items are not announced as items of the list.',
  'table-fake-caption': 'The table caption is not associated with the table.',
  'td-headers-attr': 'Data cells may be announced with the wrong headers.',
  'th-has-data-cells': 'Header cells are not associated with data cells.',
  'video-caption': 'Deaf users get no captions.',
  'audio-caption': 'Deaf users get no transcript or captions.',
  'meta-viewport': 'Low-vision users cannot zoom the page.',
  'target-size': 'Users with motor impairments cannot reliably hit the target.',
  'scrollable-region-focusable': 'Keyboard users cannot scroll the region.',
  'bypass': 'Keyboard users must tab through repeated navigation on every page.',
  'skip-link': 'Keyboard users cannot bypass repeated blocks.',
  'focus-order-semantics': 'The focused element is not announced with a meaningful role.',
};

export async function runDynamicScan(options) {
  const { root, config } = options;
  const started = Date.now();
  const browser = await launchBrowser({ executablePath: config.browser, headless: config.headless, sandbox: config.sandbox });
  let server = null;
  let cdp = null;
  const errors = [];
  try {
    let startUrl = config.url;
    const local = !startUrl;
    let siteRoot = root;
    if (!startUrl) {
      siteRoot = config.entry ? root : await findSiteRoot(root);
      server = await serveDirectory(siteRoot, { port: config.servePort ?? 0, spa: config.spa });
      startUrl = new URL(config.entry ?? '/', server.url).href;
    }
    const targets = await fetchJson(`http://127.0.0.1:${browser.port}/json/list`);
    const pageTarget = targets.find((target) => target.type === 'page');
    if (!pageTarget?.webSocketDebuggerUrl) throw new Error('Chrome did not expose a page target.');
    cdp = new CDP(pageTarget.webSocketDebuggerUrl, { timeout: config.timeout });
    await cdp.connect();
    await enableDomains(cdp);
    if (config.headless === false) await cdp.send('Page.bringToFront').catch(() => {});

    const axePackage = config.axe === false ? null : loadAxe();
    const axeVersion = axePackage?.version ?? null;
    const maxPages = Math.max(1, config.crawl ?? 5);
    const maxDepth = Math.max(0, config.maxDepth ?? 2);
    const queue = [{ url: startUrl, depth: 0 }];
    const queued = new Set([normalizeUrl(startUrl)]);
    const seen = new Set();
    const pages = [];
    const findings = [];
    let checks = 0;

    while (queue.length && pages.length < maxPages) {
      const item = queue.shift();
      const normalized = normalizeUrl(item.url);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      let result;
      try {
        result = await visitPage(cdp, {
          url: item.url,
          local,
          siteRoot,
          projectRoot: root,
          config,
          axeSource: axePackage?.source ?? null,
          axeVersion,
        });
      } catch (error) {
        errors.push({ file: item.url, message: `Rendered scan failed for ${item.url}: ${error.message}` });
        continue;
      }
      pages.push(result.page);
      findings.push(...result.findings);
      checks += result.checks;
      if (item.depth < maxDepth) {
        for (const link of result.links) {
          if (seen.size + queue.length >= maxPages) break;
          const linkKey = normalizeUrl(link);
          if (!linkKey || queued.has(linkKey)) continue;
          queued.add(linkKey);
          queue.push({ url: link, depth: item.depth + 1 });
        }
      }
    }

    return {
      findings,
      pages,
      checks,
      errors,
      info: {
        enabled: true,
        browser: browser.label,
        browserPath: browser.executablePath,
        axeVersion,
        axeEnabled: Boolean(axePackage),
        pageCount: pages.length,
        urls: pages.map((page) => page.url),
        local,
        served: local ? server?.url ?? null : null,
        entry: config.entry ?? '/',
        durationMs: Date.now() - started,
      },
      rulesExecuted: [
        ...(axePackage ? ['axe'] : []),
        'ax-empty-name', 'ax-focusable-generic', 'ax-not-tabbable',
        'render-focus-visible', 'render-focus-obscured', 'render-focus-trap',
        'render-order', 'render-reverse-order', 'render-no-live-region',
      ],
    };
  } finally {
    cdp?.close();
    await browser.close().catch(() => {});
    if (server) await server.close().catch(() => {});
  }
}

async function enableDomains(cdp) {
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Accessibility.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-motion', value: 'no-preference' },
      { name: 'prefers-color-scheme', value: 'light' },
    ],
  });
  await cdp.send('Page.setLifecycleEventsEnabled', { enabled: true }).catch(() => {});
}

async function visitPage(cdp, { url, local, siteRoot, projectRoot, config, axeSource, axeVersion }) {
  const documentResponses = new Map();
  const offResponse = cdp.on('Network.responseReceived', (event) => {
    if (event.type === 'Document') documentResponses.set(event.frameId, event.response);
  });
  try {
    const load = cdp.once('Page.loadEventFired', config.timeout).catch(() => null);
    const navigation = await cdp.send('Page.navigate', { url });
    if (navigation.errorText) throw new Error(navigation.errorText);
    await load;
    const documentResponse = documentResponses.get(navigation.frameId);
    if (documentResponse?.status >= 400) {
      throw new Error(`HTTP ${documentResponse.status} for ${documentResponse.url}`);
    }
  } finally {
    offResponse();
  }
  await waitForReady(cdp, config.timeout);
  await evaluate(cdp, 'document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true', 10000).catch(() => {});
  await sleep(config.wait ?? 600);

  const info = await evaluate(
    cdp,
    `(() => ({
      url: location.href,
      title: document.title || '',
      lang: document.documentElement ? (document.documentElement.lang || '') : '',
      links: Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(Boolean).slice(0, 200),
      liveRegions: document.querySelectorAll('[aria-live]:not([aria-live="off"]), [role="alert"], [role="status"], [role="log"]').length,
      forms: document.querySelectorAll('form').length,
      scripts: document.scripts.length
    }))()`,
  );

  const pageUrl = info.url || url;
  if (!/^https?:/i.test(pageUrl)) {
    throw new Error(`The browser did not load an HTTP page (it landed on ${pageUrl || 'an error page'}).`);
  }
  const pageFile = local
    ? toPosix(path.relative(projectRoot, path.join(siteRoot, fileForUrl(pageUrl)))) || fileForUrl(pageUrl)
    : pageUrl;
  const findings = [];
  let checks = 0;
  let axeViolationCount = 0;

  const ax = await analyzeAccessibilityTree(cdp, pageUrl);
  checks += 3;
  findings.push(
    ...ax.findings.map((finding) => {
      const moved = { ...finding, file: pageFile };
      moved.id = fingerprint(moved);
      return moved;
    }),
  );

  if (axeSource) {
    const axe = await runAxe(cdp, axeSource, config);
    checks += 1;
    findings.push(
      ...axe.findings.map((finding) => {
        const moved = { ...finding, file: pageFile };
        moved.id = fingerprint(moved);
        return moved;
      }),
    );
    axeViolationCount = axe.violationCount;
  }

  const focus = await walkFocus(cdp, pageFile);
  checks += 1;
  findings.push(...focus.findings);

  const order = await detectBrokenOrder(cdp, pageFile);
  checks += 1;
  findings.push(...order.findings);
  checks += 1;
  if (info.forms > 0 && info.scripts > 0 && info.liveRegions === 0) {
    findings.push(renderFinding('render-no-live-region', {
      message: 'This rendered page has forms and scripts but no live region for dynamic status or validation messages. Verify how updates are announced.',
      file: pageFile,
      selector: 'form',
    }));
  }

  const headings = ax.outline.filter((entry) => entry.role === 'heading').map((entry) => ({
    level: entry.level ?? 2,
    text: entry.text,
    line: 0,
    hidden: false,
  }));
  const landmarks = ax.outline.filter((entry) => LANDMARK_ROLES.has(entry.role)).map((entry) => ({
    role: entry.role,
    name: entry.text,
    line: 0,
  }));

  return {
    page: {
      file: pageFile,
      url: pageUrl,
      title: info.title,
      lang: info.lang,
      headings,
      landmarks,
      outline: ax.outline,
      counts: {
        ...ax.counts,
        liveRegions: info.liveRegions,
        ariaLive: info.liveRegions,
        forms: info.forms,
      },
      axeViolations: axeViolationCount ?? 0,
    },
    findings,
    links: (info.links ?? []).filter((link) => isCrawlable(link, pageUrl)),
    checks,
    axeVersion,
  };
}

async function runAxe(cdp, axeSource, config) {
  await evaluate(cdp, axeSource, 30000);
  const options = {
    runOnly: { type: 'tag', values: config.axeTags ?? ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    resultTypes: ['violations'],
    reporter: 'v2',
    rules: Object.fromEntries((config.ignoreAxe ?? []).map((id) => [id, { enabled: false }])),
  };
  const raw = await evaluate(
    cdp,
    `(async () => {
      const results = await Promise.race([
        axe.run(document, ${JSON.stringify(options)}),
        new Promise((_, reject) => setTimeout(() => reject(new Error('axe.run timed out after 45s')), 45000))
      ]);
      return JSON.stringify({
        violations: results.violations.map(v => ({
          id: v.id, impact: v.impact, help: v.help, description: v.description,
          helpUrl: v.helpUrl, tags: v.tags,
          nodes: v.nodes.map(n => ({
            target: n.target, html: n.html, failureSummary: n.failureSummary
          }))
        })),
        testEngine: results.testEngine
      });
    })()`,
    60000,
  );
  const parsed = JSON.parse(raw);
  const findings = [];
  for (const violation of parsed.violations) {
    const wcag = wcagFromTags(violation.tags);
    const level = levelFromTags(violation.tags);
    const impact = violation.impact ?? 'minor';
    const severity = impact === 'critical' || impact === 'serious' ? 'error' : impact === 'moderate' ? 'warning' : 'info';
    for (const first of violation.nodes) {
      const selector = Array.isArray(first.target) ? first.target.join(' ') : String(first.target ?? '');
      findings.push(
        buildFinding('axe', {
          ruleId: `axe/${violation.id}`,
          title: violation.help,
          severity,
          message: violation.help,
          file: '',
          line: 0,
          column: 1,
          selector,
          snippet: truncate(String(first.html ?? '').replace(/\s+/g, ' '), 220),
          wcag,
          level,
          description: violation.description,
          help: first.failureSummary ?? violation.description,
          helpUrl: violation.helpUrl,
          srImpact: AXE_SR_IMPACT[violation.id] ?? 'Screen reader users may not perceive or operate this content as intended.',
          engine: 'axe',
          data: {
            axeImpact: impact,
            tags: violation.tags,
            failureSummary: first.failureSummary ?? null,
            nodeCount: 1,
          },
        }),
      );
    }
  }
  return { findings, violationCount: parsed.violations.length };
}

function wcagFromTags(tags) {
  const result = [];
  for (const tag of tags ?? []) {
    const match = /^wcag(\d)(\d)(\d+)$/.exec(tag);
    if (match) {
      const value = `${match[1]}.${match[2]}.${match[3]}`;
      if (!result.includes(value)) result.push(value);
    }
  }
  return result.sort();
}

function levelFromTags(tags) {
  if ((tags ?? []).some((tag) => /^wcag\d*aaa$/.test(tag))) return 'AAA';
  if ((tags ?? []).some((tag) => /^wcag\d*aa$/.test(tag))) return 'AA';
  if ((tags ?? []).some((tag) => /^wcag\d*a$/.test(tag))) return 'A';
  return 'Best practice';
}

async function analyzeAccessibilityTree(cdp, pageUrl) {
  const tree = await cdp.send('Accessibility.getFullAXTree', {}, 30000);
  const nodes = tree.nodes ?? [];
  const outline = [];
  const issues = [];
  const counts = { focusable: 0, headings: 0, landmarks: 0, links: 0, buttons: 0, images: 0, liveRegions: 0 };
  for (const node of nodes) {
    if (node.ignored) continue;
    const role = node.role?.value ?? '';
    const name = normalizeWhitespace(node.name?.value ?? '');
    const properties = {};
    for (const property of node.properties ?? []) properties[property.name] = property.value?.value;
    if (properties.focusable === true) counts.focusable += 1;
    if (role === 'heading') {
      counts.headings += 1;
      outline.push({ role, level: Number(properties.level) || 2, text: name, nodeId: node.nodeId });
    }
    if (LANDMARK_ROLES.has(role)) {
      counts.landmarks += 1;
      outline.push({ role, text: name, nodeId: node.nodeId });
    }
    if (role === 'link') counts.links += 1;
    if (role === 'button') counts.buttons += 1;
    if (role === 'image' || role === 'img') counts.images += 1;
    if (['alert', 'status', 'log'].includes(role)) counts.liveRegions += 1;

    if (AX_NAME_ROLES.has(role) && !name) {
      issues.push({ ruleId: 'ax-empty-name', node, message: `The rendered ${role} has no accessible name.`, data: { role } });
    }
    if (role === 'generic' && properties.focusable === true && !name) {
      issues.push({
        ruleId: 'ax-focusable-generic',
        node,
        message: 'This element is focusable but the accessibility tree exposes it as generic with no name.',
        data: { role },
      });
    }
    if (TABBABLE_ROLES.has(role) && properties.focusable === false && properties.disabled !== true) {
      issues.push({
        ruleId: 'ax-not-tabbable',
        node,
        message: `The rendered ${role} is exposed to screen readers but not focusable with Tab.`,
        data: { role },
      });
    }
  }

  const findings = [];
  const described = new Map();
  for (const issue of issues) {
    let info = null;
    if (issue.node.backendDOMNodeId) {
      if (!described.has(issue.node.backendDOMNodeId)) {
        described.set(issue.node.backendDOMNodeId, await describeBackendNode(cdp, issue.node.backendDOMNodeId));
      }
      info = described.get(issue.node.backendDOMNodeId);
    }
    if (!info) {
      info = { selector: '', html: '', text: '' };
    }
    findings.push(
      renderFinding(issue.ruleId, {
        message: issue.message,
        file: pageUrl,
        selector: info.selector,
        snippet: truncate(String(info.html ?? '').replace(/\s+/g, ' '), 220),
        data: issue.data,
      }),
    );
  }

  return { findings, outline: outline.slice(0, 200), counts };
}

async function describeBackendNode(cdp, backendNodeId) {
  try {
    const resolved = await cdp.send('DOM.resolveNode', { backendNodeId });
    const objectId = resolved.object?.objectId;
    if (!objectId) return null;
    const result = await cdp.send('Runtime.callFunctionOn', {
      objectId,
      functionDeclaration: `function () {
        if (!this || this.nodeType !== 1) return null;
        const el = this;
        const parts = [];
        let current = el;
        let guard = 0;
        while (current && current.nodeType === 1 && guard < 8) {
          let part = current.tagName.toLowerCase();
          if (current.id) {
            part += '#' + current.id;
            parts.unshift(part);
            break;
          }
          const classes = Array.from(current.classList || []).slice(0, 2);
          part += classes.map(c => '.' + c).join('');
          const parent = current.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter(child => child.tagName === current.tagName);
            if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
          }
          parts.unshift(part);
          current = current.parentElement;
          guard += 1;
        }
        return {
          selector: parts.join(' > ').slice(-320),
          html: el.outerHTML ? el.outerHTML.slice(0, 400) : '',
          text: (el.innerText || '').trim().slice(0, 120)
        };
      }`,
      returnByValue: true,
    });
    await cdp.send('Runtime.releaseObject', { objectId }).catch(() => {});
    return result.result?.value ?? null;
  } catch {
    return null;
  }
}

async function walkFocus(cdp, pageFile) {
  const findings = [];
  await cdp.send('Page.bringToFront').catch(() => {});
  await evaluate(cdp, 'try { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); } catch (e) {} true').catch(() => {});
  const tabbableCount = await evaluate(
    cdp,
    `Array.from(document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden').length`,
  ).catch(() => 0);
  const steps = [];
  const seen = new Set();
  let leftPage = false;

  for (let index = 0; index < 60; index += 1) {
    await pressTab(cdp);
    await sleep(28);
    let info = null;
    try {
      info = await evaluate(cdp, FOCUS_INFO);
    } catch {
      break;
    }
    if (!info) {
      if (index === 0) continue;
      leftPage = true;
      break;
    }
    if (!seen.has(info.selector)) {
      seen.add(info.selector);
      steps.push(info);
    } else if (seen.size >= 3) {
      break;
    }
  }

  if (!leftPage && seen.size > 0 && seen.size < 3 && tabbableCount >= 3) {
    findings.push(
      renderFinding('render-focus-trap', {
        message: `Only ${seen.size} element(s) responded to repeated Tab presses, but the page has ${tabbableCount} tabbable elements. Keyboard focus may be trapped.`,
        file: pageFile,
        selector: steps[0]?.selector ?? 'body',
        snippet: '',
      }),
    );
  }

  const noIndicator = steps.filter((step) => !step.hasOutline && !step.hasBoxShadow && step.inViewport);
  const obscured = steps.filter((step) => step.obscured && step.inViewport);
  const uniqueNoIndicator = new Map();
  for (const step of noIndicator) if (!uniqueNoIndicator.has(step.selector)) uniqueNoIndicator.set(step.selector, step);
  const uniqueObscured = new Map();
  for (const step of obscured) if (!uniqueObscured.has(step.selector)) uniqueObscured.set(step.selector, step);

  for (const step of [...uniqueNoIndicator.values()].slice(0, 10)) {
    findings.push(
      renderFinding('render-focus-visible', {
        message: `The focused <${step.tag}> has no visible outline or box-shadow.`,
        file: pageFile,
        selector: step.selector,
        snippet: truncate(step.text, 160),
        data: { outlineStyle: step.outlineStyle, outlineWidth: step.outlineWidth, boxShadow: step.boxShadow },
      }),
    );
  }
  for (const step of [...uniqueObscured.values()].slice(0, 8)) {
    findings.push(
      renderFinding('render-focus-obscured', {
        message: `The focused <${step.tag}> is covered at its center by another element.`,
        file: pageFile,
        selector: step.selector,
        snippet: truncate(step.text, 160),
      }),
    );
  }

  return { findings, steps };
}

async function pressTab(cdp) {
  const base = {
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
    nativeVirtualKeyCode: 9,
  };
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

const FOCUS_INFO = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const cs = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const inViewport = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  const cx = Math.min(Math.max(rect.left + rect.width / 2, 1), innerWidth - 1);
  const cy = Math.min(Math.max(rect.top + rect.height / 2, 1), innerHeight - 1);
  const hit = document.elementFromPoint(cx, cy);
  const obscured = Boolean(hit) && hit !== el && !el.contains(hit) && !hit.contains(el);
  const parts = [];
  let current = el;
  let guard = 0;
  while (current && current.nodeType === 1 && guard < 8) {
    let part = current.tagName.toLowerCase();
    if (current.id) { part += '#' + current.id; parts.unshift(part); break; }
    const classes = Array.from(current.classList || []).slice(0, 2);
    part += classes.map(c => '.' + c).join('');
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(child => child.tagName === current.tagName);
      if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
    }
    parts.unshift(part);
    current = current.parentElement;
    guard += 1;
  }
  const outlineWidth = parseFloat(cs.outlineWidth) || 0;
  const hasOutline = cs.outlineStyle !== 'none' && outlineWidth > 0;
  const hasBoxShadow = Boolean(cs.boxShadow) && cs.boxShadow !== 'none';
  return {
    selector: parts.join(' > ').slice(-320),
    tag: el.tagName.toLowerCase(),
    text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 120),
    role: el.getAttribute('role') || '',
    inViewport,
    obscured,
    hasOutline,
    hasBoxShadow,
    outlineStyle: cs.outlineStyle,
    outlineWidth: cs.outlineWidth,
    boxShadow: cs.boxShadow,
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
  };
})()`;

async function detectBrokenOrder(cdp, pageFile) {
  const findings = [];
  let items = [];
  try {
    const raw = await evaluate(
      cdp,
      `JSON.stringify((() => {
        const result = { order: [], reverse: [] };
        const elements = Array.from(document.querySelectorAll('body *')).slice(0, 3000);
        for (const el of elements) {
          if (result.order.length >= 15 && result.reverse.length >= 10) break;
          const cs = getComputedStyle(el);
          const parent = el.parentElement;
          if (!parent) continue;
          const ps = getComputedStyle(parent);
          const isFlex = ps.display.includes('flex') || ps.display.includes('grid');
          if (!isFlex) continue;
          if (cs.order && cs.order !== '0' && result.order.length < 15) {
            result.order.push({ selector: selectorFor(el), order: cs.order });
          }
          if ((ps.flexDirection === 'row-reverse' || ps.flexDirection === 'column-reverse') && result.reverse.length < 10 && (el.innerText || '').trim()) {
            result.reverse.push({ selector: selectorFor(parent), direction: ps.flexDirection });
          }
        }
        function selectorFor(el) {
          const parts = [];
          let current = el;
          let guard = 0;
          while (current && current.nodeType === 1 && guard < 6) {
            let part = current.tagName.toLowerCase();
            if (current.id) { part += '#' + current.id; parts.unshift(part); break; }
            const cls = Array.from(current.classList || []).slice(0, 2);
            part += cls.map(c => '.' + c).join('');
            parts.unshift(part);
            current = current.parentElement;
            guard += 1;
          }
          return parts.join(' > ').slice(-240);
        }
        return result;
      })())`,
    );
    items = JSON.parse(raw);
  } catch {
    return { findings };
  }

  for (const entry of items.order ?? []) {
    findings.push(
      renderFinding('render-order', {
        message: `The rendered element has order: ${entry.order}, so its visual position differs from the DOM order.`,
        file: pageFile,
        selector: entry.selector,
        snippet: '',
      }),
    );
  }
  for (const entry of items.reverse ?? []) {
    findings.push(
      renderFinding('render-reverse-order', {
        message: `The container uses flex-direction: ${entry.direction} with text content, reversing the announced order.`,
        file: pageFile,
        selector: entry.selector,
        snippet: '',
      }),
    );
  }
  return { findings };
}

function renderFinding(ruleId, options) {
  const rule = RULE_BY_ID.get(ruleId);
  if (!rule) throw new Error(`Unknown render rule: ${ruleId}`);
  return buildFinding('render', {
    ruleId,
    title: rule.title,
    severity: rule.severity,
    message: options.message,
    file: options.file,
    line: 0,
    column: 1,
    selector: options.selector ?? '',
    snippet: options.snippet ?? '',
    wcag: rule.wcag,
    level: rule.level,
    description: rule.description,
    help: rule.help,
    helpUrl: rule.helpUrl,
    srImpact: rule.srImpact,
    engine: 'render',
    data: options.data ?? null,
  });
}

function buildFinding(engine, options) {
  const finding = {
    id: '',
    ruleId: options.ruleId,
    title: options.title,
    category: engine === 'axe' ? 'axe' : 'render',
    severity: options.severity,
    message: options.message,
    file: options.file,
    line: options.line ?? 0,
    column: options.column ?? 1,
    selector: options.selector ?? '',
    snippet: options.snippet ?? '',
    wcag: options.wcag ?? [],
    level: options.level ?? '-',
    description: options.description ?? '',
    help: options.help ?? '',
    helpUrl: options.helpUrl ?? '',
    srImpact: options.srImpact ?? '',
    manual: options.manual ?? [],
    engine,
    data: options.data ?? null,
  };
  finding.id = fingerprint(finding);
  return finding;
}

async function evaluate(cdp, expression, timeout = 30000) {
  const result = await cdp.send(
    'Runtime.evaluate',
    {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
      includeCommandLineAPI: false,
    },
    timeout,
  );
  if (result.exceptionDetails) {
    const message =
      result.exceptionDetails.exception?.description ??
      result.exceptionDetails.text ??
      'JavaScript evaluation failed';
    throw new Error(message.split('\n')[0]);
  }
  return result.result?.value;
}

async function waitForReady(cdp, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const state = await evaluate(cdp, 'document.readyState', 5000);
      if (state === 'complete' || state === 'interactive') return;
    } catch {
    }
    await sleep(150);
  }
  throw new Error('The page did not finish loading before the timeout.');
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function isCrawlable(link, baseUrl) {
  let url;
  let base;
  try {
    url = new URL(link, baseUrl);
    base = new URL(baseUrl);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  if (url.origin !== base.origin) return false;
  if (url.href === base.href) return false;
  if (/\.(pdf|zip|rar|7z|tar|gz|mp4|mp3|avi|mov|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname)) return false;
  if (/\/(logout|signout|sign-out|delete|remove)(\/|$)/i.test(url.pathname)) return false;
  return true;
}

function fileForUrl(value) {
  try {
    const url = new URL(value);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    pathname = pathname.replace(/^\/+/, '');
    if (!pathname) return 'index.html';
    if (!path.posix.extname(pathname)) pathname += '.html';
    return pathname;
  } catch {
    return 'index.html';
  }
}
