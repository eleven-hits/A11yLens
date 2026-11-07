# Screen reader testing guide

A11yLens can find a missing accessible name. Only a screen reader can tell you whether the name makes sense, whether it is announced at the right moment, and whether the page is usable without sight.

This guide is the long form of `a11ylens manual`.

## Choose the pairs your users use

| Platform | Screen reader | Browser | Priority |
| --- | --- | --- | --- |
| Windows | NVDA | Chrome or Firefox | Highest: free, widely used, good standards support |
| Windows | JAWS | Chrome or Edge | Highest for enterprise and government audiences |
| macOS | VoiceOver | Safari | Highest on Apple platforms |
| iOS | VoiceOver | Safari | Required for mobile |
| Android | TalkBack | Chrome | Required for mobile |
| Windows | Narrator | Edge | Useful extra check for Windows 11 users |

A page can pass in NVDA and fail in VoiceOver. Test at least one Windows pair, one Apple pair and one mobile pair. Record the exact versions in the report.

## Set up the test

1. Build or start the site exactly as production: same bundle, same CSS, same API. A development build can hide focus styles and lazy-loaded content.
2. Turn on the screen reader before opening the page.
3. Learn the focus indicator: NVDA Settings > Vision > Visual Highlight, VoiceOver `VO+U` and the focus ring, TalkBack focus highlight.
4. Disable the mouse. Every task must be completable with the keyboard alone.
5. Keep the browser's accessibility inspector open if you need to compare the announced name with the computed one.

## Key reference

### NVDA (Windows)

| Keys | Action |
| --- | --- |
| `H` / `Shift+H` | Next / previous heading |
| `1`–`6` | Next heading of that level |
| `D` | Next landmark |
| `K` | Next link |
| `B` | Next button |
| `F` | Next form field |
| `G` | Next graphic |
| `T` | Next table |
| `Ctrl+Alt+Arrow` | Move inside a table |
| `Insert+F7` | Elements list (links, headings, landmarks) |
| `NVDA+Space` | Toggle browse / focus mode |
| NVDA Settings → Vision → Visual Highlight | Visual focus tracking |
| `Insert+Down Arrow` | Read from the current position |

### JAWS (Windows)

| Keys | Action |
| --- | --- |
| `H` | Next heading |
| `R` | Next region / landmark |
| `B` | Next button |
| `F` | Next form field |
| `G` | Next graphic |
| `T` | Next table |
| `Insert+F5` | Form fields list |
| `Insert+F6` | Headings list |
| `Insert+F7` | Links list |
| `Insert+Z` | Toggle virtual cursor |
| `Insert+Down Arrow` | Say all |

### VoiceOver (macOS)

| Keys | Action |
| --- | --- |
| `VO+U` | Rotor: headings, links, forms, landmarks, images |
| `VO+Command+H` | Next heading |
| `VO+Command+L` | Next link |
| `VO+Command+J` | Next form control |
| `VO+Command+G` | Next graphic |
| `VO+Shift+Down` | Interact with a group |
| `VO+Shift+Up` | Stop interacting |
| `VO+Space` | Activate |
| `VO+A` | Read all |
| `VO+Right` / `VO+Left` | Move through the accessibility tree |

`VO` means Control+Option.

### TalkBack (Android)

| Gesture | Action |
| --- | --- |
| Swipe right / left | Next / previous element |
| Swipe down then right | Next heading (reading controls) |
| Double tap | Activate |
| Swipe up then right | Change granularity |
| Three-finger swipe | Scroll |
| Local context menu | Headings, links, controls, landmarks |

## The protocol

### 1. Page load announcement

Load the page and listen **before** touching anything.

- Is the document title announced and meaningful?
- Is the language correct? If the voice switches to English mid-sentence on a Turkish page, the `lang` attribute is wrong or missing.
- Is the page announced as "loading" and never finishes? That is a live-region or focus-management bug.

### 2. Heading outline

Open the headings list and read only the outline.

- Does the outline describe the page without the body text?
- Are levels sequential (h1 → h2 → h3)?
- Are there empty headings or headings used only to make text big?
- Does the h1 match the page purpose?

### 3. Landmarks and skip link

Reload, press `Tab` once and activate the first focusable element. Then use landmark navigation.

- Does the skip link appear on focus, and does activating it move **focus** into main, not just scroll?
- Are there one `main`, one `banner` and one `contentinfo`?
- Do multiple `navigation` landmarks have distinct names ("Primary", "Breadcrumb", "Footer")?
- Is any content outside landmarks, forcing the user to tab through it?

### 4. Linear reading order

Use read-all and listen without skipping.

- Does the order match the visual order?
- Are desktop and mobile versions of the same menu both read?
- Are decorative images, icon fonts and duplicate logos silent?
- Do CSS `order`, `row-reverse` or absolute positioning change the spoken order?
- Is hidden text (`display:none`, `aria-hidden`) really silent?

### 5. Keyboard walkthrough

Switch to focus mode and press `Tab` through every control.

- Does focus visibly appear at every step?
- Is the order logical (header → nav → main → form → footer)?
- Does focus ever disappear (an element the screen reader does not announce)?
- Is there a keyboard trap (cannot leave a widget with Tab/Shift+Tab)?
- Can every action be performed with Enter or Space, not only with a mouse click?
- Does the focus ring remain visible against every background?

### 6. Forms

Submit empty, then with invalid data, then correct it with the keyboard.

- Is each field announced with its label, type, required state and help text?
- Is the placeholder read as a name? It should not be the only label.
- Is the error announced immediately, and is it associated with the field (`aria-describedby` or `aria-errormessage`)?
- Does focus move to the first error, or to the success message?
- Are radio and checkbox groups announced with the group question (`fieldset`/`legend` or labeled `radiogroup`)?
- Is autocomplete available for name, email, phone, address and password fields?

### 7. Images and icons

Use the graphics list and the links/buttons lists.

- Does each meaningful image have a description that adds information?
- Are decorative images absent from the graphics list?
- Do icon-only buttons have names ("Close", "Search", "Add to cart")?
- Does alt text start with "image of" and repeat the role?
- Are complex images (charts, diagrams) described in nearby text?

### 8. Dynamic content

Trigger search suggestions, filters, toasts, modals and infinite scroll without the mouse.

- Is new content announced exactly once?
- Is a loading state announced?
- Does a modal receive focus, trap it while open, and return focus to the trigger on close?
- Is background content hidden from the screen reader while the modal is open (`inert` or `aria-hidden` plus focus management)?
- Is a toast announced without stealing focus?
- Does infinite scroll move focus unexpectedly?

### 9. Tables

Navigate with `Ctrl+Alt+Arrow` (NVDA/JAWS).

- Does each cell announce both the row and column header?
- Is the table announced as a table with a caption?
- Are layout tables hidden from the accessibility tree?

### 10. Zoom and reflow

Set browser zoom to 200% and 400%, then use a 320 CSS px viewport.

- Is text clipped or overlapping?
- Does vertical content require horizontal scrolling?
- Is focus hidden behind sticky headers, cookie bars or chat widgets?
- Does the mobile layout preserve the reading order?

### 11. Cognitive and motor support (WCAG 2.2)

Re-enter the same information in a second step, solve the login or checkout with a password manager, and try every drag interaction with the keyboard.

- Is previously entered data prefilled or selectable (redundant entry)?
- Can you paste into password and verification-code fields, and does a password manager work (accessible authentication)?
- Does every drag action have a single-pointer or keyboard alternative (dragging movements)?
- Is help in the same place on every page (consistent help)?

## What to record

For each issue:

```text
Screen reader: NVDA 2025.1
Browser: Chrome 141
Page: /checkout
Steps: Tab to the "Apply" button, press Enter
Expected: "Apply coupon, button"
Actual: "button" with no name
Severity: blocks applying a coupon
Screenshot / recording: link
```

The report from `a11ylens manual . --findings` gives you the expected behaviour for each rule. Attach the actual announcement and the steps.

## Common false assumptions

- **"It works with NVDA, so it works."** VoiceOver and TalkBack follow the accessibility tree differently, especially for custom widgets and overlays.
- **"The DOM order is fine, so the reading order is fine."** CSS can reorder content visually and leave the DOM order unchanged.
- **"aria-label fixes it."** A label on the wrong role, or an empty label, can make things worse. Label the control, not the wrapper.
- **"The screen reader reads the placeholder, so the field is labeled."** Placeholders disappear on input and are not reliable names.
- **"Automated testing is enough."** It is not. A11yLens reports what can be measured; the protocol covers what cannot.
