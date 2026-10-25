// M2 · armature e armi a vista (#190) sul server locale (wrangler dev) con due giocatori: (1) il server ricava dal personaggio vero quello che si vede addosso
// (armatura, arma, frecce) e lo scrive nel look; nessun altro modo di dirlo; (2) l'amico lo vede sul tuo avatar e si aggiorna quando cambi equipaggiamento;
// (3) il tuo avatar si veste dal personaggio, a piedi con l'arma sulla schiena; fuori dal dungeon al posto dell'armatura si vede il vestito del
// Mercante (game/abiti.ts: la T-shirt di base per chi non ne ha comprati); (4) draw call in budget. Screenshot in tests/out/shots/m2_indossa_*.png.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 300000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m2indossa-${process.pid}`);
  const WIN = process.platform === 'win32';
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, shell: WIN }).toString();

  let dev = null, log = '';
  const pages = [];
  try {
    try { fs.rmSync(persist, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* file ancora aperti su Windows */ }
    fs.mkdirSync(persist, { recursive: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    const sql = path.join(persist, 'persone.sql');
    fs.writeFileSync(sql, "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tokA', 0), ('bea', 'Bea', 'tokB', 1);\n");
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--file', sql);
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: !WIN, shell: WIN, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    const hdr = (t) => ({ 'x-token': t, 'content-type': 'application/json', connection: 'close' });
    const get = async (p, t) => { const r = await fetch(base + p, { headers: hdr(t) }); return { status: r.status, body: await r.json() }; };
    const post = async (p, t, b) => { const r = await fetch(base + p, { method: 'POST', headers: hdr(t), body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const equip = (slot, item) => post('/api/rpg', 'tokA', { azione: { t: 'equip', slot, item } });
    const indossaDi = async (t) => (await get('/api/me', t)).body.look.indossa;
    const J = JSON.stringify;

    await ctx.test('server: il look si riempie da solo con quello che il personaggio ha addosso (equipaggiamento di partenza)', async () => {
      const i = await indossaDi('tokA');
      assert(J(i) === J({ corpo: 'armatura_legno', arma: 'katana_legno', frecce: 'frecce_legno' }), 'indossa di partenza: ' + J(i));
    });

    await ctx.test('server: cambi arma e si aggiorna; togli l’armatura e sparisce; nessuna strada per dire «indosso questo» senza averlo', async () => {
      const r = await equip('arma', 'arco_legno');
      assert(r.status === 200, 'equip: ' + r.status + J(r.body).slice(0, 100));
      assert((await indossaDi('tokA')).arma === 'arco_legno', 'arma nuova non vista');
      // il look si salva dall'editor: l'equipaggiamento resta, e non si può scrivere da lì
      const look = { pelle: 3, capelli: 2, coloreCapelli: 1, vestito: 2, cappello: 0, indossa: { corpo: 'armatura_ossa', arma: 'martello_ossa' } };
      const s = await post('/api/look', 'tokA', look);
      assert(s.status === 200, 'salva look: ' + s.status + J(s.body).slice(0, 100));
      const i = await indossaDi('tokA');
      assert(i.corpo === 'armatura_legno' && i.arma === 'arco_legno', 'l’editor ha cambiato l’equipaggiamento: ' + J(i));
      const t = await post('/api/rpg', 'tokA', { azione: { t: 'equip', slot: 'corpo', item: null } });
      assert(t.status === 200, 'toglie armatura: ' + t.status);
      const i2 = await indossaDi('tokA');
      assert(i2.corpo === undefined && i2.arma === 'arco_legno', 'dopo togli: ' + J(i2));
      const b = await post('/api/rpg', 'tokA', { azione: { t: 'equip', slot: 'corpo', item: 'armatura_legno' } });
      assert(b.status === 200, 'rimette armatura: ' + b.status);
      assert((await indossaDi('tokA')).corpo === 'armatura_legno', 'armatura rimessa');
      assert((await indossaDi('tokB')).corpo === 'armatura_legno', 'anche Bea parte con la tela addosso');
    });

    const open = async (tok, viewport) => {
      const pg = await ctx.B.openPage(ctx.browser, `${base}/?t=${tok}&test=1`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      await pg.page.route((u) => /^\/(api|chunk|assets)/.test(u.pathname), (r) => r.continue({ headers: { ...r.request().headers(), connection: 'close' } }));
      await ctx.waitReady(pg.page, 40000);
      await ctx.waitState(pg.page, (s) => s.net && s.net.status === 'on', 30000);
      return pg;
    };
    const A = await open('tokA', ctx.B.DESKTOP), B = await open('tokB', ctx.B.DESKTOP);
    const peerAda = (pg) => pg.page.evaluate(() => window.__game.test.peerIndossa('ada'));
    const waitPeer = async (fn, what) => {
      let v = null;
      for (let i = 0; i < 80; i++) { v = await peerAda(B); if (v && fn(v)) return v; await sleep(250); }
      throw new Error(`Bea non vede ${what}: ${J(v)}`);
    };

    await ctx.test('amico: Bea vede addosso ad Ada il vestito (non la tela) e l’arco sulla schiena con la faretra', async () => {
      const v = await waitPeer((x) => x.corpo === null && x.arma === 'arco_legno' && x.faretra, 'vestito + arco + faretra');
      assert(v.tri > 100, 'triangoli dell’equipaggiamento: ' + v.tri);
    });

    await ctx.test('tu: Ada si veste dal suo personaggio (a piedi, arma sulla schiena)', async () => {
      await ctx.waitState(A.page, (s) => s.wp2_avatar && s.wp2_avatar.vestito && s.wp2_avatar.vestito.corpo === null && s.wp2_avatar.vestito.arma === 'arco_legno' && s.wp2_avatar.abiti?.abito === 'abt_base', 20000);
    });

    await ctx.test('amico: Ada cambia arma e armatura sul server → Bea la vede cambiare (senza ricaricare)', async () => {
      await post('/api/rpg', 'tokA', { azione: { t: 'equip', slot: 'arma', item: 'katana_legno' } });
      await waitPeer((x) => x.arma === 'katana_legno' && !x.faretra, 'katana senza faretra');
      await post('/api/rpg', 'tokA', { azione: { t: 'equip', slot: 'corpo', item: null } });
      for (let i = 0; i < 40 && (await indossaDi('tokA')).corpo !== undefined; i++) await sleep(250);
      assert((await indossaDi('tokA')).corpo === undefined, 'armatura tolta sul server');
      await post('/api/rpg', 'tokA', { azione: { t: 'equip', slot: 'corpo', item: 'armatura_legno' } });
      for (let i = 0; i < 40 && (await indossaDi('tokA')).corpo !== 'armatura_legno'; i++) await sleep(250);
      assert((await indossaDi('tokA')).corpo === 'armatura_legno', 'armatura rimessa sul server');
      await waitPeer((x) => x.corpo === null && x.arma === 'katana_legno', 'katana, col vestito al posto dell’armatura');
    });

    await ctx.test('tu: Ada rilegge il personaggio e il suo avatar segue (arco di nuovo)', async () => {
      await post('/api/rpg', 'tokA', { azione: { t: 'equip', slot: 'arma', item: 'arco_legno' } });
      await A.page.evaluate(() => window.__game.test.lotRefresh());
      await ctx.waitState(A.page, (s) => s.wp2_avatar.vestito && s.wp2_avatar.vestito.arma === 'arco_legno' && s.wp2_avatar.vestito.faretra, 20000);
    });

    await ctx.test('indossa anche fuori: Ada attiva armatura_fuori e si vede l’armatura nell’overworld', async () => {
      await post('/api/rpg', 'tokA', { azione: { t: 'armatura_fuori', attiva: true } });
      await A.page.evaluate(() => window.__game.test.lotRefresh());
      await ctx.waitState(A.page, (s) => s.wp2_avatar.vestito && s.wp2_avatar.vestito.corpo === 'armatura_legno', 20000);
      await waitPeer((x) => x.corpo === 'armatura_legno', 'armatura anche per Bea');
      await post('/api/rpg', 'tokA', { azione: { t: 'armatura_fuori', attiva: false } });
      await A.page.evaluate(() => window.__game.test.lotRefresh());
      await ctx.waitState(A.page, (s) => s.wp2_avatar.vestito && s.wp2_avatar.vestito.corpo === null, 20000);
      await waitPeer((x) => x.corpo === null, 'vestito estetico per Bea');
    });

    await ctx.test('vestito persistente: /api/look salva abito e /api/me lo ritrova', async () => {
      const lk = (await get('/api/me', 'tokA')).body.look;
      assert(lk.abito === 0, 'abito di base: ' + lk.abito);
      const res = await post('/api/look', 'tokA', { ...lk, abito: 1 });
      assert(res.status === 200, 'salvataggio abito: ' + res.status);
      const lk2 = (await get('/api/me', 'tokA')).body.look;
      assert(lk2.abito === 1, 'abito salvato e ritrovato: ' + lk2.abito);
    });

    await ctx.test('vista: screenshot di Ada addosso a Bea (zoom vicino) e budget di draw call', async () => {
      const ada = (await ctx.getState(B.page)).peersDrawn.find((p) => p.id === 'ada');
      assert(ada, 'Ada non è disegnata da Bea');
      await B.page.evaluate(([x, z]) => { window.__game.test.teleport(x + 1.5, z + 1.5); window.__game.test.setZoom(0.45); }, [ada.x, ada.z]);
      await sleep(2500);
      await ctx.shot(B.page, 'desktop_amico_vede_ada');
      const perf = await ctx.getPerf(B.page);
      assert(perf.drawCalls <= 100, 'draw call: ' + perf.drawCalls);
      await A.page.evaluate(() => { window.__game.test.setZoom(0.45); });
      await sleep(1500);
      await ctx.shot(A.page, 'desktop_ada_si_vede');
    });

    await ctx.test('nessun errore in console', async () => {
      for (const pg of pages) { pg.consoleErrors.splice(0, pg.consoleErrors.length, ...pg.consoleErrors.filter((e) => !/status of 409/.test(e))); ctx.noErrors(pg, 'pagina'); }
    });
  } finally {
    for (const pg of pages) await pg.close().catch(() => {});
    if (dev) {
      if (WIN) { try { execFileSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* ok */ } }
      else { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    }
    try { fs.rmSync(persist, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* file ancora aperti su Windows */ }
  }
}
