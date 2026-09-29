// Avvia `wrangler dev --local` da apps/server con gli asset di una cartella dist e aspetta /api/ping.
// Uso: const w = await startWrangler({ distDir }); ... w.url ... await w.close();
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER = path.join(ROOT, 'apps/server');

/** Porta TCP libera su 127.0.0.1. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

/**
 * @param {{ distDir: string, port?: number, timeoutMs?: number, persistDir?: string }} o
 * @returns {Promise<{ url: string, port: number, logs: () => string, close: () => Promise<void> }>}
 * La persistenza locale (D1, DO) va in una cartella privata per processo: agenti in parallelo non si pestano i piedi.
 */
export async function startWrangler({ distDir, port, timeoutMs = 60000, persistDir } = {}) {
  if (!distDir || !fs.existsSync(path.join(distDir, 'index.html'))) throw new Error(`startWrangler: distDir senza index.html (${distDir})`);
  const p = port || (await freePort());
  const persist = persistDir || path.join(ROOT, 'tests/out', `wrangler-${process.pid}`);
  fs.mkdirSync(persist, { recursive: true });
  const args = ['--no-install', 'wrangler', 'dev', '--local', '--port', String(p), '--ip', '127.0.0.1', '--assets', path.resolve(distDir), '--persist-to', persist];
  const child = spawn('npx', args, {
    cwd: SERVER, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
    env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false', NO_D1_WARNING: 'true', FORCE_COLOR: '0' },
  });
  let out = '';
  const grab = (d) => { out += d; if (out.length > 60000) out = out.slice(-40000); };
  child.stdout.on('data', grab); child.stderr.on('data', grab);
  let exited = false; child.on('exit', () => { exited = true; });
  const kill = () => new Promise((resolve) => {
    if (exited) return resolve();
    child.once('exit', () => resolve());
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { /* già morto */ } }
    setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* ok */ } resolve(); }, 4000).unref();
  }).then(() => { if (!persistDir) fs.rmSync(persist, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${p}`;
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (exited) throw new Error('wrangler dev è terminato prima di rispondere:\n' + out.split('\n').slice(-15).join('\n'));
    try {
      const r = await fetch(`${url}/api/ping`, { cache: 'no-store' });
      if (r.ok) return { url, port: p, logs: () => out, close: kill };
    } catch { /* non ancora pronto */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  await kill();
  throw new Error(`wrangler dev non risponde su /api/ping entro ${timeoutMs / 1000} s:\n` + out.split('\n').slice(-15).join('\n'));
}
