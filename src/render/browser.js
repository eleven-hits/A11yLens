import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const WINDOWS_CANDIDATES = [
  `${process.env.ProgramFiles ?? 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.ProgramFiles ?? 'C:\\Program Files'}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles ?? 'C:\\Program Files'}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
  `${process.env.LOCALAPPDATA ?? ''}\\Chromium\\Application\\chrome.exe`,
].filter(Boolean);

const MAC_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  `${os.homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
];

const LINUX_NAMES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable', 'brave-browser'];
const LINUX_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/opt/google/chrome/chrome',
  '/usr/bin/microsoft-edge',
  '/usr/bin/brave-browser',
];

export function findBrowser(override = null) {
  const explicit = override || process.env.A11YLENS_BROWSER || process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicit) {
    if (fsSync.existsSync(explicit)) return explicit;
    throw new Error(`Browser executable not found: ${explicit}`);
  }
  const candidates =
    process.platform === 'win32' ? WINDOWS_CANDIDATES : process.platform === 'darwin' ? MAC_CANDIDATES : LINUX_PATHS;
  for (const candidate of candidates) {
    if (candidate && fsSync.existsSync(candidate)) return candidate;
  }
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    for (const name of LINUX_NAMES) {
      const found = findOnPath(name);
      if (found) return found;
    }
  }
  return null;
}

function findOnPath(name) {
  const pathValue = process.env.PATH ?? '';
  const entries = pathValue.split(path.delimiter);
  for (const dir of entries) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    try {
      if (fsSync.existsSync(candidate)) return candidate;
    } catch {
    }
  }
  return null;
}

export function browserLabel(file) {
  if (!file) return 'unknown';
  const base = path.basename(file).toLowerCase();
  if (base.includes('msedge') || base.includes('edge')) return 'Microsoft Edge';
  if (base.includes('brave')) return 'Brave';
  if (base.includes('chromium')) return 'Chromium';
  return 'Google Chrome';
}

export async function launchBrowser(options = {}) {
  if (typeof WebSocket === 'undefined') {
    throw new Error('This Node.js has no global WebSocket. Use Node 22 or newer for --render.');
  }
  const executablePath = findBrowser(options.executablePath);
  if (!executablePath) {
    throw new Error(
      'No Chrome, Edge, Chromium or Brave installation was found. Install one, or pass --browser "C:\\path\\to\\chrome.exe".',
    );
  }
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'a11ylens-browser-'));
  const args = [
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--metrics-recording-only',
    '--mute-audio',
    '--hide-scrollbars',
    '--window-size=1440,1000',
    '--force-color-profile=srgb',
  ];
  if (options.headless !== false) args.unshift('--headless=new');
  if (options.sandbox === false) args.push('--no-sandbox', '--disable-dev-shm-usage');
  args.push('about:blank');
  const child = spawn(executablePath, args, { stdio: 'ignore', windowsHide: true });
  let launchError = null;
  child.once('error', (error) => { launchError = error; });
  const started = Date.now();
  let port = null;
  while (Date.now() - started < 20000) {
    if (launchError) break;
    try {
      const content = await fs.readFile(path.join(userDataDir, 'DevToolsActivePort'), 'utf8');
      const firstLine = content.split(/\r?\n/)[0]?.trim();
      if (firstLine && Number.parseInt(firstLine, 10) > 0) {
        port = Number.parseInt(firstLine, 10);
        break;
      }
    } catch {
    }
    await sleep(120);
  }
  if (!port) {
    await closeProcess(child);
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    if (launchError) throw new Error(`Could not launch browser: ${launchError.message}`);
    throw new Error(
      child.exitCode !== null
        ? `Chrome exited before exposing a DevTools port (code ${child.exitCode}).`
        : 'Chrome did not expose a DevTools port within 20 seconds.',
    );
  }
  let version = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
      version = await response.json();
      break;
    } catch {
      await sleep(100);
    }
  }
  if (!version) {
    await closeProcess(child);
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    throw new Error('Chrome started but the DevTools endpoint did not respond.');
  }
  const browserWsUrl = version.webSocketDebuggerUrl ?? null;
  return {
    executablePath,
    label: browserLabel(executablePath),
    port,
    userDataDir,
    version,
    process: child,
    async close() {
      await closeBrowserViaCdp(browserWsUrl);
      await closeProcess(child);
      for (let attempt = 0; attempt < 30; attempt += 1) {
        if (!(await isPortAlive(port))) break;
        await sleep(150);
      }
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          await fs.rm(userDataDir, { recursive: true, force: true });
          break;
        } catch {
          await sleep(250);
        }
      }
    },
  };
}

async function isPortAlive(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function closeBrowserViaCdp(webSocketUrl) {
  if (!webSocketUrl || typeof WebSocket === 'undefined') return;
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
      }
      resolve();
    };
    const timer = setTimeout(finish, 4000);
    let socket;
    try {
      socket = new WebSocket(webSocketUrl);
    } catch {
      finish();
      return;
    }
    socket.addEventListener('open', () => {
      try {
        socket.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
      } catch {
      }
      setTimeout(finish, 500);
    });
    socket.addEventListener('error', finish);
    socket.addEventListener('close', finish);
  });
}

export async function closeProcess(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      child.kill('SIGTERM');
      await sleep(400);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
  } catch {
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
