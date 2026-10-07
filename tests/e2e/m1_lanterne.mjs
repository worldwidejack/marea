// Lanterne sul molo del Porto (senza link: partita di prova). Tra le 6 lanterne del molo compare GIOCA · LANTERNE, si apre la schermata,
// le lanterne si accendono in sequenza; toccando quelle giuste la sequenza cresce, una sbagliata chiude con la scheda dell'esito.
// Poi l'autopilota gioca una partita intera. Al telefono (390×844) le 6 lanterne stanno nello schermo e sono grandi da toccare.
export const timeout = 120000;
export default async function (ctx) {
  const { assert } = ctx;
  for (const [nome, viewport] of [['pc', ctx.B.DESKTOP], ['telefono', ctx.B.IPHONE]]) {
    const p = await ctx.open('?test=1&net=0', { viewport });
    const page = p.page;
    await ctx.waitReady(page, 20000);
    const st = () => ctx.getState(page);
    /** Aspetta (da qui, non nella pagina: così si possono usare variabili del test) che lo stato soddisfi `pred`. */
    const until = async (pred, ms, what) => { const t0 = Date.now(); for (;;) { const q = await st(); if (pred(q)) return q; if (Date.now() - t0 > ms) throw new Error(`${what}: ${JSON.stringify(q.lanterne)}`); await page.waitForTimeout(60); } };

    await ctx.test(`${nome}: sul molo del Porto compare GIOCA · LANTERNE`, async () => {
      const s = await st();
      const spot = s.minigiochi.spots.find((x) => x.id === 'lanterne');
      assert(spot, 'spot lanterne assente: ' + JSON.stringify(s.minigiochi.spots.map((x) => x.id)));
      // accanto alla barca ormeggiata e allo spawn del Porto A deve restare «sali in barca», non far partire le Lanterne (wp2_move)
      for (const k of ['dock', 'spawn']) {
        await page.evaluate((k) => { const d = window.__game.state().island[k]; window.__game.test.teleport(d.x, d.z); }, k);
        await page.waitForTimeout(250);
        assert((await st()).minigiochi.near !== 'lanterne', `al punto ${k} del Porto si è vicini alle Lanterne`);
      }
      await page.evaluate(({ x, z }) => window.__game.test.teleport(x, z), spot);
      await ctx.waitState(page, (q) => q.minigiochi.near === 'lanterne', 5000);
      await page.waitForSelector('#mzPlay.on', { timeout: 3000 });
      assert(/LANTERNE/.test(await page.$eval('#mzPlay', (e) => e.textContent)), 'bottone senza LANTERNE');
    });
    await ctx.shot(page, `${nome}_molo`);

    await ctx.test(`${nome}: GIOCA apre la schermata con 6 lanterne, che si accendono in sequenza`, async () => {
      await page.click('#mzPlay');
      await page.waitForSelector('#mzLanterne.on', { timeout: 3000 });
      assert((await page.$$('#mzLanterne [data-lt]')).length === 6, 'non 6 lanterne');
      await ctx.waitState(page, (q) => q.lanterne?.view?.litKind === 'mostra', 6000);
    });
    await ctx.shot(page, `${nome}_accesa`);

    if (nome === 'telefono') {
      await ctx.test('telefono: le lanterne stanno nello schermo e sono ≥ 44 px', async () => {
        const boxes = await page.$$eval('#mzLanterne [data-lt]', (es) => es.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }));
        for (const [x, y, w, h] of boxes) assert(w >= 44 && h >= 44 && x >= 0 && y >= 0 && x + w <= 390 && y + h <= 844, 'lanterna fuori o piccola: ' + JSON.stringify(boxes));
      });
    }

    await ctx.test(`${nome}: toccando quelle giuste la sequenza cresce (3 → 4)`, async () => {
      for (let k = 0; k < 3; k++) {
        const i = (await until((q) => q.lanterne?.atteso != null && q.lanterne.view.pos === k, 8000, `tocco ${k + 1}`)).lanterne.atteso;
        if (nome === 'pc') await page.keyboard.press(String(i + 1)); else await page.tap(`#mzLanterne [data-lt="${i}"]`);
      }
      await ctx.waitState(page, (q) => q.lanterne.view.completate === 1 && q.lanterne.view.len === 4, 3000);
    });

    await ctx.test(`${nome}: una sbagliata chiude e compare l'esito (partita di prova)`, async () => {
      const i = (await until((q) => q.lanterne?.atteso != null, 10000, 'sequenza 2')).lanterne.atteso;
      await page.click(`#mzLanterne [data-lt="${(i + 1) % 6}"]`);
      await ctx.waitState(page, (q) => q.lanterne.view.done && q.lanterne.view.wrong >= 0, 3000);
      await page.waitForTimeout(250);
      await ctx.shot(page, `${nome}_sbagliata`);
      await page.waitForSelector('#mzEsito.on', { timeout: 5000 });
      assert(!(await page.$('#mzLanterne.on')), 'la schermata resta aperta');
      assert(/prova/i.test(await page.$eval('#mzEsito', (e) => e.textContent)), 'esito senza «partita di prova»');
      await page.click('#mzEsito [data-act="ok"]');
    });

    if (nome === 'pc') {
      await ctx.test('pc: l\'autopilota gioca una partita intera; Esc a metà partita ritira', async () => {
        await page.evaluate(() => window.__game.test.lanterneAuto(true));
        await page.click('#mzPlay');
        await page.waitForSelector('#mzEsito.on', { timeout: 20000 });
        await page.evaluate(() => window.__game.test.lanterneAuto(false));
        await page.click('#mzEsito [data-act="ok"]');
        await page.click('#mzPlay');
        await page.waitForSelector('#mzLanterne.on', { timeout: 3000 });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        assert(!(await page.$('#mzLanterne.on')), 'Esc non chiude');
        assert(!(await page.$('#mzEsito.on')), 'esito dopo il ritiro');
      });
    }
    ctx.noErrors(p, `lanterne ${nome}`);
  }
}
