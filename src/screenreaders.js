export const SCREEN_READERS = [
  {
    id: 'nvda',
    name: 'NVDA',
    platform: 'Windows',
    cost: 'Free and open source',
    url: 'https://www.nvaccess.org/download/',
    setup: [
      'Install NVDA and start it with Ctrl+Alt+N.',
      'Use a Chromium browser (Chrome or Edge) with the default browse mode.',
      'Turn on speech viewer (NVDA menu > Tools > Speech Viewer) to read exactly what is announced.',
    ],
    commands: [
      ['H / Shift+H', 'next / previous heading'],
      ['1-6', 'next heading of that level'],
      ['D', 'next landmark'],
      ['K', 'next link'],
      ['B', 'next button'],
      ['F', 'next form field'],
      ['G', 'next graphic'],
      ['T', 'next table'],
      ['Ctrl+Alt+Arrow', 'move inside a table'],
      ['Insert+F7', 'elements list (links, headings, landmarks)'],
      ['NVDA+Space', 'toggle browse / focus mode'],
      ['NVDA Settings → Vision → Visual Highlight', 'visual focus tracking'],
      ['Insert+Q', 'quit NVDA'],
    ],
    focus:
      'Tab moves focus, browse mode moves the virtual cursor. Test both: a control must be reachable with Tab and announced with the same name in browse mode.',
  },
  {
    id: 'jaws',
    name: 'JAWS',
    platform: 'Windows',
    cost: 'Commercial (40-minute demo mode)',
    url: 'https://www.freedomscientific.com/products/software/jaws/',
    setup: [
      'Start JAWS, then open Chrome or Edge.',
      'Use the JAWS speech history (Insert+Space, H) to review what was announced.',
      'Set the browser to the standard virtual cursor mode.',
    ],
    commands: [
      ['H', 'next heading'],
      ['R', 'next region / landmark'],
      ['B', 'next button'],
      ['F', 'next form field'],
      ['G', 'next graphic'],
      ['T', 'next table'],
      ['Ctrl+Alt+Arrow', 'navigate table cells'],
      ['Insert+F5', 'form fields list'],
      ['Insert+F6', 'heading list'],
      ['Insert+F7', 'links list'],
      ['Insert+Z', 'toggle virtual cursor'],
    ],
    focus:
      'JAWS has separate virtual cursor and PC cursor concepts. Confirm the control works in both, especially custom widgets built with ARIA.',
  },
  {
    id: 'voiceover',
    name: 'VoiceOver',
    platform: 'macOS',
    cost: 'Built into macOS',
    url: 'https://support.apple.com/guide/voiceover/welcome/mac',
    setup: [
      'Enable VoiceOver with Command+F5 (or Touch ID triple-click if configured).',
      'Use Safari first: it has the closest VoiceOver integration.',
      'Open the rotor with Control+Option+U.',
    ],
    commands: [
      ['VO+U', 'rotor: headings, links, forms, landmarks, images'],
      ['VO+Command+H', 'next heading'],
      ['VO+Command+L', 'next link'],
      ['VO+Command+J', 'next form control'],
      ['VO+Command+G', 'next graphic'],
      ['VO+Shift+Down', 'interact with a group'],
      ['VO+Shift+Up', 'stop interacting'],
      ['VO+Space', 'activate the focused item'],
      ['VO+Right / VO+Left', 'move through the accessibility tree'],
      ['VO+U → Landmarks', 'jump between landmarks from the rotor'],
    ],
    focus:
      'VoiceOver follows the accessibility tree rather than the DOM. If an element is missing from the rotor or the group navigation, it is not properly exposed.',
  },
  {
    id: 'talkback',
    name: 'TalkBack',
    platform: 'Android',
    cost: 'Built into Android',
    url: 'https://support.google.com/accessibility/android/answer/6283677',
    setup: [
      'Settings > Accessibility > TalkBack > On.',
      'Use Chrome for Android and enable the TalkBack focus indicator.',
      'Test touch exploration and swipe navigation separately.',
    ],
    commands: [
      ['Swipe right / left', 'next / previous element'],
      ['Swipe down then right', 'next heading (reading controls)'],
      ['Double tap', 'activate'],
      ['Swipe up then right', 'change reading granularity'],
      ['3-finger swipe', 'scroll'],
      ['Local context menu', 'headings, links, controls, landmarks'],
    ],
    focus:
      'Mobile screen readers use a linear focus order. Overlays that visually cover content but stay in the DOM are a common source of invisible focus stops.',
  },
];

export const MANUAL_PROTOCOL = [
  {
    id: 'load',
    title: 'Page load announcement',
    detail:
      'Load the page with the screen reader running. It should announce the document title and the page language should match the content.',
    pass: 'Title is meaningful and the voice does not switch to the wrong language.',
  },
  {
    id: 'headings',
    title: 'Heading outline',
    detail:
      'Open the headings list (NVDA Insert+F7, JAWS Insert+F6, VoiceOver rotor). Read the outline without looking at the page.',
    pass: 'The outline alone explains the page structure. No empty headings or skipped levels.',
  },
  {
    id: 'landmarks',
    title: 'Landmarks and skip link',
    detail:
      'Reload the page and press Tab once. Activate the skip link. Then open the landmark list and jump between regions.',
    pass: 'Focus moves into the main content, not just the viewport. Each landmark has a distinct name.',
  },
  {
    id: 'reading',
    title: 'Linear reading order',
    detail:
      'Press the read-all command (NVDA Insert+Down Arrow, JAWS Insert+Down Arrow, VoiceOver VO+A). Listen without skipping.',
    pass: 'The reading order matches the visual order. Decorative images, icons and duplicated mobile/desktop markup are not read twice.',
  },
  {
    id: 'keyboard',
    title: 'Keyboard-only walkthrough',
    detail:
      'Put the screen reader in focus mode (NVDA+Space) and press Tab through every control. Watch the focus ring and listen to each announcement.',
    pass: 'Every interactive element is reachable, has a visible focus indicator and is announced with role, name and state.',
  },
  {
    id: 'forms',
    title: 'Forms and errors',
    detail:
      'Submit the form empty, then with invalid data. Correct the errors with the keyboard only.',
    pass: 'Labels are announced, required state is known, errors are announced immediately and focus moves to the first error.',
  },
  {
    id: 'images',
    title: 'Images and icons',
    detail:
      'Use the graphics list (NVDA G, JAWS G, VoiceOver rotor Images) and the links/buttons lists.',
    pass: 'Meaningful images have descriptive names. Decorative images are silent. Icon-only buttons have names.',
  },
  {
    id: 'dynamic',
    title: 'Dynamic content and live regions',
    detail:
      'Trigger search suggestions, filters, toasts, modals and infinite scroll. Do not touch the mouse.',
    pass: 'New content is announced once, focus is managed into and out of dialogs, and background content is not focusable while a modal is open.',
  },
  {
    id: 'tables',
    title: 'Tables',
    detail:
      'Navigate a data table with Ctrl+Alt+Arrow. Check the row and column header announcement on every cell.',
    pass: 'Each cell is announced with both headers. Table lists show a meaningful caption.',
  },
  {
    id: 'zoom',
    title: 'Zoom and reflow',
    detail:
      'Set browser zoom to 200% and 400%, then use a 320 CSS px wide viewport.',
    pass: 'No content is clipped, no horizontal scrolling for vertical content, and focus is never hidden behind sticky headers or chat widgets.',
  },
  {
    id: 'cognitive',
    title: 'Cognitive and motor support (WCAG 2.2)',
    detail:
      'Re-enter the same information in a second step, solve the login or checkout with a password manager, and try every drag interaction with the keyboard.',
    pass: 'Previously entered data is prefilled or selectable, paste and password managers work, dragging has a single-pointer alternative, and help is in the same place on every page.',
  },
];

export const AUTOMATION_LIMITS = [
  'Automated checks catch only part of WCAG. They are good at missing names, alt text, labels, contrast and invalid ARIA; they cannot judge whether an announcement makes sense.',
  'Static analysis reads the source. Components rendered at runtime, content behind a login and data from an API are only visible to the rendered scan (--render).',
  'The screen reader experience depends on the browser and screen reader pair. Always repeat the manual protocol with the combinations your users actually use.',
  'A clean report is not a conformance claim. It means the machine-checkable subset passed.',
];
