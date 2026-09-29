#!/usr/bin/env node
// tsc --noEmit per ogni pacchetto. Exit 1 se uno fallisce.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = ['packages/content', 'packages/protocol', 'packages/sim', 'apps/client', 'apps/server'];
const only = process.argv.slice(2);
let failed = 0;
for (const p of PKGS) {
  if (only.length && !only.some((o) => p.includes(o))) continue;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', path.join(ROOT, p)], { cwd: ROOT, encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} types ${p} (${Date.now() - t0} ms)`);
  if (!ok) console.log((r.stdout + r.stderr).split('\n').slice(0, 40).map((l) => '    ' + l).join('\n'));
}
process.exit(failed ? 1 : 0);
