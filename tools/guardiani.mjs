#!/usr/bin/env node
// Guardiani: le regole che tengono MAREA in ordine. Girano dentro la suite `static` (check_static.mjs li chiama), così ogni AI se li trova davanti.
//  1. file e export che nessuno usa          4. pagine dei banchi di prova solo se registrate in apps/client/banchi.json
//  2. tetto di 400 righe per file            5. tetti dei documenti: CLAUDE.md 6k caratteri, docs/MAPPA.md 8k, gli altri 40k
//  3. lettura dell'URL solo in flags.ts      6. ogni cartella del codice ha la sua riga in docs/MAPPA.md
//  7. nei commenti nuovi (righe aggiunte rispetto a origin/main) niente numeri di PR, date o «deciso da Jack»: vanno nella PR
// Dove oggi c'è già una violazione, sta in tools/guardiani_eccezioni.json col suo numero: si tollera finché non peggiora.
// Un'eccezione non serve più (file sparito o tornato in regola)? È solo un avviso: toglierla non è urgente, e così non nascono conflitti.
// Uso: node tools/guardiani.mjs              controlla (stampa FAIL/WARN, exit 1 se ci sono errori)
//      node tools/guardiani.mjs --aggiorna   stringe le eccezioni a quanto c'è oggi e toglie quelle inutili; non ne aggiunge mai
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ECCEZIONI = path.join(ROOT, 'tools/guardiani_eccezioni.json');
const MAX_RIGHE = 400;
const TETTI_DOC = { 'CLAUDE.md': 6000, 'docs/MAPPA.md': 8000 }, TETTO_DOC = 40000;
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const leggi = (r) => fs.readFileSync(path.join(ROOT, r), 'utf8');
const walk = (d, re) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (['node_modules', 'dist', 'out', '.wrangler'].includes(e.name) ? [] : walk(path.join(d, e.name), re)) : re.test(e.name) && !e.name.endsWith('.d.ts') ? [rel(path.join(d, e.name))] : []) : [];
// lo stesso lettore dei commenti di check_static: le stringhe restano, i commenti spariscono (a capo compresi)
const strip = (s) => s.replace(/("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m, str) => str ?? m.replace(/[^\n]/g, ''));

// ---- il grafo degli import ----
// codice controllato: i pacchetti e le due app. Chi usa e basta: test, strumenti, configurazione di vite.
const SORGENTI = ['apps/client/src', 'apps/server/src', 'packages/content/src', 'packages/protocol/src', 'packages/sim/src'].flatMap((d) => walk(path.join(ROOT, d), /\.(ts|mts)$/));
const UTENTI = [...walk(path.join(ROOT, 'packages'), /\.test\.ts$/), ...walk(path.join(ROOT, 'tests'), /\.m?js$/), ...walk(path.join(ROOT, 'tools'), /\.m?js$/), 'apps/client/vite.config.ts'].filter((f) => fs.existsSync(path.join(ROOT, f)));
// ingressi: le pagine html del client e il Worker del server (le sue classi le aggancia wrangler)
const PAGINE = fs.readdirSync(path.join(ROOT, 'apps/client')).filter((f) => f.endsWith('.html'));
const INGRESSI = new Set(['apps/server/src/worker.ts', ...PAGINE.flatMap((p) => [...leggi('apps/client/' + p).matchAll(/<script[^>]*\bsrc="\/(src\/[^"]+)"/g)].map((m) => 'apps/client/' + m[1]))]);

const SET = new Set(SORGENTI);
function risolvi(da, spec) {
  spec = spec.split('?')[0];
  let r;
  if (spec.startsWith('.')) r = rel(path.resolve(ROOT, path.dirname(da), spec));
  else if (spec.startsWith('@marea/')) {
    const [, pkg, ...resto] = spec.split('/');
    const base = fs.existsSync(path.join(ROOT, 'packages', pkg)) ? `packages/${pkg}/src` : `apps/${pkg}/src`;
    r = resto.length ? `${base}/${resto.join('/')}` : `${base}/index.ts`;
  } else return null;
  return SET.has(r) ? r : null;
}
const globRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '(?:.*/)?').replace(/\*/g, '[^/]*') + '$');

/** cosa importa ogni file: [{ a, nomi: Set | 'tutto' }] e cosa riesporta. */
function analizza(f) {
  const code = strip(leggi(f)), usi = [], stelle = [], riesporta = [];
  const usa = (spec, nomi) => { const a = risolvi(f, spec); if (a) usi.push({ a, nomi }); };
  const nomiDi = (lista) => new Set(lista.split(',').map((s) => s.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()).filter(Boolean));
  for (const m of code.matchAll(/\bimport\s+(type\s+)?([^'"();]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
    const cosa = m[2];
    if (/\*\s+as\s+/.test(cosa)) { usa(m[3], 'tutto'); continue; }
    const nomi = new Set(), graffe = cosa.match(/\{([^}]*)\}/);
    if (graffe) for (const n of nomiDi(graffe[1])) nomi.add(n);
    if (/^\s*[A-Za-z_$][\w$]*\s*(,|$)/.test(cosa.replace(/^type\s+/, ''))) nomi.add('default');
    usa(m[3], nomi);
  }
  for (const m of code.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) usa(m[1], 'tutto');
  for (const m of code.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) usa(m[1], 'tutto');
  for (const m of code.matchAll(/new\s+URL\s*\(\s*['"]([^'"]+\.ts)['"]\s*,\s*import\.meta\.url/g)) usa(m[1], 'tutto');
  // test e strumenti caricano i moduli anche per percorso: import(pathToFileURL(path.join(ROOT, 'packages/sim/src/…ts')))
  if (!SET.has(f)) for (const m of code.matchAll(/['"`](?:\.\.\/)*((?:packages|apps)\/[\w/.-]+\.ts)['"`]/g)) if (SET.has(m[1])) usi.push({ a: m[1], nomi: 'tutto' });
  for (const m of code.matchAll(/import\.meta\.glob\s*(?:<[^>]*>)?\s*\(\s*(\[[^\]]*\]|['"][^'"]+['"])/g)) {
    for (const g of [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1])) {
      const re = globRe(rel(path.resolve(ROOT, path.dirname(f), g)));
      for (const s of SORGENTI) if (re.test(s)) usi.push({ a: s, nomi: 'tutto' });
    }
  }
  for (const m of code.matchAll(/\bexport\s+(type\s+)?\*\s*(?:as\s+(\w+)\s+)?from\s*['"]([^'"]+)['"]/g)) {
    const a = risolvi(f, m[3]);
    if (a && m[2]) riesporta.push({ nome: m[2], a, orig: '*' }); else if (a) stelle.push(a);
  }
  for (const m of code.matchAll(/\bexport\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const a = risolvi(f, m[3]);
    if (a) for (const parte of m[2].split(',').map((s) => s.trim().replace(/^type\s+/, '')).filter(Boolean)) {
      const [orig, nome = orig] = parte.split(/\s+as\s+/).map((s) => s.trim());
      riesporta.push({ nome, a, orig });
    }
  }
  // export propri
  // export propri, coi tipi a parte: un tipo esportato e usato solo nel suo file è documentazione, non codice morto
  const propri = new Set(), tipi = new Set();
  for (const m of code.matchAll(/\bexport\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(function\*?|class|const|let|var|type|interface)\s+([A-Za-z_$][\w$]*)/g)) { propri.add(m[2]); if (m[1] === 'type' || m[1] === 'interface') tipi.add(m[2]); }
  if (/\bexport\s+default\b/.test(code)) propri.add('default');
  for (const m of code.matchAll(/\bexport\s+(type\s+)?\{([^}]*)\}(?!\s*from)/g)) for (const parte of m[2].split(',').map((s) => s.trim()).filter(Boolean)) {
    const nome = parte.replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
    propri.add(nome); if (m[1] || parte.startsWith('type ')) tipi.add(nome);
  }
  const morto = (n) => tipi.has(n) && (code.match(new RegExp(`\\b${n.replace(/\$/g, '\\$')}\\b`, 'g')) ?? []).length <= 1;
  return { usi, stelle, riesporta, propri, tipi, morto };
}

function grafo() {
  const info = new Map([...SORGENTI, ...UTENTI].map((f) => [f, analizza(f)]));
  const usati = new Map(SORGENTI.map((f) => [f, new Set()])), tuttoUsato = new Set();
  const segna = (f, nome, visti = new Set()) => {
    const k = f + ':' + nome; if (visti.has(k)) return; visti.add(k);
    const i = info.get(f); if (!i) return;
    if (nome === 'tutto') {
      if (tuttoUsato.has(f)) return; tuttoUsato.add(f);
      for (const n of i.propri) usati.get(f).add(n);
      for (const r of i.riesporta) { usati.get(f).add(r.nome); segna(r.a, r.orig === '*' ? 'tutto' : r.orig, visti); }
      for (const s of i.stelle) segna(s, 'tutto', visti);
      return;
    }
    usati.get(f).add(nome);
    const r = i.riesporta.find((x) => x.nome === nome);
    if (r) segna(r.a, r.orig === '*' ? 'tutto' : r.orig, visti);
    else if (!i.propri.has(nome)) for (const s of i.stelle) segna(s, nome, visti);
  };
  for (const f of INGRESSI) if (info.has(f)) segna(f, 'tutto');
  for (const [, i] of info) for (const u of i.usi) {
    if (u.nomi === 'tutto') segna(u.a, 'tutto'); else for (const n of u.nomi) segna(u.a, n);
  }
  // file raggiungibili: dagli ingressi e da test e strumenti, seguendo gli import
  const raggiunti = new Set(), coda = [...INGRESSI, ...UTENTI];
  while (coda.length) {
    const f = coda.pop(); if (raggiunti.has(f)) continue; raggiunti.add(f);
    const i = info.get(f); if (!i) continue;
    for (const u of i.usi) coda.push(u.a);
    for (const r of i.riesporta) coda.push(r.a);
    coda.push(...i.stelle);
  }
  const fileInutili = SORGENTI.filter((f) => !raggiunti.has(f));
  const exportInutili = {};
  for (const f of SORGENTI) {
    if (!raggiunti.has(f) || INGRESSI.has(f)) continue;
    const i = info.get(f), via = [...i.propri, ...i.riesporta.map((r) => r.nome)].filter((n) => !usati.get(f).has(n) && (!i.tipi.has(n) || i.morto(n)));
    if (via.length) exportInutili[f] = [...new Set(via)].sort();
  }
  return { fileInutili, exportInutili };
}

// ---- le misure di oggi ----
export function misura() {
  const { fileInutili, exportInutili } = grafo();
  const righe = {};
  for (const f of SORGENTI) { const n = leggi(f).split('\n').length; if (n > MAX_RIGHE) righe[f] = n; }
  const url = {};
  for (const f of SORGENTI) {
    if (!f.startsWith('apps/client/src/') || f === 'apps/client/src/flags.ts') continue;
    const n = strip(leggi(f)).split('\n').filter((r) => /\blocation\s*\.\s*search\b|\bURLSearchParams\b|\bsearchParams\b/.test(r)).length;
    if (n) url[f] = n;
  }
  const documenti = {};
  const docs = [...fs.readdirSync(ROOT).filter((f) => f.endsWith('.md') && !f.startsWith('_')), ...fs.readdirSync(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.md')).map((f) => 'docs/' + f)];
  for (const d of docs) { const n = leggi(d).replace(/\r\n/g, '\n').length, tetto = TETTI_DOC[d] ?? TETTO_DOC; if (n > tetto) documenti[d] = n; }
  return { file: fileInutili, export: exportInutili, righe, url, documenti };
}

// ---- controlli senza eccezioni ----
function banchi(errs) {
  const f = 'apps/client/banchi.json';
  if (!fs.existsSync(path.join(ROOT, f))) { errs.push(`${f}: manca l'elenco dei banchi di prova`); return; }
  let lista; try { lista = JSON.parse(leggi(f)); } catch (e) { errs.push(`${f}: JSON rotto (${e.message})`); return; }
  const registrate = new Set();
  for (const b of lista) {
    if (!b.pagina || !b.cosa || !b.chi) errs.push(`${f}: ogni banco vuole pagina, cosa e chi (${JSON.stringify(b)})`);
    if (registrate.has(b.pagina)) errs.push(`${f}: ${b.pagina} registrata due volte`);
    registrate.add(b.pagina);
    if (!PAGINE.includes(b.pagina)) errs.push(`${f}: ${b.pagina} non esiste in apps/client/`);
  }
  for (const p of PAGINE) if (p !== 'index.html' && !registrate.has(p)) errs.push(`apps/client/${p}: banco di prova non registrato in ${f} (pagina, a cosa serve, di chi)`);
}
function mappa(errs) {
  if (!fs.existsSync(path.join(ROOT, 'docs/MAPPA.md'))) { errs.push('docs/MAPPA.md: manca la mappa del codice'); return; }
  const testo = leggi('docs/MAPPA.md');
  const cartelle = ['apps/client/src', 'apps/server/src', 'apps/server', 'packages/content/src', 'packages/protocol/src', 'packages/sim/src', 'tests', 'tools']
    .flatMap((d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).filter((e) => e.isDirectory() && !['node_modules', 'dist', 'out', '.wrangler', 'test'].includes(e.name) || (e.isDirectory() && e.name === 'test' && d === 'apps/client/src')).map((e) => `${d}/${e.name}`));
  for (const c of cartelle) if (!testo.includes(path.basename(c) + '/') && !testo.includes(path.basename(c) + '*')) errs.push(`${c}/: cartella senza riga in docs/MAPPA.md (aggiungila nella stessa PR)`);
}
// cosa non va nei commenti: numeri di PR o issue, date, «deciso da Jack». Una riga ritoccata che li aveva già non conta: conta solo quello che è nuovo.
const SPIE = [
  [/(?:^|[^&\w])(#\d{2,4})\b/g, 'un numero di PR o issue', 'il perché va nella descrizione della PR'],
  [/\b(\d{1,2}\s+(?:gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*)\b/gi, 'una data', 'la storia sta in git e nelle PR'],
  [/\b(decis[oa]\s+(?:da|con)\s+jack|jack\s+ha\s+(?:deciso|scelto))/gi, '«deciso da Jack»', 'le decisioni vanno nella PR («Decisioni prese»)'],
];
const commentoDi = (riga) => riga.match(/(?:\/\/|\/\*|^[+-]\s*\*)(.*)$/)?.[1] ?? '';
function commentiNuovi(errs) {
  const base = spawnSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: ROOT, encoding: 'utf8' });
  if (base.status !== 0) return; // niente storia (copia senza git o checkout corto): si salta
  const d = spawnSync('git', ['diff', '-U0', '--no-color', base.stdout.trim(), '--', 'apps', 'packages', 'tools', 'tests'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const perFile = new Map(); // file → spie nelle righe tolte, e quelle nelle righe aggiunte
  let file = '';
  for (const riga of (d.stdout || '').split('\n')) {
    if (riga.startsWith('--- ')) continue;
    if (riga.startsWith('+++ ')) { file = riga.slice(6); continue; }
    if (!/^[+-]/.test(riga) || !/\.(ts|mts|mjs|js)$/.test(file) || file === 'tools/guardiani.mjs') continue; // lui le regole le cita
    const f = perFile.get(file) ?? { via: new Set(), nuove: [] };
    perFile.set(file, f);
    const commento = commentoDi(riga);
    SPIE.forEach(([re], k) => {
      for (const m of commento.matchAll(re)) {
        const spia = m[1].toLowerCase();
        if (riga[0] === '-') f.via.add(spia); else f.nuove.push({ spia, k, commento });
      }
    });
  }
  for (const [file, f] of perFile) for (const { spia, k, commento } of f.nuove) {
    if (f.via.has(spia)) continue;
    const [, cosa, dove] = SPIE[k];
    errs.push(`${file}: commento nuovo con ${cosa} («${commento.trim().slice(0, 60)}»): ${dove}`);
  }
}

// ---- confronto con le eccezioni ----
export function guardiani() {
  const errs = [], warns = [];
  const ecc = fs.existsSync(ECCEZIONI) ? JSON.parse(fs.readFileSync(ECCEZIONI, 'utf8')) : {};
  const oggi = misura();
  const fileOk = new Set(ecc.file ?? []);
  for (const f of oggi.file) if (!fileOk.has(f)) errs.push(`${f}: file che nessuno importa (toglilo, o importalo da dove serve)`);
  for (const f of fileOk) if (!oggi.file.includes(f)) warns.push(`guardiani_eccezioni.json: «${f}» non è più un file inutile, si può togliere dalla lista (node tools/guardiani.mjs --aggiorna)`);
  for (const [f, nomi] of Object.entries(oggi.export)) {
    const ok = new Set(ecc.export?.[f] ?? []);
    const nuovi = nomi.filter((n) => !ok.has(n));
    if (nuovi.length) errs.push(`${f}: export che nessuno usa: ${nuovi.join(', ')} (toglili, o togli «export» se servono solo qui)`);
  }
  for (const [f, nomi] of Object.entries(ecc.export ?? {})) if (nomi.some((n) => !oggi.export[f]?.includes(n))) warns.push(`guardiani_eccezioni.json: export di ${f} tornati in uso o spariti (node tools/guardiani.mjs --aggiorna)`);
  const tetti = [['righe', (f, n, max) => max ? `${f}: ${n} righe, più delle ${max} di quando sono nati i guardiani (il file non può crescere: sposta codice in un file nuovo)` : `${f}: ${n} righe (> ${MAX_RIGHE}: spezza il file)`],
    ['url', (f, n, max) => `${f}: legge l'URL (location.search / URLSearchParams) in ${n} righe${max ? `, più delle ${max} tollerate` : ''}: gli interruttori ?parametro= vanno in flags.ts`],
    ['documenti', (f, n, max) => `${f}: ${n} caratteri, ${max ? `più dei ${max} di oggi (il documento non può crescere: accorcialo)` : `oltre il tetto di ${TETTI_DOC[f] ?? TETTO_DOC}`}`]];
  for (const [chiave, msg] of tetti) {
    for (const [f, n] of Object.entries(oggi[chiave])) { const max = ecc[chiave]?.[f]; if (!max || n > max) errs.push(msg(f, n, max)); }
    for (const f of Object.keys(ecc[chiave] ?? {})) if (!(f in oggi[chiave])) warns.push(`guardiani_eccezioni.json: ${f} è tornato in regola (${chiave}), si può togliere dalla lista`);
  }
  banchi(errs); mappa(errs); commentiNuovi(errs);
  return { errs, warns, oggi, ecc };
}

/** --aggiorna: stringe le eccezioni (mai più larghe di oggi), toglie quelle inutili, non ne aggiunge. Senza file, fa la prima foto. */
function aggiorna() {
  const prima = fs.existsSync(ECCEZIONI) ? JSON.parse(fs.readFileSync(ECCEZIONI, 'utf8')) : null;
  const oggi = misura();
  const out = { _come: 'Violazioni di quando sono nati i guardiani (tools/guardiani.mjs): si tollerano finché non peggiorano. Si stringono con node tools/guardiani.mjs --aggiorna; a mano si tolgono, non si aggiungono.' };
  out.file = oggi.file.filter((f) => !prima || (prima.file ?? []).includes(f));
  out.export = Object.fromEntries(Object.entries(oggi.export).map(([f, nomi]) => [f, prima ? nomi.filter((n) => (prima.export?.[f] ?? []).includes(n)) : nomi]).filter(([, nomi]) => nomi.length));
  for (const k of ['righe', 'url', 'documenti']) out[k] = Object.fromEntries(Object.entries(oggi[k]).filter(([f]) => !prima || prima[k]?.[f]).map(([f, n]) => [f, prima ? Math.min(n, prima[k][f]) : n]));
  fs.writeFileSync(ECCEZIONI, JSON.stringify(out, null, 1) + '\n');
  const conta = (o) => (o.file?.length ?? 0) + Object.values(o.export ?? {}).flat().length + Object.keys(o.righe ?? {}).length + Object.keys(o.url ?? {}).length + Object.keys(o.documenti ?? {}).length;
  console.log(`[guardiani] eccezioni: ${prima ? conta(prima) : '—'} → ${conta(out)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--aggiorna')) aggiorna();
  else {
    const { errs, warns } = guardiani();
    for (const w of warns) console.log('WARN', w);
    for (const e of errs) console.log('FAIL', e);
    console.log(`[guardiani] ${errs.length} errori, ${warns.length} avvisi`);
    process.exit(errs.length ? 1 : 0);
  }
}
