#!/usr/bin/env node
// Contact sheet degli screenshot: tests/out/shots/*.png → tests/out/contact.png (ffmpeg).
// Ordine stabile (nome). Ogni riquadro ha il nome dello screenshot in alto a sinistra (drawtext, se ffmpeg e un font ci sono; altrimenti senza etichette).
// Layout pensato per il telefono: foto verticali (telefono) in griglia da 3 colonne, sotto le orizzontali (desktop) in griglia da 2; larghezza totale 1110 px.
// Uso: node tools/contact.mjs [prefisso...]   (es. `look` → solo look_*.png)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = ['/System/Library/Fonts/Monaco.ttf', '/System/Library/Fonts/Supplemental/Courier New Bold.ttf', '/Library/Fonts/Arial.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'];
const GAP = 6, BG = '0x2E1E14';
const PORTRAIT = { cols: 3, w: 356, h: 640 };   // 3 × 356 + 4 × 6 = 1092
const LANDSCAPE = { cols: 2, w: 543, h: 305 };  // 2 × 543 + 3 × 6 = 1104
const SHEET_W = Math.max(PORTRAIT.cols * PORTRAIT.w + (PORTRAIT.cols + 1) * GAP, LANDSCAPE.cols * LANDSCAPE.w + (LANDSCAPE.cols + 1) * GAP);

function pngSize(f) {
  const fd = fs.openSync(f, 'r'); const b = Buffer.alloc(24); fs.readSync(fd, b, 0, 24, 0); fs.closeSync(fd);
  return b.readUInt32BE(0) === 0x89504e47 ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null;
}
const findFfmpeg = () => (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');
function canLabel(ff) {
  const font = FONTS.find((f) => fs.existsSync(f));
  if (!font) return null;
  const r = spawnSync(ff, ['-hide_banner', '-filters'], { encoding: 'utf8' });
  return r.status === 0 && /\bdrawtext\b/.test(r.stdout) ? font : null;
}
const esc = (t) => t.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%');

export function contact(shotsDir = path.join(ROOT, 'tests/out/shots'), out = path.join(ROOT, 'tests/out/contact.png'), prefixes = []) {
  let shots = fs.existsSync(shotsDir) ? fs.readdirSync(shotsDir).filter((f) => f.endsWith('.png')).sort() : [];
  if (prefixes.length) shots = shots.filter((f) => prefixes.some((p) => f.startsWith(p)));
  if (!shots.length) return { ok: false, n: 0, msg: 'nessuno screenshot' };
  const ff = findFfmpeg(); const font = canLabel(ff);
  const items = shots.map((f) => { const s = pngSize(path.join(shotsDir, f)); return { f, name: f.replace(/\.png$/, ''), portrait: !s || s.h >= s.w }; });
  const groups = [{ cfg: PORTRAIT, items: items.filter((i) => i.portrait) }, { cfg: LANDSCAPE, items: items.filter((i) => !i.portrait) }].filter((g) => g.items.length);
  const inputs = []; const chains = []; const sections = [];
  groups.forEach((g, gi) => {
    const { cols, w, h } = g.cfg; const rows = Math.ceil(g.items.length / cols);
    const secW = SHEET_W, secH = rows * h + (rows + 1) * GAP;
    const cells = g.items.map((it, k) => {
      const idx = inputs.length; inputs.push(path.join(shotsDir, it.f));
      const label = font ? `,drawtext=fontfile='${esc(font)}':text='${esc(it.name)}':fontcolor=0xF4E3C1:fontsize=${it.portrait ? 17 : 19}:box=1:boxcolor=0x2E1E14@0.85:boxborderw=5:x=4:y=4` : '';
      chains.push(`[${idx}:v]scale=${w - 2}:${h - 2}:force_original_aspect_ratio=decrease:flags=neighbor${label},pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${BG}[c${idx}]`);
      return { idx, x: GAP + (k % cols) * (w + GAP) + Math.floor((secW - (cols * w + (cols + 1) * GAP)) / 2), y: GAP + Math.floor(k / cols) * (h + GAP) };
    });
    // sfondo della sezione + overlay dei riquadri (funziona anche con un solo riquadro, dove xstack non basta)
    chains.push(`color=c=${BG}:s=${secW}x${secH}:d=1[bg${gi}]`);
    let prev = `bg${gi}`;
    cells.forEach((c, k) => { const lab = `s${gi}_${k}`; chains.push(`[${prev}][c${c.idx}]overlay=${c.x}:${c.y}:eof_action=repeat[${lab}]`); prev = lab; });
    sections.push(prev);
  });
  const fin = sections.length > 1 ? (chains.push(`${sections.map((s) => `[${s}]`).join('')}vstack=inputs=${sections.length}[out]`), 'out') : sections[0];
  const args = ['-y', '-loglevel', 'error', ...inputs.flatMap((i) => ['-i', i]), '-filter_complex', chains.join(';'), '-map', `[${fin}]`, '-frames:v', '1', out];
  const r = spawnSync(ff, args, { encoding: 'utf8', maxBuffer: 1 << 24 });
  return { ok: r.status === 0, n: shots.length, labelled: !!font, msg: r.status === 0 ? out : (r.stderr || 'ffmpeg fallito').split('\n').slice(0, 6).join('\n') };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = contact(undefined, undefined, process.argv.slice(2));
  console.log(r.ok ? `[contact] ${r.n} shot${r.labelled ? ' con etichette' : ' (senza etichette: ffmpeg drawtext o font non disponibili)'} → ${r.msg}` : `[contact] ${r.msg}`);
  process.exit(r.ok ? 0 : 1);
}
