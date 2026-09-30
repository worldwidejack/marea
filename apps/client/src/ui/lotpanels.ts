// Contenuto dei pannelli dell'isola (edificio, costruzione) a partire da un LotState già proiettato all'ora del server.
// Solo DOM e testi: le azioni le esegue lot.ts tramite i callback. Testi italiani corti, pulsanti ≥ 52 px.
import { BUILDINGS, building as buildingDef } from '@marea/content';
import type { BuildingDef } from '@marea/content';
import { bufferCap, geq, missing, storageCap } from '@marea/sim';
import type { LotState, PlacedBuilding, Resources } from '@marea/sim';
import { mancaText } from '../net/api.ts';
import { el } from './style.ts';
import { RES_IDS, RES_NOME, resIcon } from './icons.ts';
import { fmtDur, timerSpan } from './sheet.ts';

export type PanelCtx = {
  lot: LotState;
  readonly: boolean;
  /** Edifici da non offrire (es. il Tavolo finché le sfide con posta sono spente). */
  hide?: readonly string[];
  ownerName: string;
  busy: boolean;
  onCollect(id: string): void;
  onUpgrade(id: string): void;
  onBuild(building: string, cell: [number, number]): void;
  onChoose(building: string | null): void;
  onClose(): void;
};
export type Panel = { body: HTMLElement; sig: string };

export function costNodes(cost: Resources): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const id of RES_IDS) if (cost[id] > 0) { const c = el('span', 'mz-cost'); c.append(resIcon(id, 16), el('span', '', String(cost[id]))); out.push(c); }
  if (!out.length) out.push(el('span', 'mz-cost', 'gratis'));
  return out;
}

/** Righe di descrizione di un edificio a un livello (1-based). */
export function describe(def: BuildingDef, level: number): string[] {
  const l = def.levels[Math.max(0, level - 1)];
  if (!l) return [];
  if (def.produces) return [`Produce ${l.rate ?? 0} ${RES_NOME[def.produces]} all'ora`];
  switch (def.id) {
    case 'magazzino': return [`Tetto per risorsa: ${l.cap ?? 0}`];
    case 'casa': return [`Slot cosmetici: ${l.slots ?? 0}`];
    case 'faro': return [`+${Math.round(((l.boost ?? 1) - 1) * 100)}% di produzione per ${l.boostHours ?? 0} h dopo una vittoria`];
    case 'tavolo': return [`Posta massima ${l.wagerMax ?? 0} · ${l.freeChallenges ?? 0} sfide gratis al giorno`];
    case 'molo': return level <= 1 ? ['Qui attracca la tua barca'] : [`Barca più veloce del ${Math.round(((l.boatSpeed ?? 1) - 1) * 100)}%`];
    default: return [];
  }
}

function head(title: string, lvl: string, onClose: () => void): HTMLElement {
  const h = el('div', 'mz-head');
  const t = el('div', 'mz-title', title);
  if (lvl) t.append(' ', el('span', 'mz-lvl', lvl));
  const x = el('button', 'mz-x', '×'); x.setAttribute('aria-label', 'Chiudi'); x.dataset['act'] = 'chiudi';
  x.addEventListener('click', onClose);
  h.append(t, x);
  return h;
}
function btn(cls: string, act: string, main: string, sub: (string | HTMLElement)[], disabled: boolean, onClick: () => void): HTMLButtonElement {
  const b = el('button', 'mz-btn ' + cls);
  b.dataset['act'] = act;
  b.disabled = disabled;
  const left = el('span', '', main);
  b.appendChild(left);
  if (sub.length) { const s = el('span', 'sub'); s.append(...sub); b.appendChild(s); }
  b.addEventListener('click', () => { if (!b.disabled) onClick(); });
  return b;
}
const missNode = (m: Resources) => el('span', 'miss', mancaText(m));
const sigOf = (body: HTMLElement) => body.textContent + '|' + [...body.querySelectorAll('button')].map((b) => (b.disabled ? 0 : 1)).join('');

/** Pannello di un edificio piazzato: raccogli, migliora, info. `b` viene dal lotto proiettato (deposito aggiornato). */
export function buildingPanel(ctx: PanelCtx, b: PlacedBuilding): Panel {
  const def = buildingDef(b.building), lot = ctx.lot;
  const body = el('div'); body.dataset['panel'] = 'edificio'; body.dataset['id'] = b.id;
  const building = lot.construction && lot.construction.placedId === b.id ? lot.construction : null;
  body.appendChild(head(def.nome, b.level >= 1 ? `L${b.level}` : 'cantiere', ctx.onClose));
  const info = el('div', 'mz-info');
  for (const line of describe(def, Math.max(1, b.level))) info.appendChild(el('div', '', b.level >= 1 ? line : `Al termine: ${line.toLowerCase()}`));
  if (def.produces && b.level >= 1) info.appendChild(el('div', '', `Deposito ${Math.floor(b.buffer)} / ${Math.floor(bufferCap(b))}`));
  if (ctx.readonly) info.appendChild(el('div', '', `Isola di ${ctx.ownerName}: solo da guardare`));
  body.appendChild(info);
  if (building) {
    const n = el('div', 'mz-note', building.level > 1 ? `Miglioramento a L${building.level} tra ` : 'Pronto tra ');
    n.appendChild(timerSpan(building.endsMs));
    body.appendChild(n);
  }
  if (ctx.readonly) return { body, sig: sigOf(body) };

  if (def.produces && b.level >= 1) {
    const res = def.produces, amount = Math.floor(b.buffer);
    const room = Math.max(0, storageCap(lot) - lot.resources[res]);
    const sub: (string | HTMLElement)[] = [];
    let dis = ctx.busy;
    if (amount < 1) { sub.push('deposito vuoto'); dis = true; }
    else if (room < 1) { sub.push('magazzino pieno'); dis = true; }
    else { const c = el('span', 'mz-cost'); c.append(resIcon(res, 16), el('span', '', `+${Math.min(amount, room)}`)); sub.push(c); }
    body.appendChild(btn('green', 'raccogli', 'RACCOGLI', sub, dis, () => ctx.onCollect(b.id)));
  }
  const next = b.level >= 1 ? def.levels[b.level] : undefined;
  if (b.level < 1) { /* in costruzione: niente miglioramento */ }
  else if (!next) body.appendChild(btn('', 'migliora', 'LIVELLO MASSIMO', [], true, () => {}));
  else {
    const afford = geq(lot.resources, next.cost);
    const sub: (string | HTMLElement)[] = [...costNodes(next.cost), el('span', 'mz-cost', `· ${fmtDur(next.seconds)}`)];
    if (!afford) { sub.push(el('br'), missNode(missing(lot.resources, next.cost))); }
    else if (lot.construction) sub.push(el('br'), el('span', 'miss', 'c’è già un cantiere'));
    body.appendChild(btn('', 'migliora', `MIGLIORA → L${b.level + 1}`, sub, ctx.busy || !afford || !!lot.construction, () => ctx.onUpgrade(b.id)));
    const more = describe(def, b.level + 1)[0];
    if (more) info.appendChild(el('div', '', `L${b.level + 1}: ${more.charAt(0).toLowerCase()}${more.slice(1)}`));
  }
  return { body, sig: sigOf(body) };
}

/** Edifici che si possono ancora costruire (uno per tipo, il Molo c'è già). */
export function buildable(lot: LotState): BuildingDef[] {
  return BUILDINGS.filter((d) => d.id !== 'molo' && !lot.buildings.some((b) => b.building === d.id));
}

/** Build mode su uno slot libero: lista col costo, poi conferma. */
export function buildPanel(ctx: PanelCtx, cell: [number, number], chosen: string | null): Panel {
  const lot = ctx.lot;
  const body = el('div'); body.dataset['panel'] = chosen ? 'conferma' : 'costruisci'; body.dataset['cell'] = cell.join(',');
  if (chosen) {
    const def = buildingDef(chosen), l1 = def.levels[0];
    body.appendChild(head(`Costruire ${def.nome}?`, '', ctx.onClose));
    const info = el('div', 'mz-info');
    for (const line of describe(def, 1)) info.appendChild(el('div', '', line));
    const c = el('div'); c.append('Costo: ', ...(l1 ? costNodes(l1.cost) : []), ` · ${fmtDur(l1?.seconds ?? 0)}`);
    info.appendChild(c);
    body.appendChild(info);
    const row = el('div', 'mz-row');
    row.append(
      btn('ghost', 'annulla', 'INDIETRO', [], ctx.busy, () => ctx.onChoose(null)),
      btn('', 'conferma', 'COSTRUISCI', [], ctx.busy || !l1 || !geq(lot.resources, l1.cost) || !!lot.construction, () => ctx.onBuild(chosen, cell)),
    );
    body.appendChild(row);
    return { body, sig: sigOf(body) };
  }
  body.appendChild(head('Costruisci', '', ctx.onClose));
  const list = buildable(lot).filter((d) => !ctx.hide?.includes(d.id));
  const info = el('div', 'mz-info', list.length ? 'Un cantiere alla volta.' : 'Hai già tutti gli edifici: miglioriamoli.');
  body.appendChild(info);
  if (lot.construction) {
    const n = el('div', 'mz-note', `Cantiere occupato: ${buildingDef(lot.construction.building).nome} tra `);
    n.appendChild(timerSpan(lot.construction.endsMs));
    body.appendChild(n);
  }
  for (const def of list) {
    const l1 = def.levels[0];
    if (!l1) continue;
    const afford = geq(lot.resources, l1.cost);
    const req = def.requires && !lot.buildings.some((b) => b.building === def.requires && b.level >= 1) ? def.requires : null;
    const sub: (string | HTMLElement)[] = [...costNodes(l1.cost), el('span', 'mz-cost', `· ${fmtDur(l1.seconds)}`)];
    if (!afford) sub.push(el('br'), missNode(missing(lot.resources, l1.cost)));
    else if (req) sub.push(el('br'), el('span', 'miss', `serve prima: ${buildingDef(req).nome}`));
    const b = btn('', 'scegli', def.nome.toUpperCase(), sub, ctx.busy || !afford || !!req || !!lot.construction, () => ctx.onChoose(def.id));
    b.dataset['building'] = def.id;
    body.appendChild(b);
  }
  return { body, sig: sigOf(body) };
}
