// Porto più ricco (#63-#65) sul server locale (wrangler dev, TEST_CLOCK:1). Luca vince Perle con tre Regate (API, autopilot), poi nel
// browser: (1) piazza con banco del Mercante, Bacheca e la Gente del Porto (avatar veri, giro, nomi); (2) E al banco apre il Mercante:
// prova un cappello esclusivo sull'avatar, COMPRA, INDOSSA (salvato sul server), compra una decorazione esclusiva → posata sull'isola;
// senza Perle l'avviso gentile (#4) senza chiamate; (3) la Bacheca mostra le 3 missioni del giorno uguali a quelle della sim, una compiuta
// si RISCUOTE una volta sola (premio nel lotto); (4) PARLA con Gigi: battute di gente.json, AVANTI fino a CIAO; (5) telefono 390×844:
// bottone, pannello, scheda delle battute; (6) draw call in piazza ≤ 100. Screenshot di tutto.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 480000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 86_400_000;
const FATTIBILI = ['partite', 'medaglia', 'oro', 'mercante', 'cantiere'];

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3porto-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { regata } = await sim('minigames/regata/regata.ts');
  const { packInputs, quantize } = await sim('replay.ts');
  const { createRng } = await sim('rng.ts');
  const { missioniDelGiorno } = await sim('economy/missioni.ts');
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const avatar = read('avatar.json'), decor = read('decor.json'), gente = read('gente.json'), islands = read('islands.json');
  const KASA = avatar.cappelli.findIndex((h) => h.id === 'kasa'), kasa = avatar.cappelli[KASA];
  const ancora = decor.find((d) => d.id === 'ancora'), palombaro = avatar.cappelli.find((h) => h.id === 'palombaro');
  const segCell = islands.find((i) => i.id === 'lotto').slots.find((s) => s.kind === 'segheria').at;

  // un giorno (con l'orologio di test) in cui almeno una missione si fa in fretta: partite, medaglie, acquisti, cantiere
  const base = Date.now() + ((Date.now() % DAY) > DAY - 20 * 60_000 ? 30 * 60_000 : 0);
  let k = 0;
  while (k < 30 && !missioniDelGiorno('luca', Math.floor((base + k * DAY) / DAY)).some((m) => FATTIBILI.includes(m.tipo) && (m.tipo !== 'partite' || m.n <= 3))) k++;
  const OFF = base - Date.now() + k * DAY;
  const oggi = missioniDelGiorno('luca', Math.floor((Date.now() + OFF) / DAY));
  ctx.log(`giorno +${k}: missioni ${oggi.map((m) => `${m.tipo}×${m.n}`).join(', ')}`);

  let dev = null, log = '';
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const B = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(B + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const hdr = { 'x-token': 'tokL', 'content-type': 'application/json', 'x-test-now-offset': String(OFF) };
    const get = async (p) => { const r = await fetch(B + p, { headers: hdr }); return { status: r.status, body: await r.json() }; };
    const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: hdr, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const playSolo = async () => {
      const s = await post('/api/solo/start', { minigame: 'regata' });
      const x = regata.create({ seed: s.body.seed, difficulty: s.body.difficulty }), rng = createRng(s.body.seed), frames = [];
      while (!x.done) { const f = quantize(regata.autopilot(x, rng)); frames.push(f); regata.step(x, f); }
      return post('/api/solo/play', { inputs: packInputs(frames) });
    };

    await ctx.test('API: RISCUOTI di una missione non compiuta 409, indice rotto 400; tre Regate danno Perle e contano le partite', async () => {
      const a = await post('/api/missioni/riscuoti', { i: 0 });
      assert(a.status === 409 && /Non ancora/.test(a.body.error), `riscuoti a vuoto: ${a.status} ${JSON.stringify(a.body)}`);
      const b = await post('/api/missioni/riscuoti', { i: 'x' });
      assert(b.status === 400, 'indice rotto: ' + b.status);
      for (let i = 0; i < 3; i++) { const r = await playSolo(); assert(r.status === 200 && r.body.medal, 'regata: ' + JSON.stringify(r.body).slice(0, 200)); }
      const lot = (await get('/api/lot')).body;
      ctx.log(`Perle ${lot.resources.perle} · contatori ${JSON.stringify(lot.missioni)}`);
      assert(lot.missioni.prog.partite === 3 && lot.missioni.prog.medaglia === 3, 'contatori delle partite: ' + JSON.stringify(lot.missioni));
      assert(lot.resources.perle >= kasa.perle + ancora.perle, 'Perle insufficienti per il test: ' + lot.resources.perle);
      if (oggi.some((m) => m.tipo === 'cantiere')) assert((await post('/api/lot/build', { building: 'segheria', cell: segCell })).status === 200, 'cantiere');
    });

    // ---- PC ----
    const open = async (viewport) => {
      const pg = await ctx.B.openPage(ctx.browser, `${B}/?t=tokL&test=1`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      await pg.page.route('**/api/**', (route) => { const rq = route.request(); return route.continue({ headers: { ...rq.headers(), 'x-test-now-offset': String(OFF) } }); });
      await ctx.waitReady(pg.page, 30000);
      await ctx.waitState(pg.page, (s) => s.lot && s.lot.ready && s.porto && s.porto.gente.every((g) => g.pronto), 20000);
      return pg;
    };
    const P = await open(ctx.B.DESKTOP), page = P.page;
    const st = () => ctx.getState(page);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    const posto = async (id) => (await st()).porto.posti.find((p) => p.id === id);
    const vai = async (x, z) => { await hook('teleport', x, z); await sleep(700); };

    await ctx.test('piazza: banco, Bacheca e quattro persone del Porto con il nome; draw call ≤ 100', async () => {
      const m = await posto('mercante'), b = await posto('bacheca');
      await vai((m.fronte.x + b.fronte.x) / 2, m.fronte.z + 5);
      await hook('setZoom', 1.15); await sleep(1200);
      const s = await st();
      assert(s.porto.gente.length === gente.gente.length && s.porto.gente.length >= 4, 'gente: ' + JSON.stringify(s.porto.gente));
      const labels = await page.evaluate(() => [...document.querySelectorAll('.mz-lbl[data-porto]')].map((e) => e.textContent));
      assert(labels.includes('MERCANTE') && labels.includes('BACHECA'), 'cartelli: ' + labels.join(','));
      await ctx.shot(page, 'desktop_piazza');
      const perf = await ctx.getPerf(page); ctx.log('perf piazza', JSON.stringify(perf));
      assert(perf.drawCalls <= 100, `draw call in piazza ${perf.drawCalls}`);
      const g0 = s.porto.gente.find((g) => g.id === 'remo'); await sleep(1500);
      const g1 = (await st()).porto.gente.find((g) => g.id === 'remo');
      assert(Math.hypot(g1.x - g0.x, g1.z - g0.z) > 0.5, 'Capitan Remo non cammina');
    });

    await ctx.test('Mercante: E apre il negozio; prova del cappello esclusivo; COMPRA e INDOSSA (salvato sul server)', async () => {
      const m = await posto('mercante');
      await vai(m.fronte.x, m.fronte.z); await hook('setZoom', 0.7);
      await ctx.waitState(page, (s) => s.porto.near === 'mercante', 5000);
      assert(await page.locator('#mzPortoBtn.on').isVisible(), 'bottone MERCANTE non visibile');
      await page.keyboard.press('KeyE');
      await ctx.waitState(page, (s) => s.porto.open === 'mercante', 8000);
      await page.waitForSelector('#mzPortoPanel.on [data-item="kasa"]', { timeout: 5000 });
      await ctx.shot(page, 'desktop_mercante');
      const bb = async () => JSON.stringify(await page.locator('#mzPortoPanel [data-item="kasa"]').boundingBox());
      ctx.log('kasa', await bb(), await page.evaluate(() => { const e = document.querySelector('#mzPortoPanel [data-item="kasa"] [data-act="prova"]'); const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return top ? top.outerHTML.slice(0, 120) : null; }));
      await sleep(500); ctx.log('kasa dopo', await bb());
      const txt = await page.locator('#mzPortoPanel').innerText();
      assert(/ESCLUSIVA/.test(txt) && txt.includes(kasa.nome) && txt.includes(gente.gente[0].nome), 'negozio: ' + txt.slice(0, 300));
      await page.locator('#mzPortoPanel [data-item="kasa"] [data-act="prova"]').click();
      await ctx.waitState(page, (s, i) => s.wp2_avatar.look.cappello === i, 3000, KASA);
      await ctx.shot(page, 'desktop_mercante_prova');
      const p0 = (await st()).lot.resources.perle;
      await page.locator('#mzPortoPanel [data-item="kasa"] [data-act="compra"]').click();
      await ctx.waitState(page, (s, want) => s.lot.resources.perle === want, 8000, p0 - kasa.perle);
      await page.locator('#mzPortoPanel [data-item="kasa"] [data-act="indossa"]').click();
      await ctx.waitState(page, (s) => /ti sta benissimo/.test(s.porto.ui.note ?? ''), 8000);
      assert((await get('/api/me')).body.look.cappello === KASA, 'cappello non salvato');
      assert((await get('/api/lot')).body.posseduti.includes('kasa'), 'kasa non posseduto');
      await ctx.shot(page, 'desktop_mercante_comprato');
    });

    await ctx.test('Mercante: decorazione esclusiva comprata e posata sull’isola; senza Perle avviso gentile senza chiamate', async () => {
      await page.locator('#mzPortoPanel [data-tab="decor"]').click();
      const p0 = (await st()).lot.resources.perle;
      await page.locator('#mzPortoPanel [data-item="ancora"] [data-act="compra"]').click();
      await ctx.waitState(page, (s, want) => s.lot.resources.perle === want && s.lot.decor.length === 1, 8000, p0 - ancora.perle);
      await ctx.shot(page, 'desktop_mercante_decor');
      // un cappello che costa troppo: avviso gentile, niente richiesta
      await page.locator('#mzPortoPanel [data-tab="cappelli"]').click();
      let hats = 0; page.on('request', (r) => { if (new URL(r.url()).pathname === '/api/look/hat') hats++; });
      const perle = (await st()).lot.resources.perle;
      assert(perle < palombaro.perle, 'troppe Perle per provare l’avviso: ' + perle);
      await page.locator('#mzPortoPanel [data-item="palombaro"] [data-act="compra"]').click();
      const miss = page.locator('#mzPortoPanel .mz-pt-miss');
      await miss.waitFor({ timeout: 3000 });
      const t = await miss.innerText();
      assert(new RegExp(`Ti mancano ${palombaro.perle - perle} Perle`).test(t), 'avviso: ' + t);
      assert(hats === 0, 'chiamata al server senza Perle');
      await ctx.shot(page, 'desktop_mercante_senza_perle');
      await page.keyboard.press('Escape');
      await ctx.waitState(page, (s) => s.porto.open === null, 3000);
      assert((await st()).wp2_avatar.look.cappello === KASA, 'dopo la chiusura il cappello indossato deve restare');
      // a casa: la decorazione c'è, col segnaposto
      await hook('goto', 'lotto:0'); await hook('setZoom', 1.2);
      await ctx.waitState(page, (s) => s.lot.decor.length === 1 && !!s.lot.decor[0].model, 8000);
      const d = (await st()).lot.decor[0];
      assert(d.decor === 'ancora' && /segnaposto_ancora|prop_ancora/.test(d.model), 'decorazione: ' + JSON.stringify(d));
      await sleep(800);
      await ctx.shot(page, 'desktop_decor_isola');
      await hook('goto', 'porto');
    });

    await ctx.test('Bacheca: le 3 missioni di oggi uguali alla sim; una compiuta si RISCUOTE una volta sola', async () => {
      const b = await posto('bacheca');
      await vai(b.fronte.x, b.fronte.z);
      await ctx.waitState(page, (s) => s.porto.near === 'bacheca', 5000);
      await page.keyboard.press('KeyE');
      await ctx.waitState(page, (s) => s.porto.open === 'bacheca', 8000);
      await page.waitForSelector('#mzPortoPanel.on [data-missione="2"]', { timeout: 5000 });
      const cards = await page.evaluate(() => [...document.querySelectorAll('#mzPortoPanel [data-missione]')].map((e) => ({ tipo: e.dataset.tipo, tx: e.querySelector('.tx').textContent, act: e.querySelector('[data-act="riscuoti"]').textContent })));
      ctx.log('bacheca', JSON.stringify(cards));
      assert(JSON.stringify(cards.map((c) => c.tx)) === JSON.stringify(oggi.map((m) => m.testo)), 'missioni diverse dalla sim');
      const i = cards.findIndex((c) => c.act === 'RISCUOTI');
      assert(i >= 0, 'nessuna missione compiuta: ' + JSON.stringify(cards));
      await ctx.shot(page, 'desktop_bacheca');
      const p0 = (await st()).lot.resources, prem = oggi[i].premio;
      await page.locator(`#mzPortoPanel [data-missione="${i}"] [data-act="riscuoti"]`).click();
      await ctx.waitState(page, (s, w) => s.lot.resources.perle === w, 8000, p0.perle + prem.perle);
      await page.waitForFunction((i) => document.querySelector(`#mzPortoPanel [data-missione="${i}"] [data-act="riscuoti"]`)?.textContent === 'RISCOSSA', i, { timeout: 5000 });
      await ctx.shot(page, 'desktop_bacheca_riscossa');
      const again = await post('/api/missioni/riscuoti', { i });
      assert(again.status === 409 && /già riscosso/.test(again.body.error), 'seconda riscossione: ' + again.status);
      await page.keyboard.press('Escape');
      await ctx.waitState(page, (s) => s.porto.open === null, 3000);
    });

    await ctx.test('Gente del Porto: PARLA con Gigi, battute di gente.json, AVANTI fino a CIAO', async () => {
      const g = (await st()).porto.gente.find((x) => x.id === 'gigi'), gigi = gente.gente.find((x) => x.id === 'gigi');
      await vai(g.x + 1.2, g.z);
      await ctx.waitState(page, (s) => s.porto.near === 'gigi', 5000);
      await page.keyboard.press('KeyE');
      await ctx.waitState(page, (s) => s.porto.open === 'parla', 8000);
      assert((await page.locator('#mzDialogo p').innerText()) === gigi.battute[0], 'prima battuta');
      await ctx.shot(page, 'desktop_dialogo');
      await page.keyboard.press('Space');
      await ctx.waitState(page, (s) => s.porto.ui.riga === 1, 3000);
      for (let i = 1; i < gigi.battute.length; i++) await page.keyboard.press('KeyE');
      await ctx.waitState(page, (s) => s.porto.open === null, 3000);
      ctx.noErrors(P, 'PC');
    });

    await ctx.test('vetrina: le decorazioni esclusive e i cappelli esclusivi si vedono (segnaposto in palette)', async () => {
      const m = await posto('mercante'), b = await posto('bacheca');
      await vai((m.fronte.x + b.fronte.x) / 2, m.fronte.z + 9); await hook('setZoom', 0.75);
      const n = await hook('portoVetrina', true);
      assert(n === decor.filter((d) => d.mercante).length && n >= 6, 'vetrina: ' + n);
      await sleep(900);
      await ctx.shot(page, 'desktop_vetrina');
      await hook('setZoom', 0.6);
      for (const [i, h] of avatar.cappelli.entries()) {
        if (!h.mercante) continue;
        await hook('portoCappello', i); await sleep(350);
        await page.screenshot({ path: path.join(ctx.OUT, 'shots', `m3_porto_cappello_${h.id}.png`), clip: { x: 560, y: 210, width: 160, height: 180 } });
      }
      await hook('portoCappello', KASA);
    });

    // ---- telefono ----
    await ctx.test('telefono 390×844: bottone, negozio, Bacheca e battute stanno nello schermo con bersagli ≥ 44 px', async () => {
      const T = await open(ctx.B.IPHONE), tp = T.page;
      const tst = () => ctx.getState(tp), th = (n, ...a) => tp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      const m = (await tst()).porto.posti.find((p) => p.id === 'mercante');
      await th('teleport', m.fronte.x, m.fronte.z); await th('setZoom', 0.8);
      await ctx.waitState(tp, (s) => s.porto.near === 'mercante', 5000);
      await tp.waitForTimeout(600);
      await ctx.shot(tp, 'iphone_banco');
      await tp.locator('#mzPortoBtn').tap();
      await ctx.waitState(tp, (s) => s.porto.open === 'mercante', 8000);
      await tp.waitForTimeout(300);
      const box = await tp.locator('#mzPortoPanel').boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844, 'pannello fuori schermo: ' + JSON.stringify(box));
      const small = await tp.evaluate(() => [...document.querySelectorAll('#mzPortoPanel button')].filter((b) => b.getBoundingClientRect().height < 44).map((b) => b.textContent));
      assert(!small.length, 'bottoni < 44 px: ' + small.join(','));
      await ctx.shot(tp, 'iphone_mercante');
      await tp.locator('#mzPortoPanel [data-act="chiudi"]').tap();
      await ctx.waitState(tp, (s) => s.porto.open === null, 3000);
      await tp.waitForTimeout(450); // appena chiuso non si riapre (tocco doppio)
      await th('portoApri', 'bacheca');
      await ctx.waitState(tp, (s) => s.porto.open === 'bacheca', 8000);
      await tp.waitForTimeout(300);
      await ctx.shot(tp, 'iphone_bacheca');
      await th('portoChiudi'); await tp.waitForTimeout(450);
      const r = (await tst()).porto.gente.find((x) => x.id === 'pina');
      await th('teleport', r.x, r.z + 1.5);
      await ctx.waitState(tp, (s) => s.porto.near === 'pina', 5000);
      await tp.locator('#mzPortoBtn').tap();
      await ctx.waitState(tp, (s) => s.porto.open === 'parla', 8000);
      const db = await tp.locator('#mzDialogo').boundingBox();
      assert(db && db.y + db.height <= 844 - 100, 'scheda delle battute sopra i comandi: ' + JSON.stringify(db));
      await ctx.shot(tp, 'iphone_dialogo');
      await tp.locator('#mzDialogo [data-act="avanti"]').tap();
      await ctx.waitState(tp, (s) => s.porto.ui.riga === 1, 3000);
      await th('portoChiudi');
      ctx.noErrors(T, 'telefono');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
