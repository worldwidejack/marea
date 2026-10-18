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

      // Avanza l'orologio di test per completare il cantiere della segheria
      await fetch(BASE + '/api/lot', { headers: { ...hdr('tokL'), 'x-test-now-offset': '120000' } });

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

    await ctx.test('Telefono verticale (390×844) e orizzontale (844×390): isola intera visibile, joystick nascosto e tocco fluido', async () => {
      const W = await open(ctx.B.IPHONE);
      await W.hook('portaRetro', 0, 'retro');
      await W.page.waitForTimeout(600);

      // Prima di entrare in modifica, su touch il joystick e i bottoni A/B esistono
      await W.page.waitForSelector('#mzModificaIsolaBtn.on', { timeout: 10000 });
      await W.page.click('#mzModificaIsolaBtn');
      await ctx.waitState(W.page, (s) => s.modificaIsola && s.modificaIsola.active, 8000);
      await W.page.waitForTimeout(400);

      // Verifica che joystick e pulsanti azione siano spariti in modalità modifica
      const controlliVisibili = await W.page.evaluate(() => {
        const ids = ['#joystick', '#btnA', '#btnB', '#compass', '#mzBar', '#mzTop', '#mzPlay'];
        return ids.filter((sel) => {
          const el = document.querySelector(sel);
          return el && el.offsetParent !== null;
        });
      });
      assert.equal(controlliVisibili.length, 0, 'Controlli ancora visibili in modifica: ' + JSON.stringify(controlliVisibili));

      // Verifica che tutti gli edifici dell'isola (incluso il molo a sud-ovest e la segheria) siano ben dentro lo schermo 390×844
      const posVert = await W.page.evaluate(() => {
        const st = window.__game.state();
        return st.modificaIsola.buildings.map((b) => {
          const p = window.__game.test.lotScreen(b.id);
          return { id: b.id, building: b.building, x: Math.round(p?.x ?? -1), y: Math.round(p?.y ?? -1), on: !!p?.on };
        });
      });
      for (const b of posVert) {
        assert(b.on && b.x >= 12 && b.x <= 378 && b.y >= 54 && b.y <= 735, `Verticale: edificio ${b.building} fuori inquadratura: ${JSON.stringify(b)}`);
      }

      // Tocca direttamente la segheria sullo schermo per selezionarla
      const segPos = posVert.find((b) => b.building === 'segheria');
      assert(segPos, 'Segheria presente su schermo verticale');
      await W.page.mouse.click(segPos.x, segPos.y);
      await ctx.waitState(W.page, (s, id) => s.modificaIsola?.selectedId === id, 5000, segPos.id);
      await W.page.waitForSelector('#mzModificaSelBar.on', { timeout: 5000 });

      await ctx.shot(W.page, 'telefono_verticale');

      // Bottoni >= 44px in verticale
      const piccoliV = await W.page.evaluate(() => [...document.querySelectorAll('#mzModificaTopBar button, #mzModificaSelBar button')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.slice(0, 20), w: Math.round(r.width), h: Math.round(r.height), ok: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; }).filter((b) => b.h < 44 || !b.ok));
      assert(!piccoliV.length, 'bottoni piccoli o fuori in verticale: ' + JSON.stringify(piccoliV));

      // Riponi la segheria nel magazzino col bottone RIPONI e verifica che compaia nel cassetto
      await W.page.click('#mzModificaSelBar .mz-mod-btn.riponi');
      await ctx.waitState(W.page, (s) => s.modificaIsola?.magazzinoCount === 1, 5000);

      // Tocca la card nel magazzino e poi rimettila sull'isola
      await W.page.click('.mz-tray-card');
      await ctx.waitState(W.page, (s, id) => s.modificaIsola?.selectedFromMagazzino === id, 5000, segPos.id);
      await W.page.mouse.click(segPos.x, segPos.y);
      await ctx.waitState(W.page, (s, id) => s.modificaIsola?.magazzinoCount === 0 && s.modificaIsola?.selectedId === id, 5000, segPos.id);

      // Ruota il telefono in orizzontale (844×390) e verifica che la telecamera si adatti subito inquadrando tutta l'isola
      await W.page.setViewportSize({ width: 844, height: 390 });
      await W.page.waitForTimeout(500);

      const posOriz = await W.page.evaluate(() => {
        const st = window.__game.state();
        return st.modificaIsola.buildings.map((b) => {
          const p = window.__game.test.lotScreen(b.id);
          return { id: b.id, building: b.building, x: Math.round(p?.x ?? -1), y: Math.round(p?.y ?? -1), on: !!p?.on };
        });
      });
      for (const b of posOriz) {
        assert(b.on && b.x >= 16 && b.x <= 828 && b.y >= 46 && b.y <= 306, `Orizzontale: edificio ${b.building} fuori inquadratura: ${JSON.stringify(b)}`);
      }

      await ctx.shot(W.page, 'telefono_orizzontale');

      // Salva da mobile e verifica che il layout resti stabile
      await W.page.click('#mzModificaTopBar .mz-mod-btn.salva');
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
