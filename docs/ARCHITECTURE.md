# Architecture

## Goals and non-goals

A11yLens is a local, zero-service CLI. It must:

- run on Windows, macOS and Linux from the same codebase;
- produce useful results without a browser (static and component scan);
- use a real Chromium browser when available, without downloading one;
- explain findings in terms of screen reader output, not only WCAG numbers;
- finish in seconds for a normal site and stay predictable in CI.

It is not a crawler for the whole internet, a hosted dashboard, or a conformance certificate.

## Pipeline

```text
CLI (src/cli.js)
  │  parse flags, load .a11ylensrc.json, resolve target
  ▼
discoverFiles (src/scan/walker.js)
  │  HTML, component source, CSS; ignores node_modules, build caches, symlinks, binary files
  ▼
scanStatic (src/scan/engine.js)
  │  for each HTML file:
  │    parse5 → document + source locations
  │    buildContext → id index, duplicate ids, label[for] index
  │    load linked CSS and <style> → parseCss
  │    createStyleResolver → cascade approximation
  │    run every static rule with one context object
  │  for each component file:
  │    Babel JSX/TypeScript parser or Vue/Svelte/Astro template scanner
  │    run every source rule
  ▼
optional runDynamicScan (src/render/dynamic.js)
  │  serve local site (or use --url)
  │  launch Chrome with a temporary profile and a random DevTools port
  │  connect to the page target with a minimal CDP client (native WebSocket)
  │  per page:
  │    Page.navigate + load event + readyState wait
  │    axe-core injection and run
  │    Accessibility.getFullAXTree → roles, names, outline
  │    Tab walk with Input.dispatchKeyEvent
  │    computed order / reversed flex detection
  │  crawl same-origin links up to --crawl / --depth
  ▼
mergeDynamic → dedupe by rule + file + line + selector + message
  ▼
baseline filter → summary / score → output-only finding limit
  ▼
report: pretty | JSON | SARIF | HTML | Markdown
```

## Finding model

```js
{
  id,            // stable fingerprint: sha1(ruleId|file|selector or snippet)
  ruleId,        // static rule id, src-*, ax-*, render-*, axe/<axe-id>
  title, severity, message,
  file, line, column, selector, snippet,
  wcag: ['1.1.1'], level: 'A',
  description, help, helpUrl,
  srImpact,      // what NVDA/JAWS/VoiceOver/TalkBack announce
  manual,        // optional finding-specific test steps
  engine,        // static | source | render | axe
  data           // rule-specific structured evidence
}
```

Static findings get source line and column from parse5. CSS-only findings point at the stylesheet and rule line. Rendered findings have `line: 0` and a URL or a page path plus a CSS selector, because the rendered DOM is not the source file.

Severity is assigned by the rule, with three deliberate levels:

- **error** — a clear failure with a direct user impact (missing name, hidden focusable content, contrast below AA).
- **warning** — very likely a failure, but context can change the result (static contrast, inline click handlers).
- **info** — best practice or something a human must confirm (duplicate link text, CSS order, autocomplete).

## Accessible name computation

`accessibleName()` follows the practical subset of the AccName algorithm:

1. `aria-labelledby` (recursive, cycle-safe, space-separated ids);
2. non-empty `aria-label` (empty values fall back to native labels or content);
3. native host-language labels:
   - `img`/`area`: `alt`;
   - `input`: `value` for buttons, `alt` for image buttons;
   - `fieldset`: first `legend`;
   - `table`: first `caption`;
   - `svg`: first `title`;
   - `label[for]` and wrapping `<label>`;
   - `iframe`: `title`;
4. name from content, only for roles that allow it (button, link, heading, option, tab, menuitem, treeitem, checkbox/radio, cells, and a few more); this is why a `<nav>` full of links is still unnamed;
5. `title`, then `placeholder` as weak fallbacks, flagged separately.

The role mapping covers native HTML elements, including context-sensitive cases: `header`/`footer` inside `article`/`section`/`main` are not landmarks, `section` only becomes a region when named, `select` is a combobox unless multiple/size, `th` scope selects row/column header.

## CSS approximation

The static cascade is intentionally small:

- parses rules, comments, `@media` (skips `prefers-reduced-motion` and print), `@supports`, `@font-face`, `@keyframes`;
- matches compound selectors with tag, id, class, attribute operators and `:not()`;
- supports descendant, child, adjacent and general sibling combinators;
- ignores selectors that depend on runtime state (`:hover`, `:focus-visible`, `:nth-child` beyond first/last, `:is()`, `:where()`);
- applies specificity, order and `!important`;
- resolves `var(--x)` from `:root`/`html` declarations only;
- inherits `color`, `font-size`, `font-weight` and `visibility`; resolves the nearest opaque background;
- computes WCAG contrast with alpha blending.

This is enough for warning-level checks. It will miss gradients, background images, JS-set custom properties, container queries and styles injected at runtime. The rendered scan covers those.

## Why the accessibility tree

The DOM is not what a screen reader sees. Browsers compute an accessibility tree with roles, names, states, ignored nodes and reading order. Chrome exposes it through `Accessibility.getFullAXTree`, which gives A11yLens:

- the computed name Chromium exposes to assistive technology; actual speech depends on the screen reader and its settings;
- roles that differ from the markup (for example an invalid role falling back to generic);
- nodes that are ignored because of `aria-hidden` or CSS;
- heading levels and landmarks in rendered order;
- focusable state.

This is why the rendered scan can report "the rendered progressbar has no accessible name" even when the source looks plausible.

The runtime node is not automatically mapped to a framework component or source map. Source findings and rendered findings remain separate and may describe the same barrier. See [known review risks](LIMITATIONS.md) for false-positive scenarios and verification steps.

## Keyboard walk

For each rendered page:

1. blur the active element, scroll to top;
2. count visible tabbable elements;
3. press Tab (CDP `Input.dispatchKeyEvent`) and read `document.activeElement` after each press;
4. record selector, text, computed outline and shadow, `elementFromPoint` result at the element centre, and viewport visibility;
5. stop after a full cycle (repeat after at least three unique elements) or 60 presses.

Findings:

- `render-focus-visible` — no outline and no box-shadow while focused;
- `render-focus-obscured` — the centre point is covered by another element;
- `render-focus-trap` — fewer than three unique elements after 60 presses on a page with at least three tabbable elements.

Limitations: the browser's default focus ring is visible even when computed styles look empty in some engines; focus inside iframes and shadow DOM is not fully walked; a page with fewer than three tabbable elements cannot produce a trap finding.

## Browser launch

`findBrowser()` checks, in order: `--browser`, `A11YLENS_BROWSER`, `CHROME_PATH`, `PUPPETEER_EXECUTABLE_PATH`, platform-specific install paths, then `PATH` on Linux.

Chrome is launched with:

```text
--headless=new
--remote-debugging-address=127.0.0.1
--remote-debugging-port=0
--user-data-dir=<temp>
--no-first-run --no-default-browser-check --disable-extensions --disable-sync
--window-size=1440,1000
```

The real port is read from `DevToolsActivePort`. On Windows the initial launcher process exits immediately after handing off to the browser process; the code therefore polls the file and the HTTP endpoint instead of trusting the child exit code. Shutdown uses the browser-level `Browser.close` CDP command, then removes the temporary profile. No browser is ever downloaded.

## Crawl

The queue starts at `/` (local server), a single-file entry, or `--url`. Links are filtered to the same origin, HTTP(S), no download extensions, no obvious logout/delete routes. Breadth-first up to `--crawl` pages and `--depth` link levels. Each page is fully analysed before its links are queued.

Only the initial state of each page is tested. The browser does not click menus, open modals or walk multi-step forms; those states need a URL that loads them directly, or manual testing.

## Performance

- static scan: cost grows with file count, HTML size, stylesheet rules and selector matching;
- rendered scan: time depends on page loading, axe-core and the Tab walk; a page may take seconds or reach the configured timeout;
- Linked external stylesheets are cached across pages; component syntax is parsed once per file for its source rules.

Use `--crawl` and `--depth` deliberately in CI.

## Error handling

- A rule that throws is recorded in `report.errors` with the rule id and file; the scan continues.
- A page that fails to render is recorded and the crawl continues.
- A browser failure can leave a partial static report, but the exit code is 2 so an incomplete requested audit cannot pass CI.
- Any recorded rule or page failure makes the command return exit code 2. Baselines cannot be updated from incomplete audits.
- Config and input errors return exit code 2.

## Extending

1. Add the rule object to a category file in `src/rules/`.
2. Give it a stable `id`, severity, WCAG mapping, `description`, `srImpact`, `help`, `helpUrl`.
3. Implement `check(ctx)` for HTML/CSS or `checkSource(ctx)` for component files.
4. Export it from the category array; `src/rules/index.js` assembles the registry.
5. Add a fixture case under `examples/broken-site` and an assertion in `test/scan.test.js`.
6. Run `npm run docs:rules` to update the reference.

For rendered-only rules, add the metadata to `src/rules/render.js` and emit the finding from `src/render/dynamic.js`.
