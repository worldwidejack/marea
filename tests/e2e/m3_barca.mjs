// La tua barca (#107) e barche al molo (#6) sul server locale (wrangler dev). API: colori e nome validati (nome ripulito, esclusivi solo se
// comprati), colore esclusivo comprato una volta sola, la barca resta quando l'editor salva il look. PC (Luca): al Mercante prova e
// compra un colore esclusivo e lo mette sullo scafo; nell'editor sceglie la vela e scrive il nome; la sua barca a casa ha colori, vela e
// nome. Telefono (Mia): sull'isola di Luca vede la sua barca ormeggiata coi colori giusti, la propria si scansa e non si sovrappone;
// Luca ci porta sopra la sua barca e quella di Mia si sposta; Luca cambia colore e Mia lo vede dal vivo. Screenshot telefono e PC.
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
  const persist = path.join(ctx.OUT, `m3barca-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { regata } = await sim('minigames/regata/regata.ts');
  const { packInputs, quantize } = await sim('replay.ts');
  const { createRng } = await sim('rng.ts');
  const { barcheSovrapposte } = await sim('world/boat.ts');
  const avatar = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/avatar.json'), 'utf8'));
  const C = (id) => avatar.barca.colori.find((k) => k.id === id);
  const corsaro = C('corsaro'), nero = C('nero');
  let dev = null, log = '';
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('mia', 'Mia', 'tokM', 1);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const B = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(B + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const post = async (p, t, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'x-token': t, 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const get = async (p, t) => { const r = await fetch(B + p, { headers: { 'x-token': t } }); return { status: r.status, body: await r.json() }; };
    const regataSolo = async (t) => {
      const s = await post('/api/solo/start', t, { minigame: 'regata' });
      const x = regata.create({ seed: s.body.seed, difficulty: s.body.difficulty }), rng = createRng(s.body.seed), frames = [];
      while (!x.done) { const f = quantize(regata.autopilot(x, rng)); frames.push(f); regata.step(x, f); }
      return post('/api/solo/play', t, { inputs: packInputs(frames) });
    };

    await ctx.test('API: colori e nome validati (nome ripulito, esclusivi solo se tuoi); la barca resta quando si salva il look', async () => {
      assert((await post('/api/barca', 'tokM', { scafo: 'oro_finto', vela: 'tela' })).status === 400, 'colore inventato');
      const ex = await post('/api/barca', 'tokM', { scafo: nero.id, vela: 'tela' });
      assert(ex.status === 400 && /Mercante/.test(ex.body.error), 'esclusivo non comprato: ' + JSON.stringify(ex));
      const ok = await post('/api/barca', 'tokM', { scafo: 'mare', vela: 'tela', nome: '  Àncora   <b>!  ' });
      assert(ok.status === 200 && JSON.stringify(ok.body.barca) === JSON.stringify({ scafo: 'mare', vela: 'tela', nome: 'Ancora b!' }), 'salva: ' + JSON.stringify(ok.body));
      assert((await post('/api/look', 'tokM', { pelle: 1, capelli: 2, coloreCapelli: 1, vestito: 3, cappello: 0 })).status === 200, 'look');
      const me = (await get('/api/me', 'tokM')).body;
      assert(me.look.vestito === 3 && me.look.barca?.nome === 'Ancora b!' && me.look.barca.scafo === 'mare', 'dopo /api/look: ' + JSON.stringify(me.look));
      const lots = (await get('/api/lots', 'tokL')).body;
      assert(lots.find((x) => x.id === 'mia')?.look.barca?.scafo === 'mare', '/api/lots senza barca');
    });

    await ctx.test('API: un colore esclusivo si compra una volta (409 senza Perle, gratis o già tuo)', async () => {
      assert((await post('/api/barca/colore', 'tokL', { id: 'boh' })).status === 400, 'sconosciuto');
      assert((await post('/api/barca/colore', 'tokL', { id: 'rosso' })).status === 409, 'gratis');
      const no = await post('/api/barca/colore', 'tokL', { id: nero.id });
      assert(no.status === 409 && no.body.manca?.perle > 0, 'senza Perle: ' + JSON.stringify(no));
      for (let i = 0; i < 3; i++) { const r = await regataSolo('tokL'); assert(r.status === 200, 'regata: ' + r.status); }
      const p0 = (await get('/api/lot', 'tokL')).body.resources.perle;
      assert(p0 >= nero.perle + corsaro.perle, 'Perle per il test: ' + p0);
      const si = await post('/api/barca/colore', 'tokL', { id: nero.id });
      assert(si.status === 200 && si.body.resources.perle === p0 - nero.perle && si.body.posseduti.includes('barca:' + nero.id), 'compra: ' + JSON.stringify(si.body).slice(0, 200));
      const due = await post('/api/barca/colore', 'tokL', { id: nero.id });
      assert(due.status === 409 && /Hai già/.test(due.body.error), 'due volte: ' + JSON.stringify(due));
      assert((await get('/api/lot', 'tokL')).body.resources.perle === p0 - nero.perle, 'pagato due volte');
      assert((await post('/api/barca', 'tokL', { scafo: nero.id, vela: nero.id })).status === 200, 'dopo l’acquisto lo scafo nero si salva');
      assert((await post('/api/barca', 'tokL', { scafo: 'legno', vela: 'nessuna' })).status === 200, 'di nuovo di serie');
      ctx.log(`Perle di Luca: ${p0} → ${p0 - nero.perle}`);
    });

    // ---------- PC (Luca) ----------
    const L = await ctx.B.openPage(ctx.browser, `${B}/?t=tokL&test=1`, { viewport: ctx.B.DESKTOP }); pages.push(L); ctx._pages.push(L);
    const lp = L.page;
    await ctx.waitReady(lp, 60000);
    await ctx.waitState(lp, (s) => s.lot && s.lot.ready === true && s.porto && s.barche, 60000);
    const lh = (n, ...a) => lp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    const lst = () => ctx.getState(lp);

    await ctx.test('PC: al Mercante (scheda BARCA) prova un colore esclusivo sulla barca, COMPRA, SCAFO (salvato sul server)', async () => {
      await lh('goto', 'porto');
      const m = (await lst()).porto.posti.find((p) => p.id === 'mercante');
      await lh('teleport', m.fronte.x, m.fronte.z);
      await ctx.waitState(lp, (s) => s.porto.near === 'mercante', 15000);
      await lp.keyboard.press('KeyE');
      await ctx.waitState(lp, (s) => s.porto.open === 'mercante', 15000);
      await lp.locator('#mzPortoPanel [data-tab="barca"]').click();
      await lp.waitForSelector(`#mzPortoPanel.on [data-item="${corsaro.id}"]`, { timeout: 10000 });
      const txt = await lp.locator('#mzPortoPanel').innerText();
      assert(txt.includes(corsaro.nome) && /ESCLUSIVA/.test(txt), 'scheda barca: ' + txt.slice(0, 300));
      await lp.locator(`#mzPortoPanel [data-item="${corsaro.id}"] [data-act="prova"]`).click();
      await ctx.waitState(lp, (s, id) => s.barche.mia.barca.scafo === id, 5000, corsaro.id);
      const p0 = (await lst()).lot.resources.perle;
      await lp.locator(`#mzPortoPanel [data-item="${corsaro.id}"] [data-act="compra"]`).click();
      await ctx.waitState(lp, (s, want) => s.lot.resources.perle === want, 15000, p0 - corsaro.perle);
      await lp.locator(`#mzPortoPanel [data-item="${corsaro.id}"] [data-act="scafo"]`).click();
      await ctx.waitState(lp, (s) => /scafo ridipinto/.test(s.porto.ui.note ?? ''), 15000);
      await sleep(300);
      await ctx.shot(lp, 'desktop_1_mercante_barca');
      assert((await get('/api/me', 'tokL')).body.look.barca?.scafo === corsaro.id, 'scafo non salvato');
      await lp.keyboard.press('Escape');
      await ctx.waitState(lp, (s) => s.porto.open === null && s.barche.mia.barca.scafo === 'corsaro', 5000);
    });

    await ctx.test('PC: nell’editor (C) la vela gialla e il nome; anteprima dal vivo; SALVA', async () => {
      await lp.keyboard.press('KeyC');
      await ctx.waitState(lp, (s) => s.editor.open && s.editor.barca, 10000);
      for (let i = 0; i < 20 && (await lst()).editor.barca.draft.vela !== 'sole'; i++) await lp.locator('#mzEditor [data-nav="vela:piu"]').click();
      await lp.locator('#mzEditor [data-nav="barca-nome"]').fill('La Gabbiana');
      await ctx.waitState(lp, (s) => s.barche.mia.barca.vela === 'sole' && s.barche.mia.barca.nome === 'La Gabbiana', 5000);
      // i tasti nel nome non arrivano al gioco: «c» non chiude l'editor
      await lp.locator('#mzEditor [data-nav="barca-nome"]').press('End');
      await lp.keyboard.type('c'); await lp.keyboard.press('Backspace');
      assert((await lst()).editor.open, 'la C nel nome ha chiuso l’editor');
      await lp.locator('#mzEditor [data-panel="barca"]').scrollIntoViewIfNeeded();
      await sleep(300);
      await ctx.shot(lp, 'desktop_2_editor_barca');
      await lp.locator('#mzEditor [data-act="salva"]').click();
      await ctx.waitState(lp, (s) => !s.editor.open, 15000);
      const b = (await get('/api/me', 'tokL')).body.look.barca;
      assert(JSON.stringify(b) === JSON.stringify({ scafo: 'corsaro', vela: 'sole', nome: 'La Gabbiana' }), 'barca salvata: ' + JSON.stringify(b));
    });

    await ctx.test('PC: a casa la barca di Luca ha scafo viola, vela gialla e nome sul fianco', async () => {
      await lh('goto', 'lotto:0');
      const s = await lst();
      await lh('teleport', s.island.dock.x, s.island.dock.z); await lh('setZoom', 0.6);
      await sleep(1500);
      await ctx.shot(lp, 'desktop_3_barca_a_casa');
      assert((await lst()).barche.mia.barca.scafo === 'corsaro', 'barca locale');
    });

    // ---------- telefono (Mia) ----------
    const M = await ctx.B.openPage(ctx.browser, `${B}/?t=tokM&test=1`, { viewport: ctx.B.IPHONE }); pages.push(M); ctx._pages.push(M);
    const mp = M.page;
    await ctx.waitReady(mp, 60000);
    await ctx.waitState(mp, (s) => s.lot && s.lot.ready === true && s.barche && s.net.status === 'on' && s.net.peers === 1, 60000);
    const mh = (n, ...a) => mp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    const mst = () => ctx.getState(mp);
    const luca = (s) => s.barche.altre.find((b) => b.id === 'luca');
    // la guida dei primi passi coprirebbe le barche negli screenshot
    if (await mp.locator('#mzGuida [data-act="chiudi"]').isVisible().catch(() => false)) await mp.locator('#mzGuida [data-act="chiudi"]').click();

    await ctx.test('telefono: l’editor ha la sezione Barca (anteprima, scafo, vela, nome) dentro lo schermo', async () => {
      await mp.locator('#mzEditorBtn').click();
      await ctx.waitState(mp, (s) => s.editor.open && s.editor.barca, 10000);
      await mp.locator('#mzEditor [data-panel="barca"]').scrollIntoViewIfNeeded();
      const box = await mp.locator('#mzEditor [data-panel="barca"]').boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 390, 'la sezione esce dal telefono: ' + JSON.stringify(box));
      for (const r of ['scafo', 'vela']) for (const d of ['meno', 'piu']) {
        const b = await mp.locator(`#mzEditor [data-nav="${r}:${d}"]`).boundingBox();
        assert(b && b.width >= 44 && b.height >= 44, `bottone ${r}:${d} troppo piccolo per un pollice`);
      }
      assert(await mp.locator('#mzEditor [data-nav="barca-nome"]').inputValue() === 'Ancora b!', 'nome nell’editor');
      await sleep(300);
      await ctx.shot(mp, 'iphone_0_editor_barca');
      await mp.locator('#mzEditor [data-act="annulla"]').click();
      await ctx.waitState(mp, (s) => !s.editor.open, 5000);
    });

    await ctx.test('telefono: sull’isola di Luca la sua barca è ormeggiata coi suoi colori; quella di Mia non ci sta sopra', async () => {
      const casaMia = (await mst()).barche.mia;
      assert(casaMia.barca.scafo === 'mare' && casaMia.barca.nome === 'Ancora b!', 'barca di Mia: ' + JSON.stringify(casaMia.barca));
      await mh('goto', 'lotto:0');
      await ctx.waitState(mp, (s) => { const b = s.barche.altre.find((x) => x.id === 'luca'); return !!b && !b.naviga && b.barca?.scafo === 'corsaro' && b.barca.vela === 'sole' && b.barca.nome === 'La Gabbiana'; }, 20000);
      // goto ha ormeggiato la barca di Mia al molo di Luca, proprio dove sta la sua: si scansa da sola
      await ctx.waitState(mp, (s) => !s.barche.sovrapposte, 15000);
      const s = await mst(), l = luca(s);
      assert(!barcheSovrapposte(s.barche.mia, l), 'sovrapposte: ' + JSON.stringify({ mia: s.barche.mia, luca: l }));
      ctx.log(`barca di Mia a ${Math.hypot(s.barche.mia.x - l.x, s.barche.mia.z - l.z).toFixed(1)} m da quella di Luca`);
      await mh('teleport', s.island.dock.x, s.island.dock.z); await mh('setZoom', 0.6);
      await sleep(1500);
      await ctx.shot(mp, 'iphone_1_due_barche_al_molo');
      // da lì Mia risale sulla sua barca
      const d = (await mst()).island.dock;
      assert(Math.hypot(d.x - s.barche.mia.x, d.z - s.barche.mia.z) < 4.5, 'il molo della barca spostata è lontano');
    });

    await ctx.test('due al molo: Luca porta la sua barca sopra quella di Mia, che si sposta; nessuna sovrapposizione', async () => {
      const m0 = (await mst()).barche.mia;
      await lh('goto', 'lotto:0'); await lh('setMode', 'boat');
      await lh('barcaA', m0.x, m0.z, m0.yaw);
      await ctx.waitState(mp, (s, m) => { const b = s.barche.altre.find((x) => x.id === 'luca'); return !!b && b.naviga && Math.hypot(b.x - m.x, b.z - m.z) < 0.5; }, 15000, m0);
      await ctx.waitState(mp, (s, m) => !s.barche.sovrapposte && Math.hypot(s.barche.mia.x - m.x, s.barche.mia.z - m.z) > 1, 15000, m0);
      const s = await mst();
      assert(!barcheSovrapposte(s.barche.mia, luca(s)), 'ancora sovrapposte');
      assert(!(await lst()).barche.sovrapposte, 'sovrapposte dal PC');
      await sleep(800);
      await ctx.shot(mp, 'iphone_2_luca_naviga');
    });

    await ctx.test('dal vivo: Luca cambia lo scafo e Mia lo vede; niente errori', async () => {
      const r = await post('/api/barca', 'tokL', { scafo: 'rosso', vela: 'sole', nome: 'La Gabbiana' });
      assert(r.status === 200, 'cambio: ' + r.status);
      await ctx.waitState(mp, (s) => s.barche.altre.find((b) => b.id === 'luca')?.barca?.scafo === 'rosso', 15000);
      ctx.noErrors(M, 'telefono');
      ctx.noErrors(L, 'PC');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
