import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', process.env.SERVE_DIR || '.');
const port = Number(process.env.PORT || 5173);
const allowed = new Set(['index.html', 'theme.css', 'styles.css', 'app.js', 'domain.js', 'views.js', 'icons.js', 'platform.js', 'manifest.webmanifest', 'service-worker.js']);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://server');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root + path.sep) || (!allowed.has(relative) && !/^icons\/[a-zA-Z0-9_-]+\.(png|svg)$/.test(relative))) {
      response.writeHead(404); response.end('Not found'); return;
    }
    const info = await stat(filename);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'Content-Type': mime[path.extname(filename)] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      // No X-Frame-Options / host allowlist: Arena embeds the live preview.
    });
    response.end(request.method === 'HEAD' ? undefined : await readFile(filename));
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not found');
  }
});
server.listen(port, '0.0.0.0', () => console.log(`Повтор: http://0.0.0.0:${port} (${root})`));
