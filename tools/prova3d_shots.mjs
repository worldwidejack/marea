#!/usr/bin/env node
// Prova 3D dipinto (#38): screenshot PC 1280×720 e telefono 390×844 + numeri (draw call, triangoli, fps) da window.__prova.
// Uso: node tools/prova3d_shots.mjs [url-base] (default http://localhost:5199). Serve il dev server (vite apps/client).
// Chrome di sistema con la GPU vera (non swiftshader): gli fps sono quelli del Mac, non di un telefono.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests/out/prova3d');
const BASE = process.argv[2] || 'http://localhost:5199';
const pw = createRequire(import.meta.url)('playwright-core');
fs.mkdirSync(OUT, { recursive: true });

const VIEWS = {
  pc: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  tel: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
// inquadrature: [nome, azione]
const SHOTS = [
  ['molo', (p) => p.evaluate(() => window.__prova.goto(24, 3, -Math.PI / 2))],
  ['piazza', (p) => p.evaluate(() => window.__prova.goto(-4, 9, Math.PI))],
  ['barca', (p) => p.evaluate(() => window.__prova.boat(48, -12, 0.9))],
  ['maru', (p) => p.evaluate(() => window.__prova.boat(40, -30, 0.3))],
];
// varianti: normale (kit da codice) e ?ai=1 (case, bancarelle, fontana, lampioni, alberi, passanti e barca generati con l'AI)
const VARIANTS = [['', ''], ['ai_', '?ai=1']];

/** Giro funzionale: a piedi al molo → Salpa → barca fino a Maru → Sbarca → cammina sul molo di Maru. */
async function giro(page) {
  const st = () => page.evaluate(() => window.__prova.state());
  const out = {};
  await page.reload(); await page.waitForFunction(() => window.__prova && window.__prova.ready);
  const m = await page.evaluate(() => { const s = window.__prova.state(); return s; });
  await page.evaluate(() => { const s = window.__prova.state(); window.__prova.goto(s.boat.x - 3.4, s.boat.z); });
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
  out.salpa = (await st()).mode === 'boat';
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  const s1 = await st(); out.barcaSiMuove = Math.hypot(s1.boat.x - m.boat.x, s1.boat.z - m.boat.z) > 3;
  const maru = await page.evaluate(() => window.__prova.moorings().find((x) => x.name === 'Maru'));
  await page.evaluate((mm) => window.__prova.boat(mm.x - 2, mm.z, Math.PI), maru);
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
  const s2 = await st(); out.sbarcaMaru = s2.mode === 'walk' && s2.boat.moored === 'Maru';
  await page.keyboard.down('KeyD'); await page.waitForTimeout(1200); await page.keyboard.up('KeyD');
  const s3 = await st(); out.camminaSulMolo = s3.x - s2.x > 2 && s3.y > 1.4;
  // dal molo fino alla città a piedi (il 7/10 una fessura tra molo e testata a T bloccava tutto)
  await page.reload(); await page.waitForFunction(() => window.__prova && window.__prova.ready);
  await page.keyboard.down('KeyA'); await page.waitForTimeout(6500); await page.keyboard.up('KeyA');
  const s4 = await st(); out.entraInCitta = s4.x < 8 && s4.y > 2.1;
  out.ok = Object.values(out).every(Boolean);
  return out;
}

const browser = await pw.chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const report = {};
for (const [pre, qs] of VARIANTS) for (const [vn0, vp] of Object.entries(VIEWS)) {
  const vn = pre + vn0;
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${m.type()}] ${m.text()}`); });
  const t0 = Date.now();
  await page.goto(`${BASE}/prova3d.html${qs}`, { waitUntil: 'load' });
  await page.waitForFunction((ai) => window.__prova && window.__prova.ready && (!ai || window.__prova.aiReady), !!qs, { timeout: 30000 });
  const loadMs = Date.now() - t0;
  report[vn] = { loadMs, buildMs: await page.evaluate(() => window.__prova.buildMs), shots: {}, errors: errs };
  for (const [sn, act, only] of SHOTS) {
    await act(page);
    await page.waitForTimeout(2500);
    const f = path.join(OUT, `${vn}_${sn}.png`);
    await page.screenshot({ path: f });
    report[vn].shots[sn] = await page.evaluate(() => window.__prova.perf());
  }
  if (!qs && vn0 === 'pc') report.giro = await giro(page);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'numeri.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
