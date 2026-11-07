import { pathToFileURL } from 'node:url';

export function renderSarif(report) {
  const ruleMap = new Map();
  const results = [];
  for (const finding of report.findings) {
    if (!ruleMap.has(finding.ruleId)) {
      ruleMap.set(finding.ruleId, {
        id: finding.ruleId,
        name: finding.ruleId,
        shortDescription: { text: finding.title },
        fullDescription: { text: finding.description },
        helpUri: finding.helpUrl,
        help: { text: `${finding.help}\n\nScreen reader impact: ${finding.srImpact}` },
        properties: {
          tags: ['accessibility', 'wcag', ...finding.wcag],
          wcag: finding.wcag,
          level: finding.level,
          category: finding.category,
          engine: finding.engine,
        },
      });
    }
    const ruleIndex = [...ruleMap.keys()].indexOf(finding.ruleId);
    const isUrl = /^https?:/i.test(finding.file ?? '');
    const uri = isUrl ? finding.file : String(finding.file ?? '').split('\\').join('/');
    const result = {
      ruleId: finding.ruleId,
      ruleIndex,
      level: finding.severity === 'error' ? 'error' : finding.severity === 'warning' ? 'warning' : 'note',
      message: { text: finding.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri, uriBaseId: isUrl ? undefined : '%SRCROOT%' },
            region: {
              startLine: Math.max(1, finding.line ?? 1),
              startColumn: Math.max(1, finding.column ?? 1),
              snippet: finding.snippet ? { text: finding.snippet } : undefined,
            },
          },
        },
      ],
      properties: {
        engine: finding.engine,
        selector: finding.selector || undefined,
        screenReaderImpact: finding.srImpact,
        help: finding.help,
        wcag: finding.wcag,
        level: finding.level,
      },
    };
    results.push(result);
  }

  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'A11yLens',
            version: report.tool.version,
            rules: [...ruleMap.values()],
          },
        },
        originalUriBaseIds: {
          '%SRCROOT%': { uri: pathToUri(report.root) },
        },
        results,
        invocations: [{
          executionSuccessful: !report.errors?.length,
          toolExecutionNotifications: (report.errors ?? []).map((error) => ({ level: 'error', message: { text: `${error.file}: ${error.message}` } })),
        }],
        properties: {
          summary: report.summary,
          dynamic: report.dynamic,
          generatedAt: report.startedAt,
          truncated: report.truncated ?? 0,
        },
      },
    ],
  };
  return `${JSON.stringify(sarif, null, 2)}\n`;
}

function pathToUri(value) {
  return pathToFileURL(String(value).replace(/[\\/]?$/, '/')).href;
}
