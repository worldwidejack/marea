// Banco di prova delle piste (provapiste.html, motore v2 dell'Isola delle Corse, docs/CORSE.md A11). Per ogni pista:
// - la pagina si apre senza errori;
// - il pilota automatico corre la gara fino in fondo, senza cadute;
// - draw call ≤ 100 e triangoli ≤ 150.000 a 390×844.
// Sulla pista folle si controlla che il giro della morte si faccia a testa in giù, che ci sia il salto e che si prenda la scorciatoia.
// Poi la Spiaggia e porto: il porto è misto (ruote e barche, ognuno nella sua corsia) e nella fuga l'onda raggiunge chi va piano.
// Screenshot da telefono (camera dietro e vista dall'alto) e da PC (giro della morte e baia) in tests/out/shots/m4_provapiste_*.
// Numeri in tests/out/m4_provapiste.json.
export const timeout = 300000;
const MAX_DC = 100, MAX_TRI = 150000;

export default async function (ctx) {
  const { assert } = ctx;
  const numeri = {};
  const apri = async (q, o = {}) => {
    const p = await ctx.open('provapiste.html?' + q, o);
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
      await p.page.evaluate(() => window.__provapiste.set({ cam: 'pianta' }));
      await fotogrammi(p.page);
      await ctx.shot(p.page, `${id}_pianta`);
      assert(st.travolto === 0, `${id}: il pilota automatico non deve farsi prendere dall'onda`);
      numeri[id] = { drawCalls: perf.drawCalls, triangles: perf.triangles, ms: st.ms, pos: st.pos, salti: st.salti };
      ctx.log(`${id}: ${perf.drawCalls} draw call, ${perf.triangles} triangoli · ${st.pos}° in ${(st.ms / 1000).toFixed(1)} s, ${st.salti} salti`);
      assert(perf.drawCalls <= MAX_DC && perf.triangles <= MAX_TRI, `${id}: ${perf.drawCalls} draw call, ${perf.triangles} triangoli`);
    });
  }
  await ctx.test('telefono: nessun errore in console', async () => ctx.noErrors(p, 'provapiste'));

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
    const prima = await d.page.evaluate(() => { const a = window.__provapiste; a.set({ auto: true, vai: true, cam: 'alta' }); return a.avanti(60 * 8); });
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
