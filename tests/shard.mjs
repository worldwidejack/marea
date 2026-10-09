#!/usr/bin/env node
// Divide le suite e2e in N gruppi di durata simile per farle girare in parallelo su GitHub (deploy.yml).
// Uso: node tests/shard.mjs <i> <n>  → stampa le suite del gruppo i (0…n−1); il gruppo 0 ha anche static, types e sim.
// Durate: secondi misurati in locale l'8 ott 2026 (su GitHub ~2-3× tanto); una suite nuova senza misura vale 60.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DURATE = {
  boot: 25, look: 30, perf: 25, wp1_look: 40, wp2_model: 30, wp2_move: 30, wp4_net: 60,
  m1_editor: 45, m1_emote: 50, m1_feed: 65, m1_integrazione: 20, m1_isola: 56, m1_mondo: 40, m1_regata: 52, m1_scacchi: 15, m1_server: 15, m1_server_f3: 20, m1_solo: 45, m1_tavolo: 60,
  m2_dungeon: 180, m2_eroe: 120, m2_insieme: 60, m2_impostazioni: 95, m2_minimappa: 30, m2_server: 90,
  m3_animali: 75, m3_foto: 40, m3_porto_amici: 60, m3_decorazioni: 65, m3_emote: 40, m3_meteo: 30, m3_rientro: 20, m3_diario: 45, m3_app: 45, m3_consegne_ingorgo: 90, m3_giochi_ghiacci_giardino: 120, m3_giochi_tempesta_vulcano: 110, m3_interfaccia: 75, m3_isole: 165, m3_perle: 40, m3_pesca: 45, m3_porto: 50, m3_prestazioni: 200, m3_suoni: 20,
  m3_barca: 48, // #107: ~30 s in locale × 1,6
  m4_templari: 75, m4_templari_server: 60, m4_corse: 130, // Templari (#137): ~45 s in locale × 1,6
};
const [i, n] = process.argv.slice(2).map(Number);
if (!Number.isInteger(i) || !Number.isInteger(n) || n < 1 || i < 0 || i >= n) { console.error('uso: node tests/shard.mjs <i> <n>'); process.exit(2); }
const suites = fs.readdirSync(path.join(ROOT, 'tests/e2e')).filter((f) => f.endsWith('.mjs')).map((f) => f.replace('.mjs', '')).sort();
const gruppi = Array.from({ length: n }, () => ({ s: 0, l: [] }));
gruppi[0].s += 10; // static, types, sim
for (const s of [...suites].sort((a, b) => (DURATE[b] ?? 60) - (DURATE[a] ?? 60) || a.localeCompare(b))) {
  const g = gruppi.reduce((a, b) => (b.s < a.s ? b : a));
  g.l.push(s); g.s += DURATE[s] ?? 60;
}
console.log([...(i === 0 ? ['static', 'types', 'sim'] : []), ...gruppi[i].l].join(' '));
