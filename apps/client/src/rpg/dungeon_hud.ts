// HUD del dungeon (R-scena): tre barre a pixel in alto a sinistra (Vita rosso lanterna, Magicka acqua, Stamina erba) con i numeri;
// frecce, pozioni, magia preparata, peso dello zaino, monete e tempo; numeri del danno che saltano (bianco i tuoi, rosso quelli presi);
// barre vita dei nemici feriti; avvisi brevi per gli eventi; scritta grande a fine discesa. Con `body.mz-sotto` l'interfaccia di
// superficie (bussola, barra in alto, risorse, guida, cartelli, GIOCA, emote) si nasconde. Solo colori di palette, bordi netti.
import * as THREE from 'three';
import type { DungeonEvent, DungeonView } from '@marea/sim/dungeon/types.ts';
import type { RunHero } from '@marea/sim/rpg/types.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import { PAL, el } from '../ui/style.ts';
import { iconOf, itemIcon } from './items_ui.ts';
import type { Bar } from './dungeon_actors.ts';

export type DungeonHud = {
  set(v: DungeonView, maxTicks: number): void;
  /** Numero che salta da un punto del mondo. */
  number(p: THREE.Vector3, text: string, kind: 'dato' | 'preso' | 'cura' | 'info', big?: boolean): void;
  bars(list: Bar[]): void;
  /** Dungeon insieme (#118): nome e vita sopra la testa dei compagni. */
  compagni(list: { pos: THREE.Vector3; nome: string; frac: number }[]): void;
  /** Avviso breve (compagno uscito, caduto…). */
  say(text: string, ms?: number): void;
  event(e: DungeonEvent): void;
  big(text: string | null, color?: string, sub?: string): void;
  /** Scritta grande che sparisce da sola dopo `ms` (SALVATO alla lanterna). */
  flash(text: string, color: string, sub: string, ms: number): void;
  /** Icone di C e D; `key` cambia quando cambiano magia o pozione pronte. */
  icons(): { c: Node | null; d: Node | null; key: string };
  /** RunHero rifatto (cambio d'equipaggiamento nel dungeon): frecce, pozione e magia pronte nuove. */
  setHero(h: RunHero): void;
  dispose(): void;
};

const P = PAL;
/** Corona a pixel sopra la barra del capo (7×5 celle, gialla con due gemme rosse). */
const CROWN_ROWS = ['Y..Y..Y', 'YY.Y.YY', 'YYYYYYY', 'YRYYYRY', 'YYYYYYY'];
const CROWN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 5" width="21" height="15" shape-rendering="crispEdges" style="display:block">${
  CROWN_ROWS.map((r, y) => [...r].map((c, x) => (c === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${c === 'R' ? P.rosso : P.giallo}"/>`)).join('')).join('')}</svg>`;
const CSS = `
body.mz-sotto #compass, body.mz-sotto #mzTop, body.mz-sotto #mzGuida, body.mz-sotto #mzGuidaPtr, body.mz-sotto .mz-bar, body.mz-sotto .mz-work,
body.mz-sotto .mz-labels, body.mz-sotto #mzPlay, body.mz-sotto #mzEmoteRow, body.mz-sotto #mzEmotes, body.mz-sotto #mzSheet { display: none !important; }
.mz-dng-hud { position: absolute; left: max(8px, env(safe-area-inset-left, 0px)); top: max(8px, env(safe-area-inset-top)); width: 196px; padding: 6px 8px 7px; background: rgba(35,32,31,.86); border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; z-index: 13; pointer-events: none !important; font-size: 12px; }
.mz-dng-hud .r { display: flex; align-items: center; gap: 6px; height: 17px; }
.mz-dng-hud .r + .r { margin-top: 3px; }
.mz-dng-hud .bar { position: relative; flex: 1; height: 12px; background: ${P.ombraCalda}; border: 2px solid ${P.neroCaldo}; }
.mz-dng-hud .bar i { position: absolute; left: 0; top: 0; bottom: 0; }
.mz-dng-hud .bar i.lag { background: ${P.sabbiaChiara}; }
.mz-dng-hud .n { min-width: 52px; text-align: right; font-weight: bold; font-size: 12px; }
.mz-dng-hud .k { width: 10px; font-weight: bold; }
.mz-dng-hud .row2 { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 6px; font-weight: bold; font-size: 13px; align-items: center; }
.mz-dng-hud .row2 span { display: inline-flex; align-items: center; gap: 3px; }
.mz-dng-hud .row2 .warn { color: ${P.rosso}; }
.mz-dng-fx { position: absolute; inset: 0; pointer-events: none !important; z-index: 12; overflow: hidden; }
.mz-dng-num { position: absolute; left: 0; top: 0; font: bold 16px ui-monospace, Menlo, monospace; text-shadow: 2px 2px 0 ${P.neroCaldo}; animation: mzDngNum .8s steps(8) forwards; white-space: nowrap; }
.mz-dng-num.big { font-size: 22px; }
.mz-dng-num.dato { color: ${P.sabbiaChiara}; } .mz-dng-num.preso { color: ${P.rosso}; } .mz-dng-num.cura { color: ${P.erbaChiara}; } .mz-dng-num.info { color: ${P.giallo}; font-size: 13px; }
@keyframes mzDngNum { 0% { translate: -50% 0; opacity: 1; } 70% { opacity: 1; } 100% { translate: -50% -42px; opacity: 0; } }
.mz-dng-hp { position: absolute; left: 0; top: 0; width: 40px; height: 6px; background: ${P.neroCaldo}; border: 1px solid ${P.neroCaldo}; }
.mz-dng-hp.boss { width: 72px; height: 8px; }
.mz-dng-hp b { display: none; position: absolute; left: 50%; bottom: calc(100% + 4px); transform: translateX(-50%); filter: drop-shadow(0 2px 0 ${P.neroCaldo}); }
.mz-dng-hp.capo b { display: block; }
.mz-dng-hp.capo { border-color: ${P.giallo}; }
.mz-dng-hp i { display: block; height: 100%; background: ${P.rosso}; }
.mz-dng-hp.ally i { background: #8A5CFF; }
.mz-dng-amico { position: absolute; left: 0; top: 0; text-align: center; font: bold 12px ui-monospace, Menlo, monospace; color: ${P.sabbiaChiara}; text-shadow: 1px 1px 0 ${P.neroCaldo}, -1px 1px 0 ${P.neroCaldo}; white-space: nowrap; }
.mz-dng-amico i { display: block; width: 44px; height: 6px; margin: 2px auto 0; background: ${P.neroCaldo}; border: 1px solid ${P.neroCaldo}; }
.mz-dng-amico i b { display: block; height: 100%; background: ${P.erbaChiara}; }
.mz-dng-toast { position: absolute; left: 50%; top: 27%; transform: translateX(-50%); padding: 6px 12px; background: rgba(46,30,20,.94); border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; font-weight: bold; font-size: 15px; z-index: 15; pointer-events: none !important; display: none; max-width: calc(100% - 32px); text-align: center; }
.mz-dng-toast.on { display: block; }
.mz-dng-big { position: absolute; left: 50%; top: 34%; transform: translate(-50%, -50%); display: none; padding: 12px 22px; background: rgba(46,30,20,.95); border: 3px solid ${P.legnoChiaro}; box-shadow: 0 5px 0 ${P.neroCaldo}; text-align: center; z-index: 18; pointer-events: none !important; font: bold 36px ui-monospace, Menlo, monospace; white-space: nowrap; }
.mz-dng-big.on { display: block; }
.mz-dng-big small { display: block; margin-top: 6px; font-size: 14px; color: ${P.sabbia}; }
`;
const nome = (id: string) => (hasItem(id) ? itemDef(id).nome : id);
const fmt = (s: number) => { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };

export function createDungeonHud(o: { root: HTMLElement; canvas: HTMLCanvasElement; camera: THREE.Camera; hero: RunHero }): DungeonHud {
  if (!document.getElementById('mz-dng-hud-style')) { const st = document.createElement('style'); st.id = 'mz-dng-hud-style'; st.textContent = CSS; document.head.appendChild(st); }
  const box = el('div', 'mz mz-dng-hud'); box.id = 'mzDngHud';
  const mkBar = (k: string, c: string) => {
    const r = el('div', 'r'), b = el('div', 'bar'), lag = el('i', 'lag'), fill = el('i'), n = el('span', 'n');
    fill.style.background = c; b.append(lag, fill); r.append(el('span', 'k', k), b, n); box.appendChild(r);
    return { fill, lag, n, last: '', lagV: 1 };
  };
  const bars = { vita: mkBar('V', P.rosso), magicka: mkBar('M', P.acqua), stamina: mkBar('S', P.erba) };
  const row2 = el('div', 'row2'); box.appendChild(row2);
  const fx = el('div', 'mz mz-dng-fx');
  const toast = el('div', 'mz mz-dng-toast'); toast.id = 'mzDngToast';
  const big = el('div', 'mz mz-dng-big'); big.id = 'mzDngBig';
  o.root.append(box, fx, toast, big);

  // icone: frecce e pozione rapida dal catalogo, magia come libro col colore della scuola
  let rh = o.hero;
  const arrowsIco = () => (rh.frecce && hasItem(rh.frecce.id) ? iconOf(itemDef(rh.frecce.id), 16) : null);
  let pot = rh.pozione !== null ? rh.pozioni[rh.pozione] ?? null : null;
  let spell = rh.magia !== null ? rh.magie[rh.magia] ?? null : null;
  const potIco = (px: number) => (pot && hasItem(pot.id) ? iconOf(itemDef(pot.id), px) : null);
  const spellIco = (px: number) => (spell ? itemIcon('libro', spell.scuola === 'evocazione' ? P.viola : P.arancio, px) : null);
  let rowSig = '', toastT = 0, bigOn = false, flashT = 0;
  const v3 = new THREE.Vector3();
  const screen = (p: THREE.Vector3) => {
    v3.copy(p).project(o.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    return { x: r.left - rr.left + ((v3.x + 1) / 2) * r.width, y: r.top - rr.top + ((1 - v3.y) / 2) * r.height, on: v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 };
  };
  const say = (text: string, ms = 1600) => { toast.textContent = text; toast.classList.add('on'); clearTimeout(toastT); toastT = window.setTimeout(() => toast.classList.remove('on'), ms); };
  const hpPool: HTMLElement[] = [], amici: HTMLElement[] = [];

  return {
    set(v, maxTicks) {
      const h = v.hero;
      for (const k of ['vita', 'magicka', 'stamina'] as const) {
        const b = bars[k], max = Math.max(1, h.max[k]), f = Math.max(0, Math.min(1, h[k] / max));
        b.lagV = Math.max(f, b.lagV - 0.006); // la parte persa resta chiara un attimo e poi scende
        const w = `${Math.round(f * 50) * 2}%`, lw = `${Math.round(b.lagV * 50) * 2}%`, n = `${Math.ceil(h[k])}/${Math.round(max)}`;
        const sig = w + lw + n;
        if (sig !== b.last) { b.last = sig; b.fill.style.width = w; b.lag.style.width = lw; b.n.textContent = n; }
      }
      const left = Math.max(0, (maxTicks - v.tick) / 60), z = v.zaino;
      const sig = `${h.frecce}|${h.pozioni}|${Math.round(z.peso)}|${Math.round(z.max)}|${z.monete}|${Math.floor(left)}|${rh.frecce?.id}|${pot?.id}`;
      if (sig !== rowSig) {
        rowSig = sig;
        const it = (ico: Node | null, text: string, cls = '') => { const s = el('span', cls); if (ico) s.appendChild(ico); s.appendChild(document.createTextNode(text)); return s; };
        const kids: Node[] = [];
        if (rh.frecce || rh.arma.kind === 'arco') kids.push(it(arrowsIco(), `${h.frecce}`, h.frecce === 0 ? 'warn' : ''));
        if (pot) kids.push(it(potIco(16), `${h.pozioni}`, h.pozioni === 0 ? 'warn' : ''));
        kids.push(it(itemIcon('materiale', P.legnoChiaro, 16), `${Math.round(z.peso)}/${Math.round(z.max)} kg`, z.peso >= z.max ? 'warn' : ''));
        kids.push(it(itemIcon('anello', P.giallo, 16), `${z.monete}`));
        kids.push(it(null, fmt(left), left < 60 ? 'warn' : ''));
        row2.replaceChildren(...kids);
      }
    },
    number(p, text, kind, isBig) {
      const s = screen(p); if (!s.on) return;
      const n = el('div', `mz-dng-num ${kind}${isBig ? ' big' : ''}`, text);
      n.style.left = `${Math.round(s.x + (Math.random() - 0.5) * 16)}px`; n.style.top = `${Math.round(s.y)}px`;
      n.addEventListener('animationend', () => n.remove());
      fx.appendChild(n);
      while (fx.querySelectorAll('.mz-dng-num').length > 24) fx.querySelector('.mz-dng-num')?.remove();
    },
    bars(list) {
      let i = 0;
      for (const b of list) {
        const s = screen(b.pos); if (!s.on) continue;
        let e = hpPool[i];
        if (!e) { e = el('div', 'mz-dng-hp'); e.appendChild(el('i')); const c = el('b'); c.innerHTML = CROWN; e.appendChild(c); fx.appendChild(e); hpPool.push(e); } // SVG statico
        e.className = `mz-dng-hp${b.boss ? ' boss' : ''}${b.ally ? ' ally' : ''}${b.capo ? ' capo' : ''}`;
        (e.firstChild as HTMLElement).style.width = `${Math.max(1, Math.round(b.frac * 10)) * 10}%`;
        e.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%)`; e.style.display = 'block';
        i++;
      }
      for (; i < hpPool.length; i++) hpPool[i]!.style.display = 'none';
    },
    compagni(list) {
      let i = 0;
      for (const c of list) {
        const s = screen(c.pos); if (!s.on) continue;
        let e = amici[i];
        if (!e) { e = el('div', 'mz-dng-amico'); e.append(el('span'), el('i')); (e.lastChild as HTMLElement).appendChild(el('b')); fx.appendChild(e); amici.push(e); }
        if ((e.firstChild as HTMLElement).textContent !== c.nome) (e.firstChild as HTMLElement).textContent = c.nome;
        ((e.lastChild as HTMLElement).firstChild as HTMLElement).style.width = `${Math.max(0, Math.round(c.frac * 10)) * 10}%`;
        e.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%)`; e.style.display = 'block';
        i++;
      }
      for (; i < amici.length; i++) amici[i]!.style.display = 'none';
    },
    say: (text, ms) => say(text, ms),
    event(e) {
      switch (e.t) {
        case 'raccolto': say(`+${e.n} ${nome(e.item)}`); break;
        case 'monete': say(`+${e.n} monete`); break;
        case 'pieno': say(`Zaino pieno: ${nome(e.item)} resta lì`, 2200); break;
        case 'rotto': say(`${nome(e.item)} si è rotta!`, 2400); break;
        case 'senzaMagicka': say('Magicka finita', 1200); break;
        case 'senzaFrecce': say('Frecce finite', 1400); break;
        case 'libro': say(`Hai imparato: ${nome(e.item).replace(/^Libro: /, '')}`, 2600); break;
        case 'evocato': say('Un alleato combatte per te', 1800); break;
        case 'risveglio': say('Ti risvegli alla lanterna: perso solo il bottino raccolto dopo', 3200); break;
        case 'valvola': say('Valvola girata: l’acqua scende…', 2200); break;
        case 'asciutto': say('Svuotato: adesso si passa', 2200); break;
        case 'rallentato': say('La fanghiglia ti rallenta', 1600); break;
        default:
      }
    },
    big(text, color, sub) {
      clearTimeout(flashT);
      bigOn = !!text; big.classList.toggle('on', bigOn);
      if (!text) return;
      big.textContent = text; big.style.color = color ?? P.sabbiaChiara; big.style.borderColor = color ?? P.legnoChiaro;
      if (sub) big.appendChild(el('small', '', sub));
    },
    icons: () => ({ c: spellIco(24), d: potIco(24), key: `${spell?.id ?? ''}|${pot?.id ?? ''}` }),
    setHero(h) {
      rh = h; rowSig = '';
      pot = rh.pozione !== null ? rh.pozioni[rh.pozione] ?? null : null;
      spell = rh.magia !== null ? rh.magie[rh.magia] ?? null : null;
    },
    flash(text, color, sub, ms) {
      this.big(text, color, sub);
      flashT = window.setTimeout(() => { bigOn = false; big.classList.remove('on'); }, ms);
    },
    dispose() { clearTimeout(toastT); clearTimeout(flashT); for (const e of [box, fx, toast, big]) e.remove(); },
  };
}
