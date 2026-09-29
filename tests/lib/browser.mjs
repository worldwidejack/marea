// playwright-core sul Chrome di sistema (fallback: headless shell in cache). Viewport iPhone o desktop.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const OUT = path.join(ROOT, 'tests/out');
export const SHOTS = path.join(OUT, 'shots');
export const IPHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
export const DESKTOP = { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
const ARGS = ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--mute-audio', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'];
export async function launch() {
  const pw = createRequire(import.meta.url)('playwright-core');
  try { return await pw.chromium.launch({ channel: 'chrome', headless: true, args: ARGS }); }
  catch (e) {
    const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
    const shell = fs.existsSync(cache) ? fs.readdirSync(cache).find((d) => d.startsWith('chromium_headless_shell')) : null;
    if (!shell) throw e;
    const find = (dir) => { for (const en of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, en.name); if (en.isDirectory()) { const r = find(p); if (r) return r; } else if (en.name === 'chrome-headless-shell') return p; } return null; };
    return pw.chromium.launch({ executablePath: find(path.join(cache, shell)), headless: true, args: ARGS });
  }
}
export async function openPage(browser, url, { viewport = IPHONE } = {}) {
  const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch });
  const page = await ctx.newPage();
  const errors = [], consoleErrors = [], failed = [], logs = [];
  page.on('pageerror', (e) => errors.push(String(e && (e.stack || e.message) || e)));
  page.on('console', (m) => { const tx = m.text(); logs.push(`[${m.type()}] ${tx}`); if (m.type() === 'error') consoleErrors.push(tx); });
  page.on('requestfailed', (r) => { const u = r.url(); const why = r.failure()?.errorText || ''; if (why === 'net::ERR_ABORTED') return; /* richiesta annullata (pagina chiusa o fetch duplicata): non è un errore */ if (!u.startsWith('data:') && !u.includes('/ws/')) failed.push(u + ' ' + why); });
  await page.goto(url, { waitUntil: 'load' });
  return { page, errors, consoleErrors, failed, logs, close: () => ctx.close() };
}
export const waitReady = (page, timeout = 10000) => page.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout });
export async function waitState(page, fnSrc, timeout = 10000, arg = null) {
  const fn = typeof fnSrc === 'function' ? fnSrc.toString() : fnSrc;
  await page.waitForFunction(([f, a]) => { try { return (0, eval)('(' + f + ')')(window.__game.state(), a); } catch { return false; } }, [fn, arg], { timeout, polling: 100 });
}
export const getState = (page) => page.evaluate(() => window.__game.state());
export const getPerf = (page) => page.evaluate(() => window.__game.perf());
export async function shot(page, name) { fs.mkdirSync(SHOTS, { recursive: true }); const f = path.join(SHOTS, name.replace(/[^\w.-]+/g, '_') + '.png'); await page.screenshot({ path: f }); return f; }
export async function screenStats(page) {
  const b64 = (await page.screenshot()).toString('base64');
  return page.evaluate(async (src) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
    const c = document.createElement('canvas'); c.width = 160; c.height = 90; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 160, 90);
    const d = g.getImageData(0, 0, 160, 90).data; let s = 0, s2 = 0; const n = 160 * 90;
    for (let i = 0; i < d.length; i += 4) { const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; s += l; s2 += l * l; }
    const mean = s / n; return { mean, variance: s2 / n - mean * mean };
  }, b64);
}
/**
 * Campiona `n` pixel (posizioni pseudo-casuali con seme fisso: riproducibile) dello screenshot corrente e restituisce [r,g,b,...] piatto.
 * Con `hideUi` nasconde #ui (HUD, joystick, toast) solo per la cattura, così si misura il mondo e non l'interfaccia.
 */
export async function samplePixels(page, n = 2000, { hideUi = true, seed = 12345 } = {}) {
  let prev = null;
  if (hideUi) prev = await page.evaluate(() => { const u = document.getElementById('ui'); if (!u) return null; const v = u.style.visibility; u.style.visibility = 'hidden'; return v; });
  const b64 = (await page.screenshot()).toString('base64');
  if (hideUi && prev !== null) await page.evaluate((v) => { const u = document.getElementById('ui'); if (u) u.style.visibility = v; }, prev);
  return page.evaluate(async ([src, count, sd]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    let s = sd >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const out = [];
    for (let i = 0; i < count; i++) { const d = g.getImageData(Math.floor(rnd() * img.width), Math.floor(rnd() * img.height), 1, 1).data; out.push(d[0], d[1], d[2]); }
    return out;
  }, [b64, n, seed]);
}
