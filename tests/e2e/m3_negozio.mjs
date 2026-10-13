// Il negozio dei mobili (#265) sul server locale (wrangler dev, TEST_CLOCK:1): Luca vince Perle con le Regate (API, autopilot); nel
// browser cammina contro la porta della bottega sullo slargo ed entra (velo, camera fissa, niente minimappa); davanti allo Stereo A apre
// la scheda, COMPRA → è nel magazzino (server); una carta da parati comprata si mette subito; in fondo al corridoio esce in città; a casa
// ARREDA posa lo Stereo. Senza Perle la scheda dice quante ne mancano e non chiama il server. Telefono 390×844: bottone e scheda dentro
// lo schermo, ≥ 44 px. Screenshot: la bottega in città, il negozio da dentro (PC e telefono), la scheda.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 420000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3negozio-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { regata } = await sim('minigames/regata/regata.ts');
  const { packInputs, quantize } = await sim('replay.ts');
  const { createRng } = await sim('rng.ts');
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const mobili = read('mobili.json').mobili, borgo = read('borgo.json'), arch = read('archipelago.json');
  const stereo = mobili.find((m) => m.id === 'stereo'), carta = borgo.carte.find((f) => (f.perle ?? 0) > 0);
  const [X0, Z0] = borgo.stanza.pavimento, ORIG = arch.islands.find((i) => i.role === 'lotto' && i.slot === 0).at;
  const mondo = (cx, cz) => ({ x: (ORIG[0] + cx) * 2, z: (ORIG[1] + cz) * 2 });

  let dev = null, log = '';
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('ada', 'Ada', 'tokA', 1);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const BASE = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(BASE + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const hdr = (tok) => ({ 'x-token': tok, 'content-type': 'application/json' });
    const get = async (p, tok = 'tokL') => { const r = await fetch(BASE + p, { headers: hdr(tok) }); return { status: r.status, body: await r.json() }; };
    const post = async (p, b, tok = 'tokL') => { const r = await fetch(BASE + p, { method: 'POST', headers: hdr(tok), body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const playSolo = async (tok) => {
      const s = await post('/api/solo/start', { minigame: 'regata' }, tok);
      const x = regata.create({ seed: s.body.seed, difficulty: s.body.difficulty }), rng = createRng(s.body.seed), frames = [];
      while (!x.done) { const f = quantize(regata.autopilot(x, rng)); frames.push(f); regata.step(x, f); }
      return post('/api/solo/play', { inputs: packInputs(frames) }, tok);
    };
    for (let i = 0; i < 6 && (await get('/api/lot')).body.resources.perle < stereo.perle + carta.perle; i++) assert((await playSolo('tokL')).status === 200, 'regata');

    const open = async (viewport, tok = 'tokL') => {
      const pg = await ctx.B.openPage(ctx.browser, `${BASE}/?t=${tok}&test=1`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      await ctx.waitReady(pg.page, 30000);
      await ctx.waitState(pg.page, (s) => s.lot && s.lot.ready && s.negozio && s.negozio.pezzi.length >= 3, 30000);
      const hook = (n, ...a) => pg.page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      return { pg, page: pg.page, hook, st: () => ctx.getState(pg.page) };
    };
    /** Frecce che con la camera girata di `yaw` vanno più dritte verso (dx, dz) nel mondo. */
    const frecce = (yaw, dx, dz) => {
      const su = [-Math.sin(yaw), -Math.cos(yaw)], de = [Math.cos(yaw), -Math.sin(yaw)];
      let best = null;
      for (const v of [-1, 0, 1]) for (const h of [-1, 0, 1]) {
        if (!v && !h) continue;
        const x = su[0] * v + de[0] * h, z = su[1] * v + de[1] * h, d = (x * dx + z * dz) / Math.hypot(x, z);
        if (!best || d > best.d) best = { d, k: [...(v > 0 ? ['ArrowUp'] : v < 0 ? ['ArrowDown'] : []), ...(h > 0 ? ['ArrowRight'] : h < 0 ? ['ArrowLeft'] : [])] };
      }
      return best.k;
    };
    const cammina = async (page, tasti, fatto, ms = 15000) => { for (const k of tasti) await page.keyboard.down(k); try { await ctx.waitState(page, fatto, ms); } finally { for (const k of tasti) await page.keyboard.up(k); } };

    await ctx.test('PC: la bottega MOBILI sullo slargo; contro la porta si entra (velo, camera fissa, niente minimappa)', async () => {
      const V = await open(ctx.B.DESKTOP);
      globalThis.__pc = V;
      const { porta } = (await V.st()).negozio;
      await V.hook('teleport', porta.x - porta.verso.x * 3, porta.z - porta.verso.z * 3);
      await V.page.waitForTimeout(800);
      await ctx.shot(V.page, 'pc_bottega');
      await V.hook('teleport', porta.x, porta.z);
      await cammina(V.page, frecce(Math.PI / 4, porta.verso.x, porta.verso.z), (s) => s.negozio.dentro, 15000);
      await V.page.waitForFunction(() => !window.__game.state().velo.attivo, null, { timeout: 5000 });
      const s = await V.st();
      assert(s.velo.passaggi >= 1 && !s.mappa.mini, 'dentro: ' + JSON.stringify({ velo: s.velo, mini: s.mappa.mini }));
      await V.page.waitForTimeout(500);
      await ctx.shot(V.page, 'pc_negozio');
    });

    await ctx.test('PC: davanti allo Stereo A apre la scheda; COMPRA → nel magazzino; la carta da parati si mette subito', async () => {
      const V = globalThis.__pc, p0 = (await get('/api/lot')).body.resources.perle;
      for (const id of [stereo.id, carta.id]) {
        const pz = (await V.st()).negozio.pezzi.find((p) => p.id === id);
        await V.hook('teleport', pz.x, pz.z);
        await ctx.waitState(V.page, (s, id) => s.negozio.near === id, 5000, id);
        await V.page.keyboard.press('KeyE');
        await ctx.waitState(V.page, (s, id) => s.negozio.aperto === id, 3000, id);
        if (id === stereo.id) await ctx.shot(V.page, 'pc_scheda');
        await V.page.locator('#mzNegozio [data-act="compra"]').click();
        await ctx.waitState(V.page, (s, n) => s.negozio.comprati === n, 8000, id === stereo.id ? 1 : 2);
      }
      const lot = (await get('/api/lot')).body;
      assert(lot.casa.magazzino.stereo === 1, 'magazzino: ' + JSON.stringify(lot.casa));
      assert(lot.casa.carta === carta.id && lot.casa.finiture.includes(carta.id), 'carta: ' + JSON.stringify(lot.casa));
      assert(lot.resources.perle === p0 - stereo.perle - carta.perle, `Perle ${lot.resources.perle} invece di ${p0 - stereo.perle - carta.perle}`);
    });

    await ctx.test('PC: in fondo al corridoio si esce in città; a casa ARREDA posa lo Stereo comprato', async () => {
      const V = globalThis.__pc, u = (await V.st()).negozio.uscita;
      await V.hook('teleport', u.x, u.z);
      await cammina(V.page, ['ArrowDown'], (s) => !s.negozio.dentro && s.arch.place === 'porto', 20000);
      await V.page.waitForFunction(() => !window.__game.state().velo.attivo, null, { timeout: 5000 });
      await V.hook('porta', 0);
      await ctx.waitState(V.page, (s) => s.stanza.dentro === 0 && s.arreda && s.arreda.mia, 10000);
      assert((await V.st()).stanza.carta === carta.id, 'la carta comprata non è in casa');
      await V.hook('arredaPosa', stereo.id);
      const w = mondo(X0 + 3.5, Z0 + 3.5); await V.hook('teleport', w.x, w.z);
      await V.page.keyboard.down('ArrowUp'); await sleep(90); await V.page.keyboard.up('ArrowUp');
      await ctx.waitState(V.page, (s) => s.arreda.ok, 3000);
      await V.page.keyboard.press('KeyE');
      await ctx.waitState(V.page, (s) => s.arreda.arredi.some((a) => a.mobile === 'stereo'), 8000);
      ctx.noErrors(V.pg, 'pc');
    });

    await ctx.test('telefono 390×844: senza Perle la scheda dice quante ne mancano (niente chiamate); bottoni ≥ 44 px dentro lo schermo', async () => {
      const V = await open(ctx.B.IPHONE, 'tokA');
      await V.hook('negozio');
      await ctx.waitState(V.page, (s) => s.negozio.dentro, 8000);
      const caro = (await V.st()).negozio.pezzi.find((p) => p.kind === 'mobile');
      await V.hook('teleport', caro.x, caro.z);
      await ctx.waitState(V.page, (s, id) => s.negozio.near === id, 5000, caro.id);
      await V.page.waitForTimeout(500);
      await ctx.shot(V.page, 'telefono_negozio');
      await V.page.locator('#btnA').tap();
      await ctx.waitState(V.page, (s, id) => s.negozio.aperto === id, 3000, caro.id);
      const perle = (await get('/api/lot', 'tokA')).body.resources.perle;
      await V.page.locator('#mzNegozio [data-act="compra"]').tap();
      await V.page.waitForTimeout(500);
      const txt = await V.page.locator('#mzNegozio').innerText();
      if (perle < caro.perle) assert(/mancano/.test(txt), 'senza Perle: ' + txt);
      const piccoli = await V.page.evaluate(() => [...document.querySelectorAll('#mzNegozio button')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.slice(0, 20), w: Math.round(r.width), h: Math.round(r.height), fuori: r.left < 0 || r.right > innerWidth || r.bottom > innerHeight }; }).filter((r) => r.w < 44 || r.h < 44 || r.fuori));
      assert(!piccoli.length, 'bottoni piccoli o fuori: ' + JSON.stringify(piccoli));
      await ctx.shot(V.page, 'telefono_scheda');
      ctx.noErrors(V.pg, 'telefono');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
    delete globalThis.__pc;
  }
}
