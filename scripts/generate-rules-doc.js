import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/rules/index.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const CATEGORIES = new Map();

for (const rule of RULES) {
  if (!CATEGORIES.has(rule.category)) CATEGORIES.set(rule.category, []);
  CATEGORIES.get(rule.category).push(rule);
}

const lines = [];
lines.push('# Rule reference');
lines.push('');
lines.push('Generated from `src/rules/index.js` by `npm run docs:rules`. Do not edit by hand.');
lines.push('');
lines.push(`A11yLens ships **${RULES.length} checks** across ${CATEGORIES.size} categories.`);
lines.push('');
lines.push('Severity is about user impact, not WCAG level: **error** is a clear barrier, **warning** is very likely a barrier that needs context, **info** is a best practice or a manual check.');
lines.push('');
lines.push('| Category | Rules |');
lines.push('| --- | --- |');
for (const [category, rules] of [...CATEGORIES.entries()].sort()) {
  lines.push(`| ${category} | ${rules.length} |`);
}
lines.push('');

for (const [category, rules] of [...CATEGORIES.entries()].sort()) {
  lines.push(`## ${category}`);
  lines.push('');
  for (const rule of rules) {
    lines.push(`### \`${rule.id}\` — ${rule.title}`);
    lines.push('');
    const engine = rule.renderOnly
      ? 'Rendered Chrome + accessibility tree'
      : rule.checkSource
        ? 'Component source'
        : 'Static HTML/CSS';
    lines.push(`- **Severity:** ${rule.severity}`);
    lines.push(`- **WCAG:** ${rule.wcag.length ? `${rule.wcag.join(', ')} (level ${rule.level})` : 'best practice, no specific criterion'}`);
    lines.push(`- **Engine:** ${engine}`);
    lines.push(`- **What it checks:** ${rule.description}`);
    lines.push(`- **Screen reader impact:** ${rule.srImpact}`);
    if (rule.manual?.length) {
      lines.push(`- **Manual test:** ${rule.manual.join(' ')}`);
    }
    lines.push(`- **Fix:** ${rule.help}`);
    if (rule.helpUrl) lines.push(`- **Reference:** ${rule.helpUrl}`);
    lines.push('');
  }
}

await fs.mkdir(path.join(ROOT, 'docs'), { recursive: true });
await fs.writeFile(path.join(ROOT, 'docs', 'RULES.md'), `${lines.join('\n').trimEnd()}\n`, 'utf8');
console.log(`Wrote docs/RULES.md with ${RULES.length} rules.`);
