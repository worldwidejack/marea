// Scenografia della Spiaggia e porto (apps/client/src/corse/scena.ts, kit `cs_*` in manifest_corse.json, #176). Per ogni pista della zona:
// - il kit si scarica e si monta (pezzi, teste dei manichini) senza errori in console;
// - durante tutta la gara del pilota automatico draw call ≤ 100 e triangoli ≤ 150.000 a 390×844 (il massimo su una foto ogni 6 s);
// - le teste dei manichini si girano verso la camera quando passa.
// Screenshot di gara (telefono) e dall'alto (provascena.html) in tests/out/shots/m4_corse_scena_*. Numeri in tests/out/m4_corse_scena.json.
export const timeout = 300000;
const MAX_DC = 100, MAX_TRI = 150000;
const PISTE = ['spiaggia_lungomare', 'spiaggia_baia', 'spiaggia_porto', 'spiaggia_fuga'];
const DALL_ALTO = { spiaggia_lungomare: 'dist=230&pitch=50&yaw=200', spiaggia_baia: 'dist=380&pitch=60&yaw=200', spiaggia_porto: 'dist=330&pitch=60&yaw=200', spiaggia_fuga: 'dist=700&pitch=55&yaw=200' };

export default async function (ctx) {
  const { assert } = ctx;
  const numeri = {};
  const fotogrammi = (page, n = 3) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const scena = (page, id) => page.waitForFunction((x) => window.__corseScena && window.__corseScena.pista === x, id, { timeout: 30000 })
    .then(() => page.evaluate(() => window.__corseScena.pronta));
  const p = await ctx.open('provapiste.html?pista=spiaggia_lungomare');
  await p.page.waitForFunction(() => window.__provapiste && window.__provapiste.ready === true, null, { timeout: 30000 });
  for (const id of PISTE) {
    await ctx.test(`telefono: ${id} vestita — kit montato, budget rispettato per tutta la gara`, async () => {
      await p.page.evaluate((x) => window.__provapiste.set({ pista: x, cam: 'dietro', bot: true, auto: true, vai: true }), id);
      const sc = await scena(p.page, id);
      assert(sc.pezzi > 100, `${id}: solo ${sc.pezzi} pezzi`);
      let dc = 0, tri = 0, st = null;
      for (let k = 0; k < 40; k++) {
        st = await p.page.evaluate(() => window.__provapiste.avanti(360));
        await fotogrammi(p.page, 2);
        const perf = await p.page.evaluate(() => window.__provapiste.perf());
        dc = Math.max(dc, perf.drawCalls); tri = Math.max(tri, perf.triangles);
        if (k === 1) await ctx.shot(p.page, `${id}_gara`);
        if (st.done) break;
      }
      numeri[id] = { pezzi: sc.pezzi, teste: sc.teste, triangoliScena: sc.triangoli, maxDrawCalls: dc, maxTriangoli: tri };
      ctx.log(`${id}: ${sc.pezzi} pezzi, ${sc.teste} teste · max ${dc} draw call, ${tri} triangoli`);
      assert(dc <= MAX_DC && tri <= MAX_TRI, `${id}: ${dc} draw call, ${tri} triangoli`);
    });
  }
  await ctx.test('telefono: le teste dei manichini guardano chi passa', async () => {
    await p.page.evaluate(() => window.__provapiste.set({ pista: 'spiaggia_lungomare', vai: true }));
    await scena(p.page, 'spiaggia_lungomare');
    const giri = await p.page.evaluate(async () => {
      const im = window.__corseScena.gruppo.getObjectByName('corse_teste');
      if (!im) return null;
      const m = new im.matrix.constructor(), prima = [];
      for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m); prima.push(m.elements[0]); }
      for (let k = 0; k < 6; k++) { window.__provapiste.avanti(120); await new Promise((r) => setTimeout(r, 300)); await new Promise((r) => requestAnimationFrame(r)); }
      let cambiate = 0;
      for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m); if (Math.abs(m.elements[0] - prima[i]) > 1e-3) cambiate++; }
      return { teste: im.count, cambiate };
    });
    assert(giri && giri.teste > 20, `teste: ${JSON.stringify(giri)}`);
    assert(giri.cambiate > 0, `nessuna testa si è girata: ${JSON.stringify(giri)}`);
    ctx.log(`teste: ${giri.cambiate}/${giri.teste} girate`);
  });
  await ctx.test('telefono: nessun errore in console', async () => ctx.noErrors(p, 'banco'));
  for (const id of PISTE) {
    await ctx.test(`PC: ${id} dall'alto`, async () => {
      const v = await ctx.open(`provascena.html?pista=${id}&centro=1&${DALL_ALTO[id]}`, { viewport: { width: 1200, height: 750 } });
      await v.page.waitForFunction(() => window.__vista && window.__vista.ready === true, null, { timeout: 30000 });
      await fotogrammi(v.page, 3);
      await ctx.shot(v.page, `${id}_alto`);
      ctx.noErrors(v, 'vista');
      await v.page.close();
    });
  }
  ctx.writeOut('m4_corse_scena.json', numeri);
}
