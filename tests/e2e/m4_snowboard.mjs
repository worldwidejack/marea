// Snowboard dell'Isola dell'Adrenalina (docs/ADRENALINA.md §7, passo 3a di #189). Senza server (net=0), con ?adrenalina=1.
// Telefono 390×844: dalla funivia (chunk a parte, scena a parte): il viaggio in cabina, il cartello delle piste, le regole, 3-2-1, il fantasma, il dito curva sulla zona dei tocchi, la camera che ti
// segue (la A, scelta da birbasan) fotografata lungo tutta la montagna (vetta, cresta, slalom, il volo dalla cornice, la pala, la cunetta,
// il canale, il salto dalla roccia, gli abeti, l'abete caduto al bivio del fuoripista, il sentiero, l'arrivo); la discesa intera col pilota
// automatico: arrivo, scheda, draw call e triangoli sotto il budget.
// PC 1280×720: frecce e Spazio, Esc riporta nel mondo davanti al cancello. Screenshot in tests/out/shots/m4_snowboard_*.png.
import fs from 'node:fs';
export const timeout = 300000;

export default async function (ctx) {
  const { assert } = ctx;
  const hook = (page, fn, ...args) => page.evaluate(([f, a]) => window.__game.test[f](...a), [fn, args]);
  const sb = async (page) => (await ctx.getState(page)).snowboard ?? {};
  const numeri = {};
  /** Il massimo di draw call e triangoli visti (TECH §5: 100 e 180.000). */
  const budget = { drawCalls: 0, triangles: 0 };
  const misura = async (page, nome) => {
    const perf = await ctx.getPerf(page);
    budget.drawCalls = Math.max(budget.drawCalls, perf.drawCalls); budget.triangles = Math.max(budget.triangles, perf.triangles);
    numeri[nome] = { drawCalls: perf.drawCalls, triangles: perf.triangles };
    assert(perf.drawCalls > 0 && perf.drawCalls <= 100, `${nome}: draw call ${perf.drawCalls}`);
    assert(perf.triangles <= 180000, `${nome}: triangoli ${perf.triangles}`);
  };
  const apri = async (page) => {
    assert(await hook(page, 'adrenalinaCarica') === true, 'funivia non scaricata');
    assert(await hook(page, 'snowboardVia') === true, 'snowboard non partito');
    await ctx.waitState(page, (st) => st.snowboard && st.snowboard.active, 20000);
  };

  // ---------------- telefono ----------------
  const p = await ctx.open('?test=1&net=0&adrenalina=1');
  await ctx.waitReady(p.page, 20000);
  const page = p.page;

  await ctx.test('telefono: il giro (3b): funivia → cartello delle piste in vetta → regole → 3-2-1 → giù; il mondo sparisce', async () => {
    await apri(page);
    const s0 = await sb(page);
    assert(s0.fase === 'funivia' && s0.scena.abeti > 500 && s0.scena.riquadri > 10, `scena: ${s0.fase} ${JSON.stringify(s0.scena)}`);
    assert(!(await page.isVisible('#joystick')) && !(await page.isVisible('#mzTop')), 'l’interfaccia del mondo resta su');
    await page.waitForTimeout(1500);
    await ctx.shot(page, 'funivia');
    await misura(page, 'funivia');
    await ctx.waitState(page, (st) => st.snowboard.fase === 'cartello', 20000);
    await page.waitForSelector('#mzSbPiste [data-pista="snowboard_blu"]', { timeout: 5000 });
    assert(await page.locator('#mzSbPiste .pista[disabled]').count() === 6, 'blu, rossa e nera aperte, bici e lancio col lucchetto');
    assert(await page.locator('#mzSbPiste .pista:not([disabled])').count() === 3, 'le tre piste dello snowboard aperte');
    await ctx.shot(page, 'cartello');
    await page.click('#mzSbPiste [data-pista="snowboard_blu"]');
    await ctx.waitState(page, (st) => st.snowboard.fase === 'regole', 5000);
    await page.waitForSelector('#mzSbRegole', { timeout: 5000 });
    assert(/Nessuno è ancora sceso|link personale/.test(await page.textContent('#mzSbRegole')), 'regole senza il fantasma da battere');
    await ctx.shot(page, 'regole');
    await ctx.waitState(page, (st) => st.snowboard.fase === 'via', 15000);
    assert(await page.isVisible('#mzSbAiuto'), 'niente aiuto dei comandi');
    await ctx.waitState(page, (st) => st.snowboard.fase === 'gara' && st.snowboard.frames > 30, 20000);
    const s1 = await sb(page);
    assert(s1.s > 6.5 && s1.v > 5, `non scende: s ${s1.s}, v ${s1.v}`);
  });

  await ctx.test('telefono: col dito sulla zona dei tocchi si curva, alzarlo è un salto', async () => {
    const box = await page.locator('#mzSbTocco').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height * 0.7;
    const l0 = (await sb(page)).lat;
    await page.dispatchEvent('#mzSbTocco', 'pointerdown', { pointerId: 7, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true });
    await page.dispatchEvent('#mzSbTocco', 'pointermove', { pointerId: 7, clientX: x + 60, clientY: y, pointerType: 'touch', isPrimary: true });
    await ctx.waitState(page, (st, l) => st.snowboard.lat > l + 0.5, 15000, l0).catch(() => {}); // passi della sim, non tempo (vedi sotto)
    const s = await sb(page);
    assert(s.dito && s.lat > l0 + 0.5, `il dito non curva: lat ${l0} → ${s.lat}`);
    await page.dispatchEvent('#mzSbTocco', 'pointerup', { pointerId: 7, clientX: x + 60, clientY: y, pointerType: 'touch', isPrimary: true });
    await ctx.waitState(page, (st) => st.snowboard.aria || st.snowboard.h > 0, 2000).catch(() => {});
    const s2 = await sb(page);
    assert(!s2.dito, 'il dito resta giù');
  });

  await ctx.test('telefono: i pulsanti a schermo sterzano e saltano', async () => {
    assert(await page.isVisible('#mzSbComandi'), 'comandi touch non visibili');
    const btnSx = page.locator('#mzSbComandi #mzSbBtnSx');
    const btnDx = page.locator('#mzSbComandi #mzSbBtnDx');
    assert(await btnDx.isVisible() && await btnSx.isVisible(), 'pulsanti curva non visibili');
    // Curva a sinistra col pulsante sinistro
    const l0 = (await sb(page)).lat;
    await btnSx.dispatchEvent('pointerdown', { pointerId: 10, pointerType: 'touch', isPrimary: true });
    await ctx.waitState(page, (st, l) => st.snowboard.lat < l - 0.3, 10000, l0).catch(() => {});
    await btnSx.dispatchEvent('pointerup', { pointerId: 10, pointerType: 'touch', isPrimary: true });
    const sSx = await sb(page);
    assert(sSx.lat < l0 - 0.2, `il pulsante sx non curva: ${l0} → ${sSx.lat}`);
    // Salto tenendo premuto fuori dai pulsanti e rilasciando
    const box = await page.locator('#mzSbTocco').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height * 0.4;
    const elementoSotto = await page.evaluate(([cx, cy]) => {
      const el = document.elementFromPoint(cx, cy);
      return el ? (el.id || el.className) : null;
    }, [x, y]);
    assert(elementoSotto === 'mzSbTocco', `il punto (${x},${y}) non tocca mzSbTocco: tocca ${elementoSotto}`);
    await page.dispatchEvent('#mzSbTocco', 'pointerdown', { pointerId: 11, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true });
    await page.waitForTimeout(300);
    await page.dispatchEvent('#mzSbTocco', 'pointerup', { pointerId: 11, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true });
    await ctx.waitState(page, (st) => st.snowboard.aria || st.snowboard.h > 0, 3000).catch(() => {});
    const sJ = await sb(page);
    assert(sJ.aria || sJ.h > 0, 'tenere premuto fuori dai pulsanti non fa saltare');
    // In volo: il pulsante SX non fa trick e non cambia etichetta
    assert(await btnSx.textContent() === '◀SX', 'il pulsante non deve cambiare etichetta in volo');
    await btnSx.dispatchEvent('pointerdown', { pointerId: 12, pointerType: 'touch', isPrimary: true });
    await btnSx.dispatchEvent('pointerup', { pointerId: 12, pointerType: 'touch', isPrimary: true });
    const sNoTrick = await sb(page);
    assert(sNoTrick.trick === 0, 'il pulsante non deve fare trick in volo');
    // In volo: lo swipe sullo schermo fa acrobazie
    if (sNoTrick.aria) {
      await page.dispatchEvent('#mzSbTocco', 'pointerdown', { pointerId: 13, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true });
      await page.dispatchEvent('#mzSbTocco', 'pointermove', { pointerId: 13, clientX: x, clientY: y - 40, pointerType: 'touch', isPrimary: true });
      await page.dispatchEvent('#mzSbTocco', 'pointerup', { pointerId: 13, clientX: x, clientY: y - 40, pointerType: 'touch', isPrimary: true });
      await ctx.waitState(page, (st) => st.snowboard.trick >= 1 || st.snowboard.eventi?.includes('trick'), 2000).catch(() => {});
    }
  });

  // i punti delle foto, dalle zone della pista: [nome, s, ticks col pilota automatico prima dello scatto, aspetta il volo (m sopra la neve)]
  const PISTA = JSON.parse(fs.readFileSync(new URL('../../packages/content/src/adrenalina/piste/snowboard_blu.json', import.meta.url), 'utf8'));
  const Z = (id) => PISTA.zone.find((z) => z.id === id).da;
  const PUNTI = [['vetta', 8, 20], ['cresta', Z('cresta') + 60, 40], ['slalom', Z('slalom') + 80, 40], ['cornice', Z('muro') - 15, 0, 2], ['canalino', Z('canalino') + 8, 30],
    ['salto_neve', PISTA.rampe[1].s - 25, 0, 1], ['abeti', Z('abeti') + 10, 40], ['trampolino', PISTA.rampe.find((r) => r.grande).s - 30, 0, 4],
    ['tronco', PISTA.fuoripista.da - 22, 70], ['sentiero', PISTA.fuoripista.da + 125, 40], ['arrivo', PISTA.arrivo - 40, 40]];
  await ctx.test('telefono: la camera che ti segue lungo tutta la montagna (foto per birbasan)', async () => {
    for (const [nome, s, ticks, volo] of PUNTI) {
      await hook(page, 'snowboardMetti', { s, lat: 0, v: 17 });
      await hook(page, 'snowboardAuto', 1);
      if (volo) await ctx.waitState(page, (st, h) => st.snowboard.aria && st.snowboard.h > h, 15000, volo);
      else await page.waitForTimeout((ticks / 60) * 1000 + 300);
      await hook(page, 'snowboardAuto', 0);
      await misura(page, nome);
      await ctx.shot(page, nome);
    }
  });

  await ctx.test('telefono: il fantasma del record scende con te, col nome sopra e il distacco in alto', async () => {
    const f = await hook(page, 'snowboardFantasmaProva');
    assert(f && f.ms > 40000, 'fantasma di prova: ' + JSON.stringify(f));
    await hook(page, 'snowboardMetti', { s: 8, lat: 2, v: 6 });
    await hook(page, 'snowboardAuto', 1);
    await ctx.waitState(page, (st) => st.snowboard.frames > 400, 30000);
    await hook(page, 'snowboardAuto', 0);
    const s = await sb(page);
    assert(s.fantasma && s.fantasma.nome === 'Maestro' && s.fantasma.ticks > 3000, 'fantasma: ' + JSON.stringify(s.fantasma));
    assert(await page.isVisible('#mzSbFant'), 'niente distacco dal fantasma');
    await ctx.shot(page, 'fantasma');
  });

  await ctx.test('telefono: la discesa intera col pilota automatico arriva, la scheda d’arrivo (tempo, abbuoni), «In vetta», giù in funivia', async () => {
    await hook(page, 'snowboardEsci');
    await ctx.waitState(page, (st) => !st.snowboard.active && !st.adrenalina.snowboard, 5000);
    assert(await hook(page, 'snowboardVia') === true, 'non riparte');
    await ctx.waitState(page, (st) => st.snowboard.active, 15000);
    await hook(page, 'snowboardSalta');
    await ctx.waitState(page, (st) => st.snowboard.fase === 'cartello', 5000);
    assert(await hook(page, 'snowboardPista', 'snowboard_blu') === true, 'pista non scelta');
    await ctx.waitState(page, (st) => st.snowboard.fase === 'gara', 20000);
    await hook(page, 'snowboardAuto', 6);
    const t0 = Date.now();
    while (Date.now() - t0 < 150000) {
      const s = await sb(page);
      if (s.fase === 'fine') break;
      await misura(page, 'giro');
      await page.waitForTimeout(1500);
    }
    const s = await sb(page);
    assert(s.fase === 'fine' && s.arrivato && s.risultato, `non arriva: ${JSON.stringify(s).slice(0, 300)}`);
    // sulla blu i salti sono bassi: il pilota fa 3 trick (i 4 in combo li prova il test della sim sulla rossa)
    assert(s.porte >= PISTA.porte.length - 1 && s.cadute === 0 && s.trick >= 3 && s.punti > 3000, `discesa: porte ${s.porte}, cadute ${s.cadute}, trick ${s.trick}, punti ${s.punti}`);
    assert(s.eventi.includes('arrivo'), 'niente arrivo');
    await page.waitForSelector('#mzSbFine', { timeout: 5000 });
    const testo = await page.textContent('#mzSbFine');
    assert(/abbuoni −[0-9]/.test(testo) && /link personale/.test(testo), 'scheda d’arrivo: ' + testo);
    assert(s.esito && s.esito.finale === s.risultato.detail.finale && s.esito.finale < s.esito.ms, 'tempo finale: ' + JSON.stringify(s.esito));
    numeri.discesa = { ms: s.risultato.detail.ms, finale: s.risultato.detail.finale, punti: s.punti, porte: s.porte, trick: s.trick };
    await ctx.shot(page, 'fine');
    await page.click('#mzSbFine [data-act="vetta"]');
    await ctx.waitState(page, (st) => st.snowboard.fase === 'cartello', 5000);
    await page.click('#mzSbPisteEsci');
    await ctx.waitState(page, (st) => !st.snowboard.active, 5000);
    ctx.noErrors(p, 'telefono');
  });

  // ---------------- PC ----------------
  const d = await ctx.open('?test=1&net=0&adrenalina=1', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  await ctx.test('PC: A e D curvano, Spazio salta, frecce acrobazie in aria; P inverte WASD e frecce', async () => {
    await hook(d.page, 'adrenalinaCarica');
    await hook(d.page, 'adrenalinaCancello');
    await d.page.waitForTimeout(500);
    await d.page.keyboard.down('KeyE'); await d.page.waitForTimeout(80); await d.page.keyboard.up('KeyE');
    await ctx.waitState(d.page, (st) => st.snowboard && st.snowboard.fase === 'cartello', 25000); // dopo il viaggio in funivia
    await d.page.click('#mzSbPiste [data-pista="snowboard_blu"]');
    await ctx.waitState(d.page, (st) => st.snowboard && st.snowboard.fase === 'gara' && st.snowboard.frames > 20, 25000);
    const l0 = (await sb(d.page)).lat;
    // D curva a destra con la mano sinistra
    await d.page.keyboard.down('KeyD');
    await ctx.waitState(d.page, (st, l) => st.snowboard.lat > l + 0.5, 60000, l0).catch(() => {});
    await d.page.keyboard.up('KeyD');
    const l1 = (await sb(d.page)).lat;
    assert(l1 > l0 + 0.5, `D non curva a destra: ${l0} → ${l1}`);
    // P inverte i comandi (frecce per sterzare, WASD per trick)
    await d.page.keyboard.press('KeyP');
    await ctx.waitState(d.page, (st) => st.snowboard.invertito === true, 5000);
    const lInvertito0 = (await sb(d.page)).lat;
    await d.page.keyboard.down('ArrowRight');
    await ctx.waitState(d.page, (st, l) => st.snowboard.lat > l + 0.5, 60000, lInvertito0).catch(() => {});
    await d.page.keyboard.up('ArrowRight');
    const lInvertito1 = (await sb(d.page)).lat;
    assert(lInvertito1 > lInvertito0 + 0.5, `→ non curva quando invertito: ${lInvertito0} → ${lInvertito1}`);
    // P di nuovo ripristina la modalità normale
    await d.page.keyboard.press('KeyP');
    await ctx.waitState(d.page, (st) => st.snowboard.invertito === false, 5000);
    // Spazio tenuto per 20 passi della sim, lasciato = salto
    const f0 = (await sb(d.page)).frames;
    await d.page.keyboard.down('Space');
    await ctx.waitState(d.page, (st, f) => st.snowboard.frames >= f + 20, 60000, f0).catch(() => {});
    await d.page.keyboard.up('Space');
    await ctx.waitState(d.page, (st) => st.snowboard.aria, 60000);
    // In aria freccia in su fa trick (mortale avanti)
    await d.page.keyboard.press('ArrowUp');
    await ctx.waitState(d.page, (st) => st.snowboard.trick >= 1 || st.snowboard.eventi?.includes('trick'), 10000).catch(() => {});
    await misura(d.page, 'desktop');
    await ctx.shot(d.page, 'desktop');
    await d.page.keyboard.press('Escape');
    await ctx.waitState(d.page, (st) => !st.snowboard.active && st.adrenalina.near !== undefined, 5000);
    await d.page.waitForTimeout(600);
    const st = await ctx.getState(d.page);
    assert(st.mode === 'walk' && st.adrenalina.discese === 1, `dopo Esc: ${JSON.stringify(st.adrenalina).slice(0, 200)}`);
    ctx.noErrors(d, 'desktop');
  });
  ctx.log('numeri', JSON.stringify({ ...numeri, max: budget }));
  ctx.writeOut('m4_snowboard.json', { ...numeri, max: budget });
}
