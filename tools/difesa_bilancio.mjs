#!/usr/bin/env node
// Lo strumento di bilanciamento della Difesa (#358; docs/DIFESA.md §3): gioca ogni livello coi tre piloti automatici (bravo, medio,
// distratto) su tanti semi e dice quanto si vince, quanti tosaerba partono, quanto dura, quanta valuta entra, quanti nemici in campo.
// Si confronta coi numeri di PvZ (profilo pvz) e coi nostri (marea): le bande obiettivo sono in DIFESA.md §3.
// Uso: node tools/difesa_bilancio.mjs [--profilo marea|pvz] [--semi 200] [--livelli 1,2,3] [--bravura bravo,medio] [--sopravvivenza]
// Uscita: tabella a schermo + tests/out/difesa_bilancio.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIFESA } from '../packages/content/src/difesa.ts';
import { nuovaPartita, passo } from '../packages/sim/src/difesa/difesa.ts';
import { autopilota, creaBot } from '../packages/sim/src/difesa/bot.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const profilo = arg('--profilo', 'marea'), semi = Number(arg('--semi', 200));
const livelli = (arg('--livelli', DIFESA.livelli.map((l) => l.id).join(','))).split(',').map(Number);
const bravure = arg('--bravura', 'bravo,medio,distratto').split(',');
const sop = process.argv.includes('--sopravvivenza');
const MAX = 60 * 60 * 40;

function gioca(lv, bravura, seme) {
  const s = nuovaPartita(seme, lv, { profilo }), b = creaBot(bravura, seme * 7919 + 13);
  let picco = 0;
  const valuta = [];
  while (!s.esito && s.tick < MAX) {
    passo(s, autopilota(s, b));
    if (s.nemici.length > picco) picco = s.nemici.length;
    if (s.tick % 3600 === 0) valuta.push(s.stats.raccolte);
  }
  return { esito: s.esito || 'tempo', min: s.tick / 3600, tosaerba: s.stats.tosaerba, picco, raccolte: s.stats.raccolte, piantate: s.stats.piantate, mangiate: s.stats.mangiate, ondate: s.ondata, valuta };
}
const media = (a, f) => a.reduce((x, r) => x + f(r), 0) / Math.max(1, a.length);
const righe = [];
const t0 = Date.now();
for (const bravura of bravure) {
  for (const id of sop ? [-1] : livelli) {
    const lv = id < 0 ? -1 : DIFESA.livelli.findIndex((l) => l.id === id);
    const giri = [];
    for (let k = 1; k <= semi; k++) giri.push(gioca(lv, bravura, k));
    const vinte = giri.filter((g) => g.esito === 'vinta').length;
    const r = {
      profilo, bravura, livello: id < 0 ? 'sopravvivenza' : id,
      vinte: Math.round((1000 * vinte) / semi) / 10,
      tosaerba: Math.round(media(giri, (g) => g.tosaerba) * 100) / 100,
      senzaTosaerba: Math.round((1000 * giri.filter((g) => g.esito === 'vinta' && g.tosaerba === 0).length) / semi) / 10,
      minuti: Math.round(media(giri, (g) => g.min) * 10) / 10,
      ondate: Math.round(media(giri, (g) => g.ondate) * 10) / 10,
      picco: Math.round(media(giri, (g) => g.picco) * 10) / 10,
      valutaAlMinuto: Math.round(media(giri, (g) => g.raccolte / Math.max(0.1, g.min))),
      mangiate: Math.round(media(giri, (g) => g.mangiate) * 10) / 10,
    };
    righe.push(r);
    console.log(`${bravura.padEnd(9)} ${String(r.livello).padEnd(13)} vinte ${String(r.vinte).padStart(5)}%  senza tosaerba ${String(r.senzaTosaerba).padStart(5)}%  tosaerba ${r.tosaerba.toFixed(2)}  ${r.minuti} min  ondate ${r.ondate}  picco ${r.picco} nemici  ${r.valutaAlMinuto}/min  mangiate ${r.mangiate}`);
  }
}
fs.mkdirSync(path.join(ROOT, 'tests/out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tests/out/difesa_bilancio.json'), JSON.stringify({ profilo, semi, quando: new Date().toISOString(), righe }, null, 1));
console.log(`(${semi} semi per riga, ${((Date.now() - t0) / 1000).toFixed(1)} s) → tests/out/difesa_bilancio.json`);
