# Contributing to A11yLens

Contributions that improve accessibility checks, reduce false positives, fix bugs, strengthen tests or clarify documentation are welcome. A11yLens is licensed under MIT; contributions are submitted under the same license.

## Set up your environment

Use Node.js 22 or newer for development and browser tests. Static scans support Node.js 20.10 or newer. Rendered scans also require Chrome, Edge, Chromium or Brave and native WebSocket support.

Fork the repository, then clone your fork. To inspect the upstream project directly:

```sh
git clone https://github.com/eleven-hits/A11yLens.git
cd A11yLens
npm ci
npm test
node bin/a11ylens.js --help
```

Create a branch for a focused change. Keep unrelated cleanup and dependency updates in separate pull requests.

## Report a bug or false positive

Open a [bug report](https://github.com/eleven-hits/A11yLens/issues/new?template=bug_report.yml) and include:

- The A11yLens version, Node.js version, operating system and command you ran.
- A small reproducible HTML, CSS or component case, plus the relevant configuration.
- Expected behavior and actual output, including the rule id and exit code when relevant.
- Browser version for rendered scans. For an announcement discrepancy, include the screen reader, browser and versions you tested.

The files in `examples/broken-site` intentionally contain accessibility barriers. Report problems with the scanner's diagnosis rather than treating those fixtures as production defects.

Use a [feature request](https://github.com/eleven-hits/A11yLens/issues/new?template=feature_request.md) for a new rule or workflow. Describe the user barrier, a concrete example, the expected result and relevant primary-source guidance.

## Code and content conventions

- Use the existing JavaScript ES module architecture and naming conventions.
- Keep source code, documentation, command output, rule metadata and pull request descriptions in English.
- Write clear names and focused functions. Code is comment-free by default; explain non-obvious decisions in the pull request or architecture documentation.
- Preserve UTF-8. Multilingual fixtures and user content must retain their native characters.
- Reuse existing helpers and keep dependencies limited to a demonstrated need.
- Validate external input, preserve failure reporting and release resources on success and failure.
- Do not replace real behavior with placeholders, mock services or silent success paths.

## Add or change an accessibility rule

1. Identify the user barrier and consult the relevant W3C, WHATWG or other primary specification. Distinguish a definite failure from a heuristic or manual-review prompt.
2. Inspect the existing rule and helper modules under `src/rules/` and `src/core/` before introducing another implementation.
3. Add the rule to the appropriate category with a stable `id`, `title`, `category`, `severity`, `wcag`, `level`, `tags`, `description`, `help`, `helpUrl` and `srImpact`. Add useful manual steps where appropriate.
4. Implement `check(ctx)` for static HTML/CSS or `checkSource(ctx)` for component source. A rendered rule needs both registry metadata and a real emission path in `src/render/dynamic.js`; metadata alone is incomplete.
5. Register a new category module in `src/rules/index.js` if needed. Prefer an existing module when it owns the concern.
6. Test both a failing case and a passing case, including relevant false-positive and edge cases. Changes to baseline, severity overrides, filters or exit codes must cover those integrations.
7. Regenerate the rule reference and inspect the generated changes:

```sh
npm run docs:rules
git diff -- docs/RULES.md
```

Do not edit `docs/RULES.md` by hand. Rule ids are used by configuration and baselines; explain compatibility effects before renaming or removing one.

## Run the checks

Run the regular suite:

```sh
npm test
```

Browser tests are skipped unless explicitly enabled and a supported browser is found. Run them when changing browser launch, CDP, crawling, keyboard checks, axe integration or the static/rendered boundary.

On Linux and macOS:

```sh
A11Y_TEST_RENDER=1 npm run test:render
```

On PowerShell:

```powershell
$env:A11Y_TEST_RENDER = '1'
npm run test:render
```

Set `A11YLENS_BROWSER` to the executable path when automatic browser discovery is unsuitable. Use a regular user for browser tests; running Chrome as root requires an explicit sandbox decision. The CLI supports `--no-sandbox` for environments that require it.

The suite includes platform-specific launcher checks. A platform-specific skip is expected on another operating system; a skipped browser test does not establish that browser integration passed.

Before submitting changes, also check the generated reference and package contents:

```sh
npm run docs:rules
git diff --exit-code -- docs/RULES.md
npm pack --dry-run
```

Commit regenerated documentation before expecting the `git diff --exit-code` check to pass.

## Submit a pull request

Open a pull request against `main` and use the pull request template. Describe the user-visible problem and resulting behavior, link the related issue if one exists, and record the commands and manual checks you actually ran.

For an accessibility rule, include its specification reference, failing and passing examples, and limitations. For a bug fix, include a regression test that would have failed before the change. Be explicit about tests you could not run.

Keep the README accurate when behavior, requirements, installation, configuration or supported checks change. Do not claim complete WCAG coverage or identical speech across screen reader/browser combinations.

Review feedback may request a narrower change, more evidence or additional edge cases. Respond to the feedback and keep the branch focused until the change is ready to merge.
