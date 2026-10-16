// Banco di prova della Difesa a corsie alla Plants vs Zombies (provadifesa.html, #358; docs/DIFESA.md). Cosa si controlla:
// - la pagina si apre senza errori; senza parametri compare il menù dei livelli; con ?livello parte subito;
// - telefono in orizzontale (844×390) e PC (1280×720): la barra delle carte e la barra delle ondate non si coprono e stanno nello
//   schermo, il campo si vede tutto, disegnare un frame costa poco (meno di 30 ms: sui server di GitHub tutto è molto più lento);
// - si pianta toccando la carta e poi la casella (mouse e tocco) e trascinando la carta sulla casella; senza valuta la carta non va;
// - si raccoglie una moneta toccandola (la valuta sale di 25);
// - il pilota automatico vince il livello 1 e il livello 5; la schermata di vittoria ha il nuovo difensore e AVANTI;
// - chi non difende perde il livello 3: «HANNO SFONDATO!» e RIPROVA ricomincia;
// - col telefono in verticale compare «GIRA IL TELEFONO».
// Screenshot in tests/out/shots/m4_provadifesa_*, numeri in tests/out/m4_provadifesa.json.
import fs from 'node:fs';
import path from 'node:path';

export const timeout = 300000;
const TEL = { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PC = { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
const VERT = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

export default async function (ctx) {
  const { assert } = ctx;
  const numeri = {};
  const apri = async (qs, viewport) => {
    for (const x of ctx._pages.splice(0)) await x.close().catch(() => {});
    const p = await ctx.open('provadifesa.html' + qs, { viewport });
    try { await p.page.waitForFunction(() => window.__difesa && window.__difesa.ready === true, null, { timeout: 60000 }); } catch {
      throw new Error(`non pronta · errori ${p.errors.join(' | ')} · richieste fallite ${p.failed.join(' | ')}`);
    }
    return p;
  };
  const box = (page, sel) => page.evaluate((q) => Array.from(document.querySelectorAll(q)).filter((e) => getComputedStyle(e).display !== 'none').map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }), sel);
  const stato = (page) => page.evaluate(() => window.__difesa.state());

  let p = await apri('', PC);
  await ctx.test('pc: si apre senza errori col menù dei livelli', async () => {
    assert(p.errors.length === 0, p.errors.join('\n'));
    const st = await stato(p.page);
    assert(st.menu && !st.inGioco, `menù: ${JSON.stringify(st)}`);
    const liv = await box(p.page, '.df-liv');
    assert(liv.length === 6, `livelli: ${liv.length}`);
    await ctx.shot(p.page, 'pc_menu');
  });

  for (const [nome, vp] of [['telefono', TEL], ['pc', PC]]) {
    p = await apri('?livello=6&prova=1&seme=3', vp);
    await ctx.test(`${nome}: barre dentro lo schermo e che non si coprono, campo intero, frame veloce`, async () => {
      assert(p.errors.length === 0, p.errors.join('\n'));
      const [barra] = await box(p.page, '.df-barra'), [onda] = await box(p.page, '.df-onda'), [tasti] = await box(p.page, '.df-tasti');
      for (const b of [barra, onda, tasti]) assert(b[0] >= 0 && b[1] >= 0 && b[2] <= vp.width + 1 && b[3] <= vp.height + 1, `fuori dallo schermo: ${JSON.stringify(b)}`);
      assert(barra[2] <= tasti[0] || barra[3] <= tasti[1], `la barra copre i tasti: ${JSON.stringify([barra, tasti])}`);
      const a = await p.page.evaluate(() => window.__difesa.casella(0, 0)), z = await p.page.evaluate(() => window.__difesa.casella(8, 4));
      assert(a[0] > 0 && a[1] > barra[3] && z[0] < vp.width && z[1] < vp.height, `campo fuori: ${JSON.stringify([a, z])}`);
      const st = await p.page.evaluate(() => { const D = window.__difesa; D.set({ auto: 'bravo' }); D.avanti(60 * 120); D.set({ auto: null }); for (let i = 0; i < 20; i++) D.rendi(); return { st: D.state(), perf: D.perf() }; });
      numeri[nome] = st.perf;
      ctx.log(`${nome}: ${st.perf.sprite} sprite, ${st.perf.ms} ms a frame, ${st.st.unita} difensori, ${st.st.nemici} nemici`);
      assert(st.perf.ms < 30, `frame lento: ${st.perf.ms} ms`);
      assert(st.st.unita >= 8, `il pilota ha piantato: ${st.st.unita}`);
      await ctx.shot(p.page, `${nome}_livello6`);
    });
  }

  await ctx.test('telefono: carta e casella col tocco, carta trascinata sulla casella, senza valuta non pianta', async () => {
    p = await apri('?livello=4&prova=1&seme=5', TEL);
    const { page } = p;
    await page.evaluate(() => window.__difesa.set({ valuta: 1000 }));
    const carta = (await box(page, '.df-carta'))[0];
    await page.touchscreen.tap((carta[0] + carta[2]) / 2, (carta[1] + carta[3]) / 2);
    const c1 = await page.evaluate(() => window.__difesa.casella(2, 1));
    await page.touchscreen.tap(c1[0], c1[1]);
    await page.evaluate(() => window.__difesa.avanti(1));
    let st = await stato(page);
    assert(st.unita === 1, `piantato col tocco: ${st.unita}`);
    // trascinata: la seconda carta (produttore) sulla casella (0, 3)
    const c2 = (await box(page, '.df-carta'))[1], d = await page.evaluate(() => window.__difesa.casella(0, 3));
    await page.mouse.move((c2[0] + c2[2]) / 2, (c2[1] + c2[3]) / 2); await page.mouse.down();
    await page.mouse.move(d[0], d[1], { steps: 8 }); await page.mouse.up();
    await page.evaluate(() => window.__difesa.avanti(1));
    st = await stato(page);
    assert(st.unita === 2, `piantato trascinando: ${st.unita}`);
    await page.evaluate(() => window.__difesa.set({ valuta: 0 }));
    const c3 = await page.evaluate(() => window.__difesa.casella(3, 2));
    await page.touchscreen.tap((carta[0] + carta[2]) / 2, (carta[1] + carta[3]) / 2);
    await page.touchscreen.tap(c3[0], c3[1]);
    await page.evaluate(() => window.__difesa.avanti(1));
    st = await stato(page);
    assert(st.unita === 2, `senza valuta non pianta: ${st.unita}`);
    assert(p.errors.length === 0, p.errors.join('\n'));
  });

  await ctx.test('pc: col mouse si pianta e si raccoglie una moneta (+25)', async () => {
    p = await apri('?livello=2&prova=1&seme=8', PC);
    const { page } = p;
    await page.evaluate(() => window.__difesa.set({ valuta: 100 }));
    const carta = (await box(page, '.df-carta'))[0], c = await page.evaluate(() => window.__difesa.casella(1, 2));
    await page.mouse.click((carta[0] + carta[2]) / 2, (carta[1] + carta[3]) / 2);
    await page.mouse.click(c[0], c[1]);
    await page.evaluate(() => window.__difesa.avanti(1));
    assert((await stato(page)).unita === 1, 'piantato col mouse');
    // aspetta una moneta dal cielo a terra e la tocca
    const m = await page.evaluate(() => { const D = window.__difesa; for (let i = 0; i < 60 * 20; i++) { D.avanti(1); const s = D.partita(); const mm = s.monete.find((x) => s.tick >= x.atterra); if (mm) return { id: mm.id, v: s.valuta }; } return null; });
    assert(m, 'è caduta una moneta');
    await page.evaluate(() => window.__difesa.rendi());
    const dove = await page.evaluate((id) => window.__difesa.moneta(id), m.id);
    await page.mouse.click(dove[0], dove[1]);
    await page.evaluate(() => window.__difesa.avanti(1));
    const st = await stato(page);
    assert(st.valuta === m.v + 25, `valuta ${m.v} → ${st.valuta}`);
    await ctx.shot(page, 'pc_moneta');
  });

  await ctx.test('pc: il pilota automatico vince il livello 1 e il 5, con la schermata di vittoria', async () => {
    for (const lv of [1, 5]) {
      p = await apri(`?livello=${lv}&prova=1&seme=${lv + 10}`, PC);
      const st = await p.page.evaluate(() => { const D = window.__difesa; D.set({ auto: 'bravo' }); return D.avanti(60 * 60 * 12); });
      numeri[`livello${lv}`] = { esito: st.esito, minuti: Math.round(st.tick / 360) / 10, tosaerba: st.tosaerba, uccisi: st.uccisi };
      assert(st.esito === 'vinta', `livello ${lv}: ${st.esito} all'ondata ${st.ondata}`);
      await p.page.waitForSelector('.df-velo.su .df-pan h1', { timeout: 5000 });
      const testo = await p.page.textContent('.df-velo.su .df-pan');
      assert(/DIFESA RIUSCITA/.test(testo ?? '') && /AVANTI/.test(testo ?? ''), testo ?? '');
      assert(/NUOVO DIFENSORE/.test(testo ?? ''), 'il premio: nuovo difensore');
      await ctx.shot(p.page, `pc_vinta_livello${lv}`);
    }
  });

  await ctx.test('pc: chi non difende perde il livello 3; RIPROVA ricomincia', async () => {
    p = await apri('?livello=3&prova=1&seme=2', PC);
    const st = await p.page.evaluate(() => window.__difesa.avanti(60 * 60 * 10));
    assert(st.esito === 'persa', `esito: ${st.esito}`);
    await p.page.waitForSelector('.df-velo.su .df-pan h1', { timeout: 5000 });
    assert(/HANNO SFONDATO/.test((await p.page.textContent('.df-velo.su .df-pan')) ?? ''));
    await ctx.shot(p.page, 'pc_persa');
    await p.page.click('.df-velo.su button:has-text("RIPROVA")');
    const st2 = await stato(p.page);
    assert(st2.esito === '' && st2.tick < 5 && st2.livello === 2, `RIPROVA: ${JSON.stringify(st2)}`);
  });

  await ctx.test('telefono in verticale: «GIRA IL TELEFONO»', async () => {
    p = await apri('?livello=1', VERT);
    const g = await box(p.page, '.df-gira.su');
    assert(g.length === 1, 'manca il cartello');
    await ctx.shot(p.page, 'verticale');
  });

  fs.writeFileSync(path.join(ctx.OUT, 'm4_provadifesa.json'), JSON.stringify(numeri, null, 1) + '\n');
}
