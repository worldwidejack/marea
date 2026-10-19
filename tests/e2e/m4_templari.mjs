// Isola dei Templari (docs/TEMPLARI.md): senza server (net=0) e con ?templari=1. Telefono 390×844: c'è il bottone ⚔ delle prove, si entra
// subito nelle ondate (il chunk si scarica solo adesso), la chiesa si disegna (pavimento, muri, finestre con le assi), parte l'ondata 1, gli
// zombie escono dal sagrato, strappano le assi ed entrano; col pilota si superano ondate e si fanno punti; draw call nel budget con gli
// zombie in scena; AZIONE compare vicino a una finestra rotta; la pausa ferma la partita, ESCI → scheda dell'esito («senza link niente
// premio») → di nuovo nel mondo. PC 1280×720: Esc apre la pausa, F posa la reliquia sull'altare (ondate dall'altare, non subito), la mira
// A MANO resta salvata. L’isola è dipinta (dipinto piccolo al telefono, ombre cotte). Screenshot in tests/out/shots/m4_templari_*.png.
export const timeout = 330000;

export default async function (ctx) {
  const { assert } = ctx;
  const tpl = (st) => st.templari ?? {};
  /** Aspetta e, se cade, dice cosa c'era in campo (le prove di mira dipendono da dove sta lo zombie). */
  const attendi = async (pg, fn, ms, cosa, arg = null) => {
    try { await ctx.waitState(pg, fn, ms, arg); } catch (e) {
      const s = tpl(await ctx.getState(pg));
      throw new Error(`${cosa}: ${JSON.stringify({ sim: s.sim, ondata: s.ondata, eroe: s.eroe, faccia: s.faccia, zombiePos: s.zombiePos, zombie: s.zombie, uccisioni: s.uccisioni, mira: s.mira, armi: s.armi, act: s.act })}`);
    }
  };

  // ---------------- telefono ----------------
  const p = await ctx.open('?test=1&net=0&templari=1');
  await ctx.waitReady(p.page, 20000);
  const page = p.page;
  await ctx.test('telefono: bottone ⚔ delle prove, isola aperta, chunk non ancora scaricato', async () => {
    assert(await page.isVisible('#mzTemplariProva'), 'bottone ⚔ assente');
    const st = await ctx.getState(page);
    assert(tpl(st).aperta === true && tpl(st).active === false, `templari: ${JSON.stringify(tpl(st))}`);
    assert(st.temi.isole.some((i) => i.id === 'templari' && i.aperta), 'isola dei Templari non aperta con ?templari=1');
  });
  await ctx.test('telefono: SCEGLI L’EROE — tre carte, l’avatar vestito sulla pedana, le barre; si cambia e si parte', async () => {
    await page.click('#mzTemplariProva');
    await page.waitForSelector('#mzTplScelta.on', { timeout: 30000 });
    assert((await page.locator('#mzTplScelta .carta').count()) === 3, 'non ci sono tre eroi');
    for (const id of ['bucaniera', 'arciere', 'crociato']) {
      await page.tap(`#mzTplScelta [data-eroe=${id}]`);
      await ctx.waitState(page, (st, id) => st.templariScelta?.eroe === id && st.templariScelta.pronto && st.templariScelta.vestito === 'tpl_' + id, 20000, id)
        .catch(async (e) => { throw new Error(`${id}: ${JSON.stringify((await ctx.getState(page)).templariScelta)} ${e.message}`); });
      assert((await page.textContent('#mzTplScelta .nome')).length > 3, 'pannello senza nome');
      await page.waitForTimeout(300);
      await ctx.shot(page, `scelta_${id}`);
    }
    assert(!(await page.isVisible('#joystick')), 'il joystick si vede sopra il menù');
    await page.tap('#mzTplScelta [data-act=via]');
  });
  await ctx.test('telefono: dentro la chiesa, la scena si disegna e parte l’ondata 1', async () => {
    await ctx.waitState(page, (st) => st.templari.active && st.templari.fase === 'gioca', 30000);
    const e0 = (await ctx.getState(page)).templari.eroe;
    assert(e0.classe === 'crociato' && e0.vita === 150, `eroe: ${JSON.stringify(e0)}`);
    await ctx.waitState(page, (st) => st.templari.eroe.vestito === 'tpl_crociato', 15000);
    assert(await page.isVisible('#mzTplSuper'), 'bottone SUPER assente');
    const st = await ctx.getState(page);
    // le assi disegnate sono quelle della sim; il tetto copre il primo disegno della chiesa, che appena dopo «gioca» blocca la pagina
    // 5-6 s su SwiftShader in locale (di più su GitHub): misurato il 9/10 (#171), prima era 5 s e cadeva se il test arrivava prima del blocco
    await ctx.waitState(page, (s) => s.templari.scena?.assi === s.templari.assi.reduce((t, n) => t + n, 0), 30000);
    assert(st.templari.scena.muri > 50, `scena: ${JSON.stringify(st.templari.scena)}`);
    assert(await page.isVisible('#mzTpl'), 'HUD assente');
    assert(!(await page.isVisible('#mzTop')), 'la barra in alto della superficie è ancora visibile');
    await ctx.waitState(page, (s) => s.templari.ondata === 1, 20000);
    await ctx.shot(page, 'ondata1');
  });
  await ctx.test('telefono: il super — carico brilla, un tocco su SUPER e il Giudizio butta giù chi sta attorno', async () => {
    const prova = (o) => page.evaluate((o) => window.__game.test.templariProva(o), o);
    await prova({ pulisci: true, vita: 1e6, super: true, zombie: 'fante', dist: 1.6 });
    await page.waitForSelector('#mzTplSuper.pronto', { timeout: 5000 });
    const u0 = (await ctx.getState(page)).templari.uccisioni;
    await page.tap('#mzTplSuper');
    await ctx.waitState(page, (s, u0) => s.templari.uccisioni > u0 && s.templari.eroe.super < 1, 5000, u0);
    await ctx.shot(page, 'super_giudizio');
  });
  await ctx.test('telefono: gli zombie escono, strappano le assi; col pilota si superano ondate', async () => {
    // vita alta (hook di prova, senza server): il pilota a volte muore già all'ondata 2 e poi le armi non si provano più (#171)
    await page.evaluate(() => window.__game.test.templariProva({ vita: 1e6 }));
    await page.evaluate(() => window.__game.test.templariAutopilot(true, 6));
    await ctx.waitState(page, (st) => st.templari.zombie > 0, 30000);
    await ctx.waitState(page, (st) => st.templari.assi.some((n) => n < 5), 60000);
    await ctx.shot(page, 'assalto');
    const perf = await ctx.getPerf(page);
    ctx.log('perf con gli zombie', JSON.stringify(perf));
    assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls} > 100`);
    await ctx.waitState(page, (st) => st.templari.ondata >= 3 || st.templari.done, 150000);
    const st = await ctx.getState(page);
    ctx.log('dopo il pilota', JSON.stringify({ ondata: st.templari.ondata, uccisioni: st.templari.uccisioni, punti: st.templari.eroe.punti, vita: st.templari.eroe.vita }));
    assert(st.templari.uccisioni >= 6, `uccisioni ${st.templari.uccisioni}, punti ${st.templari.eroe.punti}`); // i punti il pilota li spende in armi
    await page.evaluate(() => window.__game.test.templariAutopilot(false));
    await ctx.shot(page, 'ondata3');
  });
  await ctx.test('telefono: armi — l’arco dall’altare laterale col bottone AZIONE, munizioni nel HUD, la cassa del tesoro', async () => {
    // a mano come un giocatore, non col pilota: lui compra anche ascia e mazza, e coi due posti pieni l'arco o non lo prende o lo cambia
    // subito con l'arma nuova (il test cadeva 1 volta su 4, #171). Si parte da spada sola, davanti all'arco del muro dell'altare laterale.
    const prova = (o) => page.evaluate((o) => window.__game.test.templariProva(o), o);
    assert(!(await ctx.getState(page)).templari.done, 'la partita è finita prima delle armi');
    await prova({ pulisci: true, vita: 1e6, armi: ['spada'], dove: { x: 39.5, z: 39.5 } });
    await ctx.waitState(page, (s) => s.templari.prompt === 'compra', 10000);
    // il bottone si ridisegna al fotogramma dopo: si aspetta il suo testo, non lo si legge subito
    await page.waitForFunction(() => /PRENDI: ARCO/.test(document.querySelector('#mzTplAzione.on')?.textContent ?? ''), null, { timeout: 10000 })
      .catch(async () => { throw new Error(`il bottone non dice di prendere l’arco: «${await page.textContent('#mzTplAzione')}»`); });
    await page.tap('#mzTplAzione');
    await ctx.waitState(page, (s) => s.templari.eroe.arma === 'arco' && s.templari.armi.some((a) => a?.id === 'spada'), 10000);
    await page.waitForFunction(() => /Arco 20 \| 40/.test(document.querySelector('#mzTpl .arma')?.textContent ?? ''), null, { timeout: 10000 })
      .catch(async () => { throw new Error(`munizioni dell’arco non nel HUD: «${await page.textContent('#mzTpl .arma')}»`); });
    await ctx.shot(page, 'arco');
    // la cassa del tesoro: davanti, coi punti, AZIONE → gira (se il pilota l'aveva aperta, prima si richiude da sola)
    await ctx.waitState(page, (s) => s.templari.cassa.fase === 'chiusa' && !!s.templari.cassa.davanti, 30000);
    // senza punti il bottone lo dice (prima non succedeva niente, #202); sul telefono niente «F» della tastiera
    await prova({ pulisci: true, punti: 100, dove: (await ctx.getState(page)).templari.cassa.davanti });
    await ctx.waitState(page, (s) => s.templari.prompt === 'cassa', 10000);
    await page.tap('#mzTplAzione');
    await page.waitForFunction(() => /Servono 950 punti/.test(document.querySelector('#mzTplPerche.on')?.textContent ?? ''), null, { timeout: 5000 })
      .catch(async () => { throw new Error(`senza punti nessun avviso: «${await page.textContent('#mzTplPerche')}»`); });
    assert(!/F$/.test((await page.textContent('#mzTplAzione')) ?? ''), 'la «F» della tastiera sul telefono');
    // coi punti, solo eventi touch (senza pointer): su iPhone il bottone non rispondeva (#202)
    await prova({ punti: 2000 });
    await page.evaluate(async () => {
      const a = document.querySelector('#mzTplAzione'), r = a.getBoundingClientRect();
      const t = new Touch({ identifier: 7, target: a, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 });
      a.dispatchEvent(new TouchEvent('touchstart', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
      await new Promise((ok) => setTimeout(ok, 100));
      a.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], bubbles: true, cancelable: true }));
    });
    await ctx.waitState(page, (s) => s.templari.cassa.fase === 'gira', 10000);
    await ctx.shot(page, 'cassa');
    const st = await ctx.getState(page);
    ctx.log('armi', JSON.stringify(st.templari.armi), 'cassa', JSON.stringify(st.templari.cassa), 'punti', st.templari.eroe.punti);
    assert(st.templari.eroe.punti < 2000, `la cassa non ha preso i punti: ${st.templari.eroe.punti}`); // 950, più qualche uccisione
  });
  await ctx.test('telefono: joystick di mira — arco e pistola al rilascio sul bersaglio puntato, un tocco veloce spara assistito; A sparisce', async () => {
    const prova = (o) => page.evaluate((o) => window.__game.test.templariProva(o), o);
    /** Mette l'arma, l'eroe nel coro (pavimento libero per 4 m in ogni direzione) e i due zombie; dice dove sta il lontano. */
    const duePosti = async (arma) => {
      await prova({ pulisci: true, ferma: true, vita: 1e6, armi: [arma], dove: { x: 63.5, z: 42.5 }, ondata: 1 }); // zombie dell'ondata 1: un colpo li butta giù, anche se il pilota è arrivato più avanti
      await page.waitForTimeout(300);
      await prova({ zombie: 'fante', dist: 2.5, lato: 0 });
      await prova({ zombie: 'fante', dist: 5, lato: 2.8 });
      await attendi(page, (s) => s.templari.zombiePos.length === 2, 5000, 'zombie non comparsi');
      const st = (await ctx.getState(page)).templari, d = (z) => Math.hypot(z.x - st.eroe.x, z.z - st.eroe.z);
      const [vicino, lontano] = [...st.zombiePos].sort((a, b) => d(a) - d(b));
      const dx = lontano.x - st.eroe.x, dz = lontano.z - st.eroe.z, n = d(lontano), y = st.yaw, vx = dx / n, vz = dz / n;
      return { lontano, dito: { sx: vx * Math.cos(y) - vz * Math.sin(y), sy: vx * Math.sin(y) + vz * Math.cos(y) } };
    };
    /** Cade il lontano, resta il vicino (che nel frattempo si è avvicinato). Si contano le uccisioni invece degli zombie in campo: a
     *  macchina lenta (la suite intera su GitHub) dall'ondata può entrarne un altro, lontano, e il conto in campo non torna. */
    const restaIlVicino = async (u0) => {
      await attendi(page, (s, u) => s.templari.uccisioni > u, 6000, 'nessuno dei due è caduto', u0);
      const st = (await ctx.getState(page)).templari, d = st.zombiePos.map((z) => Math.hypot(z.x - st.eroe.x, z.z - st.eroe.z));
      assert(d.some((x) => x < 3.4), `è caduto il vicino, non quello puntato: restano a ${d.map((x) => x.toFixed(1)).join(', ')} m`);
    };
    /** Il dito sul joystick di mira. Tenendo, punta lo zombie più lontano tra i due vicini all'eroe e lo segue mentre cammina (a macchina
     *  lenta tra il calcolo della mira e il rilascio lo zombie si sposta abbastanza da far mancare la freccia). */
    const dito = (o) => page.evaluate(async ({ sx, sy, tieni }) => {
      const a = document.querySelector('#mzTplMira'), r = a.getBoundingClientRect(), cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      const ev = (tipo, x, y) => a.dispatchEvent(new PointerEvent(tipo, { pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      const dorme = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const verso = () => {
        const st = window.__game.state(), t = st.templari, e = t.eroe, d = (z) => Math.hypot(z.x - e.x, z.z - e.z);
        const z = t.zombiePos.filter((q) => d(q) < 8).sort((p, q) => d(q) - d(p))[0];
        if (!z) return;
        const n = d(z) || 1, vx = (z.x - e.x) / n, vz = (z.z - e.z) / n, y = t.yaw;
        sx = vx * Math.cos(y) - vz * Math.sin(y); sy = vx * Math.sin(y) + vz * Math.cos(y);
      };
      ev('pointerdown', cx, cy); await dorme(40);
      if (tieni) {
        const fine = performance.now() + tieni;
        do { verso(); ev('pointermove', cx + sx * 30, cy + sy * 30); await dorme(50); } while (performance.now() < fine);
        verso();
      }
      ev('pointerup', cx + (tieni ? sx * 30 : 0), cy + (tieni ? sy * 30 : 0));
    }, o);
    const uccisioni = async () => (await ctx.getState(page)).templari.uccisioni;
    // arco: il dito tiene teso e punta il lontano, lascia → la freccia parte lì
    let v = await duePosti('arco');
    await page.waitForSelector('#mzTplMira.on', { timeout: 8000 });
    assert(!(await page.isVisible('#btnA')), 'il bottone A è ancora visibile con il joystick di mira');
    let u0 = await uccisioni();
    await dito({ ...v.dito, tieni: 700 });
    await restaIlVicino(u0);
    // pistola: parte al rilascio, non al primo tocco
    v = await duePosti('pistola');
    u0 = await uccisioni();
    await dito({ ...v.dito, tieni: 400 });
    await restaIlVicino(u0);
    // un tocco veloce senza trascinare: colpo assistito, prende il più vicino
    await duePosti('pistola');
    u0 = await uccisioni();
    await dito({ sx: 0, sy: 0, tieni: 0 });
    await attendi(page, (s, u) => s.templari.uccisioni > u, 6000, 'il tocco non ha sparato', u0);
    const st = (await ctx.getState(page)).templari, d = st.zombiePos.map((z) => Math.hypot(z.x - st.eroe.x, z.z - st.eroe.z));
    assert(d.every((x) => x > 3.2), `il tocco assistito doveva prendere il più vicino: restano a ${d.map((x) => x.toFixed(1)).join(', ')} m`);
    await ctx.shot(page, 'joystick_mira');
    ctx.noErrors(p, 'telefono');
  });
  await ctx.test('telefono: pausa ferma tutto, ESCI → scheda dell’esito senza premio → di nuovo nel mondo', async () => {
    const st0 = await ctx.getState(page);
    if (!st0.templari.done) {
      await page.click('#mzTplPausaBtn');
      await ctx.waitState(page, (st) => st.templari.pausa === true, 5000);
      const t0 = (await ctx.getState(page)).templari.tick;
      await page.waitForTimeout(800);
      assert((await ctx.getState(page)).templari.tick === t0, 'la partita va avanti in pausa');
      await page.click('#mzTplPausa [data-act=esci]');
      await page.click('#mzTplPausa [data-act=esci]');
    }
    await ctx.waitState(page, (st) => !!st.templariEsito?.aperto, 20000);
    const e = (await ctx.getState(page)).templariEsito;
    assert(e.premio === null && e.ondata >= 1, `esito: ${JSON.stringify(e)}`);
    assert((await page.textContent('#mzTplEsito')).includes('link personale'), 'manca la riga «senza link niente premio»');
    await ctx.shot(page, 'esito');
    await page.click('#mzTplEsito [data-act=ok]');
    await ctx.waitState(page, (st) => !st.templari.active && !st.templari.busy, 10000);
    assert(await page.isVisible('#mzTop'), 'la barra in alto non è tornata');
    ctx.noErrors(p, 'telefono');
  });
  await ctx.test('telefono: lo scheletro sotto il faro della Tempesta, A prende il calice e si legge il biglietto', async () => {
    const r = await page.evaluate(() => window.__game.test.templariRelitto());
    assert(r && typeof r.x === 'number', 'scheletro non trovato sulla Tempesta');
    await ctx.waitState(page, (st) => st.templariRelitto?.near === true && st.templariRelitto.visibile === true, 10000);
    await page.waitForSelector('#mzTemplariCalice.on', { timeout: 10000 });
    assert((await page.textContent('#mzTemplariCalice')).includes('CALICE'), 'bottone del calice senza testo');
    await ctx.shot(page, 'scheletro_calice');
    await page.click('#mzTemplariCalice');
    await ctx.waitState(page, (st) => st.templariRelitto.calice === true && st.templariRelitto.biglietto === true, 8000);
    assert((await page.textContent('#mzBiglietto')).includes('La Rochelle'), 'biglietto senza la storia');
    await ctx.shot(page, 'biglietto');
    await page.click('#mzBiglietto [data-act=chiudi]');
    await ctx.waitState(page, (st) => st.templariRelitto.biglietto === false && st.templariRelitto.visibile === false, 5000);
    await page.waitForSelector('#mzTemplariCalice.on', { timeout: 8000 });
    assert((await page.textContent('#mzTemplariCalice')).includes('BIGLIETTO'), 'dopo: il bottone non rilegge il biglietto');
    ctx.noErrors(p, 'telefono');
  });

  // ---------------- PC ----------------
  const d = await ctx.open('?test=1&net=0&templari=1', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  const pc = d.page;
  await ctx.test('PC: dall’altare (non subito), F posa la reliquia, Esc apre la pausa, A MANO resta salvata', async () => {
    await pc.evaluate(() => window.__game.test.templariEntra(false, 'arciere'));
    await ctx.waitState(pc, (st) => st.templari.active && st.templari.fase === 'gioca', 30000);
    let st = await ctx.getState(pc);
    assert(st.templari.sim === 'altare' && st.templari.prompt === 'reliquia', `all'inizio: ${st.templari.sim}, prompt ${st.templari.prompt}`);
    await pc.waitForSelector('#mzTplAzione.on', { timeout: 20000 }).catch(() => { throw new Error('AZIONE non visibile vicino all’altare'); });
    await pc.keyboard.down('KeyF'); await pc.waitForTimeout(150); await pc.keyboard.up('KeyF');
    await ctx.waitState(pc, (s) => s.templari.sim === 'inizio' || s.templari.sim === 'combatti', 8000);
    await pc.keyboard.press('Escape');
    await ctx.waitState(pc, (s) => s.templari.pausa === true, 5000);
    assert(!(await pc.isVisible('#mzTplPausa [data-act=auto]')), 'il bottone della mira automatica c’è ancora');
    await ctx.shot(pc, 'pc_pausa');
    await pc.keyboard.press('Escape');
    await ctx.waitState(pc, (s) => s.templari.pausa === false, 5000);
    // da fermo l'eroe guarda il mouse: due punti opposti dello schermo, due direzioni opposte
    const box = await pc.locator('canvas').first().boundingBox();
    await pc.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.5); await pc.waitForTimeout(400);
    const f1 = (await ctx.getState(pc)).templari.faccia;
    await pc.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.5); await pc.waitForTimeout(400);
    const f2 = (await ctx.getState(pc)).templari.faccia;
    assert(f1[0] * f2[0] + f1[1] * f2[1] < -0.5, `l'eroe non segue il mouse: ${JSON.stringify([f1, f2])}`);
    await ctx.waitState(pc, (s) => s.templari.ondata === 1, 15000);
    await ctx.shot(pc, 'pc_ondata1');
  });
  await ctx.test('PC: mira col mouse — pistola e arco tirano sul bersaglio sotto il cursore, non sul più vicino; il cursore è un mirino', async () => {
    const prova = (o) => pc.evaluate((o) => window.__game.test.templariProva(o), o);
    /** Mette l'arma, l'eroe nel coro (pavimento libero per 4 m in ogni direzione) e i due zombie; dice dove sta il lontano. */
    const duePosti = async (arma) => {
      await prova({ pulisci: true, ferma: true, vita: 1e6, armi: [arma], dove: { x: 63.5, z: 42.5 }, ondata: 1 }); // zombie dell'ondata 1: un colpo li butta giù, anche se il pilota è arrivato più avanti
      await pc.waitForTimeout(300);
      await prova({ zombie: 'fante', dist: 2.5, lato: 0 });
      await prova({ zombie: 'fante', dist: 5, lato: 2.8 });
      await attendi(pc, (s) => s.templari.zombiePos.length === 2, 5000, 'zombie non comparsi');
      const st = (await ctx.getState(pc)).templari, d = (z) => Math.hypot(z.x - st.eroe.x, z.z - st.eroe.z);
      const [vicino, lontano] = [...st.zombiePos].sort((a, b) => d(a) - d(b));
      const dx = lontano.x - st.eroe.x, dz = lontano.z - st.eroe.z, n = d(lontano), y = st.yaw, vx = dx / n, vz = dz / n;
      return { lontano, dito: { sx: vx * Math.cos(y) - vz * Math.sin(y), sy: vx * Math.sin(y) + vz * Math.cos(y) } };
    };
    /** Cade il lontano, resta il vicino (che nel frattempo si è avvicinato). */
    const restaIlVicino = async () => {
      await attendi(pc, (s) => s.templari.zombiePos.length === 1, 6000, 'nessuno dei due è caduto');
      const st = (await ctx.getState(pc)).templari, z = st.zombiePos[0], dist = Math.hypot(z.x - st.eroe.x, z.z - st.eroe.z);
      assert(dist < 3.4, `è caduto il vicino, non quello puntato: resta uno a ${dist.toFixed(1)} m`);
    };
    for (const arma of ['pistola', 'arco']) {
      const v = await duePosti(arma);
      await pc.mouse.move(v.lontano.schermo[0], v.lontano.schermo[1]); await pc.waitForTimeout(150);
      await pc.mouse.down(); await pc.waitForTimeout(arma === 'arco' ? 700 : 80);
      const m = (await ctx.getState(pc)).templari.mira;
      await pc.mouse.up();
      assert(arma === 'pistola' || m > 0, `l'indice di mira non viaggia: ${m}`);
      await restaIlVicino();
      assert((await pc.evaluate(() => document.querySelector('canvas').style.cursor)) === 'crosshair', 'il cursore non è un mirino');
      ctx.log(arma, 'col mouse: caduto il bersaglio puntato, non il più vicino');
    }
    await ctx.shot(pc, 'pc_mira_mouse');
    ctx.noErrors(d, 'PC');
  });
  await ctx.test('PC: si vedono moschetto, scudato, scudo in mano e fuoco greco (hook di prova, solo resa)', async () => {
    const r = await pc.evaluate(() => window.__game.test.templariProva({ arma: 'moschetto', zombie: 'scudato', scudo: 'spalle' }));
    assert(r && r.arma === 'moschetto' && r.scudo, `prova: ${JSON.stringify(r)}`);
    await pc.evaluate(() => window.__game.test.setZoom(0.7));
    await pc.waitForTimeout(700);
    await ctx.shot(pc, 'pc_moschetto_scudato');
    await pc.keyboard.press('KeyQ'); await pc.keyboard.press('KeyQ');
    await ctx.waitState(pc, (st) => st.templari.scudo?.inMano === true, 5000);
    await pc.waitForTimeout(400);
    await ctx.shot(pc, 'pc_scudo_in_mano');
    await pc.evaluate(() => window.__game.test.templariProva({ arma: 'fuoco_greco', zombie: 'fante' }));
    await pc.keyboard.down('Space'); await pc.waitForTimeout(120); await pc.keyboard.up('Space');
    await ctx.waitState(pc, (st) => st.templari.effetti.fiamme > 0, 8000);
    await ctx.shot(pc, 'pc_fuoco_greco');
  });
  await ctx.test('PC: pirata, cannoniere, Templare a cavallo e de Molay (barra del boss), tutti insieme nel budget', async () => {
    // spada in mano (niente attacchi automatici): così i nemici restano interi per la foto
    await pc.evaluate(() => window.__game.test.templariProva({ arma: 'spada' }));
    const posti = [['pirata', 3, -2.2], ['cannoniere', 3.5, 2.2], ['cavaliere', 6, -1], ['molay', 5.5, 2.8]];
    for (const [t, dist, lato] of posti) await pc.evaluate(([t, dist, lato]) => window.__game.test.templariProva({ zombie: t, dist, lato }), [t, dist, lato]);
    await pc.evaluate(() => window.__game.test.setZoom(0.9));
    await ctx.waitState(pc, (st) => st.templari.zombie >= 4, 8000);
    await pc.waitForTimeout(2600); // escono da terra
    await ctx.shot(pc, 'pc_nemici_boss');
    assert(await pc.isVisible('#mzTpl .boss.on'), 'barra del boss assente');
    const perf = await ctx.getPerf(pc);
    ctx.log('perf coi boss', JSON.stringify(perf), JSON.stringify((await ctx.getState(pc)).templari.attori));
    assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls} > 100`);
    ctx.noErrors(d, 'PC');
  });
  await ctx.test('PC: F compra il portale (cartello col prezzo), la piazza si apre; la leva accende il rogo; i power-up a terra, Ira di Dio nel HUD', async () => {
    const prova = (o) => pc.evaluate((o) => window.__game.test.templariProva(o), o);
    await prova({ pulisci: true, vita: 1e6, punti: 3000, dove: { x: 37.5, z: 42.5 } });
    await ctx.waitState(pc, (st) => st.templari.prompt === 'porta', 5000);
    await ctx.shot(pc, 'pc_portale');
    await pc.keyboard.down('KeyF'); await pc.waitForTimeout(120); await pc.keyboard.up('KeyF');
    await ctx.waitState(pc, (st) => st.templari.porte?.portale === true, 5000);
    await prova({ dove: { x: 22.5, z: 44.5 } });
    await pc.waitForTimeout(600);
    await ctx.shot(pc, 'pc_piazza');
    const perf = await ctx.getPerf(pc);
    ctx.log('perf in piazza', JSON.stringify(perf), JSON.stringify((await ctx.getState(pc)).templari.scena));
    assert(perf.drawCalls <= 100, `draw call in piazza ${perf.drawCalls} > 100`);
    // il rogo è spento finché non si accende il fuoco del coro (§9b): la leva lo dice; F tenuto 1,5 s sul braciere lo accende
    await prova({ dove: { x: 63.5, z: 45.5 }, punti: 3000 });
    await ctx.waitState(pc, (st) => st.templari.prompt === 'trappola', 5000);
    await pc.waitForFunction(() => /SPENTO/.test(document.querySelector('#mzTplAzione.on')?.textContent ?? ''), null, { timeout: 5000 })
      .catch(async () => { throw new Error('la leva del rogo non dice che il fuoco è spento: ' + await pc.textContent('#mzTplAzione')); });
    await prova({ fuoco: 'coro' });
    await ctx.waitState(pc, (st) => st.templari.prompt === 'fuoco', 5000);
    await ctx.shot(pc, 'pc_fuoco_spento');
    await pc.keyboard.down('KeyF'); await pc.waitForTimeout(800);
    await pc.waitForFunction(() => !!document.querySelector('#mzTplAzione .lav'), null, { timeout: 3000 }).catch(() => { throw new Error('niente barra mentre si accende'); });
    await ctx.waitState(pc, (st) => st.templari.isola.fuochi.includes('coro'), 6000);
    await pc.keyboard.up('KeyF');
    await pc.waitForTimeout(500);
    await ctx.shot(pc, 'pc_fuoco_acceso');
    // la leva del rogo, accanto agli stalli del presbiterio
    await prova({ dove: { x: 63.5, z: 45.5 }, punti: 3000 });
    await ctx.waitState(pc, (st) => st.templari.prompt === 'trappola', 5000);
    await ctx.waitState(pc, (st) => !st.templari.isola.azioneTenuta, 5000);
    await pc.keyboard.down('KeyF'); await pc.waitForTimeout(120); await pc.keyboard.up('KeyF');
    await ctx.waitState(pc, (st) => (st.templari.trappole?.find((t) => t.id === 'rogo')?.accesa ?? 0) > 20, 5000);
    await pc.waitForTimeout(400);
    await ctx.shot(pc, 'pc_rogo');
    // power-up: uno davanti (per la foto), uno sotto i piedi (Ira di Dio)
    await prova({ dove: { x: 50.5, z: 40.5 }, potere: 'campane' });
    await pc.waitForTimeout(500);
    await ctx.shot(pc, 'pc_potere');
    await prova({ potereQui: 'ira' });
    await ctx.waitState(pc, (st) => (st.templari.poteri?.ira ?? 0) > 25, 5000);
    assert(await pc.isVisible('#mzTpl .pot span'), 'Ira di Dio non si vede nel HUD');
    await ctx.shot(pc, 'pc_ira');
    ctx.noErrors(d, 'PC');
  });
  await ctx.test('PC: la campana — a terra, i tre pezzi sparsi (F li prende), F tenuto alla leva la monta e si appende', async () => {
    const prova = (o) => pc.evaluate((o) => window.__game.test.templariProva(o), o);
    await prova({ pulisci: true, ferma: true, vita: 1e6, porte: ['portale', 'cimitero', 'taverna', 'spiaggia_taverna', 'sacrestia'] });
    // a terra (la foto dal passaggio) e la leva dice quanti pezzi mancano
    await prova({ dove: { x: 57.5, z: 33.5 } });
    await pc.waitForTimeout(600);
    await ctx.shot(pc, 'pc_campana_terra');
    await prova({ dove: { x: 59.5, z: 39.5 } });
    await ctx.waitState(pc, (st) => st.templari.prompt === 'monta', 5000);
    await pc.waitForFunction(() => /0\/3/.test(document.querySelector('#mzTplAzione.on')?.textContent ?? ''), null, { timeout: 5000 })
      .catch(async () => { throw new Error('la leva non conta i pezzi: ' + await pc.textContent('#mzTplAzione')); });
    for (const id of ['corda', 'battaglio', 'perno']) {
      await prova({ pezzo: id });
      await ctx.waitState(pc, (st) => st.templari.prompt === 'pezzo', 5000);
      if (id === 'corda') { await pc.waitForTimeout(300); await ctx.shot(pc, 'pc_pezzo'); }
      // prima un tick con AZIONE lasciata (il salto della prova arriva mentre la scena nuova blocca la pagina: due pressioni attaccate sono una)
      await ctx.waitState(pc, (st) => !st.templari.isola.azioneTenuta, 5000);
      await pc.keyboard.down('KeyF'); await pc.waitForTimeout(120); await pc.keyboard.up('KeyF');
      await ctx.waitState(pc, (st, id) => st.templari.isola.pezzi.includes(id), 5000, id)
        .catch(async () => { const t = (await ctx.getState(pc)).templari; throw new Error(`${id} non preso: ${JSON.stringify({ isola: t.isola, prompt: t.prompt, eroe: t.eroe, pausa: t.pausa, act: t.act, mouse: t.mouse })}`); });
    }
    await prova({ dove: { x: 59.5, z: 39.5 } });
    await ctx.waitState(pc, (st) => st.templari.prompt === 'monta', 5000);
    await ctx.waitState(pc, (st) => !st.templari.isola.azioneTenuta, 5000);
    await pc.keyboard.down('KeyF');
    await ctx.waitState(pc, (st) => st.templari.isola.campana === true, 6000);
    await pc.keyboard.up('KeyF');
    await prova({ dove: { x: 57.5, z: 33.5 } });
    await pc.waitForTimeout(600);
    await ctx.shot(pc, 'pc_campana_montata');
    ctx.noErrors(d, 'PC');
  });
  await ctx.test('PC: i segreti — il muro crepato regge al colpo normale e crolla al colpo caricato; giù nella cripta (buia, nel budget)', async () => {
    const prova = (o) => pc.evaluate((o) => window.__game.test.templariProva(o), o);
    await pc.evaluate(() => window.__game.test.setZoom(0.75));
    await prova({ pulisci: true, ferma: true, vita: 1e6, armi: ['spada'], alMuro: true });
    await pc.waitForTimeout(700);
    await ctx.shot(pc, 'pc_segreti_crepa');
    await ctx.waitState(pc, (st) => !st.templari.isola.azioneTenuta, 5000);
    await pc.keyboard.down('Space'); await pc.waitForTimeout(120); await pc.keyboard.up('Space');
    await ctx.waitState(pc, (st) => st.templari.act === 'swing', 8000);
    await ctx.waitState(pc, (st) => st.templari.act === 'idle', 8000); // a colpo finito (premere durante un fendente non conta)
    assert((await ctx.getState(pc)).templari.segreti.muro === false, 'il muro crolla con un colpo normale');
    // il colpo caricato: Spazio tenuto fino alla carica piena (contano i tick della partita, non i secondi: in prova il gioco va a pochi fps)
    await prova({ alMuro: true });
    await pc.keyboard.down('Space');
    await ctx.waitState(pc, (st) => st.templari.act === 'carica', 8000);
    const t0 = (await ctx.getState(pc)).templari.tick;
    await ctx.waitState(pc, (st, t0) => st.templari.tick >= t0 + 70, 20000, t0);
    await pc.keyboard.up('Space');
    await ctx.waitState(pc, (st) => st.templari.segreti.muro === true && st.templari.segreti.disegno?.rotto === true, 8000)
      .catch(async () => { const t = (await ctx.getState(pc)).templari; throw new Error(`il colpo caricato non rompe il muro: ${JSON.stringify({ seg: t.segreti, eroe: t.eroe, act: t.act, faccia: t.faccia })}`); });
    await prova({ dove: { x: 43.5, z: 36.5 } });
    await pc.waitForTimeout(700);
    await ctx.shot(pc, 'pc_segreti_muro_rotto');
    await prova({ cripta: true, anime: 3 });
    await ctx.waitState(pc, (st) => st.templari.segreti.dentro === true, 10000) // con la macchina carica scendere ha superato i 5 s (19 ott)
      .catch(async () => { const t = (await ctx.getState(pc)).templari; throw new Error(`non si entra nella cripta: ${JSON.stringify({ seg: t.segreti, eroe: t.eroe, piano: t.piano })}`); });
    await pc.waitForTimeout(900);
    await ctx.shot(pc, 'pc_cripta');
    const perf = await ctx.getPerf(pc);
    assert(perf.drawCalls <= 100, `draw call nella cripta ${perf.drawCalls} > 100`);
    ctx.noErrors(d, 'PC');
  });
  await ctx.test('PC: le anime nella cripta liberano la Lancia di Longino, F la prende dall’altare', async () => {
    const prova = (o) => pc.evaluate((o) => window.__game.test.templariProva(o), o);
    await prova({ pulisci: true, ferma: true, ondata: 1, anime: 4, altareCripta: true });
    await ctx.waitState(pc, (st) => st.templari.prompt === 'lancia', 5000);
    await pc.waitForFunction(() => [...document.querySelectorAll('#mzTplAzione')].some((e) => /4\/5/.test(e.textContent ?? '')), null, { timeout: 5000 })
      .catch(async () => { throw new Error('l’altare non conta le anime: ' + await pc.textContent('#mzTplAzione')); });
    await ctx.shot(pc, 'pc_altare_sigillato');
    // l'ultima anima: uno zombie davanti, nella cripta, colpito finché non muore
    await prova({ cripta: true, zombie: 'fante', dist: 1.5 });
    for (let k = 0; k < 8 && (await ctx.getState(pc)).templari.segreti.anime < 5; k++) {
      await ctx.waitState(pc, (st) => st.templari.act === 'idle', 8000);
      await pc.keyboard.down('Space'); await pc.waitForTimeout(120); await pc.keyboard.up('Space');
      await ctx.waitState(pc, (st) => st.templari.act !== 'idle' || st.templari.segreti.anime >= 5, 8000);
    }
    await ctx.waitState(pc, (st) => st.templari.segreti.anime >= 5 && st.templari.segreti.disegno?.libera === true, 5000);
    await prova({ altareCripta: true });
    await ctx.waitState(pc, (st) => st.templari.prompt === 'lancia', 5000);
    await ctx.waitState(pc, (st) => !st.templari.isola.azioneTenuta, 5000);
    await pc.keyboard.down('KeyF'); await pc.waitForTimeout(120); await pc.keyboard.up('KeyF');
    await ctx.waitState(pc, (st) => st.templari.eroe.arma === 'lancia', 5000);
    await pc.waitForTimeout(700);
    await ctx.shot(pc, 'pc_lancia');
    ctx.noErrors(d, 'PC');
  });
  await ctx.test('PC: le catacombe — F compra la grata della grotta, giù nei tunnel (buio, nel budget), la fucina fredda, su dall’ossario', async () => {
    const prova = (o) => pc.evaluate((o) => window.__game.test.templariProva(o), o);
    await prova({ pulisci: true, ferma: true, vita: 1e6, punti: 3000, porte: ['portale', 'taverna', 'spiaggia_taverna', 'cimitero'], grata: 'grata_grotta' });
    await ctx.waitState(pc, (st) => st.templari.prompt === 'porta', 5000);
    await pc.waitForTimeout(500);
    await ctx.shot(pc, 'pc_grata_grotta');
    await ctx.waitState(pc, (st) => !st.templari.isola.azioneTenuta, 5000);
    await pc.keyboard.down('KeyF'); await pc.waitForTimeout(120); await pc.keyboard.up('KeyF');
    await ctx.waitState(pc, (st) => st.templari.porte?.grata_grotta === true, 5000);
    // un passo sulla grata (la cella tra gli scogli accanto all'approdo): giù nelle catacombe
    await prova({ dove: { x: 61.5, z: 70.5 } });
    await ctx.waitState(pc, (st) => st.templari.segreti.dentro === true && st.templari.catacombe?.sotto === true, 8000)
      .catch(async () => { const t = (await ctx.getState(pc)).templari; throw new Error(`non è sceso dalla grata: ${JSON.stringify({ eroe: t.eroe, cat: t.catacombe })}`); });
    const cat = (await ctx.getState(pc)).templari.catacombe;
    assert(cat.nicchie >= 15 && cat.torce >= 8 && cat.fucina && cat.bocche === 2, `catacombe: ${JSON.stringify(cat)}`);
    await prova({ zombie: 'fante', dist: 2 });
    await pc.waitForTimeout(900);
    await ctx.shot(pc, 'pc_catacombe');
    let perf = await ctx.getPerf(pc);
    assert(perf.drawCalls <= 100, `draw call nelle catacombe ${perf.drawCalls} > 100`);
    await prova({ pulisci: true, fucina: true });
    await pc.waitForTimeout(900);
    await ctx.shot(pc, 'pc_fucina');
    perf = await ctx.getPerf(pc);
    assert(perf.drawCalls <= 100, `draw call alla fucina ${perf.drawCalls} > 100`);
    // su dall'ossario: la grata di sotto si compra anche da lì
    await prova({ tunnel: 'grata_ossario', punti: 3000 });
    await ctx.waitState(pc, (st) => st.templari.prompt === 'porta', 5000);
    await ctx.waitState(pc, (st) => !st.templari.isola.azioneTenuta, 5000);
    await pc.keyboard.down('KeyF'); await pc.waitForTimeout(120); await pc.keyboard.up('KeyF');
    await ctx.waitState(pc, (st) => st.templari.porte?.grata_ossario === true, 5000);
    await prova({ dove: { x: 8.5, z: 108.5 } });
    await ctx.waitState(pc, (st) => st.templari.segreti.dentro === false && st.templari.eroe.z < 20, 8000)
      .catch(async () => { const t = (await ctx.getState(pc)).templari; throw new Error(`non è salito all'ossario: ${JSON.stringify(t.eroe)}`); });
    await pc.waitForTimeout(700);
    await ctx.shot(pc, 'pc_ossario');
    ctx.noErrors(d, 'PC');
  });
  await ctx.test('PC: gli indizi — F apre il biglietto dello scheletro, Esc lo chiude; la scritta col sangue nella rotonda; in pausa si rilegge; la bussola', async () => {
    const prova = (o) => pc.evaluate((o) => window.__game.test.templariProva(o), o);
    await prova({ pulisci: true, ferma: true, vita: 1e6, scheletro: 'coro' });
    await ctx.waitState(pc, (st) => st.templari.prompt === 'biglietto', 5000);
    await ctx.waitState(pc, (st) => !st.templari.isola.azioneTenuta, 5000);
    await pc.keyboard.down('KeyF'); await pc.waitForTimeout(120); await pc.keyboard.up('KeyF');
    await ctx.waitState(pc, (st) => st.templari.biglietti.aperto === 'coro', 5000);
    const testo = await pc.textContent('#mzTplBiglietto');
    assert(testo.includes('tre fuochi') && testo.includes('Bertrand'), 'il biglietto del coro: ' + testo.slice(0, 120));
    await ctx.shot(pc, 'pc_biglietto_coro');
    // la bussola: una freccia verso il fuoco spento più vicino
    const gradi = await pc.getAttribute('#mzTplBussolaFuoco', 'data-gradi');
    assert(gradi !== null && gradi !== '', 'la bussola non punta a nessun fuoco: ' + gradi);
    await pc.keyboard.press('Escape');
    await ctx.waitState(pc, (st) => st.templari.biglietti.aperto === null && st.templari.pausa === false, 5000);
    // nella rotonda: lo scheletro di Arnaud e la scritta in mezzo al giro di colonne
    await prova({ scheletro: 'rotonda' });
    await ctx.waitState(pc, (st) => st.templari.prompt === 'biglietto', 5000);
    await pc.keyboard.down('KeyF'); await pc.waitForTimeout(120); await pc.keyboard.up('KeyF');
    await ctx.waitState(pc, (st) => st.templari.biglietti.aperto === 'rotonda', 5000);
    // andando via si chiude da solo (come il menù del Mercante)
    await prova({ dove: { x: 63.5, z: 42.5 } });
    await ctx.waitState(pc, (st) => st.templari.biglietti.aperto === null, 5000);
    await prova({ scheletro: 'rotonda' });
    await pc.waitForTimeout(900);
    await ctx.shot(pc, 'pc_scheletro_rotonda');
    // in pausa la lista dei biglietti trovati; uno si rilegge, Esc lo chiude e la pausa resta
    await pc.keyboard.press('Escape');
    await ctx.waitState(pc, (st) => st.templari.pausa === true, 5000);
    assert((await pc.locator('#mzTplLetti button').count()) === 2, 'in pausa non ci sono i due biglietti letti');
    await pc.click('#mzTplLetti [data-biglietto=coro]');
    await ctx.waitState(pc, (st) => st.templari.biglietti.aperto === 'coro', 5000);
    await ctx.shot(pc, 'pc_pausa_biglietti');
    await pc.keyboard.press('Escape');
    await ctx.waitState(pc, (st) => st.templari.biglietti.aperto === null && st.templari.pausa === true, 5000);
    await pc.keyboard.press('Escape');
    await ctx.waitState(pc, (st) => st.templari.pausa === false, 5000);
    const sc = (await ctx.getState(pc)).templari.scena;
    assert(sc.indizi === 10, 'scheletri e scritte in scena: ' + sc.indizi);
    ctx.noErrors(d, 'PC');
  });
  await ctx.test('PC: le campanelle nell’ordine scritto in taverna danno una pozione; i tre teschi fanno partire la canzone', async () => {
    const prova = (o) => pc.evaluate((o) => window.__game.test.templariProva(o), o);
    await prova({ pulisci: true, ferma: true, indizio: true });
    await pc.waitForTimeout(900);
    await ctx.shot(pc, 'pc_indizio');
    const st0 = (await ctx.getState(pc)).templari, ordine = st0.segreti.ordine, poz0 = st0.eroe.pozioni.length;
    assert(ordine.length === 4 && st0.segreti.disegno.indizio === ordine.join(), `indizio: ${JSON.stringify(st0.segreti)}`);
    for (const [k, id] of ordine.entries()) {
      await prova({ campanella: id });
      await ctx.waitState(pc, (st) => st.templari.prompt === 'campanella', 5000);
      if (k === 0) { await pc.waitForTimeout(500); await ctx.shot(pc, 'pc_campanella'); }
      await ctx.waitState(pc, (st) => !st.templari.isola.azioneTenuta, 5000);
      await pc.keyboard.down('KeyF'); await pc.waitForTimeout(120); await pc.keyboard.up('KeyF');
      await ctx.waitState(pc, (st, n) => st.templari.segreti.giuste === n || st.templari.segreti.campane, 5000, k + 1);
    }
    await ctx.waitState(pc, (st, n) => st.templari.segreti.campane === true && st.templari.eroe.pozioni.length === n + 1, 5000, poz0);
    for (const [k, t] of st0.segreti.teschi.entries()) {
      await prova({ pulisci: true, teschio: t.id });
      await ctx.waitState(pc, (st) => st.templari.prompt === 'teschio', 5000);
      if (k === 0) { await pc.waitForTimeout(500); await ctx.shot(pc, 'pc_teschio'); }
      await ctx.waitState(pc, (st) => !st.templari.isola.azioneTenuta, 5000);
      await pc.keyboard.down('KeyF');
      await ctx.waitState(pc, (st, id) => st.templari.segreti.teschi.find((x) => x.id === id)?.preso, 6000, t.id);
      await pc.keyboard.up('KeyF');
    }
    await ctx.waitState(pc, (st) => st.templari.segreti.inno === true, 5000);
    await pc.waitForTimeout(400);
    await ctx.shot(pc, 'pc_canzone');
    await pc.evaluate(() => window.__game.test.setZoom(1.05));
    ctx.noErrors(d, 'PC');
  });
  await ctx.test('PC: ambientazione — rotonda col tamburo e le croci, cimitero coi cipressi, borgo, l’accampamento stretto con la palizzata e la nave in secca', async () => {
    const prova = (o) => pc.evaluate((o) => window.__game.test.templariProva(o), o);
    const sc = (await ctx.getState(pc)).templari.scena;
    ctx.log('arredi', JSON.stringify(sc));
    assert(sc.croci >= 8 && sc.archi >= 4 && sc.cipressi >= 20 && sc.usci >= 4, `arredi mancanti: ${JSON.stringify(sc)}`);
    assert(sc.palizzata >= 40 && sc.navi === 1, `accampamento (§12b): palizzata ${sc.palizzata}, navi ${sc.navi}`);
    await pc.evaluate(() => window.__game.test.setZoom(1.3));
    await prova({ pulisci: true, vita: 1e6, porte: ['cimitero', 'taverna', 'spiaggia_taverna'] });
    const posti = [['rotonda', 47.5, 49.5], ['cimitero', 62.5, 14.5], ['borgo', 20.5, 47.5], ['taverna', 16.5, 68.5], ['accampamento', 58.5, 70.5], ['nave', 32.5, 67.5]];
    for (const [nome, x, z] of posti) {
      await prova({ pulisci: true, dove: { x, z } });
      await pc.waitForTimeout(900);
      await ctx.shot(pc, 'pc_luogo_' + nome);
      const perf = await ctx.getPerf(pc);
      assert(perf.drawCalls <= 100, `draw call ${nome} ${perf.drawCalls} > 100`);
    }
    ctx.noErrors(d, 'PC');
  });

  // ---------------- l'isola dipinta (TEMPLARI §3b) ----------------
  // a parte e nella stanza di prova: coi test il dipinto è spento (su SwiftShader il suo shader rallenta le prove a tempo), qui lo si chiede
  await p.close(); await d.close(); // due pagine di SwiftShader accese rallentano il caricamento del dipinto oltre il minuto
  const dp = await ctx.open('?test=1&net=0&templari=banco&dipinto=1');
  await ctx.test('telefono: l’isola è dipinta — dipinto piccolo caricato, ombre cotte per le luci ferme, cupo 1, draw call di prima', async () => {
    await ctx.waitState(dp.page, (s) => s.templari?.dipinto?.caricato === true, 60000);
    const d = (await ctx.getState(dp.page)).templari.dipinto;
    assert(d.acceso && d.ombre && d.cupo === 1, `dipinto: ${JSON.stringify(d)}`);
    assert(d.w === 2025 && d.h === 1535, `al telefono la profondità va a metà (2025×1535): ${d.w}×${d.h}`);
    assert(d.luci >= 8, `luci con l'ombra: ${d.luci}`);
    await dp.page.waitForTimeout(1500);
    await ctx.shot(dp.page, 'dipinto');
    const perf = await ctx.getPerf(dp.page);
    assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls} > 100`);
    ctx.noErrors(dp, 'dipinto');
  });
}
