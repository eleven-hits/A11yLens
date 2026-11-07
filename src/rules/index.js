import { ariaRules } from './aria.js';
import { formRules } from './forms.js';
import { imageRules } from './media.js';
import { renderRules } from './render.js';
import { semanticsRules } from './semantics.js';
import { sourceRules } from './source.js';
import { styleRules } from './styles.js';
import { validationRules } from './validation.js';

export const RULES = [
  ...semanticsRules,
  ...imageRules,
  ...formRules,
  ...ariaRules,
  ...styleRules,
  ...validationRules,
  ...sourceRules,
  ...renderRules,
];

export const RULE_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

export const STATIC_RULES = RULES.filter((rule) => !rule.checkSource && !rule.renderOnly);
export const SOURCE_RULES = RULES.filter((rule) => Boolean(rule.checkSource));
export const RENDER_RULES = RULES.filter((rule) => Boolean(rule.renderOnly));

export const CATEGORIES = [
  ...new Set(RULES.map((rule) => rule.category)),
].sort();

export const SEVERITIES = ['error', 'warning', 'info'];

export function getRule(id) {
  return RULE_BY_ID.get(id) ?? null;
}

export function rulesByCategory() {
  const grouped = new Map();
  for (const rule of RULES) {
    if (!grouped.has(rule.category)) grouped.set(rule.category, []);
    grouped.get(rule.category).push(rule);
  }
  return grouped;
}

export function rulesForTags(tags) {
  const wanted = new Set(tags);
  return RULES.filter((rule) => rule.tags.some((tag) => wanted.has(tag)));
}

export function wcagLink(criterion) {
  const map = {
    '1.1.1': 'non-text-content',
    '1.2.1': 'audio-only-and-video-only-prerecorded',
    '1.2.2': 'captions-prerecorded',
    '1.2.3': 'audio-description-or-media-alternative-prerecorded',
    '1.2.5': 'audio-description-prerecorded',
    '1.3.1': 'info-and-relationships',
    '1.3.2': 'meaningful-sequence',
    '1.3.4': 'orientation',
    '1.3.5': 'identify-input-purpose',
    '1.4.1': 'use-of-color',
    '1.4.2': 'audio-control',
    '1.4.3': 'contrast-minimum',
    '1.4.4': 'resize-text',
    '1.4.10': 'reflow',
    '1.4.11': 'non-text-contrast',
    '1.4.12': 'text-spacing',
    '1.4.13': 'content-on-hover-or-focus',
    '2.1.1': 'keyboard',
    '2.1.2': 'no-keyboard-trap',
    '2.2.1': 'timing-adjustable',
    '2.2.2': 'pause-stop-hide',
    '2.3.1': 'three-flashes-or-below-threshold',
    '2.3.3': 'animation-from-interactions',
    '2.4.1': 'bypass-blocks',
    '2.4.2': 'page-titled',
    '2.4.3': 'focus-order',
    '2.4.4': 'link-purpose-in-context',
    '2.4.6': 'headings-and-labels',
    '2.4.7': 'focus-visible',
    '2.4.11': 'focus-not-obscured-minimum',
    '2.5.3': 'label-in-name',
    '2.5.7': 'dragging-movements',
    '2.5.8': 'target-size-minimum',
    '3.1.1': 'language-of-page',
    '3.1.2': 'language-of-parts',
    '3.2.1': 'on-focus',
    '3.2.2': 'on-input',
    '3.2.5': 'change-on-request',
    '3.2.6': 'consistent-help',
    '3.3.1': 'error-identification',
    '3.3.2': 'labels-or-instructions',
    '3.3.7': 'redundant-entry',
    '3.3.8': 'accessible-authentication-minimum',
    '4.1.2': 'name-role-value',
    '4.1.3': 'status-messages',
  };
  return map[criterion] ?? null;
}

export function wcagUrl(criterion) {
  const slug = wcagLink(criterion);
  return slug ? `https://www.w3.org/WAI/WCAG22/Understanding/${slug}.html` : 'https://www.w3.org/WAI/WCAG22/quickref/';
}

export function ruleSummary() {
  return RULES.map((rule) => ({
    id: rule.id,
    title: rule.title,
    category: rule.category,
    severity: rule.severity,
    wcag: rule.wcag,
    level: rule.level,
    tags: rule.tags,
    source: Boolean(rule.checkSource),
    description: rule.description,
    srImpact: rule.srImpact,
    manual: rule.manual ?? [],
    help: rule.help,
    helpUrl: rule.helpUrl,
    renderOnly: Boolean(rule.renderOnly),
  }));
}
