// La pala a Borgo Marea (#438): scavare buche nel terreno (solo a Borgo Marea), chiuderle o seppellirci oggetti dello zaino, mobili
// non posati della casa e quantità a scelta di monete (resta una croce stile Animal Crossing a tempo indeterminato finché un giocatore
// non la scava fuori), più il bottino giornaliero (10-200 monete in un punto casuale di Borgo Marea, sparisce solo per chi lo scava).
import * as THREE from 'three';
import { BORGO, MOBILI } from '@marea/content';
import { casaDi } from '@marea/sim';
import type { LotState } from '@marea/sim';
import { bottinoDelGiorno, bottinoRiscossoOggi, cellKeyBorgo, celleScavabiliBorgo, isCellaScavabileBorgo, possiedePala } from '@marea/sim/economy/pala.ts';
import type { BucaBorgo, BucaDono } from '@marea/sim/economy/pala.ts';
import type { ItemDef } from '@marea/sim/rpg/types.ts';
import type { GameWorld } from './world.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api } from '../net/api.ts';
import { FLAGS } from '../flags.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';
import { PAL, el } from '../ui/style.ts';
import { pixIcon } from '../ui/icons.ts';
import { suona } from '../audio/ponte.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type PalaBorgo = { tick(a: boolean): boolean; update(dt: number): void };
type NearBuca = { kind: 'aperta' | 'seppellita' | 'bottino'; cell: [number, number]; x: number; z: number };

const RAGGIO_BUCA = 2.1;
const POLL_S = 5;
const CSS = `#mzScavaBtn { position: absolute; left: 50%; bottom: calc(max(14px, env(safe-area-inset-bottom)) + 16px); transform: translateX(-50%); z-index: 16; display: none; align-items: center; gap: 6px; min-height: 44px; padding: 8px 14px; background: rgba(46,30,20,.94); border: 2px solid ${PAL.legnoChiaro}; color: ${PAL.sabbiaChiara}; font: bold 13px ui-monospace, Menlo, monospace; cursor: pointer; border-radius: 6px; box-shadow: 0 3px 0 ${PAL.neroCaldo}; }
#mzScavaBtn.on { display: inline-flex; } #mzScavaBtn b { color: ${PAL.giallo}; }
#mzPalaSheet .tabs { display: flex; gap: 6px; margin: 8px 0; }
#mzPalaSheet .tab { flex: 1; padding: 6px 8px; background: rgba(35,32,31,.85); border: 1px solid ${PAL.legno}; color: ${PAL.sabbia}; font: bold 12px ui-monospace, Menlo, monospace; cursor: pointer; }
#mzPalaSheet .tab.on { background: ${PAL.legno}; color: ${PAL.giallo}; border-color: ${PAL.giallo}; }
#mzPalaSheet .lista { max-height: 210px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin: 8px 0; }
#mzPalaSheet .riga { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; background: rgba(35,32,31,.75); border: 1px solid ${PAL.legnoScuro}; color: ${PAL.sabbiaChiara}; font: 13px ui-monospace, Menlo, monospace; }
#mzPalaSheet .riga b { color: ${PAL.giallo}; } #mzPalaSheet .monete-box { display: flex; align-items: center; gap: 8px; margin: 8px 0; flex-wrap: wrap; }
#mzPalaSheet input[type="number"] { width: 96px; padding: 6px 8px; background: ${PAL.neroCaldo}; border: 1px solid ${PAL.legnoChiaro}; color: ${PAL.giallo}; font: bold 14px ui-monospace, Menlo, monospace; }`;

/** Geometria di una buca aperta: pozzo scuro nel terreno con bordo di zolle scavate. */
function bucaApertaGeo(x: number, y: number, z: number): THREE.BufferGeometry[] {
  const out = [painted(new THREE.CylinderGeometry(0.56, 0.58, 0.08, 10), P.legno, M(x, y + 0.03, z)), painted(new THREE.CylinderGeometry(0.42, 0.36, 0.09, 10), P.neroCaldo, M(x, y + 0.045, z))];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + 0.2;
    out.push(painted(new THREE.BoxGeometry(0.22, 0.1, 0.16), i % 2 ? P.legnoScuro : P.legnoChiaro, M(x + Math.cos(a) * 0.48, y + 0.07, z + Math.sin(a) * 0.48, 0, -a, 0)));
  }
  return out;
}

/** Geometria della croce sul terreno (stile Animal Crossing): terra smossa con segno a X ben visibile. */
function croceSeppellitaGeo(x: number, y: number, z: number): THREE.BufferGeometry[] {
  return [
    painted(new THREE.CylinderGeometry(0.5, 0.54, 0.04, 8), P.sabbia, M(x, y + 0.02, z)),
    painted(new THREE.CylinderGeometry(0.42, 0.45, 0.05, 8), P.legno, M(x, y + 0.026, z)),
    painted(new THREE.BoxGeometry(0.74, 0.06, 0.15), P.legnoScuro, M(x, y + 0.045, z, 0, Math.PI / 4, 0)),
    painted(new THREE.BoxGeometry(0.74, 0.06, 0.15), P.legnoScuro, M(x, y + 0.045, z, 0, -Math.PI / 4, 0)),
    painted(new THREE.BoxGeometry(0.66, 0.065, 0.08), P.neroCaldo, M(x, y + 0.05, z, 0, Math.PI / 4, 0)),
    painted(new THREE.BoxGeometry(0.66, 0.065, 0.08), P.neroCaldo, M(x, y + 0.05, z, 0, -Math.PI / 4, 0)),
  ];
}

export function createPalaBorgo(o: {
  world: GameWorld; root: HTMLElement; hud: Hud; api: Api | null;
  getLot(): LotState | null; setLot(l: LotState): void; negozioDentro(): boolean;
  /** Cosa hai in mano (#445): si scava solo con la pala in mano; assente = sempre la pala. */
  inMano?(): string;
  /** Vicino a un sasso o a un albero (#445): il bottone SCAVA si fa da parte. */
  occupato?(): boolean;
  /** Particelle di terra dalla buca scavata o chiusa. */
  zolle?(x: number, y: number, z: number, n?: number): void;
}): PalaBorgo {
  const w = o.world, arch = w.archipelago, T = arch.tile;
  const porto = arch.places.find((p) => p.role === 'porto');
  if (!porto) return { tick: () => false, update: () => {} };
  if (!document.getElementById('mz-pala-style')) { const st = document.createElement('style'); st.id = 'mz-pala-style'; st.textContent = CSS; document.head.appendChild(st); }
  const [ox, oz] = porto.origin;
  const cellWorld = (c: readonly [number, number]) => ({ x: (ox + c[0] + 0.5) * T, z: (oz + c[1] + 0.5) * T });
  const adesso = () => o.api?.serverNow() ?? Date.now();
  const conPala = () => (o.inMano?.() ?? 'pala') === 'pala' && !(o.occupato?.() ?? false);

  const group = new THREE.Group(); group.name = 'borgo_buche'; w.scene.add(group);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  let mesh: THREE.Mesh | null = null;
  let buche: BucaBorgo[] = [];
  let lastRenderKey = '';

  /** Catalogo GDR caricato dinamicamente quando si apre la scheda per seppellire oggetti dello zaino. */
  let itemDefs: ReadonlyMap<string, ItemDef> | null = null;
  const ensureItems = async (): Promise<ReadonlyMap<string, ItemDef>> => {
    if (itemDefs) return itemDefs;
    const mod = await import('@marea/sim/rpg/items.ts');
    itemDefs = new Map(mod.ITEMS.map((i) => [i.id, i]));
    return itemDefs;
  };

  function rebuildMesh(): void {
    const lot = o.getLot(), now = adesso();
    const bot = bottinoDelGiorno(now), mostraBot = !bottinoRiscossoOggi(lot, now) && !buche.some((b) => b.cell[0] === bot.cell[0] && b.cell[1] === bot.cell[1]);
    const key = buche.map((b) => `${b.cell[0]},${b.cell[1]}:${b.stato}`).join('|') + (mostraBot ? `|B:${bot.cell[0]},${bot.cell[1]}` : '');
    if (key === lastRenderKey) return;
    lastRenderKey = key;
    if (mesh) { group.remove(mesh); mesh.geometry.dispose(); mesh = null; }
    const geos: THREE.BufferGeometry[] = [];
    for (const b of buche) {
      const cw = cellWorld(b.cell), y = w.groundY(cw.x, cw.z);
      geos.push(...(b.stato === 'aperta' ? bucaApertaGeo(cw.x, y, cw.z) : croceSeppellitaGeo(cw.x, y, cw.z)));
    }
    if (mostraBot) {
      const cw = cellWorld(bot.cell), y = w.groundY(cw.x, cw.z);
      geos.push(...croceSeppellitaGeo(cw.x, y, cw.z));
    }
    if (geos.length) {
      mesh = new THREE.Mesh(merged(geos), mat);
      mesh.name = 'borgo_buche_mesh';
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  async function callServer(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Record<string, unknown>> {
    const r = await fetch(path, {
      method, cache: 'no-store',
      headers: { 'x-token': FLAGS.token, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) throw new Error(typeof d['error'] === 'string' ? d['error'] : 'Operazione non riuscita');
    return d;
  }

  async function refreshBuche(): Promise<BucaBorgo[]> {
    if (!o.api || !FLAGS.token) return buche;
    try {
      const d = await callServer('GET', '/api/borgo/buche');
      if (Array.isArray(d['buche'])) { buche = d['buche'] as BucaBorgo[]; rebuildMesh(); }
    } catch { /* riprova al prossimo giro */ }
    return buche;
  }
  void refreshBuche();

  // ——— UI: bottone SCAVA / BUCA e foglio per chiudere o seppellire ———
  const scavaBtn = el('button', 'mz'); scavaBtn.id = 'mzScavaBtn'; scavaBtn.type = 'button';
  const sheet = el('div', 'mz mz-sheet'); sheet.id = 'mzPalaSheet';
  o.root.append(scavaBtn, sheet);
  for (const e of [scavaBtn, sheet]) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation());

  let apertaCell: [number, number] | null = null, tab: 'zaino' | 'mobili' | 'monete' = 'zaino', moneteInput = 50, busy = false, nota = '', pollAcc = 0, aWas = false, congelato = 0;
  const chiudiSheet = () => { apertaCell = null; nota = ''; sheet.classList.remove('on'); sheet.replaceChildren(); };

  const inBorgo = (): boolean => {
    if (w.mode !== 'walk' || w.frozen || w.race.on || o.negozioDentro() || document.body.classList.contains('mz-casa')) return false;
    const f = w.avatar.state;
    return arch.placeAt(f.x, f.z)?.role === 'porto';
  };

  /** Cella `[cx, cz]` del Borgo su cui si trova l'avatar. */
  const avatarCell = (): [number, number] => {
    const f = w.avatar.state;
    return [Math.floor(f.x / T) - ox, Math.floor(f.z / T) - oz];
  };

  /** Cella scavabile migliore attorno all'avatar (prima quella sotto i piedi, poi i 4 vicini). */
  const targetDigCell = (): [number, number] | null => {
    const [cx, cz] = avatarCell();
    const occupata = (c: readonly [number, number]) => buche.some((b) => b.cell[0] === c[0] && b.cell[1] === c[1]);
    for (const [dx, dz] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const c: [number, number] = [cx + dx, cz + dz];
      if (isCellaScavabileBorgo(c) && !occupata(c)) return c;
    }
    return null;
  };

  /** Buca aperta o croce seppellita (incluso il bottino del giorno) più vicina entro `RAGGIO_BUCA`. */
  const findNearBuca = (): NearBuca | null => {
    if (!inBorgo()) return null;
    const f = w.avatar.state, lot = o.getLot(), now = adesso();
    let best: NearBuca | null = null, bd = RAGGIO_BUCA;
    for (const b of buche) {
      const cw = cellWorld(b.cell), d = Math.hypot(f.x - cw.x, f.z - cw.z);
      if (d < bd) { bd = d; best = { kind: b.stato, cell: b.cell, x: cw.x, z: cw.z }; }
    }
    const bot = bottinoDelGiorno(now);
    if (!bottinoRiscossoOggi(lot, now) && !buche.some((b) => b.cell[0] === bot.cell[0] && b.cell[1] === bot.cell[1])) {
      const cw = cellWorld(bot.cell), d = Math.hypot(f.x - cw.x, f.z - cw.z);
      if (d < bd) best = { kind: 'bottino', cell: bot.cell, x: cw.x, z: cw.z };
    }
    return best;
  };

  async function eseguiScava(cell?: [number, number]): Promise<Record<string, unknown> | null> {
    if (busy) return null;
    const lot = o.getLot();
    if (!possiedePala(lot)) { o.hud.toast(`Serve la pala: comprala al negozio dei mobili (${BORGO.pala.monete} monete)`, 2600); return null; }
    const near = findNearBuca();
    const bersaglio = cell ?? (near && (near.kind === 'seppellita' || near.kind === 'bottino') ? near.cell : targetDigCell());
    if (!bersaglio) { o.hud.toast('Qui non c’è spazio per scavare: spostati su un tratto libero di Borgo Marea', 2400); return null; }
    const cw = cellWorld(bersaglio);
    w.avatar.avviaAzione('pala_scava', 0.85, { x: cw.x, z: cw.z });
    w.frozen = true; congelato = 0.85; suona('plop');
    o.zolle?.(cw.x, w.groundY(cw.x, cw.z) + 0.1, cw.z, 6);
    busy = true;
    try {
      const d = await callServer('POST', '/api/borgo/buca', { op: 'scava', cell: bersaglio });
      if (d['lot']) o.setLot(d['lot'] as LotState);
      if (Array.isArray(d['buche'])) buche = d['buche'] as BucaBorgo[];
      rebuildMesh();
      if (d['esito'] === 'bottino') o.hud.toast(`Hai trovato il bottino del giorno: +${d['monete']} monete!`, 3200);
      else if (d['esito'] === 'trovato') o.hud.toast(`Hai dissotterrato: ${d['nome']}!`, 3200);
      else if (d['esito'] === 'aperta') o.hud.toast('Hai scavato una buca aperta! Avvicinati e premi A per chiuderla o seppellire qualcosa', 2800);
      return d;
    } catch (e) {
      o.hud.toast(e instanceof Error ? e.message : 'Errore nello scavo', 2500);
      return null;
    } finally { busy = false; }
  }

  async function eseguiChiudi(cell?: [number, number]): Promise<boolean> {
    const target = cell ?? apertaCell ?? findNearBuca()?.cell ?? null;
    if (!target || busy) return false;
    const cw = cellWorld(target);
    w.avatar.avviaAzione('pala_chiudi', 0.75, { x: cw.x, z: cw.z });
    w.frozen = true; congelato = 0.75; suona('plop');
    o.zolle?.(cw.x, w.groundY(cw.x, cw.z) + 0.05, cw.z, 4);
    busy = true;
    try {
      const d = await callServer('POST', '/api/borgo/buca', { op: 'chiudi', cell: target });
      if (Array.isArray(d['buche'])) buche = d['buche'] as BucaBorgo[];
      chiudiSheet();
      rebuildMesh();
      o.hud.toast('Buca chiusa: il terreno è tornato normale', 2200);
      return true;
    } catch (e) {
      nota = e instanceof Error ? e.message : 'Errore';
      if (apertaCell) void renderSheet();
      return false;
    } finally { busy = false; }
  }

  async function eseguiSeppellisci(dono: BucaDono, cell?: [number, number]): Promise<boolean> {
    const target = cell ?? apertaCell ?? findNearBuca()?.cell ?? null;
    if (!target || busy) return false;
    const cw = cellWorld(target);
    w.avatar.avviaAzione('pala_chiudi', 0.75, { x: cw.x, z: cw.z });
    w.frozen = true; congelato = 0.75; suona('plop');
    o.zolle?.(cw.x, w.groundY(cw.x, cw.z) + 0.05, cw.z, 4);
    busy = true;
    try {
      const d = await callServer('POST', '/api/borgo/buca', { op: 'seppellisci', cell: target, dono });
      if (d['lot']) o.setLot(d['lot'] as LotState);
      if (Array.isArray(d['buche'])) buche = d['buche'] as BucaBorgo[];
      chiudiSheet();
      rebuildMesh();
      o.hud.toast(`Hai seppellito: ${d['nome'] ?? 'oggetto'}! Resta una croce nel terreno`, 3000);
      return true;
    } catch (e) {
      nota = e instanceof Error ? e.message : 'Errore';
      if (apertaCell) void renderSheet();
      return false;
    } finally { busy = false; }
  }

  async function apriSheetBuca(cell: [number, number]): Promise<void> {
    apertaCell = [cell[0], cell[1]];
    nota = '';
    await ensureItems().catch(() => null);
    await renderSheet();
  }

  async function renderSheet(): Promise<void> {
    if (!apertaCell) return;
    const defs = await ensureItems().catch(() => new Map<string, ItemDef>());
    const lot = o.getLot();
    const testa = el('div', 'mz-row'); testa.style.alignItems = 'center';
    const x = el('button', 'mz-x', '×'); x.type = 'button'; x.addEventListener('click', chiudiSheet);
    const tit = el('b', '', 'Buca aperta nel terreno'); tit.style.flex = '1'; tit.style.color = PAL.giallo;
    testa.append(tit, x);
    const chiudiBtn = el('button', 'mz-btn', ''); chiudiBtn.type = 'button'; chiudiBtn.dataset['act'] = 'chiudi-buca';
    chiudiBtn.append(el('span', '', 'Chiudi la buca (torna terreno normale)'), el('b', '', '✕'));
    chiudiBtn.disabled = busy; chiudiBtn.addEventListener('click', () => void eseguiChiudi());
    const tabs = el('div', 'tabs');
    for (const [id, label] of [['zaino', 'Zaino'], ['mobili', 'Mobili'], ['monete', 'Monete']] as const) {
      const tb = el('button', 'tab' + (tab === id ? ' on' : ''), label); tb.type = 'button'; tb.dataset['tab'] = id;
      tb.addEventListener('click', () => { tab = id; void renderSheet(); }); tabs.appendChild(tb);
    }
    const lista = el('div', 'lista');
    if (tab === 'zaino') {
      const inv = lot?.hero?.inv ?? {};
      const voci = Object.entries(inv).filter(([id, n]) => n > 0 && id !== 'pala' && defs.get(id)?.kind !== 'strumento');
      if (!voci.length) lista.appendChild(el('div', 'riga', 'Nessun oggetto seppellibile nello zaino.'));
      for (const [id, n] of voci) {
        const nome = defs.get(id)?.nome ?? id, r = el('div', 'riga'); r.dataset['item'] = id;
        r.append(el('span', '', `${nome} (×${n})`));
        const b = el('button', 'mz-btn', ''); b.type = 'button'; b.dataset['seppellisci'] = `oggetto:${id}`;
        b.append(el('span', '', 'Seppellisci'), el('b', '', '1')); b.disabled = busy;
        b.addEventListener('click', () => void eseguiSeppellisci({ tipo: 'oggetto', id, n: 1 }));
        r.appendChild(b); lista.appendChild(r);
      }
    } else if (tab === 'mobili') {
      const mag = casaDi(lot).magazzino ?? {};
      const voci = Object.entries(mag).filter(([, n]) => n > 0);
      if (!voci.length) lista.appendChild(el('div', 'riga', 'Nessun mobile non piazzato nel magazzino di casa.'));
      for (const [id, n] of voci) {
        const nome = MOBILI.find((m) => m.id === id)?.nome ?? id, r = el('div', 'riga'); r.dataset['mobile'] = id;
        r.append(el('span', '', `${nome} (×${n})`));
        const b = el('button', 'mz-btn', ''); b.type = 'button'; b.dataset['seppellisci'] = `mobile:${id}`;
        b.append(el('span', '', 'Seppellisci'), el('b', '', '1')); b.disabled = busy;
        b.addEventListener('click', () => void eseguiSeppellisci({ tipo: 'mobile', id, n: 1 }));
        r.appendChild(b); lista.appendChild(r);
      }
    } else {
      const disp = lot?.monete ?? 0, box = el('div', 'monete-box'), inp = document.createElement('input');
      inp.type = 'number'; inp.min = '1'; inp.max = String(Math.max(1, disp));
      inp.value = String(Math.min(Math.max(1, moneteInput), Math.max(1, disp)));
      inp.dataset['act'] = 'input-monete';
      inp.addEventListener('input', () => { moneteInput = Math.max(1, Math.floor(Number(inp.value) || 1)); });
      const b = el('button', 'mz-btn', ''); b.type = 'button'; b.dataset['seppellisci'] = 'monete';
      b.append(el('span', '', 'Seppellisci monete'), el('b', '', `hai ${disp}`));
      b.disabled = busy || disp < 1;
      b.addEventListener('click', () => void eseguiSeppellisci({ tipo: 'monete', monete: Math.max(1, Math.floor(Number(inp.value) || moneteInput)) }));
      box.append(el('span', '', 'Quantità:'), inp, b); lista.appendChild(box);
    }

    const corpo: Node[] = [testa, chiudiBtn, el('div', '', 'Oppure scegli cosa seppellire (rimarrà una croce nel terreno):'), tabs, lista];
    if (nota) corpo.push(el('div', 'riga', nota));
    sheet.replaceChildren(...corpo);
    sheet.classList.add('on');
  }

  scavaBtn.addEventListener('click', () => {
    const near = findNearBuca();
    if (near?.kind === 'aperta') void apriSheetBuca(near.cell);
    else void eseguiScava(near?.cell);
  });

  registerStateProvider('pala', () => {
    const lot = o.getLot(), now = adesso(), bot = bottinoDelGiorno(now), riscosso = bottinoRiscossoOggi(lot, now), near = findNearBuca();
    return {
      posseduta: possiedePala(lot),
      inBorgo: inBorgo(),
      cella: avatarCell(),
      scavabiliCount: celleScavabiliBorgo().length,
      near: near ? { kind: near.kind, cell: near.cell, x: near.x, z: near.z } : null,
      sheetOpen: sheet.classList.contains('on'),
      apertaCell,
      buche,
      bottino: { giorno: bot.giorno, cell: bot.cell, world: cellWorld(bot.cell), monete: bot.monete, riscosso, visibile: !riscosso },
    };
  });
  registerTestHook('palaScava', (cell) => eseguiScava(Array.isArray(cell) && cell.length === 2 ? [Number(cell[0]), Number(cell[1])] : undefined));
  registerTestHook('palaChiudi', (cell) => eseguiChiudi(Array.isArray(cell) && cell.length === 2 ? [Number(cell[0]), Number(cell[1])] : undefined));
  registerTestHook('palaSeppellisci', (dono, cell) => eseguiSeppellisci(dono as BucaDono, Array.isArray(cell) && cell.length === 2 ? [Number(cell[0]), Number(cell[1])] : undefined));
  registerTestHook('palaApriBuca', async (cell) => {
    const c: [number, number] | null = Array.isArray(cell) && cell.length === 2 ? [Number(cell[0]), Number(cell[1])] : findNearBuca()?.cell ?? apertaCell;
    if (!c) return false;
    await apriSheetBuca(c);
    return true;
  });
  registerTestHook('palaRefresh', () => refreshBuche());
  registerTestHook('palaCellWorld', (cell) => Array.isArray(cell) && cell.length === 2 ? cellWorld([Number(cell[0]), Number(cell[1])]) : null);

  let lastBtnKey = '';
  return {
    tick(a) {
      const pa = a && !aWas; aWas = a;
      const near = findNearBuca();
      if (apertaCell && (!near || near.kind !== 'aperta' || cellKeyBorgo(near.cell) !== cellKeyBorgo(apertaCell))) chiudiSheet();
      if (!near) return false;
      if (near.kind === 'aperta') {
        if (pa) void apriSheetBuca(near.cell);
        return true;
      }
      if (possiedePala(o.getLot()) && conPala()) {
        if (pa) void eseguiScava(near.cell);
        return true;
      }
      return false;
    },
    update(dt) {
      if (congelato > 0) {
        congelato -= dt;
        if (congelato <= 0 && !w.avatar.azioneInCorso) w.frozen = false;
      }
      pollAcc += dt;
      if (pollAcc >= POLL_S) {
        pollAcc = 0;
        if (inBorgo()) void refreshBuche();
      }
      rebuildMesh();
      const dentroBorgo = inBorgo(), haPala = possiedePala(o.getLot()), near = findNearBuca();
      const showBtn = dentroBorgo && (near?.kind === 'aperta' || (haPala && conPala() && (near !== null || targetDigCell() !== null)));
      const btnKey = !showBtn ? '' : near?.kind === 'aperta' ? 'aperta' : near ? 'dissotterra' : 'scava';
      if (btnKey !== lastBtnKey) {
        lastBtnKey = btnKey;
        scavaBtn.classList.toggle('on', showBtn);
        if (btnKey === 'aperta') scavaBtn.replaceChildren(pixIcon('segno', 20), el('span', '', 'Buca aperta'), el('b', '', 'A'));
        else if (btnKey === 'dissotterra') scavaBtn.replaceChildren(pixIcon('martello', 20), el('span', '', 'Scava croce'), el('b', '', 'A'));
        else if (btnKey === 'scava') scavaBtn.replaceChildren(pixIcon('martello', 20), el('span', '', 'Scava buca'), el('b', '', 'Pala'));
      }
    },
  };
}
