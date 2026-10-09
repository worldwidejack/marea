// Banco di prova delle piste (provapiste.html, motore v2 dell'Isola delle Corse, docs/CORSE.md A11). Per ogni pista:
// - la pagina si apre senza errori;
// - il pilota automatico corre la gara fino in fondo, senza cadute;
// - draw call ≤ 100 e triangoli ≤ 150.000 a 390×844.
// Sulla pista folle si controlla che il giro della morte si faccia a testa in giù, che ci sia il salto e che si prenda la scorciatoia.
// Poi la Spiaggia e porto: il porto è misto (ruote e barche, ognuno nella sua corsia) e nella fuga l'onda raggiunge chi va piano.
// La guida (#170): partenza razzo del pilota automatico, drift da tastiera con le scintille (blu → viola), menù opzioni con le camere
// (dietro, alta, cofano), minimappa, interruttori delle regole.
// Screenshot da telefono (camera dietro e cofano) e da PC (giro della morte, drift viola, baia, porto, onda) in tests/out/shots/m4_provapiste_*.
// Numeri in tests/out/m4_provapiste.json.
export const timeout = 300000;
const MAX_DC = 100, MAX_TRI = 150000;

export default async function (ctx) {
  const { assert } = ctx;
  const numeri = {};
  const apri = async (q, o = {}) => {
    const p = await ctx.open('provapiste.html?ruota=0&' + q, o);
    await p.page.waitForFunction(() => window.__provapiste && window.__provapiste.ready === true, null, { timeout: 30000 });
    return p;
  };
  const corri = (page, tick) => page.evaluate((t) => { const a = window.__provapiste; a.set({ auto: true, vai: true }); let st = a.state(); for (let i = 0; i < t && !st.done; i += 60) st = a.avanti(60); return st; }, tick);
  const fotogrammi = (page, n = 3) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

  const p = await apri('pista=prova_anello');
  const piste = await p.page.evaluate(() => window.__provapiste.piste);
  assert(piste.length >= 8, `piste: ${piste}`);
  for (const id of piste) {
    await ctx.test(`telefono: ${id} — il pilota automatico arriva in fondo senza cadute, draw call e triangoli nel budget`, async () => {
      await p.page.evaluate((x) => window.__provapiste.set({ pista: x, cam: 'dietro', bot: true }), id);
      let st = await corri(p.page, 60 * 8);
      await fotogrammi(p.page);
      const perf = await p.page.evaluate(() => window.__provapiste.perf());
      await ctx.shot(p.page, `${id}_dietro`);
      st = await corri(p.page, 60 * 240);
      assert(st.done && st.risultato && st.risultato.detail.giri === st.risultato.detail.tot, `${id}: ${JSON.stringify(st)}`);
      assert(st.cadute === 0, `${id}: ${st.cadute} cadute`);
      await p.page.evaluate(() => window.__provapiste.set({ cam: 'cofano' }));
      await fotogrammi(p.page);
      await ctx.shot(p.page, `${id}_cofano`);
      const mappa = await p.page.evaluate(() => { const r = document.getElementById('ppMappa').getBoundingClientRect(); return { w: r.width, h: r.height, x: r.right }; });
      assert(mappa.w > 80 && mappa.h > 60 && mappa.x <= 390, `minimappa ${JSON.stringify(mappa)}`);
      assert(st.travolto === 0, `${id}: il pilota automatico non deve farsi prendere dall'onda`);
      numeri[id] = { drawCalls: perf.drawCalls, triangles: perf.triangles, ms: st.ms, pos: st.pos, salti: st.salti };
      ctx.log(`${id}: ${perf.drawCalls} draw call, ${perf.triangles} triangoli · ${st.pos}° in ${(st.ms / 1000).toFixed(1)} s, ${st.salti} salti`);
      assert(perf.drawCalls <= MAX_DC && perf.triangles <= MAX_TRI, `${id}: ${perf.drawCalls} draw call, ${perf.triangles} triangoli`);
    });
  }
  await ctx.test('telefono: il menù opzioni cambia la camera (dietro, alta, cofano); le regole si spengono', async () => {
    await p.page.click('#ppOpzioni');
    for (const [voce, cam] of [['alta', 'alta'], ['cofano', 'cofano'], ['dietro', 'dietro']]) {
      await p.page.click(`#ppMenu button[data-voce="${voce}"]`);
      const st = await p.page.evaluate(() => window.__provapiste.state());
      assert(st.cam === cam && st.menu, `${voce}: ${st.cam}`);
    }
    await ctx.shot(p.page, 'menu_opzioni');
    await p.page.click('#ppOpzioni');
    const st = await p.page.evaluate(() => window.__provapiste.set({ regole: { scia: false, somma: false } }));
    assert(!st.regole.scia && !st.regole.somma && st.regole.partenza, JSON.stringify(st.regole));
    await p.page.evaluate(() => window.__provapiste.set({ regole: { scia: true, somma: true } }));
  });
  await ctx.test('telefono: nessun errore in console', async () => ctx.noErrors(p, 'provapiste'));

  await ctx.test('PC: partenza razzo, drift da tastiera con le scintille blu → viola, turbo all\'uscita', async () => {
    const d = await apri('pista=prova_anello&veicolo=kart&bot=0', { viewport: ctx.B.DESKTOP });
    // il pilota automatico preme DRIFT al momento giusto del semaforo
    const via = await d.page.evaluate(() => { const a = window.__provapiste; a.set({ auto: true }); let st = a.state(); for (let i = 0; i < 400 && st.via > 0; i++) st = a.avanti(1); return a.avanti(1); });
    assert(via.partenza === 2 && via.turbo > 0, `partenza ${via.partenza}, turbo ${via.turbo}`);
    // da tastiera: Spazio tenuto e freccia a destra = drift, che carica
    await d.page.evaluate(() => { const a = window.__provapiste; a.set({ auto: false }); });
    await d.page.keyboard.down('ArrowUp'); // il gas non è più automatico
    await d.page.waitForFunction(() => window.__provapiste.state().v > 12, null, { timeout: 15000 }); // il drift parte sopra i 9 m/s
    await d.page.keyboard.down('ArrowRight'); await d.page.keyboard.down('Space');
    const tasti = await d.page.evaluate(() => new Promise((r) => {
      const a = window.__provapiste, t0 = performance.now(), o = { drift: 0, sc: 0, v: 0 };
      const f = () => { const st = a.state(); if (st.drift) o.drift = st.drift; o.sc = Math.max(o.sc, a.perf().scintille); o.v = st.v; if ((o.drift && o.sc > 0) || performance.now() - t0 > 3000) r(o); else setTimeout(f, 30); };
      f();
    }));
    await d.page.keyboard.up('Space'); await d.page.keyboard.up('ArrowRight'); await d.page.keyboard.up('ArrowUp');
    assert(tasti.drift === 1 && tasti.sc > 0, JSON.stringify(tasti));
    // senza gas si rallenta (il gas non è automatico): lasciare l'acceleratore è il modo di prendere le curve
    const v0 = await d.page.evaluate(() => window.__provapiste.state().v);
    await d.page.waitForFunction((x) => window.__provapiste.state().v < x - 3, v0, { timeout: 15000 });
    // il pilota automatico fino al viola, poi la foto in pausa; lasciato il drift parte il turbo
    const viola = await d.page.evaluate(() => { const a = window.__provapiste; a.set({ regole: {}, vai: true }); let st = a.state(); for (let i = 0; i < 60 * 60 && !(st.drift && st.livello === 3); i++) st = a.avanti(1); a.set({ pausa: true }); return st; });
    assert(viola.livello === 3, JSON.stringify(viola));
    await fotogrammi(d.page, 20);
    await ctx.shot(d.page, 'pc_drift_viola');
    const turbo = await d.page.evaluate(() => { const a = window.__provapiste; a.set({ pausa: false }); let st = a.state(); for (let i = 0; i < 600 && st.drift; i++) st = a.avanti(1); return st; });
    assert(turbo.turbo > 1, `turbo ${turbo.turbo}`);
    ctx.noErrors(d, 'provapiste PC guida');
  });


  await ctx.test('PC: sulla pista folle il giro della morte a testa in giù, il salto e la scorciatoia', async () => {
    const d = await apri('pista=prova_folle&veicolo=auto&bot=0', { viewport: ctx.B.DESKTOP });
    const giro = await d.page.evaluate(() => {
      const a = window.__provapiste; a.set({ auto: true, vai: true });
      let st = a.state(), inGiro = false, ramo = false, salto = false;
      for (let i = 0; i < 60 * 120 && !st.done; i++) {
        st = a.avanti(1);
        if (st.s > 96 && st.s < 108 && !inGiro) { inGiro = true; break; }
      }
      return { st, inGiro, ramo, salto };
    });
    assert(giro.inGiro, JSON.stringify(giro.st));
    await fotogrammi(d.page, 4);
    await ctx.shot(d.page, 'pc_giro_della_morte');
    const fine = await d.page.evaluate(() => {
      const a = window.__provapiste; let st = a.state(), ramo = 0, aria = 0;
      for (let i = 0; i < 60 * 240 && !st.done; i++) { st = a.avanti(1); if (st.ramo >= 0) ramo++; if (st.aria) aria++; }
      return { st, ramo, aria };
    });
    assert(fine.st.done && fine.ramo > 60 && fine.aria > 20 && fine.st.cadute === 0, JSON.stringify({ ...fine, st: { ...fine.st, risultato: null } }));
    await d.page.evaluate(() => window.__provapiste.set({ pista: 'prova_baia', cam: 'alta' }));
    await corri(d.page, 60 * 12);
    await fotogrammi(d.page, 4);
    await ctx.shot(d.page, 'pc_baia');
    ctx.noErrors(d, 'provapiste PC');
  });

  await ctx.test('PC: il porto è misto (barca nell\'acqua, ruote sul molo) e ognuno ha la sua scorciatoia', async () => {
    const d = await apri('pista=spiaggia_porto&veicolo=moto_acqua&bot=1', { viewport: ctx.B.DESKTOP });
    const corsa = (veicolo, fino) => d.page.evaluate(([v, f]) => {
      const a = window.__provapiste; a.set({ veicolo: v, auto: true, vai: true, cam: 'alta' });
      let st = a.state(), ramo = 0, lat = 0, n = 0;
      for (let i = 0; i < 60 * 240 && !st.done && st.ms < f; i++) { st = a.avanti(1); if (st.ramo >= 0) ramo++; if (st.ramo < 0 && !st.aria && st.ms > 3000) { lat += st.lat; n++; } }
      return { veicolo: st.veicolo, sup: st.sup, ramo, lat: lat / Math.max(1, n), bot: st.bot, done: st.done, cadute: st.cadute };
    }, [veicolo, fino]);
    const barca = await corsa('moto_acqua', 40000);
    assert(barca.veicolo === 'moto_acqua' && barca.bot === 4 && barca.lat < -2 && barca.ramo > 50 && barca.cadute === 0, JSON.stringify(barca));
    await fotogrammi(d.page, 4);
    await ctx.shot(d.page, 'pc_porto_barca');
    const ruote = await corsa('kart', 40000);
    assert(ruote.veicolo === 'kart' && ruote.lat > 2 && ruote.ramo > 50 && ruote.cadute === 0, JSON.stringify(ruote));
    const nomi = await d.page.evaluate(() => [...document.querySelectorAll('.pp-panel button')].map((b) => b.textContent));
    assert(nomi.some((x) => x.includes('pista: Porto')), JSON.stringify(nomi));
    ctx.noErrors(d, 'provapiste porto');
  });

  await ctx.test('PC: nella fuga l\'onda insegue: l\'indicatore c\'è, chi va piano viene preso (colpo una volta sola) e il carrello a tutto gas pure', async () => {
    const d = await apri('pista=spiaggia_fuga&veicolo=carrello&bot=1', { viewport: ctx.B.DESKTOP });
    // (#170) senza turbo al semaforo né scia: col razzo e la scia anche il carrello scappa all'onda (chi guida bene si salva)
    const prima = await d.page.evaluate(() => { const a = window.__provapiste; a.set({ auto: true, vai: true, cam: 'alta', regole: { partenza: false, scia: false } }); return a.avanti(60 * 8); });
    assert(prima.onda !== null && prima.ondaDist > 20 && prima.travolto === 0, JSON.stringify(prima));
    const hud = await d.page.evaluate(() => document.querySelector('.pp-hud').textContent);
    assert(/ONDA \d+/.test(hud), hud);
    const vicina = await d.page.evaluate(() => { const a = window.__provapiste; let st = a.state(); for (let i = 0; i < 60 * 120 && !st.done && st.ondaDist > 14; i++) st = a.avanti(1); return st; });
    assert(vicina.ondaDist <= 14 && vicina.travolto === 0, JSON.stringify(vicina));
    await fotogrammi(d.page, 4);
    await ctx.shot(d.page, 'pc_fuga_onda_vicina');
    const hudVicina = await d.page.evaluate(() => document.querySelector('.pp-hud').innerHTML);
    assert(hudVicina.includes('background'), 'indicatore rosso sotto i 25 m: ' + hudVicina);
    const preso = await d.page.evaluate(() => { const a = window.__provapiste; let st = a.state(); for (let i = 0; i < 60 * 120 && !st.done && st.ondaDist > -4; i++) st = a.avanti(1); return st; });
    assert(preso.travolto === 1 && preso.cadute === 0, JSON.stringify(preso));
    await fotogrammi(d.page, 3);
    await ctx.shot(d.page, 'pc_fuga_travolto');
    ctx.noErrors(d, 'provapiste fuga');
  });
  ctx.writeOut('m4_provapiste.json', numeri);
}
