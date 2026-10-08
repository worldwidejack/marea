// Isola dei Templari (docs/TEMPLARI.md): senza server (net=0) e con ?templari=1. Telefono 390×844: c'è il bottone ⚔ delle prove, si entra
// subito nelle ondate (il chunk si scarica solo adesso), la chiesa si disegna (pavimento, muri, finestre con le assi), parte l'ondata 1, gli
// zombie escono dal sagrato, strappano le assi ed entrano; col pilota si superano ondate e si fanno punti; draw call nel budget con gli
// zombie in scena; AZIONE compare vicino a una finestra rotta; la pausa ferma la partita, ESCI → scheda dell'esito («senza link niente
// premio») → di nuovo nel mondo. PC 1280×720: Esc apre la pausa, F posa la reliquia sull'altare (ondate dall'altare, non subito), la mira
// A MANO resta salvata. Screenshot in tests/out/shots/m4_templari_*.png.
export const timeout = 240000;

export default async function (ctx) {
  const { assert } = ctx;
  const tpl = (st) => st.templari ?? {};

  // ---------------- telefono ----------------
  const p = await ctx.open('?test=1&net=0&templari=1');
  await ctx.waitReady(p.page, 20000);
  const page = p.page;
  await ctx.test('telefono: bottone ⚔ delle prove, isola aperta, chunk non ancora scaricato', async () => {
    assert(await page.isVisible('#mzTemplariProva'), 'bottone ⚔ assente');
    const st = await ctx.getState(page);
    assert(tpl(st).aperta === true && tpl(st).active === false, `templari: ${JSON.stringify(tpl(st))}`);
    assert(st.temi.isole.some((i) => i.id === 'templari' && i.aperta), 'isola dei Templari non aperta con ?templari=1');
  });
  await ctx.test('telefono: dentro la chiesa, la scena si disegna e parte l’ondata 1', async () => {
    await page.click('#mzTemplariProva');
    await ctx.waitState(page, (st) => st.templari.active && st.templari.fase === 'gioca', 30000);
    const st = await ctx.getState(page);
    await ctx.waitState(page, (s) => s.templari.scena?.assi === 45, 5000);
    assert(st.templari.scena.muri > 50, `scena: ${JSON.stringify(st.templari.scena)}`);
    assert(await page.isVisible('#mzTpl'), 'HUD assente');
    assert(!(await page.isVisible('#mzTop')), 'la barra in alto della superficie è ancora visibile');
    await ctx.waitState(page, (s) => s.templari.ondata === 1, 20000);
    await ctx.shot(page, 'ondata1');
  });
  await ctx.test('telefono: gli zombie escono, strappano le assi; col pilota si superano ondate', async () => {
    await page.evaluate(() => window.__game.test.templariAutopilot(true, 6));
    await ctx.waitState(page, (st) => st.templari.zombie > 0, 30000);
    await ctx.waitState(page, (st) => st.templari.assi.some((n) => n < 5), 60000);
    await ctx.shot(page, 'assalto');
    const perf = await ctx.getPerf(page);
    ctx.log('perf con gli zombie', JSON.stringify(perf));
    assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls} > 100`);
    await ctx.waitState(page, (st) => st.templari.ondata >= 3 || st.templari.done, 150000);
    const st = await ctx.getState(page);
    ctx.log('dopo il pilota', JSON.stringify({ ondata: st.templari.ondata, uccisioni: st.templari.uccisioni, punti: st.templari.eroe.punti, vita: st.templari.eroe.vita }));
    assert(st.templari.uccisioni >= 6, `uccisioni ${st.templari.uccisioni}, punti ${st.templari.eroe.punti}`); // i punti il pilota li spende in armi
    await page.evaluate(() => window.__game.test.templariAutopilot(false));
    await ctx.shot(page, 'ondata3');
  });
  await ctx.test('telefono: armi — l’arco dall’altare laterale, la cassa del tesoro, munizioni nel HUD', async () => {
    let st = await ctx.getState(page);
    if (!st.templari.done) {
      await page.evaluate(() => window.__game.test.templariAutopilot(true, 6));
      await ctx.waitState(page, (s) => s.templari.done || s.templari.armi.some((a) => a?.id === 'arco'), 60000);
      await ctx.waitState(page, (s) => s.templari.done || s.templari.cassa.fase === 'gira' || s.templari.cassa.fase === 'pronta', 90000).catch(() => {});
      st = await ctx.getState(page);
      await page.evaluate(() => window.__game.test.templariAutopilot(false));
      if (st.templari.cassa.fase === 'gira' || st.templari.cassa.fase === 'pronta') await ctx.shot(page, 'cassa');
    }
    st = await ctx.getState(page);
    ctx.log('armi', JSON.stringify(st.templari.armi), 'cassa', JSON.stringify(st.templari.cassa), 'effetti', JSON.stringify(st.templari.effetti));
    assert(st.templari.armi.some((a) => a?.id === 'arco'), `l’arco non è stato preso: ${JSON.stringify(st.templari.armi)}`);
    if (!st.templari.done) assert((await page.textContent('#mzTpl .arma')).length > 3, 'HUD dell’arma vuoto');
  });
  await ctx.test('telefono: pausa ferma tutto, ESCI → scheda dell’esito senza premio → di nuovo nel mondo', async () => {
    const st0 = await ctx.getState(page);
    if (!st0.templari.done) {
      await page.click('#mzTplPausaBtn');
      await ctx.waitState(page, (st) => st.templari.pausa === true, 5000);
      const t0 = (await ctx.getState(page)).templari.tick;
      await page.waitForTimeout(800);
      assert((await ctx.getState(page)).templari.tick === t0, 'la partita va avanti in pausa');
      await page.click('#mzTplPausa [data-act=esci]');
      await page.click('#mzTplPausa [data-act=esci]');
    }
    await ctx.waitState(page, (st) => !!st.templariEsito?.aperto, 20000);
    const e = (await ctx.getState(page)).templariEsito;
    assert(e.premio === null && e.ondata >= 1, `esito: ${JSON.stringify(e)}`);
    assert((await page.textContent('#mzTplEsito')).includes('link personale'), 'manca la riga «senza link niente premio»');
    await ctx.shot(page, 'esito');
    await page.click('#mzTplEsito [data-act=ok]');
    await ctx.waitState(page, (st) => !st.templari.active && !st.templari.busy, 10000);
    assert(await page.isVisible('#mzTop'), 'la barra in alto non è tornata');
    ctx.noErrors(p, 'telefono');
  });

  // ---------------- PC ----------------
  const d = await ctx.open('?test=1&net=0&templari=1', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  const pc = d.page;
  await ctx.test('PC: dall’altare (non subito), F posa la reliquia, Esc apre la pausa, A MANO resta salvata', async () => {
    await pc.evaluate(() => window.__game.test.templariEntra(false));
    await ctx.waitState(pc, (st) => st.templari.active && st.templari.fase === 'gioca', 30000);
    let st = await ctx.getState(pc);
    assert(st.templari.sim === 'altare' && st.templari.prompt === 'reliquia', `all'inizio: ${st.templari.sim}, prompt ${st.templari.prompt}`);
    await pc.waitForSelector('#mzTplAzione.on', { timeout: 20000 }).catch(() => { throw new Error('AZIONE non visibile vicino all’altare'); });
    await pc.keyboard.down('KeyF'); await pc.waitForTimeout(150); await pc.keyboard.up('KeyF');
    await ctx.waitState(pc, (s) => s.templari.sim === 'inizio' || s.templari.sim === 'combatti', 8000);
    await pc.keyboard.press('Escape');
    await ctx.waitState(pc, (s) => s.templari.pausa === true, 5000);
    await pc.click('#mzTplPausa [data-act=auto]');
    st = await ctx.getState(pc);
    assert(st.templari.mira === false, 'la mira non è passata a mano');
    assert((await pc.evaluate(() => localStorage.getItem('marea:templari:auto'))) === '0', 'A MANO non salvata');
    await ctx.shot(pc, 'pc_pausa');
    await pc.click('#mzTplPausa [data-act=auto]');
    await pc.keyboard.press('Escape');
    await ctx.waitState(pc, (s) => s.templari.pausa === false, 5000);
    await ctx.waitState(pc, (s) => s.templari.ondata === 1, 15000);
    await ctx.shot(pc, 'pc_ondata1');
  });
  await ctx.test('PC: si vedono moschetto, scudato, scudo in mano e fuoco greco (hook di prova, solo resa)', async () => {
    const r = await pc.evaluate(() => window.__game.test.templariProva({ arma: 'moschetto', zombie: 'scudato', scudo: 'spalle' }));
    assert(r && r.arma === 'moschetto' && r.scudo, `prova: ${JSON.stringify(r)}`);
    await pc.evaluate(() => window.__game.test.setZoom(0.7));
    await pc.waitForTimeout(700);
    await ctx.shot(pc, 'pc_moschetto_scudato');
    await pc.keyboard.press('KeyQ'); await pc.keyboard.press('KeyQ');
    await ctx.waitState(pc, (st) => st.templari.scudo?.inMano === true, 5000);
    await pc.waitForTimeout(400);
    await ctx.shot(pc, 'pc_scudo_in_mano');
    await pc.evaluate(() => window.__game.test.templariProva({ arma: 'fuoco_greco', zombie: 'fante' }));
    await pc.keyboard.down('Space'); await pc.waitForTimeout(120); await pc.keyboard.up('Space');
    await ctx.waitState(pc, (st) => st.templari.effetti.fiamme > 0, 8000);
    await ctx.shot(pc, 'pc_fuoco_greco');
  });
  await ctx.test('PC: pirata, cannoniere, Templare a cavallo e de Molay (barra del boss), tutti insieme nel budget', async () => {
    // mira A MANO (dalla pausa) e spada in mano: così i nemici restano interi per la foto
    await pc.keyboard.press('Escape'); await pc.click('#mzTplPausa [data-act=auto]'); await pc.keyboard.press('Escape');
    await pc.evaluate(() => window.__game.test.templariProva({ arma: 'spada' }));
    const posti = [['pirata', 3, -2.2], ['cannoniere', 3.5, 2.2], ['cavaliere', 6, -1], ['molay', 5.5, 2.8]];
    for (const [t, dist, lato] of posti) await pc.evaluate(([t, dist, lato]) => window.__game.test.templariProva({ zombie: t, dist, lato }), [t, dist, lato]);
    await pc.evaluate(() => window.__game.test.setZoom(0.9));
    await ctx.waitState(pc, (st) => st.templari.zombie >= 4, 8000);
    await pc.waitForTimeout(2600); // escono da terra
    await ctx.shot(pc, 'pc_nemici_boss');
    assert(await pc.isVisible('#mzTpl .boss.on'), 'barra del boss assente');
    const perf = await ctx.getPerf(pc);
    ctx.log('perf coi boss', JSON.stringify(perf), JSON.stringify((await ctx.getState(pc)).templari.attori));
    assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls} > 100`);
    ctx.noErrors(d, 'PC');
  });
  await ctx.test('PC: F compra il portale (cartello col prezzo), la piazza si apre; la leva accende il rogo; i power-up a terra, Ira di Dio nel HUD', async () => {
    const prova = (o) => pc.evaluate((o) => window.__game.test.templariProva(o), o);
    await prova({ pulisci: true, vita: 1e6, punti: 3000, dove: { x: 37.5, z: 42.5 } });
    await ctx.waitState(pc, (st) => st.templari.prompt === 'porta', 5000);
    await ctx.shot(pc, 'pc_portale');
    await pc.keyboard.down('KeyF'); await pc.waitForTimeout(120); await pc.keyboard.up('KeyF');
    await ctx.waitState(pc, (st) => st.templari.porte?.portale === true, 5000);
    await prova({ dove: { x: 22.5, z: 44.5 } });
    await pc.waitForTimeout(600);
    await ctx.shot(pc, 'pc_piazza');
    const perf = await ctx.getPerf(pc);
    ctx.log('perf in piazza', JSON.stringify(perf), JSON.stringify((await ctx.getState(pc)).templari.scena));
    assert(perf.drawCalls <= 100, `draw call in piazza ${perf.drawCalls} > 100`);
    // la leva del rogo, accanto agli stalli del presbiterio
    await prova({ dove: { x: 63.5, z: 45.5 }, punti: 3000 });
    await ctx.waitState(pc, (st) => st.templari.prompt === 'trappola', 5000);
    await pc.keyboard.down('KeyF'); await pc.waitForTimeout(120); await pc.keyboard.up('KeyF');
    await ctx.waitState(pc, (st) => (st.templari.trappole?.find((t) => t.id === 'rogo')?.accesa ?? 0) > 20, 5000);
    await pc.waitForTimeout(400);
    await ctx.shot(pc, 'pc_rogo');
    // power-up: uno davanti (per la foto), uno sotto i piedi (Ira di Dio)
    await prova({ dove: { x: 50.5, z: 40.5 }, potere: 'campane' });
    await pc.waitForTimeout(500);
    await ctx.shot(pc, 'pc_potere');
    await prova({ potereQui: 'ira' });
    await ctx.waitState(pc, (st) => (st.templari.poteri?.ira ?? 0) > 25, 5000);
    assert(await pc.isVisible('#mzTpl .pot span'), 'Ira di Dio non si vede nel HUD');
    await ctx.shot(pc, 'pc_ira');
    ctx.noErrors(d, 'PC');
  });
  await ctx.test('PC: ambientazione — rotonda col tamburo e le croci, cimitero coi cipressi, borgo, spiaggia col mare e la nave', async () => {
    const prova = (o) => pc.evaluate((o) => window.__game.test.templariProva(o), o);
    const sc = (await ctx.getState(pc)).templari.scena;
    ctx.log('arredi', JSON.stringify(sc));
    assert(sc.croci >= 8 && sc.archi >= 4 && sc.cipressi >= 20 && sc.usci >= 4, `arredi mancanti: ${JSON.stringify(sc)}`);
    await pc.evaluate(() => window.__game.test.setZoom(1.3));
    await prova({ pulisci: true, vita: 1e6, porte: ['cimitero', 'taverna', 'spiaggia_taverna'] });
    const posti = [['rotonda', 47.5, 49.5], ['cimitero', 62.5, 14.5], ['borgo', 20.5, 47.5], ['taverna', 16.5, 77.5], ['accampamento', 60.5, 70.5]];
    for (const [nome, x, z] of posti) {
      await prova({ pulisci: true, dove: { x, z } });
      await pc.waitForTimeout(900);
      await ctx.shot(pc, 'pc_luogo_' + nome);
      const perf = await ctx.getPerf(pc);
      assert(perf.drawCalls <= 100, `draw call ${nome} ${perf.drawCalls} > 100`);
    }
    ctx.noErrors(d, 'PC');
  });
}
