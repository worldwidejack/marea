// L'hub delle Corse (docs/CORSE.md A3, #185): l'isola aperta che si gira col veicolo.
// Banco di prova provahub.html:
// - telefono in orizzontale 844×390: l'hub si carica al molo (kit dei veicoli e avatar MAREA al volante), si guida (la posizione cambia,
//   la quota segue il terreno), draw call ≤ 100 e triangoli ≤ 150.000 in più punti, drift in curva con le scintille e turbo all'uscita,
//   minimappa, garage che cambia veicolo (e lo salva), porta chiusa che respinge, porta della Spiaggia → scelta della pista → gara
//   locale → di nuovo nell'hub davanti alla porta, pilota automatico dal molo alla porta della Spiaggia;
// - telefono in verticale 390×844: avviso «Ruota il telefono» e la guida aspetta;
// - PC: ↑ gas, ← + Spazio = drift a sinistra, Esc chiude il pannello.
// Gioco vero (wrangler locale pulito): GIOCA all'Isola delle Corse → hub → porta della Spiaggia → gara del pilota automatico (il server
// la rigioca e paga) → scheda dell'esito → di nuovo nell'hub davanti alla porta → Esc · Esci → arcipelago.
// Numeri in tests/out/m4_corse_hub.json, screenshot in tests/out/hub/.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 600000;
const MAX_DC = 100, MAX_TRI = 150000;
const LAND = { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const SPOT = 'corse:corse';
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const DIR = path.join(ctx.OUT, 'hub');
  fs.mkdirSync(DIR, { recursive: true });
  const foto = (page, nome) => page.screenshot({ path: path.join(DIR, nome + '.png'), timeout: 90000 });
  const numeri = { banco: { budget: [] }, gioco: {} };
  const salva = () => ctx.writeOut('m4_corse_hub.json', numeri);
  const fotogrammi = (page, n = 4) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const apri = async (q, viewport) => {
    const p = await ctx.open('provahub.html?' + q, { viewport });
    await p.page.waitForFunction(() => window.__provahub && window.__provahub.ready === true, null, { timeout: 60000 });
    return p;
  };
  const hs = (page) => page.evaluate(() => window.__provahub.state());
  const set = (page, o) => page.evaluate((x) => window.__provahub.set(x), o);
  const avanti = (page, n) => page.evaluate((k) => window.__provahub.avanti(k), n);
  /** Avanza finché `cond(stato)` (testo di una funzione) è vera, al massimo `max` tick. */
  const finche = (page, cond, max, passo = 15) => page.evaluate(([c, m, p]) => { const f = new Function('s', 'return ' + c); const a = window.__provahub; let s = a.state(), t = 0; while (!f(s) && t < m) { s = a.avanti(p); t += p; } return { s, t }; }, [cond, max, passo]);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  /** Un tratto di strada con spazio intorno (per il drift): parte da P verso Q, e 12 m più avanti c'è un cerchio di 14 m libero e asciutto. */
  const spiazzo = (page) => page.evaluate(() => {
    const a = window.__provahub, mare = a.state().mondo.mare;
    for (const s of a.pianta().strade) for (let i = 0; i + 1 < s.length; i++) {
      const [px, pz] = s[i], [qx, qz] = s[i + 1], l = Math.hypot(qx - px, qz - pz) || 1, dx = (qx - px) / l, dz = (qz - pz) / l;
      const cx = px + dx * 12, cz = pz + dz * 12, c = a.sonda(cx, cz, 14);
      if (c.fuori || c.ostacoli || c.quota < mare) continue;
      let ok = true;
      for (let k = 0; k < 12 && ok; k++) { const t = (k / 12) * Math.PI * 2, q = a.sonda(cx + Math.cos(t) * 12, cz + Math.sin(t) * 12, 1); ok = !q.fuori && q.quota >= mare && Math.abs(q.quota - c.quota) < 2.5; }
      if (ok) return { x: px, z: pz, yaw: Math.atan2(dx, dz) };
    }
    return null;
  });

  // ================= banco, telefono in orizzontale =================
  const T = await apri('ruota=0', LAND), tp = T.page;
  await tp.waitForFunction(() => { const s = window.__provahub.state(); return s.kit && s.avatar; }, null, { timeout: 40000 }).catch(() => {});
  const M = (await hs(tp)).mondo;

  await ctx.test('banco 844×390: l\'hub si carica al molo col veicolo e l\'avatar al volante; si guida e la quota segue il terreno', async () => {
    const s0 = await hs(tp);
    assert(s0.aperto && !s0.fermo && dist(s0, M.molo) < M.molo.raggio, 'partenza: ' + JSON.stringify(s0).slice(0, 300));
    assert(s0.kit && s0.avatar, `kit ${s0.kit}, avatar ${s0.avatar}`);
    await fotogrammi(tp); await foto(tp, 'telefono_1_molo');
    await set(tp, { pausa: true, comandi: { mx: 0, my: 1 } });
    const passi = [];
    for (let i = 0; i < 12; i++) { const s = await avanti(tp, 15); passi.push(s); }
    const s1 = passi.at(-1);
    assert(dist(s1, s0) > 15, `il veicolo non si muove: ${dist(s1, s0).toFixed(1)} m`);
    assert(s1.v > 5, 'velocità ' + s1.v);
    for (const s of passi) if (!s.aria) assert(Math.abs(s.y - Math.max(s.quota, M.mare - 0.45)) < 0.06, `quota: y ${s.y}, terreno ${s.quota} in ${s.x},${s.z}`);
    numeri.banco.guida = { metri2s: Math.round(dist(s1, s0) * 10) / 10, v: s1.v, sup: s1.sup };
    await set(tp, { comandi: null });
  });

  await ctx.test('banco 844×390: draw call ≤ 100 e triangoli ≤ 150.000 in più punti dell\'hub', async () => {
    const punti = [['molo', { fuori: 'molo' }], ['garage', { fuori: 'garage' }], ...M.porte.map((p) => [p.id, { fuori: p.id }]),
      ['centro_n', { x: 0, z: 0, yaw: Math.PI }], ['centro_e', { x: 0, z: 0, yaw: Math.PI / 2 }], ['centro_s', { x: 0, z: 0, yaw: 0 }], ['centro_o', { x: 0, z: 0, yaw: -Math.PI / 2 }]];
    let peggio = { drawCalls: 0, triangles: 0 };
    for (const [nome, dove] of punti) {
      await set(tp, { pausa: true, ...dove });
      await fotogrammi(tp, 5);
      const perf = await tp.evaluate(() => window.__provahub.perf());
      numeri.banco.budget.push({ nome, drawCalls: perf.drawCalls, triangles: perf.triangles });
      peggio = { drawCalls: Math.max(peggio.drawCalls, perf.drawCalls), triangles: Math.max(peggio.triangles, perf.triangles) };
    }
    numeri.banco.peggio = peggio;
    ctx.log(`budget banco: peggio ${peggio.drawCalls} draw call, ${peggio.triangles} triangoli su ${punti.length} punti`);
    const fuori = numeri.banco.budget.filter((b) => b.drawCalls > MAX_DC || b.triangles > MAX_TRI);
    assert(!fuori.length, 'fuori budget: ' + fuori.map((b) => `${b.nome} ${b.drawCalls} dc ${b.triangles} tri`).join(' · '));
    await set(tp, { fuori: 'spiaggia' }); await fotogrammi(tp); await foto(tp, 'telefono_2_davanti_spiaggia');
  });

  await ctx.test('banco 844×390: drift in curva con le scintille (livelli), turbo all\'uscita; minimappa nell\'angolo', async () => {
    const P = await spiazzo(tp);
    assert(P, 'nessun tratto di strada con spazio intorno');
    await set(tp, { pausa: true, ...P, comandi: { mx: 0, my: 1 } });
    let s = await avanti(tp, 60);
    assert(s.v > 9, 'serve velocità per il drift: ' + s.v);
    await set(tp, { comandi: { mx: 1, my: 1, a: true } });
    s = await avanti(tp, 6);
    assert(s.drift === 1, 'drift non partito: ' + JSON.stringify({ drift: s.drift, v: s.v, sup: s.sup }));
    s = await avanti(tp, 60);
    assert(s.drift === 1 && s.livello >= 2, `livello ${s.livello}, drift ${s.drift}, urti ${s.urti}`);
    await fotogrammi(tp, 8);
    await foto(tp, 'telefono_3_drift');
    const lv = s.livello;
    await set(tp, { comandi: { mx: 0, my: 1, a: false } });
    s = await avanti(tp, 2);
    assert(s.drift === 0 && s.turbo > 0, `turbo all'uscita: ${s.turbo}`);
    numeri.banco.drift = { dove: P, livello: lv, turbo: s.turbo };
    const mappa = await tp.evaluate(() => { const r = document.getElementById('mzHubMappa').getBoundingClientRect(); return { w: r.width, h: r.height, x: r.right, y: r.bottom, vis: getComputedStyle(document.getElementById('mzHubMappa')).display }; });
    assert(mappa.vis !== 'none' && mappa.w > 80 && mappa.x <= 844 && mappa.y <= 390, 'minimappa ' + JSON.stringify(mappa));
    await set(tp, { comandi: null });
  });

  await ctx.test('banco 844×390: il garage cambia veicolo e lo salva', async () => {
    await set(tp, { pausa: true, porta: 'garage' });
    let s = await avanti(tp, 2);
    assert(s.pannello === 'garage' && s.fermo, 'garage: ' + s.pannello);
    await sleep(200);
    const box = await tp.locator('#mzGarage').boundingBox();
    assert(box && box.y >= 0 && box.y + box.height <= 390, 'il garage esce dallo schermo: ' + JSON.stringify(box));
    const n = await tp.locator('#mzGarage [data-veicolo]').count();
    assert(n >= 6, `veicoli nel garage: ${n}`);
    await foto(tp, 'telefono_4_garage');
    await tp.locator('#mzGarage [data-veicolo="auto"]').click();
    s = await hs(tp);
    assert(s.veicolo === 'auto' && !s.pannello && !s.fermo, `veicolo ${s.veicolo}, pannello ${s.pannello}`);
    const mem = JSON.parse(await tp.evaluate(() => localStorage.getItem('mz-corse-scelta')));
    assert(mem.veicolo === 'auto', 'non salvato: ' + JSON.stringify(mem));
    await tp.waitForFunction(() => window.__provahub.state().avatar, null, { timeout: 10000 });
  });

  await ctx.test('banco 844×390: porta chiusa → «Porta sbarrata», il veicolo rimbalza indietro', async () => {
    const chiusa = M.porte.find((p) => !p.aperta);
    assert(chiusa, 'nessuna porta chiusa');
    await set(tp, { pausa: true, porta: chiusa.id, comandi: { mx: 0, my: 1 } });
    let s = await avanti(tp, 3);
    assert(/Porta sbarrata: .+ arriva presto/.test(s.messaggio ?? ''), 'messaggio: ' + s.messaggio);
    assert(s.v < 0, 'non rimbalza: v ' + s.v);
    await fotogrammi(tp); await foto(tp, 'telefono_5_porta_chiusa');
    await set(tp, { comandi: { mx: 0, my: 0 } });
    s = await avanti(tp, 90);
    assert(dist(s, chiusa) > chiusa.raggio && !s.pannello, `ancora dentro: ${dist(s, chiusa).toFixed(1)} m`);
    await set(tp, { comandi: null });
  });

  await ctx.test('banco 844×390: tornando al molo compare «Torna in barca» (nel banco rimette al molo, nel gioco porta nell\'arcipelago)', async () => {
    await set(tp, { pausa: true, fuori: 'garage' });
    let s = await avanti(tp, 1);
    assert(!s.barca, 'il bottone c\'è lontano dal molo');
    await set(tp, { x: M.molo.x, z: M.molo.z, yaw: M.molo.yaw });
    s = await avanti(tp, 1);
    assert(s.barca && await tp.isVisible('#mzHubBarca'), 'al molo non compare «Torna in barca»');
    await fotogrammi(tp); await foto(tp, 'telefono_8_torna_in_barca');
    const u = s.uscite;
    await tp.locator('#mzHubBarca').click();
    s = await hs(tp);
    assert(s.uscite === u + 1, 'il bottone non fa uscire');
  });

  await ctx.test('banco 844×390: porta della Spiaggia → scelta della pista → gara locale → di nuovo nell\'hub davanti alla porta', async () => {
    const sp = M.porte.find((p) => p.id === 'spiaggia');
    await set(tp, { pausa: true, porta: 'spiaggia' });
    let s = await avanti(tp, 2);
    assert(s.pannello === 'piste' && s.fermo, 'pannello ' + s.pannello);
    await sleep(200);
    const box = await tp.locator('#mzGpIntro .box').boundingBox();
    assert(box && box.y >= 0 && box.y + box.height <= 390, 'la scelta esce dal telefono: ' + JSON.stringify(box));
    assert(await tp.isVisible('#mzGpIntro [data-id="auto"]'), 'il veicolo del garage non è nella scelta');
    await foto(tp, 'telefono_6_porta_spiaggia');
    await tp.locator('#mzGpVia').click();
    await tp.waitForFunction(() => window.__provahub.state().gara !== null, null, { timeout: 10000 });
    s = await hs(tp);
    assert(s.gara.pista.startsWith('spiaggia_') && s.gara.veicolo === 'auto', 'gara: ' + JSON.stringify(s.gara));
    await set(tp, { auto: true });
    s = (await finche(tp, 's.gara === null || s.gara.done', 60 * 300, 60)).s;
    assert(s.gara && s.gara.done, 'la gara non finisce: ' + JSON.stringify(s.gara));
    await set(tp, { auto: false }); // finita la gara il pilota automatico guiderebbe di nuovo verso la porta
    s = (await finche(tp, 's.gara === null', 600, 30)).s;
    assert(s.gara === null && s.gareFatte === 1 && s.aperto && !s.fermo && !s.pannello, 'dopo la gara: ' + JSON.stringify({ gara: s.gara, gareFatte: s.gareFatte, fermo: s.fermo, pannello: s.pannello }));
    assert(dist(s, sp) < sp.raggio + 8 && dist(s, sp) > sp.raggio, `non è davanti alla porta: ${dist(s, sp).toFixed(1)} m`);
    await fotogrammi(tp); await foto(tp, 'telefono_7_dopo_gara');
  });

  await ctx.test('banco 844×390: il pilota automatico va dal molo alla porta della Spiaggia', async () => {
    await set(tp, { pausa: true, fuori: 'molo', auto: true });
    const { s, t } = await finche(tp, 's.pannello === "piste"', 60 * 120, 15);
    assert(s.pannello === 'piste', `non arriva: dopo ${t} tick è in ${s.x},${s.z} (porta della Spiaggia a ${M.porte.find((p) => p.id === 'spiaggia').x},${M.porte.find((p) => p.id === 'spiaggia').z})`);
    numeri.banco.pilota = { secondi: Math.round(t / 6) / 10, salti: s.salti, urti: s.urti };
    ctx.log(`pilota automatico: molo → porta della Spiaggia in ${(t / 60).toFixed(1)} s di guida, ${s.urti} urti`);
    await tp.evaluate(() => document.querySelector('#mzGpIntro .esci')?.click());
    await set(tp, { auto: false, pausa: false });
  });
  await ctx.test('banco 844×390: nessun errore in console', async () => ctx.noErrors(T, 'provahub'));

  // ================= banco, telefono in verticale =================
  await ctx.test('banco 390×844: avviso «Ruota il telefono» e la guida aspetta', async () => {
    const V = await apri('', ctx.B.IPHONE);
    const s0 = await hs(V.page);
    assert(s0.ruota === true && await V.page.evaluate(() => document.querySelector('.pp-ruota')?.classList.contains('on') === true), 'l\'avviso non c\'è');
    await set(V.page, { comandi: { mx: 0, my: 1 } });
    await sleep(1200);
    const s1 = await hs(V.page);
    assert(dist(s0, s1) < 0.1, `si guida sotto l'avviso: ${dist(s0, s1)}`);
    await foto(V.page, 'telefono_verticale_avviso');
    ctx.noErrors(V, 'provahub verticale');
  });

  // ================= banco, PC =================
  await ctx.test('banco PC: ↑ gas, ← + Spazio = drift a sinistra, Esc chiude il pannello', async () => {
    const D = await apri('ruota=0', ctx.B.DESKTOP), dp = D.page;
    const P = await spiazzo(dp);
    assert(P, 'nessun tratto di strada con spazio intorno');
    await set(dp, P);
    await dp.keyboard.down('ArrowUp');
    await dp.waitForFunction(() => window.__provahub.state().v > 9.5, null, { timeout: 30000 });
    await dp.keyboard.down('ArrowLeft'); await dp.keyboard.down('Space');
    await dp.waitForFunction(() => window.__provahub.state().drift === -1, null, { timeout: 5000 });
    await sleep(700);
    await foto(dp, 'pc_1_drift');
    await dp.keyboard.up('Space'); await dp.keyboard.up('ArrowLeft'); await dp.keyboard.up('ArrowUp');
    const perf = await dp.evaluate(() => window.__provahub.perf());
    numeri.banco.pc = perf;
    await set(dp, { porta: 'garage' });
    await dp.waitForFunction(() => window.__provahub.state().pannello === 'garage', null, { timeout: 15000 });
    await foto(dp, 'pc_2_garage');
    await dp.keyboard.press('Escape');
    await dp.waitForFunction(() => window.__provahub.state().pannello === null, null, { timeout: 5000 });
    ctx.noErrors(D, 'provahub PC');
    assert(perf.drawCalls <= MAX_DC && perf.triangles <= MAX_TRI, 'budget in drift da PC: ' + JSON.stringify(perf));
  });
  salva();

  // ================= gioco vero (wrangler locale) =================
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m4corsehub-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const pages = [];
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('mia', 'Mia', 'tokM', 1);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    const G = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1`, { viewport: LAND }); pages.push(G); ctx._pages.push(G);
    const page = G.page;
    await ctx.waitReady(page, 40000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.temi && s.compass, 40000);
    const st = () => ctx.getState(page);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('gioco: GIOCA all\'Isola delle Corse apre l\'hub al molo (avatar al volante), il mondo sta fermo, budget, si guida', async () => {
      await hook('temiProva', null);
      const v = await hook('spotVai', SPOT);
      assert(v && v.aperta === true, 'spotVai: ' + JSON.stringify(v));
      await ctx.waitState(page, (s, id) => s.minigiochi.near === id, 20000, SPOT);
      await sleep(1200);
      numeri.gioco.bottone = await page.locator('#mzPlay').innerText();
      await page.locator('#mzPlay').click();
      await ctx.waitState(page, (s) => s.corse && s.corse.hub && s.corse.hub.aperto === true, 20000);
      await ctx.waitState(page, (s) => s.corse.hub.kit && s.corse.hub.avatar, 30000);
      await sleep(600);
      const s = await st(), h = s.corse.hub;
      assert(h.vicino === 'molo' && !s.corse.active && !(await page.isVisible('#mzTop')), 'hub: ' + JSON.stringify(h).slice(0, 300));
      const perf = await ctx.getPerf(page);
      numeri.gioco.molo = { drawCalls: perf.drawCalls, triangles: perf.triangles };
      await foto(page, 'gioco_1_hub_molo');
      // gas in avanti sullo schermo (assi mondo con la camera del mondo a 45°: (−0,707, −0,707)); SwiftShader è lento: si aspetta lo spostamento
      await hook('wp2_inject', { mx: -0.707, my: -0.707, a: false });
      await ctx.waitState(page, (q, p0) => Math.hypot(q.corse.hub.x - p0[0], q.corse.hub.z - p0[1]) > 4, 30000, [h.x, h.z]);
      const h2 = (await st()).corse.hub;
      await hook('wp2_inject', null);
      assert(Math.abs(h2.y - h2.quota) < 0.6 || h2.aria, 'la quota non segue il terreno: ' + JSON.stringify(h2).slice(0, 200));
      assert(perf.drawCalls <= MAX_DC && perf.triangles <= MAX_TRI, `molo: ${perf.drawCalls} draw call, ${perf.triangles} triangoli`);
    });

    await ctx.test('gioco: porta della Spiaggia → scelta → gara (pilota automatico, il server la rigioca) → esito → di nuovo nell\'hub davanti alla porta', async () => {
      const before = (await st()).lot.resources;
      await hook('corseHubVai', 'spiaggia');
      await ctx.waitState(page, (s) => s.corse.scelta === true, 5000);
      await sleep(300);
      await foto(page, 'gioco_2_scelta');
      await hook('corseAuto', 12);
      await hook('corseVia');
      await ctx.waitState(page, (s) => s.corse.active === true, 20000);
      await sleep(600);
      const perf = await ctx.getPerf(page);
      numeri.gioco.gara = { drawCalls: perf.drawCalls, triangles: perf.triangles };
      await ctx.waitState(page, (s) => s.minigiochi.open === true, 150000);
      const s = await st(), r = s.minigiochi.last;
      ctx.log(`esito ${r.medal} ${r.score} · ${JSON.stringify(r.detail)}`);
      assert(r.detail.giri === r.detail.tot && r.detail.pos >= 1, 'esito: ' + JSON.stringify(r));
      if (r.premiata) for (const k of ['legno', 'pietra', 'perle']) assert(r.lot.resources[k] >= before[k] + r.premio[k], `${k} non pagato`);
      assert(s.corse.hub.aperto && !s.corse.active, 'sotto la scheda non c\'è l\'hub');
      numeri.gioco.esito = { medal: r.medal, detail: r.detail };
      await sleep(300);
      await foto(page, 'gioco_3_esito_nell_hub');
      await hook('corseAuto', 0);
      await page.locator('#mzEsito [data-act="ok"]').click();
      await ctx.waitState(page, (q) => !q.minigiochi.open && !q.corse.active && q.corse.hub.aperto && q.corse.hub.vicino === 'spiaggia' && !q.corse.hub.fermo, 5000);
      // si riparte a guidare
      const perf2 = await ctx.getPerf(page);
      numeri.gioco.porta = { drawCalls: perf2.drawCalls, triangles: perf2.triangles };
      await hook('wp2_inject', { mx: -0.707, my: -0.707, a: false });
      await ctx.waitState(page, (q) => Math.abs(q.corse.hub.v) > 2, 30000);
      await hook('wp2_inject', null);
      await foto(page, 'gioco_4_di_nuovo_nell_hub');
    });

    await ctx.test('gioco: Esc · Esci → di nuovo nell\'arcipelago (barra in alto, mondo libero)', async () => {
      await page.locator('#mzHubEsci').click();
      await ctx.waitState(page, (s) => !s.corse.hub.aperto && !s.minigiochi.busy, 5000);
      assert(await page.isVisible('#mzTop'), 'la barra in alto non è tornata');
      const s = await st();
      assert(s.mode === 'walk', 'modo ' + s.mode);
      await sleep(400);
      await foto(page, 'gioco_5_arcipelago');
    });
    ctx.noErrors(G, 'gioco');
  } finally {
    salva();
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
