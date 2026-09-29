#!/usr/bin/env node
// Contact sheet degli screenshot: tests/out/shots/*.png → tests/out/contact.png (ffmpeg).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function contact(shotsDir = path.join(ROOT, 'tests/out/shots'), out = path.join(ROOT, 'tests/out/contact.png')) {
  const shots = fs.existsSync(shotsDir) ? fs.readdirSync(shotsDir).filter((f) => f.endsWith('.png')).sort() : [];
  if (!shots.length) return { ok: false, n: 0, msg: 'nessuno screenshot' };
  const cols = Math.min(4, shots.length), rows = Math.ceil(shots.length / cols);
  const ff = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
  const list = path.join(shotsDir, '..', 'shots.txt');
  fs.writeFileSync(list, shots.map((f) => `file '${path.join(shotsDir, f).replace(/'/g, "'\\''")}'\nduration 1`).join('\n') + '\n');
  const r = spawnSync(ff, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=480:480:force_original_aspect_ratio=decrease,pad=480:480:(ow-iw)/2:(oh-ih)/2:color=0x2E1E14,tile=${cols}x${rows}:padding=6:color=0x2E1E14`, '-frames:v', '1', out], { encoding: 'utf8' });
  return { ok: r.status === 0, n: shots.length, msg: r.status === 0 ? out : r.stderr };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { const r = contact(); console.log(r.ok ? `[contact] ${r.n} shot → ${r.msg}` : `[contact] ${r.msg}`); process.exit(r.ok ? 0 : 1); }
