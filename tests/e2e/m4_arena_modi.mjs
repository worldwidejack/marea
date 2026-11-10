// Le quattro modalità dell'Arena (docs/ARENA.md) senza server (net=0), al telefono 390×844. Il pannello del colosseo ha le quattro modalità
// (con le grandezze di squadra di Sopravvivenza e Rapinatori) e la mappa di ciascuna; l'ALLENAMENTO di ognuna parte coi gladiatori su tutti i
// posti: Sopravvivenza a 10 (tabellone con IN PIEDI, nube che si stringe e il cartello NELLA NUBE), Caccia alle stelle 3v3 (le stelle sopra le
// teste, l'erba alta nasconde gli avversari e non i compagni), Controllo 3v3 (la zona sale per chi ci sta), Rapinatori 2v2 (le casseforti al
// 100%). Gladiatori dell'allenamento: casuali di default, la build gliela si può scegliere a mano; con una bomba in mano, mentre si mira, a
// terra c'è l'ombra di dove atterra. Screenshot in tests/out/shots/m4_arena_modi_*.png.
export const timeout = 300000;

export default async function (ctx) {
  const { assert } = ctx;
  const ar = (st) => st.arenaPartita ?? null;
  /** Dal portone al pannello del colosseo. */
  const pannello = async (page) => {
    await ctx.waitReady(page, 20000);
    await ctx.waitState(page, (st) => !!st.arena?.spot, 30000);
    assert(await page.evaluate(() => window.__game.test.arenaVai()), 'isola dell’Arena non trovata');
    await ctx.waitState(page, (st) => st.arena.near === true, 10000);
    await page.waitForSelector('#mzArenaEntra.on', { timeout: 10000 });
    await page.tap('#mzArenaEntra');
    await page.waitForSelector('#mzColosseo.on', { timeout: 40000 });
  };
  /** Sceglie modalità e grandezza e parte con ALLENAMENTO; aspetta il conto alla rovescia. */
  const allena = async (page, modo, f) => {
    await page.tap(`#mzColosseo .modi button[data-modo="${modo}"]`);
    if (f) await page.tap(`#mzColosseo .formati button[data-f="${f}"]`);
    await ctx.shot(page, `pannello_${modo}`);
    await page.tap('#mzColosseo [data-act=allenamento]');
    await ctx.waitState(page, (st) => st.arenaPartita?.phase === 'play' && st.arenaPartita.fase === 'conta', 60000);
  };
  /** Fuori dalla partita (dal menu, come una resa) e di nuovo nel pannello. */
  const esci = async (page) => {
    await page.evaluate(() => window.__game.test.arenaAuto(false));
    await page.tap('#mzArenaMenuBtn');
    await page.tap('#mzArenaMenu [data-act=resa]');
    await page.tap('#mzArenaResa [data-act=si]');
    await ctx.waitState(page, (st) => !!st.arenaPartita?.finale || st.colosseo?.aperto === true, 20000);
    if ((await ctx.getState(page)).arenaPartita?.finale) await page.tap('#mzArenaFine [data-act=esci]');
    await ctx.waitState(page, (st) => st.colosseo?.aperto === true && !st.arenaPartita, 15000);
  };

  const p = await ctx.open('?test=1&net=0');
  const page = p.page;
  await ctx.test('telefono: il pannello ha le quattro modalità, le grandezze di squadra e la mappa di ciascuna', async () => {
    await pannello(page);
    const modi = await page.locator('#mzColosseo .modi button[data-modo]').evaluateAll((bs) => bs.map((b) => b.dataset.modo));
    assert(modi.join() === 'sopravvivenza,stelle,controllo,rapina', 'modalità: ' + modi);
    const per = () => page.locator('#mzColosseo .formati button[data-f]').evaluateAll((bs) => bs.map((b) => b.dataset.f).join());
    await page.tap('#mzColosseo .modi button[data-modo=sopravvivenza]');
    assert((await per()) === '1,2', 'Sopravvivenza da solo o in coppia: ' + (await per()));
    assert((await page.textContent('#mzColosseo')).includes('NAUFRAGIO'), 'la mappa della Sopravvivenza');
    await page.tap('#mzColosseo .modi button[data-modo=rapina]');
    assert((await per()) === '2,3', 'Rapinatori 2 o 3 contro 3: ' + (await per()));
    await page.tap('#mzColosseo .modi button[data-modo=controllo]');
    assert((await per()) === '', 'il Controllo è solo 3 contro 3');
    assert(await page.isDisabled('#mzColosseo [data-act=coda]'), 'senza link la coda veloce non dev’essere attiva');
    await ctx.shot(page, 'pannello');
  });

  await ctx.test('telefono: Sopravvivenza a 10, io e nove gladiatori; IN PIEDI; la nube si stringe e il cartello avvisa', async () => {
    await allena(page, 'sopravvivenza', 1);
    const s0 = ar(await ctx.getState(page));
    assert(s0.modo === 'sopravvivenza' && s0.mappa === 'naufragio' && s0.vita.length === 10 && s0.squadre.join() === '0,1,2,3,4,5,6,7,8,9', 'stato: ' + JSON.stringify(s0));
    assert((await page.textContent('#mzArenaTop')).includes('IN PIEDI'), 'il tabellone dice quanti sono in piedi');
    await ctx.waitState(page, (st) => st.arenaPartita?.fase === 'gioca', 15000);
    const r0 = ar(await ctx.getState(page)).nube.r;
    assert(await page.evaluate(() => window.__game.test.arenaTempo(100)), 'avanti nel tempo');
    await page.evaluate(() => window.__game.test.arenaPosa(0, 4, 13));
    await ctx.waitState(page, (st, r0) => st.arenaPartita?.nube?.r < r0 - 10, 5000, r0);
    await page.waitForSelector('#mzArenaBadge.on', { timeout: 5000 });
    assert((await page.textContent('#mzArenaBadge')).includes('NUBE'), 'cartello: ' + (await page.textContent('#mzArenaBadge')));
    await ctx.shot(page, 'sopravvivenza_nube');
    await esci(page);
  });

  await ctx.test('telefono: Caccia alle stelle 3v3: le stelle sopra le teste; l’erba alta nasconde gli avversari, non i compagni', async () => {
    await allena(page, 'stelle');
    const s0 = ar(await ctx.getState(page));
    assert(s0.squadre.join() === '0,0,0,1,1,1' && s0.mappa === 'osservatorio' && s0.segno === 2, 'stato: ' + JSON.stringify(s0));
    assert((await page.locator('#mzArenaTop .mz-ar-lato.io .eroe').count()) === 3 && (await page.locator('#mzArenaTop .mz-ar-lato.lui .eroe').count()) === 3, 'tre eroi per lato');
    // nel conto alla rovescia nessuno si muove: si posano gli eroi e si legge la vista (il prato in alto a sinistra è erba alta)
    const r = await page.evaluate(async () => {
      const T = window.__game.test, S = () => window.__game.state().arenaPartita, frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const out = {};
      T.arenaPosa(3, 8, 3); await frame(); out.avversario = S();   // avversario 3 nel prato, io alla partenza
      T.arenaPosa(1, 7, 2); await frame(); out.compagno = S();     // il mio compagno nel prato: si vede lo stesso
      return out;
    });
    assert(r.avversario.nascosti.includes(3) && r.avversario.visibili[3] === false, 'avversario nell’erba: ' + JSON.stringify(r.avversario.nascosti));
    assert(!r.compagno.nascosti.includes(1) && r.compagno.visibili[1] === true, 'il compagno nell’erba si vede');
    await page.waitForSelector('.mz-ar-segno', { state: 'visible', timeout: 5000 });
    await ctx.shot(page, 'stelle');
    await esci(page);
  });

  await ctx.test('telefono: Controllo 3v3: chi sta nella zona la fa salire; Rapinatori 2v2: due casseforti al 100%', async () => {
    await allena(page, 'controllo');
    await ctx.waitState(page, (st) => st.arenaPartita?.fase === 'gioca', 15000);
    await page.evaluate(() => window.__game.test.arenaPosa(0, 14, 4));
    await ctx.waitState(page, (st) => (st.arenaPartita?.zone?.[0]?.prog[0] ?? 0) > 2, 10000);
    await page.waitForSelector('.mz-ar-zona', { state: 'visible', timeout: 5000 });
    await ctx.shot(page, 'controllo');
    await esci(page);
    await allena(page, 'rapina', 2);
    const s = ar(await ctx.getState(page));
    assert(s.casseforti.length === 2 && s.punti.join() === '100,100' && s.vita.length === 4, 'casseforti: ' + JSON.stringify(s.casseforti));
    assert((await page.textContent('#mzArenaTop')).includes('100%'), 'il tabellone mostra la cassaforte');
    await ctx.shot(page, 'rapina');
    await esci(page);
  });

  const w = await ctx.open('?test=1&net=0');
  const pw = w.page;
  await ctx.test('telefono: gladiatori dell’allenamento casuali di default, a mano gli si sceglie la build; bomba in mano: ombra di mira', async () => {
    await pannello(pw);
    await pw.tap('#mzColosseo .modi button[data-modo=rapina]');
    await pw.tap('#mzColosseo .formati button[data-f="2"]');
    const nomi = () => pw.locator('#mzColosseo [data-bot]').evaluateAll((bs) => bs.map((b) => b.textContent));
    const n0 = await nomi();
    assert(n0.length === 3 && n0.every((x) => x.includes('casuale')), 'tre gladiatori, tutti casuali: ' + n0);
    assert(n0[0].includes('compagno') && n0[1].includes('avversario') && n0[2].includes('avversario'), 'compagno e avversari: ' + n0);
    await pw.tap('#mzColosseo [data-bot="2"]');
    const colo = async () => (await ctx.getState(pw)).colosseo;
    assert((await colo()).bot === 2 && (await colo()).bots[2], 'il gladiatore 2 è aperto, con una build di partenza');
    const mia = JSON.stringify((await colo()).builds);
    await pw.tap('#mzColosseo .cella[data-ulti]');
    await pw.tap('#mzColosseo .lista.on button[data-id=velo]');
    await ctx.shot(pw, 'gladiatore_build');
    assert((await colo()).bots[2].ulti === 'velo', 'l’ulti è andata al gladiatore: ' + JSON.stringify((await colo()).bots[2]));
    assert(JSON.stringify((await colo()).builds) === mia, 'le mie build non sono cambiate');
    await pw.tap('#mzColosseo [data-act=casuale]');
    assert((await colo()).bot === null && (await colo()).bots[2] === null, 'BUILD CASUALE rimette il caso');
    // la mia bomba in mano
    await pw.evaluate(() => window.__game.test.arenaSet({ dote: 'magia', slot: [{ magia: 'bomba_fuoco' }, null], ulti: 'furia' }));
    await pw.tap('#mzColosseo [data-act=allenamento]');
    await ctx.waitState(pw, (st) => st.arenaPartita?.fase === 'gioca', 60000);
    assert((await ctx.getState(pw)).arenaPartita.ombra === null, 'senza mirare niente ombra');
    await pw.keyboard.down('Space');
    await ctx.waitState(pw, (st) => !!st.arenaPartita?.ombra, 10000);
    const o = (await ctx.getState(pw)).arenaPartita.ombra;
    assert(o.r > 1.5 && o.r < 3.5, 'l’ombra ha il raggio dello scoppio: ' + JSON.stringify(o));
    await ctx.shot(pw, 'ombra_bomba');
    await pw.keyboard.up('Space');
    await ctx.waitState(pw, (st) => st.arenaPartita?.ombra === null, 10000);
  });

  await ctx.test('nessun errore in pagina', async () => {
    for (const x of [p, w]) assert(!x.errors.length, 'errori: ' + x.errors.slice(0, 3).join('\n'));
  });
}
