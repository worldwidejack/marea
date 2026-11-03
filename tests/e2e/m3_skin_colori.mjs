// Pelle e capelli dell'editor valgono su OGNI skin del protagonista (game/avatar_skin.ts + la mappa /assets/skin/mappa.png, tools/meshy/skin_mappa.py):
// su 2 skin e su 2 look (il tono più chiaro e il più scuro, i capelli più scuri e i più chiari) la texture dipinta ha, nei pixel della mappa, i colori
// di avatar.json (pelle, pelle in ombra, capelli, capelli in luce) e fuori dalla mappa quelli della skin. Si legge la texture proprio come viene
// caricata sulla GPU (il canvas 512×512 passa da putImageData). Offline (?test=1&net=0).
import fs from 'node:fs';
import path from 'node:path';
export const timeout = 120000;
export default async function (ctx) {
  const p = await ctx.open('?test=1&net=0');
  const T = (n, ...a) => p.page.evaluate(([nome, args]) => window.__game.test[nome](...args), [n, a]);
  const avatar = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/avatar.json'), 'utf8'));
  const skin = avatar.abiti.map((a, i) => ({ i, id: a.skin, fissa: !!a.pelleFissa })).filter((x) => x.id);
  const LOOK = [{ pelle: 0, capelli: 0 }, { pelle: avatar.pelle.length - 1, capelli: avatar.coloriCapelli.length - 1 }];
  await ctx.test('il protagonista carica con la mappa pelle/capelli (18 KB) e nessun errore', async () => {
    await ctx.waitReady(p.page, 20000);
    await p.page.waitForFunction(() => window.__game.state().wp2_avatar?.model === true, null, { timeout: 20000 });
    const r = await p.page.request.get(new URL('/assets/skin/mappa.png', p.page.url()).href);
    ctx.assert(r.ok(), 'manca /assets/skin/mappa.png (tools/meshy/skin_mappa.py)');
    const png = await r.body();
    ctx.assert(png.readUInt32BE(16) === 512 && png.readUInt32BE(20) === 512, 'la mappa deve essere 512×512 come le skin');
    ctx.assert(png.length < 40000, `la mappa pesa ${png.length} byte: si scarica a ogni avvio, deve restare piccola`);
    ctx.noErrors(p, 'avvio');
  });
  await ctx.test('su 2 skin e 2 look i pixel di pelle e capelli hanno i colori scelti, il resto quelli della skin', async () => {
    ctx.assert(skin.length >= 2, `servono almeno 2 skin (ci sono ${skin.length})`);
    // ogni disegno del canvas della skin (512×512) si tiene: l'ultimo è quello in uso
    await p.page.evaluate(() => {
      const o = CanvasRenderingContext2D.prototype.putImageData;
      window.__disegni = 0;
      CanvasRenderingContext2D.prototype.putImageData = function (img, ...r) { if (img.width === 512 && img.height === 512) { window.__ultima = img.data.slice(); window.__disegni++; } return o.call(this, img, ...r); };
    });
    for (const s of skin.slice(0, 2)) for (const L of LOOK) {
      const prima = await p.page.evaluate(() => window.__disegni);
      await T('portoCappello', 0, s.i, L.pelle, L.capelli);
      await p.page.waitForFunction((n) => window.__disegni > n, prima, { timeout: 15000 });
      await p.page.waitForTimeout(150);
      const r = await p.page.evaluate(async ([id, fissa, pelle, ombra, capelli, luce]) => {
        const leggi = (url) => new Promise((ok, ko) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.drawImage(im, 0, 0); ok(g.getImageData(0, 0, 512, 512).data); }; im.onerror = ko; im.src = url; });
        const [mappa, sk] = await Promise.all([leggi('/assets/skin/mappa.png'), leggi(`/assets/skin/${id}.png`)]);
        const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
        const att = [null, hex(pelle), hex(ombra), hex(capelli), hex(luce)];
        const conta = [0, 0, 0, 0, 0], male = [], u = window.__ultima;
        for (let i = 0; i < 512 * 512; i++) {
          const ruolo = Math.round(mappa[i * 4] / 50); conta[ruolo]++;
          const voluto = ruolo && !(fissa && ruolo < 3) ? att[ruolo] : [sk[i * 4], sk[i * 4 + 1], sk[i * 4 + 2]];
          if (u[i * 4] !== voluto[0] || u[i * 4 + 1] !== voluto[1] || u[i * 4 + 2] !== voluto[2]) { if (male.length < 5) male.push({ i, ruolo, ha: [u[i * 4], u[i * 4 + 1], u[i * 4 + 2]], voluto }); }
        }
        return { conta, male };
      }, [s.id, s.fissa, avatar.pelle[L.pelle], avatar.pelleOmbra[L.pelle], avatar.coloriCapelli[L.capelli], avatar.capelliLuce[L.capelli]]);
      const etichetta = `${s.id} pelle ${L.pelle} capelli ${L.capelli}`;
      ctx.assert(r.conta[1] > 10000 && r.conta[3] > 40000, `${etichetta}: la mappa ha pochi pixel di pelle (${r.conta[1]}) o capelli (${r.conta[3]})`);
      ctx.assert(r.conta[2] > 0 && r.conta[4] > 0, `${etichetta}: mancano la pelle in ombra o i capelli in luce`);
      ctx.assert(r.male.length === 0, `${etichetta}: pixel sbagliati ${JSON.stringify(r.male)}`);
      const st = (await ctx.getState(p.page)).wp2_avatar;
      ctx.assert(st.skin === (s.id === 'base' ? null : s.id), `${etichetta}: skin in uso ${st.skin}`);
      ctx.assert(st.look.pelle === L.pelle && st.look.coloreCapelli === L.capelli, `${etichetta}: look ${JSON.stringify(st.look)}`);
    }
    ctx.noErrors(p, 'skin colori');
  });
  await T('portoCappello', 0, skin[0].i, 0, 0);
  await p.page.waitForTimeout(400);
  await ctx.shot(p.page, 'skin_colori');
}
