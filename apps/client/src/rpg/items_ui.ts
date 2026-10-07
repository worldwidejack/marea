// Pezzi comuni dei pannelli GDR (R-pannelli): nomi italiani, icone a pixel degli oggetti (canvas 8×8 col colore del materiale), barre, righe.
// Solo colori di PAL: il colore di un oggetto si riporta al più vicino della palette.
import type { AttrId, ItemKind, SkillId } from '@marea/content/rpg.ts';
import type { EquipSlot, HeroState, ItemDef, RpgAction } from '@marea/sim/rpg/types.ts';
import type { LotState } from '@marea/sim';
import type { PanelCtx } from './types.ts';
import { PAL, el } from '../ui/style.ts';

export const SKILL_NOME: Record<SkillId, string> = {
  armiLeggere: 'Armi leggere', armiPesanti: 'Armi pesanti', arceria: 'Arceria', distruzione: 'Distruzione',
  evocazione: 'Evocazione', forgiatura: 'Forgiatura', alchimia: 'Alchimia',
};
export const ATTR_NOME: Record<AttrId, string> = { vita: 'Vita', magicka: 'Magicka', stamina: 'Stamina' };
export const ATTR_COL: Record<AttrId, string> = { vita: PAL.rosso, magicka: PAL.acqua, stamina: PAL.erba };
export const SLOT_NOME: Record<EquipSlot, string> = {
  arma: 'Arma', frecce: 'Frecce', corpo: 'Corpo', anello1: 'Anello 1', anello2: 'Anello 2', pozione: 'Pozione rapida', magia: 'Magia',
};
export const GROUPS: readonly { id: string; nome: string; kinds: readonly ItemKind[] }[] = [
  { id: 'armi', nome: 'Armi', kinds: ['arma'] }, { id: 'archi', nome: 'Archi e frecce', kinds: ['arco', 'frecce'] },
  { id: 'armature', nome: 'Armature e vesti', kinds: ['armatura', 'veste'] }, { id: 'anelli', nome: 'Anelli', kinds: ['anello'] },
  { id: 'pozioni', nome: 'Pozioni', kinds: ['pozione'] }, { id: 'libri', nome: 'Libri', kinds: ['libro'] },
  { id: 'materiali', nome: 'Materiali', kinds: ['materiale'] }, { id: 'ingredienti', nome: 'Ingredienti', kinds: ['ingrediente'] },
];

/** Stato di interfaccia condiviso tra le schede (resta finché il chunk è caricato). */
export type UiState = {
  tab: 'pg' | 'abilita' | 'zaino';
  skill: SkillId | null; item: string | null;
  mat: string; cat: string;
  chest: { side: 'zaino' | 'forziere'; id: string } | null;
  serra: { arrivati: Record<string, number>; dove: string } | null;
  /** Dopo il prossimo ridisegno: porta in vista l'elemento con questo data-k. */
  focus: string | null;
  /** «Butta via» toccato una volta: aspetta la conferma (stesso oggetto e quantità). */
  butta: { item: string; n: number } | null;
};
/** Quello che ogni scheda riceve per disegnarsi. */
export type View = {
  ctx: PanelCtx; lot: LotState; hero: HeroState; busy: boolean; ui: UiState;
  /** Scheda aperta nel dungeon (zaino della spedizione): equip e butta vanno alla sim, il resto si fa fuori. */
  sotto: boolean;
  /** Esegue un'azione sul server; `ok` compone il toast dal lotto nuovo. */
  act(a: RpgAction, ok?: (l: LotState) => string | void): void;
  rerender(): void;
};

const num = (x: number, d = 1): string => (Math.round(x * 10 ** d) / 10 ** d).toString().replace('.', ',');
export const fmtN = num;
export const fmtKg = (x: number): string => `${num(x)} kg`;

// ---------- colore più vicino della palette ----------
const PAL_RGB = Object.values(PAL).map((h) => [h, parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const);
const palCache = new Map<string, string>();
export function palColor(hex: string): string {
  let c = palCache.get(hex);
  if (c) return c;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  let best: string = PAL.pietra, bd = Infinity;
  for (const [h, pr, pg, pb] of PAL_RGB) { const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2; if (d < bd) { bd = d; best = h; } }
  palCache.set(hex, best);
  return best;
}

// ---------- icone 8×8: m = colore dell'oggetto, w = luce, b/c = manico, d = ombra ----------
const ART: Record<ItemKind, readonly string[]> = {
  arma: ['......wm', '.....wm.', '....wm..', '...wm...', '.bwm....', '..b.....', '.c.b....', 'c.......'],
  arco: ['..mm....', '.m..w...', 'm...w...', 'm...w...', 'm...w...', 'm...w...', '.m..w...', '..mm....'],
  frecce: ['.....mmm', '......mm', '.....b.m', '....b...', '...b....', 'w.b.....', '.w......', 'w.w.....'],
  armatura: ['.mm..mm.', 'mmmmmmmm', 'mmmmmmmm', '.mmmmmm.', '.mmddmm.', '.mmmmmm.', '.mmmmmm.', '.mm..mm.'],
  veste: ['..m..m..', '.mmmmmm.', '.mmwwmm.', '..mmmm..', '..mmmm..', '.mmmmmm.', '.mmmmmm.', 'mmmmmmmm'],
  anello: ['...ww...', '...ww...', '..mmmm..', '.m....m.', '.m....m.', '.m....m.', '..mmmm..', '........'],
  pozione: ['...cc...', '...ww...', '...ww...', '..wmmw..', '.wmmmmw.', '.wmmmmw.', '.wmmmmw.', '..wwww..'],
  libro: ['mmmmmmm.', 'mwwwwwmd', 'mwddwwmd', 'mwwwwwmd', 'mwddwwmd', 'mwwwwwmd', 'mmmmmmmd', '.ddddddd'],
  materiale: ['........', '........', '..wwww..', '.wmmmmm.', 'mmmmmmmd', 'mmmmmmmd', '.ddddddd', '........'],
  ingrediente: ['.....mm.', '....mmmm', '...mmwmm', '..mmwmm.', '.mmwmm..', '.mwmm...', '.dmm....', 'd.......'],
};
export function itemIcon(kind: ItemKind, color: string, px = 24): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8; c.className = 'mz-ico mz-rp-ico'; c.setAttribute('aria-hidden', 'true');
  c.style.width = c.style.height = px + 'px';
  const g = c.getContext('2d');
  if (!g) return c;
  const m = palColor(color);
  const dark = m === PAL.neroCaldo || m === PAL.roccia || m === PAL.legnoScuro;
  const col: Record<string, string> = { m, w: dark ? PAL.pietra : PAL.sabbiaChiara, b: PAL.legno, c: PAL.legnoScuro, d: PAL.neroCaldo };
  (ART[kind] ?? ART.materiale).forEach((row, y) => { for (let x = 0; x < 8; x++) { const k = col[row[x] ?? '.']; if (k) { g.fillStyle = k; g.fillRect(x, y, 1, 1); } } });
  return c;
}
export const iconOf = (it: ItemDef, px = 24): HTMLCanvasElement => itemIcon(it.kind, it.colore, px);

// ---------- pezzi DOM ----------
export function sec(title: string, right?: string): HTMLElement {
  const s = el('div', 'mz-rp-sec', title);
  if (right) s.appendChild(el('span', 'r', right));
  return s;
}
export function bar(frac: number, color: string = PAL.giallo): HTMLElement {
  const b = el('div', 'mz-rp-bar'), i = el('i');
  i.style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
  i.style.background = color;
  b.appendChild(i);
  return b;
}
export function stat(label: string, value: string, color?: string): HTMLElement {
  const r = el('div', 'mz-rp-stat');
  const l = el('span', 'l');
  if (color) { const sq = el('i', 'sq'); sq.style.background = color; l.appendChild(sq); }
  l.append(label);
  r.append(l, el('b', '', value));
  return r;
}
/** Bottone generico dei pannelli GDR (stile .mz-btn); `k` serve a ritrovare il fuoco dopo un ridisegno. */
export function button(k: string, main: string, sub: string, cls: string, disabled: boolean, onClick: () => void): HTMLButtonElement {
  const b = el('button', 'mz-btn ' + cls);
  b.type = 'button'; b.dataset['k'] = k; b.disabled = disabled;
  b.appendChild(el('span', '', main));
  if (sub) b.appendChild(el('span', 'sub', sub));
  b.addEventListener('click', () => { if (!b.disabled) onClick(); });
  return b;
}
/** Riga toccabile (≥ 48 px): icona, nome intero e sotto un testo corto (quantità, peso, costo); i cartellini si aggiungono in fondo. */
export function row(k: string, icon: Node | null, name: string, sub: string, on: boolean, onClick: () => void): HTMLButtonElement {
  const r = el('button', 'mz-rp-row' + (on ? ' on' : ''));
  r.type = 'button'; r.dataset['k'] = k;
  r.setAttribute('aria-expanded', on ? 'true' : 'false');
  if (icon) r.appendChild(icon);
  const t = el('span', 't');
  t.appendChild(el('span', 'n', name));
  if (sub) t.appendChild(el('span', 'q', sub));
  r.appendChild(t);
  r.addEventListener('click', onClick);
  return r;
}
export function chip(k: string, label: string, on: boolean, onClick: () => void, color?: string, locked = false): HTMLButtonElement {
  const c = el('button', 'mz-rp-chip' + (on ? ' on' : '') + (locked ? ' lock' : ''));
  c.type = 'button'; c.dataset['k'] = k;
  if (color) { const d = el('i', 'dot'); d.style.background = palColor(color); c.appendChild(d); }
  c.append(label);
  c.addEventListener('click', onClick);
  return c;
}

/** Righe di statistiche di un oggetto (per i dettagli e la forgia). */
export function statLines(it: ItemDef): string[] {
  const out: string[] = [];
  if (it.kind === 'arma') out.push(`Danno ${num(it.danno ?? 0)} · velocità ${num(it.velocita ?? 0, 2)} · portata ${num(it.portata ?? 0)} m`);
  if (it.kind === 'arco') out.push(`Danno ${num(it.danno ?? 0)} · tendere ${num(it.tensione ?? 0, 2)} s · gittata ${num(it.gittata ?? 0)}`);
  if (it.kind === 'frecce') out.push(`Danno ${num(it.danno ?? 0)} · gittata ${num(it.gittata ?? 0)}`);
  if (it.kind === 'armatura') out.push(`Difesa ${num(it.difesa ?? 0)}`);
  if (it.traits?.fragile) out.push(`Si rompe dopo ${it.traits.fragile} colpi`);
  const cura = Object.entries(it.cura ?? {}).filter(([, v]) => v).map(([a, v]) => `+${v} ${ATTR_NOME[a as AttrId] ?? a}`);
  if (cura.length) out.push(`Cura ${cura.join(', ')}`);
  if (it.buff) out.push(`Effetto per ${it.buff.secondi} s`);
  const mods = Object.entries(it.mods ?? {}).filter(([, v]) => typeof v === 'number' && v);
  if (mods.length) out.push(mods.map(([k, v]) => modText(k, v as number)).join(' · '));
  out.push(`Peso ${fmtKg(it.peso)}`);
  return out;
}
const MOD_NOME: Record<string, string> = {
  vita: 'Vita', magicka: 'Magicka', stamina: 'Stamina', peso: 'kg portati', difesa: 'difesa', regenVita: 'rigenera Vita', regenMagicka: 'rigenera Magicka',
  regenStamina: 'rigenera Stamina', dannoLeggere: 'danno armi leggere', dannoPesanti: 'danno armi pesanti', dannoArco: 'danno arco',
  dannoDistruzione: 'danno Distruzione', costoDistruzione: 'costo Distruzione', costoEvocazione: 'costo Evocazione', durataEvocazione: 'durata evocazioni',
  velocitaCorsa: 'corsa', staminaCorsa: 'stamina in corsa', resistMagia: 'resistenza magia', potenzaPozioni: 'pozioni',
};
const FLAT = new Set(['vita', 'magicka', 'stamina', 'peso', 'difesa']);
function modText(k: string, v: number): string {
  const s = v > 0 ? '+' : '−';
  return FLAT.has(k) ? `${s}${num(Math.abs(v))} ${MOD_NOME[k] ?? k}` : `${s}${Math.round(Math.abs(v) * 100)} % ${MOD_NOME[k] ?? k}`;
}
