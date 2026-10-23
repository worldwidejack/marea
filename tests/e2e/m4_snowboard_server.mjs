// Snowboard lato server (docs/ADRENALINA.md §7-§9, passo 3b; CONTRACTS §42). Tre amici su wrangler dev locale (come m4_templari_server):
// le discese si giocano qui in Node col pilota della sim e si consegnano a /api/solo/play; il DO del lotto le rigioca e paga la medaglia dalla
// classifica a tempo della pista (oro = batti il record o sei il primo, argento secondo, bronzo terzo), la discesa migliore di ciascuno entra in
// classifica e quella del primo è il fantasma (GET /api/adrenalina/fantasma, con gli input da rigiocare). Il Worker passa la classifica al
// lotto anche se il client non manda il suggerimento (409 `classifica` → riprova). Il tabellone del Porto ha lo snowboard.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 300000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WIN = process.platform === 'win32'; // su Windows npx va lanciato dalla shell

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m4sb-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000, shell: WIN }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { snowboard, pilotaSnowboard } = await sim('minigames/snowboard.ts');
  const { packInputs, quantize } = await sim('replay.ts');
  const leggi = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const ORO = leggi('balance.json').solo.premi.oro + (leggi('minigames/snowboard.json').premioExtra?.oro ?? 0); // monete (#414)
  const PISTA = 'snowboard_blu';
  /** Una discesa intera col pilota: `pigro` = senza trick; `lento` = i primi tick a curve strette (si perde velocità). */
  const discesa = (pigro, lento = 0) => {
    const s = snowboard.create({ seed: 1, difficulty: 1, opzioni: { pista: PISTA } }), frames = [];
    while (!s.done) {
      const f = quantize(s.tick < lento ? { mx: s.tick % 40 < 20 ? 1 : -1, my: 0, a: false, b: false } : pilotaSnowboard(s, pigro));
      frames.push(f); snowboard.step(s, f);
    }
    return { inputs: packInputs(frames), r: snowboard.result(s) };
  };

  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    const sql = path.join(persist, 'persone.sql'); // da file: su Windows la shell spezzerebbe il comando
    fs.mkdirSync(persist, { recursive: true });
    fs.writeFileSync(sql, "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tokA', 0), ('bea', 'Bea', 'tokB', 1), ('ciro', 'Ciro', 'tokC', 2);\n");
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--file', sql);
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: !WIN, shell: WIN, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (x) => (log += x)); dev.stderr.on('data', (x) => (log += x));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 160 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const chiama = async (tok, metodo, p, b) => {
      const r = await fetch(base + p, { method: metodo, headers: { 'x-token': tok, 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) });
      return { status: r.status, body: await r.json().catch(() => null) };
    };
    /** Apre la discesa sul server e consegna gli input (col suggerimento di minigioco e pista, o senza). */
    const scendi = async (tok, d, suggerisci = true) => {
      const st = await chiama(tok, 'POST', '/api/solo/start', { minigame: 'snowboard', opzioni: { pista: PISTA } });
      assert(st.status === 200 && typeof st.body.seed === 'number' && st.body.opzioni.pista === PISTA, 'start: ' + JSON.stringify(st.body).slice(0, 200));
      return chiama(tok, 'POST', '/api/solo/play', suggerisci ? { inputs: d.inputs, minigame: 'snowboard', pista: PISTA } : { inputs: d.inputs });
    };
    const veloce = discesa(false), piano = discesa(true), lentissimo = discesa(true, 240);
    assert(veloce.r.detail.finale < piano.r.detail.finale && piano.r.detail.finale < lentissimo.r.detail.finale, `tempi: ${veloce.r.detail.finale} ${piano.r.detail.finale} ${lentissimo.r.detail.finale}`);

    await ctx.test('server: la prima discesa della pista prende l’oro (nessuno davanti), il premio dell’oro in monete, ed è il fantasma', async () => {
      const r = await scendi('tokA', veloce);
      assert(r.status === 200, 'play: ' + JSON.stringify(r.body).slice(0, 300));
      assert(r.body.medal === 'oro' && r.body.posizione === 1 && r.body.classificati === 0, `ada: ${r.body.medal} ${r.body.posizione} ${r.body.classificati}`);
      assert(r.body.score === veloce.r.score && r.body.detail.finale === veloce.r.detail.finale, 'il replay del server dà un altro tempo');
      assert(r.body.discesa && r.body.discesa.migliorato && r.body.discesa.record, 'discesa non in classifica: ' + JSON.stringify(r.body.discesa));
      assert(r.body.premio === ORO, `premio ${JSON.stringify(r.body.premio)} invece di ${ORO} monete (oro + premio extra)`);
      const f = await chiama('tokB', 'GET', `/api/adrenalina/fantasma?pista=${PISTA}`);
      assert(f.status === 200 && f.body.fantasma && f.body.fantasma.chi === 'ada' && f.body.fantasma.nome === 'Ada', 'fantasma: ' + JSON.stringify(f.body).slice(0, 200));
      assert(f.body.fantasma.ms === veloce.r.detail.finale && JSON.stringify(f.body.fantasma.inputs) === JSON.stringify(veloce.inputs), 'il fantasma non è la discesa di Ada');
    });

    await ctx.test('server: seconda argento (anche senza il suggerimento: il Worker passa la classifica), terzo bronzo', async () => {
      const b = await scendi('tokB', piano, false);
      assert(b.status === 200 && b.body.medal === 'argento' && b.body.posizione === 2 && b.body.discesa.migliorato && !b.body.discesa.record, 'bea: ' + JSON.stringify(b.body).slice(0, 300));
      const c = await scendi('tokC', lentissimo);
      assert(c.status === 200 && c.body.medal === 'bronzo' && c.body.posizione === 3, 'ciro: ' + JSON.stringify(c.body).slice(0, 300));
    });

    await ctx.test('server: chi ha il record e va più piano resta primo ma non peggiora il suo tempo; la classifica è in ordine', async () => {
      const a = await scendi('tokA', piano);
      assert(a.status === 200 && a.body.medal === 'oro' && a.body.posizione === 1 && a.body.discesa.migliorato === false, 'ada di nuovo: ' + JSON.stringify(a.body).slice(0, 300));
      const cl = await chiama('tokC', 'GET', `/api/adrenalina/discese?pista=${PISTA}`);
      assert(cl.status === 200 && cl.body.righe.map((x) => x.nome).join() === 'Ada,Bea,Ciro', 'classifica: ' + JSON.stringify(cl.body).slice(0, 300));
      assert(cl.body.righe[0].ms === veloce.r.detail.finale, 'il record di Ada è peggiorato');
      const f = await chiama('tokC', 'GET', `/api/adrenalina/fantasma?pista=${PISTA}`);
      assert(f.body.fantasma.ms === veloce.r.detail.finale, 'il fantasma è cambiato');
    });

    await ctx.test('server: senza partita aperta 409, pista sconosciuta 400, il tabellone del Porto ha lo snowboard', async () => {
      const r = await chiama('tokA', 'POST', '/api/solo/play', { inputs: veloce.inputs, minigame: 'snowboard', pista: PISTA });
      assert(r.status === 409, 'senza partita: ' + r.status);
      const x = await chiama('tokA', 'GET', '/api/adrenalina/fantasma?pista=boh');
      assert(x.status === 400, 'pista sconosciuta: ' + x.status);
      const t = await chiama('tokA', 'GET', '/api/record');
      const v = t.body.voci.find((q) => q.minigame === 'snowboard');
      assert(v && v.sempre && v.sempre.chi === 'ada', 'tabellone: ' + JSON.stringify(v));
    });
  } finally {
    if (dev) {
      if (WIN) { try { execFileSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* già chiuso */ } }
      else { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già chiuso */ } await sleep(1500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* già chiuso */ } }
    }
    await sleep(500);
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
