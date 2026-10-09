// Minimappa (#62): il cerchio c'è (telefono in alto a destra, PC in basso a destra), M e il tocco aprono la mappa intera, Esc e ×
// la chiudono; Porto scoperto da subito, le altre isole nella nebbia finché non ci passi vicino. Screenshot: telefono e PC.
// Segnalino del navigatore (#144): un tocco sulla mappa lo mette (sull'icona di una meta si aggancia a lei), METE e freccia ti ci portano,
// resta dopo il ricaricamento, si toglie con × in METE, con TOGLI o da solo quando ci arrivi.
export const timeout = 240000;
export default async function (ctx) {
  const p = await ctx.open('?test=1&net=0');
  await ctx.waitReady(p.page, 20000);
  await p.page.waitForFunction(() => !!document.getElementById('mzMini'), null, { timeout: 40000 });
  await ctx.test('il cerchio c’è; Porto scoperto, le altre isole nella nebbia', async () => {
    await p.page.waitForTimeout(600);
    const st = (await ctx.getState(p.page)).mappa;
    ctx.assert(st && st.mini, `minimappa non visibile: ${JSON.stringify(st)}`);
    ctx.assert(st.viste.some((v) => v.startsWith('porto')), `Porto non scoperto: ${JSON.stringify(st.viste)}`);
    ctx.assert(st.coperte.length > 0, 'nessuna isola nella nebbia');
    const box = await p.page.evaluate(() => { const r = document.getElementById('mzMini').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth }; });
    ctx.assert(box.w >= 80 && box.x + box.w <= box.vw && box.y < 200, `posto del cerchio: ${JSON.stringify(box)}`);
    await ctx.shot(p.page, 'iphone_mini');
  });
  await ctx.test('M apre la mappa intera, Esc la chiude', async () => {
    await p.page.keyboard.press('KeyM'); await p.page.waitForTimeout(300);
    ctx.assert((await ctx.getState(p.page)).mappa.open, 'M non ha aperto la mappa');
    await ctx.shot(p.page, 'iphone_mappa');
    await p.page.keyboard.press('Escape'); await p.page.waitForTimeout(200);
    ctx.assert(!(await ctx.getState(p.page)).mappa.open, 'Esc non ha chiuso la mappa');
  });
  await ctx.test('il tocco sul cerchio apre, × chiude', async () => {
    await p.page.click('#mzMini'); await p.page.waitForTimeout(300);
    ctx.assert((await ctx.getState(p.page)).mappa.open, 'il tocco non ha aperto la mappa');
    await p.page.click('#mzMappa .hd button'); await p.page.waitForTimeout(200);
    ctx.assert(!(await ctx.getState(p.page)).mappa.open, '× non ha chiuso la mappa');
  });
  await ctx.test('isole scoperte: niente più nebbia, la scelta resta dopo il ricaricamento', async () => {
    await p.page.evaluate(() => window.__game.test.mappaScopri());
    ctx.assert((await ctx.getState(p.page)).mappa.coperte.length === 0, 'nebbia rimasta');
    await p.page.evaluate(() => window.__game.test.mappa('apri')); await p.page.waitForTimeout(300);
    await ctx.shot(p.page, 'iphone_mappa_scoperta');
    await p.page.reload(); await ctx.waitReady(p.page, 20000); await p.page.waitForFunction(() => !!document.getElementById('mzMini'), null, { timeout: 40000 }); await p.page.waitForTimeout(400);
    ctx.assert((await ctx.getState(p.page)).mappa.coperte.length === 0, 'le scoperte non sono rimaste');
    ctx.noErrors(p, 'minimappa');
  });
  // Segnalino del navigatore (#144)
  const tela = (page) => page.evaluate(() => { const b = document.querySelector('#mzMappa canvas').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  const pie = (page) => page.evaluate(() => ({ testo: document.querySelector('#mzMappa .pie').textContent, togli: getComputedStyle(document.querySelector('#mzMappa .pie [data-act=togli]')).display !== 'none' }));
  await ctx.test('segnalino: un tocco sulla mappa lo mette, METE e la freccia sullo schermo ti ci portano', async () => {
    await p.page.evaluate(() => window.__game.test.mappa('apri')); await p.page.waitForTimeout(300);
    ctx.assert((await ctx.getState(p.page)).segno === null, 'segnalino già messo all\'inizio');
    const pie0 = await pie(p.page);
    ctx.assert(/navigatore/.test(pie0.testo) && !pie0.togli, `riga in fondo senza segnalino: ${JSON.stringify(pie0)}`);
    const r = await tela(p.page);
    await p.page.touchscreen.tap(r.x + r.w * 0.06, r.y + r.h * 0.08); await p.page.waitForTimeout(300); // angolo in alto a sinistra: mare aperto, niente mete
    const s = await ctx.getState(p.page);
    ctx.assert(s.segno && !s.segno.su, `segnalino libero non messo: ${JSON.stringify(s.segno)}`);
    ctx.assert(s.mappa.open, 'il tocco ha chiuso la mappa');
    ctx.assert(s.compass.navi === 'segno' && s.compass.shown.includes('segno'), `bussola: ${JSON.stringify(s.compass)}`);
    const pie1 = await pie(p.page);
    ctx.assert(/Segnalino · \d+ m/.test(pie1.testo) && pie1.togli, `riga in fondo col segnalino: ${JSON.stringify(pie1)}`);
    await ctx.shot(p.page, 'iphone_mappa_segno');
    await p.page.keyboard.press('Escape');
    await ctx.waitState(p.page, (s) => !s.mappa.open && s.compass.pointer !== 'off', 4000);
    await p.page.waitForTimeout(200);
    await ctx.shot(p.page, 'iphone_segno');
  });
  await ctx.test('segnalino: resta dopo il ricaricamento; sull\'icona di una meta si aggancia a lei; × in METE lo toglie', async () => {
    const prima = (await ctx.getState(p.page)).segno;
    await p.page.reload(); await ctx.waitReady(p.page, 20000); await p.page.waitForFunction(() => !!document.getElementById('mzMini'), null, { timeout: 40000 }); await p.page.waitForTimeout(400);
    const dopo = (await ctx.getState(p.page)).segno;
    ctx.assert(dopo && Math.abs(dopo.x - prima.x) < 0.01 && Math.abs(dopo.z - prima.z) < 0.01, `segnalino non rimasto: ${JSON.stringify({ prima, dopo })}`);
    const reg = (await ctx.getState(p.page)).minigiochi.spots.find((x) => x.id === 'regata');
    await p.page.evaluate(() => window.__game.test.mappa('apri')); await p.page.waitForTimeout(300);
    const at = await p.page.evaluate(([x, z]) => window.__game.test.mappaSchermo(x, z), [reg.x, reg.z]);
    await p.page.touchscreen.tap(at.x, at.y); await p.page.waitForTimeout(300);
    const s = await ctx.getState(p.page);
    ctx.assert(s.segno?.su === 'regata' && s.segno.x === reg.x && s.segno.z === reg.z, `non agganciato alla Regata: ${JSON.stringify(s.segno)}`);
    ctx.assert(/^Regata · \d+ m/.test((await pie(p.page)).testo), 'riga in fondo: ' + (await pie(p.page)).testo);
    await ctx.shot(p.page, 'iphone_mappa_segno_regata');
    await p.page.keyboard.press('Escape'); await p.page.waitForTimeout(200);
    if (!(await ctx.getState(p.page)).compass.open) await p.page.locator('#mzMete').click();
    await ctx.waitState(p.page, (s) => s.compass.open, 3000);
    await p.page.locator('#compass [data-act="nessuna"]').click(); // NESSUNA spegne le altre mete, non il navigatore
    await ctx.waitState(p.page, (s) => s.compass.on.length === 1 && s.compass.on[0] === 'segno', 3000);
    await p.page.waitForTimeout(200);
    await ctx.shot(p.page, 'iphone_mete_segno');
    await p.page.locator('#compass .mz-mete-row.navi').click();
    await ctx.waitState(p.page, (s) => s.segno === null && s.compass.navi === null && !s.compass.shown.includes('segno'), 3000);
  });
  await ctx.test('segnalino: quando ci arrivi sparisce da solo', async () => {
    const reg = (await ctx.getState(p.page)).minigiochi.spots.find((x) => x.id === 'regata');
    await p.page.evaluate(([x, z]) => window.__game.test.segno(x, z), [reg.x, reg.z]);
    await p.page.waitForTimeout(300); // lontano: il segnalino si «arma»
    ctx.assert((await ctx.getState(p.page)).segno, 'segnalino non messo dal test');
    await p.page.evaluate(() => window.__game.test.spotVai('regata'));
    await ctx.waitState(p.page, (s) => s.segno === null, 4000);
    ctx.noErrors(p, 'segnalino');
  });
  const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  await d.page.waitForFunction(() => !!document.getElementById('mzMini'), null, { timeout: 40000 });
  await ctx.test('PC: cerchio in basso a destra, mappa grande', async () => {
    await d.page.waitForTimeout(600);
    await ctx.shot(d.page, 'desktop_mini');
    const box = await d.page.evaluate(() => { const r = document.getElementById('mzMini').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, vw: innerWidth, vh: innerHeight }; });
    ctx.assert(box.x > box.vw / 2 && box.y > box.vh / 2, `posto del cerchio: ${JSON.stringify(box)}`);
    await d.page.keyboard.press('KeyM'); await d.page.waitForTimeout(300);
    const r = await tela(d.page);
    await d.page.mouse.click(r.x + r.w * 0.06, r.y + r.h * 0.08); await d.page.waitForTimeout(300); // col mouse come col dito
    ctx.assert((await ctx.getState(d.page)).segno, 'il clic non ha messo il segnalino');
    await ctx.shot(d.page, 'desktop_mappa');
    await d.page.locator('#mzMappa .pie [data-act=togli]').click(); await d.page.waitForTimeout(200);
    ctx.assert((await ctx.getState(d.page)).segno === null, 'TOGLI non ha tolto il segnalino');
    const perf = await ctx.getPerf(d.page); ctx.log('perf', JSON.stringify(perf));
    ctx.assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls}`);
    ctx.noErrors(d, 'desktop');
  });
}
