// Isole a tema (#68): le 5 isole con lo sblocco ci sono, di serie sono chiuse col motivo giusto (Corse e Templari sono aperte a tutti) (barriera in mare per Tempesta, Ghiacci e Giardino,
// il Vulcano ti caccia a terra, all'Adrenalina ti ferma il cancello della funivia: m4_adrenalina), si aprono col requisito (hook temiProva), minimappa col lucchetto, bussola dopo la scoperta,
// scenografia viva (pioggia, banchisa, nebbia, fumo) e corrente al bordo del mondo (#5). Screenshot di ogni isola da vicino a 390×844 e
// da PC, draw call ≤ 100, niente errori. Numeri: tests/out/m3_isole.json
import fs from 'node:fs';
import path from 'node:path';
export const timeout = 600000;
const ISOLE = ['tempesta', 'ghiacci', 'vulcano', 'giardino', 'templari', 'adrenalina'];
const LIBERE = new Set(['corse', 'templari']); // i Templari dal 10/10: niente calice da trovare
const MOTIVI = { adrenalina: /guardiano della funivia.*liberatoria/, tempesta: /tempesta ti respinge.*Molo al livello 2/, ghiacci: /mare gela.*livello 3/, vulcano: /abitanti ti cacciano.*Lanterna in testa/, giardino: /nebbia.*mappa del Giardino/ };
const APRI = { adrenalina: { cappello: 'casco', liberatorie: ['adrenalina'] }, tempesta: { molo: 2 }, ghiacci: { livello: 3 }, vulcano: { cappello: 'lanterna' }, giardino: { mappe: ['giardino'] } };

export default async function (ctx) {
  const { assert } = ctx;
  const numbers = {};
  const hook = (p, fn, ...args) => p.page.evaluate(([f, a]) => window.__game.test[f](...a), [fn, args]);
  const st = (p) => ctx.getState(p.page);
  const ticks = (p) => p.page.evaluate(() => window.__game.state().wp2_boat.ticks);
  const waitTicks = async (p, n) => { const t0 = await ticks(p); await p.page.waitForFunction(([t0, n]) => window.__game.state().wp2_boat.ticks - t0 >= n, [t0, n], { timeout: 60000, polling: 50 }); };
  const isola = async (p, id) => (await st(p)).temi.isole.find((i) => i.id === id);
  /** Budget TECH §5 (draw call e triangoli), anche con la camera di serie a 22° (`bassa`: solo per i numeri; dal culling per isola
   *  e dalle sagome, render/island.ts, il giro completo lo controlla m3_prestazioni). */
  const budget = async (p, name, bassa = false) => {
    const perf = await ctx.getPerf(p.page);
    numbers[name] = { drawCalls: perf.drawCalls, triangles: perf.triangles, fps: perf.fps, camera: bassa ? '22°' : '45°' };
    ctx.log(name, JSON.stringify(numbers[name]));
    assert(perf.drawCalls > 0 && perf.drawCalls <= 100, `${name}: draw call ${perf.drawCalls}`);
    assert(perf.triangles <= 150000, `${name}: triangoli ${perf.triangles}`);
  };
  /** Barca verso l'isola a tutta forza per `s` secondi (tick veri): restituisce la distanza minima dal punto della barca dell'isola. */
  const verso = async (p, id, s) => {
    await hook(p, 'temiVerso', id, 30);
    const b = (await isola(p, id)).boat;
    let min = Infinity;
    await p.page.keyboard.down('Space');
    for (let i = 0; i < s * 4; i++) { await waitTicks(p, 15); const q = (await st(p)).boat; min = Math.min(min, Math.hypot(q.x - b.x, q.z - b.z)); }
    await p.page.keyboard.up('Space');
    return min;
  };

  const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 30000);

  await ctx.test('sette isole a tema: cinque chiuse di serie col motivo giusto, Corse e Templari aperte a tutti', async () => {
    const s = await st(d);
    assert(s.temi && s.temi.isole.length === 7, `isole a tema: ${JSON.stringify(s.temi)}`);
    for (const i of s.temi.isole) {
      if (LIBERE.has(i.id)) { assert(i.aperta, `${i.id} chiusa`); continue; } // sblocco `libera`
      assert(!i.aperta, `${i.id} aperta di serie`);
      assert(MOTIVI[i.id].test(i.motivo), `${i.id}: motivo «${i.motivo}»`);
    }
    await d.page.waitForFunction(() => !!window.__game.state().mappa, null, { timeout: 10000 });
    await d.page.waitForTimeout(700);
    const m = (await st(d)).mappa;
    assert(m.chiuse.length === 5, `minimappa: isole chiuse ${JSON.stringify(m.chiuse)}`);
    assert(!(await st(d)).compass.shown.some((x) => x.startsWith('tema:')), 'le isole a tema non scoperte sono già nella bussola');
  });

  await ctx.test('mappa: lucchetto sulle chiuse; scoperte → in bussola', async () => {
    await hook(d, 'mappaScopri'); await d.page.waitForTimeout(300);
    const s = await st(d);
    assert(s.mappa.chiuse.length === 5, 'scoperte ma ancora chiuse: il lucchetto resta');
    for (const id of [...ISOLE, 'corse']) assert(s.compass.shown.includes('tema:' + id), `bussola senza ${id}: ${JSON.stringify(s.compass.shown)}`);
    await hook(d, 'mappa', 'apri'); await d.page.waitForTimeout(300);
    await ctx.shot(d.page, 'desktop_mappa_chiuse');
    await hook(d, 'mappa', 'chiudi');
  });

  for (const id of ['tempesta', 'ghiacci', 'giardino']) {
    await ctx.test(`${id}: chiusa la barriera respinge la barca, aperta si passa`, async () => {
      await hook(d, 'temiProva', null);
      const r0 = (await st(d)).temi.respinte;
      const minChiusa = await verso(d, id, 6);
      const s = await st(d), bar = (await isola(d, id)).barriera;
      assert(s.temi.respinte > r0, `${id}: mai respinta`);
      assert(minChiusa > bar, `${id}: chiusa ma arrivata a ${minChiusa.toFixed(1)} m dal molo`);
      assert(MOTIVI[id].test(s.temi.ultimo), `${id}: messaggio «${s.temi.ultimo}»`);
      await ctx.shot(d.page, `desktop_${id}_chiusa`);
      await budget(d, `${id}_chiusa`);
      await hook(d, 'temiProva', APRI[id]);
      const minAperta = await verso(d, id, 7);
      assert(minAperta < bar, `${id}: aperta ma ferma a ${minAperta.toFixed(1)} m dal molo`);
      numbers[id] = { minChiusa: +minChiusa.toFixed(1), minAperta: +minAperta.toFixed(1), barriera: bar };
      ctx.noErrors(d, id);
    });
  }

  await ctx.test('scenografia: banchisa e nebbia solo da chiuse, fumo sul Vulcano', async () => {
    await hook(d, 'temiFx');
    await hook(d, 'temiProva', null);
    await hook(d, 'goto', 'ghiacci'); await d.page.waitForTimeout(800);
    assert((await st(d)).temi.fx.ghiacci.banchisa === true, 'Ghiacci chiusa senza banchisa');
    await hook(d, 'temiProva', APRI.ghiacci); await d.page.waitForTimeout(800);
    assert((await st(d)).temi.fx.ghiacci.banchisa === false, 'Ghiacci aperta con la banchisa');
    await hook(d, 'temiProva', null);
    await hook(d, 'temiVerso', 'giardino', 4); await d.page.waitForTimeout(900);
    let g = (await st(d)).temi.fx.giardino;
    assert(g.nebbia && g.isolaNascosta, `Giardino chiuso: ${JSON.stringify(g)}`);
    await ctx.shot(d.page, 'desktop_giardino_nebbia');
    await hook(d, 'temiProva', APRI.giardino); await d.page.waitForTimeout(800);
    g = (await st(d)).temi.fx.giardino;
    assert(!g.nebbia && !g.isolaNascosta && g.koi > 0, `Giardino aperto: ${JSON.stringify(g)}`);
    await hook(d, 'goto', 'tempesta'); await d.page.waitForTimeout(500);
    const t = (await st(d)).temi.fx.tempesta;
    assert(t.visibile && t.pioggia > 0 && t.onde > 0, `Tempesta: ${JSON.stringify(t)}`);
  });

  await ctx.test('Vulcano: senza Lanterna in testa ti rimettono in barca; con la Lanterna resti', async () => {
    await hook(d, 'temiProva', null);
    const c0 = (await st(d)).temi.cacce;
    await hook(d, 'goto', 'vulcano');
    await d.page.waitForFunction(() => !!window.__game.state().temi.fumetto, null, { timeout: 10000 });
    const f = (await st(d)).temi.fumetto;
    assert(/Lanterna in testa/.test(f), `fumetto: ${f}`);
    await ctx.shot(d.page, 'desktop_vulcano_cacciato');
    await d.page.waitForFunction(() => window.__game.state().mode === 'boat', null, { timeout: 10000 });
    const s = await st(d);
    assert(s.temi.cacce > c0 && s.mode === 'boat', 'non ti hanno rimesso in barca');
    await hook(d, 'temiProva', APRI.vulcano);
    await hook(d, 'goto', 'vulcano'); await d.page.waitForTimeout(3500);
    assert((await st(d)).mode === 'walk', 'col cappello giusto ti cacciano lo stesso');
    ctx.noErrors(d, 'vulcano');
  });

  await ctx.test('aperte: niente lucchetto in mappa', async () => {
    await hook(d, 'temiProva', 'tutte'); await d.page.waitForTimeout(800);
    const s = await st(d);
    assert(s.temi.isole.every((i) => i.aperta), 'temiProva tutte non apre tutto');
    assert(s.mappa.chiuse.length === 0, `lucchetti rimasti: ${JSON.stringify(s.mappa.chiuse)}`);
  });

  // screenshot di ogni isola da vicino (aperte), PC e telefono; di notte i Ghiacci con l'aurora
  for (const id of ISOLE) {
    await ctx.test(`vista ${id} (PC)`, async () => {
      await hook(d, 'goto', id); await hook(d, 'setZoom', 1.3); await d.page.waitForTimeout(1200);
      await ctx.shot(d.page, `desktop_${id}`);
      await budget(d, `desktop_${id}`);
      const c = (await isola(d, id)).centro;
      await hook(d, 'teleport', c.x, c.z); await hook(d, 'setZoom', 2.2); await d.page.waitForTimeout(900);
      await ctx.shot(d.page, `desktop_${id}_alto`);
      await budget(d, `desktop_${id}_alto`);
    });
  }
  await ctx.test('Ghiacci di notte: aurora', async () => {
    await hook(d, 'impostazioni', { cam: 3, ciclo: true, stampa: false, contorni: true });
    await hook(d, 'aspettoPronto');
    await hook(d, 'goto', 'ghiacci'); await hook(d, 'setZoom', 1.6);
    await hook(d, 'ciclo', 0.75); await d.page.waitForTimeout(1500);
    const s = await st(d);
    assert(s.aspetto.caricato && s.aspetto.momento === 'notte', `niente notte: ${JSON.stringify(s.aspetto)}`);
    assert(s.temi.fx.ghiacci.aurora === true, `aurora spenta di notte: ${JSON.stringify(s.temi.fx.ghiacci)}`);
    await ctx.shot(d.page, 'desktop_ghiacci_notte');
    await budget(d, 'desktop_ghiacci_notte');
    await hook(d, 'ciclo', 0.3); await d.page.waitForTimeout(800);
    assert((await st(d)).temi.fx.ghiacci.aurora === false, 'aurora accesa di giorno');
    await hook(d, 'impostazioni', { cam: 0, ciclo: false, stampa: false, contorni: false });
    ctx.noErrors(d, 'notte');
  });

  await ctx.test('bordo del mondo (#5): la corrente riporta indietro', async () => {
    const W = (await st(d)).island.w * 2;
    await hook(d, 'temiBarca', W - 40, 520, Math.PI / 2); // prua a est, in mare aperto a sud-est (sotto il Vulcano)
    await d.page.keyboard.down('ArrowRight'); await d.page.keyboard.down('Space');
    await waitTicks(d, 60 * 8);
    await d.page.keyboard.up('ArrowRight'); await d.page.keyboard.up('Space');
    const b = (await st(d)).boat;
    assert(b.x < W - 1 && b.x > 0, `barca fuori dal mondo: x ${b.x.toFixed(1)} su ${W}`);
    numbers.bordo = { x: +b.x.toFixed(1), W };
  });

  const p = await ctx.open('?test=1&net=0&serie=1'); // telefono con le impostazioni di serie: camera 22°, contorni, ciclo
  await ctx.waitReady(p.page, 30000);
  await hook(p, 'temiProva', 'tutte');
  for (const id of ISOLE) {
    await ctx.test(`vista ${id} (telefono)`, async () => {
      await hook(p, 'impostazioni', { cam: 0 }); await hook(p, 'goto', id); await hook(p, 'ciclo', 0.3); await hook(p, 'setZoom', 1.3); await p.page.waitForTimeout(1200);
      await budget(p, `iphone_${id}_45`);
      await hook(p, 'impostazioni', { cam: 3 }); await p.page.waitForTimeout(1200);
      await ctx.shot(p.page, `iphone_${id}`);
      await budget(p, `iphone_${id}`, true);
    });
  }
  await ctx.test('telefono: le isole chiuse viste dal mare, il Vulcano che caccia, i Ghiacci di notte', async () => {
    await hook(p, 'temiProva', null);
    for (const id of ['tempesta', 'ghiacci', 'giardino']) {
      await hook(p, 'temiVerso', id, 6); await p.page.waitForTimeout(1300);
      await ctx.shot(p.page, `iphone_${id}_chiusa`);
      await budget(p, `iphone_${id}_chiusa`, true);
    }
    await hook(p, 'goto', 'vulcano'); await hook(p, 'setZoom', 1.0);
    await p.page.waitForFunction(() => !!window.__game.state().temi.fumetto, null, { timeout: 10000 }); await p.page.waitForTimeout(300);
    await ctx.shot(p.page, 'iphone_vulcano_cacciato');
    await p.page.waitForFunction(() => window.__game.state().mode === 'boat', null, { timeout: 10000 });
    await hook(p, 'temiProva', 'tutte');
    await hook(p, 'goto', 'ghiacci'); await hook(p, 'setZoom', 1.6); await hook(p, 'ciclo', 0.75); await p.page.waitForTimeout(1500);
    await ctx.shot(p.page, 'iphone_ghiacci_notte');
    await budget(p, 'iphone_ghiacci_notte', true);
    await hook(p, 'ciclo', null);
    ctx.noErrors(p, 'telefono');
  });
  fs.writeFileSync(path.join(ctx.OUT, 'm3_isole.json'), JSON.stringify(numbers, null, 1));
}
