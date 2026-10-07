#!/usr/bin/env node
// Prova pixel 3D (#46) e stili (#50): screenshot PC 1280×720 e telefono 390×844, «come il gioco» e i 3 stili nuovi, le 5 camere,
// numeri (draw call, triangoli, fps) da window.__provapixel e un foglio di confronto (confronto.png).
// Uso: node tools/provapixel_shots.mjs [url-base] (default http://localhost:5199). Serve il dev server (vite apps/client).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests/out/provapixel');
const BASE = process.argv[2] || 'http://localhost:5199';
const pw = createRequire(import.meta.url)('playwright-core');
fs.mkdirSync(OUT, { recursive: true });

const VIEWS = {
  pc: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  tel: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
// inquadrature: [nome, azione]; coordinate in metri (Porto ~220-308 × 240-316, lotto 1 a nord, lotto 3 a ovest)
const SHOTS = [
  ['porto', (p) => p.evaluate(() => { const h = window.__provapixel.home; window.__provapixel.goto(h.x, h.z); })],
  ['molo', (p) => p.evaluate(() => { const d = window.__provapixel.dock; window.__provapixel.goto(d.x - 2, d.z - 4); })],
  ['lotto', (p) => p.evaluate(() => window.__provapixel.goto(246, 192))],
  ['barca', (p) => p.evaluate(() => window.__provapixel.boat(206, 262, 2.4))],
];
const LOOKS = [['gioco', ['gioco']], ['stampa', ['tutto', { stile: 'stampa' }]], ['tramonto', ['tutto', { stile: 'tramonto' }]], ['giorno', ['tutto', { stile: 'giorno' }]]];

const browser = await pw.chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const report = {};
for (const [vn, vp] of Object.entries(VIEWS)) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${m.type()}] ${m.text()}`); });
  const t0 = Date.now();
  await page.goto(`${BASE}/provapixel.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__provapixel && window.__provapixel.ready, null, { timeout: 30000 });
  report[vn] = { loadMs: Date.now() - t0, shots: {}, errors: errs };
  for (const [sn, act] of SHOTS) for (const [ln, preset] of LOOKS) {
    await page.evaluate((list) => { for (const s of list) window.__provapixel.set(s); }, preset);
    await act(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `${vn}_${sn}_${ln}.png`) });
    report[vn].shots[`${sn}_${ln}`] = await page.evaluate(() => window.__provapixel.perf());
  }
  // le 5 camere sul Porto, tutto acceso
  for (let c = 0; c < 5; c++) {
    await page.evaluate((cam) => { window.__provapixel.set('tutto'); window.__provapixel.set({ cam }); const h = window.__provapixel.home; window.__provapixel.goto(h.x, h.z); }, c); // stile di partenza
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, `${vn}_cam${c}.png`) });
  }
  // giro: a piedi qualche passo, poi in barca dal molo (il molo del gioco, stesso codice)
  await page.evaluate(() => { window.__provapixel.set('tutto'); const h = window.__provapixel.home; window.__provapixel.goto(h.x, h.z); });
  const s0 = await page.evaluate(() => window.__provapixel.state());
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
  const s1 = await page.evaluate(() => window.__provapixel.state());
  report[vn].cammina = Math.hypot(s1.x - s0.x, s1.z - s0.z) > 1;
  await ctx.close();
}
await browser.close();

// foglio di confronto: per ogni inquadratura PC, gioco a sinistra e nuovo a destra; sotto il telefono
const img = (f) => `<img src="${pathToFileURL(path.join(OUT, f)).href}">`;
const rowsPc = SHOTS.map(([sn]) => `<div class="r"><b>${sn}</b>${LOOKS.map(([ln]) => img(`pc_${sn}_${ln}.png`)).join('')}</div>`).join('');
const rowsTel = `<div class="r"><b>telefono</b>${LOOKS.map(([ln]) => img(`tel_porto_${ln}.png`) + img(`tel_barca_${ln}.png`)).join('')}</div>`;
const html = `<html><body style="margin:0;background:#23201F;color:#F4E3C1;font:bold 20px ui-monospace,Menlo,monospace">
<style>.r{display:flex;gap:8px;align-items:center;padding:6px}.r b{width:110px}.r span{width:640px}.r img{height:360px;image-rendering:pixelated}.t img{height:420px}</style>
<div class="r"><b></b>${LOOKS.map(([ln]) => `<span>${ln.toUpperCase()}</span>`).join('')}</div>${rowsPc}<div class="t">${rowsTel}</div></body></html>`;
const sheet = path.join(OUT, 'confronto.html');
fs.writeFileSync(sheet, html);
const b2 = await pw.chromium.launch({ channel: 'chrome', headless: true });
const p2 = await (await b2.newContext({ viewport: { width: 2730, height: 900 } })).newPage();
await p2.goto(pathToFileURL(sheet).href); await p2.waitForTimeout(500);
await p2.screenshot({ path: path.join(OUT, 'confronto.png'), fullPage: true });
await b2.close();
fs.writeFileSync(path.join(OUT, 'numeri.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
