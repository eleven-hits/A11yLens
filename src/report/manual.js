import { AUTOMATION_LIMITS, MANUAL_PROTOCOL, SCREEN_READERS } from '../screenreaders.js';

export function renderManual(report, options = {}) {
  const lines = [];
  const push = (line = '') => lines.push(line);
  push('A11yLens — manual screen reader test plan');
  push('='.repeat(48));
  push('');
  push('Automated checks cannot hear the page. This plan covers what only a screen reader can confirm.');
  push('');

  if (report?.findings?.length) {
    push('CHECKS FOR THE FINDINGS IN THIS REPORT');
    push('--------------------------------------');
    const groups = new Map();
    for (const finding of report.findings) {
      if (!groups.has(finding.ruleId)) groups.set(finding.ruleId, { finding, count: 0 });
      groups.get(finding.ruleId).count += 1;
    }
    for (const { finding, count } of groups.values()) {
      push(`[${finding.severity.toUpperCase()}] ${finding.ruleId} — ${finding.title} (${count} occurrence${count === 1 ? '' : 's'})`);
      push(`  ${finding.srImpact}`);
      if (finding.manual?.length) {
        for (const step of finding.manual) push(`  - ${step}`);
      } else {
        push('  - Navigate to the element with the screen reader cursor and confirm its name, role and state.');
        push('  - Activate it with the keyboard and confirm the result is announced.');
      }
      const example = report.findings.find((item) => item.ruleId === finding.ruleId);
      if (example) push(`  Example: ${example.file}:${example.line}`);
      push('');
    }

    if (options.findingsOnly) {
      push('Run without --findings to print the full protocol and screen reader key reference.');
      return `${lines.join('\n')}\n`;
    }
  } else if (report && options.findingsOnly) {
    push('No findings to turn into screen reader checks. The automated report is clean.');
    push('');
    return `${lines.join('\n')}\n`;
  }

  push('FULL PROTOCOL');
  push('-------------');
  for (const step of MANUAL_PROTOCOL) {
    push(`${step.title}`);
    push(`  ${step.detail}`);
    push(`  Pass: ${step.pass}`);
    push('');
  }

  push('SCREEN READER QUICK REFERENCE');
  push('-----------------------------');
  for (const reader of selectReaders(options.screenReader)) {
    push(`${reader.name} — ${reader.platform} (${reader.cost})`);
    push(`  ${reader.setup.join(' ')}`);
    for (const [keys, action] of reader.commands) {
      push(`  ${keys.padEnd(22)} ${action}`);
    }
    push(`  Focus: ${reader.focus}`);
    push('');
  }

  push('WHY THE REPORT IS NOT A CONFORMANCE CLAIM');
  push('-----------------------------------------');
  for (const limit of AUTOMATION_LIMITS) push(`- ${limit}`);
  push('');
  return `${lines.join('\n')}\n`;
}

export function renderManualMarkdown(report, options = {}) {
  const lines = [];
  const push = (line = '') => lines.push(line);
  push('## Manual screen reader test protocol');
  push('');
  push('Automated checks cannot hear the page. Run this protocol with the screen reader and browser combinations your users rely on.');
  push('');
  if (report?.findings?.length) {
    push('### Checks for these findings');
    push('');
    const groups = new Map();
    for (const finding of report.findings) {
      if (!groups.has(finding.ruleId)) groups.set(finding.ruleId, { finding, count: 0 });
      groups.get(finding.ruleId).count += 1;
    }
    for (const { finding, count } of groups.values()) {
      push(`#### ${finding.title} (\`${finding.ruleId}\`, ${count})`);
      push('');
      push(`**Screen reader impact:** ${finding.srImpact}`);
      push('');
      const steps = finding.manual?.length
        ? finding.manual
        : [
            'Move to the element with the screen reader cursor and confirm its name, role and state.',
            'Operate it with the keyboard and confirm the result is announced.',
          ];
      for (const step of steps) push(`- ${step}`);
      push('');
    }
  }
  push('### Test order');
  push('');
  for (const step of MANUAL_PROTOCOL) {
    push(`1. **${step.title}.** ${step.detail}`);
    push(`   _Pass:_ ${step.pass}`);
  }
  push('');
  push('### Quick reference');
  push('');
  for (const reader of SCREEN_READERS) {
    push(`#### ${reader.name} (${reader.platform})`);
    push('');
    push(reader.setup.join(' '));
    push('');
    push('| Keys | Action |');
    push('| --- | --- |');
    for (const [keys, action] of reader.commands) push(`| \`${keys}\` | ${action} |`);
    push('');
    push(reader.focus);
    push('');
  }
  push('### Limits of automation');
  push('');
  for (const limit of AUTOMATION_LIMITS) push(`- ${limit}`);
  push('');
  return lines.join('\n');
}

export const APPENDIX_MANUAL = renderManualMarkdown(null);

function selectReaders(id) {
  if (!id || id === 'all') return SCREEN_READERS;
  return SCREEN_READERS.filter((reader) => reader.id === id);
}
