#!/usr/bin/env node
// Genera i livelli di Pinguini sul ghiaccio (Isola dei Ghiacci) e li scrive in packages/content/src/minigames/pinguini.json (campo
// `livelli`), lasciando il resto del file com'è. Deterministico (rng da seed fisso): rilanciarlo dà gli stessi livelli.
// Uso: node tools/pinguini_livelli.mjs [quanti]. Fasce in pinguini.json (`fasce`: mosse della soluzione più corta, pinguini, buche,
// iceberg). Nelle fasce con più pinguini si tengono solo i livelli dove un pinguino deve fare da sponda a un altro (più bello da
// risolvere). I test della sim ricontrollano ogni livello.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sim = await import(pathToFileURL(path.join(ROOT, 'packages/sim/src/minigames/pinguini.ts')).href);
const { createRng } = await import(pathToFileURL(path.join(ROOT, 'packages/sim/src/rng.ts')).href);

const QUANTI = Number(process.argv[2] ?? 16);
const FILE = path.join(ROOT, 'packages/content/src/minigames/pinguini.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));

/** La soluzione più corta usa un pinguino come sponda (una scivolata si ferma contro un altro pinguino)? */
function sponda(l) {
  const { lastra, pos } = sim.parsePinguini(l.righe), sol = sim.risolviPinguini(lastra, pos);
  const p = pos.slice();
  for (const m of sol) {
    const s = sim.scivola(lastra, p, m.p, m.dir), d = sim.PG_DIR[m.dir], x = s.a % lastra.lato, y = (s.a - x) / lastra.lato;
    const nx = x + d[0], ny = y + d[1], nc = ny * lastra.lato + nx;
    if (!s.tuffo && nx >= 0 && ny >= 0 && nx < lastra.lato && ny < lastra.lato && p.includes(nc)) return true;
    p[m.p] = s.tuffo ? -1 : s.a;
  }
  return false;
}

const livelli = {};
for (const [f, fascia] of Object.entries(cfg.fasce)) {
  const out = [], visti = new Set(), rng = createRng(`pinguini:${f}`);
  for (let t = 0; out.length < QUANTI && t < 200000; t++) {
    const l = sim.generaPinguini(rng, fascia, cfg.lato);
    if (!l || visti.has(l.righe.join(''))) continue;
    if (fascia.pinguini[0] >= 2 && !sponda(l)) continue;
    visti.add(l.righe.join('')); out.push(l);
  }
  out.sort((x, y) => x.mosse - y.mosse);
  livelli[f] = out;
  console.log(`fascia ${f}: ${out.length} livelli, mosse ${out.map((l) => l.mosse).join(' ')}`);
}
cfg.livelli = livelli;
// una riga per livello: il file resta leggibile
const json = JSON.stringify(cfg, null, 2)
  .replace(/\[\s*((?:"[^"\n]*"|-?\d+)(?:,\s*(?:"[^"\n]*"|-?\d+))*)\s*\]/g, (_, r) => `[${r.split(/,\s*/).join(', ')}]`)
  .replace(/\{\s*"righe": (\[[^\]]*\]),\s*"mosse": (\d+)\s*\}/g, '{ "righe": $1, "mosse": $2 }')
  .replace(/\{\s*"mosse": (\[[^\]]*\]),\s*"pinguini": (\[[^\]]*\]),\s*"buche": (\[[^\]]*\]),\s*"iceberg": (\[[^\]]*\])\s*\}/g, '{ "mosse": $1, "pinguini": $2, "buche": $3, "iceberg": $4 }')
  .replace(/\{\s*"oro": (\d+),\s*"argento": (\d+),\s*"bronzo": (\d+)\s*\}/g, '{ "oro": $1, "argento": $2, "bronzo": $3 }')
  .replace(/\{\s*"oro": \{\s*"(\w+)": (\d+)\s*\}\s*\}/g, '{ "oro": { "$1": $2 } }');
fs.writeFileSync(FILE, json + '\n');
console.log('scritto', path.relative(ROOT, FILE));
