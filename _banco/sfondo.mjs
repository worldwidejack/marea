// Banco dei pixel (3/11): lo sfondo del Borgo per la pagina _banco/pixel_lab, preso dalla tela del gioco (un pixel = un pixel di gioco,
// niente interfaccia) con la camera dei 64 px (?blocca=1&pxschermo=2 sul Retina) e lo sprite nascosto; in sfondo.json il punto dei piedi.
// uso: node _banco/sfondo.mjs [porta] [set]
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { WT } from './lib.mjs';
const B = await import(pathToFileURL(WT + '/tests/lib/browser.mjs').href);
const porta = process.argv[2] || '5176', set = process.argv[3] || 'scugnizzo-hd64';
const OUT = WT + '/_banco/pixel_lab';
const browser = await B.launch();
const { page, close } = await B.openPage(browser, `http://localhost:${porta}/_banco.html?test=1&net=0&slot=0&sprite=${set}&blocca=1&pxschermo=2`,
  { viewport: { width: 1512, height: 945, deviceScaleFactor: 2, isMobile: false, hasTouch: false } });
await B.waitReady(page, 120000);
for (let i = 0; i < 60 && !(await page.evaluate(() => !!window.__sp)); i++) await page.waitForTimeout(250);
await page.waitForTimeout(2500);
const r = await page.evaluate(async () => {
  const b = window.__banco, sp = window.__sp;
  const piv = b.scene.getObjectByName('_banco_sprite_pivot');
  piv.visible = false;
  await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
  const c = b.renderer.domElement, o = piv.position.clone().project(b.camera);
  return { url: c.toDataURL('image/png'), w: c.width, h: c.height, piede: [(o.x + 1) / 2 * c.width, (1 - o.y) / 2 * c.height], k: sp.info.k };
});
fs.writeFileSync(OUT + '/sfondo.png', Buffer.from(r.url.split(',')[1], 'base64'));
fs.writeFileSync(OUT + '/sfondo.json', JSON.stringify({ w: r.w, h: r.h, piede: r.piede.map((v) => Math.round(v)), k: r.k, set }));
console.log('sfondo', r.w, 'x', r.h, 'piedi', r.piede.map((v) => Math.round(v)), 'k', r.k);
await close();
await browser.close();
