// Meteo a nuvole (#361): coi test parte spento ('spento' in state().meteo); acceso le nuvole vengono dall'orologio (sim/meteo.ts) e il
// tempo dove sei è quello della nuvola che hai sopra. Dai test: meteo(tipo, k) = una nuvola sopra di te, nuvole([...]) = nuvole ferme
// attorno, lampo(true) = un lampo fisso. Pioggia sopra: gocce, scena più scura; nuvola di pioggia vicina: piove là (tenda) e non qui;
// temporale col lampo; notte; dentro il budget (≤ 100 draw call). Spegnere torna a 'spento' senza nuvole né gocce. Telefono e PC.
export const timeout = 360000; // su GitHub il gioco gira a 2-4 fps
const STATI = ['sereno', 'bianca', 'grigia', 'pioggia', 'temporale'];
const VICINA = [{ tipo: 'pioggia', dx: -34, dz: -30, r: 26 }, { tipo: 'bianca', dx: 25, dz: -70, r: 26 }];
export default async function (ctx) {
  const p = await ctx.open('?test=1&net=0');
  await ctx.waitReady(p.page, 20000);
  const forza = async (page, stato, k = 1) => {
    await page.evaluate(([s, kk]) => { window.__game.test.nuvole(null); window.__game.test.meteo(s, kk); }, [stato, k]);
    await ctx.waitState(page, (st, a) => st.meteo === a[0] && Math.abs(st.aspetto.meteoK - a[1]) < 1e-6, 60000, [stato, k]);
    await page.waitForTimeout(500); // un paio di frame col tempo nuovo (lo stato si aggiorna prima del disegno)
  };
  await ctx.test('coi test parte spento', async () => {
    const st = await ctx.getState(p.page);
    ctx.assert(st.meteo === 'spento' && st.impostazioni.meteo === false, `meteo ${JSON.stringify(st.meteo)} impostazioni ${JSON.stringify(st.impostazioni)}`);
  });
  await ctx.test('dal pannello si accende; nuvole dall’orologio', async () => {
    await p.page.click('#mzSetBtn');
    await p.page.click('#mzSet [data-set="meteo"]');
    await ctx.shot(p.page, 'iphone_pannello');
    await p.page.keyboard.press('Escape');
    await p.page.evaluate(() => window.__game.test.aspettoPronto());
    await ctx.waitState(p.page, (st, s) => s.includes(st.meteo) && st.nuvole && st.nuvole.vive > 0, 20000, STATI);
    const st = await ctx.getState(p.page);
    ctx.assert(st.impostazioni.meteo === true, 'impostazione non salvata');
    ctx.log('nuvole dall’orologio', JSON.stringify(st.nuvole));
    ctx.assert(st.nuvole.vicine <= 24, `nuvole ${JSON.stringify(st.nuvole)}`);
  });
  let base = null;
  await ctx.test('pioggia sopra di te: gocce, più scuro, budget ok', async () => {
    await p.page.evaluate(async () => { window.__game.test.impostazioni({ cam: 3, ciclo: true, contorni: true }); await window.__game.test.aspettoPronto(); window.__game.test.ciclo(0.2); window.__game.test.goto('porto'); }); // all'aperto: lotto:N arriva nella stanza della casa (#240), al buio
    await forza(p.page, 'sereno', 0);
    await p.page.waitForTimeout(500);
    const sereno = await ctx.screenStats(p.page);
    await ctx.shot(p.page, 'iphone_sereno');
    base = await ctx.getPerf(p.page); ctx.log('perf sereno (nessuna nuvola)', JSON.stringify(base));
    await forza(p.page, 'pioggia');
    const st = await ctx.getState(p.page);
    ctx.assert(st.aspetto.gocce > 500 && st.nuvole.pioggia === 1, `gocce ${st.aspetto.gocce} nuvole ${JSON.stringify(st.nuvole)}`);
    const pioggia = await ctx.screenStats(p.page);
    await ctx.shot(p.page, 'iphone_pioggia');
    ctx.log('luminosità sereno', sereno.mean.toFixed(1), 'pioggia', pioggia.mean.toFixed(1));
    ctx.assert(pioggia.mean < sereno.mean - 8, `pioggia non più scura: ${sereno.mean.toFixed(1)} → ${pioggia.mean.toFixed(1)}`);
    const perf = await ctx.getPerf(p.page); ctx.log('perf pioggia', JSON.stringify(perf));
    ctx.assert(perf.drawCalls > 0 && perf.drawCalls <= 100 && perf.drawCalls <= base.drawCalls + 3, `draw call ${perf.drawCalls} (sereno ${base.drawCalls})`);
    ctx.noErrors(p, 'pioggia');
  });
  await ctx.test('nuvola di pioggia vicina: piove là e non qui', async () => {
    await p.page.evaluate((v) => { window.__game.test.meteo(null); window.__game.test.nuvole(v); }, VICINA);
    await ctx.waitState(p.page, (st) => st.meteo === 'sereno' && st.nuvole.vive === 2 && st.nuvole.tende === 1 && st.nuvole.batuffoli > 0, 20000);
    await p.page.waitForTimeout(500);
    const st = await ctx.getState(p.page);
    ctx.assert(st.aspetto.gocce === 0 && st.nuvole.pioggia === 0, `qui piove: ${JSON.stringify(st.nuvole)} gocce ${st.aspetto.gocce}`);
    await ctx.shot(p.page, 'iphone_vicina');
    const perf = await ctx.getPerf(p.page); ctx.log('perf nuvole vicine', JSON.stringify(perf), JSON.stringify(st.nuvole));
    ctx.assert(perf.drawCalls <= 100 && perf.drawCalls <= base.drawCalls + 3, `draw call ${perf.drawCalls} (sereno ${base.drawCalls})`);
    // dentro la stessa nuvola: ora piove anche qui
    await p.page.evaluate(() => window.__game.test.nuvole([{ tipo: 'pioggia', dx: 0, dz: 0, r: 40 }]));
    await ctx.waitState(p.page, (st) => st.meteo === 'pioggia' && st.nuvole.pioggia === 1 && st.aspetto.gocce > 500, 20000);
    ctx.noErrors(p, 'vicina');
  });
  await ctx.test('pioggia a metà (gradino), temporale col lampo, di notte', async () => {
    await forza(p.page, 'pioggia', 0.4);
    const g = (await ctx.getState(p.page)).aspetto.gocce;
    ctx.assert(g > 0 && g < 1000, `gocce a metà ${g}`);
    await forza(p.page, 'temporale');
    await p.page.evaluate(() => window.__game.test.lampo(true));
    await ctx.waitState(p.page, (st) => st.nuvole.lampo === true && st.nuvole.lampi === 1, 20000);
    await ctx.shot(p.page, 'iphone_temporale');
    const perfT = await ctx.getPerf(p.page); ctx.log('perf temporale col lampo', JSON.stringify(perfT));
    ctx.assert(perfT.drawCalls <= 100, `draw call ${perfT.drawCalls}`);
    await p.page.evaluate(() => window.__game.test.lampo(false));
    await p.page.evaluate((v) => { window.__game.test.meteo(null); window.__game.test.nuvole(v); window.__game.test.ciclo(0.78); }, VICINA);
    await ctx.waitState(p.page, (st) => st.aspetto.momento === 'notte', 20000);
    await p.page.waitForTimeout(500);
    await ctx.shot(p.page, 'iphone_notte');
    const perf = await ctx.getPerf(p.page); ctx.log('perf notte', JSON.stringify(perf));
    ctx.assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls}`);
    ctx.noErrors(p, 'temporale notte');
  });
  await ctx.test('bianca e grigia: niente gocce; camera di sempre (45°): passata finale per le ombre, mai foschia', async () => {
    await p.page.evaluate(() => window.__game.test.ciclo(0.2));
    await ctx.waitState(p.page, (st) => st.aspetto.momento === 'giorno', 20000);
    await forza(p.page, 'bianca');
    ctx.assert((await ctx.getState(p.page)).aspetto.gocce === 0, 'gocce con la nuvola bianca');
    await forza(p.page, 'grigia');
    ctx.assert((await ctx.getState(p.page)).aspetto.gocce === 0, 'gocce con la nuvola grigia');
    await ctx.shot(p.page, 'iphone_grigia');
    await p.page.evaluate(() => window.__game.test.impostazioni({ cam: 0, ciclo: false, contorni: false }));
    await ctx.waitState(p.page, (st) => st.aspetto.post === true, 20000);
    await ctx.shot(p.page, 'iphone_grigia_45');
    ctx.noErrors(p, 'bianca grigia 45');
  });
  await ctx.test('spento: stato «spento», niente nuvole né gocce, resa di sempre', async () => {
    await forza(p.page, 'pioggia');
    await p.page.evaluate(() => window.__game.test.impostazioni({ meteo: false }));
    await ctx.waitState(p.page, (st) => st.meteo === 'spento' && st.aspetto.gocce === 0 && st.aspetto.post === false && st.nuvole.vive === 0 && st.nuvole.batuffoli === 0, 20000);
    await p.page.evaluate(() => window.__game.test.meteo(null));
    ctx.noErrors(p, 'spento');
  });
  await p.close(); // una pagina alla volta: col telefono ancora aperto il PC rallenta troppo
  const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  await d.page.evaluate(async () => { window.__game.test.impostazioni({ cam: 3, ciclo: true, contorni: true, meteo: true }); await window.__game.test.aspettoPronto(); window.__game.test.ciclo(0.2); window.__game.test.goto('porto'); }); // all'aperto: lotto:N arriva nella stanza della casa (#240), al buio
  await ctx.test('desktop: nuvola vicina, pioggia e temporale senza errori', async () => {
    // la gente del Porto arriva un modello alla volta (game/gente_lod.ts inFila): si misura quando c'è tutta, sennò le draw call crescono tra le due misure
    await ctx.waitState(d.page, (st) => !st.porto || st.porto.gente.every((g) => g.pronto), 30000);
    await forza(d.page, 'sereno', 0);
    const b = await ctx.getPerf(d.page); ctx.log('perf desktop sereno', JSON.stringify(b));
    await d.page.evaluate((v) => { window.__game.test.meteo(null); window.__game.test.nuvole(v); }, VICINA);
    await ctx.waitState(d.page, (st) => st.meteo === 'sereno' && st.nuvole.batuffoli > 0, 20000);
    await d.page.waitForTimeout(500);
    await ctx.shot(d.page, 'desktop_vicina');
    await forza(d.page, 'pioggia');
    await ctx.shot(d.page, 'desktop_pioggia');
    await forza(d.page, 'temporale');
    await ctx.shot(d.page, 'desktop_temporale');
    const perf = await ctx.getPerf(d.page); ctx.log('perf desktop temporale', JSON.stringify(perf));
    ctx.assert(perf.drawCalls <= 100 && perf.drawCalls <= b.drawCalls + 3, `draw call ${perf.drawCalls} (sereno ${b.drawCalls})`);
    ctx.noErrors(d, 'desktop');
  });
}
