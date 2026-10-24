// Arena a squadre (docs/ARENA.md) senza server (net=0). Telefono 390×844: il pannello del colosseo ha i tre formati (1 contro 1, 2 contro 2,
// 3 contro 3) e la mappa dell'allenamento (a caso o una); l'ALLENAMENTO 2v2 sul Giardino: il tabellone ha due eroi per lato (la mia squadra a
// sinistra), l'erba alta nasconde gli avversari (non i compagni), un avversario vicino li scopre, io nell'erba leggo il cartello; il pilota
// combatte. 3v3 sulle Rovine: sei eroi, il tabellone sta nello schermo e il bottone del menu non lo copre. Screenshot in
// tests/out/shots/m4_arena_squadre_*.png. Allenamento a squadre: i gladiatori sono casuali di default e si vestono a mano da tutto il catalogo; con una
// bomba in mano, mentre si mira, a terra c'è l'ombra di dove atterra (nello stato del duello: solo la mia scena la disegna).
export const timeout = 300000;

export default async function (ctx) {
  const { assert } = ctx;
  const ar = (st) => st.arenaDuello ?? null;
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
  /** Sceglie formato e mappa e parte con ALLENAMENTO; aspetta il conto alla rovescia. */
  const allena = async (page, f, mappa) => {
    await page.tap(`#mzColosseo .formati button[data-f="${f}"]`);
    await page.tap(`#mzColosseo .formati button[data-m="${mappa}"]`);
    await ctx.shot(page, `pannello_${f}v${f}`);
    await page.tap('#mzColosseo [data-act=allenamento]');
    await ctx.waitState(page, (st) => st.arenaDuello?.phase === 'play' && st.arenaDuello.fase === 'conta', 60000);
  };

  const p = await ctx.open('?test=1&net=0');
  const page = p.page;
  await ctx.test('telefono: il pannello ha 1, 2 e 3 contro; le mappe dipendono dal formato', async () => {
    await pannello(page);
    const nf = await page.locator('#mzColosseo .formati button[data-f]').count();
    assert(nf === 3, 'servono tre formati: ' + nf);
    const mappe = async () => page.locator('#mzColosseo .formati button[data-m]').evaluateAll((bs) => bs.map((b) => b.dataset.m));
    assert((await mappe()).join() === ',colosseo', 'mappe del duello: ' + (await mappe()));
    await page.tap('#mzColosseo .formati button[data-f="2"]');
    assert((await mappe()).join() === ',colosseo,giardino,rovine', 'mappe del 2v2: ' + (await mappe()));
    await page.tap('#mzColosseo .formati button[data-f="3"]');
    assert((await mappe()).join() === ',giardino,rovine', 'mappe del 3v3: ' + (await mappe()));
    assert(await page.isDisabled('#mzColosseo [data-act=coda]'), 'senza link la coda veloce non dev’essere attiva');
    await ctx.shot(page, 'pannello');
  });

  await ctx.test('telefono: 2v2 sul Giardino: squadre, tabellone a due righe, erba alta (compagni sì, avversari no, vicino sì)', async () => {
    await allena(page, 2, 'giardino');
    const s0 = ar(await ctx.getState(page));
    assert(s0.squadre.join() === '0,0,1,1' && s0.mappa === 'giardino' && s0.vita.length === 4, 'stato: ' + JSON.stringify(s0));
    assert((await page.locator('#mzArenaTop .mz-ar-lato.io .eroe').count()) === 2 && (await page.locator('#mzArenaTop .mz-ar-lato.lui .eroe').count()) === 2, 'il tabellone ha due eroi per lato');
    assert(!(await page.isVisible('#mzArenaBadge')), 'cartello acceso senza motivo');
    // nel conto alla rovescia nessuno si muove: si posano gli eroi e si legge la vista
    const r = await page.evaluate(async () => {
      const T = window.__game.test, S = () => window.__game.state().arenaDuello, frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const out = {};
      T.arenaPosa(2, 6, 3); await frame(); out.avversarioNellErba = S();          // avversario 2 nel prato in alto a sinistra, io alla partenza
      T.arenaPosa(1, 5, 2); await frame(); out.compagnoNellErba = S();            // anche il mio compagno nell'erba: si vede lo stesso
      T.arenaPosa(0, 8, 3); await frame(); out.vicino = S();                      // io a 2 m da lui: lo scopro
      T.arenaPosa(0, 6, 2); T.arenaPosa(2, 24, 10); await frame(); out.ioNellErba = S(); // io nell'erba, gli avversari lontani: nascosto
      return out;
    });
    assert(r.avversarioNellErba.nascosti.join() === '2' && r.avversarioNellErba.visibili.join() === 'true,true,false,true', 'avversario nell’erba: ' + JSON.stringify(r.avversarioNellErba.nascosti) + ' ' + r.avversarioNellErba.visibili);
    assert(!r.compagnoNellErba.nascosti.includes(1) && r.compagnoNellErba.visibili[1] === true, 'il compagno nell’erba si vede: ' + JSON.stringify(r.compagnoNellErba.nascosti));
    assert(!r.vicino.nascosti.includes(2) && r.vicino.visibili[2] === true, 'a 2 m si scopre: ' + JSON.stringify(r.vicino.nascosti));
    assert(r.ioNellErba.nascosto === true, 'io nell’erba devo essere nascosto');
    await page.waitForSelector('#mzArenaBadge.on', { timeout: 5000 });
    assert((await page.textContent('#mzArenaBadge')).includes('ERBA'), 'cartello: ' + (await page.textContent('#mzArenaBadge')));
    await ctx.shot(page, 'giardino_erba_io');
    // l'avversario torna a vedersi fuori dall'erba
    await page.evaluate(() => { window.__game.test.arenaPosa(0, 10, 8); window.__game.test.arenaPosa(2, 6, 3); window.__game.test.arenaPosa(1, 9, 8); });
    await page.waitForTimeout(150);
    await ctx.shot(page, 'giardino_avversario_nascosto');
  });

  await ctx.test('telefono: col pilota il 2v2 si combatte; ARRENDITI → SCONFITTA → pannello', async () => {
    await ctx.waitState(page, (st) => st.arenaDuello?.fase === 'gioca', 15000);
    await page.evaluate(() => window.__game.test.arenaAuto(true));
    await ctx.waitState(page, (st) => st.arenaDuello && st.arenaDuello.vita.some((v) => v < 100), 60000);
    await ctx.shot(page, 'giardino_lotta');
    await page.evaluate(() => window.__game.test.arenaAuto(false));
    await page.tap('#mzArenaMenuBtn');
    await page.waitForSelector('#mzArenaMenu.on', { timeout: 5000 });
    await page.tap('#mzArenaMenu [data-act=resa]');
    await page.waitForSelector('#mzArenaResa.on', { timeout: 5000 });
    assert((await page.textContent('#mzArenaResa')).includes('compagni'), 'la resa a squadre dice dei compagni');
    await page.tap('#mzArenaResa [data-act=si]');
    // io fuori, i compagni continuano: la partita non finisce subito; i gladiatori l'hanno già in mano
    await page.waitForTimeout(600);
    assert(ar(await ctx.getState(page)).esito === null, 'chi si arrende da solo non chiude la partita a squadre');
    await page.waitForSelector('#mzArenaBadge.on', { timeout: 5000 });
    assert((await page.textContent('#mzArenaBadge')).includes('TERRA'), 'cartello a terra: ' + (await page.textContent('#mzArenaBadge')));
    await ctx.shot(page, 'giardino_fuori');
  });

  const q = await ctx.open('?test=1&net=0');
  const p3 = q.page;
  await ctx.test('telefono: 3v3 sulle Rovine: sei eroi, tabellone nello schermo, menu sotto il tabellone, erba alta in scena', async () => {
    await pannello(p3);
    await allena(p3, 3, 'rovine');
    const s0 = ar(await ctx.getState(p3));
    assert(s0.squadre.join() === '0,0,0,1,1,1' && s0.mappa === 'rovine' && s0.vita.length === 6, 'stato: ' + JSON.stringify(s0));
    assert((await p3.locator('#mzArenaTop .eroe').count()) === 6, 'il tabellone ha sei righe');
    const top = await p3.locator('#mzArenaTop').boundingBox(), menu = await p3.locator('#mzArenaMenuBtn').boundingBox();
    assert(top && top.x >= 0 && top.x + top.width <= 390 && top.height < 130, 'tabellone: ' + JSON.stringify(top));
    assert(menu && menu.y >= top.y + top.height - 1, `il bottone del menu copre il tabellone: ${JSON.stringify(menu)} / ${JSON.stringify(top)}`);
    const barra = await p3.locator('#mzArenaBarra').boundingBox();
    assert(barra && barra.x >= 8 && barra.x + barra.width <= 382 && barra.y + barra.height <= 844, 'la barra esce dallo schermo');
    // io nell'erba di sinistra: la macchia scura e i ciuffi si vedono attorno a me
    await p3.evaluate(() => window.__game.test.arenaPosa(0, 3, 6));
    await p3.waitForTimeout(250);
    await ctx.shot(p3, 'rovine_erba');
    await ctx.waitState(p3, (st) => st.arenaDuello?.fase === 'gioca', 15000);
    await p3.evaluate(() => window.__game.test.arenaAuto(true));
    await ctx.waitState(p3, (st) => st.arenaDuello && st.arenaDuello.vita.some((v) => v < 100), 60000);
    await ctx.shot(p3, 'rovine_lotta');
  });

  const w = await ctx.open('?test=1&net=0');
  const pw = w.page;
  await ctx.test('telefono: allenamento 2v2: gladiatori casuali di default, a mano si veste tutto; bomba in mano: ombra di mira', async () => {
    await pannello(pw);
    assert((await pw.locator('#mzColosseo [data-bot]').count()) === 0, 'nel duello 1v1 non ci sono gladiatori da scegliere');
    await pw.tap('#mzColosseo .formati button[data-f="2"]');
    const nomi = () => pw.locator('#mzColosseo [data-bot]').evaluateAll((bs) => bs.map((b) => b.textContent));
    const n0 = await nomi();
    assert(n0.length === 3 && n0.every((x) => x.includes('casuale')), 'tre gladiatori, tutti casuali: ' + n0);
    assert(n0[0].includes('compagno') && n0[1].includes('avversario') && n0[2].includes('avversario'), 'compagno e avversari: ' + n0);
    await pw.tap('#mzColosseo [data-bot="2"]');
    const colo = async () => (await ctx.getState(pw)).colosseo;
    assert((await colo()).bot === 2 && (await colo()).bots[2], 'il gladiatore 2 è aperto, con una build di partenza');
    await pw.tap('#mzColosseo .riga:not(.d):not(.q) .cella >> nth=0');
    assert((await pw.locator('#mzColosseo .lista.on button[data-id="unico_veste_arcimago"]').count()) === 1, 'un gladiatore può vestire tutto il catalogo, anche quello che io non ho');
    await ctx.shot(pw, 'gladiatore_vestizione');
    await pw.tap('#mzColosseo .lista.on button[data-id="unico_veste_arcimago"]');
    assert((await colo()).bots[2].corpo === 'unico_veste_arcimago', 'la veste è andata al gladiatore, non a me: ' + JSON.stringify((await colo()).bots[2]));
    assert(!(await colo()).set.corpo || (await colo()).set.corpo !== 'unico_veste_arcimago', 'il mio set non è cambiato');
    await pw.tap('#mzColosseo [data-act=casuale]');
    assert((await colo()).bot === null && (await colo()).bots[2] === null, 'BUILD CASUALE rimette il caso');
    await pw.tap('#mzColosseo [data-bot="2"]');
    await pw.tap('#mzColosseo [data-act=mio]');
    assert((await colo()).bot === null && (await colo()).bots[2], 'IL TUO SET torna al mio senza perdere la scelta');
    // la mia bomba in mano
    await pw.evaluate(() => { window.__game.test.arenaImpara(['bomba_fuoco']); window.__game.test.arenaSet({ slot: [{ magia: 'bomba_fuoco' }, null, null, null], pozioni: [null, null] }); });
    await pw.tap('#mzColosseo .formati button[data-m="giardino"]');
    await pw.tap('#mzColosseo [data-act=allenamento]');
    await ctx.waitState(pw, (st) => st.arenaDuello?.fase === 'gioca', 60000);
    assert((await ctx.getState(pw)).arenaDuello.ombra === null, 'senza mirare niente ombra');
    await pw.keyboard.down('Space');
    await ctx.waitState(pw, (st) => !!st.arenaDuello?.ombra, 10000);
    const o = (await ctx.getState(pw)).arenaDuello.ombra;
    assert(o.r > 1.5 && o.r < 3.5, 'l’ombra ha il raggio dello scoppio: ' + JSON.stringify(o));
    await ctx.shot(pw, 'ombra_bomba');
    await pw.keyboard.up('Space');
    await ctx.waitState(pw, (st) => st.arenaDuello?.ombra === null, 10000);
  });

  await ctx.test('nessun errore in pagina', async () => {
    for (const x of [p, q, w]) assert(!x.errors.length, 'errori: ' + x.errors.slice(0, 3).join('\n'));
  });
}
