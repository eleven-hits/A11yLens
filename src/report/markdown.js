import { locationLabel } from '../util.js';
import { APPENDIX_MANUAL } from './manual.js';

export function renderMarkdown(report) {
  const lines = [];
  const push = (line = '') => lines.push(line);
  const summary = report.summary;
  push(`# ${report.config?.reportTitle ?? 'A11yLens Accessibility Audit'}`);
  push('');
  push(`- **Target:** \`${report.root}\``);
  push(`- **Generated:** ${report.startedAt}`);
  push(`- **Pages:** ${summary.pages} · **Files scanned:** ${summary.files}`);
  push(`- **Score:** ${summary.score}/100 (heuristic)`);
  push(`- **Findings:** ${summary.errors} errors · ${summary.warnings} warnings · ${summary.infos} info`);
  if (report.dynamic?.enabled) {
    push(`- **Rendered scan:** ${report.dynamic.pageCount} page(s) with ${report.dynamic.browser ?? 'Chrome'}, axe-core ${report.dynamic.axeVersion ?? 'n/a'}`);
  }
  push('');
  push('> Automated checks cover only part of WCAG. Use the manual screen reader protocol before claiming conformance.');
  push('');
  if (report.baseline?.suppressed) push(`> Baseline suppressed ${report.baseline.suppressed} known finding(s).`);
  push('');

  push('## Findings');
  push('');
  if (report.truncated) push(`Showing ${report.findings.length} of ${summary.total} findings. Summary and exit code include all findings.\n`);
  if (report.errors?.length) {
    push('Audit incomplete. Resolve these scan errors before interpreting the results:');
    for (const error of report.errors) push(`- ${mdEscape(error.file)}: ${mdEscape(error.message)}`);
    push('');
  }
  if (!report.findings.length) {
    if (!report.errors?.length) push('No issues were found by the automated checks.');
    push('');
  } else {
    push('| Severity | Rule | Location | Message |');
    push('| --- | --- | --- | --- |');
    for (const finding of report.findings) {
      push(
        `| ${finding.severity} | \`${finding.ruleId}\` | \`${locationLabel(finding)}\` | ${mdEscape(finding.message)} |`,
      );
    }
    push('');
    push('## Details');
    push('');
    for (const finding of report.findings) {
      push(`### ${severityTitle(finding.severity)}: ${finding.title}`);
      push('');
      push(`- **Location:** \`${locationLabel(finding)}\`${finding.selector ? ` · \`${finding.selector}\`` : ''}`);
      push(`- **Rule:** \`${finding.ruleId}\` · **WCAG:** ${finding.wcag.join(', ')} (${finding.level})`);
      push(`- **Issue:** ${finding.message}`);
      if (finding.snippet) push(`- **Code:** \`${finding.snippet.replace(/`/g, "'")}\``);
      push(`- **Fix:** ${finding.help}`);
      push(`- **Screen reader impact:** ${finding.srImpact}`);
      if (finding.manual?.length) {
        push('- **How to test:**');
        for (const step of finding.manual) push(`  - ${step}`);
      }
      if (finding.helpUrl) push(`- **Reference:** ${finding.helpUrl}`);
      push('');
    }
  }

  if (report.pages.some((page) => page.headings?.length)) {
    push('## Page outlines');
    push('');
    for (const page of report.pages.filter((entry) => entry.headings?.length)) {
      push(`### ${page.title || page.file}`);
      push('');
      push(`\`${page.file}\`${page.lang ? ` · lang="${page.lang}"` : ''}`);
      push('');
      for (const heading of page.headings) {
        push(`${'  '.repeat(Math.max(0, heading.level - 1))}- h${heading.level}: ${mdEscape(heading.text || '(empty)')}`);
      }
      push('');
    }
  }

  push(APPENDIX_MANUAL);
  return `${lines.join('\n')}\n`;
}

function mdEscape(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function severityTitle(severity) {
  if (severity === 'error') return 'Error';
  if (severity === 'warning') return 'Warning';
  return 'Info';
}
