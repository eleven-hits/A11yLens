import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, validateConfig } from './config.js';
import { discoverFiles } from './scan/walker.js';
import {
  applyBaseline,
  buildBaseline,
  mergeDynamic,
  limitReportFindings,
  scanStatic,
  TOOL_VERSION,
} from './scan/engine.js';
import { runDynamicScan } from './render/dynamic.js';
import { findBrowser } from './render/browser.js';
import { loadAxe } from './render/axe.js';
import {
  defaultOutputPath,
  formatFromExtension,
  getRule,
  normalizeFormat,
  renderExplain,
  renderReport,
  renderRules,
  RULES,
} from './report/index.js';
import { renderManual } from './report/manual.js';
import { createStyler, isPlainObject } from './util.js';

const VALUE_FLAGS = new Set([
  'url', 'crawl', 'depth', 'wait', 'timeout', 'port', 'browser', 'format', 'output', 'config',
  'ignore', 'include', 'exclude', 'fail-on', 'min-score', 'max-findings', 'baseline',
  'screen-reader', 'title', 'axe-tags', 'from',
]);

const BOOLEAN_FLAGS = new Set([
  'render', 'headed', 'headless', 'spa', 'quiet', 'verbose', 'scan-js', 'scan-source', 'css',
  'axe', 'update-baseline', 'help', 'version', 'findings', 'json', 'sarif', 'html', 'markdown',
  'md', 'color', 'force', 'sandbox',
]);

const SHORT_FLAGS = {
  h: 'help',
  v: 'version',
  V: 'verbose',
  q: 'quiet',
  o: 'output',
  f: 'format',
};

const COMMANDS = new Set(['scan', 'rules', 'explain', 'manual', 'init', 'doctor', 'help', 'version']);

export async function run(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`A11yLens: ${error.message}\n\n${helpText()}\n`);
    return 2;
  }

  if (args.help) {
    process.stdout.write(helpText());
    return 0;
  }
  if (args.version) {
    process.stdout.write(`A11yLens ${TOOL_VERSION}\n`);
    return 0;
  }

  let command = 'scan';
  if (args._.length && COMMANDS.has(args._[0])) {
    command = args._.shift();
  }
  if (command === 'help') {
    process.stdout.write(helpText());
    return 0;
  }
  if (command === 'version') {
    process.stdout.write(`A11yLens ${TOOL_VERSION}\n`);
    return 0;
  }

  try {
    if (command === 'rules') return await rulesCommand(args);
    if (command === 'explain') return await explainCommand(args);
    if (command === 'manual') return await manualCommand(args);
    if (command === 'init') return await initCommand(args);
    if (command === 'doctor') return await doctorCommand(args);
    return await scanCommand(args);
  } catch (error) {
    process.stderr.write(`A11yLens: ${error.message}\n`);
    if (process.env.A11YLENS_DEBUG) process.stderr.write(`${error.stack}\n`);
    return 2;
  }
}

export function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      result._.push(...argv.slice(index + 1));
      break;
    }
    if (!arg.startsWith('-') || arg === '-') {
      result._.push(arg);
      continue;
    }
    let key;
    let value;
    if (arg.startsWith('--')) {
      key = arg.slice(2);
      const equals = key.indexOf('=');
      if (equals !== -1) {
        value = key.slice(equals + 1);
        key = key.slice(0, equals);
      }
    } else {
      const short = arg.slice(1);
      if (!SHORT_FLAGS[short]) throw new Error(`Unknown option ${arg}`);
      key = SHORT_FLAGS[short];
    }
    if (key.startsWith('no-')) {
      if (!BOOLEAN_FLAGS.has(key.slice(3)) || value !== undefined) throw new Error(`Unknown option ${arg}`);
      result[camel(key.slice(3))] = false;
      continue;
    }
    const camelKey = camel(key);
    if (VALUE_FLAGS.has(key)) {
      if (value === undefined) {
        const next = argv[index + 1];
        if (next === undefined || next.startsWith('-')) throw new Error(`Option --${key} needs a value.`);
        value = next;
        index += 1;
      }
      if (['ignore', 'include', 'exclude', 'axe-tags'].includes(key)) {
        const values = String(value)
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean);
        result[camelKey] = [...(result[camelKey] ?? []), ...values];
      } else {
        result[camelKey] = value;
      }
      continue;
    }
    if (BOOLEAN_FLAGS.has(key)) {
      if (value !== undefined && !['true', 'false', '1', '0'].includes(value)) throw new Error(`Option --${key} needs true or false.`);
      result[camelKey] = value === undefined ? true : value !== 'false' && value !== '0';
      continue;
    }
    throw new Error(`Unknown option ${arg}`);
  }

  if (result.json) result.format = 'json';
  if (result.sarif) result.format = 'sarif';
  if (result.html) result.format = 'html';
  if (result.md) result.format = 'markdown';
  if (result.markdown) result.format = 'markdown';
  if (result.headed) result.headless = false;
  return result;
}

function camel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

async function scanCommand(args) {
  const target = args._[0] ?? '.';
  const isUrl = /^https?:\/\//i.test(target);
  let root = isUrl ? process.cwd() : path.resolve(target);
  let includeFromFile = null;

  if (!isUrl) {
    const stats = await fs.stat(root).catch(() => null);
    if (!stats) throw new Error(`Target not found: ${root}`);
    if (stats.isFile()) {
      includeFromFile = path.posix.basename(root.split(path.sep).join('/'));
      root = path.dirname(root);
    } else if (!stats.isDirectory()) {
      throw new Error(`Target is not a file or directory: ${root}`);
    }
  }

  const { config: fileConfig, file: configFile } = await loadConfig(root, args.config);
  const config = buildConfig(fileConfig, args, { isUrl, target, includeFromFile });
  if (isUrl) config.url = target;

  const discovery = isUrl
    ? { html: [], sources: [], css: [], skipped: [], root }
    : await discoverFiles(root, config);

  if (!isUrl && !discovery.html.length && !discovery.sources.length && !discovery.css.length && !config.render && !config.url) {
    throw new Error(
      `No HTML, component, CSS or (with --scan-js) JavaScript files found under ${root}. ` +
        'Point A11yLens at the built site directory, or pass --url http://localhost:3000.',
    );
  }

  const report = await scanStatic(root, config, { discovery });
  report.config = {
    configFile,
    target,
    include: config.include,
    exclude: config.exclude,
    ignoreRules: config.ignoreRules,
    failOn: config.failOn,
    format: config.format,
    render: Boolean(config.render || config.url),
    crawl: config.crawl,
    reportTitle: config.reportTitle,
    axe: config.axe !== false,
  };

  if (config.render || config.url) {
    if (!config.quiet) {
      process.stderr.write(
        config.url
          ? `Rendering ${config.url} …\n`
          : `Rendering the local site with ${config.browser ?? 'the detected browser'} …\n`,
      );
    }
    let dynamicError = null;
    try {
      const dynamic = await runDynamicScan({ root, config, discovery, report });
      mergeDynamic(report, dynamic, config);
      if (!config.quiet) {
        const info = report.dynamic;
        process.stderr.write(
          `Rendered ${info.pageCount} page(s) with ${info.browser}` +
            (info.axeEnabled ? ` · axe-core ${info.axeVersion}` : ' · axe-core disabled') +
            ` · ${info.durationMs} ms\n`,
        );
      }
    } catch (error) {
      dynamicError = error;
      report.errors.push({ file: root, message: `Rendered scan failed: ${error.message}` });
      if (!config.quiet) process.stderr.write(`Warning: rendered scan failed: ${error.message}\n`);
    }
    if (dynamicError && (config.url || report.pages.length === 0)) {
      throw new Error(`The rendered scan failed and the requested URL could not be audited: ${dynamicError.message}`);
    }
    if (config.url && (report.dynamic?.pageCount ?? 0) === 0) {
      const detail = report.errors[report.errors.length - 1]?.message ?? 'no page could be rendered';
      throw new Error(`The rendered scan could not audit ${config.url}: ${detail}`);
    }
    if (!config.url && (report.dynamic?.pageCount ?? 0) === 0 && report.pages.length === 0) {
      throw new Error('The rendered scan produced no page and there were no static pages to report.');
    }
  }

  const baselinePath = config.baseline
    ? path.resolve(root, config.baseline)
    : path.join(root, '.a11ylens-baseline.json');

  if (config.updateBaseline) {
    if (report.errors.length) throw new Error('Cannot update the baseline because the audit did not complete successfully.');
    const baseline = buildBaseline(report);
    await fs.writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
    if (!config.quiet) process.stderr.write(`Baseline updated: ${baselinePath} (${baseline.fingerprints.length} entries)\n`);
  } else {
    const baseline = await readJsonIfExists(baselinePath, true);
    if (baseline && (!Array.isArray(baseline.fingerprints) || baseline.fingerprints.some((value) => typeof value !== 'string'))) throw new Error(`Invalid baseline fingerprints: ${baselinePath}`);
    if (baseline?.fingerprints) {
      applyBaseline(report, baseline, root);
      if (!config.quiet) process.stderr.write(`Baseline applied: ${baselinePath}\n`);
    } else if (config.baseline) {
      throw new Error(`Baseline file not found: ${baselinePath}`);
    }
  }

  let format = normalizeFormat(config.format);
  let output = config.output;
  if (!args.format && !args.json && !args.sarif && !args.html && !args.md && !args.markdown && output) {
    format = formatFromExtension(output);
  }
  if (format === 'html' && !output) output = defaultOutputPath('html');
  if (output) {
    output = path.resolve(process.cwd(), output);
    await fs.mkdir(path.dirname(output), { recursive: true });
  }

  const styler = createStyler(
    Boolean(config.color) &&
      process.stdout.isTTY &&
      !process.env.NO_COLOR &&
      format === 'pretty' &&
      !output,
  );
  const rendered = renderReport(limitReportFindings(report, config.maxFindings), format, {
    styler,
    verbose: config.verbose,
    quiet: config.quiet,
    title: config.reportTitle,
  });

  if (output) {
    await fs.writeFile(output, rendered, 'utf8');
    if (!config.quiet) {
      process.stdout.write(
        `A11yLens: ${report.summary.errors} error(s), ${report.summary.warnings} warning(s), ${report.summary.infos} info · score ${report.summary.score}/100\n`,
      );
      process.stdout.write(`Report written to ${output}\n`);
    }
  } else {
    process.stdout.write(rendered);
  }

  return exitCode(report, config);
}

function buildConfig(fileConfig, args, context) {
  const config = { ...fileConfig };
  const numeric = [
    ['crawl', 'crawl'],
    ['depth', 'maxDepth'],
    ['wait', 'wait'],
    ['timeout', 'timeout'],
    ['port', 'servePort'],
    ['minScore', 'minScore'],
    ['maxFindings', 'maxFindings'],
  ];
  for (const [flag, key] of numeric) {
    if (args[flag] !== undefined) {
      if (!/^\d+$/.test(args[flag])) throw new Error(`Option --${flag.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} needs a non-negative integer.`);
      config[key] = Number(args[flag]);
    }
  }
  const direct = [
    'url', 'browser', 'failOn', 'format', 'output', 'baseline', 'reportTitle', 'screenReader',
    'scanJs', 'scanSource', 'quiet', 'verbose', 'updateBaseline', 'color', 'axe',
  ];
  for (const key of direct) {
    if (args[key] !== undefined) config[key] = args[key];
  }
  if (args.title !== undefined) config.reportTitle = args.title;
  if (args.headless !== undefined) config.headless = args.headless;
  if (args.sandbox === false) config.sandbox = false;
  if (args.render !== undefined) config.render = args.render;
  if (args.spa !== undefined) config.spa = args.spa;
  if (args.css === false) config.checkCss = false;
  if (args.scanSource === false) config.scanSource = false;
  if (args.scanJs === true) config.scanJs = true;
  if (args.axe === false) config.axe = false;
  if (args.ignore?.length) config.ignoreRules = [...new Set([...(config.ignoreRules ?? []), ...args.ignore])];
  if (args.include?.length) config.include = [...new Set([...(config.include ?? []), ...args.include])];
  if (args.exclude?.length) config.exclude = [...new Set([...(config.exclude ?? []), ...args.exclude])];
  if (args.axeTags?.length) config.axeTags = args.axeTags;
  if (context.includeFromFile) {
    config.include = [context.includeFromFile];
    if (/\.html?$/i.test(context.includeFromFile)) config.entry = `/${context.includeFromFile}`;
  }
  if (context.isUrl) {
    config.url = context.target;
    config.render = true;
  }
  return validateConfig(config);
}

async function rulesCommand(args) {
  const filter = args._[0];
  let rules = RULES;
  if (filter) {
    rules = RULES.filter((rule) => rule.id === filter || rule.category === filter || rule.id.startsWith(filter));
    if (!rules.length) throw new Error(`No rule matches "${filter}". Run "a11ylens rules" to see every rule.`);
  }
  const styler = createStyler(Boolean(args.color) && process.stdout.isTTY && !process.env.NO_COLOR);
  process.stdout.write(renderRules(rules, { json: Boolean(args.json), styler }));
  return 0;
}

async function explainCommand(args) {
  const id = args._[0];
  if (!id) throw new Error('Usage: a11ylens explain <rule-id>');
  const rule = getRule(id);
  if (!rule) throw new Error(`Unknown rule "${id}". Run "a11ylens rules" to list them.`);
  process.stdout.write(renderExplain(rule));
  return 0;
}

async function manualCommand(args) {
  if (args.findings && !args.from && !args._[0]) {
    throw new Error('manual --findings needs a project path or --from <report.json>.');
  }
  let report = null;
  if (args.from) {
    report = await readJsonIfExists(path.resolve(args.from));
    if (!report?.findings) throw new Error(`Could not read a report from ${args.from}`);
  } else if (args._[0]) {
    const target = path.resolve(args._[0]);
    const stats = await fs.stat(target).catch(() => null);
    if (!stats) throw new Error(`Target not found: ${target}`);
    const root = stats.isFile() ? path.dirname(target) : target;
    const { config: fileConfig } = await loadConfig(root, args.config);
    const config = buildConfig(fileConfig, args, { isUrl: false, target, includeFromFile: stats.isFile() ? path.basename(target) : null });
    const discovery = await discoverFiles(root, config);
    report = await scanStatic(root, config, { discovery });
  }
  process.stdout.write(
    renderManual(report, {
      findingsOnly: Boolean(args.findings),
      screenReader: args.screenReader ?? 'all',
    }),
  );
  return 0;
}

async function initCommand(args) {
  let target = path.resolve(args._[0] ?? '.');
  const targetStats = await fs.stat(target).catch(() => null);
  if (targetStats?.isFile()) target = path.dirname(target);
  const file = path.join(target, '.a11ylensrc.json');
  const exists = await fs.stat(file).catch(() => null);
  if (exists && !args.force) throw new Error(`${file} already exists. Use --force to overwrite it.`);
  const template = {
    include: [],
    exclude: ['**/node_modules/**', '**/.git/**'],
    ignoreRules: [],
    rules: {},
    render: false,
    url: null,
    crawl: 5,
    maxDepth: 2,
    wait: 600,
    timeout: 30000,
    spa: false,
    failOn: 'error',
    format: 'pretty',
    scanJs: false,
    axeTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
  };
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
  process.stdout.write(`Created ${file}\n\nNext steps:\n  1. a11ylens ${path.relative(process.cwd(), target) || '.'}\n  2. a11ylens ${path.relative(process.cwd(), target) || '.'} --render\n  3. a11ylens manual\n`);
  return 0;
}

async function doctorCommand(args) {
  const lines = [];
  const push = (ok, label, detail = '') => lines.push(`${ok ? '\u2714' : '\u2716'} ${label}${detail ? ` — ${detail}` : ''}`);
  push(true, 'A11yLens', TOOL_VERSION);
  push(true, 'Platform', `${process.platform} ${process.arch}`);
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  const minor = Number.parseInt(process.versions.node.split('.')[1], 10);
  const nodeSupported = major > 20 || (major === 20 && minor >= 10);
  push(nodeSupported, 'Node.js', `${process.versions.node}${!nodeSupported ? ' (Node 20.10 or newer required)' : ''}`);
  push(typeof WebSocket !== 'undefined', 'Native WebSocket', typeof WebSocket !== 'undefined' ? 'available' : 'missing; --render needs Node 22+');
  push(major >= 22, 'Rendered scan', major >= 22 ? 'ready' : 'Node 22+ recommended for --render');

  try {
    const axe = loadAxe();
    push(true, 'axe-core', axe.version);
  } catch (error) {
    push(false, 'axe-core', error.message);
  }
  try {
    const browser = findBrowser(args.browser);
    push(Boolean(browser), 'Chrome / Edge / Chromium / Brave', browser ?? 'not found; install a Chromium browser or pass --browser');
  } catch (error) {
    push(false, 'Browser', error.message);
  }
  const config = await findConfigForDoctor(process.cwd());
  push(Boolean(config), 'Config file', config ?? 'none found (run a11ylens init)');
  const baseline = await fs.stat(path.join(process.cwd(), '.a11ylens-baseline.json')).catch(() => null);
  push(true, 'Baseline', baseline ? 'present' : 'none (optional)');
  process.stdout.write(`\nA11yLens doctor\n\n${lines.join('\n')}\n\n`);
  return 0;
}

async function findConfigForDoctor(start) {
  let current = path.resolve(start);
  for (let depth = 0; depth < 8; depth += 1) {
    for (const name of ['.a11ylensrc.json', '.a11ylensrc', 'a11ylens.config.json']) {
      if (await fs.stat(path.join(current, name)).catch(() => null)) return path.join(current, name);
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

async function readJsonIfExists(file, strict = false) {
  try {
    const content = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(content);
    if (!isPlainObject(parsed) && strict) throw new Error('Expected a JSON object.');
    return isPlainObject(parsed) ? parsed : null;
  } catch (error) {
    if (strict && error.code !== 'ENOENT') throw new Error(`Cannot read JSON file ${file}: ${error.message}`);
    return null;
  }
}

function exitCode(report, config) {
  if (report.errors?.length) return 2;
  const failOn = config.failOn ?? 'error';
  const { errors, warnings, total, score } = report.summary;
  if (failOn !== 'none') {
    if (failOn === 'error' && errors > 0) return 1;
    if (failOn === 'warning' && (errors > 0 || warnings > 0)) return 1;
    if (failOn === 'info' && total > 0) return 1;
  }
  if (config.minScore !== null && config.minScore !== undefined && score < config.minScore) return 1;
  return 0;
}

function helpText() {
  return `
A11yLens ${TOOL_VERSION} — accessibility and screen reader audit for web projects

USAGE
  a11ylens [path] [options]
  a11ylens <command> [options]

COMMANDS
  scan [path]        Audit a directory, a built site or a single HTML file (default)
  rules [filter]     List every rule. Filter by category or id prefix
  explain <rule-id>  Explain one rule, its WCAG mapping and screen reader impact
  manual [path]      Print the manual screen reader test protocol
  init [path]        Create .a11ylensrc.json
  doctor             Check Node, browser, axe-core and config
  help               Show this help

SCAN OPTIONS
  --render                 Render the site in Chrome: axe-core, accessibility tree, keyboard walk
  --url <url>              Audit a running site (implies --render)
  --crawl <n>              Maximum rendered pages (default 5)
  --depth <n>              Crawl link depth (default 2)
  --spa                    Serve the local site with history fallback
  --browser <path>         Chrome/Edge/Chromium executable
  --headed                 Show the browser window
  --no-sandbox             Disable the Chrome sandbox (containers/CI only)
  --wait <ms>              Wait after load before analysis (default 600)
  --no-axe                 Skip axe-core, keep the accessibility tree checks
  --scan-js                Also scan .js/.ts files for JSX (default only .jsx/.tsx/.vue/.svelte/.astro)

REPORT OPTIONS
  -f, --format <name>      pretty | json | sarif | html | markdown
  -o, --output <file>      Write the report to a file
  --title <text>           Report title
  --fail-on <level>        error | warning | info | none (default error)
  --min-score <n>          Fail when the heuristic score is below n
  --max-findings <n>       Limit the findings written to the report
  --baseline <file>        Baseline file (default .a11ylens-baseline.json)
  --update-baseline        Record current findings as the baseline
  -q, --quiet              Summary only
  --verbose                Include manual test steps and documentation links
  --no-color               Disable ANSI colour

FILTERING
  --include <glob>         Only scan matching files (repeatable, comma separated)
  --exclude <glob>         Skip matching files (repeatable, comma separated)
  --ignore <rule[,rule]>   Disable rules (repeatable). Supports prefix* wildcards
  --no-css                 Skip CSS rules (focus, motion, order, static contrast)
  --no-scan-source         Skip component/source files

EXAMPLES
  a11ylens ./dist
  a11ylens ./dist --render --crawl 8
  a11ylens . --url http://localhost:3000 --format html --output report.html
  a11ylens ./src --scan-js --ignore css-contrast,css-order
  a11ylens manual ./dist --findings
  a11ylens rules images
  a11ylens explain img-alt

EXIT CODES
  0  no findings at the chosen --fail-on level
  1  findings at or above the chosen level, or score below --min-score
  2  tool, config or input error

A11yLens is not a conformance certification. Automated checks cover part of WCAG;
run "a11ylens manual" with NVDA, JAWS, VoiceOver or TalkBack before claiming accessibility.
`;
}
