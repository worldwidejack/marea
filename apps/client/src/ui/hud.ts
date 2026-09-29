// HUD minimo in DOM: overlay prestazioni (?fps=1) e toast. WP0.
import type { Flags } from '../flags.ts';
export type Hud = { setPerf(s: { drawCalls: number; triangles: number; fps: number; frameMs: number }): void; toast(text: string, ms?: number): void };
export function createHud(o: { root: HTMLElement; flags: Flags }): Hud {
  const perf = o.root.querySelector<HTMLElement>('#perf') ?? o.root.appendChild(Object.assign(document.createElement('div'), { id: 'perf' }));
  const toast = o.root.querySelector<HTMLElement>('#toast') ?? o.root.appendChild(Object.assign(document.createElement('div'), { id: 'toast' }));
  if (o.flags.fps) perf.style.display = 'block';
  let timer = 0;
  return {
    setPerf(s) { if (o.flags.fps) perf.textContent = `${s.fps.toFixed(0)} fps · ${s.frameMs.toFixed(1)} ms\n${s.drawCalls} draw · ${(s.triangles / 1000).toFixed(1)}k tri\n${__BUILD__}`; },
    toast(text, ms = 2200) { toast.textContent = text; toast.style.opacity = '1'; clearTimeout(timer); timer = window.setTimeout(() => (toast.style.opacity = '0'), ms); },
  };
}
