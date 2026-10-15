// Banco di prova dello sparatutto a missioni (provasparo.html, #355; docs/SPARO.md). Tappa A, il poligono nel piazzale dei container:
// - la pagina si apre senza errori; si montano il piazzale (container, gru, casse, barriere, barca) e i soldati (io + 6 bersagli);
// - telefono in orizzontale (844×390) e PC (1280×720): in prima persona, in terza e dall'alto ≤ 100 draw call e ≤ 150.000 triangoli;
// - il pilota automatico abbatte i 6 bersagli con più di metà dei colpi a segno;
// - da PC: 2 e 3 cambiano arma, R ricarica, V passa in terza persona, H in HD.
// Screenshot in tests/out/shots/m4_provasparo_*, numeri in tests/out/m4_provasparo.json.
import fs from 'node:fs';
import path from 'node:path';

export const timeout = 240000;
const MAX_DC = 100, MAX_TRI = 150000;
const TEL = { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PC = { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false, hasTouch: false };

export default async function (ctx) {
  const { assert } = ctx;
  const numeri = {};
  const apri = async (q, viewport) => {
    for (const x of ctx._pages.splice(0)) await x.close().catch(() => {});
    const p = await ctx.open('provasparo.html?prova=1&' + q, { viewport });
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

  let p = null;
  for (const [nome, vp] of [['telefono', TEL], ['pc', PC]]) {
    p = await apri('cam=prima', vp);
    await ctx.test(`${nome}: si apre senza errori, piazzale e soldati montati`, async () => {
      assert(p.errors.length === 0, p.errors.join('\n'));
      const st = await p.page.evaluate(() => window.__sparo.state());
      assert(st.pezzi >= 60, `pezzi del piazzale: ${st.pezzi}`);
      assert(st.soldati === 6 && st.io, `soldati: ${st.soldati}, io: ${st.io}`);
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
  }
  await ctx.test('pc: il pilota automatico abbatte i 6 bersagli', async () => {
    const st = await p.page.evaluate(() => {
      const S = window.__sparo;
      S.set({ pausa: true, auto: true, cam: 'prima', x: 5, z: 5.5, yaw: -2.356, pitch: 0 });
      let s = S.state();
      for (let i = 0; i < 60 * 60 && s.uccisi < 6; i += 30) s = S.avanti(30);
      return s;
    });
    numeri.pilota = { uccisi: st.uccisi, sparati: st.sparati, aSegno: st.aSegno, secondi: Math.round(st.tick / 6) / 10 };
    assert(st.uccisi >= 6, `abbattuti ${st.uccisi}`);
    assert(st.aSegno / st.sparati > 0.5, `a segno ${st.aSegno}/${st.sparati}`);
    await p.page.evaluate(() => { const S = window.__sparo; S.set({ auto: false }); for (let i = 0; i < 8; i++) S.rendi(0.1); });
    await ctx.shot(p.page, 'pc_pilota');
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
