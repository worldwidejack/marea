// Arena PvP (docs/ARENA.md) senza server (net=0). Telefono 390×844: l'Isola dell'Arena c'è (portone del colosseo, ENTRA vicino), il
// pannello del colosseo (le build: dote, 2 slot tra armi e magie, ulti, + NUOVA; senza link solo ALLENAMENTO), si cambiano slot, dote e ulti;
// ?arena=banco entra subito nell'allenamento (Caccia alle stelle, coi gladiatori): conto alla rovescia (fermi), VIA, la barra coi 2 slot e il
// bottone dell'ulti in basso (tocco), il joystick di mira con l'arco, il tabellone in alto; l'ulti piena si lancia col tocco; col pilota si
// combatte (vita che scende, nessun colpo da 100); ARRENDITI dal menu → scheda SCONFITTA → di nuovo il pannello. PC 1280×720: tasti 1-2
// cambiano slot, F lancia l'ulti, clic sinistro attacca, Esc apre il menu. Screenshot in tests/out/shots/m4_arena_*.png.
export const timeout = 300000;

export default async function (ctx) {
  const { assert } = ctx;
  const ar = (st) => st.arenaPartita ?? null;

  // ---------------- telefono: isola e pannello ----------------
  const p = await ctx.open('?test=1&net=0&ruota=1');
  await ctx.waitReady(p.page, 20000);
  const page = p.page;
  await ctx.test('telefono: l’Isola dell’Arena col portone del colosseo; ENTRA apre il pannello delle build', async () => {
    await ctx.waitState(page, (st) => !!st.arena?.spot, 30000);
    assert(await page.evaluate(() => window.__game.test.arenaVai()), 'isola dell’Arena non trovata');
    await ctx.waitState(page, (st) => st.arena.near === true, 10000);
    await page.waitForSelector('#mzArenaEntra.on', { timeout: 10000 });
    await page.waitForTimeout(1200);
    await ctx.shot(page, 'portone');
    await page.tap('#mzArenaEntra');
    await page.waitForSelector('#mzColosseo.on', { timeout: 40000 });
    const st = await ctx.getState(page);
    assert(st.colosseo.aperto && st.colosseo.build.slot.length === 2 && st.colosseo.builds.build.length === 1, 'pannello: ' + JSON.stringify(st.colosseo));
    await page.waitForSelector('.pp-ruota.on');
    await ctx.shot(page, 'rotazione');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForSelector('.pp-ruota.on', { state: 'hidden' });
    await page.waitForSelector('#mzColosseo .arena-figura[src]');
    await ctx.shot(page, 'lobby_orizzontale');
    assert(await page.isDisabled('#mzColosseo [data-act=sala]'), 'senza link la lobby non dev’essere attiva');
    await page.tap('#mzColosseo [data-act=avvia]');
    assert(await page.isEnabled('#mzColosseo [data-act=allenamento]'), 'riempimento con bot spento');
    assert(await page.isDisabled('#mzColosseo [data-act=players]'), 'riempimento con giocatori ancora spento');
    await page.tap('#mzColosseo [data-act=build]');
    // lo slot 2: la lista di armi e magie, si sceglie il fulmine
    await page.tap('#mzColosseo .cella[data-slot="1"]');
    await page.waitForSelector('#mzColosseo .lista.on', { timeout: 5000 });
    await ctx.shot(page, 'pannello_lista');
    const n = await page.locator('#mzColosseo .lista.on button').count();
    assert(n >= 12, 'lista corta: ' + n);
    assert(!(await page.locator('#mzColosseo .lista.on button[data-id="magia:lupo_spettrale"]').count()), 'le evocazioni non ci sono');
    await page.tap('#mzColosseo .lista.on button[data-id="magia:fulmine"]');
    // la dote e l'ulti
    await page.tap('#mzColosseo .cella[data-dote=vigore]');
    await page.tap('#mzColosseo .cella[data-ulti]');
    await page.waitForSelector('#mzColosseo .lista.on button[data-id=arpione]', { timeout: 5000 });
    await page.tap('#mzColosseo .lista.on button[data-id=arpione]');
    await ctx.waitState(page, (s) => s.colosseo.build.dote === 'vigore' && s.colosseo.build.ulti === 'arpione' && s.colosseo.build.slot[1]?.magia === 'fulmine', 5000);
    // una seconda build
    await page.tap('#mzColosseo [data-build=nuova]');
    await ctx.waitState(page, (s) => s.colosseo.builds.build.length === 2 && s.colosseo.builds.scelta === 1, 5000);
    await ctx.shot(page, 'pannello');
    await page.tap('#mzColosseo .mz-x');
    await ctx.waitState(page, (s) => s.colosseo.aperto === false, 5000);
  });

  // ---------------- telefono: stanza di prova ----------------
  const b = await ctx.open('?test=1&net=0&arena=banco');
  await ctx.waitReady(b.page, 20000);
  const pb = b.page;
  await ctx.test('telefono: ?arena=banco entra subito nell’allenamento; conto alla rovescia fermi, poi VIA', async () => {
    await ctx.waitState(pb, (st) => st.arenaPartita?.phase === 'play', 60000);
    const s0 = ar(await ctx.getState(pb));
    assert(s0.fase === 'conta' && s0.modo === 'stelle' && s0.vita.length === 6 && s0.vita[0] === 110, 'all’inizio (dote Vita): ' + JSON.stringify(s0));
    assert(await pb.isVisible('#mzArenaBarra') && await pb.isVisible('#mzArenaTop'), 'barra degli slot o tabellone assenti');
    assert(!(await pb.isVisible('#mzTop')), 'la barra in alto della superficie è ancora visibile');
    const box = await pb.locator('#mzArenaBarra').boundingBox();
    assert(box && box.x >= 8 && box.x + box.width <= 390 - 8 && box.y + box.height <= 844, 'la barra esce dallo schermo: ' + JSON.stringify(box));
    assert((await pb.locator('#mzArenaBarra button').count()) === 3, 'servono 2 slot e l’ulti');
    await ctx.shot(pb, 'conta');
    await ctx.waitState(pb, (st) => st.arenaPartita?.fase === 'gioca', 15000);
  });
  await ctx.test('telefono: la barra cambia slot col tocco (arco → joystick di mira); l’ulti piena si lancia col tocco', async () => {
    await pb.tap('#mzArenaBarra button[data-act=slot][data-n="1"]');
    await ctx.waitState(pb, (st) => st.arenaPartita?.slot === 1, 5000);
    await pb.waitForSelector('#mzArenaMira.on', { timeout: 5000 });
    assert(!(await pb.isVisible('#btnA')), 'con l’arco in mano il bottone A lascia il posto alla mira');
    await ctx.shot(pb, 'arco');
    await pb.tap('#mzArenaBarra button[data-act=slot][data-n="0"]');
    await ctx.waitState(pb, (st) => st.arenaPartita?.slot === 0, 5000);
    await pb.tap('#mzArenaBarra button[data-act=ulti]');
    await pb.waitForTimeout(300);
    assert(ar(await ctx.getState(pb)).ulti[0].fase === 'no', 'vuota non parte');
    assert(await pb.evaluate(() => window.__game.test.arenaCarica(0)), 'carica di prova');
    await pb.waitForSelector('#mzArenaBarra button.ul.pronta', { timeout: 5000 });
    await ctx.shot(pb, 'ulti_pronta');
    await pb.tap('#mzArenaBarra button[data-act=ulti]');
    await ctx.waitState(pb, (st) => st.arenaPartita?.ulti[0].fase === 'su', 5000);
    await pb.waitForSelector('#mzArenaBarra button.ul.attiva', { timeout: 5000 });
  });
  await ctx.test('telefono: col pilota si combatte (vite che scendono, mai un colpo da 100), poi ARRENDITI → SCONFITTA → pannello', async () => {
    await pb.evaluate(() => window.__game.test.arenaAuto(true));
    await ctx.waitState(pb, (st) => st.arenaPartita && st.arenaPartita.vita.some((v) => v !== 100 && v !== 110), 60000);
    await ctx.shot(pb, 'lotta');
    await pb.evaluate(() => window.__game.test.arenaAuto(false));
    await pb.tap('#mzArenaMenuBtn');
    await pb.waitForSelector('#mzArenaMenu.on', { timeout: 5000 });
    await pb.tap('#mzArenaMenu [data-act=resa]');
    await pb.waitForSelector('#mzArenaResa.on', { timeout: 5000 });
    await ctx.shot(pb, 'resa');
    await pb.tap('#mzArenaResa [data-act=si]');
    await ctx.waitState(pb, (st) => st.arenaPartita?.finale === true, 15000);
    const s = ar(await ctx.getState(pb));
    assert(s.esito?.vincitore === 1 && s.esito.perche === 'resa', 'esito: ' + JSON.stringify(s.esito));
    assert((await pb.textContent('#mzArenaFine')).includes('SCONFITTA'), 'scheda finale senza SCONFITTA');
    await ctx.shot(pb, 'fine');
    await pb.tap('#mzArenaFine [data-act=esci]');
    await ctx.waitState(pb, (st) => st.colosseo?.aperto === true && !st.arenaPartita, 15000);
    assert(await pb.isVisible('#mzColosseo'), 'il pannello non torna');
  });

  // ---------------- PC ----------------
  const d = await ctx.open('?test=1&net=0&arena=banco', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  const pd = d.page;
  await ctx.test('PC: tasti 1-2 cambiano slot, F lancia l’ulti, clic attacca, Esc apre il menu', async () => {
    await ctx.waitState(pd, (st) => st.arenaPartita?.fase === 'gioca', 60000);
    for (const [k, n] of [['Digit2', 1], ['Digit1', 0]]) {
      await pd.keyboard.press(k);
      await ctx.waitState(pd, (st, n) => st.arenaPartita?.slot === n, 5000, n);
    }
    await pd.keyboard.press('Digit3'); // non c'è: non cambia
    await pd.waitForTimeout(200);
    assert(ar(await ctx.getState(pd)).slot === 0, 'lo slot 3 non esiste');
    await pd.evaluate(() => window.__game.test.arenaCarica(0));
    await pd.keyboard.press('KeyF');
    await ctx.waitState(pd, (st) => st.arenaPartita?.ulti[0].fase === 'su', 5000);
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
