// Meteo (#85): coi test parte spento ('spento' in state().meteo); acceso segue l'orologio (uno dei 5 stati) e dai test si forza.
// Pioggia: gocce disegnate, scena più scura, dentro il budget (≤ 100 draw call) anche di notte; nebbia: passata finale accesa anche
// con la camera di sempre (45°, senza contorni); spegnere torna a 'spento' senza gocce. Screenshot telefono e PC.
export const timeout = 360000; // su GitHub il gioco gira a 2-4 fps
const STATI = ['sereno', 'nuvoloso', 'pioggia', 'nebbia', 'vento'];
export default async function (ctx) {
  const p = await ctx.open('?test=1&net=0');
  await ctx.waitReady(p.page, 20000);
  const forza = async (page, stato, k = 1) => {
    await page.evaluate(([s, kk]) => window.__game.test.meteo(s, kk), [stato, k]);
    await ctx.waitState(page, (st, a) => st.meteo === a[0] && Math.abs(st.aspetto.meteoK - a[1]) < 1e-6, 60000, [stato, k]);
    await page.waitForTimeout(500); // un paio di frame col tempo nuovo (lo stato si aggiorna prima del disegno)
  };
  await ctx.test('coi test parte spento', async () => {
    const st = await ctx.getState(p.page);
    ctx.assert(st.meteo === 'spento' && st.impostazioni.meteo === false, `meteo ${JSON.stringify(st.meteo)} impostazioni ${JSON.stringify(st.impostazioni)}`);
  });
  await ctx.test('dal pannello si accende; segue l’orologio', async () => {
    await p.page.click('#mzSetBtn');
    await p.page.click('#mzSet [data-set="meteo"]');
    await ctx.shot(p.page, 'iphone_pannello');
    await p.page.keyboard.press('Escape');
    await p.page.evaluate(() => window.__game.test.aspettoPronto());
    await ctx.waitState(p.page, (st, s) => s.includes(st.meteo), 20000, STATI);
    ctx.assert((await ctx.getState(p.page)).impostazioni.meteo === true, 'impostazione non salvata');
  });
  await ctx.test('pioggia di giorno: gocce, più scuro, budget ok', async () => {
    await p.page.evaluate(async () => { window.__game.test.impostazioni({ cam: 3, ciclo: true, contorni: true }); await window.__game.test.aspettoPronto(); window.__game.test.ciclo(0.2); window.__game.test.goto('lotto:0'); });
    await forza(p.page, 'sereno', 0);
    await ctx.waitState(p.page, (st) => st.meteo === 'sereno', 20000);
    await p.page.waitForTimeout(500);
    const sereno = await ctx.screenStats(p.page);
    await ctx.shot(p.page, 'iphone_sereno');
    const base = await ctx.getPerf(p.page); ctx.log('perf sereno', JSON.stringify(base));
    await forza(p.page, 'pioggia');
    const st = await ctx.getState(p.page);
    ctx.assert(st.aspetto.gocce > 500, `gocce ${st.aspetto.gocce}`);
    const pioggia = await ctx.screenStats(p.page);
    await ctx.shot(p.page, 'iphone_pioggia');
    ctx.log('luminosità sereno', sereno.mean.toFixed(1), 'pioggia', pioggia.mean.toFixed(1));
    ctx.assert(pioggia.mean < sereno.mean - 8, `pioggia non più scura: ${sereno.mean.toFixed(1)} → ${pioggia.mean.toFixed(1)}`);
    const perf = await ctx.getPerf(p.page); ctx.log('perf pioggia', JSON.stringify(perf));
    ctx.assert(perf.drawCalls > 0 && perf.drawCalls <= 100 && perf.drawCalls <= base.drawCalls + 1, `draw call ${perf.drawCalls} (sereno ${base.drawCalls})`);
    ctx.noErrors(p, 'pioggia');
  });
  await ctx.test('pioggia a metà (gradino) e di notte', async () => {
    await forza(p.page, 'pioggia', 0.4);
    const g = (await ctx.getState(p.page)).aspetto.gocce;
    ctx.assert(g > 0 && g < 1000, `gocce a metà ${g}`);
    await forza(p.page, 'pioggia', 1);
    await p.page.evaluate(() => window.__game.test.ciclo(0.78));
    await ctx.waitState(p.page, (st) => st.aspetto.momento === 'notte', 20000);
    await p.page.waitForTimeout(500);
    await ctx.shot(p.page, 'iphone_pioggia_notte');
    const perf = await ctx.getPerf(p.page); ctx.log('perf pioggia notte', JSON.stringify(perf));
    ctx.assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls}`);
    ctx.noErrors(p, 'pioggia notte');
  });
  await ctx.test('nebbia, nuvoloso, vento: niente errori', async () => {
    await p.page.evaluate(() => window.__game.test.ciclo(0.2));
    await ctx.waitState(p.page, (st) => st.aspetto.momento === 'giorno', 20000);
    await forza(p.page, 'nebbia');
    await ctx.shot(p.page, 'iphone_nebbia');
    ctx.assert((await ctx.getState(p.page)).aspetto.gocce === 0, 'gocce con la nebbia');
    await forza(p.page, 'nuvoloso');
    await ctx.shot(p.page, 'iphone_nuvoloso');
    await forza(p.page, 'vento');
    await ctx.shot(p.page, 'iphone_vento');
    ctx.noErrors(p, 'stati');
  });
  await ctx.test('nebbia con la camera di sempre (45°, senza contorni): passata finale accesa, poi spenta col sereno', async () => {
    await p.page.evaluate(() => window.__game.test.impostazioni({ cam: 0, ciclo: false, contorni: false }));
    await forza(p.page, 'nebbia');
    await ctx.waitState(p.page, (st) => st.aspetto.post === true, 20000);
    await ctx.shot(p.page, 'iphone_nebbia_45');
    await forza(p.page, 'sereno', 0);
    await ctx.waitState(p.page, (st) => st.meteo === 'sereno' && st.aspetto.post === false, 20000);
    ctx.noErrors(p, 'nebbia 45');
  });
  await ctx.test('spento: stato «spento», niente gocce, resa di sempre', async () => {
    await forza(p.page, 'pioggia');
    await p.page.evaluate(() => window.__game.test.impostazioni({ meteo: false }));
    await ctx.waitState(p.page, (st) => st.meteo === 'spento' && st.aspetto.gocce === 0 && st.aspetto.post === false, 20000);
    await p.page.evaluate(() => window.__game.test.meteo(null));
    ctx.noErrors(p, 'spento');
  });
  await p.close(); // una pagina alla volta: col telefono ancora aperto il PC rallenta troppo
  const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  await d.page.evaluate(async () => { window.__game.test.impostazioni({ cam: 3, ciclo: true, contorni: true, meteo: true }); await window.__game.test.aspettoPronto(); window.__game.test.ciclo(0.2); window.__game.test.goto('lotto:0'); });
  await ctx.test('desktop: pioggia e nebbia senza errori', async () => {
    await forza(d.page, 'sereno', 0);
    ctx.log('perf desktop sereno', JSON.stringify(await ctx.getPerf(d.page)));
    await forza(d.page, 'pioggia');
    await ctx.shot(d.page, 'desktop_pioggia');
    await forza(d.page, 'nebbia');
    await ctx.shot(d.page, 'desktop_nebbia');
    const perf = await ctx.getPerf(d.page); ctx.log('perf desktop', JSON.stringify(perf));
    ctx.assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls}`);
    ctx.noErrors(d, 'desktop');
  });
}
