// Impostazioni (#53): coi test (?test=1) si parte tutto spento (niente passata finale); con ?serie=1 i valori di serie (#59):
// ciclo, camera 22°, contorni. il pannello si apre dall'ingranaggio, camera / ciclo /
// stampa / contorni si accendono senza errori e dentro il budget (≤ 100 draw call), la scelta resta dopo il ricaricamento,
// nel ciclo si vede la notte. Screenshot: tutto acceso di giorno e di notte, telefono e desktop.
// MAX_DC: il budget di TECH §5 (provvisorio a 120 la mattina dell'8 ott 2026; tornato a 100 con le prestazioni a camera bassa, TECH §5b)
const MAX_DC = 100;
export const timeout = 360000; // su GitHub il gioco gira a 2-4 fps: con luci e stampa di notte la suite supera i 2 minuti
export default async function (ctx) {
  const p = await ctx.open('?test=1&net=0');
  await ctx.waitReady(p.page, 20000);
  await ctx.test('coi test: tutto spento, render diretto', async () => {
    const st = await ctx.getState(p.page);
    ctx.assert(st.impostazioni && st.impostazioni.cam === 0 && !st.impostazioni.ciclo && !st.impostazioni.stampa && !st.impostazioni.contorni, `impostazioni ${JSON.stringify(st.impostazioni)}`);
    ctx.assert(st.aspetto && st.aspetto.post === false, `passata finale accesa di serie: ${JSON.stringify(st.aspetto)}`);
  });
  await ctx.test('l’ingranaggio apre il pannello', async () => {
    await p.page.click('#mzSetBtn'); await p.page.waitForTimeout(200);
    const on = await p.page.evaluate(() => document.getElementById('mzSet')?.classList.contains('on'));
    ctx.assert(on, 'pannello chiuso');
    await ctx.shot(p.page, 'iphone_pannello');
    ctx.assert(!(await ctx.getState(p.page)).aspetto.caricato, 'la resa delle impostazioni è stata scaricata senza niente acceso');
    await p.page.click('#mzSet [data-cam="3"]'); await p.page.click('#mzSet [data-set="contorni"]'); await p.page.click('#mzSet [data-set="stampa"]');
    const st = (await ctx.getState(p.page)).impostazioni;
    ctx.assert(st.cam === 3 && st.contorni && st.stampa, `dopo i clic: ${JSON.stringify(st)}`);
    await p.page.keyboard.press('Escape');
  });
  await ctx.test('tutto acceso: niente errori, budget ok', async () => {
    await p.page.evaluate(() => window.__game.test.impostazioni({ cam: 3, ciclo: true, stampa: true, contorni: true }));
    await p.page.evaluate(() => window.__game.test.aspettoPronto());
    await p.page.evaluate(() => window.__game.test.ciclo(0.2)); await p.page.waitForTimeout(900);
    await ctx.shot(p.page, 'iphone_tutto_giorno');
    const perf = await ctx.getPerf(p.page); ctx.log('perf', JSON.stringify(perf));
    ctx.assert(perf.drawCalls > 0 && perf.drawCalls <= MAX_DC, `draw call ${perf.drawCalls}`);
    ctx.assert((await ctx.getState(p.page)).aspetto.post === true, 'passata finale spenta');
    ctx.noErrors(p, 'impostazioni');
  });
  await ctx.test('il ciclo arriva alla notte (scena più scura)', async () => {
    await p.page.evaluate(() => window.__game.test.impostazioni({ cam: 3, ciclo: true, stampa: false, contorni: true }));
    await p.page.evaluate(() => window.__game.test.ciclo(0.2)); await p.page.waitForTimeout(800);
    const giorno = await ctx.screenStats(p.page);
    await p.page.evaluate(() => window.__game.test.ciclo(0.78)); await p.page.waitForTimeout(800);
    const notte = await ctx.screenStats(p.page);
    await ctx.shot(p.page, 'iphone_notte');
    ctx.assert((await ctx.getState(p.page)).aspetto.momento === 'notte', 'non è notte');
    ctx.assert(notte.mean < giorno.mean - 20, `notte non più scura: giorno ${giorno.mean.toFixed(1)} notte ${notte.mean.toFixed(1)}`);
  });
  await ctx.test('di notte lanterne e insegne fanno luce (#60), di giorno no', async () => {
    await p.page.waitForTimeout(400);
    const n = (await ctx.getState(p.page)).aspetto.luci;
    ctx.assert(n > 0 && n <= 6, `luci accese di notte: ${n}`);
    const perf = await ctx.getPerf(p.page); ctx.log('perf notte', JSON.stringify(perf));
    ctx.assert(perf.drawCalls <= MAX_DC, `draw call ${perf.drawCalls}`);
    await p.page.evaluate(() => window.__game.test.ciclo(0.2));
    // le luci si aggiornano a ogni fotogramma: su GitHub (2-4 fps) ci vuole più di ½ s
    await ctx.waitState(p.page, (st) => st.aspetto.luci === 0, 10000).catch(() => {});
    ctx.assert((await ctx.getState(p.page)).aspetto.luci === 0, 'luci accese di giorno');
    await p.page.evaluate(() => window.__game.test.ciclo(0.6)); await p.page.waitForTimeout(600);
    await ctx.shot(p.page, 'iphone_tramonto_luci');
    await p.page.evaluate(() => window.__game.test.ciclo(0.78)); await p.page.waitForTimeout(600);
    ctx.noErrors(p, 'luci');
  });
  await ctx.test('stampa giapponese di notte (#61): palette notturna, niente errori', async () => {
    await p.page.evaluate(() => window.__game.test.impostazioni({ cam: 3, ciclo: true, stampa: true, contorni: true }));
    await p.page.evaluate(() => window.__game.test.ciclo(0.78)); await p.page.waitForTimeout(900);
    await ctx.shot(p.page, 'iphone_stampa_notte');
    const st = await ctx.screenStats(p.page); ctx.log('stampa notte', st.mean.toFixed(1));
    ctx.assert(st.mean > 25, `stampa di notte troppo buia: ${st.mean.toFixed(1)}`);
    await p.page.evaluate(() => window.__game.test.ciclo(0.93)); await p.page.waitForTimeout(900);
    await ctx.shot(p.page, 'iphone_stampa_alba');
    await p.page.evaluate(() => window.__game.test.impostazioni({ cam: 3, ciclo: true, stampa: false, contorni: true }));
    ctx.noErrors(p, 'stampa notte');
  });
  await ctx.test('la scelta resta dopo il ricaricamento; spegnere torna di serie', async () => {
    await p.page.reload(); await ctx.waitReady(p.page, 20000);
    await p.page.evaluate(() => window.__game.test.aspettoPronto());
    const st = await ctx.getState(p.page);
    ctx.assert(st.aspetto.post === true, 'dopo reload la passata finale non è tornata');
    ctx.assert(st.impostazioni.cam === 3 && st.impostazioni.ciclo && st.impostazioni.contorni, `dopo reload: ${JSON.stringify(st.impostazioni)}`);
    await p.page.evaluate(() => window.__game.test.impostazioni({ cam: 0, ciclo: false, stampa: false, contorni: false }));
    await p.page.waitForTimeout(300);
    ctx.assert((await ctx.getState(p.page)).aspetto.post === false, 'passata finale ancora accesa');
    ctx.noErrors(p, 'reload');
  });
  const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  await d.page.evaluate(async () => { window.__game.test.impostazioni({ cam: 4, ciclo: true, stampa: true, contorni: true }); await window.__game.test.aspettoPronto(); window.__game.test.ciclo(0.6); });
  await d.page.waitForTimeout(900);
  await ctx.shot(d.page, 'desktop_tramonto_stampa');
  await ctx.test('desktop: tutto acceso senza errori', async () => { ctx.noErrors(d, 'desktop'); });
  const s = await ctx.open('?test=1&net=0&serie=1');
  await ctx.waitReady(s.page, 20000);
  await ctx.test('di serie (#59): ciclo, camera 22° e contorni accesi, stampa spenta', async () => {
    await s.page.evaluate(() => window.__game.test.aspettoPronto());
    const st = await ctx.getState(s.page);
    ctx.assert(st.impostazioni.cam === 3 && st.impostazioni.ciclo && st.impostazioni.contorni && !st.impostazioni.stampa, `di serie: ${JSON.stringify(st.impostazioni)}`);
    ctx.assert(st.aspetto.caricato && st.aspetto.post === true, `resa non caricata di serie: ${JSON.stringify(st.aspetto)}`);
    await s.page.evaluate(() => window.__game.test.ciclo(0.2)); await s.page.waitForTimeout(800);
    await ctx.shot(s.page, 'iphone_serie_giorno');
    await s.page.evaluate(() => window.__game.test.ciclo(0.78)); await s.page.waitForTimeout(800);
    await ctx.shot(s.page, 'iphone_serie_notte');
    const perf = await ctx.getPerf(s.page); ctx.log('perf serie', JSON.stringify(perf));
    ctx.assert(perf.drawCalls > 0 && perf.drawCalls <= MAX_DC, `draw call ${perf.drawCalls}`);
    ctx.noErrors(s, 'di serie');
  });
}
