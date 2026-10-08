// Animali (#67): al Porto ci sono gabbiani, gatti e granchi vicino a chi gioca; un gatto fa le fusa con E (= A) da fermo accanto;
// un pesce salta; in barca veloce al largo arrivano i delfini; di notte le lucciole. Draw call: con e senza animali (≤ +3) e ≤ 100.
// Screenshot telefono e PC al molo del Porto, fusa, pesce, barca, lucciole, con le impostazioni di serie (?serie=1: camera 22°, contorni, ciclo).
export const timeout = 480000;
const MOLO = { x: 265, z: 305 }, ERBA = { x: 241, z: 283 };

export default async function (ctx) {
  const { assert } = ctx;
  const hook = (p, fn, ...a) => p.page.evaluate(([f, x]) => window.__game.test[f](...x), [fn, a]);
  const pronto = async (p) => {
    await ctx.waitReady(p.page, 30000);
    await ctx.waitState(p.page, (s) => !!s.animali && s.animali.gabbiani.tot > 0, 30000).catch((e) => { ctx.noErrors(p, 'avvio degli animali'); throw e; });
    await p.page.evaluate(() => window.__game.test.aspettoPronto());
    await hook(p, 'ciclo', 0.2); await p.page.waitForTimeout(700);
  };
  /** Draw call e triangoli con gli animali accesi e spenti (stesso punto, stessa camera). */
  const confronto = async (p, nome) => {
    await p.page.waitForTimeout(400);
    const con = await ctx.getPerf(p.page);
    await hook(p, 'animali', false); await p.page.waitForTimeout(400);
    const senza = await ctx.getPerf(p.page);
    await hook(p, 'animali', true); await p.page.waitForTimeout(300);
    ctx.log(`${nome}: draw call ${senza.drawCalls} → ${con.drawCalls} · triangoli ${senza.triangles} → ${con.triangles}`);
    // con le impostazioni di serie (camera 22°, si vede lontano) certe viste del PC sono già oltre 100 senza animali: lì conta solo la differenza
    if (senza.drawCalls <= 98) assert(con.drawCalls <= 100, `draw call ${con.drawCalls} > 100`);
    else ctx.warn(`${nome} › budget`, `già ${senza.drawCalls} draw call senza animali (vista di serie 22°), con ${con.drawCalls}`);
    assert(con.drawCalls - senza.drawCalls <= 3, `gli animali costano ${con.drawCalls - senza.drawCalls} draw call (max 3)`);
    return { con, senza };
  };

  const p = await ctx.open('?test=1&net=0&serie=1');
  await pronto(p);
  await ctx.test('al Porto: gabbiani, gatti e granchi vicino a chi gioca', async () => {
    await p.page.waitForTimeout(1200);
    const a = (await ctx.getState(p.page)).animali;
    ctx.log(JSON.stringify(a));
    ctx.noErrors(p, 'avvio');
    assert(a.gabbiani.vicini >= 4, `gabbiani vicini ${a.gabbiani.vicini}`);
    assert(a.gabbiani.posati >= 1 && a.gabbiani.inVolo >= 1, `gabbiani posati ${a.gabbiani.posati}, in volo ${a.gabbiani.inVolo}`);
    assert(a.gatti.vicini >= 2, `gatti vicini ${a.gatti.vicini}`);
    assert(a.granchi.vicini >= 1, `granchi vicini ${a.granchi.vicini}`);
    assert(a.tris > 300 && a.tris < 12000, `triangoli degli animali ${a.tris}`);
  });
  await ctx.test('telefono: molo del Porto, draw call con e senza animali', async () => {
    await hook(p, 'teleport', MOLO.x, MOLO.z); await hook(p, 'setZoom', 0.75); await p.page.waitForTimeout(1500);
    await ctx.shot(p.page, 'iphone_molo');
    ctx.noErrors(p, 'molo');
    await confronto(p, 'telefono molo');
  });
  await ctx.test('fusa: E da fermo accanto a un gatto → cuoricino', async () => {
    await hook(p, 'fermaGatti');
    const g = await hook(p, 'gatto');
    assert(g && g.accanto, `nessun gatto raggiungibile: ${JSON.stringify(g)}`);
    await hook(p, 'teleport', g.accanto.x, g.accanto.z); await hook(p, 'setZoom', 0.6); await p.page.waitForTimeout(600);
    await p.page.keyboard.press('KeyE'); await p.page.waitForTimeout(500);
    const st = await ctx.getState(p.page), a = st.animali;
    assert(a.gatti.fusa >= 1 && a.gatti.fumetto, `niente fusa: ${JSON.stringify(a.gatti)}`);
    assert(st.mode === 'walk', 'E ha fatto salire in barca invece delle fusa');
    await ctx.shot(p.page, 'iphone_fusa');
  });
  await ctx.test('un pesce salta vicino al molo', async () => {
    await hook(p, 'teleport', MOLO.x, MOLO.z + 6); await hook(p, 'setZoom', 0.7); await p.page.waitForTimeout(500);
    let ok = false;
    for (let i = 0; i < 5 && !ok; i++) ok = await hook(p, 'pesce');
    assert(ok, 'nessun punto d’acqua per il pesce');
    await p.page.waitForTimeout(420);
    await ctx.shot(p.page, 'iphone_pesce');
    assert((await ctx.getState(p.page)).animali.pesci.salti >= 1, 'nessun salto contato');
  });
  await ctx.test('in barca veloce al largo: delfini', async () => {
    // in barca A da fermi vicino al molo fa scendere: si va col joystick (freccia giù = verso la camera, al largo a sud-est del Porto)
    await hook(p, 'setMode', 'boat'); await hook(p, 'setZoom', 1.0);
    await p.page.keyboard.down('ArrowDown');
    await ctx.waitState(p.page, (st) => st.animali.delfiniFuori >= 1, 20000).catch(() => {});
    const st = await ctx.getState(p.page);
    await ctx.shot(p.page, 'iphone_barca');
    await p.page.keyboard.up('ArrowDown');
    ctx.log(`barca: velocità ${st.boat.speed.toFixed(1)} m/s, delfini ${st.animali.delfini}`);
    assert(st.animali.delfini >= 1, `niente delfini (velocità ${st.boat.speed.toFixed(1)}, x ${st.boat.x.toFixed(0)} z ${st.boat.z.toFixed(0)})`);
    const perf = await ctx.getPerf(p.page); assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls}`);
    ctx.noErrors(p, 'telefono');
  });

  const d = await ctx.open('?test=1&net=0&serie=1', { viewport: ctx.B.DESKTOP });
  await pronto(d);
  await ctx.test('PC: vetrina delle forme (tutte le pose da vicino)', async () => {
    await hook(d, 'teleport', 248, 283); await hook(d, 'vetrina', 249, 286, 8); await hook(d, 'setZoom', 0.6); await d.page.waitForTimeout(900);
    await ctx.shot(d.page, 'desktop_vetrina');
    await hook(d, 'vetrina', 0, 0, 0); // via la vetrina: gli screenshot dopo devono mostrare solo gli animali veri
    ctx.noErrors(d, 'vetrina');
    assert((await ctx.getState(d.page)).animali.attivi, 'animali spenti');
  });
  await ctx.test('PC: molo del Porto di giorno', async () => {
    await hook(d, 'teleport', MOLO.x, MOLO.z - 2); await hook(d, 'setZoom', 0.7); await d.page.waitForTimeout(1500);
    await ctx.shot(d.page, 'desktop_molo');
    await confronto(d, 'PC molo');
  });
  await ctx.test('PC: di notte le lucciole sull’erba', async () => {
    await hook(d, 'ciclo', 0.78); await hook(d, 'teleport', ERBA.x, ERBA.z); await hook(d, 'setZoom', 0.7);
    await d.page.waitForTimeout(1800);
    const st = await ctx.getState(d.page), a = st.animali;
    assert(a.lucciole >= 4, `lucciole ${a.lucciole} (aspetto ${JSON.stringify(st.aspetto)})`);
    await ctx.shot(d.page, 'desktop_lucciole');
    await confronto(d, 'PC notte');
  });
  await ctx.test('PC: in barca con i delfini', async () => {
    await hook(d, 'ciclo', 0.2); await hook(d, 'goto', 'porto'); await hook(d, 'setMode', 'boat'); await hook(d, 'setZoom', 0.9);
    await d.page.keyboard.down('ArrowDown');
    // il PC in SwiftShader va lento (la sim rallenta sotto i 12 fps): si aspetta che la barca arrivi al largo
    await ctx.waitState(d.page, (st) => st.animali.delfiniFuori >= 1, 20000).catch(() => {});
    await ctx.shot(d.page, 'desktop_barca');
    const st = await ctx.getState(d.page);
    await d.page.keyboard.up('ArrowDown');
    assert(st.animali.delfini >= 1, `niente delfini (velocità ${st.boat.speed.toFixed(1)}, x ${st.boat.x.toFixed(0)} z ${st.boat.z.toFixed(0)})`);
    const perf = await ctx.getPerf(d.page); ctx.log(`PC barca: draw call ${perf.drawCalls}, triangoli ${perf.triangles}`);
    ctx.noErrors(d, 'PC');
  });
}
