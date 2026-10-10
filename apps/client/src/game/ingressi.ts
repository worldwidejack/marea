// Ingressi dei dungeon nel mondo (R-scena, CONTRACTS §15). Bundle iniziale: piccolo, niente import statici del GDR (solo `import type`).
// Nel mondo: modello `prop_ingresso_<stile>` sull'isola, cartello col nome che si vede da lontano, bottone ENTRA vicino (≤ 4 m, anche A/E/Spazio).
// Entrando: se sei uscito da una lanterna di quel dungeon, «Da dove parti?» (ingresso o lanterna) → POST /api/dungeon/start →
// import('../rpg/index.ts') → startRun; alla fine POST /api/dungeon/finish (input compressi e azioni dal menu) → scheda dell'esito del server
// → setLot → di nuovo all'ingresso. Uscita dalla Pausa senza aver salvato = niente consegna (finish non parte).
// Insieme (#118): con un altro giocatore a piedi vicino allo stesso ingresso compare AFFRONTA INSIEME → riquadro della squadra (WebSocket
// /ws/squadra/<dungeon> al DO Spedizioni: chi c'è, SCENDIAMO con almeno 2, Esci; allontanarsi = uscire) → `parte` → startRun con la rete
// della squadra → a fine spedizione POST /api/dungeon/finish senza input (il server rigioca il log della squadra) → scheda dell'esito.
// Porta sigillata (Epopea della Regata, `richiede`): finché non hai completato il dungeon di prima, sbarre e sigillo sulla bocca, cartello
// «sigillato», niente ENTRA né AFFRONTA INSIEME (il server rifiuta comunque: startDungeon).
import * as THREE from 'three';
import type { InputFrame, LotState } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api, DungeonFinish } from '../net/api.ts';
import { ApiError } from '../net/api.ts';
import type { PixId } from '../ui/icons.ts';
import { pixIcon } from '../ui/icons.ts';
import { PAL, el, injectUiStyle } from '../ui/style.ts';
import { placeholder, sigillo, togliScenografia } from './ingressi_forme.ts';
import { createLabelLayer, LABEL_NEAR_M } from '../ui/sheet.ts';
import { FLAGS } from '../flags.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import type { DungeonRun, PanelCtx, RunCtx, SquadraRete } from '../rpg/types.ts';
import { parseSqServer } from '@marea/protocol/squadra.ts';
import type { SqClientMsg, SqMembro, SqServerMsg } from '@marea/protocol/squadra.ts';
import type { DungeonAzione, DungeonAzioni, PackedDungeon } from '@marea/sim/dungeon/types.ts';

export type Ingressi = {
  readonly spots: readonly { id: string; nome: string; x: number; z: number; icon: PixId }[];
  /** Fuori dal dungeon, un tick: vicino a un ingresso il fronte di A entra. */
  tick(a: boolean): void;
  /** Nel dungeon, un tick (al posto di world.step). */
  step(f: InputFrame): void;
  update(alpha: number, dt: number, t: number): void;
  readonly active: boolean;
  /** Spedizione che parte o scheda dell'esito aperta: il mondo sta fermo. */
  isBusy(): boolean;
  /** Il dungeon più facile non ancora completato (`difficolta`, `hero.completati`): l'unico che la bussola mostra. null = tutti fatti. */
  next(): string | null;
};

/**
 * Copia a mano di `ingresso`, `stile`, `difficolta` e `richiede` di packages/content/src/rpg/dungeons.json (il JSON è GDR: qui non si può importare).
 * Il test e2e m2_dungeon controlla che coincida con DUNGEONS: se un dungeon si sposta, aggiornare anche qui.
 */
export const INGRESSI = [
  { id: 'grotta', nome: 'Grotta della Marea', island: 'porto', at: [32, 7], stile: 'grotta', difficolta: 1 },
  { id: 'cripta', nome: 'Cripta delle Ossa', island: 'selvaggia', at: [18, 12], stile: 'cripta', difficolta: 2 },
  { id: 'vuoto', nome: 'Portale del Vuoto', island: 'neon', at: [20, 13], stile: 'vuoto', difficolta: 6 },
  { id: 'drenaggio', nome: 'Impianto di Drenaggio', island: 'laguna', at: [18, 45], stile: 'drenaggio', difficolta: 3 },
  { id: 'archivio', nome: 'Archivio Navigazionale', island: 'laguna', at: [47, 36], stile: 'archivio', difficolta: 4, richiede: 'drenaggio' },
  { id: 'fucina', nome: 'Fucina a Pressione', island: 'laguna', at: [26, 5], stile: 'fucina', difficolta: 5, richiede: 'archivio' },
  { id: 'mausoleo', nome: 'Mausoleo Cinetico', island: 'laguna', at: [8, 13], stile: 'mausoleo', difficolta: 7, richiede: 'fucina' },
] as const;
/** Il dungeon da completare prima di poter entrare (porta sigillata), o null. */
export const richiesto = (id: string): string | null => { const d = INGRESSI.find((x) => x.id === id); return d && 'richiede' in d ? d.richiede : null; };
const PER_DIFFICOLTA = [...INGRESSI].sort((a, b) => a.difficolta - b.difficolta);
/** Il dungeon più facile tra quelli non ancora completati (null = tutti completati). */
export function nextDungeon(completati: readonly string[]): string | null {
  return PER_DIFFICOLTA.find((d) => !completati.includes(d.id))?.id ?? null;
}

/** Stato condiviso col chunk GDR (dungeon_run.ts lo legge): autopilot dei test e vista corrente per state().dungeon. */
/** Ponte coi test (?test=1): autopilot (tick per frame), `altare` = cammina fino a quell'altare (-1 = no), stato della partita. */
/** posa: solo test (hook dungeonPosa), campi della vista dell'eroe forzati per la resa (anim, t, stile, carica, fx, fz): la sim non cambia. */
/** act: azione dal menu nella spedizione in corso (hook dungeonAct: equip, butta, salva, esci); null = fatta, se no il motivo. */
export const dungeonLink: { autopilot: number; altare: number; vai: [number, number] | null; posa: Record<string, unknown> | null; state: (() => Record<string, unknown>) | null; act: ((a: DungeonAzione) => string | null) | null } = { autopilot: FLAGS.autopilot ? 4 : 0, altare: -1, vai: null, posa: null, state: null, act: null };

const NEAR_M = 4;
/** Squadra: chi si allontana più di così dall'ingresso esce dalla squadra. */
const LONTANO_M = NEAR_M + 3;
const ICON: PixId = 'ingresso';
const CSS = `.mz-lbl.dng { border-color: ${PAL.viola}; font-size: 15px; min-height: 34px; }
body.mz-sotto #mzDngEntra, body.mz-sotto #mzDngInsieme, body.mz-sotto #mzDngSquadra { display: none; }
#mzDngInsieme { top: calc(60% + 66px); background: ${PAL.erbaChiara}; }
.mz-dng-sq { position: absolute; left: 50%; top: max(64px, calc(env(safe-area-inset-top) + 56px)); transform: translateX(-50%); width: min(320px, calc(100% - 32px)); padding: 12px 14px 14px; background: rgba(46,30,20,.96); border: 3px solid ${PAL.erbaChiara}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; z-index: 24; text-align: center; }
.mz-dng-sq b { display: block; font-size: 18px; }
.mz-dng-sq .chi { margin: 6px 0 2px; font-weight: bold; font-size: 16px; color: ${PAL.erbaChiara}; }
.mz-dng-sq .sub { color: ${PAL.sabbia}; font-size: 13px; margin: 2px 0 6px; }
.mz-dng-sq .mz-btn { justify-content: center; }
.mz-dng-sq .mz-btn.via { background: ${PAL.erbaChiara}; }
.mz-dng-da { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); width: min(320px, calc(100% - 32px)); padding: 14px 16px 16px; background: rgba(46,30,20,.97); border: 3px solid ${PAL.viola}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; z-index: 24; text-align: center; }
.mz-dng-da b { display: block; font-size: 19px; }
.mz-dng-da .sub { color: ${PAL.sabbia}; font-size: 14px; margin: 4px 0 4px; }
.mz-dng-da .mz-btn { justify-content: center; }
.mz-dng-da .mz-btn.lan { background: ${PAL.giallo}; }
#mzDngEntra.sig { background: ${PAL.pietra}; }
.mz-lbl.dng.sig { border-color: ${PAL.rosso}; }`;

export function createIngressi(o: { world: GameWorld; renderer: Renderer; loader: Loader; api: Api | null; hud: Hud; root: HTMLElement; canvas: HTMLCanvasElement; getLot(): LotState | null; setLot(l: LotState): void }): Ingressi {
  injectUiStyle();
  if (!document.getElementById('mz-ingressi-style')) { const st = document.createElement('style'); st.id = 'mz-ingressi-style'; st.textContent = CSS; document.head.appendChild(st); }
  const arch = o.world.archipelago;
  const spots = INGRESSI.flatMap((d) => {
    const p = arch.places.find((q) => q.island === d.island);
    if (!p) return [];
    return [{ id: d.id, nome: d.nome, stile: d.stile, x: (p.origin[0] + d.at[0] + 0.5) * arch.tile, z: (p.origin[1] + d.at[1] + 0.5) * arch.tile, icon: ICON }];
  });
  type Spot = (typeof spots)[number];
  const next = () => nextDungeon(o.getLot()?.hero?.completati ?? []);
  /** Porta sigillata per me adesso: il dungeon di prima non è tra i completati. */
  const sigillato = (s: Spot): boolean => { const r = richiesto(s.id); return !!r && !(o.getLot()?.hero?.completati ?? []).includes(r); };
  const nomeDi = (id: string | null) => INGRESSI.find((d) => d.id === id)?.nome ?? '';

  // ---- nel mondo: portale + cartello ----
  const group = new THREE.Group(); group.name = 'ingressi'; o.world.scene.add(group);
  const layer = createLabelLayer(o.root);
  const marks = spots.map((s) => {
    const holder = new THREE.Group(); holder.name = 'ingresso_' + s.id;
    holder.position.set(s.x, o.world.groundY(s.x, s.z), s.z);
    holder.rotation.y = -Math.PI * 0.75; // la bocca (−Z) guarda verso la camera (sud-est)
    group.add(holder);
    const name = `prop_ingresso_${s.stile}`;
    if (o.loader.has(name)) void o.loader.load(name).then((g) => holder.add(g.scene)).catch(() => holder.add(placeholder()));
    else holder.add(placeholder(s.stile));
    const label = layer.add(() => { void enter(s); });
    label.set('bubble', [pixIcon(s.icon, 16), el('span', '', s.nome.toUpperCase())], 'dng');
    label.el.classList.add('dng');
    const sig = richiesto(s.id) ? sigillo(s.stile) : null;
    if (sig) holder.add(sig);
    return { s, holder, label, sig, chiuso: null as boolean | null };
  });

  // ---- bottone ENTRA ----
  const btn = el('button', 'mz mz-play'); btn.id = 'mzDngEntra'; btn.type = 'button';
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { if (near) void enter(near); });
  o.root.append(btn);

  // ---- dungeon insieme (#118): AFFRONTA INSIEME quando all'ingresso c'è anche qualcun altro ----
  const btnSq = el('button', 'mz mz-play'); btnSq.id = 'mzDngInsieme'; btnSq.type = 'button';
  for (const ev of ['pointerdown', 'touchstart']) btnSq.addEventListener(ev, (x) => x.stopPropagation());
  btnSq.addEventListener('click', () => { if (near) apriSquadra(near); });
  o.root.append(btnSq);
  type Squadra = { spot: Spot; ws: WebSocket; box: HTMLElement; chi: HTMLElement; sub: HTMLElement; via: HTMLButtonElement; membri: SqMembro[]; rete: SquadraRete | null; chiusa: boolean };
  /** La squadra in cui sei (riquadro all'ingresso, poi il WebSocket della spedizione); `vicini` = altri giocatori a piedi qui adesso. */
  let squadra: Squadra | null = null, vicini = 0, insieme = 0;
  const viciniA = (s: Spot) => o.world.net.peers().filter((p) => p.mode === 'walk' && Math.hypot(p.x - s.x, p.z - s.z) < NEAR_M + 1).length;

  /** AFFRONTA INSIEME: entri nella squadra di questo dungeon (WebSocket del DO Spedizioni); quando ci sono almeno 2, chiunque dice SCENDIAMO. */
  function apriSquadra(s: Spot): void {
    if (squadra || busy || run || daBox || sigillato(s)) return;
    if (!o.api || !FLAGS.token) { o.hud.toast('Per scendere serve il tuo link personale', 3000); return; }
    let ws: WebSocket;
    try {
      const u = new URL('/ws/squadra/' + s.id, location.href);
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'; u.searchParams.set('t', FLAGS.token);
      ws = new WebSocket(u.toString());
    } catch { o.hud.toast('Squadra non disponibile, riprova', 2500); return; }
    const box = el('div', 'mz mz-dng-sq'); box.id = 'mzDngSquadra';
    const chi = el('div', 'chi', '…'), sub = el('div', 'sub', 'Mi collego…');
    const via = el('button', 'mz-btn via', 'SCENDIAMO') as HTMLButtonElement; via.type = 'button'; via.dataset['act'] = 'via'; via.disabled = true;
    const esci = el('button', 'mz-btn ghost', 'Esci dalla squadra'); esci.type = 'button'; esci.dataset['act'] = 'esci';
    box.append(el('b', '', `Squadra · ${s.nome}`), chi, sub, via, esci);
    for (const ev of ['pointerdown', 'touchstart']) box.addEventListener(ev, (x) => x.stopPropagation());
    o.root.append(box);
    const sq: Squadra = { spot: s, ws, box, chi, sub, via, membri: [], rete: null, chiusa: false };
    squadra = sq; btnSq.classList.remove('on');
    via.addEventListener('click', () => {
      if (sq.membri.length < 2 || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ t: 'via' } satisfies SqClientMsg)); via.disabled = true; sub.textContent = 'Si scende…';
    });
    esci.addEventListener('click', () => chiudiSquadra());
    ws.onmessage = (ev) => {
      const m = parseSqServer(String(ev.data));
      if (!m) return;
      if (m.t === 'T') { sq.rete?.turni.push(m); return; }
      if (m.t === 'squadra') { sq.membri = m.membri; disegnaSquadra(sq, m.max); return; }
      if (m.t === 'errore') { o.hud.toast(m.msg, 3000); if (!sq.rete) { sub.textContent = m.msg; via.disabled = sq.membri.length < 2; } return; }
      if (m.t === 'parte') void scendiInsieme(sq, m);
    };
    ws.onclose = () => { sq.chiusa = true; if (squadra === sq && !sq.rete) { o.hud.toast('La squadra si è sciolta', 2000); chiudiSquadra(); } };
  }
  function disegnaSquadra(sq: Squadra, max: number): void {
    const n = sq.membri.length;
    sq.chi.textContent = sq.membri.map((x) => x.nome).join(' · ');
    sq.sub.textContent = n < 2 ? 'Aspetta i compagni: devono premere AFFRONTA INSIEME anche loro' : `${n} su ${max}: chiunque può dire SCENDIAMO`;
    sq.via.disabled = n < 2; sq.via.textContent = n < 2 ? 'SCENDIAMO' : `SCENDIAMO (${n})`;
  }
  function chiudiSquadra(): void {
    const sq = squadra;
    if (!sq) return;
    squadra = null; sq.box.remove();
    try { if (sq.ws.readyState === WebSocket.OPEN) sq.ws.send(JSON.stringify({ t: 'esco' } satisfies SqClientMsg)); sq.ws.close(1000, 'ciao'); } catch { /* già chiusa */ }
  }

  /** Il server ha aperto la spedizione per tutta la squadra: si scende. A fine spedizione l'esito lo calcola il server dal log. */
  async function scendiInsieme(sq: Squadra, m: Extract<SqServerMsg, { t: 'parte' }>): Promise<void> {
    if (busy || run || !o.api) { chiudiSquadra(); return; }
    const api = o.api, s = sq.spot, zoom0 = o.renderer.diorama.zoom, me = m.eroi[m.io];
    if (!me) { chiudiSquadra(); return; }
    sq.box.remove();
    busy = true; btn.classList.remove('on'); btnSq.classList.remove('on'); lastErr = null;
    sq.rete = {
      io: m.io, eroi: m.eroi, turni: [],
      manda: (x) => { if (sq.ws.readyState === WebSocket.OPEN) sq.ws.send(JSON.stringify(x)); },
      get chiusa() { return sq.chiusa; },
    };
    try {
      o.hud.toast(`${s.nome}: si scende insieme`, 1800);
      const mod = await import('../rpg/index.ts');
      const panel: PanelCtx = { api, hud: o.hud, root: o.root, getLot: o.getLot, setLot: o.setLot };
      run = mod.startRun(ctx, { dungeon: m.dungeon, seed: m.seed, hero: me.hero, stato: me.stato, partenza: null, panel, rete: sq.rete });
      entered++; insieme++; current = s.id; busy = false;
      await run.done;
      run = null; busy = true;
      backToEntrance(s, zoom0);
      chiudiSquadra();
      try { await consegna(s, mod, await api.dungeonFinish('', 0)); } catch (e) { fail(e, 'Spedizione non salvata, riprova'); }
    } catch (e) {
      console.error('[marea] dungeon insieme', e); fail(e, 'Qualcosa è andato storto nel dungeon');
      if (run) { run.abort(); run = null; }
      backToEntrance(s, zoom0); chiudiSquadra();
    } finally { busy = false; current = null; }
  }

  let near: Spot | null = null, nearWas: Spot | null = null, aWas = false, busy = false, run: DungeonRun | null = null;
  let entered = 0, finishes = 0, aborts = 0, lastErr: string | null = null, lastResult: unknown = null, current: string | null = null;
  /** Salvataggi all'altare confermati dal server in questa sessione, e l'ultima spedizione interrotta recuperata alla discesa. */
  let salvataggi = 0, recuperato: unknown = null;
  const ctx: RunCtx = { world: o.world, renderer: o.renderer, loader: o.loader, hud: o.hud, root: o.root, canvas: o.canvas };

  const v = new THREE.Vector3();
  const screenOf = (x: number, y: number, z: number) => {
    v.set(x, y, z).project(o.renderer.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    return { x: r.left - rr.left + ((v.x + 1) / 2) * r.width, y: r.top - rr.top + ((1 - v.y) / 2) * r.height, on: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  };

  /** Uscito l'ultima volta da una lanterna di questo dungeon: «Da dove parti?». null = ci ha ripensato. */
  let daBox: HTMLElement | null = null;
  function askDa(s: Spot): Promise<'ingresso' | 'lanterna' | null> {
    return new Promise((res) => {
      const box = el('div', 'mz mz-dng-da'); box.id = 'mzDngDa'; daBox = box;
      const close = (v: 'ingresso' | 'lanterna' | null) => { box.remove(); daBox = null; removeEventListener('keydown', kd, true); res(v); };
      const b = (cls: string, act: string, txt: string, v: 'ingresso' | 'lanterna' | null) => { const x = el('button', cls, txt); x.type = 'button'; x.dataset['act'] = act; x.addEventListener('click', () => close(v)); return x; };
      const kd = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(null); } };
      box.append(el('b', '', s.nome), el('div', 'sub', 'Da dove parti?'),
        b('mz-btn lan', 'lanterna', 'DALLA LANTERNA', 'lanterna'), b('mz-btn ghost', 'ingresso', 'DALL’INGRESSO', 'ingresso'), b('mz-btn ghost', 'annulla', 'Annulla', null));
      for (const ev of ['pointerdown', 'touchstart']) box.addEventListener(ev, (x) => x.stopPropagation());
      addEventListener('keydown', kd, true);
      o.root.append(box);
    });
  }

  /** Esito del server arrivato: lotto nuovo, scheda dell'esito, e se il capo è caduto per la prima volta il dungeon dopo. */
  async function consegna(s: Spot, mod: typeof import('../rpg/index.ts'), r: DungeonFinish, clientHash?: number): Promise<void> {
    const prima = next();
    finishes++; lastResult = { outcome: r.result.outcome, tenuto: r.tenuto, monete: r.monete, livelliSu: r.livelliSu, capo: r.result.capo ?? false, usati: r.result.usati, rotti: r.result.rotti, hash: r.result.hash, clientHash: clientHash ?? null };
    o.setLot(r.lot);
    await mod.showResult(ctx, r);
    // capo ucciso la prima volta: la bussola passa al dungeon dopo, e lo si dice
    const dopo = next();
    if (dopo !== prima && (r.lot.hero?.completati ?? []).includes(s.id)) {
      const n = INGRESSI.find((d) => d.id === dopo);
      o.hud.toast(n ? `${s.nome} completata! Prossimo dungeon: ${n.nome}` : `${s.nome} completato! Hai finito tutti i dungeon`, 4500);
    }
  }

  async function enter(s: Spot, daTest?: 'ingresso' | 'lanterna'): Promise<void> {
    if (busy || run || o.world.race.on || daBox) return;
    if (!o.api && FLAGS.test && !FLAGS.net) { await provaOffline(s); return; }
    if (sigillato(s)) { lastErr = `Sigillato: prima completa ${nomeDi(richiesto(s.id))}`; o.hud.toast(lastErr, 3200); return; }
    const api = o.api;
    if (!api) { o.hud.toast('Per scendere serve il tuo link personale', 3000); return; }
    const lan = o.getLot()?.hero?.lanterne?.[s.id];
    let da: 'ingresso' | 'lanterna' = 'ingresso';
    if (daTest) da = daTest;
    else if (typeof lan === 'number') { const v = await askDa(s); if (!v) return; da = v; }
    if (busy || run) return;
    busy = true; btn.classList.remove('on'); lastErr = null;
    const zoom0 = o.renderer.diorama.zoom;
    try {
      let st;
      try { st = await api.dungeonStart(s.id, da); } catch (e) { fail(e, 'Niente connessione, riprova tra poco'); return; }
      o.setLot(st.lot);
      const rec = st.recuperato, recN = rec ? Object.values(rec.tenuto).reduce((a, b) => a + b, 0) : 0;
      if (rec) recuperato = rec;
      if (rec && (recN > 0 || rec.monete > 0)) o.hud.toast(`Dalla spedizione interrotta hai tenuto ${recN} oggetti e ${rec.monete} monete (altare)`, 3500);
      else o.hud.toast(`${s.nome}…`, 1500);
      const mod = await import('../rpg/index.ts');
      const { encodeDungeon } = await import('@marea/sim/dungeon/replay.ts');
      // SALVA alla lanterna: input e azioni fin lì al server, che li rigioca e tiene il salvataggio anche se la scheda si chiude
      const onAltare = (sv: { inputs: PackedDungeon; hash: number; azioni: DungeonAzioni }) => {
        api.dungeonSave(encodeDungeon(sv.inputs), sv.hash, sv.azioni).then(() => { salvataggi++; }, (e: unknown) => { console.warn('[marea] salvataggio alla lanterna non riuscito', e); o.hud.toast('Il server non ha ricevuto il salvataggio: se chiudi adesso lo perdi', 3000); });
      };
      const panel: PanelCtx = { api, hud: o.hud, root: o.root, getLot: o.getLot, setLot: o.setLot };
      run = mod.startRun(ctx, { dungeon: st.dungeon, seed: st.seed, hero: st.hero, stato: st.stato, partenza: st.partenza, panel, onAltare });
      entered++; current = s.id; busy = false;
      const done = await run.done;
      run = null; busy = true;
      backToEntrance(s, zoom0);
      if (!done || 'insieme' in done) { aborts++; o.hud.toast('Sei risalito senza bottino', 2500); return; }
      try { await consegna(s, mod, await api.dungeonFinish(encodeDungeon(done.inputs), done.hash, done.azioni), done.hash); } catch (e) { fail(e, 'Spedizione non salvata, riprova'); }
    } catch (e) {
      console.error('[marea] dungeon', e); fail(e, 'Qualcosa è andato storto nel dungeon');
      if (run) { run.abort(); run = null; }
      backToEntrance(s, zoom0);
    } finally { busy = false; current = null; }
  }
  /** Prova senza server (?test=1&net=0): eroe nuovo, seed dei flag, niente consegna né sigilli. Per guardare e fotografare ogni dungeon. */
  async function provaOffline(s: Spot): Promise<void> {
    busy = true; btn.classList.remove('on');
    const zoom0 = o.renderer.diorama.zoom;
    try {
      const [mod, { newHero, runHeroOf }] = await Promise.all([import('../rpg/index.ts'), import('@marea/sim/rpg/hero.ts')]);
      run = mod.startRun(ctx, { dungeon: s.id, seed: FLAGS.seed, hero: runHeroOf(newHero()) });
      entered++; current = s.id; busy = false;
      await run.done;
      run = null; busy = true;
      backToEntrance(s, zoom0);
    } finally { busy = false; current = null; }
  }
  function fail(e: unknown, fallback: string): void {
    lastErr = e instanceof ApiError ? e.message : fallback;
    o.hud.toast(lastErr, 3200);
  }
  function backToEntrance(s: Spot, zoom: number): void {
    o.renderer.setScene(null);
    const a = o.world.avatar;
    if (o.world.mode === 'walk') a.teleport(s.x, s.z + 3); // davanti alla bocca, a sud: la camera (da sud-est) lo vede
    o.renderer.diorama.setZoom(zoom);
    o.renderer.diorama.follow(a.state.x, o.world.groundY(a.state.x, a.state.z), a.state.z);
    o.renderer.diorama.snap?.();
    nearWas = s; // di nuovo davanti alla bocca: niente «premi A», che coprirebbe il toast dell'esito
  }

  /** La scenografia casuale entro 6 m dagli ingressi si toglie (ingressi_forme.ts). */
  let cleared = 0, clearPasses = 0;
  const clearScenery = () => { cleared += togliScenografia(o.world.scene, spots); };

  registerStateProvider('ingressi', () => ({
    spots: spots.map(({ id, nome, x, z }) => ({ id, nome, x, z })), models: marks.map((m) => m.holder.children.length), sigillati: spots.filter((s) => sigillato(s)).map((s) => s.id), cleared, near: near?.id ?? null, next: next(), busy, active: !!run?.active, entered, finishes, aborts, salvataggi, recuperato, lastErr, lastResult,
    vicini, insieme, squadra: squadra ? { dungeon: squadra.spot.id, membri: squadra.membri.map((x) => x.nome), giu: !!squadra.rete, chiusa: squadra.chiusa } : null,
  }));
  // insieme (#118): entra nella squadra di un dungeon (anche senza nessuno vicino) e SCENDIAMO
  registerTestHook('squadra', (id) => {
    const s = spots.find((x) => x.id === String(id ?? 'grotta'));
    if (!s || busy || run || squadra) return false;
    if (o.world.mode === 'walk') o.world.avatar.teleport(s.x, s.z + 3);
    apriSquadra(s);
    return true;
  });
  registerTestHook('squadraVia', () => { if (!squadra || squadra.membri.length < 2) return false; squadra.via.click(); return true; });
  registerStateProvider('dungeon', () => (run && dungeonLink.state ? { ...dungeonLink.state(), busy } : { active: false, dungeon: current, busy, tick: 0, outcome: null, hero: null, nemici: 0, vivi: 0 }));
  registerTestHook('enterDungeon', (id, da) => {
    const s = spots.find((x) => x.id === String(id ?? 'grotta'));
    if (!s || busy || run) return false;
    if (o.world.mode === 'walk') o.world.avatar.teleport(s.x, s.z + 3);
    void enter(s, da === 'lanterna' || da === 'ingresso' ? da : undefined);
    return true;
  });
  registerTestHook('dungeonAct', (a) => (dungeonLink.act ? dungeonLink.act(a as DungeonAzione) : 'nessuna spedizione'));
  registerTestHook('dungeonAltare', (n) => { dungeonLink.altare = Number.isInteger(n) ? Number(n) : -1; return dungeonLink.altare; });
  registerTestHook('dungeonVai', (cx, cz) => { dungeonLink.vai = Number.isInteger(cx) && Number.isInteger(cz) ? [Number(cx), Number(cz)] : null; return dungeonLink.vai; });
  registerTestHook('dungeonPosa', (p) => { dungeonLink.posa = p && typeof p === 'object' ? { ...(p as Record<string, unknown>) } : null; return dungeonLink.posa; });
  registerTestHook('dungeonAutopilot', (on, speed) => { dungeonLink.autopilot = on ? Math.max(1, Math.min(20, Math.round(Number(speed ?? 4)) || 4)) : 0; return dungeonLink.autopilot; });

  return {
    spots: spots.map(({ id, nome, x, z, icon }) => ({ id, nome, x, z, icon })),
    get active() { return !!run && run.active; },
    isBusy: () => busy || !!daBox || (!!run && !run.active),
    next,
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      if (busy || run) { near = null; return; }
      const f = o.world.avatar.state, aPiedi = o.world.mode === 'walk' && !o.world.race.on;
      // in squadra (prima di scendere): chi si allontana dall'ingresso ne esce
      if (squadra && !squadra.rete && (!aPiedi || Math.hypot(f.x - squadra.spot.x, f.z - squadra.spot.z) > LONTANO_M)) { chiudiSquadra(); o.hud.toast('Troppo lontano dall’ingresso: fuori dalla squadra', 2500); }
      if (!aPiedi) { near = null; vicini = 0; return; }
      near = spots.find((s) => Math.hypot(f.x - s.x, f.z - s.z) < NEAR_M) ?? null;
      vicini = near ? viciniA(near) : 0;
      if (near && near !== nearWas) o.hud.toast(sigillato(near) ? `${near.nome}: sigillato. Prima completa ${nomeDi(richiesto(near.id))}` : vicini ? `${near.nome}: ENTRA da solo o AFFRONTA INSIEME` : `${near.nome}: premi A o tocca ENTRA`, 2500);
      nearWas = near;
      if (near && pressA && !squadra) void enter(near);
    },
    step(f) { run?.step(f); },
    update(alpha, dt, t) {
      if (run) { run.update(alpha, dt, t); return; }
      if (clearPasses === 0 || (clearPasses === 1 && t > 4)) { clearPasses++; clearScenery(); } // la scenografia può arrivare dopo
      const show = !!near && !busy && !daBox && !squadra;
      const chiusa = !!near && sigillato(near), bsig = `${near?.id}|${chiusa}`;
      if (show && near && btn.dataset['spot'] !== bsig) {
        btn.dataset['spot'] = bsig;
        btn.replaceChildren(pixIcon(near.icon, 24), el('span', '', chiusa ? `SIGILLATO · ${near.nome.toUpperCase()}` : `ENTRA · ${near.nome.toUpperCase()}`), el('small', '', chiusa ? `prima: ${nomeDi(richiesto(near.id))}` : 'A'));
      }
      btn.classList.toggle('on', show); btn.classList.toggle('sig', chiusa);
      const showSq = show && vicini > 0 && !chiusa, sig = `${near?.id}|${vicini}`;
      if (showSq && btnSq.dataset['sig'] !== sig) { btnSq.dataset['sig'] = sig; btnSq.replaceChildren(pixIcon(ICON, 24), el('span', '', 'AFFRONTA INSIEME'), el('small', '', `${vicini + 1} qui`)); }
      btnSq.classList.toggle('on', showSq);
      const f = o.world.mode === 'walk' ? o.world.avatar.state : o.world.boat.state;
      for (const m of marks) {
        // porta sigillata: sbarre e cartello finché non completi il dungeon di prima (si apre da sola appena il server lo dice)
        if (m.sig) {
          const c = sigillato(m.s);
          if (c !== m.chiuso) {
            m.chiuso = c; m.sig.visible = c;
            m.label.set('bubble', [pixIcon(m.s.icon, 16), el('span', '', c ? `${m.s.nome.toUpperCase()} · SIGILLATO` : m.s.nome.toUpperCase())], c ? 'dng-sig' : 'dng');
            m.label.el.classList.add('dng'); m.label.el.classList.toggle('sig', c); // set() rifà le classi
          }
        }
        const p = screenOf(m.s.x, m.holder.position.y + 3.6, m.s.z); m.label.place(p.x, p.y, p.on && !o.world.race.on, Math.hypot(f.x - m.s.x, f.z - m.s.z) < LABEL_NEAR_M);
      }
    },
  };
}

