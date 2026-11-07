# Rule reference

Generated from `src/rules/index.js` by `npm run docs:rules`. Do not edit by hand.

A11yLens ships **95 checks** across 10 categories.

Severity is about user impact, not WCAG level: **error** is a clear barrier, **warning** is very likely a barrier that needs context, **info** is a best practice or a manual check.

| Category | Rules |
| --- | --- |
| aria | 19 |
| document | 12 |
| forms | 11 |
| images | 10 |
| media | 5 |
| navigation | 7 |
| render | 9 |
| source | 13 |
| structure | 5 |
| styles | 4 |

## aria

### `role-widget-name` — Custom ARIA widget has no accessible name

- **Severity:** error
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** A non-native element with an interactive ARIA role needs a name from aria-label, aria-labelledby or its content (for roles that allow name from content).
- **Screen reader impact:** The widget is announced with its role but no name, so the user does not know what it does.
- **Fix:** Add a visible label, aria-label or aria-labelledby. Native HTML controls are checked by the form rules instead.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `aria-role-invalid` — Unknown or abstract ARIA role

- **Severity:** error
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** role must be a concrete ARIA role. Abstract roles (widget, landmark, input, range) and typos are ignored by browsers.
- **Screen reader impact:** The element falls back to its native role (often "generic"), so the intended widgets are not announced.
- **Fix:** Use a valid role such as button, navigation, dialog or status. Prefer native HTML elements.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `aria-hidden-focus` — Focusable content is hidden from assistive technology

- **Severity:** error
- **WCAG:** 4.1.2, 2.1.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** aria-hidden="true" hides a subtree from screen readers but not from the keyboard. Focusable elements inside it become invisible focus stops.
- **Screen reader impact:** Keyboard focus moves to an element that the screen reader does not announce. The user loses focus entirely and may think the page froze.
- **Manual test:** Tab through the area. If focus disappears and the screen reader says nothing, this is the failure. NVDA: enable Visual Highlight in Settings > Vision and watch for focus landing on an unannounced element.
- **Fix:** Remove aria-hidden from the container, or add inert/disabled and tabindex="-1" to the focusable children while it is hidden.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `aria-hidden-body` — The whole page is hidden from assistive technology

- **Severity:** error
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** aria-hidden="true" on <body> erases the entire page from the accessibility tree.
- **Screen reader impact:** Screen readers see an empty document. The user is left with silence.
- **Fix:** Remove aria-hidden from body. Hide only the specific overlay or inactive region.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `aria-label-empty` — ARIA name attribute is empty

- **Severity:** warning
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Empty ARIA name attributes do not provide a label. Browsers may fall back to native labels or visible text.
- **Screen reader impact:** If no native label or visible text provides a fallback, the element is announced without a name.
- **Fix:** Remove the empty attribute, or provide a meaningful value. Use aria-hidden="true" if the element is decorative.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `aria-labelledby-missing` — aria-labelledby points to a missing element

- **Severity:** warning
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Every id in aria-labelledby must exist. Missing references leave the element unnamed.
- **Screen reader impact:** The element is announced with no name, or with a partial name if only some ids resolve.
- **Fix:** Fix the id, or remove aria-labelledby and use aria-label or visible text.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `aria-describedby-missing` — aria-describedby points to a missing element

- **Severity:** info
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Every id in aria-describedby must exist, otherwise help text and error messages are not announced.
- **Screen reader impact:** Instructions or error text attached to the field are silently dropped.
- **Fix:** Fix the id or remove the reference.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `aria-required-attr` — ARIA role is missing a required state

- **Severity:** error
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Roles such as checkbox, combobox, slider and heading require specific aria-* states. Without them the widget is incomplete.
- **Screen reader impact:** Screen readers announce the role but not its state, so users cannot tell whether a checkbox is checked or a menu expanded.
- **Fix:** Add the required attribute, for example aria-checked for role="checkbox" or aria-expanded for role="combobox".
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `aria-allowed-attr` — ARIA attribute is not allowed on this role

- **Severity:** warning
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Some aria-* attributes only apply to specific roles. Browsers ignore the ones that do not.
- **Screen reader impact:** The state the author tried to expose is not announced at all.
- **Fix:** Remove the unsupported attribute or move it to an element with the correct role.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `aria-unknown-attr` — Unknown aria-* attribute

- **Severity:** warning
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Attribute names that are not part of ARIA 1.2 are ignored by browsers and screen readers.
- **Screen reader impact:** The intended state or label is silently ignored.
- **Fix:** Check the attribute spelling against the ARIA specification. Common typos: aria-lable, aria-describeby, aria-role.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `role-presentation-focusable` — Interactive element is marked as presentational

- **Severity:** error
- **WCAG:** 4.1.2, 2.1.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** role="presentation" or "none" is ignored on focusable elements, so the element keeps a role that contradicts the markup.
- **Screen reader impact:** The element is announced with a role the author did not intend, often as a plain link or button with no name.
- **Fix:** Remove the presentational role from the interactive element, or replace it with a real button/link.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `interactive-role-focusable` — Custom widget cannot receive keyboard focus

- **Severity:** warning
- **WCAG:** 2.1.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** An element with an interactive ARIA role must be keyboard focusable (tabindex="0" or a native control).
- **Screen reader impact:** The widget appears in the accessibility tree but cannot be reached with Tab, so screen reader users must use virtual cursor navigation and cannot operate it.
- **Fix:** Use the native element, or add tabindex="0" and keyboard handlers for Enter and Space.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html

### `click-handler-noninteractive` — Click handler on a non-interactive element

- **Severity:** warning
- **WCAG:** 2.1.1, 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** A click handler on a div or span is not keyboard operable and has no role. The static scan cannot see handlers added with addEventListener, so verify before fixing.
- **Screen reader impact:** Screen readers may not expose the element as interactive, and keyboard users cannot activate it.
- **Fix:** Use <button type="button"> for actions. If a custom element is unavoidable, add role, tabindex="0" and Enter/Space handling.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html

### `dialog-name` — Dialog has no accessible name

- **Severity:** warning
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** A dialog needs aria-labelledby pointing to its heading, or aria-label.
- **Screen reader impact:** The dialog is announced as "dialog" with no title, so users do not know what opened or what it is for.
- **Fix:** Add aria-labelledby="dialog-title" to the dialog and give the heading that id.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `progress-name` — Progress bar or meter has no name

- **Severity:** warning
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** A progress indicator needs a label so users know what is progressing.
- **Screen reader impact:** The value is announced without context: "50 percent" of what?
- **Fix:** Add aria-label="Upload progress" or aria-labelledby pointing to a visible label.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `aria-required-children` — ARIA container is missing required children

- **Severity:** warning
- **WCAG:** 1.3.1, 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Composite roles must own particular children: listbox → option, tablist → tab, radiogroup → radio, tree → treeitem, grid/table → row.
- **Screen reader impact:** Screen readers may not enter the composite widget, or announce an empty group with no items.
- **Fix:** Add the required child roles, or use the matching native HTML element.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html

### `aria-valid-attr-value` — ARIA state or property has an invalid value

- **Severity:** error
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Checks non-empty ARIA boolean, token, token-list, integer and numeric values against their ARIA 1.2 value types.
- **Screen reader impact:** Invalid states may be ignored or replaced with defaults, so the announced state differs from the widget state.
- **Fix:** Use the documented value type, such as aria-expanded="true", aria-live="polite" or a finite number for aria-valuenow.
- **Reference:** https://www.w3.org/WAI/standards-guidelines/act/rules/6a7281/

### `aria-idref-missing` — ARIA relationship points to a missing element

- **Severity:** warning
- **WCAG:** 1.3.1, 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Checks ID references in aria-activedescendant, controls, details, errormessage, flowto and owns in the current document. Runtime-created targets need rendered verification.
- **Screen reader impact:** The active item, controlled region, detailed description or validation error cannot be located through the announced relationship.
- **Fix:** Match every referenced id to the intended element. If a target is created at runtime, verify the relationship after it is created.
- **Reference:** https://www.w3.org/TR/wai-aria-1.2/#valuetype_idref

### `aria-range` — ARIA range values are inconsistent

- **Severity:** error
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Checks explicit aria-valuemin, aria-valuemax and aria-valuenow for inverted bounds or a current value outside the declared range.
- **Screen reader impact:** A slider, meter or progress indicator announces a value that cannot exist within its stated range.
- **Fix:** Keep aria-valuemin <= aria-valuenow <= aria-valuemax. Omit aria-valuenow for an indeterminate progress indicator.
- **Reference:** https://www.w3.org/TR/wai-aria-1.2/#aria-valuenow

## document

### `html-lang` — Page language is missing or invalid

- **Severity:** error
- **WCAG:** 3.1.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** The <html> element needs a valid lang attribute so screen readers choose the right voice, pronunciation rules and braille table.
- **Screen reader impact:** NVDA, JAWS and VoiceOver fall back to the system language. Words are pronounced with the wrong phonemes and braille output may use the wrong table.
- **Manual test:** NVDA: open the speech dialog (NVDA+Ctrl+V) and confirm the synthesizer language changes when the page loads. VoiceOver: with the rotor on, check that the voice does not switch to the wrong language when reading the page.
- **Fix:** Set lang on <html>, for example lang="en" or lang="tr".
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html

### `document-title` — Page title is missing or empty

- **Severity:** error
- **WCAG:** 2.4.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Every page needs a unique, descriptive <title>. It is the first thing a screen reader announces and the label used in the tab list.
- **Screen reader impact:** Screen readers announce the title when a page loads and when switching browser tabs. An empty title is announced as "untitled" or as the raw URL.
- **Fix:** Add a <title> that names the page and the site, for example "Checkout - Example Store".
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html

### `meta-viewport-zoom` — Zoom is disabled in the viewport meta tag

- **Severity:** error
- **WCAG:** 1.4.4 (level AA)
- **Engine:** Static HTML/CSS
- **What it checks:** user-scalable=no or a maximum-scale below 2 prevents low-vision users from zooming the page.
- **Screen reader impact:** Screen magnifier users and low-vision screen reader users cannot enlarge text. Zoom is often the only way to read a page with a screen reader and magnification together.
- **Fix:** Remove user-scalable=no and allow at least maximum-scale=5 (or omit maximum-scale).
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html

### `duplicate-id` — Duplicate id attribute

- **Severity:** warning
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** ids must be unique. Duplicate ids break aria-labelledby, aria-describedby, label[for] and in-page links.
- **Screen reader impact:** A screen reader may announce the wrong label, skip a control, or read the first matching element instead of the intended one.
- **Fix:** Give every element a unique id, or use aria-labelledby with a unique id.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `tabindex-positive` — Positive tabindex changes the focus order

- **Severity:** warning
- **WCAG:** 2.4.3 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** tabindex greater than zero removes an element from the natural tab order and puts it first, which almost always creates illogical focus order.
- **Screen reader impact:** Keyboard and screen reader users jump around the page in an order that does not match the visual layout, losing context.
- **Fix:** Use tabindex="0" to make an element focusable and place it in DOM order. Reorder the DOM instead of using positive values.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html

### `skip-link` — No skip link to the main content

- **Severity:** warning
- **WCAG:** 2.4.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** A skip link lets keyboard and screen reader users jump past repeated navigation. It should be the first focusable element on the page.
- **Screen reader impact:** Screen reader users must listen to every navigation link on every page before reaching the content. On a large menu this can take minutes.
- **Manual test:** Press Tab once after the page loads. The first focusable element should be the skip link. Activate it with Enter. Focus should move into the main content, not merely scroll the page.
- **Fix:** Add a link such as <a class="skip" href="#main">Skip to main content</a> at the start of <body>, and give the main element id="main".
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html

### `landmark-main` — No main landmark

- **Severity:** warning
- **WCAG:** 1.3.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** A <main> element or role="main" lets assistive technology jump straight to the primary content.
- **Screen reader impact:** Screen reader landmark navigation (NVDA D, JAWS R, VoiceOver rotor) has no main region, so users cannot bypass the header and navigation.
- **Fix:** Wrap the primary content in <main id="main"> (one per page).
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html

### `landmark-unique` — Multiple landmarks of the same type are unlabeled

- **Severity:** info
- **WCAG:** 1.3.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** When a page has more than one navigation, complementary, form, region or contentinfo landmark, each one needs a distinct accessible name.
- **Screen reader impact:** Screen readers list landmarks by role and name. Unnamed duplicates are announced identically, so users cannot tell the main navigation from the footer navigation.
- **Fix:** Add aria-label="Primary" / aria-label="Footer" (or aria-labelledby) to each repeated landmark.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html

### `heading-order` — Heading levels skip a level

- **Severity:** warning
- **WCAG:** 1.3.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Headings must form a logical outline. Jumping from h2 to h4 makes the document structure ambiguous.
- **Screen reader impact:** Screen reader users navigate by heading level (NVDA 2, JAWS 2, VoiceOver rotor). Missing levels make it harder to understand where a section sits in the hierarchy.
- **Fix:** Use the next heading level (h2 then h3). Style with CSS instead of choosing a heading level for its size.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html

### `heading-empty` — Heading has no text

- **Severity:** error
- **WCAG:** 1.3.1, 2.4.6 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** An empty heading is still exposed to assistive technology and creates a dead stop in the outline.
- **Screen reader impact:** Screen readers announce "heading level 2" with no name, which sounds like a broken section.
- **Fix:** Remove the empty heading or add meaningful text. Decorative headings should not be headings.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html

### `page-h1` — Page has no h1 heading

- **Severity:** info
- **WCAG:** 1.3.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** A single h1 gives the page a clear top-level title in the heading outline.
- **Screen reader impact:** Screen reader users who list headings (NVDA Insert+F7) see no top-level entry for the page.
- **Fix:** Add one visible h1 that describes the page. Do not use an h1 just for visual size.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html

### `meta-refresh` — Page refreshes or redirects automatically

- **Severity:** error
- **WCAG:** 2.2.1, 3.2.5 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** A meta refresh moves the user without warning. Users cannot pause, stop or extend the time limit.
- **Screen reader impact:** A screen reader may be in the middle of announcing the page when it reloads. Focus and reading position are lost.
- **Fix:** Remove the meta refresh. Use a server redirect for permanent moves, or give the user a link and enough time.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html

## forms

### `form-label` — Form control has no label

- **Severity:** error
- **WCAG:** 3.3.2, 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Every input, select and textarea needs a programmatic label: <label for>, a wrapping <label>, aria-label or aria-labelledby.
- **Screen reader impact:** Screen readers announce "edit text" with no name. When several fields exist, the user cannot tell which one is focused. Voice control users cannot say "click Email".
- **Manual test:** NVDA: press F to move between form fields and listen to the label announced before the field role. VoiceOver: use the form rotor and check every field has a label.
- **Fix:** Add <label for="id">Email</label> and match it with the control id. Use aria-label only when a visible label is impossible.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html

### `form-placeholder-label` — Placeholder is used instead of a label

- **Severity:** warning
- **WCAG:** 3.3.2, 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Placeholder text disappears as soon as the user types, is low contrast, and is not a reliable label.
- **Screen reader impact:** Some screen readers announce the placeholder as a description, not a name. Once text is entered, the user can no longer confirm what the field is for.
- **Fix:** Add a persistent visible <label>. Keep the placeholder only as an example of the expected format.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html

### `label-for-missing` — Label points to a missing control

- **Severity:** warning
- **WCAG:** 1.3.1, 3.3.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** label[for] must match the id of a form control. A broken reference leaves the control unlabeled.
- **Screen reader impact:** The label is not associated with any control, so the field is announced without a name.
- **Fix:** Match for="field-id" to the control id, or wrap the control inside the label.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html

### `label-empty` — Label has no text

- **Severity:** warning
- **WCAG:** 1.3.1, 3.3.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** An empty label leaves its control without a name.
- **Screen reader impact:** The associated control is announced with no name.
- **Fix:** Add text to the label, or use aria-label on the control if the design cannot show a visible label.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html

### `input-button-name` — Input button has no value

- **Severity:** error
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** input type="button" and explicit empty values on submit/reset inputs produce unnamed buttons.
- **Screen reader impact:** The button is announced as "button" with no purpose.
- **Fix:** Set value="Search" (or the action name). For submit/reset, either omit value to keep the browser default or set a meaningful one.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `fieldset-legend` — Radio or checkbox group has no group label

- **Severity:** warning
- **WCAG:** 1.3.1, 3.3.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Groups of radios or checkboxes need a <fieldset> with <legend>, or role="radiogroup"/"group" with an accessible name.
- **Screen reader impact:** Screen readers announce each option without the question it belongs to. Users hear "Standard, radio button" and do not know what they are choosing.
- **Fix:** Wrap the group in <fieldset><legend>Delivery method</legend>…</fieldset>.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html

### `fieldset-legend-missing` — Fieldset has no legend

- **Severity:** warning
- **WCAG:** 1.3.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** A fieldset without a legend groups controls without telling the user what the group means.
- **Screen reader impact:** Screen readers announce "group" with no name before the controls.
- **Fix:** Add <legend> as the first child of the fieldset.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html

### `autocomplete-missing` — Identity field has no autocomplete token

- **Severity:** info
- **WCAG:** 1.3.5 (level AA)
- **Engine:** Static HTML/CSS
- **What it checks:** WCAG 1.3.5 asks authors to identify the purpose of common input fields with autocomplete tokens so browsers and assistive tech can fill them.
- **Screen reader impact:** Users with cognitive or motor disabilities cannot rely on browser autofill. Screen reader users must type the same information repeatedly.
- **Fix:** Add autocomplete="email", autocomplete="current-password", autocomplete="given-name", and so on.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html

### `form-live-region` — Forms have no live region for errors or status

- **Severity:** info
- **WCAG:** 4.1.3, 3.3.1 (level AA)
- **Engine:** Static HTML/CSS
- **What it checks:** Validation errors and success messages inserted after submit are silent unless they are in a live region (role="alert" or aria-live).
- **Screen reader impact:** The form appears to do nothing after submission. Screen reader users resubmit repeatedly because the error message is never announced.
- **Fix:** Add a persistent container with role="alert" or aria-live="polite" and put error text into it after submit.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html

### `autocomplete-invalid` — Autocomplete tokens are invalid or out of order

- **Severity:** warning
- **WCAG:** 1.3.5 (level AA)
- **Engine:** Static HTML/CSS
- **What it checks:** Validates autocomplete token spelling and order, optional section and contact prefixes, hidden-input restrictions and the final webauthn token. It does not infer whether a valid token describes the intended field.
- **Screen reader impact:** Browsers and assistive technology may not identify or autofill the field purpose when its autocomplete tokens are invalid.
- **Fix:** Use a recognized field token, for example email, given-name or section-checkout shipping street-address. Put webauthn last where supported.
- **Reference:** https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill

### `label-in-name` — Accessible name does not contain the visible label

- **Severity:** warning
- **WCAG:** 2.5.3 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Compares visible text content with ARIA naming on content-named widgets. Ignores case, punctuation and parenthetical text; symbols and short or abbreviated labels need manual review.
- **Screen reader impact:** Voice control users say the label they can see, but the control is exposed under a different name and may not respond.
- **Manual test:** Say the visible label using voice control and confirm that it identifies the intended control.
- **Fix:** Include the visible label in the accessible name, preferably at the beginning. Remove an unnecessary aria-label that replaces correct visible text.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html

## images

### `img-alt` — Image is missing alternative text

- **Severity:** error
- **WCAG:** 1.1.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Every <img> needs an alt attribute. Informative images need a description; decorative images need alt="" (and no link around them).
- **Screen reader impact:** NVDA and JAWS announce the file name or "graphic" with no description. VoiceOver may skip the image entirely. The information is unavailable to blind users.
- **Manual test:** NVDA: press G in browse mode to move between graphics and listen to each name. VoiceOver: use the rotor (VO+U) and open Images; every entry should have a meaningful label or be hidden.
- **Fix:** Add alt="description" for informative images. Add alt="" for decorative images. Never omit alt.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html

### `img-alt-filename` — Image alt text looks like a file name

- **Severity:** warning
- **WCAG:** 1.1.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** File names such as hero-2.jpg or IMG_1234 provide no meaning to a screen reader user.
- **Screen reader impact:** Screen readers read "IMG underscore 1234 dot jpeg" instead of useful information.
- **Fix:** Describe what the image shows or why it is there. Use alt="" if it is decorative.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html

### `img-alt-redundant` — Image alt text starts with "image of"

- **Severity:** info
- **WCAG:** 1.1.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Screen readers already announce "image"; alt text should describe the content, not the medium.
- **Screen reader impact:** NVDA and JAWS announce "image, image of a red bicycle", repeating the role.
- **Fix:** Write alt="A red bicycle leaning on a wall" instead of "Image of a red bicycle".
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html

### `svg-name` — Inline SVG has no accessible name

- **Severity:** warning
- **WCAG:** 1.1.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Informative inline SVGs need role="img" plus <title> or aria-label. Decorative SVGs should be hidden with aria-hidden="true" and focusable="false".
- **Screen reader impact:** An unnamed SVG can appear as an unlabeled graphic in the accessibility tree, or be skipped completely. Either way its meaning is lost.
- **Fix:** Add <title> as the first child and role="img", or add aria-hidden="true" for decoration.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html

### `button-name` — Button has no accessible name

- **Severity:** error
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Every button needs text, alt text on its image, or aria-label. Icon-only buttons are the most common failure.
- **Screen reader impact:** Screen readers announce "button" with no name. Voice control users cannot target it by name either.
- **Manual test:** NVDA: press B to jump between buttons; each should be announced with a purpose. VoiceOver: open the rotor, choose Buttons and check every label.
- **Fix:** Add visible text, aria-label="Close", or alt text on the icon image. Do not rely on title.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `role-img-name` — Element with role="img" has no accessible name

- **Severity:** error
- **WCAG:** 1.1.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** role="img" turns an element into a single image node. Its content is not used as the name, so it needs aria-label or aria-labelledby.
- **Screen reader impact:** The image is announced as a graphic with no description, and its internal text is not read separately.
- **Fix:** Add aria-label="Chart: sales by quarter" or aria-labelledby pointing to a visible caption.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html

### `input-image-alt` — Image submit button has no alt text

- **Severity:** error
- **WCAG:** 1.1.1, 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** input type="image" needs alt text; the image is the button label.
- **Screen reader impact:** Screen readers announce "button" with no name, or read the image file name.
- **Fix:** Add alt="Search" (or the action name) to the input.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html

### `area-alt` — Image map area has no alt text

- **Severity:** error
- **WCAG:** 1.1.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Each clickable <area> needs alt text describing its destination.
- **Screen reader impact:** The area is announced as an unnamed link.
- **Fix:** Add alt="..." (or aria-label) to every area with href.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html

### `object-name` — Embedded object has no title

- **Severity:** warning
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** <object> and <embed> need a title or aria-label so users know what the embedded content is.
- **Screen reader impact:** Screen readers announce "embedded object" with no description.
- **Fix:** Add title="Annual report (PDF)" or aria-label to the object.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `iframe-title` — Iframe has no title

- **Severity:** error
- **WCAG:** 4.1.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Frames need a title that describes their content, for example "Video: product tour".
- **Screen reader impact:** Screen readers list frames as "frame" with no name. Users cannot decide whether to enter the frame, and may miss embedded video or forms.
- **Manual test:** NVDA: press M or open the elements list and inspect the Frames tab. VoiceOver: use the rotor to list frames and check every title.
- **Fix:** Add a unique title attribute (or aria-label) to each iframe.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

## media

### `video-captions` — Video has no captions track

- **Severity:** warning
- **WCAG:** 1.2.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Prerecorded video with audio needs synchronized captions. Without a <track kind="captions"> there is no caption source in the markup.
- **Screen reader impact:** Deaf and hard-of-hearing users, including many screen reader users, get no access to dialogue and meaningful sounds.
- **Fix:** Add <track kind="captions" src="captions.vtt" srclang="en" label="English">.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html

### `audio-transcript` — Audio has no nearby transcript

- **Severity:** info
- **WCAG:** 1.2.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Prerecorded audio needs a transcript. The tool checks for a transcript link near the player.
- **Screen reader impact:** Deaf users and people in noisy environments cannot access the audio content.
- **Fix:** Add a link to a transcript immediately before or after the audio element.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded.html

### `media-autoplay` — Media autoplays with sound

- **Severity:** warning
- **WCAG:** 1.4.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Audio that autoplays and is not muted interferes with screen reader speech.
- **Screen reader impact:** Screen reader speech and page audio play at the same time. The user cannot hear the page and may not find the pause button.
- **Fix:** Remove autoplay or add muted. If audio must autoplay, provide a visible pause control.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html

### `media-controls` — Media player has no controls

- **Severity:** info
- **WCAG:** 2.1.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** A video or audio element without controls cannot be operated by keyboard unless custom controls are provided.
- **Screen reader impact:** Keyboard and screen reader users cannot play, pause or seek the media.
- **Fix:** Add the controls attribute, or provide fully keyboard-accessible custom controls.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html

### `marquee-blink` — Obsolete moving or blinking element

- **Severity:** error
- **WCAG:** 2.2.2, 2.3.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** <marquee> and <blink> move content continuously. Users cannot pause or stop it, and it can trigger vestibular symptoms.
- **Screen reader impact:** Moving text is hard to read with magnification and stressful for users with vestibular disorders.
- **Fix:** Remove the element. If animation is essential, use CSS animation with a pause control and prefers-reduced-motion support.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html

## navigation

### `link-name` — Link has no accessible name

- **Severity:** error
- **WCAG:** 4.1.2, 2.4.4 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Every link needs an accessible name. An image-only link needs alt text, and an icon-only link needs aria-label.
- **Screen reader impact:** Screen readers announce "link" with no name. The elements list shows a blank entry, so the destination cannot be identified.
- **Manual test:** NVDA: press Insert+F7, open the Links tab and check that every entry has a meaningful name. VoiceOver: open the rotor (VO+U), choose Links and listen to each label.
- **Fix:** Add text inside the link, alt text on the image, or aria-label on the link. Do not rely on title alone.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html

### `link-vague` — Link text is not descriptive

- **Severity:** warning
- **WCAG:** 2.4.4 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Link text such as "click here" or "read more" does not describe the destination when read out of context.
- **Screen reader impact:** Screen reader users often browse a list of links without surrounding text. Vague entries are indistinguishable from each other.
- **Fix:** Name the destination: "Read the 2025 accessibility report" instead of "Read more".
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html

### `link-placeholder-href` — Link uses a placeholder href

- **Severity:** info
- **WCAG:** 2.1.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** href="#" or javascript: links look like links to assistive technology but do not navigate anywhere. They are also a keyboard trap risk when they only handle clicks.
- **Screen reader impact:** Screen readers announce a link, the user expects navigation, and nothing happens. The user may think the page is broken.
- **Fix:** Use a <button> for actions and a real URL for navigation.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html

### `link-target-blank` — Link opens in a new window without warning

- **Severity:** info
- **WCAG:** 3.2.5 (level AAA)
- **Engine:** Static HTML/CSS
- **What it checks:** target="_blank" changes context unexpectedly. Users should be told, and rel="noopener noreferrer" should be set.
- **Screen reader impact:** The new tab takes focus without an announcement. Screen reader users may not realize a new page opened and lose their place in the old one.
- **Fix:** Add "(opens in a new tab)" to the link text or aria-label, and rel="noopener noreferrer".
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/change-on-request.html

### `anchor-target-missing` — In-page link points to a missing target

- **Severity:** warning
- **WCAG:** 2.4.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** A fragment link whose target id does not exist goes nowhere and can confuse keyboard users.
- **Screen reader impact:** Activating the link does not move focus or scroll. Screen reader users hear no change and assume the link is broken.
- **Fix:** Update the href or add the missing id to the target element.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html

### `link-same-text` — Different links share the same text

- **Severity:** info
- **WCAG:** 2.4.4 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** Links with identical names but different destinations are ambiguous in a links list.
- **Screen reader impact:** Screen reader users selecting from the links list cannot tell the entries apart.
- **Fix:** Make each link name unique, for example "Read the pricing guide" and "Read the security guide".
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html

### `nav-label` — Multiple navigation landmarks lack labels

- **Severity:** warning
- **WCAG:** 1.3.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** When a page has more than one <nav>, each needs a distinct accessible name.
- **Screen reader impact:** Screen readers list both navigations as "navigation" with no way to choose the right one.
- **Fix:** Add aria-label="Primary", aria-label="Breadcrumb" or aria-label="Footer" to each nav element.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html

## render

### `ax-empty-name` — Rendered widget has no accessible name

- **Severity:** error
- **WCAG:** 4.1.2 (level A)
- **Engine:** Rendered Chrome + accessibility tree
- **What it checks:** The accessibility tree exposed by Chrome has an interactive role with an empty name. This is what screen readers actually receive after JavaScript runs.
- **Screen reader impact:** The screen reader announces the role only: "button", "tab" or "option" with no purpose.
- **Fix:** Add visible text, aria-label or aria-labelledby to the widget.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `ax-focusable-generic` — Focusable element has no role or name

- **Severity:** warning
- **WCAG:** 4.1.2 (level A)
- **Engine:** Rendered Chrome + accessibility tree
- **What it checks:** An element is in the tab order but is exposed as generic with no name, so the screen reader announces nothing useful when focus reaches it.
- **Screen reader impact:** Focus seems to disappear: the user lands on an element that has no announced role or name.
- **Fix:** Use a native control, or add an appropriate role, accessible name and keyboard handling.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `ax-not-tabbable` — Interactive widget is not keyboard focusable

- **Severity:** warning
- **WCAG:** 2.1.1 (level A)
- **Engine:** Rendered Chrome + accessibility tree
- **What it checks:** Chrome exposes an interactive role but reports the node as not focusable. Keyboard users cannot reach it with Tab.
- **Screen reader impact:** The control exists in the accessibility tree but cannot be reached or operated with the keyboard.
- **Fix:** Add tabindex="0" and keyboard handlers, or replace the widget with a native button/link.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html

### `render-focus-visible` — Focused element has no visible focus indicator

- **Severity:** warning
- **WCAG:** 2.4.7 (level AA)
- **Engine:** Rendered Chrome + accessibility tree
- **What it checks:** While tabbing through the rendered page, this element had no outline and no box-shadow change. The browser may still draw a default ring in some states; verify visually.
- **Screen reader impact:** Low-vision and screen reader users who navigate by keyboard lose track of the focused element.
- **Fix:** Add a :focus-visible style with a 2px outline and sufficient contrast against the background.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html

### `render-focus-obscured` — Focused element is hidden behind other content

- **Severity:** warning
- **WCAG:** 2.4.11 (level AA)
- **Engine:** Rendered Chrome + accessibility tree
- **What it checks:** The center of the focused element is covered by a sticky header, cookie banner, chat widget or another overlay.
- **Screen reader impact:** Keyboard users cannot see which element has focus, even though the screen reader announces it.
- **Fix:** Add scroll-margin or move focus so the element is fully visible, and make overlays non-blocking or dismissible.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html

### `render-focus-trap` — Keyboard focus appears to be trapped

- **Severity:** error
- **WCAG:** 2.1.2 (level A)
- **Engine:** Rendered Chrome + accessibility tree
- **What it checks:** Repeated Tab presses cycled through fewer than three elements, or focus stopped moving, while the page was not inside an open modal dialog.
- **Screen reader impact:** Keyboard and screen reader users cannot reach the rest of the page and may have to reload.
- **Fix:** Let focus leave the widget with Tab/Shift+Tab. Trap focus only inside a modal while it is open, and release it on close.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html

### `render-order` — CSS order changes the rendered reading order

- **Severity:** info
- **WCAG:** 1.3.2 (level A)
- **Engine:** Rendered Chrome + accessibility tree
- **What it checks:** A flex or grid item has a non-zero computed order. Visual position no longer matches DOM order, which is what screen readers follow.
- **Screen reader impact:** The screen reader reads the content in a different order than sighted users see it.
- **Fix:** Reorder the DOM and use layout properties only for decoration.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html

### `render-reverse-order` — Reversed flex direction changes the reading order

- **Severity:** warning
- **WCAG:** 1.3.2 (level A)
- **Engine:** Rendered Chrome + accessibility tree
- **What it checks:** row-reverse or column-reverse places content in the opposite visual order from the DOM. Screen readers and keyboard focus follow the DOM.
- **Screen reader impact:** The announced order is the reverse of the visual order, which is especially confusing for forms and toolbars.
- **Fix:** Use the natural DOM order and reverse only non-text decoration, or duplicate the visual effect without reversing content.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html

### `render-no-live-region` — Dynamic page has no live region

- **Severity:** info
- **WCAG:** 4.1.3 (level AA)
- **Engine:** Rendered Chrome + accessibility tree
- **What it checks:** The rendered page has forms and scripts but no active aria-live, role="alert", role="status" or role="log" container. This is an informational prompt to verify dynamic announcements manually.
- **Screen reader impact:** Search results, validation errors and toasts are inserted without an announcement.
- **Fix:** Add a persistent live region and write status and error messages into it.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html

## source

### `src-img-alt` — JSX/Vue image is missing alt

- **Severity:** error
- **WCAG:** 1.1.1 (level A)
- **Engine:** Component source
- **What it checks:** Images in component templates need an alt prop/attribute, exactly like static HTML.
- **Screen reader impact:** The rendered image has no accessible name, so screen readers announce the file name or skip it.
- **Fix:** Add alt="description" or alt="" for decorative images. Spread props are skipped because the tool cannot verify them.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html

### `src-image-component` — Image component is missing alt

- **Severity:** warning
- **WCAG:** 1.1.1 (level A)
- **Engine:** Component source
- **What it checks:** Framework image components (Image, NextImage, Img) still render an <img> and need alt.
- **Screen reader impact:** The rendered image has no accessible name.
- **Fix:** Pass alt as a prop. If the component cannot accept alt, wrap it in a component that can.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html

### `src-anchor-href` — Anchor has no href

- **Severity:** warning
- **WCAG:** 2.1.1, 4.1.2 (level A)
- **Engine:** Component source
- **What it checks:** An <a> without href is not a link. Click handlers on it are not keyboard operable.
- **Screen reader impact:** Screen readers may announce plain text instead of a link, or a link that does nothing when activated.
- **Fix:** Use href for navigation. Use <button type="button"> for actions.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html

### `src-click-noninteractive` — Click handler on a non-interactive element

- **Severity:** error
- **WCAG:** 2.1.1 (level A)
- **Engine:** Component source
- **What it checks:** A click handler on div, span, li or similar has no keyboard equivalent and no role, so keyboard and screen reader users cannot activate it.
- **Screen reader impact:** The control is not in the tab order or is announced as plain text. Screen reader and keyboard users cannot perform the action.
- **Manual test:** Tab to the element. If focus skips it, or Enter/Space do nothing, the finding is confirmed.
- **Fix:** Use <button type="button">. If unavoidable, add role="button", tabIndex={0} and onKeyDown for Enter and Space.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html

### `src-icon-button` — Icon-only button has no accessible name

- **Severity:** error
- **WCAG:** 4.1.2 (level A)
- **Engine:** Component source
- **What it checks:** A button whose only child is an icon needs aria-label (or visually hidden text).
- **Screen reader impact:** Screen readers announce "button" and Voice control users cannot target it.
- **Fix:** Add aria-label="Close" to the button, or include text inside a visually hidden span.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `src-label-for` — Label is not bound to a control

- **Severity:** info
- **WCAG:** 1.3.1, 3.3.2 (level A)
- **Engine:** Component source
- **What it checks:** A <label> without htmlFor/for only works when it wraps the control. Component libraries often move the control out of the label.
- **Screen reader impact:** The control is announced without its label.
- **Fix:** Add htmlFor="field-id" (React) or for="field-id" (Vue/Svelte), or keep the input inside the label.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html

### `src-tabindex-positive` — Positive tabIndex in component

- **Severity:** warning
- **WCAG:** 2.4.3 (level A)
- **Engine:** Component source
- **What it checks:** tabIndex greater than 0 breaks the natural focus order.
- **Screen reader impact:** Keyboard and screen reader focus jump around the page.
- **Fix:** Use tabIndex={0} and reorder the DOM instead.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html

### `src-autofocus` — Component steals focus on mount

- **Severity:** info
- **WCAG:** 3.2.1 (level A)
- **Engine:** Component source
- **What it checks:** autoFocus moves focus without warning, often to a search field in a modal, and disorients screen reader users.
- **Screen reader impact:** The page changes context without warning; screen reader users may not hear the new content.
- **Fix:** Avoid autoFocus. If focus must move, send it to a heading or dialog with a clear announcement.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html

### `src-dangerous-html` — Raw HTML injection bypasses accessibility checks

- **Severity:** info
- **WCAG:** 4.1.2 (level A)
- **Engine:** Component source
- **What it checks:** dangerouslySetInnerHTML can insert images without alt, links without text and broken ARIA at runtime.
- **Screen reader impact:** Injected content may be unlabeled, have broken landmarks or duplicate ids, and the build-time audit cannot see it.
- **Fix:** Sanitize and validate the HTML, or render structured content with components that enforce alt text and labels.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `src-v-html` — v-html injects unverified markup

- **Severity:** info
- **WCAG:** 4.1.2 (level A)
- **Engine:** Component source
- **What it checks:** v-html renders raw HTML that the static audit cannot check for alt text, labels or ARIA.
- **Screen reader impact:** Injected images and controls may be unlabeled.
- **Fix:** Prefer structured templates, or sanitize and test the injected content.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `src-svelte-html` — {@html} injects unverified markup

- **Severity:** info
- **WCAG:** 4.1.2 (level A)
- **Engine:** Component source
- **What it checks:** Svelte {@html} renders raw HTML that the static audit cannot check.
- **Screen reader impact:** Injected images and controls may be unlabeled.
- **Fix:** Prefer normal markup, or sanitize and test the injected content.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `src-dialog-name` — Dialog component has no accessible name

- **Severity:** info
- **WCAG:** 4.1.2 (level A)
- **Engine:** Component source
- **What it checks:** Dialog and Modal components need aria-labelledby or aria-label.
- **Screen reader impact:** The dialog opens with no announced title.
- **Fix:** Pass aria-labelledby="dialog-title" and give the dialog heading that id.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

### `src-role-button-focus` — role="button" is not keyboard focusable

- **Severity:** warning
- **WCAG:** 2.1.1 (level A)
- **Engine:** Component source
- **What it checks:** role="button" on a div/span only works if the element is focusable and handles Enter/Space.
- **Screen reader impact:** The custom button cannot be reached with Tab.
- **Fix:** Add tabIndex={0} and onKeyDown, or use <button>.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html

## structure

### `list-structure` — List contains non-list children

- **Severity:** warning
- **WCAG:** 1.3.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** ul and ol must contain li elements (script and template are allowed). Other children break the list semantics announced by screen readers.
- **Screen reader impact:** Screen readers announce "list with 5 items" but the item count does not match what the user hears.
- **Fix:** Wrap each item in <li>. If the list is only visual, use CSS layout on divs instead of ul/ol.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html

### `table-headers` — Data table has no header cells

- **Severity:** warning
- **WCAG:** 1.3.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** A data table needs th cells (or role="columnheader"/"rowheader") so each cell can be associated with its headers.
- **Screen reader impact:** Screen readers announce cell values without the column or row name. A user hearing "42" does not know whether it is price, quantity or stock.
- **Manual test:** NVDA: focus a cell and press Ctrl+Alt+Arrow keys. NVDA should announce the row and column headers. VoiceOver: open the rotor, choose Tables, then move by row and column and listen for header announcements.
- **Fix:** Add <th scope="col"> for column headers and <th scope="row"> for row headers.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html

### `table-caption` — Table has no caption or accessible name

- **Severity:** info
- **WCAG:** 1.3.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** A caption tells screen reader users what the table is about before they enter it.
- **Screen reader impact:** The table is announced as "table" with no name, so its purpose is unclear in the tables list.
- **Fix:** Add <caption> or aria-label to the table.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html

### `th-scope` — Header cell has no scope

- **Severity:** info
- **WCAG:** 1.3.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** scope tells assistive technology whether a th applies to its column or its row.
- **Screen reader impact:** Complex tables may associate a cell with the wrong header.
- **Fix:** Add scope="col" or scope="row" to each th.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html

### `th-empty` — Header cell is empty

- **Severity:** warning
- **WCAG:** 1.3.1 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** An empty header cell gives nearby data cells no usable label.
- **Screen reader impact:** Cells in that column are announced without a column name.
- **Fix:** Add header text, or use a td with aria-hidden="true" if the cell is purely decorative.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html

## styles

### `css-focus-outline` — Focus outline is removed without a replacement

- **Severity:** warning
- **WCAG:** 2.4.7 (level AA)
- **Engine:** Static HTML/CSS
- **What it checks:** outline: none on :focus removes the only visible focus indicator. Keyboard users cannot see where they are.
- **Screen reader impact:** Screen reader users with partial sight rely on the visual focus ring while using the keyboard. Without it, focus seems to disappear.
- **Manual test:** Press Tab through the page and watch the focused element. It must be obvious at every step. Check focus on links, buttons, form fields and custom widgets against both light and dark backgrounds.
- **Fix:** Keep the outline, or replace it with a clearly visible box-shadow, border or background change that meets 3:1 contrast against the background.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html

### `css-reduced-motion` — Animation ignores prefers-reduced-motion

- **Severity:** info
- **WCAG:** 2.3.3 (level AAA)
- **Engine:** Static HTML/CSS
- **What it checks:** Large or continuous motion can cause dizziness and nausea. The stylesheet defines animation or transitions but no reduced-motion override.
- **Screen reader impact:** Users with vestibular disorders may experience dizziness, and motion can distract from screen reader speech.
- **Fix:** Add @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html

### `css-order` — CSS order changes the visual order

- **Severity:** info
- **WCAG:** 1.3.2 (level A)
- **Engine:** Static HTML/CSS
- **What it checks:** The CSS order property reorders flex and grid items visually while the DOM order, which screen readers follow, stays the same.
- **Screen reader impact:** Screen reader reading order and keyboard focus order diverge from what sighted users see, causing disorientation.
- **Fix:** Place items in the desired order in the DOM and use layout properties only for presentation that does not change reading order.
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html

### `css-contrast` — Estimated text contrast is below WCAG AA

- **Severity:** warning
- **WCAG:** 1.4.3 (level AA)
- **Engine:** Static HTML/CSS
- **What it checks:** The static stylesheet estimate resolves the text and background colours. Gradients, images, opacity and media queries can change the real result, so verify in the browser.
- **Screen reader impact:** Low-vision users, including many screen reader users with partial sight, cannot read the text even with magnification.
- **Manual test:** Use the browser accessibility inspector or a contrast picker on the rendered page to confirm the ratio. Test the same component in light mode, dark mode and high-contrast mode.
- **Fix:** Raise the contrast to at least 4.5:1 for normal text and 3:1 for large text (18.66px bold or 24px).
- **Reference:** https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
