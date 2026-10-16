// Banco di prova dello sparatutto a missioni (provasparo.html, #355; docs/SPARO.md). Cosa si controlla:
// - la pagina si apre senza errori; si montano il piazzale (container, gru, casse, barriere, barca) e i soldati (io + 9);
// - telefono in orizzontale (844×390) e PC (1280×720): in prima persona, in terza e dall'alto ≤ 100 draw call e ≤ 150.000 triangoli;
// - poligono: il pilota automatico abbatte i 6 bersagli con più di metà dei colpi a segno;
// - Missione 0: il pilota automatico (immortale) elimina le sentinelle, sabota la gru coi rinforzi in arrivo e raggiunge la barca;
//   la schermata finale mostra la medaglia e RIGIOCA ricomincia;
// - da PC: 2 e 3 cambiano arma, R ricarica, V passa in terza persona, H in HD;
// - dal telefono: i bottoni a tocco ci sono e non si coprono; trascinare a destra gira la visuale; lo sparo automatico spara quando il
//   mirino è su un nemico.
// Screenshot in tests/out/shots/m4_provasparo_*, numeri in tests/out/m4_provasparo.json.
import fs from 'node:fs';
import path from 'node:path';

export const timeout = 300000;
const MAX_DC = 100, MAX_TRI = 150000;
const TEL = { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PC = { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false, hasTouch: false };

export default async function (ctx) {
  const { assert } = ctx;
  const numeri = {};
  const apri = async (q, viewport) => {
    for (const x of ctx._pages.splice(0)) await x.close().catch(() => {});
    const p = await ctx.open('provasparo.html?prova=1&seme=5&' + q, { viewport });
    try { await p.page.waitForFunction(() => window.__sparo && window.__sparo.ready === true, null, { timeout: 60000 }); } catch {
      const st = await p.page.evaluate(() => (window.__sparo ? window.__sparo.state() : null));
      throw new Error(`non pronta: ${JSON.stringify(st)} · errori ${p.errors.join(' | ')} · richieste fallite ${p.failed.join(' | ')}`);
    }
    return p;
  };
  // in pausa, con gli effetti fermi: la foto è quella del frame disegnato subito
  const foto = async (page, nome, o) => {
    await page.evaluate((x) => { const S = window.__sparo; S.set({ ...x, pausa: true }); for (let i = 0; i < 8; i++) S.rendi(0.1); }, o);
    const perf = await page.evaluate(() => window.__sparo.perf());
    await ctx.shot(page, nome);
    return perf;
  };
  const fotogrammi = (page, n = 3) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const box = (page, sel) => page.evaluate((q) => Array.from(document.querySelectorAll(q)).filter((e) => getComputedStyle(e).display !== 'none').map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }), sel);

  let p = null;
  for (const [nome, vp] of [['telefono', TEL], ['pc', PC]]) {
    p = await apri('cam=prima', vp);
    await ctx.test(`${nome}: si apre senza errori, piazzale e soldati montati`, async () => {
      assert(p.errors.length === 0, p.errors.join('\n'));
      const st = await p.page.evaluate(() => window.__sparo.state());
      assert(st.pezzi >= 60, `pezzi del piazzale: ${st.pezzi}`);
      assert(st.soldati === 9 && st.io, `soldati: ${st.soldati}, io: ${st.io}`);
      assert(st.modo === 'missione' && st.obiettivo === 0, `di serie la Missione 0: ${st.modo} ${st.obiettivo}`);
      assert(st.tocco === (nome === 'telefono'), `comandi a tocco: ${st.tocco}`);
    });
    await ctx.test(`${nome}: in prima, in terza e dall'alto ≤ ${MAX_DC} draw call e ≤ ${MAX_TRI} triangoli`, async () => {
      for (const [cam, x, z, yaw] of [['prima', 21, 20.5, 0], ['terza', 14, 36.5, -0.6], ['alto', 5, 5.5, 0]]) {
        const perf = await foto(p.page, `${nome}_${cam}`, { cam, x, z, yaw, pitch: -0.05 });
        numeri[`${nome}_${cam}`] = perf;
        ctx.log(`${nome} ${cam}: ${perf.calls} draw call, ${perf.tris} triangoli`);
        assert(perf.calls <= MAX_DC, `${cam}: ${perf.calls} draw call`);
        assert(perf.tris <= MAX_TRI, `${cam}: ${perf.tris} triangoli`);
      }
    });
    if (nome === 'telefono') {
      await ctx.test('telefono: bottoni a tocco che non si coprono, trascinare gira la visuale, sparo automatico sul nemico', async () => {
        const b = await box(p.page, '.st-b');
        assert(b.length >= 6, `bottoni: ${b.length}`);
        for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) { const [a, c] = [b[i], b[j]]; assert(a[2] <= c[0] || c[2] <= a[0] || a[3] <= c[1] || c[3] <= a[1], `si coprono: ${JSON.stringify([a, c])}`); }
        await p.page.evaluate(() => window.__sparo.set({ pausa: false, cam: 'prima', x: 21, z: 20.5, yaw: 0, pitch: 0 }));
        const y0 = (await p.page.evaluate(() => window.__sparo.state())).yaw;
        await p.page.mouse.move(560, 200); await p.page.mouse.down(); await p.page.mouse.move(500, 200, { steps: 6 }); await p.page.mouse.up();
        await fotogrammi(p.page, 4);
        const y1 = (await p.page.evaluate(() => window.__sparo.state())).yaw;
        assert(y1 > y0 + 0.1, `trascinando verso sinistra si gira a sinistra: ${y0} → ${y1}`);
        // un nemico proprio davanti al mirino: lo sparo automatico spara da solo
        const spari = await p.page.evaluate(async () => {
          const S = window.__sparo, s = S.partita(), b = s.bot[0];
          // corridoio libero a ovest della gru (z 28,5): tu a ovest, lui 7 m a est
          S.set({ x: 6.5, z: 28.5, yaw: -Math.PI / 2, pitch: -0.07 });
          b.x = 13.5; b.z = 28.5; b.stato = 'fermo'; b.vita = 100; b.morto = 0;
          s.bot.slice(1).forEach((o) => { o.vita = 0; o.morto = 1; });
          const prima = s.g.sparati;
          await new Promise((r) => { let i = 0; const f = () => (++i >= 30 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
          return s.g.sparati - prima;
        });
        assert(spari > 0, `sparo automatico: ${spari} colpi`);
        await ctx.shot(p.page, 'telefono_tocco');
        assert(p.errors.length === 0, p.errors.join('\n'));
      });
    }
  }
  await ctx.test('pc: Missione 0 — il pilota automatico la finisce, schermata con la medaglia, RIGIOCA ricomincia', async () => {
    // fino a metà sabotaggio della gru: la foto in terza persona (barra, segnalino, rinforzi)
    const sab = await p.page.evaluate(() => {
      const S = window.__sparo;
      S.set({ modo: 'missione', immortale: true, auto: true, pausa: true, cam: 'prima' });
      let s = S.state();
      for (let i = 0; i < 6 * 60 * 60 && !s.esito && !(s.obiettivo === 1 && S.partita().missione.sabota > 70); i++) s = S.avanti(1);
      S.set({ cam: 'terza' }); for (let i = 0; i < 6; i++) S.rendi(0.1);
      return S.partita().missione.sabota;
    });
    assert(sab > 70, `sabotaggio a metà: ${sab}`);
    await ctx.shot(p.page, 'pc_sabotaggio');
    const st = await p.page.evaluate(() => {
      const S = window.__sparo;
      S.set({ cam: 'prima' });
      let s = S.state();
      for (let i = 0; i < 6 * 60 * 60 && !s.esito; i += 30) s = S.avanti(30);
      for (let i = 0; i < 6; i++) S.rendi(0.1);
      return s;
    });
    numeri.missione = { esito: st.esito, medaglia: st.medaglia, secondi: Math.round(st.tick / 6) / 10, uccisi: st.uccisi, dannoPreso: st.dannoPreso, precisione: Math.round((100 * st.aSegno) / Math.max(1, st.sparati)) };
    assert(st.esito === 'vinta' && st.medaglia !== '', `esito ${st.esito} ${st.medaglia}, obiettivo ${st.obiettivo}`);
    assert(st.nemici === 9, `i 3 rinforzi sono arrivati: ${st.nemici}`);
    assert(st.dannoPreso > 0, 'i nemici hanno sparato');
    const testo = await p.page.textContent('.sm-pan');
    assert(/MISSIONE COMPIUTA/.test(testo ?? ''), testo ?? '');
    await ctx.shot(p.page, 'pc_fine');
    await p.page.evaluate(() => window.__sparo.set({ auto: false, pausa: false }));
    await p.page.click('.sm-pan button');
    const st2 = await p.page.evaluate(() => window.__sparo.state());
    assert(st2.obiettivo === 0 && st2.esito === '' && st2.nemici === 6, `RIGIOCA: ${JSON.stringify(st2)}`);
  });
  await ctx.test('pc: poligono — il pilota automatico abbatte i 6 bersagli', async () => {
    const st = await p.page.evaluate(() => {
      const S = window.__sparo;
      S.set({ modo: 'poligono', immortale: false, pausa: true, auto: true, cam: 'prima' });
      S.set({ x: 5, z: 5.5, yaw: -2.356, pitch: 0 });
      let s = S.state();
      for (let i = 0; i < 60 * 60 && s.uccisi < 6; i += 30) s = S.avanti(30);
      return s;
    });
    numeri.poligono = { uccisi: st.uccisi, sparati: st.sparati, aSegno: st.aSegno, secondi: Math.round(st.tick / 6) / 10 };
    assert(st.uccisi >= 6, `abbattuti ${st.uccisi}`);
    assert(st.aSegno / st.sparati > 0.5, `a segno ${st.aSegno}/${st.sparati}`);
  });
  await ctx.test('pc: 2 e 3 cambiano arma, R ricarica, V terza persona, H in HD', async () => {
    await p.page.evaluate(() => window.__sparo.set({ pausa: false, auto: false, cam: 'prima', hd: false }));
    const arma = async (tasto, n) => {
      await p.page.keyboard.press(tasto);
      await p.page.waitForFunction((k) => window.__sparo.state().arma === k, n, { timeout: 20000 }).catch(async () => { throw new Error(`${tasto}: ${JSON.stringify(await p.page.evaluate(() => window.__sparo.state()))}`); });
    };
    await arma('Digit2', 2);
    await arma('Digit3', 3);
    // un colpo col pompa (dal test, il mouse non è catturato), poi R ricarica un colpo alla volta
    await p.page.evaluate(() => { const S = window.__sparo; S.premi({ arma: 3 }, 40); S.premi({ fuoco: true, arma: 3 }, 1); S.premi({ arma: 3 }, 60); });
    let st = await p.page.evaluate(() => window.__sparo.state());
    assert(st.colpi === 5, `dopo un colpo: ${st.colpi}`);
    await p.page.keyboard.press('KeyR');
    await p.page.waitForFunction(() => window.__sparo.state().colpi === 6, null, { timeout: 20000 });
    await p.page.keyboard.press('KeyV'); await fotogrammi(p.page, 2);
    st = await p.page.evaluate(() => window.__sparo.state());
    assert(st.cam === 'terza', st.cam);
    await p.page.keyboard.press('KeyH'); await fotogrammi(p.page, 2);
    st = await p.page.evaluate(() => window.__sparo.state());
    assert(st.hd === true, `hd: ${st.hd}`);
    await ctx.shot(p.page, 'pc_terza_hd');
    assert(p.errors.length === 0, p.errors.join('\n'));
  });
  fs.writeFileSync(path.join(ctx.OUT, 'm4_provasparo.json'), JSON.stringify(numeri, null, 1) + '\n');
}
