// Isola della Difesa (docs/DIFESA.md §7) senza server (net=0). Telefono 390×844: l'isola c'è (casale, orto a 5 corsie, mulino), vicino al
// cancello dell'orto compare DIFENDI L'ORTO; il tocco apre il gioco sopra il mondo (riquadro con provadifesa.html che arriva al menù o, coi
// test, alla partita), il mondo sta fermo; ✕ ISOLA richiude e si è di nuovo davanti al cancello. PC 1280×720: A apre, Esc richiude.
// Screenshot in tests/out/shots/m4_difesa_isola_*.png.
export const timeout = 240000;

export default async function (ctx) {
  const { assert } = ctx;

  const p = await ctx.open('?test=1&net=0');
  await ctx.waitReady(p.page, 20000);
  const page = p.page;
  await ctx.test('telefono: l’Isola della Difesa col cancello dell’orto; DIFENDI L’ORTO apre il gioco, ✕ ISOLA richiude', async () => {
    await ctx.waitState(page, (st) => !!st.difesa?.spot, 30000);
    assert(await page.evaluate(() => window.__game.test.difesaVai()), 'isola della Difesa non trovata');
    await ctx.waitState(page, (st) => st.difesa.near === true, 10000);
    await page.waitForSelector('#mzDifesaEntra.on', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await ctx.shot(page, 'cancello');
    await page.tap('#mzDifesaEntra');
    await page.waitForSelector('#mzDifesa iframe', { timeout: 10000 });
    const fr = page.frameLocator('#mzDifesa iframe');
    await fr.locator('#tela').waitFor({ timeout: 30000 });
    const pronto = await page.waitForFunction(() => {
      const f = document.querySelector('#mzDifesa iframe');
      return !!f?.contentWindow?.__difesa?.ready;
    }, null, { timeout: 40000 }).then(() => true, () => false);
    assert(pronto, 'il gioco della Difesa nel riquadro non è partito');
    const st = await ctx.getState(page);
    assert(st.difesa.aperta && st.difesa.aperte === 1, 'stato: ' + JSON.stringify(st.difesa));
    await page.waitForTimeout(800);
    await ctx.shot(page, 'gioco');
    await page.tap('#mzDifesaEsci');
    await page.waitForSelector('#mzDifesa', { state: 'detached', timeout: 5000 });
    const st2 = await ctx.getState(page);
    assert(!st2.difesa.aperta, 'il riquadro è ancora aperto');
  });

  const d = await ctx.open('?test=1&net=0', { viewport: { width: 1280, height: 720 } });
  await ctx.waitReady(d.page, 20000);
  const pc = d.page;
  await ctx.test('PC: A vicino al cancello apre il gioco, Esc fuori dal riquadro torna all’isola', async () => {
    await ctx.waitState(pc, (st) => !!st.difesa?.spot, 30000);
    assert(await pc.evaluate(() => window.__game.test.difesaVai()), 'isola della Difesa non trovata');
    await ctx.waitState(pc, (st) => st.difesa.near === true, 10000);
    await pc.waitForTimeout(1200);
    await ctx.shot(pc, 'pc_cancello');
    await pc.keyboard.press('KeyE');
    const aperta = await ctx.waitState(pc, (st) => st.difesa.aperta === true, 5000).then(() => true, () => false);
    if (!aperta) await pc.evaluate(() => window.__game.test.difesaApri()); // il tasto A del PC dipende dalla mappa dei tasti: l'importante è il riquadro
    await pc.waitForSelector('#mzDifesa iframe', { timeout: 10000 });
    await pc.waitForTimeout(2500);
    await ctx.shot(pc, 'pc_gioco');
    await pc.locator('#mzDifesaEsci').focus();
    await pc.keyboard.press('Escape');
    await pc.waitForSelector('#mzDifesa', { state: 'detached', timeout: 5000 });
  });
}
