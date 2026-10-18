// Arena PvP (docs/ARENA.md) senza server (net=0). Telefono 390×844: l'Isola dell'Arena c'è (portone del colosseo, ENTRA vicino), il
// pannello del colosseo (set del duello: vestizione, 4 slot, frecce degli archi, 2 pozioni; senza link solo ALLENAMENTO), si cambia uno
// slot dal pannello; ?arena=banco entra subito nell'allenamento contro l'avversario automatico: conto alla rovescia (fermi), VIA, la barra
// dei 4 slot e le 2 pozioni in basso (tocco), il joystick di mira con l'arco, il tabellone in alto; col pilota si combatte (vita che scende,
// nessun colpo da 100); ARRENDITI dal menu → scheda SCONFITTA → di nuovo il pannello. PC 1280×720: tasti 1-4 cambiano slot, 5 beve,
// clic sinistro attacca, Esc apre il menu. Screenshot in tests/out/shots/m4_arena_*.png.
export const timeout = 300000;

export default async function (ctx) {
  const { assert } = ctx;
  const ar = (st) => st.arenaDuello ?? null;

  // ---------------- telefono: isola e pannello ----------------
  const p = await ctx.open('?test=1&net=0');
  await ctx.waitReady(p.page, 20000);
  const page = p.page;
  await ctx.test('telefono: l’Isola dell’Arena col portone del colosseo; ENTRA apre il pannello del set', async () => {
    await ctx.waitState(page, (st) => !!st.arena?.spot, 30000);
    assert(await page.evaluate(() => window.__game.test.arenaVai()), 'isola dell’Arena non trovata');
    await ctx.waitState(page, (st) => st.arena.near === true, 10000);
    await page.waitForSelector('#mzArenaEntra.on', { timeout: 10000 });
    await page.waitForTimeout(1200);
    await ctx.shot(page, 'portone');
    await page.tap('#mzArenaEntra');
    await page.waitForSelector('#mzColosseo.on', { timeout: 40000 });
    const st = await ctx.getState(page);
    assert(st.colosseo.aperto && st.colosseo.set.slot.length === 4 && st.colosseo.set.pozioni.length === 2, 'pannello: ' + JSON.stringify(st.colosseo));
    assert(await page.isDisabled('#mzColosseo [data-act=coda]'), 'senza link la coda veloce non dev’essere attiva');
    assert(!(await page.isDisabled('#mzColosseo [data-act=allenamento]')), 'ALLENAMENTO spento');
    // lo slot 4 (vuoto): la lista delle scelte (l'eroe di partenza ha già tutto negli altri slot: resta «Niente»)
    await page.tap('#mzColosseo .riga.q .cella:nth-child(4)');
    await page.waitForSelector('#mzColosseo .lista.on', { timeout: 5000 });
    await ctx.shot(page, 'pannello_lista');
    const n = await page.locator('#mzColosseo .lista.on button').count();
    assert(n >= 1, 'lista vuota');
    await page.tap('#mzColosseo .lista.on button[data-id=""]');
    await page.waitForTimeout(200);
    await ctx.shot(page, 'pannello');
    await page.tap('#mzColosseo .mz-x');
    await ctx.waitState(page, (s) => s.colosseo.aperto === false, 5000);
  });

  // ---------------- telefono: stanza di prova ----------------
  const b = await ctx.open('?test=1&net=0&arena=banco');
  await ctx.waitReady(b.page, 20000);
  const pb = b.page;
  await ctx.test('telefono: ?arena=banco entra subito nel duello; conto alla rovescia fermi, poi VIA', async () => {
    await ctx.waitState(pb, (st) => st.arenaDuello?.phase === 'play', 60000);
    const s0 = ar(await ctx.getState(pb));
    assert(s0.fase === 'conta' && s0.round === 0 && s0.vita.join() === '100,100', 'all’inizio: ' + JSON.stringify(s0));
    assert(await pb.isVisible('#mzArenaBarra') && await pb.isVisible('#mzArenaTop'), 'barra degli slot o tabellone assenti');
    assert(!(await pb.isVisible('#mzTop')), 'la barra in alto della superficie è ancora visibile');
    const box = await pb.locator('#mzArenaBarra').boundingBox();
    assert(box && box.x >= 8 && box.x + box.width <= 390 - 8 && box.y + box.height <= 844, 'la barra esce dallo schermo: ' + JSON.stringify(box));
    assert((await pb.locator('#mzArenaBarra button').count()) === 6, 'servono 4 slot e 2 pozioni');
    await ctx.shot(pb, 'conta');
    await ctx.waitState(pb, (st) => st.arenaDuello?.fase === 'gioca', 15000);
  });
  await ctx.test('telefono: la barra cambia slot col tocco (arco → joystick di mira), la pozione si beve una volta', async () => {
    await pb.tap('#mzArenaBarra button[data-act=slot][data-n="1"]');
    await ctx.waitState(pb, (st) => st.arenaDuello?.slot === 1, 5000);
    await pb.waitForSelector('#mzArenaMira.on', { timeout: 5000 });
    assert(!(await pb.isVisible('#btnA')), 'con l’arco in mano il bottone A lascia il posto alla mira');
    await ctx.shot(pb, 'arco');
    await pb.tap('#mzArenaBarra button[data-act=slot][data-n="0"]');
    await ctx.waitState(pb, (st) => st.arenaDuello?.slot === 0, 5000);
    await pb.tap('#mzArenaBarra button[data-act=pozione][data-n="0"]');
    await pb.waitForSelector('#mzArenaBarra button.pz.usata', { timeout: 5000 });
  });
  await ctx.test('telefono: col pilota si combatte (vite che scendono, mai un colpo da 100), poi ARRENDITI → SCONFITTA → pannello', async () => {
    await pb.evaluate(() => window.__game.test.arenaAuto(true));
    await ctx.waitState(pb, (st) => st.arenaDuello && (st.arenaDuello.vita[0] < 100 || st.arenaDuello.vita[1] < 100), 60000);
    await ctx.shot(pb, 'lotta');
    await pb.evaluate(() => window.__game.test.arenaAuto(false));
    await pb.tap('#mzArenaMenuBtn');
    await pb.waitForSelector('#mzArenaMenu.on', { timeout: 5000 });
    await pb.tap('#mzArenaMenu [data-act=resa]');
    await pb.waitForSelector('#mzArenaResa.on', { timeout: 5000 });
    await ctx.shot(pb, 'resa');
    await pb.tap('#mzArenaResa [data-act=si]');
    await ctx.waitState(pb, (st) => st.arenaDuello?.finale === true, 15000);
    const s = ar(await ctx.getState(pb));
    assert(s.esito?.vincitore === 1 && s.esito.perche === 'resa', 'esito: ' + JSON.stringify(s.esito));
    assert((await pb.textContent('#mzArenaFine')).includes('SCONFITTA'), 'scheda finale senza SCONFITTA');
    await ctx.shot(pb, 'fine');
    await pb.tap('#mzArenaFine [data-act=esci]');
    await ctx.waitState(pb, (st) => st.colosseo?.aperto === true && !st.arenaDuello, 15000);
    assert(await pb.isVisible('#mzColosseo'), 'il pannello non torna');
  });

  // ---------------- PC ----------------
  const d = await ctx.open('?test=1&net=0&arena=banco', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  const pd = d.page;
  await ctx.test('PC: tasti 1-4 cambiano slot, 5 beve, clic attacca, Esc apre il menu', async () => {
    await ctx.waitState(pd, (st) => st.arenaDuello?.fase === 'gioca', 60000);
    for (const [k, n] of [['Digit2', 1], ['Digit3', 2], ['Digit1', 0]]) {
      await pd.keyboard.press(k);
      await ctx.waitState(pd, (st, n) => st.arenaDuello?.slot === n, 5000, n);
    }
    await pd.keyboard.press('Digit4'); // vuoto: non cambia
    await pd.waitForTimeout(200);
    assert(ar(await ctx.getState(pd)).slot === 0, 'lo slot vuoto si è preso');
    await pd.keyboard.press('Digit5');
    await pd.waitForSelector('#mzArenaBarra button.pz.usata', { timeout: 5000 });
    // verso l'avversario e qualche colpo col clic
    await pd.keyboard.down('KeyD'); await pd.waitForTimeout(2500); await pd.keyboard.up('KeyD');
    for (let i = 0; i < 4; i++) { await pd.mouse.click(640, 360); await pd.waitForTimeout(250); }
    await ctx.shot(pd, 'pc_lotta');
    await pd.keyboard.press('Escape');
    await pd.waitForSelector('#mzArenaMenu.on', { timeout: 5000 });
    await ctx.shot(pd, 'pc_menu');
    await pd.keyboard.press('Escape');
    await pd.waitForSelector('#mzArenaMenu.on', { state: 'hidden', timeout: 5000 });
  });

  await ctx.test('nessun errore in pagina', async () => {
    for (const x of [p, b, d]) assert(!x.errors.length, 'errori: ' + x.errors.slice(0, 3).join('\n'));
  });
}
