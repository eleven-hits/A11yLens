import { formatMs, locationLabel, severityLabel } from '../util.js';

export function renderPretty(report, options = {}) {
  const styler = options.styler;
  const lines = [];
  const push = (line = '') => lines.push(line);
  const color = (name, text) => (styler ? styler[name](text) : text);

  push('');
  push(color('bold', `A11yLens ${report.tool.version}`) + color('gray', '  Accessibility and screen reader audit'));
  push(color('gray', `Target: ${report.root}`));
  const fileCount = report.files.html.length + report.files.source.length + report.files.css.length;
  push(
    color(
      'gray',
      `Files: ${report.files.html.length} HTML · ${report.files.source.length} source · ${report.files.css.length} CSS` +
        (report.dynamic?.enabled ? ` · ${report.dynamic.pageCount} rendered page(s)` : ''),
    ),
  );
  if (report.dynamic?.enabled) {
    push(color('gray', `Browser: ${report.dynamic.browser ?? 'unknown'} · axe-core ${report.dynamic.axeVersion ?? 'n/a'}`));
  }
  push('');

  if (!report.findings.length) {
    push(report.errors?.length ? color('yellow', 'Audit incomplete. Resolve the scan errors before interpreting these results.') : color('green', '✔ No issues found by the automated checks.'));
    push('');
    push(color('gray', 'Automated checks cover only part of WCAG. Run the manual screen reader protocol: a11ylens manual'));
  } else if (!options.quiet) {
    let currentFile = null;
    for (const finding of report.findings) {
      const location = locationLabel(finding);
      const group = finding.file;
      if (group !== currentFile) {
        currentFile = group;
        push(color('bold', finding.file));
      }
      const badge = color(
        finding.severity === 'error' ? 'red' : finding.severity === 'warning' ? 'yellow' : 'blue',
        severityLabel(finding.severity).padEnd(5),
      );
      push(`  ${badge} ${color('dim', location)}  ${finding.message}`);
      const meta = [`${finding.ruleId}`, `WCAG ${finding.wcag.join(', ') || '-'} (${finding.level})`];
      if (finding.engine === 'render' || finding.engine === 'axe') meta.push('rendered');
      push(color('gray', `        ${meta.join(' · ')}`));
      if (finding.snippet) push(color('gray', `        ${finding.snippet}`));
      if (finding.srImpact) push(color('gray', `        SR: ${wordWrap(finding.srImpact, 92, '            ')}`));
      if (finding.help) push(color('gray', `        Fix: ${wordWrap(finding.help, 91, '             ')}`));
      if (options.verbose) {
        for (const step of finding.manual) push(color('gray', `        Test: ${wordWrap(step, 90, '              ')}`));
        if (finding.helpUrl) push(color('gray', `        Docs: ${finding.helpUrl}`));
      }
      push('');
    }
  }

  const summary = report.summary;
  const scoreColor = summary.score >= 90 ? 'green' : summary.score >= 70 ? 'yellow' : 'red';
  push(color('bold', 'Summary'));
  push(
    `  ${color('red', `${summary.errors} error${summary.errors === 1 ? '' : 's'}`)} · ` +
      `${color('yellow', `${summary.warnings} warning${summary.warnings === 1 ? '' : 's'}`)} · ` +
      `${color('blue', `${summary.infos} info`)}`,
  );
  push(
    `  Score ${color(scoreColor, `${summary.score}/100`)} ${color('gray', '(heuristic, not a WCAG conformance score)')} · ` +
      color('gray', `${summary.checks} checks · ${summary.passed}/${summary.rules} rules clean · ${formatMs(report.durationMs)}`),
  );
  if (report.baseline?.suppressed) push(color('gray', `  Baseline: ${report.baseline.suppressed} known finding(s) suppressed`));
  if (report.truncated) push(color('gray', `  Output truncated: ${report.truncated} more finding(s) not shown`));
  if (report.errors?.length) {
    push(color('yellow', `  Internal notes: ${report.errors.length}`));
    if (options.verbose) {
      for (const entry of report.errors.slice(0, 20)) push(color('gray', `    ${entry.file}${entry.ruleId ? ` [${entry.ruleId}]` : ''}: ${entry.message}`));
    }
  }
  push('');
  push(color('gray', 'Next: a11ylens manual . --findings   (screen reader test steps for these findings)'));
  return `${lines.join('\n')}\n`;
}

function wordWrap(text, width, indent) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= width) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join(`\n${indent}`);
}
