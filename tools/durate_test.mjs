#!/usr/bin/env node
// Rimisura le durate delle suite e2e dai registri dell'ultima suite completa riuscita su GitHub e riscrive tests/durate.json,
// da cui tests/shard.mjs fa i gruppi paralleli. Serve solo quando i gruppi diventano sbilanciati: una suite nuova non lo richiede.
// Uso: node tools/durate_test.mjs [--run <id>] [--prova]   (--prova stampa e basta). Richiede `gh` col login.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const gh = (...a) => execFileSync('gh', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

// l'ultima run dei Controlli riuscita in cui gli e2e sono girati davvero (non una PR di soli documenti)
function ultimaRun() {
  const runs = JSON.parse(gh('run', 'list', '--workflow', 'pr.yml', '--status', 'success', '--limit', '30', '--json', 'databaseId'));
  for (const { databaseId } of runs) {
    const jobs = JSON.parse(gh('run', 'view', String(databaseId), '--json', 'jobs')).jobs;
    if (jobs.some((j) => j.name.startsWith('e2e') && j.conclusion === 'success')) return databaseId;
  }
  throw new Error('nessuna run dei Controlli con gli e2e riusciti negli ultimi 30');
}
const ri = args.indexOf('--run');
const id = ri >= 0 ? Number(args[ri + 1]) : ultimaRun();

// ogni riga del registro: «job \t passo \t 2026-10-19T12:00:00.0000000Z testo». Una suite inizia con «▶ nome» e finisce alla successiva.
const righe = new Map();
for (const line of gh('run', 'view', String(id), '--log').split('\n')) {
  const [job, , resto = ''] = line.split('\t');
  const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?)Z\s?(.*)$/.exec(resto);
  if (!m) continue;
  if (!righe.has(job)) righe.set(job, []);
  righe.get(job).push({ t: Date.parse(m[1] + 'Z'), testo: m[2].replace(/\x1b\[[0-9;]*m/g, '').trim() });
}
const durate = {};
for (const lista of righe.values()) {
  const inizi = lista.filter((r) => r.testo.startsWith('▶ ')).map((r) => ({ t: r.t, suite: r.testo.slice(2).trim() }));
  inizi.forEach((s, k) => {
    const fine = k + 1 < inizi.length ? inizi[k + 1].t : Math.max(...lista.filter((r) => r.t >= s.t && /\b(PASS|FAIL|WARN)\b/.test(r.testo)).map((r) => r.t), s.t);
    durate[s.suite] = Math.max(durate[s.suite] ?? 0, Math.round((fine - s.t) / 1000)); // una suite riprovata conta una volta
  });
}
const esistono = new Set(fs.readdirSync(path.join(ROOT, 'tests/e2e')).filter((f) => f.endsWith('.mjs')).map((f) => f.replace('.mjs', '')));
const tenute = Object.fromEntries(Object.entries(durate).filter(([s]) => esistono.has(s) && s !== 'boot').sort(([a], [b]) => a.localeCompare(b)));
const json = '{\n' + Object.entries(tenute).map(([s, v]) => `  "${s}": ${v}`).join(',\n') + '\n}\n';
console.log(`run ${id}: ${Object.keys(tenute).length} suite, ${Math.round(Object.values(tenute).reduce((a, b) => a + b, 0) / 60)} min in tutto`);
if (args.includes('--prova')) console.log(json);
else { fs.writeFileSync(path.join(ROOT, 'tests/durate.json'), json); console.log('scritto tests/durate.json'); }
