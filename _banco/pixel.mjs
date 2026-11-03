// Banco pixel (3/11): lo stesso punto del Borgo vero con lo sprite a densità diverse, sul Retina del Mac e sul telefono.
// «adesso» = come il banco di prima (scala continua, mondo a 0,75); gli altri: ?blocca=1&pxschermo=N, cioè un pixel di gioco = N pixel
// veri dello schermo e la camera alla distanza a cui un pixel dello sprite è un pixel di gioco. Foto intere e primo piano in tests/out/banco-pixel/.
// uso: node _banco/pixel.mjs [porta]
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { WT, IPHONE } from './lib.mjs';
const B = await import(pathToFileURL(WT + '/tests/lib/browser.mjs').href);
const OUT = WT + '/tests/out/banco-pixel';
fs.mkdirSync(OUT, { recursive: true });
const porta = process.argv[2] || '5176';
const MAC = { width: 1512, height: 945, deviceScaleFactor: 2, isMobile: false, hasTouch: false };
const PROVE = [
  ['mac', MAC, 'adesso', 'scugnizzo', ''],
  ['mac', MAC, 'hd48-p3', 'scugnizzo-hd48', '&blocca=1&pxschermo=3'],
  ['mac', MAC, 'hd64-p2', 'scugnizzo-hd64', '&blocca=1&pxschermo=2'],
  ['mac', MAC, 'hd96-p2', 'scugnizzo-hd96', '&blocca=1&pxschermo=2'],
  ['mac', MAC, 'hd96-p1', 'scugnizzo-hd96', '&blocca=1&pxschermo=1'],
  ['mac', MAC, 'nitido', 'scugnizzo', '&nitido=1'],
  ['mac', MAC, 'blocca-vecchio', 'scugnizzo', '&blocca=1&pxschermo=3'],
  ['tel', IPHONE, 'adesso', 'scugnizzo', ''],
  ['tel', IPHONE, 'hd64-p3', 'scugnizzo-hd64', '&blocca=1&pxschermo=3'],
  ['tel', IPHONE, 'hd64-p2', 'scugnizzo-hd64', '&blocca=1&pxschermo=2'],
  ['tel', IPHONE, 'hd96-p1', 'scugnizzo-hd96', '&blocca=1&pxschermo=1'],
  ['tel', IPHONE, 'hd96-p2', 'scugnizzo-hd96', '&blocca=1&pxschermo=2'],
];
const solo = process.argv.slice(3);
const browser = await B.launch();
for (const [schermo, vp, nome, set, extra] of PROVE) {
  if (solo.length && !solo.includes(`${schermo}-${nome}`)) continue;
  const { page, errors, close } = await B.openPage(browser, `http://localhost:${porta}/_banco.html?test=1&net=0&slot=0&sprite=${set}${extra}`, { viewport: vp });
  await B.waitReady(page, 120000);
  for (let i = 0; i < 60 && !(await page.evaluate(() => !!window.__sp)); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(2500);
  const foto = async (tipo) => {
    const p = await page.evaluate(() => {
      const b = window.__banco, cam = b.camera, sp = window.__sp, v = sp.st, o = cam.position.clone();
      o.set(v.x, 0.8, v.z).project(cam);
      const c = b.renderer.domElement;
      return { x: (o.x + 1) / 2 * innerWidth, y: (1 - o.y) / 2 * innerHeight, info: sp.info, tela: [c.width, c.height] };
    });
    await page.screenshot({ path: `${OUT}/${schermo}_${nome}_${tipo}.png` });
    const w = Math.round(vp.width * 0.32), h = Math.round(w * 0.9);
    const clip = { x: Math.max(0, Math.round(p.x - w / 2)), y: Math.max(0, Math.round(p.y - h * 0.55)), width: w, height: h };
    await page.screenshot({ path: `${OUT}/${schermo}_${nome}_${tipo}_vicino.png`, clip });
    return p;
  };
  // verso la camera (giù a destra sullo schermo): si vede la faccia; poi fermo, sempre girato verso di noi
  await page.keyboard.down('KeyS'); await page.waitForTimeout(900);
  await foto('cammina');
  await page.keyboard.up('KeyS'); await page.waitForTimeout(600);
  const p = await foto('fermo');
  console.log(schermo, nome, JSON.stringify({ tela: p.tela, k: p.info.k, ppu: p.info.pxGiocoPerUnita, altoPxGioco: p.info.altoPxGioco, frame: p.info.frame }), errors.slice(0, 2));
  await close();
}
await browser.close();
