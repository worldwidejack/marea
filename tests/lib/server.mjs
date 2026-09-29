// Server statico su porta libera per i test (SPA fallback su index.html).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.ico': 'image/x-icon' };
export function startServer(dir, port = 0) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x'); let f = path.join(dir, decodeURIComponent(u.pathname));
      if (u.pathname.startsWith('/api/')) { res.writeHead(u.pathname === '/api/ping' ? 200 : 404, { 'content-type': 'application/json' }); res.end(JSON.stringify(u.pathname === '/api/ping' ? { ok: true, build: 'static', now: Date.now() } : { error: 'Non trovato' })); return; }
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dir, 'index.html');
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(port, '127.0.0.1', () => resolve({ port: srv.address().port, url: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) }));
  });
}
