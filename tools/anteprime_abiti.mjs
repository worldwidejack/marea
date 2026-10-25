#!/usr/bin/env node
// Anteprime 2D dei vestiti e dei cappelli del Mercante: `node tools/anteprime_abiti.mjs [abt_<id>|cap_<id>...]`
// → apps/client/public/assets/abiti/<nome>.png (192 px, sfondo trasparente). Blender come in build_assets.mjs (variabile BLENDER).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blenderWindows = () => {
  const dir = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Blender Foundation');
  try { return fs.readdirSync(dir).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).map((d) => path.join(dir, d, 'blender.exe')).find((p) => fs.existsSync(p)); } catch { return undefined; }
};
const BLENDER = process.env.BLENDER || (process.platform === 'win32' && blenderWindows()) || '/Applications/Blender.app/Contents/MacOS/Blender';
const OUT = path.join(ROOT, 'apps/client/public/assets/abiti');
const r = spawnSync(BLENDER, ['-b', '--factory-startup', '-P', path.join(ROOT, 'assets/blender/anteprime_abiti.py'), '--', OUT, ...process.argv.slice(2)], { encoding: 'utf8', maxBuffer: 64 << 20 });
const fatti = (r.stdout || '').split('\n').filter((l) => l.startsWith('[anteprime]'));
if (r.status !== 0 || !fatti.length) { console.error((r.stdout || '').split('\n').slice(-30).join('\n'), r.stderr); process.exit(1); }
console.log(`[anteprime] ${fatti.length} disegni in ${path.relative(ROOT, OUT)}`);
