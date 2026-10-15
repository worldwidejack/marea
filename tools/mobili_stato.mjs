#!/usr/bin/env node
// Stato del catalogo dei mobili (#304): per ogni riga di mobili.json dice se ha la descrizione (mobili_testi.json), la ricetta Blender
// (assets/blender/models_mobili.py) e il modello già nel manifest (apps/client/public/assets/manifest_mobili.json).
// Uso: node tools/mobili_stato.mjs              tabella + riepilogo, esce con 1 se manca una descrizione o una ricetta ha un id che non esiste
//      node tools/mobili_stato.mjs --ricette    solo i nomi mob_<id> da lanciare con `npm run assets` (ricetta presente, modello assente)
//      node tools/mobili_stato.mjs --tutte      tutti i nomi mob_<id> con ricetta (per rifare tutto)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOBILI } from '../packages/content/src/index.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p, d) => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return d; } };
const testi = JSON.parse(read('packages/content/src/mobili_testi.json', '{"testi":{}}')).testi;
const ricette = new Set([...read('assets/blender/models_mobili.py', '').matchAll(/^def mob_([a-z][a-z0-9_]*)\(/gm)].map((m) => m[1]));
const modelli = new Set(Object.keys(JSON.parse(read('apps/client/public/assets/manifest_mobili.json', '{"models":{}}')).models || {}).map((n) => n.replace(/^mob_/, '')));
const argv = process.argv.slice(2);

if (argv.includes('--ricette')) { console.log(MOBILI.filter((m) => ricette.has(m.id) && !modelli.has(m.id)).map((m) => 'mob_' + m.id).join(' ')); process.exit(0); }
if (argv.includes('--tutte')) { console.log(MOBILI.filter((m) => ricette.has(m.id)).map((m) => 'mob_' + m.id).join(' ')); process.exit(0); }

const ids = new Set(MOBILI.map((m) => m.id)), errs = [];
for (const r of ricette) if (!ids.has(r)) errs.push(`ricetta mob_${r}: nessun mobile con id «${r}» in mobili.json`);
for (const m of MOBILI) if (!testi[m.id]) errs.push(`${m.id}: manca la descrizione in mobili_testi.json`);
for (const t of Object.keys(testi)) if (!ids.has(t)) errs.push(`mobili_testi.json: «${t}» non è un mobile`);
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('id', 28)}${pad('celle', 7)}${pad('posto', 8)}${pad('testo', 7)}${pad('ricetta', 9)}modello`);
for (const m of MOBILI) console.log(`${pad(m.id, 28)}${pad((m.celle ?? [1, 1]).join('x'), 7)}${pad(m.posto, 8)}${pad(testi[m.id] ? 'si' : 'NO', 7)}${pad(ricette.has(m.id) ? 'si' : '-', 9)}${modelli.has(m.id) ? 'si' : '-'}`);
const n = (f) => MOBILI.filter(f).length;
console.log(`\n${MOBILI.length} mobili · ${n((m) => ricette.has(m.id))} con ricetta · ${n((m) => modelli.has(m.id))} con modello nel gioco · da generare con Blender: ${n((m) => ricette.has(m.id) && !modelli.has(m.id))}`);
for (const e of errs) console.error('ERRORE: ' + e);
process.exit(errs.length ? 1 : 0);
