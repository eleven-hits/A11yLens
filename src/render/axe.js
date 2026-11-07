import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let cached = null;

export function loadAxe() {
  if (cached) return cached;
  const candidates = [];
  try {
    const main = require.resolve('axe-core');
    candidates.push(path.join(path.dirname(main), 'axe.min.js'));
    candidates.push(main);
  } catch {
    // axe-core may be installed next to the tool
  }
  candidates.push(path.join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js'));
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const source = fs.readFileSync(candidate, 'utf8');
      let version = 'unknown';
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(candidate), 'package.json'), 'utf8'));
        version = pkg.version ?? version;
      } catch {
        // version is cosmetic
      }
      cached = { source, version };
      return cached;
    } catch {
      // try the next candidate
    }
  }
  throw new Error('axe-core is not installed. Run npm install in the A11yLens directory, or use --no-axe.');
}
