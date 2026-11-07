# A11yLens

A cross-platform command-line accessibility auditor for web projects. It reads the code, then — when you ask for it — opens the site in a Chromium browser and inspects the roles, names and states exposed through its accessibility tree.

Findings include a likely screen reader impact, remediation guidance and a manual test plan. A11yLens does not run a screen reader or record its speech.

Illustrative terminal excerpt (paths and counts depend on the target):

```text
A11yLens 1.0.0  Accessibility and screen reader audit
Target: C:\work\shop\dist
Files: 24 HTML · 31 source · 6 CSS

checkout.html
  ERROR checkout.html:42  This text field has no label, aria-label or aria-labelledby.
        form-label · WCAG 3.3.2, 4.1.2 (A)
        <input type="text" id="card-name" name="card-name">
        SR: Screen readers announce "edit text" with no name. When several fields exist,
            the user cannot tell which one is focused.
        Fix: Add <label for="id">Name on card</label> and match it to the control id.
```

## Why another accessibility CLI?

A11yLens combines source checks, optional browser checks and manual testing guidance:

- **Static accessible-name estimate** — resolves a subset of `aria-labelledby`, labels, `alt`, `title` fallbacks and name-from-content rules. Browser and screen reader output can differ.
- **Rendered accessibility tree** — Chrome DevTools Protocol `Accessibility.getFullAXTree` exposes Chromium roles and names after JavaScript runs, including runtime-created content.
- **Keyboard walk** — presses Tab up to 60 times and looks for missing outline/box-shadow indicators, obscured element centres and short focus cycles. These are heuristics, not a complete keyboard audit.
- **Reading order clues** — reports non-default CSS `order`, reversed flex containers and heading/landmark outlines for manual review.
- **Manual protocol** — `a11ylens manual` prints a test sequence and command references for NVDA, JAWS, VoiceOver and TalkBack. Commands can depend on version and keymap.

Automated checks cover only part of WCAG. A clean A11yLens report is not a conformance claim; it means the enabled checks did not report a finding within the scanned scope, provided the scan completed without errors.

## Requirements

| Part | Requirement |
| --- | --- |
| Static scan | Node.js 20.10 or newer |
| Rendered scan (`--render`, `--url`) | Node.js 22+ (native WebSocket) and Chrome, Edge, Chromium or Brave installed |
| Dependencies | `parse5`, `axe-core` and `@babel/parser`; no browser download |

The tool and all of its output are in English. The manual screen reader protocol uses English command names; the screen readers themselves can be set to any language.

## Install

### Windows

```powershell
powershell -ExecutionPolicy Bypass -File platforms\windows\install.ps1 -AddToPath
# open a new terminal so the PATH change is visible
a11ylens doctor
```

Without `-AddToPath`, run the launcher directly:

```powershell
platforms\windows\a11ylens.cmd C:\work\shop\dist
```

`install.ps1` checks Node, installs the runtime dependencies and optionally adds `platforms\windows` to your user PATH so the `a11ylens` command works in any terminal. `uninstall.ps1` removes the PATH entry.

### macOS

```sh
./platforms/macos/install.sh
a11ylens doctor
```

The installer puts a symlink in `~/.local/bin` (override with `PREFIX=/usr/local/bin`). Safari is recommended for manual VoiceOver testing. A11yLens itself drives a Chromium browser; it does not launch Safari or VoiceOver.

### Linux

```sh
./platforms/linux/install.sh
a11ylens doctor
```

The installer links `~/.local/bin/a11ylens` and checks for common Chrome/Chromium commands. Add that directory to PATH if necessary. `uninstall.sh` removes the launcher path.

### From the repository (all platforms)

```sh
git clone https://github.com/eleven-hits/A11yLens.git
cd A11yLens
npm ci
node bin/a11ylens.js --help
# or link the command globally
npm link
a11ylens --help
```

## Quick start

```sh
# Static audit of a built site
a11ylens ./dist

# Static + rendered Chrome scan, crawl up to 10 pages
a11ylens ./dist --render --crawl 10

# Audit a running dev server and write a shareable HTML report
a11ylens . --url http://localhost:3000 --format html --output a11ylens-report.html

# Component source audit (React/Vue/Svelte) including .js/.ts JSX
a11ylens ./src --scan-js

# Only the things that matter for a release gate
a11ylens ./dist --render --fail-on error --min-score 85

# Screen reader test plan for the findings
a11ylens manual ./dist --findings
```

## Commands

| Command | Purpose |
| --- | --- |
| `a11ylens [path]` | Scan a directory, a single HTML file, or a built site |
| `a11ylens rules [filter]` | List all checks, filtered by category or id |
| `a11ylens explain <rule>` | Full description, WCAG mapping, screen reader impact, fix |
| `a11ylens manual [path]` | Manual protocol; a path generates findings using a static scan |
| `a11ylens init [path]` | Create `.a11ylensrc.json` |
| `a11ylens doctor` | Print environment diagnostics; does not perform a browser scan |
| `a11ylens help` | Usage |

## How the scan works

```text
project files
   │
   ├─ HTML parser (parse5, source locations)
   │    ├─ semantic rules (headings, landmarks, links, tables, forms)
   │    ├─ accessible-name computation
   │    ├─ ARIA role/state validation
   │    └─ CSS cascade approximation (focus, contrast, motion, order)
   │
   ├─ component scanner (Babel for JS/TS JSX; template scanning for Vue/Svelte/Astro)
   │    └─ click handlers, alt props, labels, tabIndex, raw HTML
   │
   └─ rendered mode (optional)
        ├─ local static server (or --url)
        ├─ headless Chrome through CDP
        ├─ axe-core (WCAG 2.0/2.1/2.2 A/AA + best practice)
        ├─ accessibility tree (roles, names, outline)
        ├─ keyboard walk (Tab order, focus visibility, focus traps, overlays)
        └─ computed order and reversed flex direction
```

The rendered scan serves a local directory on `127.0.0.1` with a random port. It first uses the target directory if it has `index.html`; otherwise it selects the first matching directory from `dist/`, `build/`, `public/`, `out/`, `_site/`, `site/`, `www/` and `.output/public/`. A single-file target uses that file as the entry point. Use `--spa` for history fallback routing.

The rendered browser uses a desktop viewport (1440×900) and the light colour scheme. It does not click through menus, modals or multi-step flows; audit those states with `--url` and the manual protocol. In root containers, add `--no-sandbox` if Chrome refuses to start.

## What is checked

**Document and structure** — `lang`, title, viewport zoom, duplicate ids, positive `tabindex`, skip link, main landmark, landmark labels, heading order, empty headings, automatic refresh.

**Links** — accessible names, vague text ("click here"), placeholder `href`, new-window warnings, missing in-page targets, duplicate link text, unlabeled navigation landmarks.

**Images and media** — missing alt, suspicious file-name/redundant alt text, unnamed inline SVG, icon-only buttons, image map areas, iframe titles, caption-track presence, nearby transcript-link heuristics, autoplay, missing controls and obsolete marquee/blink. Empty alt is allowed for decorative images; media content and transcript accuracy are not verified.

**Forms** — programmatic labels, placeholder-as-label, broken `label[for]`, empty labels, unnamed input buttons, fieldset/legend groups, autocomplete identity hints and token validation, visible-label/name comparisons and live-region presence. These checks do not submit forms or verify validation announcements.

**ARIA** — invalid roles, selected ARIA value types, explicit numeric range consistency, `aria-hidden` with keyboard-reachable content, empty name attributes, broken ID relationships, selected required/allowed states, unknown attributes, presentational roles on focusable elements, custom-widget focus hints, inline click-only handlers, unnamed dialogs/progress indicators and required-child heuristics. This is not a complete ARIA conformance validator.

**CSS** — removed focus outlines, animation without `prefers-reduced-motion`, `order` that desynchronizes reading order, static contrast estimates.

**Component source** — `<img>` without `alt`, anchors without `href`, click handlers on div/span, icon-only buttons, labels without `htmlFor`/`for`, positive `tabIndex`, `autoFocus`, `dangerouslySetInnerHTML`, `v-html`, `{@html}`, unnamed dialog components.

**Rendered only** — axe-core WCAG rules, unnamed widgets from the accessibility tree, focusable generic elements, widget focusability signals, invisible focus, obscured focus, focus traps, computed `order`, reversed flex direction and live-region presence on scripted forms.

The additional static validation rules are available through the same ignore, severity override, baseline and report workflows:

| Rule | Check | Scope |
| --- | --- | --- |
| `aria-valid-attr-value` | Boolean, token, token-list, integer and number syntax | Non-empty values in the supported ARIA 1.2 types |
| `aria-idref-missing` | Missing active-descendant, controls, details, error-message, flow and ownership targets | Current document; runtime-created targets need rendered/manual verification |
| `aria-range` | Inverted explicit bounds and out-of-range current values | Explicit finite numeric ARIA values |
| `autocomplete-invalid` | Field-token spelling/order, contact prefixes and webauthn placement | Token syntax; does not infer the intended field purpose |
| `label-in-name` | Visible content missing from an ARIA accessible name | Warning-level estimate for content-named widgets; symbols and abbreviations need manual review |

These checks use [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/), the [ARIA value ACT rule](https://www.w3.org/WAI/standards-guidelines/act/rules/6a7281/), [WCAG Label in Name guidance](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html) and the [HTML autocomplete specification](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill).

List everything with `a11ylens rules`; the full reference is in [docs/RULES.md](docs/RULES.md).

## Report formats

| Format | Flag | Notes |
| --- | --- | --- |
| Terminal | `--format pretty` | Default, colour when the terminal supports it |
| JSON | `--format json` | Full report for tooling |
| SARIF 2.1.0 | `--format sarif` | GitHub code scanning, Azure DevOps |
| HTML | `--format html` | Self-contained, searchable, filters, page outlines, manual protocol |
| Markdown | `--format markdown` | Pull requests, documentation |

Use `--output` to choose a report file. HTML defaults to `a11ylens-report.html` when no output path is supplied; the other formats go to stdout:

```sh
a11ylens ./dist --format html --output report.html
a11ylens ./dist --format sarif --output a11ylens.sarif
```

Without an explicit `--format`, an output filename can select the format by extension.

`--max-findings` limits only the findings written to the report. Summary counts, score, baseline contents and exit code use the complete finding list. Truncated reports declare how many findings were omitted. `--verbose` adds manual steps and documentation links to terminal output.

## Configuration

`.a11ylensrc.json` (or an `a11ylens` key in `package.json`):

```json
{
  "include": [],
  "exclude": ["**/node_modules/**", "**/.git/**"],
  "ignoreRules": ["css-order"],
  "rules": {
    "css-contrast": "warning",
    "form-live-region": "off"
  },
  "render": true,
  "crawl": 10,
  "maxDepth": 2,
  "wait": 800,
  "spa": false,
  "failOn": "error",
  "format": "pretty",
  "scanJs": true,
  "axeTags": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]
}
```

Command-line scalar flags override the file; include/exclude/ignore lists are combined with configured lists. Unknown CLI options, invalid numeric values and invalid fail levels return exit code 2. `ignoreRules` accepts exact ids and prefix wildcards such as `axe/*` or `src-*`. `rules` accepts `"off"`, `"error"`, `"warning"`, `"info"` or `{ "enabled": false }`.

## Baselines and CI

Record the current state once, then fail only on new issues:

```sh
a11ylens ./dist --update-baseline
a11ylens ./dist --fail-on error
```

The baseline (`.a11ylens-baseline.json`) stores fingerprints built from rule id, file and selector, with snippet or line fallbacks. Source edits, selector changes and different URLs can change fingerprints. Axe findings are stored per affected element, so an existing violation does not suppress a new element with the same rule. Baselines contain hashes rather than page content and can be committed after review.

Invalid baseline files fail explicitly. A failed or incomplete audit cannot update the baseline. `--update-baseline` still returns the normal findings exit code; creating a baseline does not by itself make the command pass.

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | No findings at the chosen `--fail-on` level and the score passes `--min-score` |
| `1` | Findings at or above the chosen level, or the score is below `--min-score` |
| `2` | Tool, config or input error, including failed rules/pages or an incomplete requested render |

A GitHub Actions SARIF example is in [examples/ci/github-actions.yml](examples/ci/github-actions.yml). It assumes A11yLens is installed in the audited project and its build produces `dist/`; adapt the build command and target path to your project.

## Screen reader testing

Automated checks cannot answer: "Does this announcement make sense?" `a11ylens manual` covers that gap with:

- an eleven-step protocol: page load, headings, landmarks, reading order, keyboard, forms, images, dynamic content, tables, zoom/reflow, cognitive and motor support;
- key references for NVDA, JAWS, VoiceOver and TalkBack;
- finding-specific test steps from the report.

Read [docs/SCREEN-READERS.md](docs/SCREEN-READERS.md) for pairings, commands and what to listen for.

## Honest limits

- Static component checks inspect source syntax, not component output or runtime prop values. Vue/Svelte/Astro template scanning is heuristic. Rendered checks inspect only the page state that loads without interaction. The temporary browser profile has no saved login; authentication flows are not automated.
- The CSS cascade is approximated. Gradients, images, opacity, custom properties set at runtime and media queries can change contrast and focus styles. Treat `css-contrast` and `css-focus-outline` as "verify in the browser".
- Accessible name computation implements the practical subset used by the rules: `aria-labelledby`, `aria-label`, native labels, `alt`, `title`, `placeholder`, captions, legends and name-from-content for the roles that allow it.
- Screen reader output depends on the browser and screen reader pair. Repeat the manual protocol with the combinations your users actually use.
- The rendered scan covers one desktop viewport and the initial state of each page. Menus, modals, carousels and multi-step forms need manual interaction testing. The crawl follows same-origin links with hashes removed; hash-router states are not separate crawl pages. It considers at most 200 links per visited page and does not check every possible route.
- A clean report is not a WCAG conformance certificate.

## Project layout

```text
bin/                 CLI entry point
src/
  core/              HTML parser helpers, names/roles, CSS cascade, contrast
  scan/              file discovery, static engine, baselines
  rules/             static, source and rendered rule definitions
  render/            Chrome launcher, CDP client, local server, axe, dynamic scan
  report/            pretty, JSON, SARIF, HTML, Markdown, manual plan
  screenreaders.js   NVDA/JAWS/VoiceOver/TalkBack data and protocol
platforms/
  windows/           install.ps1, a11ylens.cmd, run.ps1, uninstall.ps1
  macos/             install.sh, a11ylens, uninstall.sh
  linux/             install.sh, a11ylens, uninstall.sh
docs/                rules reference, screen reader guide, architecture
examples/            intentionally broken site, clean site, CI workflow
test/                node:test unit and integration tests
```

The operating-system folders contain launchers and installers. The audit engine is shared; browser versions, operating systems and screen reader pairings can still produce different results.

## Development

```sh
npm test                 # unit and integration tests; browser tests skipped by default
A11Y_TEST_RENDER=1 npm run test:render   # POSIX: enable browser integration tests
npm run docs:rules       # regenerate docs/RULES.md from the rule registry
```

On PowerShell, enable the browser tests with `$env:A11Y_TEST_RENDER='1'; npm run test:render`.

Adding a rule: create the rule object with `id`, `severity`, `wcag`, `description`, `srImpact`, `help` and a `check(ctx)` or `checkSource(ctx)`, then add it to the matching file in `src/rules/` and export it from `src/rules/index.js`. The rules list, explain output and documentation generator pick it up automatically.

## Privacy

- The audit engine has no telemetry, account requirement or hosted analysis service. Installation uses npm; rendered pages may make their own network requests.
- Rendered scans use a temporary browser profile under the system temp directory. Shutdown attempts to close the browser and remove the profile; a crash or locked files can leave temporary files behind.
- The local server binds to `127.0.0.1` only, serves the selected site directory and rejects symlinks/junctions resolving outside it. Files inside the served directory are available to local clients while the scan is running.
- With `--url`, the browser loads the target and may follow same-origin links up to the crawl limit. Page scripts, redirects and normal browser requests still run; A11yLens does not upload source files to an analysis service.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for environment setup, bug and false-positive reports, rule implementation guidance, tests and the pull request process. Contributions and project documentation use English.

## License

MIT. See [LICENSE](LICENSE).
