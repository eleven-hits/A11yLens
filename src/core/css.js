import { isElement, tagName, attr, parentElement } from './html.js';
import { lineColFromOffset, normalizeWhitespace } from '../util.js';

const NAMED_COLORS = {
  transparent: [0, 0, 0, 0],
  black: [0, 0, 0, 1],
  white: [255, 255, 255, 1],
  red: [255, 0, 0, 1],
  green: [0, 128, 0, 1],
  blue: [0, 0, 255, 1],
  yellow: [255, 255, 0, 1],
  orange: [255, 165, 0, 1],
  purple: [128, 0, 128, 1],
  gray: [128, 128, 128, 1],
  grey: [128, 128, 128, 1],
  silver: [192, 192, 192, 1],
  maroon: [128, 0, 0, 1],
  navy: [0, 0, 128, 1],
  teal: [0, 128, 128, 1],
  olive: [128, 128, 0, 1],
  lime: [0, 255, 0, 1],
  aqua: [0, 255, 255, 1],
  cyan: [0, 255, 255, 1],
  fuchsia: [255, 0, 255, 1],
  magenta: [255, 0, 255, 1],
  pink: [255, 192, 203, 1],
  brown: [165, 42, 42, 1],
  gold: [255, 215, 0, 1],
  indigo: [75, 0, 130, 1],
  violet: [238, 130, 238, 1],
  beige: [245, 245, 220, 1],
  ivory: [255, 255, 240, 1],
  khaki: [240, 230, 140, 1],
  coral: [255, 127, 80, 1],
  salmon: [250, 128, 114, 1],
  crimson: [220, 20, 60, 1],
  darkgray: [169, 169, 169, 1],
  darkgrey: [169, 169, 169, 1],
  lightgray: [211, 211, 211, 1],
  lightgrey: [211, 211, 211, 1],
  dimgray: [105, 105, 105, 1],
  dimgrey: [105, 105, 105, 1],
  whitesmoke: [245, 245, 245, 1],
  gainsboro: [220, 220, 220, 1],
  slategray: [112, 128, 144, 1],
  midnightblue: [25, 25, 112, 1],
  royalblue: [65, 105, 225, 1],
  steelblue: [70, 130, 180, 1],
  dodgerblue: [30, 144, 255, 1],
  skyblue: [135, 206, 235, 1],
  tomato: [255, 99, 71, 1],
  chocolate: [210, 105, 30, 1],
  peru: [205, 133, 63, 1],
  tan: [210, 180, 140, 1],
  wheat: [245, 222, 179, 1],
  plum: [221, 160, 221, 1],
  orchid: [218, 112, 214, 1],
  lavender: [230, 230, 250, 1],
  aliceblue: [240, 248, 255, 1],
  ghostwhite: [248, 248, 255, 1],
  honeydew: [240, 255, 240, 1],
  mintcream: [245, 255, 250, 1],
  azure: [240, 255, 255, 1],
  linen: [250, 240, 230, 1],
  snow: [255, 250, 250, 1],
  seashell: [255, 245, 238, 1],
  oldlace: [253, 245, 230, 1],
  floralwhite: [255, 250, 240, 1],
  cornsilk: [255, 248, 220, 1],
  lemonchiffon: [255, 250, 205, 1],
  lightyellow: [255, 255, 224, 1],
  bisque: [255, 228, 196, 1],
  moccasin: [255, 228, 181, 1],
  navajowhite: [255, 222, 173, 1],
  peachpuff: [255, 218, 185, 1],
  mistyrose: [255, 228, 225, 1],
  lightpink: [255, 182, 193, 1],
  hotpink: [255, 105, 180, 1],
  deeppink: [255, 20, 147, 1],
  darkred: [139, 0, 0, 1],
  firebrick: [178, 34, 34, 1],
  darkgreen: [0, 100, 0, 1],
  forestgreen: [34, 139, 34, 1],
  seagreen: [46, 139, 87, 1],
  mediumseagreen: [60, 179, 113, 1],
  springgreen: [0, 255, 127, 1],
  darkblue: [0, 0, 139, 1],
  mediumblue: [0, 0, 205, 1],
  slateblue: [106, 90, 205, 1],
  darkviolet: [148, 0, 211, 1],
  darkorchid: [153, 50, 204, 1],
  darkmagenta: [139, 0, 139, 1],
  darkorange: [255, 140, 0, 1],
  goldenrod: [218, 165, 32, 1],
  darkgoldenrod: [184, 134, 11, 1],
  saddlebrown: [139, 69, 19, 1],
  sienna: [160, 82, 45, 1],
  darkkhaki: [189, 183, 107, 1],
  lightcoral: [240, 128, 128, 1],
  indianred: [205, 92, 92, 1],
  rosybrown: [188, 143, 143, 1],
  thistle: [216, 191, 216, 1],
  mediumpurple: [147, 112, 219, 1],
  cadetblue: [95, 158, 160, 1],
  darkcyan: [0, 139, 139, 1],
  lightseagreen: [32, 178, 170, 1],
  turquoise: [64, 224, 208, 1],
  mediumturquoise: [72, 209, 204, 1],
  powderblue: [176, 224, 230, 1],
  lightblue: [173, 216, 230, 1],
  lightsteelblue: [176, 196, 222, 1],
  cornflowerblue: [100, 149, 237, 1],
  mediumslateblue: [123, 104, 238, 1],
  blueviolet: [138, 43, 226, 1],
  rebeccapurple: [102, 51, 153, 1],
};

export function parseColor(input) {
  if (!input) return null;
  let value = String(input).trim().toLowerCase();
  if (!value) return null;
  if (value === 'transparent') return [0, 0, 0, 0];
  if (NAMED_COLORS[value]) return [...NAMED_COLORS[value]];
  if (value === 'currentcolor' || value === 'inherit' || value === 'initial') return null;

  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = Number.parseInt(hex[0] + hex[0], 16);
      const g = Number.parseInt(hex[1] + hex[1], 16);
      const b = Number.parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? Number.parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return [r, g, b, a];
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return [r, g, b, a];
    }
    return null;
  }

  const fn = value.match(/^(rgba?|hsla?)\((.+)\)$/);
  if (fn) {
    const parts = fn[2]
      .replace(/\//g, ' ')
      .split(/[\s,]+/)
      .filter(Boolean);
    if (fn[1].startsWith('rgb')) {
      const r = parseChannel(parts[0], 255);
      const g = parseChannel(parts[1], 255);
      const b = parseChannel(parts[2], 255);
      const a = parts[3] !== undefined ? parseAlpha(parts[3]) : 1;
      return [r, g, b, a];
    }
    const h = Number.parseFloat(parts[0]) || 0;
    const s = Number.parseFloat(parts[1]) / 100;
    const l = Number.parseFloat(parts[2]) / 100;
    const a = parts[3] !== undefined ? parseAlpha(parts[3]) : 1;
    return [...hslToRgb(h, s, l), a];
  }
  return null;
}

function parseChannel(value, max) {
  if (value === undefined) return 0;
  if (value.endsWith('%')) return Math.round((Number.parseFloat(value) / 100) * max);
  return Math.round(Math.min(max, Math.max(0, Number.parseFloat(value) || 0)));
}

function parseAlpha(value) {
  if (value === undefined) return 1;
  if (value.endsWith('%')) return Math.min(1, Math.max(0, Number.parseFloat(value) / 100));
  return Math.min(1, Math.max(0, Number.parseFloat(value) || 0));
}

function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb;
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgb.map((channel) => Math.round((channel + m) * 255));
}

export function blend(fg, bg) {
  if (!fg) return bg;
  if (!bg) return fg;
  const alpha = fg[3] ?? 1;
  if (alpha >= 1) return [...fg];
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
    1,
  ];
}

export function relativeLuminance(color) {
  const channels = color.slice(0, 3).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(fg, bg) {
  if (!fg || !bg) return null;
  const opaqueBg = bg[3] < 1 ? blend(bg, [255, 255, 255, 1]) : bg;
  const opaqueFg = fg[3] < 1 ? blend(fg, opaqueBg) : fg;
  const l1 = relativeLuminance(opaqueFg);
  const l2 = relativeLuminance(opaqueBg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function formatColor(color) {
  if (!color) return 'unknown';
  const [r, g, b, a] = color;
  if (a < 1) return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(2))})`;
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function splitTopLevel(value, separator) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (quote) {
      current += char;
      if (char === quote && value[i - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === separator && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

function findBlockEnd(text, start) {
  let depth = 1;
  let quote = null;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return text.length;
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
}

function parseDeclarations(body) {
  const declarations = {};
  for (const chunk of splitTopLevel(body, ';')) {
    const cleaned = chunk.trim();
    if (!cleaned) continue;
    const colon = cleaned.indexOf(':');
    if (colon === -1) continue;
    const property = cleaned.slice(0, colon).trim().toLowerCase();
    let value = cleaned.slice(colon + 1).trim();
    let important = false;
    if (/!important\s*$/i.test(value)) {
      important = true;
      value = value.replace(/!important\s*$/i, '').trim();
    }
    if (!property) continue;
    declarations[property] = { value, important };
  }
  return declarations;
}

function computeSpecificity(selector) {
  let specificity = 0;
  let cleaned = selector
    .replace(/:not\(([^)]*)\)/g, ' $1 ')
    .replace(/::[a-z-]+(\([^)]*\))?/gi, '')
    .replace(/:where\([^)]*\)/gi, '')
    .replace(/:is\(([^)]*)\)/gi, ' $1 ');
  const ids = (cleaned.match(/#[\w-]+/g) ?? []).length;
  const classes = (cleaned.match(/\.[\w-]+/g) ?? []).length;
  const attrs = (cleaned.match(/\[[^\]]+\]/g) ?? []).length;
  const pseudos = (cleaned.match(/(?<!:):[a-z-]+/gi) ?? []).length;
  const tags = (cleaned.match(/(?:^|[\s>+~])([a-z][\w-]*)/gi) ?? []).length;
  const star = (cleaned.match(/\*/g) ?? []).length;
  specificity = ids * 100 + (classes + attrs + pseudos) * 10 + tags - star;
  cleaned = '';
  return Math.max(0, specificity);
}

export function splitSelectors(selectorText) {
  return splitTopLevel(selectorText, ',').map((part) => part.trim()).filter(Boolean);
}

export function parseCss(text, options = {}) {
  const file = options.file ?? '';
  const source = stripComments(String(text ?? ''));
  const rules = [];
  let order = 0;
  const meta = {
    file,
    hasReducedMotion: false,
    hasAnimation: false,
    hasTransition: false,
    rulesWithMotion: [],
    parseError: null,
  };

  const addRule = (selectorText, body, line, media) => {
    const selectors = splitSelectors(selectorText);
    if (!selectors.length) return;
    const declarations = parseDeclarations(body);
    for (const [property, entry] of Object.entries(declarations)) {
      const value = String(entry.value ?? '').trim().toLowerCase();
      const animating = value && value !== 'none' && !/^0m?s$/.test(value);
      if (animating && (property === 'animation' || property === 'animation-name')) meta.hasAnimation = true;
      if (animating && (property === 'transition' || property === 'transition-duration')) meta.hasTransition = true;
    }
    if (meta.hasAnimation || meta.hasTransition) {
      meta.rulesWithMotion.push({ selectorText, line });
    }
    rules.push({
      selectorText,
      selectors,
      declarations,
      line,
      order: order += 1,
      media,
      specificity: Math.max(...selectors.map(computeSpecificity)),
      file,
    });
  };

  const parseRange = (start, end, media) => {
    let index = start;
    while (index < end) {
      while (index < end && /\s/.test(source[index])) index += 1;
      if (index >= end) break;
      if (source[index] === '}') {
        index += 1;
        continue;
      }
      const braceIndex = source.indexOf('{', index);
      if (braceIndex === -1 || braceIndex > end) break;
      const prelude = source.slice(index, braceIndex).trim();
      const blockEnd = findBlockEnd(source, braceIndex + 1);
      const body = source.slice(braceIndex + 1, Math.min(blockEnd, end));
      const line = lineColFromOffset(source, index).line;

      if (prelude.startsWith('@media')) {
        const condition = prelude.slice('@media'.length).trim();
        const reduced = /prefers-reduced-motion\s*:\s*reduce/i.test(condition);
        const darkScheme = /prefers-color-scheme\s*:\s*dark/i.test(condition);
        if (reduced) meta.hasReducedMotion = true;
        const screenOnly = !/print/i.test(condition) || /screen/i.test(condition);
        if (screenOnly && !reduced && !darkScheme) parseRange(braceIndex + 1, Math.min(blockEnd, end), condition);
      } else if (prelude.startsWith('@supports')) {
        parseRange(braceIndex + 1, Math.min(blockEnd, end), media);
      } else if (prelude.startsWith('@')) {
        if (prelude.startsWith('@layer') && body.includes('{')) {
          parseRange(braceIndex + 1, Math.min(blockEnd, end), media);
        }
      } else if (prelude) {
        addRule(prelude, body, line, media);
      }
      index = blockEnd + 1;
    }
  };

  parseRange(0, source.length, null);
  return { rules, meta, source, file };
}

function parseCompound(compound) {
  const result = {
    tag: null,
    id: null,
    classes: [],
    attributes: [],
    pseudos: [],
    nots: [],
    unsupported: false,
    root: false,
  };
  let index = 0;
  const tagMatch = compound.slice(0, 1) === '*' ? '*' : compound.match(/^[a-zA-Z][\w-]*/)?.[0];
  if (tagMatch) {
    result.tag = tagMatch.toLowerCase();
    index = tagMatch.length;
  }
  while (index < compound.length) {
    const char = compound[index];
    if (char === '#') {
      const match = compound.slice(index + 1).match(/^[\w-]+/);
      if (!match) {
        result.unsupported = true;
        break;
      }
      result.id = match[0];
      index += 1 + match[0].length;
    } else if (char === '.') {
      const match = compound.slice(index + 1).match(/^[\w-]+/);
      if (!match) {
        result.unsupported = true;
        break;
      }
      result.classes.push(match[0]);
      index += 1 + match[0].length;
    } else if (char === '[') {
      const end = compound.indexOf(']', index);
      if (end === -1) {
        result.unsupported = true;
        break;
      }
      const raw = compound.slice(index + 1, end).trim();
      const match = raw.match(/^([\w-]+)\s*(?:([~^$*|]?=)\s*("([^"]*)"|'([^']*)'|([^\s\]]+)))?$/);
      if (!match) {
        result.unsupported = true;
        break;
      }
      result.attributes.push({
        name: match[1].toLowerCase(),
        operator: match[2] ?? null,
        value: match[4] ?? match[5] ?? match[6] ?? null,
      });
      index = end + 1;
    } else if (char === ':') {
      if (compound[index + 1] === ':') {
        result.unsupported = true;
        break;
      }
      const match = compound.slice(index + 1).match(/^([\w-]+)(\((?:[^()]|\([^()]*\))*\))?/);
      if (!match) {
        result.unsupported = true;
        break;
      }
      const name = match[1].toLowerCase();
      const args = match[2] ? match[2].slice(1, -1) : null;
      if (name === 'root') {
        result.root = true;
      } else if (name === 'not' && args) {
        result.nots.push(args.trim());
      } else if (['is', 'where'].includes(name) && args) {
        result.unsupported = true;
      } else if (!['focus', 'focus-visible', 'focus-within', 'hover', 'active', 'visited', 'link', 'disabled', 'enabled', 'checked', 'first-child', 'last-child', 'nth-child', 'nth-of-type', 'first-of-type', 'last-of-type', 'empty', 'target', 'before', 'after', 'placeholder', 'selection', 'marker', 'file-selector-button'].includes(name)) {
        result.unsupported = true;
      }
      result.pseudos.push(name);
      index += 1 + match[0].length;
    } else if (char === '>' || char === '+' || char === '~' || char === '|') {
      result.unsupported = true;
      break;
    } else {
      result.unsupported = true;
      break;
    }
  }
  return result;
}

const COMPOUND_CACHE = new Map();

function getCompound(compound) {
  if (!COMPOUND_CACHE.has(compound)) {
    COMPOUND_CACHE.set(compound, parseCompound(compound));
  }
  return COMPOUND_CACHE.get(compound);
}

function attributeMatches(el, spec) {
  const value = attr(el, spec.name);
  if (value === undefined) return false;
  if (!spec.operator) return true;
  const target = spec.value ?? '';
  const current = String(value);
  switch (spec.operator) {
    case '=':
      return current === target;
    case '~=':
      return current.split(/\s+/).includes(target);
    case '^=':
      return current.startsWith(target);
    case '$=':
      return current.endsWith(target);
    case '*=':
      return current.includes(target);
    case '|=':
      return current === target || current.startsWith(`${target}-`);
    default:
      return true;
  }
}

function compoundMatches(el, compound, options = {}) {
  const parsed = getCompound(compound);
  if (parsed.unsupported) return false;
  if (parsed.tag && parsed.tag !== '*' && tagName(el) !== parsed.tag) return false;
  if (parsed.root && tagName(el) !== 'html') return false;
  if (parsed.id && attr(el, 'id') !== parsed.id) return false;
  if (parsed.classes.length) {
    const classes = (attr(el, 'class') ?? '').split(/\s+/).filter(Boolean);
    if (!parsed.classes.every((name) => classes.includes(name))) return false;
  }
  if (parsed.attributes.length && !parsed.attributes.every((spec) => attributeMatches(el, spec))) return false;
  for (const inner of parsed.nots) {
    if (compoundMatches(el, inner, options)) return false;
  }
  if (parsed.pseudos.length) {
    const allowed = options.includePseudo ?? [];
    const blocking = parsed.pseudos.filter(
      (pseudo) => !allowed.includes(pseudo) && !['first-child', 'last-child'].includes(pseudo),
    );
    if (blocking.length) return false;
    if (parsed.pseudos.includes('first-child') && el.parentNode) {
      const siblings = (el.parentNode.childNodes ?? []).filter(isElement);
      if (siblings[0] !== el) return false;
    }
    if (parsed.pseudos.includes('last-child') && el.parentNode) {
      const siblings = (el.parentNode.childNodes ?? []).filter(isElement);
      if (siblings[siblings.length - 1] !== el) return false;
    }
  }
  return true;
}

function tokenizeSelector(selector) {
  const tokens = [];
  let buffer = '';
  let combinator = null;
  let quote = null;
  let depth = 0;
  const pushCompound = () => {
    if (!buffer.trim()) return;
    if (tokens.length) tokens.push(combinator ?? ' ');
    tokens.push(buffer.trim());
    buffer = '';
    combinator = null;
  };
  for (let i = 0; i < selector.length; i += 1) {
    const char = selector[i];
    if (quote) {
      buffer += char;
      if (char === quote && selector[i - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; buffer += char; continue; }
    if (char === '[' || char === '(') depth += 1;
    if (char === ']' || char === ')') depth -= 1;
    if (depth > 0) { buffer += char; continue; }
    if (/\s/.test(char)) {
      if (buffer.trim()) {
        pushCompound();
        combinator = ' ';
      }
      continue;
    }
    if (char === '>' || char === '+' || char === '~') {
      pushCompound();
      combinator = char;
      continue;
    }
    buffer += char;
  }
  pushCompound();
  return tokens;
}

export function selectorMatches(el, selector, options = {}) {
  const tokens = tokenizeSelector(selector);
  if (!tokens.length) return false;

  const matchAt = (node, index) => {
    if (!isElement(node)) return false;
    if (!compoundMatches(node, tokens[index], options)) return false;
    if (index === 0) return true;
    const relation = tokens[index - 1];
    if (relation === '>') return matchAt(node.parentNode, index - 2);
    if (relation === '+') {
      const prev = previousElement(node);
      return prev ? matchAt(prev, index - 2) : false;
    }
    if (relation === '~') {
      let prev = previousElement(node);
      while (prev) {
        if (matchAt(prev, index - 2)) return true;
        prev = previousElement(prev);
      }
      return false;
    }
    let parent = node.parentNode;
    while (parent) {
      if (matchAt(parent, index - 2)) return true;
      parent = parent.parentNode;
    }
    return false;
  };

  return matchAt(el, tokens.length - 1);
}

function previousElement(node) {
  if (!node?.parentNode) return null;
  const siblings = (node.parentNode.childNodes ?? []).filter(isElement);
  const index = siblings.indexOf(node);
  return index > 0 ? siblings[index - 1] : null;
}

export function parseInlineStyle(style) {
  return parseDeclarations(String(style ?? ''));
}

const LENGTH_RE = /^-?\d+(?:\.\d+)?(px|rem|em|%|pt|vw|vh)?$/i;

export function parseLength(value, basePx = 16, parentPx = 16) {
  if (!value) return null;
  const match = String(value).trim().match(LENGTH_RE);
  if (!match) return null;
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return null;
  const unit = match[1] ?? 'px';
  if (unit === 'px') return number;
  if (unit === 'rem') return number * basePx;
  if (unit === 'em') return number * parentPx;
  if (unit === 'pt') return (number * 96) / 72;
  if (unit === '%') return (number / 100) * parentPx;
  if (unit === 'vw') return (number / 100) * 1280;
  if (unit === 'vh') return (number / 100) * 800;
  return number;
}

function resolveVars(value, variables, depth = 0) {
  if (!value || depth > 5 || !String(value).includes('var(')) return value;
  return String(value).replace(/var\(\s*--([\w-]+)\s*(?:,\s*([^)]*))?\)/g, (match, name, fallback) => {
    const resolved = variables.get(name);
    if (resolved !== undefined) return resolveVars(resolved, variables, depth + 1);
    return fallback ?? match;
  });
}

function parseShorthandColor(value) {
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  if (/url\(|gradient\(/i.test(cleaned)) return { color: null, image: true };
  const tokens = splitSpaces(cleaned);
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const color = parseColor(tokens[i]);
    if (color) return { color, image: false };
  }
  return { color: null, image: false };
}

function splitSpaces(value) {
  const parts = [];
  let current = '';
  let depth = 0;
  let quote = null;
  for (const char of value) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(char) && depth === 0) {
      if (current) parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current) parts.push(current);
  return parts;
}

function parseOutline(declarations) {
  const width = declarations['outline-width']?.value;
  const style = declarations['outline-style']?.value;
  const color = declarations['outline-color']?.value;
  const shorthand = declarations.outline?.value;
  const result = { width: 0, style: 'none', color: null };
  if (width !== undefined) result.width = parseLength(width) ?? 0;
  if (style !== undefined) result.style = style;
  if (color !== undefined) result.color = parseColor(color);
  if (shorthand !== undefined) {
    const parts = shorthand.split(/\s+/);
    for (const part of parts) {
      if (/^(none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)$/i.test(part)) {
        result.style = part.toLowerCase();
      } else if (parseLength(part) !== null) {
        result.width = parseLength(part);
      } else {
        const parsed = parseColor(part);
        if (parsed) result.color = parsed;
      }
    }
  }
  if (result.style !== 'none' && result.width === 0 && shorthand !== undefined) result.width = 3;
  return result;
}

export function hasVisibleFocusIndicator(declarations) {
  const outline = parseOutline(declarations);
  const shadow = declarations['box-shadow']?.value;
  return (outline.style !== 'none' && outline.style !== 'hidden' && outline.width > 0) || Boolean(shadow && shadow !== 'none');
}

function collectMatched(el, sheets, options = {}) {
  const matched = [];
  let order = 0;
  for (const sheet of sheets) {
    for (const rule of sheet.rules) {
      order += 1;
      const selectors = rule.selectors.filter((selector) => selectorMatches(el, selector, options));
      if (selectors.length) {
        matched.push({ rule, order, specificity: Math.max(...selectors.map(computeSpecificity)) });
      }
    }
  }
  matched.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
  return matched;
}

function declarationsFromMatched(matched) {
  const result = {};
  for (const { rule } of matched) {
    for (const [property, entry] of Object.entries(rule.declarations)) {
      const previous = result[property];
      if (previous?.important && !entry.important) continue;
      result[property] = { ...entry };
    }
  }
  return result;
}

export function createStyleResolver(sheets) {
  const cache = new WeakMap();
  const rootVariables = new Map();
  for (const sheet of sheets) {
    for (const rule of sheet.rules) {
      if (!rule.selectors.some((selector) => selector === ':root' || selector === 'html')) continue;
      for (const [property, entry] of Object.entries(rule.declarations)) {
        if (property.startsWith('--')) rootVariables.set(property.slice(2), entry.value);
      }
    }
  }

  const resolve = (el, depth = 0) => {
    if (!isElement(el) || depth > 40) return defaultStyle();
    if (cache.has(el)) return cache.get(el);
    const matched = collectMatched(el, sheets);
    const declarations = declarationsFromMatched(matched);
    const inline = parseInlineStyle(attr(el, 'style'));
    for (const [property, entry] of Object.entries(inline)) {
      if (declarations[property]?.important && !entry.important) continue;
      declarations[property] = { ...entry, important: entry.important };
    }
    for (const [property, entry] of Object.entries(declarations)) {
      declarations[property] = { ...entry, value: resolveVars(entry.value, rootVariables) };
    }

    const parent = parentElement(el);
    const parentStyle = parent ? resolve(parent, depth + 1) : defaultStyle();

    const declaredColor = declarations.color?.value;
    let color = parseColor(declaredColor) ?? parentStyle.color;
    let colorSource = declaredColor ? 'declared' : parentStyle.colorSource;

    let backgroundColor = null;
    let backgroundImage = false;
    if (declarations['background-color']) {
      backgroundColor = parseColor(declarations['background-color'].value);
    }
    if (declarations.background) {
      const parsed = parseShorthandColor(declarations.background.value);
      backgroundImage = parsed.image || backgroundImage;
      if (parsed.color) backgroundColor = parsed.color;
    }
    if (declarations['background-image']) {
      const value = declarations['background-image'].value;
      if (value !== 'none') backgroundImage = true;
    }
    const hasOwnBackground = Boolean(backgroundColor && backgroundColor[3] > 0);
    if (!hasOwnBackground) {
      backgroundColor = parentStyle.backgroundColor;
      backgroundImage = backgroundImage || parentStyle.backgroundImage;
    } else if (backgroundColor[3] < 1) {
      backgroundColor = blend(backgroundColor, parentStyle.backgroundColor ?? [255, 255, 255, 1]);
    }
    const backgroundDeclared = hasOwnBackground || Boolean(parentStyle.backgroundDeclared);
    const backgroundImageBehind = backgroundImage || Boolean(parentStyle.backgroundImageBehind);

    const fontSizeRaw = declarations['font-size']?.value;
    const fontSize =
      parseLength(fontSizeRaw, 16, parentStyle.fontSize) ?? parentStyle.fontSize;
    const fontWeightRaw = declarations['font-weight']?.value;
    const fontWeight =
      fontWeightRaw === 'bold' ? 700 : Number.parseInt(fontWeightRaw ?? '', 10) || parentStyle.fontWeight;

    const display = declarations.display?.value ?? 'inline';
    const visibility = declarations.visibility?.value ?? parentStyle.visibility;
    const ownOpacity = declarations.opacity?.value !== undefined ? Number.parseFloat(declarations.opacity.value) : 1;
    const opacity = (Number.isFinite(ownOpacity) ? ownOpacity : 1) * (parentStyle.opacity ?? 1);
    const position = declarations.position?.value ?? 'static';
    const clip = declarations.clip?.value ?? parentStyle.clip;
    const clipPath = declarations['clip-path']?.value ?? 'none';
    const width = parseLength(declarations.width?.value) ?? null;
    const height = parseLength(declarations.height?.value) ?? null;
    const overflow = declarations.overflow?.value ?? 'visible';

    const outline = parseOutline(declarations);
    const ownBoxShadow = declarations['box-shadow']?.value ?? 'none';

    const hidden =
      display === 'none' ||
      parentStyle.hidden ||
      visibility === 'hidden' ||
      attr(el, 'hidden') !== undefined;
    const visuallyHidden =
      (position === 'absolute' || position === 'fixed') &&
      (clip === 'rect(0px, 0px, 0px, 0px)' ||
        clip === 'rect(0, 0, 0, 0)' ||
        /inset\(50%\)/.test(clipPath) ||
        (width !== null && width <= 1 && height !== null && height <= 1));

    const style = {
      el,
      color,
      colorSource,
      backgroundColor,
      backgroundImage,
      backgroundDeclared,
      backgroundImageBehind,
      fontSize,
      fontWeight,
      display,
      visibility,
      opacity,
      position,
      outline,
      boxShadow: ownBoxShadow,
      hidden,
      visuallyHidden,
      overflow,
      width,
      height,
      order: declarations.order?.value ?? null,
      animation: declarations.animation?.value ?? declarations['animation-name']?.value ?? null,
      transition: declarations.transition?.value ?? declarations['transition-duration']?.value ?? null,
      lineHeight: declarations['line-height']?.value ?? null,
      declarations,
    };
    cache.set(el, style);
    return style;
  };

  resolve.focusDeclarations = (el) => {
    const declarations = declarationsFromMatched(collectMatched(el, sheets, { includePseudo: ['focus', 'focus-visible'] }));
    for (const [property, entry] of Object.entries(parseInlineStyle(attr(el, 'style')))) {
      if (!declarations[property]?.important || entry.important) declarations[property] = entry;
    }
    return declarations;
  };
  return resolve;
}

export function defaultStyle() {
  return {
    color: [0, 0, 0, 1],
    colorSource: 'initial',
    backgroundColor: [255, 255, 255, 1],
    backgroundImage: false,
    backgroundDeclared: false,
    backgroundImageBehind: false,
    fontSize: 16,
    fontWeight: 400,
    display: 'block',
    visibility: 'visible',
    opacity: 1,
    position: 'static',
    outline: { width: 0, style: 'none', color: null },
    boxShadow: 'none',
    hidden: false,
    visuallyHidden: false,
    overflow: 'visible',
    width: null,
    height: null,
    order: null,
    animation: null,
    transition: null,
    lineHeight: null,
    declarations: {},
  };
}

export function isLargeText(style) {
  if (!style) return false;
  return style.fontSize >= 24 || (style.fontSize >= 18.66 && (style.fontWeight ?? 400) >= 700);
}

export function isVisuallyHidden(style) {
  return Boolean(style?.visuallyHidden);
}

export function focusStyles(sheets) {
  const findings = [];
  for (const sheet of sheets) {
    for (const rule of sheet.rules) {
      const focusSelectors = rule.selectors.filter((selector) => /:focus(?!-within)/.test(selector));
      if (!focusSelectors.length) continue;
      const declarations = rule.declarations;
      const outline = parseOutline(declarations);
      const boxShadow = declarations['box-shadow']?.value;
      const hasVisibleOutline = outline.style !== 'none' && outline.width > 0;
      const hasShadow = boxShadow && boxShadow !== 'none';
      const removesOutline =
        declarations.outline?.value === 'none' ||
        declarations.outline?.value === '0' ||
        declarations['outline-style']?.value === 'none' ||
        declarations['outline-width']?.value === '0';
      if (removesOutline && !hasVisibleOutline && !hasShadow) {
        findings.push({
          file: sheet.file,
          line: rule.line,
          selector: focusSelectors.join(', '),
          declarations,
        });
      }
    }
  }
  return findings;
}

export function cssSummary(sheets) {
  const summary = {
    files: sheets.length,
    rules: 0,
    hasReducedMotion: false,
    hasAnimation: false,
    hasTransition: false,
    hasVisibleFocusRule: false,
    orderUsage: [],
    focusRemoveRules: [],
  };
  for (const sheet of sheets) {
    summary.rules += sheet.rules.length;
    summary.hasReducedMotion = summary.hasReducedMotion || sheet.meta.hasReducedMotion;
    summary.hasAnimation = summary.hasAnimation || sheet.meta.hasAnimation;
    summary.hasTransition = summary.hasTransition || sheet.meta.hasTransition;
    for (const rule of sheet.rules) {
      if (rule.declarations.order?.value && rule.declarations.order.value !== '0') {
        summary.orderUsage.push({ file: sheet.file, line: rule.line, selector: rule.selectorText });
      }
      if (rule.selectors.some((selector) => selector.includes(':focus'))) {
        const outline = parseOutline(rule.declarations);
        const shadow = rule.declarations['box-shadow']?.value;
        if ((outline.style !== 'none' && outline.width > 0) || (shadow && shadow !== 'none')) {
          summary.hasVisibleFocusRule = true;
        }
      }
    }
  }
  summary.focusRemoveRules = focusStyles(sheets);
  return summary;
}

export function directText(el) {
  return normalizeWhitespace(
    (el.childNodes ?? [])
      .filter((node) => node.nodeName === '#text')
      .map((node) => node.value)
      .join(' '),
  );
}

export { NAMED_COLORS };
