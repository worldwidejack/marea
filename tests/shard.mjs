#!/usr/bin/env node
// Divide le suite e2e in N gruppi di durata simile, per farle girare in parallelo sulla PR (pr.yml).
// Uso: node tests/shard.mjs <i> <n>  → stampa le suite del gruppo i (0…n−1). `boot` non c'è: gira coi test veloci.
// Durate: secondi misurati su GitHub in tests/durate.json (si rifà con `node tools/durate_test.mjs`); una suite senza misura vale la mediana.
// Una suite nuova non tocca né questo file né durate.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DURATE = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/durate.json'), 'utf8'));
const misure = Object.values(DURATE).sort((a, b) => a - b);
const MEDIANA = misure.length ? misure[Math.floor(misure.length / 2)] : 60;
const durata = (s) => DURATE[s] ?? MEDIANA;

const [i, n] = process.argv.slice(2).map(Number);
if (!Number.isInteger(i) || !Number.isInteger(n) || n < 1 || i < 0 || i >= n) { console.error('uso: node tests/shard.mjs <i> <n>'); process.exit(2); }
const suites = fs.readdirSync(path.join(ROOT, 'tests/e2e')).filter((f) => f.endsWith('.mjs')).map((f) => f.replace('.mjs', '')).filter((s) => s !== 'boot');
// la più lunga va nel gruppo più scarico (a parità, ordine alfabetico: stessi gruppi su ogni macchina)
const gruppi = Array.from({ length: n }, () => ({ s: 0, l: [] }));
for (const s of suites.sort((a, b) => durata(b) - durata(a) || a.localeCompare(b))) {
  const g = gruppi.reduce((a, b) => (b.s < a.s ? b : a));
  g.l.push(s); g.s += durata(s);
}
console.log(gruppi[i].l.join(' '));
