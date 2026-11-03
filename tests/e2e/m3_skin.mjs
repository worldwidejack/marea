// Il protagonista nuovo (`chr_eroe`, Meshy) e le sue skin: il modello carica, la skin si cambia al volo (altra texture sul materiale, nessuna
// ricarica), i vestiti vecchi non spuntano sul corpo nuovo, i cappelli sì; ogni skin di avatar.json ha il suo PNG a 512 px. Offline (?test=1&net=0).
import fs from 'node:fs';
import path from 'node:path';
export const timeout = 120000;
export default async function (ctx) {
  const p = await ctx.open('?test=1&net=0');
  const T = (n, ...a) => p.page.evaluate(([nome, args]) => window.__game.test[nome](...args), [n, a]);
  const av = () => p.page.evaluate(() => window.__game.state().wp2_avatar);
  const avatar = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/avatar.json'), 'utf8'));
  const skin = avatar.abiti.map((a, i) => ({ i, id: a.skin })).filter((x) => x.id);
  await ctx.test('il protagonista è chr_eroe: modello con clip, senza segnaposto', async () => {
    await ctx.waitReady(p.page, 20000);
    ctx.assert(avatar.protagonista === 'chr_eroe', 'avatar.json protagonista ≠ chr_eroe');
    await p.page.waitForFunction(() => window.__game.state().wp2_avatar?.model === true, null, { timeout: 20000 });
    ctx.assert((await av()).clip, 'nessuna clip in corso');
    ctx.noErrors(p, 'protagonista');
  });
  await ctx.test('ogni skin di avatar.json ha il suo PNG 512×512 e si indossa al volo; senza skin torna la texture di partenza', async () => {
    ctx.assert(skin.length >= 3, `servono almeno 3 skin di prova (ci sono ${skin.length})`);
    for (const s of skin) {
      const r = await p.page.request.get(new URL(`/assets/skin/${s.id}.png`, p.page.url()).href);
      ctx.assert(r.ok(), `manca /assets/skin/${s.id}.png`);
      const png = await r.body(), w = png.readUInt32BE(16), h = png.readUInt32BE(20);
      ctx.assert(w === 512 && h === 512, `${s.id}: ${w}×${h}, deve essere 512×512 come la texture del modello`);
      ctx.assert((await p.page.request.get(new URL(`/assets/skin/${s.id}_anteprima.png`, p.page.url()).href)).ok(), `manca il disegno ${s.id}_anteprima.png (tools/meshy/skin_anteprima.py)`);
      await T('portoCappello', 0, s.i);
      await p.page.waitForFunction((id) => window.__game.state().wp2_avatar?.skin === id, s.id === 'base' ? null : s.id, { timeout: 15000 }); // 'base' = la texture del glb: skin null
    }
    await T('portoCappello', 0, 0);
    await p.page.waitForFunction(() => window.__game.state().wp2_avatar?.skin === null, null, { timeout: 5000 });
    ctx.noErrors(p, 'skin');
  });
  await ctx.test('un vestito vecchio (glb) non si cuce sul protagonista; un cappello sì', async () => {
    const vecchio = avatar.abiti.findIndex((a) => !a.skin && a.monete > 0);
    await T('portoCappello', 1, vecchio);
    await p.page.waitForFunction(() => window.__game.state().wp2_avatar?.abiti?.cappello === 'cap_paglia', null, { timeout: 20000 });
    const a = await av();
    ctx.assert(a.abiti.abito === null, `il vestito vecchio è addosso: ${a.abiti.abito}`);
    await T('portoCappello', 0, 0);
  });
  await ctx.test('il Mercante vende solo skin (il corpo nuovo non porta i vestiti vecchi)', async () => {
    const venduti = avatar.abiti.filter((a) => a.monete > 0 && a.skin);
    ctx.assert(venduti.length >= avatar.mercante.abiti * (avatar.mercante.riposo + 1), 'poche skin per la vetrina del Mercante');
  });
  await ctx.shot(p.page, 'protagonista_skin');
}
