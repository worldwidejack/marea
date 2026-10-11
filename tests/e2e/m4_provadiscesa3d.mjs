// Banco di prova della discesa in bici (provadiscesa3d.html, #229): bici 3D pilotabile, sentiero e bosco dal kit `cs_d_*`, fondale video.
// - la pagina si apre senza errori, il kit si monta, il fondale video parte;
// - lungo tutta la discesa (cresta, sassi, salti, bosco, tornanti) draw call ≤ 100 e triangoli ≤ 150.000 a 390×844, nelle due camere;
// - il pilota automatico arriva in fondo senza cadere;
// - da PC: W pedala, Spazio = scatto, C cambia camera.
// Screenshot in tests/out/shots/m4_provadiscesa3d_*, numeri in tests/out/m4_provadiscesa3d.json.
import fs from 'node:fs';
import path from 'node:path';

export const timeout = 300000;
const MAX_DC = 100, MAX_TRI = 150000;

export default async function (ctx) {
  const { assert } = ctx;
  const numeri = { punti: {} };
  const apri = async (q, o = {}) => {
    const p = await ctx.open('provadiscesa3d.html?' + q, o);
    try { await p.page.waitForFunction(() => window.__discesa && window.__discesa.ready === true && window.__discesa.state().pezzi > 0, null, { timeout: 60000 }); } catch (e) {
      const st = await p.page.evaluate(() => window.__discesa ? { ready: window.__discesa.ready, ...window.__discesa.state() } : null);
      throw new Error(`non pronta: ${JSON.stringify(st)} · errori ${p.errors.join(' | ')} · richieste fallite ${p.failed.join(' | ')}`);
    }
    return p;
  };
  const fotogrammi = (page, n = 3) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

  const p = await apri('cam=occhi');
  await ctx.test('telefono: si apre, il kit si monta, il fondale video parte', async () => {
    await p.page.waitForFunction(() => window.__discesa.state().video === true, null, { timeout: 20000 });
    assert(p.errors.length === 0, p.errors.join('\n'));
    const st = await p.page.evaluate(() => window.__discesa.state());
    assert(st.pezzi > 500, `pezzi della scenografia: ${st.pezzi}`);
  });
  for (const [nome, s] of [['cresta', 30], ['sassi', 120], ['salto', 330], ['bosco', 500], ['tornante', 520], ['radici', 600], ['arrivo', 880]]) {
    await ctx.test(`telefono: ${nome} (s=${s}) — draw call e triangoli nel budget, camera occhi e dietro`, async () => {
      for (const cam of ['occhi', 'dietro']) {
        await p.page.evaluate(([x, c]) => { window.__discesa.set({ s: x, cam: c, pausa: true }); }, [s, cam]);
        await fotogrammi(p.page, 4);
        const perf = await p.page.evaluate(() => window.__discesa.perf());
        await ctx.shot(p.page, `${nome}_${cam}`);
        numeri.punti[`${nome}_${cam}`] = { calls: perf.calls, tris: perf.tris };
        ctx.log(`${nome} ${cam}: ${perf.calls} draw call, ${perf.tris} triangoli`);
        assert(perf.calls <= MAX_DC && perf.tris <= MAX_TRI, `${nome} ${cam}: ${perf.calls} draw call, ${perf.tris} triangoli`);
      }
    });
  }
  await ctx.test('il pilota automatico arriva in fondo senza cadere', async () => {
    const st = await p.page.evaluate(() => { const a = window.__discesa; a.set({ s: 2, auto: true, pausa: true }); return a.avanti(60 * 200); });
    assert(st.fine > 0 && st.cadute === 0, JSON.stringify(st));
    numeri.auto = { secondi: +(st.fine / 60).toFixed(1), salti: st.salti };
    ctx.log(`pilota automatico: ${(st.fine / 60).toFixed(1)} s, ${st.salti} salti`);
  });
  await ctx.test('PC: W pedala, Spazio = scatto, C cambia camera', async () => {
    const pc = await apri('cam=occhi&s=40', { viewport: ctx.B.DESKTOP });
    // il tempo del gioco va a scatti col disegno software dei test: si aspettano i tick, non i millisecondi
    const t0 = await pc.page.evaluate(() => window.__discesa.state().tick);
    await pc.page.keyboard.down('KeyW');
    await pc.page.waitForFunction((t) => window.__discesa.state().tick > t + 60, t0, { timeout: 60000 });
    await pc.page.keyboard.up('KeyW');
    let st = await pc.page.evaluate(() => window.__discesa.state());
    assert(st.v > 1, `pedalando si parte (${st.v})`);
    const v0 = st.v; await pc.page.keyboard.down('Space'); await fotogrammi(pc.page, 2); await pc.page.keyboard.up('Space');
    st = await pc.page.evaluate(() => window.__discesa.state());
    assert(st.v > v0 + 1, `lo scatto spinge (${v0} → ${st.v})`);
    await pc.page.keyboard.press('KeyC'); await fotogrammi(pc.page, 2);
    st = await pc.page.evaluate(() => window.__discesa.state());
    assert(st.cam === 'dietro', st.cam);
    await ctx.shot(pc.page, 'pc_dietro');
    assert(pc.errors.length === 0, pc.errors.join('\n'));
  });
  fs.writeFileSync(path.join(ctx.OUT, 'm4_provadiscesa3d.json'), JSON.stringify(numeri, null, 1) + '\n');
}
