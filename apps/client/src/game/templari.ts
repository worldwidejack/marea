// Isola dei Templari nel mondo (docs/TEMPLARI.md §2): la porta della chiesa con ENTRA (A vicino), il bottone ⚔ delle prove (?templari=1:
// subito nelle ondate, da ovunque), il server che apre e chiude la partita. Bundle iniziale: piccolo, niente import statici della sim o dei
// dati delle ondate (solo `import type`): la partita vera è il chunk apps/client/src/templari/ scaricato entrando.
// Giro: ENTRA → import('../templari/index.ts') → SCEGLI L'EROE (templari/scelta.ts; Esc = di nuovo fuori) → POST /api/templari/start
// (seed, l'eroe) → startTemplari → a fine partita POST /api/templari/finish
// (input compressi, azioni) → scheda dell'esito del server → setLot → davanti alla porta. Senza link personale si gioca senza premio.
// Il calice (§2; dal 10/10 non apre più niente, l'isola è libera e la porta fa entrare con le ondate già partite): sull'Isola della Tempesta, sotto il faro, lo scheletro di fra' Guillaume col calice in grembo (luccica, un fascio di luce
// lo segnala da lontano): A vicino lo prende (POST /api/templari/reliquia → nel lotto, la nebbia rossa si dirada) e si legge il biglietto,
// che si può rileggere dopo. Senza link personale il calice resta finché non ricarichi.
// Insieme (PROTOCOL §9): davanti alla porta GIOCA INSIEME fa scegliere l'eroe (va nell'indirizzo del WebSocket) e apre la sala (WebSocket /ws/templari, DO TemplariInsieme); con almeno 2 chiunque dice
// SI PARTE → il server apre la partita nel lotto di ciascuno → `parte` → il chunk gioca coi turni del server → a fine partita
// POST /api/templari/finish senza input (il server rigioca il log della squadra) → scheda dell'esito. Allontanarsi dalla porta = fuori dalla sala.
import * as THREE from 'three';
import type { InputFrame, LotState } from '@marea/sim';
import { ISLANDS } from '@marea/content';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api } from '../net/api.ts';
import { ApiError } from '../net/api.ts';
import { CHIESA } from '../render/island_templari.ts';
import { suona } from '../audio/ponte.ts';
import { PAL, el, injectUiStyle } from '../ui/style.ts';
import { topButton } from '../ui/topbar.ts';
import { FLAGS } from '../flags.ts';
import { temaAperta } from './temi.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import type { TemplariRete, TemplariRun } from '../templari/types.ts';
import type { Scelta } from '../templari/scelta.ts';
import type { TClasse } from '@marea/content/templari.ts';
import { TI_STORIA, parseTiServer } from '@marea/protocol/templari_insieme.ts';
import type { TiClientMsg, TiMembro, TiServerMsg, TiTurno } from '@marea/protocol/templari_insieme.ts';

export type Templari = {
  /** La porta della chiesa (per la bussola), null se l'isola non c'è. */
  readonly spot: { id: string; nome: string; x: number; z: number } | null;
  /** Fuori dalla partita, un tick: davanti alla porta il fronte di A entra. */
  tick(a: boolean): void;
  /** Nella partita, un tick (al posto di world.step). */
  step(f: InputFrame): void;
  update(alpha: number, dt: number, t: number): void;
  readonly active: boolean;
  /** Partita che parte o scheda dell'esito aperta: il mondo sta fermo. */
  isBusy(): boolean;
  /** Lo scheletro col calice sotto il faro della Tempesta (per la bussola), null se l'isola non c'è. */
  readonly relitto: { x: number; z: number } | null;
  /** Il calice è tuo (la nebbia rossa si è diradata). */
  calice(): boolean;
};


const NEAR_M = 4;
/** Il nome corto degli eroi del menù, per la sala. */
const NOMI_EROI: Record<string, string> = { crociato: 'Crociato', bucaniera: 'Bucaniera', arciere: 'Arciere' };
/** Sala: chi si allontana più di così dalla porta della chiesa esce dalla sala. */
const LONTANO_M = NEAR_M + 3;
const CSS = `#mzTemplariInsieme { top: calc(60% + 66px); background: ${PAL.erbaChiara}; }
body.mz-sotto #mzTemplariInsieme, body.mz-sotto #mzTemplariSala { display: none; }
.mz-tpl-sala { position: absolute; left: 50%; top: max(64px, calc(env(safe-area-inset-top) + 56px)); transform: translateX(-50%); width: min(320px, calc(100% - 32px)); padding: 12px 14px 14px; background: rgba(46,30,20,.96); border: 3px solid ${PAL.rosso}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; z-index: 24; text-align: center; }
.mz-tpl-sala b { display: block; font-size: 18px; }
.mz-tpl-sala .chi { margin: 6px 0 2px; font-weight: bold; font-size: 16px; color: ${PAL.erbaChiara}; }
.mz-tpl-sala .sub { color: ${PAL.sabbia}; font-size: 13px; margin: 2px 0 6px; }
.mz-tpl-sala .mz-btn { justify-content: center; }
.mz-tpl-sala .mz-btn.via { background: ${PAL.rosso}; color: ${PAL.sabbiaChiara}; }`;
/** Stato condiviso col chunk (test): autopilota (tick per frame) e vista corrente per state().templari. */
/** `prova`: solo test, mette nella partita un'arma, lo scudo, punti o uno zombie davanti (la partita così non si rigioca uguale: solo senza server). */
export const templariLink: { autopilot: number; state: (() => Record<string, unknown>) | null; prova: ((o: Record<string, unknown>) => unknown) | null } = { autopilot: FLAGS.autopilot ? 4 : 0, state: null, prova: null };

export function createTemplari(o: { world: GameWorld; renderer: Renderer; loader: Loader; api: Api | null; hud: Hud; root: HTMLElement; canvas: HTMLCanvasElement; getLot(): LotState | null; setLot(l: LotState): void }): Templari {
  injectUiStyle();
  if (!document.getElementById('mz-templari-style')) { const st = document.createElement('style'); st.id = 'mz-templari-style'; st.textContent = CSS; document.head.appendChild(st); }
  const arch = o.world.archipelago, place = arch.places.find((p) => p.island === 'templari') ?? null;
  const def = ISLANDS.find((i) => i.id === 'templari'), chiesa = def?.props?.find((p) => p.k === 'chiesa_templare');
  const spot = place && chiesa ? {
    id: 'templari', nome: 'Chiesa dei Templari',
    x: (place.origin[0] + chiesa.at[0] + 0.5) * arch.tile - CHIESA.portale - 0.8, z: (place.origin[1] + chiesa.at[1] + 0.5) * arch.tile,
  } : null;
  const aperta = () => FLAGS.templari || temaAperta('templari');

  // ---- lo scheletro e il calice sotto il faro della Tempesta ----
  const tPlace = arch.places.find((p) => p.island === 'tempesta') ?? null;
  const osso = ISLANDS.find((i) => i.id === 'tempesta')?.props?.find((p) => p.k === 'scheletro');
  const relitto = tPlace && osso ? { x: (tPlace.origin[0] + osso.at[0] + 0.5) * arch.tile, z: (tPlace.origin[1] + osso.at[1] + 0.5) * arch.tile } : null;
  let caliceQui = false; // senza link personale: preso solo per questa visita
  const haCalice = () => caliceQui || (o.getLot()?.reliquie ?? []).includes('templari');
  const calice = new THREE.Group(); calice.name = 'calice_templare'; calice.visible = false;
  if (relitto) {
    calice.position.set(relitto.x, o.world.groundY(relitto.x, relitto.z) + 0.45, relitto.z);
    o.world.scene.add(calice);
    void import('./templari_relitto.ts').then((m) => m.riempiCalice(calice), () => {}); // l'oro e il fascio di luce: chunk a parte
  }
  // il biglietto: chunk a parte (game/templari_relitto.ts), scaricato la prima volta che lo apri
  let biglietto: HTMLElement | null = null;
  const bigliettoAperto = () => !!biglietto?.classList.contains('on');
  const apriBiglietto = async (): Promise<void> => {
    try {
      if (!biglietto) { const m = await import('./templari_relitto.ts'); biglietto ??= m.creaBiglietto(o.root, () => { nearRWas = true; }); }
      biglietto.classList.add('on');
    } catch { o.hud.toast('Il biglietto non si apre: niente connessione, riprova', 3000); }
  };
  const btnR = el('button', 'mz mz-play'); btnR.id = 'mzTemplariCalice'; btnR.type = 'button';
  btnR.style.background = PAL.giallo; btnR.style.color = PAL.ombraCalda;
  for (const ev of ['pointerdown', 'touchstart']) btnR.addEventListener(ev, (x) => x.stopPropagation());
  btnR.addEventListener('click', () => { void usaRelitto(); });
  o.root.append(btnR);
  let nearR = false, nearRWas = false, busyR = false, prese = 0;
  async function usaRelitto(): Promise<void> {
    if (busyR) return;
    if (haCalice()) { await apriBiglietto(); return; }
    busyR = true;
    try {
      const api = o.api && FLAGS.token ? o.api : null;
      if (api) { const r = await api.templariReliquia(); o.setLot(r.lot); }
      else { caliceQui = true; o.hud.toast('Senza il tuo link personale il calice resta tuo solo per questa visita', 3200); }
      prese++;
      suona('medaglia_oro');
      await apriBiglietto();
      o.hud.toast('Il calice dei Templari è tuo', 4200);
    } catch (e) { fail(e, 'Il calice non si stacca dalle ossa, riprova'); } finally { busyR = false; }
  }

  const btn = el('button', 'mz mz-play'); btn.id = 'mzTemplariEntra'; btn.type = 'button';
  btn.style.background = PAL.rosso; btn.style.color = PAL.sabbiaChiara;
  btn.replaceChildren(el('span', '', '✠ Entra nella chiesa'), el('small', '', 'A'));
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { void entra(true); });
  o.root.append(btn);

  // ---- insieme: GIOCA INSIEME davanti alla porta, la sala, SI PARTE ----
  const btnIns = el('button', 'mz mz-play'); btnIns.id = 'mzTemplariInsieme'; btnIns.type = 'button';
  btnIns.style.color = PAL.ombraCalda;
  btnIns.replaceChildren(el('span', '', '⚔ Gioca insieme'));
  for (const ev of ['pointerdown', 'touchstart']) btnIns.addEventListener(ev, (x) => x.stopPropagation());
  btnIns.addEventListener('click', () => { void giocaInsieme(); });
  o.root.append(btnIns);
  /** `url`: l'indirizzo della sala (token, eroe); in partita `run` e `io`, `prossimo` = il primo turno non ancora arrivato, `storia` = gli
   *  ultimi turni arrivati (per la ripresa), `ricollega` = linea persa e si sta ricollegando (da `dal`), `giri` = ricollegamenti riusciti,
   *  `finita` = la partita è finita qui (niente più ricollegamenti). */
  type Sala = {
    ws: WebSocket; url: string; box: HTMLElement; chi: HTMLElement; sub: HTMLElement; via: HTMLButtonElement; membri: TiMembro[]; rete: TemplariRete | null; chiusa: boolean;
    run: string | null; io: number; prossimo: number; storia: TiTurno[]; ricollega: boolean; dal: number; giri: number; finita: boolean;
  };
  /** La sala in cui sei (riquadro alla porta, poi il WebSocket della partita insieme). */
  let sala: Sala | null = null, insieme = 0;
  /** Linea persa in partita (o il server che si riavvia a un deploy): si riprova ogni RICOLLEGA_OGNI_MS fino a RICOLLEGA_MAX_MS. */
  const RICOLLEGA_OGNI_MS = 1500, RICOLLEGA_MAX_MS = 40_000;

  /** GIOCA INSIEME: prima l'eroe (il menù), poi entri nella sala alla porta della chiesa; quando ci sono almeno 2, chiunque dice SI PARTE. */
  async function giocaInsieme(): Promise<void> {
    if (sala || busy || run) return;
    if (!o.api || !FLAGS.token) { o.hud.toast('Per giocare insieme serve il tuo link personale', 3000); return; }
    busy = true; btn.classList.remove('on'); btnIns.classList.remove('on');
    const zoom0 = o.renderer.diorama.zoom;
    let classe: TClasse | null = null;
    try { classe = await scegliEroe(true); } catch (e) { console.error('[marea] templari scelta', e); fail(e, 'Il menù non si apre, riprova'); }
    busy = false; fuori(zoom0);
    if (classe) apriSala(classe);
  }
  /** La sala alla porta (WebSocket /ws/templari) con l'eroe scelto. */
  function apriSala(classe: TClasse | null): void {
    if (sala || busy || run) return;
    if (!o.api || !FLAGS.token) { o.hud.toast('Per giocare insieme serve il tuo link personale', 3000); return; }
    let ws: WebSocket, url: string;
    try {
      const u = new URL('/ws/templari', location.href);
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'; u.searchParams.set('t', FLAGS.token);
      if (classe) u.searchParams.set('classe', classe);
      url = u.toString();
      ws = new WebSocket(url);
    } catch { o.hud.toast('La sala non risponde, riprova', 2500); return; }
    const box = el('div', 'mz mz-tpl-sala'); box.id = 'mzTemplariSala';
    const chi = el('div', 'chi', '…'), sub = el('div', 'sub', 'Mi collego…');
    const via = el('button', 'mz-btn via', 'Si parte') as HTMLButtonElement; via.type = 'button'; via.dataset['act'] = 'via'; via.disabled = true;
    const esci = el('button', 'mz-btn ghost', 'Esci dalla sala'); esci.type = 'button'; esci.dataset['act'] = 'esci';
    box.append(el('b', '', '✠ Insieme nella chiesa'), chi, sub, via, esci);
    for (const ev of ['pointerdown', 'touchstart']) box.addEventListener(ev, (x) => x.stopPropagation());
    o.root.append(box);
    const sq: Sala = { ws, url, box, chi, sub, via, membri: [], rete: null, chiusa: false, run: null, io: 0, prossimo: 0, storia: [], ricollega: false, dal: 0, giri: 0, finita: false };
    sala = sq; btnIns.classList.remove('on');
    via.addEventListener('click', () => {
      if (sq.membri.length < 2 || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ t: 'via' } satisfies TiClientMsg)); via.disabled = true; sub.textContent = 'Si entra…';
    });
    esci.addEventListener('click', () => chiudiSala());
    ascolta(sq, ws);
  }
  /** I messaggi della socket della sala (anche di quella nuova dopo un ricollegamento; quelle vecchie non contano più). */
  function ascolta(sq: Sala, ws: WebSocket): void {
    ws.onmessage = (ev) => {
      if (sq.ws !== ws) return;
      const m = parseTiServer(String(ev.data));
      if (!m) return;
      if (m.t === 'T') {
        if (m.n < sq.prossimo) return; // già arrivato (dopo una ripresa)
        sq.prossimo = m.n + 1;
        sq.storia.push(m); if (sq.storia.length > TI_STORIA) sq.storia.splice(0, sq.storia.length - TI_STORIA);
        sq.rete?.turni.push(m);
        return;
      }
      if (m.t === 'ripresa') {
        // il server ha i turni fino a m.n escluso: gli rimando quelli che ho da lì in poi (dopo un suo riavvio gli mancano)
        try { ws.send(JSON.stringify({ t: 'storia', turni: sq.storia.filter((t) => t.n >= m.n) } satisfies TiClientMsg)); } catch { /* chiusa */ }
        if (sq.ricollega) { sq.ricollega = false; sq.giri++; }
        return;
      }
      if (m.t === 'sala') { sq.membri = m.membri; disegnaSala(sq, m.max); return; }
      if (m.t === 'errore') { o.hud.toast(m.msg, 3000); if (!sq.rete) { sq.sub.textContent = m.msg; sq.via.disabled = sq.membri.length < 2; } return; }
      if (m.t === 'parte') { sq.run = m.run; sq.io = m.io; sq.prossimo = 0; sq.storia = []; void entraInsieme(sq, m); }
    };
    ws.onclose = (ev) => {
      if (sq.ws !== ws) return;
      // in partita, se non l'ha chiusa il server apposta (1000: alba, fine, fuori), ci si ricollega
      if (sq.rete && sq.run && !sq.finita && ev.code !== 1000) { ricollegati(sq); return; }
      sq.ricollega = false; sq.chiusa = true;
      if (sala === sq && !sq.rete) { o.hud.toast('La sala si è sciolta', 2000); chiudiSala(); }
    };
  }
  /** Linea persa in partita: una socket nuova con la partita (`run`, `idx`) e il primo turno che manca (`n`); il server riprende da lì. */
  function ricollegati(sq: Sala): void {
    if (!sq.ricollega) { sq.ricollega = true; sq.dal = Date.now(); console.warn('[marea] templari insieme: linea persa, mi ricollego'); }
    if (Date.now() - sq.dal > RICOLLEGA_MAX_MS) { sq.ricollega = false; sq.chiusa = true; return; }
    setTimeout(() => {
      if (sq.finita || sq.chiusa || !sq.run) return;
      const u = new URL(sq.url);
      u.searchParams.set('run', sq.run); u.searchParams.set('idx', String(sq.io)); u.searchParams.set('n', String(sq.prossimo));
      let ws: WebSocket;
      try { ws = new WebSocket(u.toString()); } catch { ricollegati(sq); return; }
      sq.ws = ws;
      ascolta(sq, ws);
    }, RICOLLEGA_OGNI_MS);
  }
  function disegnaSala(sq: Sala, max: number): void {
    const n = sq.membri.length;
    sq.chi.textContent = sq.membri.map((x) => (x.classe ? `${x.nome} (${NOMI_EROI[x.classe] ?? x.classe})` : x.nome)).join(' · ');
    sq.sub.textContent = n < 2 ? 'Aspetta i compagni: devono premere «Gioca insieme» anche loro, qui alla porta' : `${n} su ${max}: chiunque può dire «Si parte»`;
    sq.via.disabled = n < 2; sq.via.textContent = n < 2 ? 'Si parte' : `Si parte (${n})`;
  }
  function chiudiSala(): void {
    const sq = sala;
    if (!sq) return;
    sala = null; sq.box.remove(); sq.finita = true;
    try { if (sq.ws.readyState === WebSocket.OPEN) sq.ws.send(JSON.stringify({ t: 'esco' } satisfies TiClientMsg)); sq.ws.close(1000, 'ciao'); } catch { /* già chiusa */ }
  }
  /** Il server ha aperto la partita per tutta la sala: si entra. A fine partita l'esito lo calcola il server dal log della squadra. */
  async function entraInsieme(sq: Sala, m: Extract<TiServerMsg, { t: 'parte' }>): Promise<void> {
    if (busy || run || !o.api) { chiudiSala(); return; }
    const api = o.api, zoom0 = o.renderer.diorama.zoom;
    sq.box.remove();
    busy = true; btn.classList.remove('on'); btnIns.classList.remove('on'); lastErr = null;
    sq.rete = {
      io: m.io, membri: m.membri, turni: [],
      manda: (x) => { if (sq.ws.readyState === WebSocket.OPEN) sq.ws.send(JSON.stringify(x)); },
      get chiusa() { return sq.chiusa; },
      get ricollega() { return sq.ricollega; },
      get giri() { return sq.giri; },
    };
    try {
      o.hud.toast('Si entra insieme nella chiesa…', 1800);
      const mod = await import('../templari/index.ts');
      run = mod.startTemplari({ world: o.world, renderer: o.renderer, loader: o.loader, hud: o.hud, root: o.root, canvas: o.canvas }, { seed: m.seed, subito: true, rete: sq.rete });
      entrate++; insieme++; busy = false;
      await run.done;
      run = null; busy = true;
      fuori(zoom0); chiudiSala();
      try {
        const r = await api.templariFinish('', 0, []);
        finite++; lastResult = { ...r.result, premio: r.premio, tetto: r.tetto, record: r.record, insieme: true };
        o.setLot(r.lot);
        await mod.mostraEsito(o.root, { result: r.result, premio: r.premio, tetto: r.tetto, record: r.record });
      } catch (e) { fail(e, 'Partita non salvata, riprova'); }
    } catch (e) {
      console.error('[marea] templari insieme', e); fail(e, 'Qualcosa è andato storto nella chiesa');
      if (run) { run.abort(); run = null; }
      fuori(zoom0); chiudiSala();
    } finally { busy = false; }
  }
  // prove (?templari=1): subito nelle ondate, senza reliquia e senza barca; ⛪ a piedi davanti alla porta della chiesa
  if (FLAGS.templari) topButton({ root: o.root, id: 'mzTemplariProva', order: 9, label: '⚔', title: 'Templari: ondate subito (prova)', onClick: () => { void entra(true); } });
  if (FLAGS.templari) topButton({ root: o.root, id: 'mzTemplariVai', order: 9, label: '⛪', title: 'Templari: vai all’isola, davanti alla chiesa (prova)', onClick: () => { vaiChiesa(); } });
  function vaiChiesa(): void {
    if (busy || run || !spot || !o.world.vai('templari')) return;
    o.world.avatar.teleport(spot.x - 1.5, spot.z + 2);
    o.renderer.diorama.follow(spot.x - 1.5, o.world.groundY(spot.x, spot.z), spot.z + 2); o.renderer.diorama.snap?.();
    o.hud.toast('L’Isola dei Templari: la porta della chiesa è qui davanti (A per entrare)', 3200);
  }

  let near = false, aWas = false, busy = false, run: TemplariRun | null = null, menu: Scelta | null = null;
  /** SCEGLI L'EROE (chunk delle ondate): l'eroe, o null se torni fuori. Nella stanza di prova niente menù: l'ultimo scelto. */
  async function scegliEroe(insieme: boolean, salta?: TClasse): Promise<TClasse | null> {
    const mod = await import('../templari/index.ts');
    if (salta) return salta;
    if (FLAGS.banco) return mod.eroeSalvato();
    menu = mod.apriScelta({ world: o.world, renderer: o.renderer, loader: o.loader, hud: o.hud, root: o.root, canvas: o.canvas }, { look: o.world.look, insieme });
    try { return await menu.done; } finally { menu = null; }
  }
  let entrate = 0, finite = 0, lastErr: string | null = null, lastResult: unknown = null;

  /** `salta`: l'eroe già scelto (test), niente menù. */
  async function entra(subito: boolean, salta?: TClasse): Promise<void> {
    if (busy || run || o.world.race.on || sala) return;
    busy = true; btn.classList.remove('on'); btnIns.classList.remove('on'); lastErr = null;
    const zoom0 = o.renderer.diorama.zoom, api = o.api && FLAGS.token && !FLAGS.banco ? o.api : null;
    try {
      const classe = await scegliEroe(false, salta);
      if (!classe) { fuori(zoom0); return; } // tornato fuori dal menù
      let seed: number;
      if (api) {
        try { const st = await api.templariStart(subito, classe); seed = st.seed; o.setLot(st.lot); } catch (e) { fail(e, 'Niente connessione, riprova tra poco'); fuori(zoom0); return; }
      } else {
        seed = (Math.random() * 2 ** 31) >>> 0;
        if (!FLAGS.banco) o.hud.toast('Senza il tuo link personale si gioca senza premio', 3000);
      }
      const mod = await import('../templari/index.ts');
      run = mod.startTemplari({ world: o.world, renderer: o.renderer, loader: o.loader, hud: o.hud, root: o.root, canvas: o.canvas }, { seed, subito, banco: FLAGS.banco, classe });
      entrate++; busy = false;
      const done = await run.done;
      run = null; busy = true;
      fuori(zoom0);
      if (!done || 'insieme' in done || FLAGS.banco) return; // stanza di prova: niente scheda, si rientra subito (tick)
      if (!api) { await mod.mostraEsito(o.root, { result: done.result, premio: null }); return; }
      try {
        const r = await api.templariFinish(done.inputs, done.hash, done.azioni);
        finite++; lastResult = { ...r.result, premio: r.premio, tetto: r.tetto, record: r.record, clientHash: done.hash };
        o.setLot(r.lot);
        await mod.mostraEsito(o.root, { result: r.result, premio: r.premio, tetto: r.tetto, record: r.record });
      } catch (e) { fail(e, 'Partita non salvata, riprova'); }
    } catch (e) {
      console.error('[marea] templari', e); fail(e, 'Qualcosa è andato storto nella chiesa');
      if (run) { run.abort(); run = null; }
      fuori(zoom0);
    } finally { busy = false; }
  }
  function fail(e: unknown, fallback: string): void {
    lastErr = e instanceof ApiError ? e.message : fallback;
    o.hud.toast(lastErr, 3200);
  }
  /** Di nuovo nel mondo, davanti alla porta della chiesa (se eri sull'isola). */
  function fuori(zoom: number): void {
    o.renderer.setScene(null);
    const a = o.world.avatar;
    if (spot && o.world.mode === 'walk' && Math.hypot(a.state.x - spot.x, a.state.z - spot.z) < 30) a.teleport(spot.x - 1.5, spot.z + 2);
    o.renderer.diorama.setZoom(zoom);
    o.renderer.diorama.follow(a.state.x, o.world.groundY(a.state.x, a.state.z), a.state.z);
    o.renderer.diorama.snap?.();
  }

  registerStateProvider('templari', () => (run && templariLink.state
    ? { ...templariLink.state(), busy, entrate, finite, lastErr, lastResult }
    : { active: false, busy, entrate, finite, lastErr, lastResult, near, aperta: aperta(), spot, insieme, sala: sala ? { membri: sala.membri.map((x) => x.nome), dentro: !!sala.rete, chiusa: sala.chiusa, ricollega: sala.ricollega, giri: sala.giri, prossimo: sala.prossimo } : null }));
  /** Test: dentro subito (come il bottone ⚔), da ovunque; `eroe` = senza menù, con quell'eroe. */
  registerTestHook('templariEntra', (subito, eroe) => { if (busy || run) return false; void entra(subito !== false, typeof eroe === 'string' ? eroe as TClasse : undefined); return true; });
  /** Test: GIOCA INSIEME (entra nella sala anche lontano dalla porta, `eroe` = senza menù) e SI PARTE. */
  registerTestHook('templariSala', (eroe) => { if (busy || run || sala) return false; apriSala(typeof eroe === 'string' ? eroe as TClasse : null); return !!sala; });
  /** Test: la linea cade (socket chiusa come da una rete persa, non dal server): la partita si deve ricollegare da sola. */
  registerTestHook('templariStacca', () => { if (!sala?.rete) return false; try { sala.ws.close(4000, 'prova'); } catch { /* già chiusa */ } return true; });
  registerTestHook('templariSiParte', () => { if (!sala || sala.membri.length < 2) return false; sala.via.click(); return true; });
  registerTestHook('templariProva', (o) => (templariLink.prova && o && typeof o === 'object' ? templariLink.prova(o as Record<string, unknown>) : null));
  registerTestHook('templariAutopilot', (on, speed) => { templariLink.autopilot = on ? Math.max(1, Math.min(30, Math.round(Number(speed ?? 4)) || 4)) : 0; return templariLink.autopilot; });
  /** Test: a piedi davanti alla porta della chiesa. */
  registerTestHook('templariPorta', () => { if (!spot) return null; o.world.avatar.teleport(spot.x - 1.5, spot.z + 1); return spot; });
  /** Test: a piedi accanto allo scheletro sotto il faro della Tempesta. */
  registerTestHook('templariRelitto', () => { if (!relitto) return null; o.world.avatar.teleport(relitto.x - 1.2, relitto.z + 0.8); return relitto; });
  registerStateProvider('templariRelitto', () => ({ relitto, calice: haCalice(), visibile: calice.visible, near: nearR, prese, biglietto: bigliettoAperto() }));

  return {
    spot,
    relitto,
    calice: haCalice,
    get active() { return (!!run && run.active) || !!menu; },
    isBusy: () => busy || !!menu || (!!run && !run.active),
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      // lo scheletro della Tempesta: A vicino prende il calice o rilegge il biglietto
      if (relitto && !busy && !run) {
        const f = o.world.avatar.state;
        nearR = o.world.mode === 'walk' && !o.world.race.on && !bigliettoAperto() && Math.hypot(f.x - relitto.x, f.z - relitto.z) < NEAR_M;
        if (nearR && !nearRWas) o.hud.toast(haCalice() ? 'Lo scheletro del Templare: premi A per rileggere il biglietto' : 'Uno scheletro con un calice d’oro in grembo: premi A', 2800);
        nearRWas = nearR;
        if (nearR && pressA) { void usaRelitto(); return; }
      } else nearR = false;
      // stanza di prova (?templari=banco): dentro la chiesa appena il mondo c'è, e di nuovo dentro quando esci
      if (FLAGS.banco && !busy && !run) { void entra(true); return; }
      if (busy || run || !spot) { near = false; return; }
      const f = o.world.avatar.state;
      near = o.world.mode === 'walk' && !o.world.race.on && aperta() && Math.hypot(f.x - spot.x, f.z - spot.z) < NEAR_M;
      if (sala && !sala.rete && !FLAGS.test && (o.world.mode !== 'walk' || Math.hypot(f.x - spot.x, f.z - spot.z) > LONTANO_M)) { chiudiSala(); o.hud.toast('Troppo lontano dalla porta: fuori dalla sala', 2500); }
      if (sala) return;
      if (near && pressA) void entra(true);
    },
    step(f) { if (menu) menu.step(f); else run?.step(f); },
    update(alpha, dt, t) {
      if (menu) { menu.update(dt); return; }
      if (run) { run.update(alpha, dt, t); return; }
      btn.classList.toggle('on', near && !busy && !sala);
      btnIns.classList.toggle('on', near && !busy && !sala && !!o.api && !!FLAGS.token && !FLAGS.banco);
      const mio = haCalice();
      btnR.classList.toggle('on', nearR && !busyR);
      const testo = mio ? '📜 Leggi il biglietto' : '✠ Prendi il calice';
      if (btnR.firstChild?.textContent !== testo) btnR.replaceChildren(el('span', '', testo), el('small', '', 'A'));
      // il calice gira piano e sale e scende a scatti (6 al secondo) finché non è tuo
      calice.visible = !!relitto && !mio;
      if (calice.visible) { const st = Math.floor(t * 6); calice.rotation.y = st * 0.2; const c0 = calice.children[0]; if (c0) c0.position.y = 0.06 * Math.sin(st * 0.5); }
    },
  };
}
