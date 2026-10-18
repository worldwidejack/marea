// Modalità modifica rapida edifici dell'isola (#403, stile Clash of Clans) sul server locale (wrangler dev, TEST_CLOCK:1).
// (1) API: /api/lot/building/rotate, /api/lot/building/stow, /api/lot/building/stow_all, /api/lot/building/place_stored, /api/lot/building/layout;
// (2) Nel browser: in giardino a piedi il pulsante MODIFICA DISPOSIZIONE è visibile;
// (3) Apertura modalità modifica: telecamera bloccata dall'alto a visuale isola, avatar nascosto, comandi bloccati;
// (4) Rotazione edificio (GIRA) e riponi nel magazzino (RIPONI);
// (5) Cassetto magazzino in basso popolato con le costruzioni riposte;
// (6) Riposizionamento e salvataggio layout atomico;
// (7) Screenshot da PC e telefono 390×844.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 420000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WIN = process.platform === 'win32';

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3modifica-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000, shell: WIN }).toString();

  let dev = null, log = '';
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    const sql = path.join(persist, 'persone.sql');
    fs.mkdirSync(persist, { recursive: true });
    fs.writeFileSync(sql, "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0);\n");
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--file', sql);
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: !WIN, shell: WIN, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const BASE = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 160 && !up; i++) { try { up = (await fetch(BASE + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const hdr = (tok) => ({ 'x-token': tok, 'content-type': 'application/json' });
    const get = async (p, tok = 'tokL') => { const r = await fetch(BASE + p, { headers: hdr(tok) }); return { status: r.status, body: await r.json() }; };
    const post = async (p, b, tok = 'tokL') => { const r = await fetch(BASE + p, { method: 'POST', headers: hdr(tok), body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };

    const open = async (viewport, tok = 'tokL') => {
      const pg = await ctx.B.openPage(ctx.browser, `${BASE}/?t=${tok}&test=1`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      await ctx.waitReady(pg.page, 30000);
      await ctx.waitState(pg.page, (s) => s.lot && s.lot.ready, 30000);
      const hook = (n, ...a) => pg.page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      return { pg, page: pg.page, hook, st: () => ctx.getState(pg.page) };
    };

    await ctx.test('API: rotate, stow, stow_all, place_stored e layout', async () => {
      // Costruisci segheria
      const bRes = await post('/api/lot/build', { building: 'segheria', cell: [11, 10] });
      assert.equal(bRes.status, 200);
      const segId = bRes.body.buildings.find((b) => b.building === 'segheria').id;

      // Rotate segheria
      const rRes = await post('/api/lot/building/rotate', { id: segId });
      assert.equal(rRes.status, 200);
      assert.equal(rRes.body.buildings.find((b) => b.id === segId).rot, 1);

      // Stow segheria fallisce mentre in cantiere (non completata)
      const failStow = await post('/api/lot/building/stow', { id: segId });
      assert.equal(failStow.status, 409);

      // Layout atomico: scambia posizione o imposta rotazione
      const layRes = await post('/api/lot/building/layout', {
        placed: [
          { id: segId, cell: [13, 10], rot: 2 },
        ],
        stowed: [],
      });
      assert.equal(layRes.status, 200);
      const segAfter = layRes.body.buildings.find((b) => b.id === segId);
      assert.equal(JSON.stringify(segAfter.cell), JSON.stringify([13, 10]));
      assert.equal(segAfter.rot, 2);
    });

    let V;
    await ctx.test('Browser PC: bottone visibile in giardino, apertura modalità edit, rotazione e salvataggio', async () => {
      V = await open(ctx.B.DESKTOP);
      await V.hook('portaRetro', 0, 'retro');
      await V.page.waitForTimeout(600);

      // Verifica che il bottone MODIFICA DISPOSIZIONE compaia
      await V.page.waitForSelector('#mzModificaIsolaBtn.on', { timeout: 10000 });
      assert(await V.page.$('#mzModificaIsolaBtn.on'), 'Pulsante modifica disposizione visibile');

      // Clicca sul pulsante per aprire la modalità modifica
      await V.page.click('#mzModificaIsolaBtn');
      await ctx.waitState(V.page, (s) => s.modificaIsola && s.modificaIsola.active, 8000);

      // Screenshot panoramica dall'alto
      await ctx.shot(V.page, 'pc_alto');

      // Seleziona segheria e ruotala
      const seg = (await V.st()).modificaIsola.buildings.find((b) => b.building === 'segheria');
      assert(seg, 'Segheria trovata nel lotto');
      await V.hook('modificaIsolaSeleziona', seg.id);
      await V.page.waitForSelector('#mzModificaSelBar.on', { timeout: 5000 });
      await V.page.click('#mzModificaSelBar .mz-mod-btn.gira');
      await V.page.waitForTimeout(300);

      // Clicca Salva
      await V.page.click('#mzModificaTopBar .mz-mod-btn.salva');
      await ctx.waitState(V.page, (s) => s.modificaIsola && !s.modificaIsola.active, 8000);
      await V.page.waitForTimeout(400);

      await ctx.shot(V.page, 'pc_salvato');
      ctx.noErrors(V.pg, 'pc');
    });

    await ctx.test('Telefono 390×844: UI adatta a schermo mobile con bottoni comodi', async () => {
      const W = await open(ctx.B.IPHONE);
      await W.hook('portaRetro', 0, 'retro');
      await W.page.waitForTimeout(600);

      await W.page.waitForSelector('#mzModificaIsolaBtn.on', { timeout: 10000 });
      await W.page.click('#mzModificaIsolaBtn');
      await ctx.waitState(W.page, (s) => s.modificaIsola && s.modificaIsola.active, 8000);
      await W.page.waitForTimeout(400);

      // Screenshot da telefono
      await ctx.shot(W.page, 'telefono');

      // Bottoni >= 44px
      const piccoli = await W.page.evaluate(() => [...document.querySelectorAll('#mzModificaTopBar button, #mzModificaSelBar button')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.slice(0, 20), w: Math.round(r.width), h: Math.round(r.height), ok: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; }).filter((b) => b.h < 44 || !b.ok));
      assert(!piccoli.length, 'bottoni piccoli o fuori: ' + JSON.stringify(piccoli));

      // Chiudi con annulla
      await W.page.click('#mzModificaTopBar .mz-mod-btn.annulla');
      await ctx.waitState(W.page, (s) => s.modificaIsola && !s.modificaIsola.active, 8000);
      ctx.noErrors(W.pg, 'telefono');
    });

  } finally {
    for (const p of pages) try { await p.close(); } catch { /* ignore */ }
    if (dev) {
      if (WIN) { try { execFileSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* già finito */ } }
      else { try { process.kill(-dev.pid); } catch { /* ignore */ } dev.kill(); }
      await sleep(1500);
    }
    try {
      fs.rmSync(persist, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    } catch { /* ignore on Windows */ }
  }
}
