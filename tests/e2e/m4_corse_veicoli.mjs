// Veicoli e animali piloti veri delle Corse (apps/client/src/corse/veicoli_kit.ts, `cs_v_*` e `cs_p_*` in manifest_corse.json, #178).
// - Il garage mostra tutti i 14 veicoli coi loro piloti, e con l'avatar MAREA al volante, senza errori in console;
// - sul banco di prova il kit arriva SENZA riavviare la gara in corso (il tempo non torna a zero) e l'avatar MAREA siede sul veicolo;
// - l'interruttore dell'aspetto (S) e quello degli animali (A) cambiano i veicoli e restano nel budget di draw call e triangoli.
// Screenshot in tests/out/shots/m4_corse_veicoli_*.
export const timeout = 240000;
const MAX_DC = 100, MAX_TRI = 150000;

export default async function (ctx) {
  const { assert } = ctx;
  const fotogrammi = (page, n = 3) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

  await ctx.test('PC: il garage mostra i 14 veicoli, con gli animali e con l\'avatar MAREA, senza errori', async () => {
    for (const q of ['giro=0', 'giro=0&avatar=1']) {
      const g = await ctx.open(`provagarage.html?${q}`, { viewport: { width: 1100, height: 700 } });
      await g.page.waitForFunction(() => window.__garage && window.__garage.ready === true, null, { timeout: 30000 });
      await fotogrammi(g.page, 20); // il tempo di scaricare l'avatar e sedersi
      const n = await g.page.evaluate(() => window.__garage.modelli.length);
      assert(n === 14, `garage: ${n} modelli invece di 14`);
      await ctx.shot(g.page, q.includes('avatar') ? 'garage_avatar' : 'garage_animali');
      await ctx.noErrors(g, `garage ${q}`);
    }
  });

  await ctx.test('telefono: il kit arriva a gara in corso senza riavviarla e l\'avatar siede sul veicolo', async () => {
    const p = await ctx.open('provapiste.html?ruota=0&pista=spiaggia_lungomare&bot=1');
    await p.page.waitForFunction(() => window.__provapiste && window.__provapiste.ready === true, null, { timeout: 30000 });
    await p.page.evaluate(() => window.__provapiste.set({ vai: true, auto: true, cam: 'dietro' }));
    await p.page.waitForFunction(() => window.__provapiste.state().kit === true, null, { timeout: 30000 });
    await p.page.evaluate(() => window.__provapiste.avanti(300));
    const st = await p.page.evaluate(() => window.__provapiste.state());
    assert(st.ms > 3000, `la gara è ripartita da capo quando è arrivato il kit (ms ${st.ms})`);
    await p.page.waitForFunction(() => window.__provapiste.state().avatar === true, null, { timeout: 30000 });
    await fotogrammi(p.page, 4);
    await ctx.shot(p.page, 'gara_avatar');
    await ctx.noErrors(p, 'banco');
  });

  await ctx.test('telefono: aspetto e animali cambiano i veicoli, draw call e triangoli nel budget', async () => {
    const p = await ctx.open('provapiste.html?ruota=0&pista=spiaggia_lungomare&bot=1');
    await p.page.waitForFunction(() => window.__provapiste && window.__provapiste.ready === true && window.__provapiste.state().kit === true, null, { timeout: 30000 });
    let dc = 0, tri = 0;
    for (const aspetto of ['', 'cs_v_pizza', 'cs_v_fuoristrada', 'cs_v_moto_acqua', 'cs_v_divano']) {
      for (const animali of [true, false]) {
        await p.page.evaluate((o) => window.__provapiste.set({ aspetto: o.aspetto, animali: o.animali, vai: true, auto: true }), { aspetto, animali });
        await p.page.evaluate(() => window.__provapiste.avanti(120));
        await fotogrammi(p.page, 3);
        const perf = await p.page.evaluate(() => window.__provapiste.perf());
        dc = Math.max(dc, perf.drawCalls); tri = Math.max(tri, perf.triangles);
        const st = await p.page.evaluate(() => window.__provapiste.state());
        assert(st.aspetto === aspetto && st.animali === animali, `aspetto/animali non applicati: ${JSON.stringify([st.aspetto, st.animali])}`);
      }
    }
    ctx.log(`veicoli veri: max ${dc} draw call, ${tri} triangoli`);
    assert(dc <= MAX_DC && tri <= MAX_TRI, `${dc} draw call, ${tri} triangoli`);
    await ctx.noErrors(p, 'banco');
  });
}
