import {
  accessibleName,
  attr,
  findAll,
  getExplicitRole,
  getRole,
  hasAttr,
  isHiddenFromAT,
  isInteractiveRole,
  tagName,
  textContent,
} from '../core/html.js';
import { finding, isVisible, visibleElements } from './helpers.js';

const FILE_NAME_ALT = /\.(png|jpe?g|gif|svg|webp|avif|bmp|ico)$/i;
const PLACEHOLDER_ALT = /^(img|image|photo|picture|screenshot|graphic|untitled|resim|fotoğraf|görsel)[-_]?\d*$/i;
const REDUNDANT_ALT = /^(image|picture|photo|graphic|icon|resim|fotoğraf|görsel)\s+(of|of a|of an|showing)?\s*/i;

export const imageRules = [
  {
    id: 'img-alt',
    title: 'Image is missing alternative text',
    category: 'images',
    severity: 'error',
    wcag: ['1.1.1'],
    level: 'A',
    tags: ['static', 'images'],
    description:
      'Every <img> needs an alt attribute. Informative images need a description; decorative images need alt="" (and no link around them).',
    help: 'Add alt="description" for informative images. Add alt="" for decorative images. Never omit alt.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    srImpact:
      'NVDA and JAWS announce the file name or "graphic" with no description. VoiceOver may skip the image entirely. The information is unavailable to blind users.',
    manual: [
      'NVDA: press G in browse mode to move between graphics and listen to each name.',
      'VoiceOver: use the rotor (VO+U) and open Images; every entry should have a meaningful label or be hidden.',
    ],
    check(ctx) {
      return visibleElements(ctx.doc, ctx, (el) => tagName(el) === 'img' && !isDecorativeImage(el) && !isInSvg(el))
        .filter((img) => {
          if (hasAttr(img, 'alt')) return false;
          const source = accessibleName(img, ctx).source;
          return source !== 'aria-label' && source !== 'aria-labelledby' && source !== 'alt';
        })
        .map((img) =>
          finding(img, 'This image has no alt attribute. Screen readers cannot describe it.'),
        );
    },
  },
  {
    id: 'img-alt-filename',
    title: 'Image alt text looks like a file name',
    category: 'images',
    severity: 'warning',
    wcag: ['1.1.1'],
    level: 'A',
    tags: ['static', 'images'],
    description: 'File names such as hero-2.jpg or IMG_1234 provide no meaning to a screen reader user.',
    help: 'Describe what the image shows or why it is there. Use alt="" if it is decorative.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    srImpact: 'Screen readers read "IMG underscore 1234 dot jpeg" instead of useful information.',
    check(ctx) {
      return visibleElements(ctx.doc, ctx, (el) => tagName(el) === 'img')
        .map((img) => ({ img, alt: (attr(img, 'alt') || '').trim() }))
        .filter(({ alt }) => alt && (FILE_NAME_ALT.test(alt) || PLACEHOLDER_ALT.test(alt)))
        .map(({ img, alt }) => finding(img, `The alt text "${alt}" is a file name or placeholder, not a description.`));
    },
  },
  {
    id: 'img-alt-redundant',
    title: 'Image alt text starts with "image of"',
    category: 'images',
    severity: 'info',
    wcag: ['1.1.1'],
    level: 'A',
    tags: ['static', 'images'],
    description: 'Screen readers already announce "image"; alt text should describe the content, not the medium.',
    help: 'Write alt="A red bicycle leaning on a wall" instead of "Image of a red bicycle".',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    srImpact: 'NVDA and JAWS announce "image, image of a red bicycle", repeating the role.',
    check(ctx) {
      return visibleElements(ctx.doc, ctx, (el) => tagName(el) === 'img')
        .map((img) => ({ img, alt: (attr(img, 'alt') || '').trim() }))
        .filter(({ alt }) => alt && (REDUNDANT_ALT.test(alt) || /^(image|photo|graphic|picture)$/i.test(alt)))
        .map(({ img, alt }) => finding(img, `The alt text "${alt}" begins with the image role.`));
    },
  },
  {
    id: 'svg-name',
    title: 'Inline SVG has no accessible name',
    category: 'images',
    severity: 'warning',
    wcag: ['1.1.1'],
    level: 'A',
    tags: ['static', 'images'],
    description:
      'Informative inline SVGs need role="img" plus <title> or aria-label. Decorative SVGs should be hidden with aria-hidden="true" and focusable="false".',
    help: 'Add <title> as the first child and role="img", or add aria-hidden="true" for decoration.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    srImpact:
      'An unnamed SVG can appear as an unlabeled graphic in the accessibility tree, or be skipped completely. Either way its meaning is lost.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        if (tagName(el) !== 'svg') return false;
        if (!isVisible(el, ctx)) return false;
        if (attr(el, 'aria-hidden') === 'true') return false;
        if (['presentation', 'none'].includes((attr(el, 'role') || '').toLowerCase())) return false;
        if (attr(el, 'aria-label')?.trim() || attr(el, 'aria-labelledby')?.trim()) return false;
        const title = findAll(el, (child) => tagName(child) === 'title')[0];
        if (title && textContent(title)) return false;
        return true;
      }).map((svg) =>
        finding(svg, 'This inline SVG is exposed to screen readers but has no name. Hide it or label it.'),
      );
    },
  },
  {
    id: 'button-name',
    title: 'Button has no accessible name',
    category: 'images',
    severity: 'error',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'forms'],
    description:
      'Every button needs text, alt text on its image, or aria-label. Icon-only buttons are the most common failure.',
    help: 'Add visible text, aria-label="Close", or alt text on the icon image. Do not rely on title.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'Screen readers announce "button" with no name. Voice control users cannot target it by name either.',
    manual: [
      'NVDA: press B to jump between buttons; each should be announced with a purpose.',
      'VoiceOver: open the rotor, choose Buttons and check every label.',
    ],
    check(ctx) {
      return visibleElements(ctx.doc, ctx, (el) => {
        if (tagName(el) === 'input') return false;
        const role = getRole(el);
        return role === 'button' && !isDecorativeImage(el);
      })
        .filter((button) => !accessibleName(button, ctx).name)
        .map((button) => finding(button, 'This button has no accessible name. Add text or aria-label.'));
    },
  },
  {
    id: 'role-img-name',
    title: 'Element with role="img" has no accessible name',
    category: 'images',
    severity: 'error',
    wcag: ['1.1.1'],
    level: 'A',
    tags: ['static', 'images'],
    description:
      'role="img" turns an element into a single image node. Its content is not used as the name, so it needs aria-label or aria-labelledby.',
    help: 'Add aria-label="Chart: sales by quarter" or aria-labelledby pointing to a visible caption.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    srImpact: 'The image is announced as a graphic with no description, and its internal text is not read separately.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        if (tagName(el) === 'svg') return false;
        return getRole(el) === 'img' && (attr(el, 'role') || '').toLowerCase().includes('img') && !isDecorativeImage(el);
      })
        .filter((el) => !accessibleName(el, ctx).name)
        .map((el) => finding(el, 'This element has role="img" but no accessible name.'));
    },
  },
  {
    id: 'role-widget-name',
    title: 'Custom ARIA widget has no accessible name',
    category: 'aria',
    severity: 'error',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'aria'],
    description:
      'A non-native element with an interactive ARIA role needs a name from aria-label, aria-labelledby or its content (for roles that allow name from content).',
    help: 'Add a visible label, aria-label or aria-labelledby. Native HTML controls are checked by the form rules instead.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'The widget is announced with its role but no name, so the user does not know what it does.',
    check(ctx) {
      return findAll(ctx.doc, (el) => {
        if (['a', 'button', 'input', 'select', 'textarea', 'summary'].includes(tagName(el))) return false;
        const role = getExplicitRole(el);
        if (['button', 'link'].includes(role)) return false;
        return role && isInteractiveRole(role) && isVisible(el, ctx) && attr(el, 'aria-hidden') !== 'true';
      })
        .filter((el) => !accessibleName(el, ctx).name)
        .map((el) => finding(el, `role="${getExplicitRole(el)}" has no accessible name.`));
    },
  },
  {
    id: 'input-image-alt',
    title: 'Image submit button has no alt text',
    category: 'images',
    severity: 'error',
    wcag: ['1.1.1', '4.1.2'],
    level: 'A',
    tags: ['static', 'forms'],
    description: 'input type="image" needs alt text; the image is the button label.',
    help: 'Add alt="Search" (or the action name) to the input.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    srImpact: 'Screen readers announce "button" with no name, or read the image file name.',
    check(ctx) {
      return findAll(ctx.doc, (el) => tagName(el) === 'input' && (attr(el, 'type') || '').toLowerCase() === 'image')
        .filter((el) => !attr(el, 'alt')?.trim() && !attr(el, 'aria-label')?.trim() && !attr(el, 'aria-labelledby')?.trim())
        .map((el) => finding(el, 'This image submit button has no alt text.'));
    },
  },
  {
    id: 'area-alt',
    title: 'Image map area has no alt text',
    category: 'images',
    severity: 'error',
    wcag: ['1.1.1'],
    level: 'A',
    tags: ['static', 'images'],
    description: 'Each clickable <area> needs alt text describing its destination.',
    help: 'Add alt="..." (or aria-label) to every area with href.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    srImpact: 'The area is announced as an unnamed link.',
    check(ctx) {
      return findAll(ctx.doc, (el) => tagName(el) === 'area' && hasAttr(el, 'href'))
        .filter((el) => !attr(el, 'alt')?.trim() && !attr(el, 'aria-label')?.trim() && !attr(el, 'aria-labelledby')?.trim())
        .map((el) => finding(el, 'This image map area has no alt text.'));
    },
  },
  {
    id: 'object-name',
    title: 'Embedded object has no title',
    category: 'images',
    severity: 'warning',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'images'],
    description: '<object> and <embed> need a title or aria-label so users know what the embedded content is.',
    help: 'Add title="Annual report (PDF)" or aria-label to the object.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact: 'Screen readers announce "embedded object" with no description.',
    check(ctx) {
      return findAll(ctx.doc, (el) => ['object', 'embed'].includes(tagName(el)))
        .filter((el) => !accessibleName(el, ctx).name)
        .map((el) => finding(el, `This <${tagName(el)}> has no title or aria-label.`));
    },
  },
  {
    id: 'iframe-title',
    title: 'Iframe has no title',
    category: 'images',
    severity: 'error',
    wcag: ['4.1.2'],
    level: 'A',
    tags: ['static', 'images'],
    description: 'Frames need a title that describes their content, for example "Video: product tour".',
    help: 'Add a unique title attribute (or aria-label) to each iframe.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    srImpact:
      'Screen readers list frames as "frame" with no name. Users cannot decide whether to enter the frame, and may miss embedded video or forms.',
    manual: [
      'NVDA: press M or open the elements list and inspect the Frames tab.',
      'VoiceOver: use the rotor to list frames and check every title.',
    ],
    check(ctx) {
      return findAll(ctx.doc, (el) => tagName(el) === 'iframe')
        .filter((el) => !attr(el, 'title')?.trim() && !attr(el, 'aria-label')?.trim() && !attr(el, 'aria-labelledby')?.trim())
        .map((el) => finding(el, 'This iframe has no title. Screen readers cannot describe the embedded content.'));
    },
  },
  {
    id: 'video-captions',
    title: 'Video has no captions track',
    category: 'media',
    severity: 'warning',
    wcag: ['1.2.2'],
    level: 'A',
    tags: ['static', 'media'],
    description:
      'Prerecorded video with audio needs synchronized captions. Without a <track kind="captions"> there is no caption source in the markup.',
    help: 'Add <track kind="captions" src="captions.vtt" srclang="en" label="English">.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html',
    srImpact:
      'Deaf and hard-of-hearing users, including many screen reader users, get no access to dialogue and meaningful sounds.',
    check(ctx) {
      return findAll(ctx.doc, (el) => tagName(el) === 'video')
        .filter((video) => hasAttr(video, 'src') || findAll(video, (child) => tagName(child) === 'source').length > 0)
        .filter((video) => {
          const tracks = findAll(video, (child) => tagName(child) === 'track');
          return !tracks.some((track) => ['captions', 'subtitles'].includes((attr(track, 'kind') || 'subtitles').toLowerCase()));
        })
        .map((video) => finding(video, 'This video has no captions or subtitles track in the markup.'));
    },
  },
  {
    id: 'audio-transcript',
    title: 'Audio has no nearby transcript',
    category: 'media',
    severity: 'info',
    wcag: ['1.2.1'],
    level: 'A',
    tags: ['static', 'media'],
    description: 'Prerecorded audio needs a transcript. The tool checks for a transcript link near the player.',
    help: 'Add a link to a transcript immediately before or after the audio element.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded.html',
    srImpact: 'Deaf users and people in noisy environments cannot access the audio content.',
    check(ctx) {
      return findAll(ctx.doc, (el) => tagName(el) === 'audio')
        .filter((audio) => hasAttr(audio, 'src') || findAll(audio, (child) => tagName(child) === 'source').length > 0)
        .filter((audio) => !hasNearbyTranscript(audio, ctx))
        .map((audio) => finding(audio, 'No transcript link was found near this audio player.'));
    },
  },
  {
    id: 'media-autoplay',
    title: 'Media autoplays with sound',
    category: 'media',
    severity: 'warning',
    wcag: ['1.4.2'],
    level: 'A',
    tags: ['static', 'media'],
    description: 'Audio that autoplays and is not muted interferes with screen reader speech.',
    help: 'Remove autoplay or add muted. If audio must autoplay, provide a visible pause control.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html',
    srImpact:
      'Screen reader speech and page audio play at the same time. The user cannot hear the page and may not find the pause button.',
    check(ctx) {
      return findAll(ctx.doc, (el) => ['audio', 'video'].includes(tagName(el)))
        .filter((el) => hasAttr(el, 'autoplay') && !hasAttr(el, 'muted'))
        .map((el) => finding(el, `This <${tagName(el)}> autoplays with sound.`));
    },
  },
  {
    id: 'media-controls',
    title: 'Media player has no controls',
    category: 'media',
    severity: 'info',
    wcag: ['2.1.1'],
    level: 'A',
    tags: ['static', 'media'],
    description: 'A video or audio element without controls cannot be operated by keyboard unless custom controls are provided.',
    help: 'Add the controls attribute, or provide fully keyboard-accessible custom controls.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    srImpact: 'Keyboard and screen reader users cannot play, pause or seek the media.',
    check(ctx) {
      return findAll(ctx.doc, (el) => ['audio', 'video'].includes(tagName(el)))
        .filter((el) => !hasAttr(el, 'controls') && !isHiddenFromAT(el))
        .map((el) => finding(el, `This <${tagName(el)}> has no controls attribute.`));
    },
  },
  {
    id: 'marquee-blink',
    title: 'Obsolete moving or blinking element',
    category: 'media',
    severity: 'error',
    wcag: ['2.2.2', '2.3.1'],
    level: 'A',
    tags: ['static', 'media'],
    description: '<marquee> and <blink> move content continuously. Users cannot pause or stop it, and it can trigger vestibular symptoms.',
    help: 'Remove the element. If animation is essential, use CSS animation with a pause control and prefers-reduced-motion support.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html',
    srImpact: 'Moving text is hard to read with magnification and stressful for users with vestibular disorders.',
    check(ctx) {
      return findAll(ctx.doc, (el) => ['marquee', 'blink'].includes(tagName(el))).map((el) =>
        finding(el, `<${tagName(el)}> moves content without a pause control.`),
      );
    },
  },
];

function isDecorativeImage(img) {
  if (attr(img, 'aria-hidden') === 'true') return true;
  const role = (attr(img, 'role') || '').toLowerCase();
  if (role === 'presentation' || role === 'none') return true;
  return false;
}

function isInSvg(img) {
  let current = img.parentNode;
  while (current) {
    if (tagName(current) === 'svg') return true;
    current = current.parentNode;
  }
  return false;
}

function hasNearbyTranscript(audio, ctx) {
  const describedBy = attr(audio, 'aria-describedby');
  if (describedBy) {
    const text = describedBy
      .split(/\s+/)
      .map((id) => ctx.byId.get(id))
      .filter(Boolean)
      .map((el) => textContent(el))
      .join(' ');
    if (/transcript|deşifre|metin/i.test(text)) return true;
  }
  let scope = audio.parentNode;
  for (let depth = 0; depth < 3 && scope; depth += 1) {
    const links = findAll(scope, (el) => ['a', 'button'].includes(tagName(el)));
    if (links.some((link) => /transcript|deşifre|metin|altyazı/i.test(`${textContent(link)} ${attr(link, 'href') || ''}`))) {
      return true;
    }
    scope = scope.parentNode;
  }
  return false;
}
