// Isola dei Templari lato server (docs/TEMPLARI.md §10, CONTRACTS «Templari»): POST /api/templari/start apre la partita (seed nel lotto),
// /api/templari/finish rigioca gli input nel DO (giocati qui in Node col pilota della sim: stesso esito e stesso hash) e paga le ondate
// superate (15 Legno, 8 Pietra, 2 Perle a ondata) entro il tetto del giorno; record e partite nel lotto; uscita dal menu = conta come
// cadere; senza partita aperta 409, input rotti 400; hash diverso = solo un avviso nel log. wrangler dev locale come m2_server.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 240000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m4tpl-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { createRng } = await sim('rng.ts');
  const { templari, stepTemplari } = await sim('templari/templari.ts');
  const { encodeDungeon, packDungeon, quantizeDungeon } = await sim('dungeon/replay.ts');
  const { TEMPLARI } = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/content/src/templari.ts')).href);
  /** Una partita col pilota (fino a `ticks`): input come li manda il client. */
  const gioca = (seed, subito, ticks, esci = false) => {
    const s = templari.create({ seed, opzioni: subito ? { subito: true } : {} }), rng = createRng(seed).fork('autopilot'), frames = [];
    while (!s.done && s.tick < ticks) { const f = quantizeDungeon(templari.autopilot(s, rng)); frames.push(f); stepTemplari(s, f); }
    if (esci && !s.done) templari.act(s, { t: 'esci' }); // come fa il client: l'uscita dal menu entra nello stato (e nell'hash)
    return { s, frames, inputs: encodeDungeon(packDungeon(frames)), r: templari.result(s) };
  };

  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tokA', 0);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const hdr = { 'x-token': 'tokA', 'content-type': 'application/json' };
    const post = async (p, b) => { const r = await fetch(base + p, { method: 'POST', headers: hdr, body: typeof b === 'string' ? b : JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const lot = async () => (await (await fetch(base + '/api/lot', { headers: hdr })).json());

    await ctx.test('senza partita aperta: 409; start apre la partita col seed nel lotto', async () => {
      const no = await post('/api/templari/finish', { inputs: '', azioni: [], hash: 0 });
      assert(no.status === 409, 'finish senza start: ' + no.status);
      const st = await post('/api/templari/start', {});
      assert(st.status === 200 && Number.isInteger(st.body.seed) && st.body.subito === false, 'start: ' + JSON.stringify(st.body).slice(0, 160));
      assert(st.body.lot.templari.pending.seed === st.body.seed, 'seed non nel lotto');
      const bad = await post('/api/templari/finish', { inputs: 'rotto!', azioni: [], hash: 0 });
      assert(bad.status === 400, 'input rotti: ' + bad.status);
    });

    await ctx.test('finish: il server rigioca, stesso esito e stesso hash, paga le ondate superate', async () => {
      const l0 = await lot();
      const st = (await post('/api/templari/start', { subito: true })).body;
      assert(st.subito === true, 'subito non tenuto');
      const g = gioca(st.seed, true, 60 * 60 * 3, true);
      const r = await post('/api/templari/finish', { inputs: g.inputs, azioni: [[g.frames.length, { t: 'esci' }]], hash: g.r.hash });
      assert(r.status === 200, 'finish: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
      ctx.log(`ondata ${r.body.result.ondata}, superate ${r.body.result.superate}, premio ${JSON.stringify(r.body.premio)}`);
      assert(r.body.result.esito === 'uscito' && r.body.result.superate === g.r.superate && r.body.result.uccisioni === g.r.uccisioni, 'esito diverso: ' + JSON.stringify(r.body.result));
      const sup = Math.min(TEMPLARI.premio.maxOndate, g.r.superate), pp = TEMPLARI.premio.perOndata;
      assert(sup >= 1, 'il pilota non ha superato ondate');
      assert(r.body.premio.legno === pp.legno * sup && r.body.premio.pietra === pp.pietra * sup && r.body.premio.perle === pp.perle * sup, 'premio: ' + JSON.stringify(r.body.premio));
      assert(r.body.lot.resources.legno === l0.resources.legno + r.body.premio.legno, 'Legno non arrivato nel lotto');
      assert(r.body.lot.templari.pending === null && r.body.lot.templari.record === r.body.result.ondata && r.body.lot.templari.partite >= 1, 'lotto: ' + JSON.stringify(r.body.lot.templari));
      assert(!/templari hash diverso/.test(log), 'hash diverso tra client e server');
      const again = await post('/api/templari/finish', { inputs: g.inputs, azioni: [], hash: g.r.hash });
      assert(again.status === 409, 'la stessa partita si chiude due volte: ' + again.status);
    });

    await ctx.test('tetto del giorno: oltre, si gioca per il record', async () => {
      let preso = 0, tetto = false;
      for (let k = 0; k < 8 && !tetto; k++) {
        const st = (await post('/api/templari/start', { subito: true })).body;
        const g = gioca(st.seed, true, 60 * 60 * 6);
        const r = (await post('/api/templari/finish', { inputs: g.inputs, azioni: [], hash: g.r.hash })).body;
        preso += r.premio.legno; tetto = r.tetto;
      }
      const l = await lot();
      assert(l.templari.preso.legno <= TEMPLARI.premio.tetto.legno, `preso oggi ${l.templari.preso.legno} oltre il tetto`);
      ctx.log(`preso oggi ${JSON.stringify(l.templari.preso)} · tetto raggiunto: ${tetto}`);
    });

    await ctx.test('nessun errore interno nel log di wrangler', async () => {
      assert(!/\[marea\] (lot error|errore)/.test(log), 'errori nel log:\n' + log.split('\n').filter((l) => /\[marea\]/.test(l)).slice(0, 5).join('\n'));
    });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
