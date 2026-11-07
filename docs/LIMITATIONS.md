# Interpreting findings and reporting false positives

A finding is evidence to investigate, not a conformance verdict. Severity expresses the rule's default priority, not statistical confidence. False-positive rates have not been measured on a representative dataset. The risks below follow from the current implementations; this is not a claim that other checks are infallible.

## Known review risks

| Checks | Why a finding may be misleading | How to verify |
| --- | --- | --- |
| `css-contrast` | The static cascade approximates colours and backgrounds. Runtime styles, media queries and ancestor opacity can change the result. | Measure the rendered foreground and background in each relevant state and theme. |
| `css-focus-outline`, `render-focus-visible` | A border, background change, pseudo-element or browser focus ring can provide an indicator that the outline/shadow heuristic does not recognise. | Tab through controls and inspect the complete indicator, including forced colours. |
| `render-focus-obscured` | A covered centre point does not prove the whole control or focus indicator is obscured. | Inspect the focused control after scrolling, with sticky headers and overlays present. |
| `render-focus-trap` | A short cycle can be intentional inside an open modal. The walk is capped at 60 presses and does not fully traverse shadow roots or frames. | Check whether focus stays in the intended context, Escape works where appropriate, and focus returns to the trigger. |
| `css-order`, `render-order`, `render-reverse-order` | A visual reorder can preserve a meaningful reading sequence. Use of these properties alone does not establish a WCAG failure. | Compare reading, visual and keyboard order for the actual task. |
| `css-reduced-motion` | Transitions can be harmless, and preference handling can occur outside the scanned stylesheets. Presence of a media block also does not prove it covers every animation. | Enable reduced motion and exercise the actual animation and interaction states. |
| `form-live-region`, `render-no-live-region` | A form may navigate to a new document or use deliberate focus management instead of inserting a status message. Scripts and forms alone do not imply a live region is necessary. | Submit valid and invalid data and listen to announcements. Avoid adding live regions that duplicate existing announcements. |
| `src-label-for` | A label can correctly wrap its control without `for` or `htmlFor`. | Inspect the rendered control's computed name and click the visible label. |
| `src-icon-button`, `src-image-component`, `src-dialog-name`, other `src-*` checks | Syntax checks do not execute components. A child component may supply a name, a wrapper may forward props, or delegated keyboard handling may exist elsewhere. Vue, Svelte and Astro template parsing is heuristic. | Inspect the rendered output and keyboard behaviour. Include the smallest component and wrapper that reproduce the discrepancy. |
| `label-in-name` | The static name and visible-text estimate may not match rendered visibility, pronunciation, symbols or abbreviations. | Compare the computed accessible name with the visible label and test speech input when relevant. |
| `aria-idref-missing`, `aria-labelledby-missing`, `aria-describedby-missing` | A referenced target may be created later by JavaScript. Conversely, a target that eventually exists may still be absent when needed. | Inspect the relationship when the control is used, including loading and expanded states. |
| `link-vague`, `link-same-text`, `img-alt-filename`, `img-alt-redundant`, `audio-transcript` | Wording and nearby-link heuristics cannot determine meaning, equivalent context or the quality of a transcript. | Read the surrounding content with a screen reader and check that the alternative conveys the intended information. |
| `ax-not-tabbable` | Composite widgets can use roving tabindex or active descendants; disabled controls can intentionally be unavailable. A focusability signal is not a full keyboard interaction test. | Test the complete widget with Tab and its expected arrow, Enter, Space and Escape keys. |

Use `a11ylens explain <rule-id>` for the exact rule's scope and manual guidance. Browser findings also depend on the Chromium and axe-core versions in the report. Some results are intentionally informational prompts for human review.

## Source locations are not runtime component mapping

HTML and component source findings include a file, line and column. Rendered findings identify a page URL or served file and a DOM selector where available; their line is zero. A11yLens does not use source maps or framework internals to map a runtime node back to a React, Vue or Svelte component. Source and rendered findings are separate evidence and can describe the same problem twice. Counts are findings, not unique user barriers.

A missing source finding does not clear a runtime finding. Dynamic props, conditional output, spread props and injected HTML need rendered and manual testing. The initial page state, desktop viewport, crawl limits and unauthenticated temporary profile also limit what can be observed.

## Review before suppressing

1. Reproduce with the same tool version, configuration, browser, viewport and page state.
2. Inspect the reported element and follow the manual steps above.
3. Record why the finding is incorrect or intentionally informational, including the smallest reproducing code and expected behaviour.
4. Open an English [false-positive report](https://github.com/eleven-hits/A11yLens/issues/new?template=bug_report.yml). Include the rule id, relevant report excerpt, actual behaviour and browser/screen reader versions. Remove private URLs, personal data and credentials.

After review, a project can lower a rule's severity or disable it in `.a11ylensrc.json`:

```json
{
  "rules": {
    "src-label-for": "info",
    "form-live-region": "off"
  }
}
```

This applies to the whole project, not one element. Prefer a reviewed baseline for existing individual findings when broader rule suppression would hide unrelated problems. Baselines can become stale after source, selector or URL changes. Never suppress an unexplained finding just to obtain a higher score.

Pull requests that reduce false positives should include a regression case that stops reporting the valid pattern and a genuinely failing case that remains detectable. See [CONTRIBUTING.md](../CONTRIBUTING.md).
