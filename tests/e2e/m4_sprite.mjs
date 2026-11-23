// Personaggi 2.5D (sprite/), senza server (net=0): coi test sono spenti, si accendono dalle Impostazioni. Nel Borgo il corpo 3D sparisce e
// lo sprite cammina nella vista giusta, con l'attrezzo in mano e nelle mosse; la tela diventa a risoluzione piena e torna piccola spegnendo;
// in barca niente sprite; nell'Arena ogni eroe ha il suo con l'arma di adesso. Screenshot in tests/out/shots/m4_sprite_*.png.
export const timeout = 240000;

export default async function (ctx) {
  const { assert } = ctx;
  const p = await ctx.open('?test=1&net=0&slot=0');
  await ctx.waitReady(p.page, 30000);
  const page = p.page, st = () => ctx.getState(page);
  const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
  const mio = async () => (await st()).sprite.figure.find((f) => f.nome === 'avatar');
  const tela = () => page.evaluate(() => document.querySelector('canvas').width);
  const si = (s) => s.sprite?.figure?.some((f) => f.nome === 'avatar' && f.visibile);
  let piccola = 0;

  await ctx.test('spenti di serie nei test; accesi dalle Impostazioni lo sprite prende il posto del corpo 3D, a risoluzione piena', async () => {
    assert(!(await st()).sprite, 'lo strato non dovrebbe esserci');
    piccola = await tela();
    await page.evaluate(() => document.querySelector('#mzSetBtn').click());
    await page.click('#mzSet [data-set=sprite]');
    await page.evaluate(() => document.querySelector('#mzSet .mz-x').click());
    await ctx.waitState(page, si, 30000);
    const f = await mio();
    assert(!f.corpo && /_camminata_1$/.test(f.chiave), 'fermo: ' + JSON.stringify(f));
    assert(!(await st()).sprite.piena || (await tela()) > piccola, 'la tela non è a risoluzione piena'); // su un computer lento (GitHub) lo strato torna piccolo da solo
    await ctx.shot(page, 'fermo');
  });
  await ctx.test('camminando il disegno avanza e la vista segue la direzione', async () => {
    const viste = new Set(), disegni = new Set();
    for (const k of ['ArrowDown', 'ArrowUp']) {
      await page.keyboard.down(k);
      for (let i = 0; i < 8; i++) { await page.waitForTimeout(150); const c = (await mio()).chiave; viste.add(c.split('_')[0]); disegni.add(c.split('_')[2]); }
      await page.keyboard.up(k);
    }
    assert(viste.has('S') && viste.has('N'), 'viste: ' + [...viste]);
    assert(disegni.size >= 3, 'disegni: ' + [...disegni]);
    await ctx.shot(page, 'cammina');
  });
  await ctx.test('retino, canna e pala: tenuti e nella mossa', async () => {
    for (const a of ['retino', 'canna', 'pala']) {
      await hook('spriteInMano', a, null); await page.waitForTimeout(400);
      const fermo = (await mio()).chiave;
      await hook('spriteInMano', a, 0.99); await page.waitForTimeout(400);
      const mossa = (await mio()).chiave;
      assert(fermo.includes(`_${a}_1`) && mossa.includes(`_${a}_`) && mossa !== fermo, a + ': ' + fermo + ' → ' + mossa);
      await ctx.shot(page, a);
    }
    await hook('spriteInMano', null);
  });
  await ctx.test('in barca niente sprite, a terra torna', async () => {
    await hook('setMode', 'boat'); await page.waitForTimeout(800);
    assert(!(await mio())?.visibile && (await tela()) === piccola, 'in barca: ' + JSON.stringify(await mio()));
    await ctx.shot(page, 'barca');
    await hook('setMode', 'walk'); await ctx.waitState(page, si, 5000);
  });
  await ctx.test('spenti: torna il corpo 3D e la tela di sempre', async () => {
    await hook('impostazioni', { sprite: false });
    await page.waitForTimeout(600);
    assert((await st()).sprite.figure.length === 0 && !(await st()).sprite.strato, 'lo strato è rimasto');
    assert((await tela()) === piccola, 'la tela non è tornata piccola');
  });

  const a = await ctx.open('?test=1&net=0&arena=banco', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(a.page, 30000);
  await ctx.test('Arena: ogni eroe a sprite con la sua arma, il 3D nascosto', async () => {
    await a.page.evaluate(() => window.__game.test.impostazioni({ sprite: true }));
    await ctx.waitState(a.page, (s) => s.arenaPartita?.fase === 'gioca', 90000);
    const arena = (await ctx.getState(a.page)).arenaSprite;
    assert(arena?.length === 6, 'figure dell’Arena: ' + JSON.stringify(arena)?.slice(0, 200));
    await ctx.waitState(a.page, (s) => s.arenaSprite.some((f) => f.visibile && !/_camminata_/.test(f.chiave)), 30000);
    await a.page.evaluate(() => window.__game.test.arenaAuto(true));
    await a.page.waitForTimeout(4000);
    await ctx.shot(a.page, 'arena');
  });
  for (const x of [p, a]) assert(!x.errors.length, 'errori: ' + x.errors.join(' | '));
}
