// Cartelli discreti (#129), senza server (net=0): da PC i cartelli delle attività e i nomi della gente del Porto lontani sono piccoli
// e in trasparenza (classe `far`), da vicino tornano pieni; sul telefono restano sempre pieni. Screenshot della piazza da PC.
export const timeout = 120000;
export default async function (ctx) {
  const { assert } = ctx;
  const lbl = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return { far: e.classList.contains('far'), font: parseFloat(c.fontSize), opacity: +c.opacity, shown: !e.style.transform.includes('-9999') }; }, sel);
  const fine = (page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 }).catch(() => {}); // la dissolvenza (.2 s) finita
  const posto = async (page, id) => (await ctx.getState(page)).porto.posti.find((p) => p.id === id);
  const vai = async (page, x, z) => { await page.evaluate(([x, z]) => window.__game.test.teleport(x, z), [x, z]); };

  const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  await ctx.waitState(d.page, (s) => s.porto && s.porto.posti.length >= 3, 20000);

  await ctx.test('PC: davanti alla Bacheca il Mercante lontano è discreto, la Bacheca è piena', async () => {
    const b = await posto(d.page, 'bacheca');
    await vai(d.page, b.fronte.x, b.fronte.z + 1);
    await d.page.waitForFunction(() => document.querySelector('.mz-lbl[data-porto="mercante"]')?.classList.contains('far') && !document.querySelector('.mz-lbl[data-porto="bacheca"]')?.classList.contains('far'), null, { timeout: 15000 }).catch(() => {});
    await fine(d.page);
    const m = await lbl(d.page, '.mz-lbl[data-porto="mercante"]'), bb = await lbl(d.page, '.mz-lbl[data-porto="bacheca"]');
    assert(m && m.far && m.opacity < 1 && m.font < 14, 'Mercante da lontano: ' + JSON.stringify(m));
    assert(bb && !bb.far && bb.opacity === 1 && bb.font >= 14, 'Bacheca da vicino: ' + JSON.stringify(bb));
    await ctx.shot(d.page, 'desktop_cartelli_piazza');
  });

  await ctx.test('PC: avvicinandosi al Mercante il suo cartello torna pieno', async () => {
    const m = await posto(d.page, 'mercante');
    await vai(d.page, m.fronte.x, m.fronte.z + 1);
    await d.page.waitForFunction(() => !document.querySelector('.mz-lbl[data-porto="mercante"]')?.classList.contains('far'), null, { timeout: 15000 }).catch(() => {});
    await fine(d.page);
    const l = await lbl(d.page, '.mz-lbl[data-porto="mercante"]');
    assert(l && !l.far && l.opacity === 1, 'Mercante da vicino: ' + JSON.stringify(l));
  });

  await ctx.test('PC: il nome di una persona a più di 6 m è discreto', async () => {
    await d.page.waitForFunction(() => [...document.querySelectorAll('.mz-lbl.persona')].some((e) => !e.style.transform.includes('-9999') && e.classList.contains('far')), null, { timeout: 20000 }).catch(() => {});
    const n = await d.page.evaluate(() => [...document.querySelectorAll('.mz-lbl.persona')].filter((e) => !e.style.transform.includes('-9999') && e.classList.contains('far')).length);
    assert(n > 0, 'nessun nome discreto in piazza');
  });

  const p = await ctx.open('?test=1&net=0');
  await ctx.waitReady(p.page, 20000);
  await ctx.waitState(p.page, (s) => s.porto && s.porto.posti.length >= 3, 20000);
  await ctx.test('telefono: i cartelli lontani restano pieni', async () => {
    const b = await posto(p.page, 'bacheca');
    await vai(p.page, b.fronte.x, b.fronte.z + 1);
    await p.page.waitForTimeout(1500);
    const touch = await p.page.evaluate(() => !matchMedia('(hover: hover) and (pointer: fine)').matches);
    const s = await p.page.evaluate(() => [...document.querySelectorAll('.mz-lbl.bubble.far')].map((e) => +getComputedStyle(e).opacity));
    assert(touch, 'il telefono dei test risulta un PC col mouse');
    assert(s.every((o) => o === 1), 'sul telefono un cartello è in trasparenza: ' + JSON.stringify(s));
  });
}
