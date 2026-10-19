#!/usr/bin/env node
// Riordino di git: toglie i rami e le copie di lavoro (worktree) che non servono più, senza perdere niente.
// Di default stampa solo cosa farebbe; con --fai lo esegue. Il lavoro che non è già in main o in una PR, prima di sparire,
// finisce in un tag archivio/<nome> spinto su GitHub: si recupera con `git switch -c <ramo> archivio/<nome>`.
// Uso: node tools/riordina_git.mjs          elenco di cosa farebbe, non cambia niente
//      node tools/riordina_git.mjs --fai    lo fa
// Regole:
//  - rami su GitHub con PR unita o chiusa: cancellati (la PR ne conserva il contenuto)
//  - rami su GitHub senza PR: i tuoi fermi da più di 7 giorni → archivio e cancellati; quelli degli altri solo elencati
//  - rami locali col ramo su GitHub sparito e PR unita o chiusa: cancellati; mai spinti e fermi da più di 7 giorni → archivio e cancellati
//  - worktree fermi da più di 48 h (file e ultimo commit): lavoro non salvato → commit «salvato dal riordino» e archivio, poi rimossi.
//    Mai la cartella principale, quella da cui lanci lo script, né i worktree toccati nelle ultime 48 h.
//  - «già in main» si decide dal contenuto, non dai commit: le PR si uniscono squash, quindi i commit del ramo in main non ci sono.
//  - il diario di Jack (_STATO.md, _MEMORIA.md) non va mai in un commit; i file ignorati da git che non si rifanno da soli
//    (PNG dei concept, export di Blender, diario) prima di rimuovere un worktree si copiano in ~/.config/marea-riordino/<data>/<worktree>/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const FAI = process.argv.includes('--fai');
const ORA = Date.now(), ORA_MS = 3_600_000, GIORNO = 24 * ORA_MS;
const RAMO_FERMO = 7 * GIORNO, WORKTREE_FERMO = 48 * ORA_MS;
const OGGI = new Date(ORA).toISOString().slice(0, 10);
const DIARIO = ['_STATO.md', '_MEMORIA.md'];
const TROPPO_GRANDE = 90 * 1024 * 1024; // GitHub rifiuta i file oltre 100 MB
const NON_DICONO = new Set(['node_modules', '.git']); // cartelle che non dicono se qualcuno ci sta lavorando
// file ignorati che si rifanno da soli (dipendenze, build, test, cache): spariscono col worktree senza copia
const RIFATTIBILI = /(^|\/)(node_modules|dist|\.wrangler|__pycache__)(\/|$)|^tests\/out(\/|$)|\.(log|pyc)$|(^|\/)\.DS_Store$|(^|\/)\.dev\.vars$|^\.claude\/(settings\.local\.json|scheduled_tasks\.lock|launch\.json|worktrees\/)/;
// prefisso dei rami → utente GitHub: i rami di chi lancia lo script si archiviano, quelli degli altri si elencano e basta
const PERSONE = { jack: 'worldwidejack', riccardo: 'riccardo99altieri', riccardo99altieri: 'riccardo99altieri', birbasan: 'birbasan' };
const BACKUP = path.join(os.homedir(), '.config', 'marea-riordino', OGGI);

function sh(cmd, args, { cwd = QUI, ok = false } = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0 && !ok) throw new Error(`${cmd} ${args.join(' ')}: ${(r.stderr || r.stdout || '').trim()}`);
  return { ok: r.status === 0, out: (r.stdout || '').trim(), raw: r.stdout || '' };
}
const QUI = sh('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd() }).out;
const git = (args, o) => sh('git', args, o);
const righe = (s) => s.split('\n').filter(Boolean);
const giorni = (ms) => (ms < 2 * GIORNO ? `${Math.round(ms / ORA_MS)} h` : `${Math.round(ms / GIORNO)} giorni`);
const mb = (b) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1024 ** 2))} MB`);
const mtime = (p) => { try { return fs.lstatSync(p).mtimeMs; } catch { return 0; } };
const libero = () => { const s = fs.statfsSync(QUI); return s.bavail * s.bsize; };
const COMUNE = path.resolve(QUI, git(['rev-parse', '--git-common-dir']).out);

// ---------- cosa c'è adesso ----------
git(['fetch', 'origin', '--prune', '--tags', '--quiet']);
const IO = sh('gh', ['api', 'user', '-q', '.login']).out;
const MIA_EMAIL = git(['config', 'user.email'], { ok: true }).out;
const MAIN = git(['rev-parse', 'origin/main']).out, MAIN_TREE = git(['rev-parse', 'origin/main^{tree}']).out;
const prs = JSON.parse(sh('gh', ['pr', 'list', '--state', 'all', '--limit', '3000', '--json', 'number,state,headRefName,headRefOid,author']).out);
const prDi = new Map(), prChiusaPerSha = new Map();
for (const p of prs.sort((a, b) => b.number - a.number)) {
  if (!prDi.has(p.headRefName)) prDi.set(p.headRefName, []);
  prDi.get(p.headRefName).push(p);
  if (p.state !== 'OPEN' && !prChiusaPerSha.has(p.headRefOid)) prChiusaPerSha.set(p.headRefOid, p);
}
const statoPr = (p) => `PR #${p.number} ${p.state === 'MERGED' ? 'unita' : 'chiusa'}`;
const remoti = new Map(righe(git(['for-each-ref', '--format=%(refname:lstrip=3) %(objectname)', 'refs/remotes/origin']).out).map((r) => r.split(' ')).filter(([n]) => n !== 'HEAD'));
const locali = righe(git(['for-each-ref', '--format=%(refname:lstrip=2) %(objectname) %(upstream:remotename) %(upstream:lstrip=3)', 'refs/heads']).out).map((r) => { const [nome, sha, remoto, su] = r.split(' '); return { nome, sha, su: remoto === 'origin' ? su : '' }; });
const tag = () => new Map(righe(git(['for-each-ref', '--format=%(refname:lstrip=2) %(objectname) %(*objectname)', 'refs/tags']).out).map((r) => { const [n, obj, sotto] = r.split(' '); return [n, sotto || obj]; }));
const quando = (sha) => Number(git(['log', '-1', '--format=%ct', sha]).out) * 1000;

function leggiWorktree() {
  const lista = []; let w = null;
  for (const r of righe(git(['worktree', 'list', '--porcelain']).out)) {
    if (r.startsWith('worktree ')) lista.push(w = { path: r.slice(9), ramo: '', head: '' });
    else if (r.startsWith('HEAD ')) w.head = r.slice(5);
    else if (r.startsWith('branch ')) w.ramo = r.slice(7).replace(/^refs\/heads\//, '');
    else if (r.startsWith('locked')) w.bloccato = true;
    else if (r.startsWith('prunable')) w.sparito = true;
  }
  return lista;
}

// il file cambiato più di recente (node_modules e .git esclusi)
function ultimaModifica(dir) {
  let t = 0, voci = [];
  try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const v of voci) {
    if (NON_DICONO.has(v.name)) continue;
    const p = path.join(dir, v.name);
    t = Math.max(t, v.isDirectory() ? ultimaModifica(p) : mtime(p));
  }
  return t;
}

// ultima attività: file cambiati, ultimo commit, ultimo movimento di HEAD (commit, switch, reset)
function attivita(w) {
  let gitdir = path.join(w.path, '.git');
  try { const m = fs.readFileSync(gitdir, 'utf8').match(/^gitdir: (.+)$/m); if (m) gitdir = path.resolve(w.path, m[1].trim()); } catch { /* cartella .git vera */ }
  return Math.max(ultimaModifica(w.path), w.head ? quando(w.head) : 0, mtime(path.join(gitdir, 'logs', 'HEAD')));
}

// file non salvati del worktree: [{ file, xy, byte }] (git status -z: i rinomini hanno anche il nome vecchio dopo)
function nonSalvati(w) {
  const pezzi = git(['--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: w.path }).raw.split('\0');
  const out = [];
  for (let i = 0; i < pezzi.length; i++) {
    const e = pezzi[i]; if (!e) continue;
    const xy = e.slice(0, 2), file = e.slice(3), vecchio = xy[0] === 'R' || xy[0] === 'C' ? pezzi[++i] : '';
    let byte = 0; try { byte = fs.lstatSync(path.join(w.path, file)).size; } catch { /* cancellato */ }
    out.push({ file, xy, byte, vecchio });
  }
  return out;
}

// file ignorati da git che non si rifanno da soli: vanno copiati prima di rimuovere il worktree
const preziosi = (w) => righe(git(['ls-files', '--others', '--ignored', '--exclude-standard', '--directory'], { cwd: w.path }).out).filter((f) => !RIFATTIBILI.test(f));

// ---------- il contenuto è già al sicuro? ----------
const cacheMain = new Map();
function giaInMain(sha) {
  if (!cacheMain.has(sha)) {
    let si = git(['merge-base', '--is-ancestor', sha, MAIN], { ok: true }).ok;
    // unire il ramo a main non cambierebbe niente = il suo lavoro è già dentro (anche se è arrivato con uno squash)
    if (!si) { const m = git(['merge-tree', '--write-tree', '--no-messages', MAIN, sha], { ok: true }); si = m.ok && righe(m.out)[0] === MAIN_TREE; }
    cacheMain.set(sha, si);
  }
  return cacheMain.get(sha);
}
// la PR unita o chiusa che ha già tutto il lavoro di sha: stessa punta, o dopo ci sono solo merge di main
function prCheContiene(sha, nome) {
  if (prChiusaPerSha.has(sha)) return prChiusaPerSha.get(sha);
  return (prDi.get(nome) ?? []).find((p) => p.state !== 'OPEN' && git(['cat-file', '-e', `${p.headRefOid}^{commit}`], { ok: true }).ok && !git(['rev-list', '--no-merges', '-n', '1', sha, `^${p.headRefOid}`, `^${MAIN}`]).out);
}
const archiviati = new Map(); // sha → tag (anche quelli solo previsti, nella prova a vuoto)
const ramiArchiviati = new Map(); // ramo → tag, per i worktree salvati con un commit nuovo
function alSicuro(sha, nome, remotiTenuti) {
  if (giaInMain(sha)) return 'già in main';
  const p = prCheContiene(sha, nome);
  if (p) return `nella PR #${p.number}`;
  for (const r of righe(git(['for-each-ref', '--contains', sha, '--format=%(refname:lstrip=3)', 'refs/remotes/origin']).out)) if (remotiTenuti.has(r)) return `sul ramo ${r} di GitHub`;
  if (archiviati.has(sha)) return `nel tag ${archiviati.get(sha)}`;
  if (ramiArchiviati.has(nome)) return `nel tag ${ramiArchiviati.get(nome)}`;
  const t = righe(git(['tag', '--contains', sha]).out)[0];
  return t ? `nel tag ${t}` : null;
}
function diChi(nome, sha) {
  const p = (prDi.get(nome) ?? [])[0];
  if (p) return p.author.login;
  const pre = nome.includes('/') ? nome.split('/')[0] : '';
  if (PERSONE[pre]) return PERSONE[pre];
  return git(['log', '-1', '--format=%ae', sha]).out === MIA_EMAIL ? IO : 'sconosciuto';
}
function nomeTag(nome, sha) {
  const t = tag(); let n = `archivio/${nome}`;
  for (let i = 2; t.has(n) && t.get(n) !== sha; i++) n = `archivio/${nome}-${i}`;
  return n;
}
function archivia(nome, sha, perche) {
  const n = nomeTag(nome, sha);
  if (!tag().has(n)) git(['tag', '-a', n, '-m', `archiviato dal riordino del ${OGGI}: ${perche}`, sha]);
  git(['push', '--quiet', 'origin', `refs/tags/${n}`]);
  archiviati.set(sha, n);
  return n;
}

// ---------- il piano ----------
const tutti = leggiWorktree();
const PRINCIPALE = tutti[0].path;
const prima = { locali: locali.length, remoti: remoti.size, worktree: tutti.length, libero: libero() };
const piano = { worktree: [], remoti: [], locali: [] };

for (const w of tutti) {
  const nome = path.basename(w.path), voce = { w, nome, ramo: w.ramo || '(staccato)' };
  if (w.path === PRINCIPALE) { piano.worktree.push({ ...voce, cosa: 'resta', perche: 'cartella principale' }); continue; }
  if (w.path === QUI) { piano.worktree.push({ ...voce, cosa: 'resta', perche: 'è quella da cui lanci il riordino' }); continue; }
  if (w.bloccato) { piano.worktree.push({ ...voce, cosa: 'resta', perche: 'bloccato (git worktree lock)' }); continue; }
  if (w.sparito) { piano.worktree.push({ ...voce, cosa: 'pota', perche: 'la cartella non c’è più: tolgo solo il riferimento' }); continue; }
  const fermo = ORA - attivita(w);
  if (fermo < WORKTREE_FERMO) { piano.worktree.push({ ...voce, cosa: 'resta', perche: `toccato ${giorni(fermo)} fa` }); continue; }
  // usa e getta anche se il .gitignore vecchio del worktree non li ignora (config del browser dell'app, .pyc)
  const file = nonSalvati(w), daSalvare = file.filter((f) => !DIARIO.includes(f.file) && !RIFATTIBILI.test(f.file));
  const grande = daSalvare.find((f) => f.byte > TROPPO_GRANDE);
  if (grande) { piano.worktree.push({ ...voce, cosa: 'a mano', perche: `fermo da ${giorni(fermo)}, ${grande.file} pesa ${mb(grande.byte)}: troppo per GitHub` }); continue; }
  const copie = [...preziosi(w), ...file.filter((f) => DIARIO.includes(f.file)).map((f) => f.file)], nomeArchivio = w.ramo || `worktree-${nome}`;
  const nota = copie.length ? ` · copio ${copie.join(', ')} in ${path.join(BACKUP, nome)}` : '';
  if (daSalvare.length) {
    piano.worktree.push({ ...voce, cosa: 'salva', nomeArchivio, copie, nota, daSalvare: daSalvare.map((f) => f.file), perche: `fermo da ${giorni(fermo)}, ${daSalvare.length} file non salvati (${mb(daSalvare.reduce((s, f) => s + f.byte, 0))}) → commit + archivio/${nomeArchivio}` });
    if (w.ramo) ramiArchiviati.set(w.ramo, `archivio/${nomeArchivio}`);
  } else piano.worktree.push({ ...voce, cosa: 'rimuovi', nomeArchivio, copie, nota, perche: `fermo da ${giorni(fermo)}` });
}
const inUso = new Map(piano.worktree.filter((v) => (v.cosa === 'resta' || v.cosa === 'a mano') && v.w.ramo).map((v) => [v.w.ramo, v.nome]));

for (const [nome, sha] of remoti) {
  if (nome === 'main') continue;
  const ps = prDi.get(nome) ?? [], aperta = ps.find((p) => p.state === 'OPEN'), stessa = !aperta && prCheContiene(sha, nome);
  const fermo = ORA - quando(sha), chi = diChi(nome, sha), voce = { nome, sha, chi };
  const dopoPr = ps.length ? `commit dopo la ${statoPr(ps[0])}` : 'senza PR';
  if (aperta) piano.remoti.push({ ...voce, cosa: 'resta', perche: `PR aperta #${aperta.number}` });
  else if (stessa) piano.remoti.push({ ...voce, cosa: 'cancella', perche: statoPr(stessa) });
  else if (ps.length && giaInMain(sha)) piano.remoti.push({ ...voce, cosa: 'cancella', perche: `${statoPr(ps[0])}, i commit dopo sono già in main` });
  else if (inUso.has(nome)) piano.remoti.push({ ...voce, cosa: 'resta', perche: `in uso nel worktree ${inUso.get(nome)}` });
  else if (chi !== IO) piano.remoti.push({ ...voce, cosa: 'elenca', perche: `di ${chi}, ${dopoPr}, fermo da ${giorni(fermo)}` });
  else if (fermo <= RAMO_FERMO) piano.remoti.push({ ...voce, cosa: 'resta', perche: `${dopoPr}, fermo da ${giorni(fermo)}` });
  else if (giaInMain(sha)) piano.remoti.push({ ...voce, cosa: 'cancella', perche: `${dopoPr}, fermo da ${giorni(fermo)}, già in main` });
  else piano.remoti.push({ ...voce, cosa: 'archivia', perche: `${dopoPr}, fermo da ${giorni(fermo)} → ${nomeTag(nome, sha)}` });
}
const remotiTenuti = new Set(['main', ...piano.remoti.filter((v) => v.cosa === 'resta' || v.cosa === 'elenca').map((v) => v.nome)]);
for (const v of piano.remoti) if (v.cosa === 'archivia') archiviati.set(v.sha, nomeTag(v.nome, v.sha));
for (const v of piano.worktree.filter((x) => x.cosa === 'rimuovi')) {
  const sicuro = alSicuro(v.w.head, v.w.ramo, remotiTenuti);
  if (sicuro) { v.perche += `, niente di non salvato, ${sicuro}`; continue; }
  v.cosa = 'archivia'; v.perche += `, commit non salvati altrove → ${nomeTag(v.nomeArchivio, v.w.head)}`;
  archiviati.set(v.w.head, nomeTag(v.nomeArchivio, v.w.head));
}
for (const v of piano.worktree) if (v.nota) v.perche += v.nota;

const fermoRamo = (b) => ORA - Math.max(quando(b.sha), mtime(path.join(COMUNE, 'logs', 'refs', 'heads', b.nome)));
for (const b of locali) {
  if (b.nome === 'main') continue;
  const ps = prDi.get(b.nome) ?? [], aperta = ps.find((p) => p.state === 'OPEN'), suGithub = b.su && b.su !== 'main' ? b.su : b.nome;
  const voce = { nome: b.nome, sha: b.sha };
  if (inUso.has(b.nome)) { piano.locali.push({ ...voce, cosa: 'resta', perche: `in uso nel worktree ${inUso.get(b.nome)}` }); continue; }
  if (aperta) { piano.locali.push({ ...voce, cosa: 'resta', perche: `PR aperta #${aperta.number}` }); continue; }
  if (remotiTenuti.has(suGithub)) { piano.locali.push({ ...voce, cosa: 'resta', perche: `c'è il ramo ${suGithub} su GitHub` }); continue; }
  if (git(['merge-base', '--is-ancestor', b.sha, MAIN], { ok: true }).ok) { piano.locali.push({ ...voce, cosa: 'cancella', perche: 'nessun commit suo: è un punto di main' }); continue; }
  const fermo = fermoRamo(b), sicuro = alSicuro(b.sha, b.nome, remotiTenuti), spinto = ps.length > 0 || (b.su && b.su !== 'main');
  if (spinto && sicuro) piano.locali.push({ ...voce, cosa: 'cancella', perche: `${ps.length ? statoPr(ps[0]) : 'ramo su GitHub sparito'}, ${sicuro}` });
  else if (fermo <= RAMO_FERMO) piano.locali.push({ ...voce, cosa: 'resta', perche: `${spinto ? 'commit non salvati altrove' : 'mai spinto'}, fermo da ${giorni(fermo)}` });
  else if (sicuro) piano.locali.push({ ...voce, cosa: 'cancella', perche: `mai spinto, fermo da ${giorni(fermo)}, ${sicuro}` });
  else piano.locali.push({ ...voce, cosa: 'archivia', perche: `${spinto ? 'commit non salvati altrove' : 'mai spinto'}, fermo da ${giorni(fermo)} → ${nomeTag(b.nome, b.sha)}` });
}

// ---------- stampa ----------
const ORDINE = ['salva', 'archivia', 'rimuovi', 'cancella', 'pota', 'a mano', 'elenca', 'resta'];
function stampa(titolo, voci, etichetta) {
  const conta = {}; for (const v of voci) conta[v.cosa] = (conta[v.cosa] || 0) + 1;
  console.log(`\n${titolo} (${voci.length}): ${ORDINE.filter((c) => conta[c]).map((c) => `${c} ${conta[c]}`).join(' · ')}`);
  for (const v of [...voci].sort((a, b) => ORDINE.indexOf(a.cosa) - ORDINE.indexOf(b.cosa) || etichetta(a).localeCompare(etichetta(b)))) console.log(`  ${v.cosa.padEnd(9)} ${etichetta(v)} — ${v.perche}`);
}
console.log(FAI ? 'Riordino git: lo faccio.' : 'Riordino git, prova a vuoto: non cambio niente (per farlo davvero: --fai).');
stampa('WORKTREE', piano.worktree, (v) => `${v.nome} [${v.ramo}]`);
stampa('RAMI SU GITHUB', piano.remoti, (v) => v.nome);
stampa('RAMI LOCALI', piano.locali, (v) => v.nome);
const viaWt = piano.worktree.filter((v) => ['salva', 'archivia', 'rimuovi'].includes(v.cosa));
const spazio = viaWt.length ? righe(sh('du', ['-sk', ...viaWt.map((v) => v.w.path)], { ok: true }).out).reduce((s, r) => s + Number(r.split('\t')[0]) * 1024, 0) : 0;
const via = (voci, cose) => voci.filter((v) => cose.includes(v.cosa)).length;
console.log(`\nNUMERI (prima → ${FAI ? 'dopo' : 'dopo, se lanci --fai'})`);
console.log(`  rami locali      ${prima.locali} → ${prima.locali - via(piano.locali, ['cancella', 'archivia'])}`);
console.log(`  rami su GitHub   ${prima.remoti} → ${prima.remoti - via(piano.remoti, ['cancella', 'archivia'])} (main compreso)`);
console.log(`  worktree         ${prima.worktree} → ${prima.worktree - viaWt.length - via(piano.worktree, ['pota'])} (cartella principale compresa)`);
console.log(`  spazio occupato dalle copie da rimuovere: ${mb(spazio)}`);
if (!FAI) process.exit(0);

// ---------- esecuzione ----------
const errori = [], falliti = new Set();
const prova = (cosa, fn) => { try { fn(); return true; } catch (e) { errori.push(`${cosa}: ${e.message.split('\n')[0]}`); return false; } };
for (const v of viaWt) {
  const ok = prova(`worktree ${v.nome}`, () => {
    for (const f of v.copie.filter((f) => fs.existsSync(path.join(v.w.path, f)))) { const a = path.join(BACKUP, v.nome, f); fs.mkdirSync(path.dirname(a), { recursive: true }); fs.cpSync(path.join(v.w.path, f), a, { recursive: true }); }
    let head = v.w.head;
    if (v.cosa === 'salva') {
      // nel commit solo il lavoro: niente diario, niente file usa e getta, anche se qualcuno li aveva già messi in stage
      git(['reset', '--quiet'], { cwd: v.w.path });
      git(['add', '-A', '--', ...v.daSalvare], { cwd: v.w.path });
      git(['commit', '--quiet', '-m', 'salvato dal riordino', '-m', `worktree ${v.nome}, ${OGGI}`], { cwd: v.w.path });
      head = git(['rev-parse', 'HEAD'], { cwd: v.w.path }).out;
    }
    if (v.cosa !== 'rimuovi') console.log(`  archiviato ${v.nome} → ${archivia(v.nomeArchivio, head, `worktree ${v.nome} (${v.ramo})`)}`);
    // restano solo il diario (già copiato da parte) e i file usa e getta: tornano com'erano, così git lascia rimuovere il worktree
    for (const f of nonSalvati(v.w)) {
      if (!DIARIO.includes(f.file) && !RIFATTIBILI.test(f.file)) throw new Error(`${f.file} non è salvato da nessuna parte: non tocco il worktree`);
      if (f.xy === '??') fs.rmSync(path.join(v.w.path, f.file), { force: true });
      else if (f.xy[0] === 'A') { git(['rm', '--quiet', '--cached', '--', f.file], { cwd: v.w.path }); fs.rmSync(path.join(v.w.path, f.file), { force: true }); }
      else git(['restore', '--staged', '--worktree', '--', f.file], { cwd: v.w.path });
    }
    git(['worktree', 'remove', v.w.path]);
  });
  if (!ok && v.w.ramo) falliti.add(v.w.ramo);
}
if (piano.worktree.some((v) => v.cosa === 'pota')) prova('worktree prune', () => git(['worktree', 'prune']));

for (const v of piano.remoti.filter((x) => x.cosa === 'archivia')) if (!prova(`archivio ${v.nome}`, () => archivia(v.nome, v.sha, `ramo ${v.nome} su GitHub`))) falliti.add(`remoto:${v.nome}`);
const viaRemoti = piano.remoti.filter((v) => (v.cosa === 'cancella' || v.cosa === 'archivia') && !falliti.has(`remoto:${v.nome}`)).map((v) => v.nome);
if (viaRemoti.length && !prova('cancellazione rami su GitHub', () => git(['push', '--quiet', 'origin', '--delete', ...viaRemoti]))) for (const n of viaRemoti) prova(`cancella ${n} su GitHub`, () => git(['push', '--quiet', 'origin', '--delete', n]));

for (const v of piano.locali.filter((x) => x.cosa === 'cancella' || x.cosa === 'archivia')) {
  if (falliti.has(v.nome)) continue;
  prova(`ramo ${v.nome}`, () => {
    const sha = git(['rev-parse', `refs/heads/${v.nome}`]).out;
    if (v.cosa === 'archivia' || (sha !== v.sha && !alSicuro(sha, v.nome, remotiTenuti))) archivia(v.nome, sha, `ramo locale ${v.nome}`);
    git(['branch', '-D', v.nome]); // -D: dopo uno squash git non sa che il ramo è già in main
  });
}

git(['fetch', 'origin', '--prune', '--quiet']);
const conta = (pref) => righe(git(['for-each-ref', '--format=%(refname)', pref]).out).filter((r) => !r.endsWith('/HEAD')).length;
console.log(`\nFATTO\n  rami locali      ${prima.locali} → ${conta('refs/heads')}\n  rami su GitHub   ${prima.remoti} → ${conta('refs/remotes/origin')}\n  worktree         ${prima.worktree} → ${leggiWorktree().length}`);
console.log(`  spazio libero    ${mb(prima.libero)} → ${mb(libero())} (le copie rimosse occupavano ${mb(spazio)})`);
if (fs.existsSync(BACKUP)) console.log(`  file ignorati e diario messi da parte in ${BACKUP}`);
for (const e of errori) console.error(`ERRORE: ${e}`);
process.exit(errori.length ? 1 : 0);
