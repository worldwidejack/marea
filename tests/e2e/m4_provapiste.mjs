// Banco di prova delle piste (provapiste.html, motore v2 dell'Isola delle Corse, docs/CORSE.md A11). Per ogni pista:
// - la pagina si apre senza errori;
// - il pilota automatico corre la gara fino in fondo, senza cadute;
// - draw call ≤ 100 e triangoli ≤ 150.000 a 390×844.
// Sulla pista folle si controlla che il giro della morte si faccia a testa in giù, che ci sia il salto e che si prenda la scorciatoia.
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
  assert(piste.length >= 4, `piste: ${piste}`);
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
  ctx.writeOut('m4_provapiste.json', numeri);
}
