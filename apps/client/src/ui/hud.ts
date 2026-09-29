// HUD in DOM: overlay prestazioni (?fps=1), toast, barra risorse in alto (Legno, Pietra, Perle), chip del cantiere, avviso fisso. WP0 + M1-isola.
import type { Resources } from '@marea/sim';
import type { Flags } from '../flags.ts';
import { injectUiStyle, el } from './style.ts';
import { RES_IDS, resIcon } from './icons.ts';
import type { ResId } from './icons.ts';

export type Hud = {
  setPerf(s: { drawCalls: number; triangles: number; fps: number; frameMs: number }): void;
  toast(text: string, ms?: number): void;
  /** Barra risorse: null la nasconde (niente lotto). Opzionale per compatibilità con HUD finti nei test. */
  setResources?(r: Resources | null): void;
  /** Chip del cantiere sotto la barra («Cava tra 1:32»); null lo nasconde. */
  setWork?(text: string | null, onTap?: () => void): void;
  /** Avviso fisso al centro (es. link non valido); null lo toglie. */
  banner?(text: string | null): void;
  /** Centro della voce della barra in px CSS (destinazione delle risorse che volano). */
  resAnchor?(id: ResId): { x: number; y: number } | null;
  bump?(id: ResId): void;
  readonly root?: HTMLElement;
};

export function createHud(o: { root: HTMLElement; flags: Flags }): Hud {
  injectUiStyle();
  const perf = o.root.querySelector<HTMLElement>('#perf') ?? o.root.appendChild(Object.assign(document.createElement('div'), { id: 'perf' }));
  const toast = o.root.querySelector<HTMLElement>('#toast') ?? o.root.appendChild(Object.assign(document.createElement('div'), { id: 'toast' }));
  // il toast scende sotto barra risorse e chip del cantiere; non intercetta i tocchi
  Object.assign(toast.style, { top: 'calc(max(8px, env(safe-area-inset-top)) + 102px)', zIndex: '26', maxWidth: 'calc(100% - 32px)', textAlign: 'center', pointerEvents: 'none', whiteSpace: 'normal' });
  perf.style.top = 'calc(max(8px, env(safe-area-inset-top)) + 150px)';
  if (o.flags.fps) perf.style.display = 'block';

  const bar = el('div', 'mz mz-bar'); bar.id = 'mzBar';
  const chips = {} as Record<ResId, { chip: HTMLElement; num: HTMLElement }>;
  for (const id of RES_IDS) {
    const chip = el('div', 'mz-chip'); chip.dataset['res'] = id;
    const num = el('b', '', '0');
    chip.append(resIcon(id, 24), num);
    bar.appendChild(chip);
    chips[id] = { chip, num };
  }
  const work = el('div', 'mz mz-work'); work.id = 'mzWork'; work.setAttribute('role', 'button');
  let workTap: (() => void) | undefined;
  work.addEventListener('click', () => workTap?.());
  const ban = el('div', 'mz mz-banner'); ban.id = 'mzBanner'; ban.setAttribute('role', 'alert');
  o.root.append(bar, work, ban);

  let timer = 0;
  const bumps = new Map<ResId, number>();
  return {
    root: o.root,
    setPerf(s) { if (o.flags.fps) perf.textContent = `${s.fps.toFixed(0)} fps · ${s.frameMs.toFixed(1)} ms\n${s.drawCalls} draw · ${(s.triangles / 1000).toFixed(1)}k tri\n${__BUILD__}`; },
    toast(text, ms = 2200) { toast.textContent = text; toast.style.opacity = '1'; clearTimeout(timer); timer = window.setTimeout(() => (toast.style.opacity = '0'), ms); },
    setResources(r) {
      bar.classList.toggle('on', !!r);
      if (!r) return;
      for (const id of RES_IDS) { const t = String(Math.floor(r[id] ?? 0)); if (chips[id].num.textContent !== t) chips[id].num.textContent = t; }
    },
    setWork(text, onTap) {
      work.classList.toggle('on', !!text);
      if (text && work.textContent !== text) work.textContent = text;
      workTap = onTap;
    },
    banner(text) { ban.classList.toggle('on', !!text); ban.textContent = text ?? ''; },
    resAnchor(id) {
      if (!bar.classList.contains('on')) return null;
      const r = chips[id].chip.getBoundingClientRect(), root = o.root.getBoundingClientRect();
      return { x: r.left - root.left + 20, y: r.top - root.top + r.height / 2 };
    },
    bump(id) {
      const c = chips[id].chip; c.classList.add('bump');
      clearTimeout(bumps.get(id)); bumps.set(id, window.setTimeout(() => c.classList.remove('bump'), 350));
    },
  };
}
