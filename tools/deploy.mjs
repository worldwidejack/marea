#!/usr/bin/env node
// Deploy: build → migrazioni D1 remote → wrangler deploy → attende /version.json con lo stesso build. Solo l'orchestratore.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'apps/server');
export const URL_PUBBLICO = 'https://marea.stanza-idee.workers.dev';
const wrangler = (...args) => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js'), ...args], { cwd: SERVER, stdio: 'inherit', env: { ...process.env, CI: '1' } });
  if (r.status !== 0) throw new Error(`wrangler ${args.join(' ')} fallito`);
};
const report = await build();
wrangler('d1', 'migrations', 'apply', 'DB', '--remote');
wrangler('deploy');
const t0 = Date.now();
let ok = false;
while (Date.now() - t0 < 120_000) {
  try {
    const r = await fetch(`${URL_PUBBLICO}/version.json?x=${Date.now()}`, { cache: 'no-store' });
    if (r.ok && (await r.json()).build === report.build) { ok = true; break; }
  } catch { /* riprova */ }
  await new Promise((r) => setTimeout(r, 3000));
}
if (!ok) throw new Error(`Online non risponde con il build ${report.build} entro 2 minuti`);
const ping = await (await fetch(`${URL_PUBBLICO}/api/ping`, { cache: 'no-store' })).json();
console.log(`[deploy] online: ${URL_PUBBLICO} · build ${ping.build} · ok=${ping.ok}`);
