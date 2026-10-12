// Snowboard dell'Isola dell'Adrenalina (docs/ADRENALINA.md §7, passo 3a di #189). Senza server (net=0), con ?adrenalina=1.
// Telefono 390×844: dalla funivia si scende (chunk a parte, scena a parte), 3-2-1, il dito curva sulla zona dei tocchi, le due camere A e B
// fotografate negli stessi punti (partenza, slalom, in volo sul trampolino, gola, l'abete caduto al bivio del fuoripista, il sentiero,
// arrivo) per la scelta di birbasan; la discesa intera col pilota automatico: arrivo, scheda, draw call e triangoli sotto il budget.
// PC 1280×720: frecce e Spazio, Esc riporta nel mondo davanti al cancello. Screenshot in tests/out/shots/m4_snowboard_*.png.
export const timeout = 300000;

export default async function (ctx) {
  const { assert } = ctx;
  const hook = (page, fn, ...args) => page.evaluate(([f, a]) => window.__game.test[f](...a), [fn, args]);
  const sb = async (page) => (await ctx.getState(page)).snowboard ?? {};
  const numeri = {};
  /** Il massimo di draw call e triangoli visti (TECH §5: 100 e 180.000). */
  const budget = { drawCalls: 0, triangles: 0 };
  const misura = async (page, nome) => {
    const perf = await ctx.getPerf(page);
    budget.drawCalls = Math.max(budget.drawCalls, perf.drawCalls); budget.triangles = Math.max(budget.triangles, perf.triangles);
    numeri[nome] = { drawCalls: perf.drawCalls, triangles: perf.triangles };
    assert(perf.drawCalls > 0 && perf.drawCalls <= 100, `${nome}: draw call ${perf.drawCalls}`);
    assert(perf.triangles <= 180000, `${nome}: triangoli ${perf.triangles}`);
  };
  const apri = async (page) => {
    assert(await hook(page, 'adrenalinaCarica') === true, 'funivia non scaricata');
    assert(await hook(page, 'snowboardVia') === true, 'snowboard non partito');
    await ctx.waitState(page, (st) => st.snowboard && st.snowboard.active, 20000);
  };

  // ---------------- telefono ----------------
  const p = await ctx.open('?test=1&net=0&adrenalina=1');
  await ctx.waitReady(p.page, 20000);
  const page = p.page;

  await ctx.test('telefono: dalla funivia si scende, 3-2-1 e via; il mondo sparisce, la pista c’è', async () => {
    await apri(page);
    const s0 = await sb(page);
    assert(s0.fase === 'via' && s0.scena.abeti > 500 && s0.scena.riquadri > 10, `scena: ${JSON.stringify(s0.scena)}`);
    assert(await page.isVisible('#mzSbAiuto'), 'niente aiuto dei comandi');
    assert(!(await page.isVisible('#joystick')) && !(await page.isVisible('#mzTop')), 'l’interfaccia del mondo resta su');
    await ctx.shot(page, 'via');
    await ctx.waitState(page, (st) => st.snowboard.fase === 'gara' && st.snowboard.frames > 30, 10000);
    const s1 = await sb(page);
    assert(s1.s > 6.5 && s1.v > 5, `non scende: s ${s1.s}, v ${s1.v}`);
  });

  await ctx.test('telefono: col dito sulla zona dei tocchi si curva, alzarlo è un salto', async () => {
    const box = await page.locator('#mzSbTocco').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height * 0.7;
    const l0 = (await sb(page)).lat;
    await page.dispatchEvent('#mzSbTocco', 'pointerdown', { pointerId: 7, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true });
    await page.dispatchEvent('#mzSbTocco', 'pointermove', { pointerId: 7, clientX: x + 60, clientY: y, pointerType: 'touch', isPrimary: true });
    await page.waitForTimeout(600);
    const s = await sb(page);
    assert(s.dito && s.lat > l0 + 0.5, `il dito non curva: lat ${l0} → ${s.lat}`);
    await page.dispatchEvent('#mzSbTocco', 'pointerup', { pointerId: 7, clientX: x + 60, clientY: y, pointerType: 'touch', isPrimary: true });
    await ctx.waitState(page, (st) => st.snowboard.aria || st.snowboard.h > 0, 2000).catch(() => {});
    const s2 = await sb(page);
    assert(!s2.dito, 'il dito resta giù');
  });

  /** I punti delle foto: [nome, s, lat, ticks col pilota automatico prima dello scatto]. */
  const PUNTI = [['partenza', 8, 0, 20], ['slalom', 300, 0, 40], ['volo', 0, 0, 0], ['gola', 830, 0, 40], ['tronco', 1275, 0, 70], ['sentiero', 1420, 0, 40], ['arrivo', 1560, 0, 40]];
  for (const cam of ['a', 'b']) {
    await ctx.test(`telefono: camera ${cam.toUpperCase()} negli stessi punti (scelta di birbasan)`, async () => {
      await hook(page, 'snowboardCamera', cam);
      for (const [nome, s, lat, ticks] of PUNTI) {
        if (nome === 'volo') {
          // sul primo trampolino col pilota automatico, foto quando è in aria
          await hook(page, 'snowboardMetti', { s: 580, lat: 0, v: 17 });
          await hook(page, 'snowboardAuto', 1);
          await ctx.waitState(page, (st) => st.snowboard.aria && st.snowboard.h > 1.5, 15000);
        } else {
          await hook(page, 'snowboardMetti', { s, lat, v: 15 });
          await hook(page, 'snowboardAuto', 1);
          await page.waitForTimeout((ticks / 60) * 1000 + 300);
        }
        await hook(page, 'snowboardAuto', 0);
        await misura(page, `${cam}_${nome}`);
        await ctx.shot(page, `${cam}_${nome}`);
      }
    });
  }

  await ctx.test('telefono: la discesa intera col pilota automatico arriva, porte e trick, la scheda d’arrivo', async () => {
    await hook(page, 'snowboardEsci');
    await ctx.waitState(page, (st) => !st.snowboard.active && !st.adrenalina.snowboard, 5000);
    assert(await hook(page, 'snowboardVia') === true, 'non riparte');
    await ctx.waitState(page, (st) => st.snowboard.active && st.snowboard.fase === 'gara', 15000);
    await hook(page, 'snowboardAuto', 6);
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      const s = await sb(page);
      if (s.fase === 'fine') break;
      await misura(page, 'giro');
      await page.waitForTimeout(1500);
    }
    const s = await sb(page);
    assert(s.fase === 'fine' && s.arrivato && s.risultato, `non arriva: ${JSON.stringify(s).slice(0, 300)}`);
    assert(s.porte >= 17 && s.cadute === 0 && s.trick >= 4 && s.punti > 3000, `discesa: porte ${s.porte}, cadute ${s.cadute}, trick ${s.trick}, punti ${s.punti}`);
    assert(s.eventi.includes('arrivo'), 'niente arrivo');
    assert(await page.isVisible('#mzSbFine'), 'niente scheda d’arrivo');
    numeri.discesa = { ms: s.risultato.detail.ms, punti: s.punti, porte: s.porte, trick: s.trick };
    await ctx.shot(page, 'fine');
    await page.click('#mzSbAncora');
    await ctx.waitState(page, (st) => st.snowboard.fase === 'via', 3000);
    await page.click('#mzSbEsci');
    await ctx.waitState(page, (st) => !st.snowboard.active, 3000);
    ctx.noErrors(p, 'telefono');
  });

  // ---------------- PC ----------------
  const d = await ctx.open('?test=1&net=0&adrenalina=1&camera=b', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  await ctx.test('PC: dal cancello con E si scende; ← → curvano, Spazio salta, C cambia camera, Esc torna al cancello', async () => {
    await hook(d.page, 'adrenalinaCarica');
    await hook(d.page, 'adrenalinaCancello');
    await d.page.waitForTimeout(500);
    await d.page.keyboard.down('KeyE'); await d.page.waitForTimeout(80); await d.page.keyboard.up('KeyE');
    await ctx.waitState(d.page, (st) => st.snowboard && st.snowboard.fase === 'gara' && st.snowboard.frames > 20, 15000);
    assert((await sb(d.page)).camera === 'b', 'camera da ?camera=b');
    const l0 = (await sb(d.page)).lat;
    await d.page.keyboard.down('ArrowRight'); await d.page.waitForTimeout(700); await d.page.keyboard.up('ArrowRight');
    const l1 = (await sb(d.page)).lat;
    assert(l1 > l0 + 0.5, `→ non curva: ${l0} → ${l1}`);
    await d.page.keyboard.down('Space'); await d.page.waitForTimeout(400); await d.page.keyboard.up('Space');
    await ctx.waitState(d.page, (st) => st.snowboard.aria, 2000);
    await d.page.keyboard.press('KeyC');
    assert((await sb(d.page)).camera === 'a', 'C non cambia camera');
    await misura(d.page, 'desktop');
    await ctx.shot(d.page, 'desktop');
    await d.page.keyboard.press('Escape');
    await ctx.waitState(d.page, (st) => !st.snowboard.active && st.adrenalina.near !== undefined, 5000);
    await d.page.waitForTimeout(600);
    const st = await ctx.getState(d.page);
    assert(st.mode === 'walk' && st.adrenalina.discese === 1, `dopo Esc: ${JSON.stringify(st.adrenalina).slice(0, 200)}`);
    ctx.noErrors(d, 'desktop');
  });
  ctx.log('numeri', JSON.stringify({ ...numeri, max: budget }));
  ctx.writeOut('m4_snowboard.json', { ...numeri, max: budget });
}
