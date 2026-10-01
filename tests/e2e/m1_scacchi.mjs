// Scacco in 3 al Tavolo del Porto (sfide con posta spente): vicino al Tavolo compare GIOCA, si apre la scacchiera, il Nero sta fermo.
// Problema 1 risolto toccando le caselle (Td5, Cc6, Td8#) → SCACCO MATTO e PROSSIMO; un tentativo sbagliato → Niente matto e RIPROVA.
export const timeout = 90000;
const sq = (s) => (8 - Number(s[1])) * 8 + 'abcdefgh'.indexOf(s[0]);
export default async function (ctx) {
  const p = await ctx.open('?test=1&net=0');
  const page = p.page;
  await ctx.waitReady(page, 20000);
  await page.evaluate(() => { try { localStorage.removeItem('marea.scacchi'); } catch { /* */ } });
  const tap = async (a, b) => { await page.click(`#mzScacchi [data-sq="${sq(a)}"]`); await page.click(`#mzScacchi [data-sq="${sq(b)}"]`); };
  const msg = () => page.$eval('#mzScacchi .msg', (e) => e.textContent);

  await ctx.test('al Tavolo del Porto compare GIOCA · SCACCO IN 3', async () => {
    const st = await ctx.getState(page);
    const at = st.tavolo?.at;
    ctx.assert(at, 'Tavolo del Porto non trovato');
    ctx.assert(st.minigiochi.spots.some((s) => s.id === 'scacchi'), 'spot scacchi assente');
    await page.evaluate(({ x, z }) => window.__game.test.teleport(x + 2.5, z + 1.5), at);
    await ctx.waitState(page, (s) => s.minigiochi.near === 'scacchi', 5000);
    await page.waitForTimeout(300);
  });
  await ctx.shot(page, 'scacchi_tavolo');
  await ctx.test('GIOCA apre la scacchiera', async () => {
    await page.click('#mzPlay');
    await page.waitForSelector('#mzScacchi.on', { timeout: 3000 });
    ctx.assert((await page.$$('#mzScacchi .sq')).length === 64, 'non 64 caselle');
  });
  await ctx.shot(page, 'scacchi_aperto');
  await ctx.test('tre mosse sbagliate: Niente matto', async () => {
    await tap('b5', 'a5'); await tap('a5', 'a6'); await tap('c3', 'd5');
    ctx.assert(/Niente matto|si salva/.test(await msg()), `msg: ${await msg()}`);
    await page.click('#mzScacchi [data-act="riprova"]');
  });
  await ctx.test('Td5, Cc6, Td8: SCACCO MATTO', async () => {
    await page.click(`#mzScacchi [data-sq="${sq('b5')}"]`);
    await ctx.shot(page, 'scacchi_selezione');
    await page.click(`#mzScacchi [data-sq="${sq('d5')}"]`);
    await tap('b4', 'c6'); await tap('d5', 'd8');
    ctx.assert(/MATTO/.test(await msg()), `msg: ${await msg()}`);
    ctx.assert(await page.$('#mzScacchi [data-act="prossimo"]'), 'manca PROSSIMO');
  });
  await ctx.shot(page, 'scacchi_matto');
  await ctx.test('PROSSIMO porta al problema 2, Esc chiude', async () => {
    await page.click('#mzScacchi [data-act="prossimo"]');
    ctx.assert(/2\/6/.test(await page.$eval('#mzScacchi .mz-title', (e) => e.textContent)), 'non è il 2');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    ctx.assert(!(await page.$('#mzScacchi.on')), 'ancora aperto');
    ctx.noErrors(p, 'scacchi');
  });
}
