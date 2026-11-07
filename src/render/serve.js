import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { isSubPath } from '../util.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.vtt': 'text/vtt; charset=utf-8',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

export async function serveDirectory(root, options = {}) {
  root = await fs.realpath(root);
  const spa = options.spa ?? false;
  const indexName = options.index ?? 'index.html';
  const server = http.createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
        response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'GET, HEAD' });
        response.end('Method not allowed');
        return;
      }
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      let pathname;
      try {
        pathname = decodeURIComponent(requestUrl.pathname);
      } catch {
        response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Bad request');
        return;
      }
      let target = path.resolve(root, `.${pathname}`);
      if (!isSubPath(root, target)) {
        response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Forbidden');
        return;
      }
      let stats = await statSafe(target);
      if (stats?.isDirectory()) {
        target = path.join(target, indexName);
        stats = await statSafe(target);
      }
      if (!stats?.isFile() && !path.extname(target)) {
        const withHtml = `${target}.html`;
        if ((await statSafe(withHtml))?.isFile()) {
          target = withHtml;
          stats = await statSafe(target);
        }
      }
      if (!stats?.isFile() && spa) {
        const fallback = path.join(root, indexName);
        if ((await statSafe(fallback))?.isFile()) {
          target = fallback;
          stats = await statSafe(target);
        }
      }
      if (!stats?.isFile()) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      target = await fs.realpath(target);
      if (!isSubPath(root, target)) {
        response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Forbidden');
        return;
      }
      const extension = path.extname(target).toLowerCase();
      const headers = {
        'content-type': MIME[extension] ?? 'application/octet-stream',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      };
      if (request.method === 'HEAD') {
        response.writeHead(200, headers);
        response.end();
        return;
      }
      const content = await fs.readFile(target);
      response.writeHead(200, { ...headers, 'content-length': content.length });
      response.end(content);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(`Server error: ${error.message}`);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : options.port;
  return {
    url: `http://127.0.0.1:${port}/`,
    port,
    root,
    async close() {
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

async function statSafe(file) {
  try {
    return await fs.stat(file);
  } catch {
    return null;
  }
}

export async function findSiteRoot(target) {
  const candidates = [target];
  for (const name of ['dist', 'build', 'public', 'out', '_site', 'site', 'www', '.output/public']) {
    candidates.push(path.join(target, name));
  }
  for (const candidate of candidates) {
    if ((await statSafe(path.join(candidate, 'index.html')))?.isFile()) return candidate;
  }
  return target;
}
