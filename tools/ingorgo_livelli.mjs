#!/usr/bin/env node
// Genera i livelli dell'Ingorgo al porto e li scrive in packages/content/src/minigames/ingorgo.json (campo `livelli`), lasciando
// il resto del file com'è. Deterministico (rng da seed fisso): rilanciarlo dà gli stessi livelli. Uso: node tools/ingorgo_livelli.mjs [quanti]
// Fasce: a = facile, b = media, c = intricata (mosse della soluzione più corta e barche in griglia). I test della sim ricontrollano ogni livello.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { generaLivello } = await import(pathToFileURL(path.join(ROOT, 'packages/sim/src/minigames/ingorgo.ts')).href);
const { createRng } = await import(pathToFileURL(path.join(ROOT, 'packages/sim/src/rng.ts')).href);

const QUANTI = Number(process.argv[2] ?? 12);
const FASCE = { a: { mosse: [3, 5], pezzi: [5, 8] }, b: { mosse: [7, 9], pezzi: [7, 10] }, c: { mosse: [11, 14], pezzi: [9, 12] } };
const FILE = path.join(ROOT, 'packages/content/src/minigames/ingorgo.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const livelli = {};
for (const [f, { mosse, pezzi }] of Object.entries(FASCE)) {
  const out = [], visti = new Set();
  for (let t = 0; out.length < QUANTI && t < 20000; t++) {
    const l = generaLivello(createRng(`ingorgo:${f}:${t}`), mosse, pezzi);
    if (!l || visti.has(l.righe.join(''))) continue;
    visti.add(l.righe.join('')); out.push(l);
  }
  out.sort((x, y) => x.mosse - y.mosse);
  livelli[f] = out;
  console.log(`fascia ${f}: ${out.length} livelli, mosse ${out.map((l) => l.mosse).join(' ')}`);
}
cfg.livelli = livelli;
// una riga per livello: il file resta leggibile
const json = JSON.stringify(cfg, null, 2)
  .replace(/\[\s*((?:"[^"\n]*"|-?\d+)(?:,\s*(?:"[^"\n]*"|-?\d+))*)\s*\]/g, (_, r) => `[${r.split(/,\s*/).join(', ')}]`) // array corti su una riga
  .replace(/\{\s*"righe": (\[[^\]]*\]),\s*"mosse": (\d+)\s*\}/g, '{ "righe": $1, "mosse": $2 }')
  .replace(/\{\s*"oro": (\d+),\s*"argento": (\d+),\s*"bronzo": (\d+)\s*\}/g, '{ "oro": $1, "argento": $2, "bronzo": $3 }');
fs.writeFileSync(FILE, json + '\n');
console.log('scritto', path.relative(ROOT, FILE));
