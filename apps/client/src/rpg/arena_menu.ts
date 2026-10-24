// Il colosseo dell'Arena (docs/ARENA.md §2, PROTOCOL §10): il pannello che si apre all'ingresso e la partita che ne parte.
// Pannello: IL TUO SET (vestizione, 4 slot rapidi con armi, archi e magie, il tipo di freccia di ogni arco, 2 pozioni; si sceglie tra quello
// che hai nello zaino e nel Forziere e si salva col personaggio: POST /api/rpg {t:'arena'}), il formato (1 CONTRO 1, 2 CONTRO 2, 3 CONTRO 3) e
// i modi di giocare: CODA VELOCE (gli altri che ci sono; a squadre, passati pochi secondi, i posti vuoti li prendono i gladiatori), SFIDA
// AMICI (apre una sala con un codice di 4 lettere, o si entra col codice dell'amico; chi la apre preme PARTI ORA), ALLENAMENTO (con i
// gladiatori automatici, senza server né premio). Coda e sala sono il WebSocket /ws/arena (DO Arena); quando il server ha tutti manda
// `parte` e comincia la partita (arena_run.ts) coi suoi turni. Linea persa durante la partita: ci si ricollega da soli (`?run=&idx=&n=`) per
// ARENA.rete.staccatoSecondi. A fine partita la scheda dell'esito, il lotto riletto (il premio è nelle monete) e di nuovo il pannello.
import type { InputFrame, LotState } from '@marea/sim';
import type { Look } from '@marea/protocol';
import { ARENA, arenaMappa, mappaPer } from '@marea/content/arena.ts';
import { spellDef } from '@marea/content/rpg.ts';
import { formatoDi } from '@marea/sim/arena/duello.ts';
import { buildArenaEroe, erroreLoadout, loadoutDi, pulisciLoadout, slotArma, slotMagia } from '@marea/sim/rpg/arena.ts';
import type { Possiede } from '@marea/sim/rpg/arena.ts';
import { newHero } from '@marea/sim/rpg/hero.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { ArenaLoadout, HeroState } from '@marea/sim/rpg/types.ts';
import { parseArServer } from '@marea/protocol/arena.ts';
import type { ArClientMsg, ArServerMsg, ArTurno } from '@marea/protocol/arena.ts';
import type { Api } from '../net/api.ts';
import { ApiError } from '../net/api.ts';
import { PAL, el, injectUiStyle } from '../ui/style.ts';
import { FLAGS } from '../flags.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import type { RunCtx } from './types.ts';
import { iconaMagia, iconOf, itemIcon } from './items_ui.ts';
import { arenaLink, startArenaRun } from './arena_run.ts';
import type { ArenaDuellante, ArenaRete, ArenaRun } from './arena_run.ts';
import { CSS_COLOSSEO } from './arena_menu_css.ts';

export type ColosseoCtx = RunCtx & { api: Api | null; getLot(): LotState | null; setLot(l: LotState): void; nome(): string; look(): Look; tornaAllIngresso(): void };
export type Colosseo = {
  apri(): void;
  readonly aperto: boolean;
  /** Duello in corso (il ciclo chiama step e update al posto del mondo). */
  readonly active: boolean;
  step(f: InputFrame): void;
  update(alpha: number, dt: number, t: number): void;
  /** Stanza di prova (?arena=banco): subito nel duello contro il bot. */
  allenamento(): void;
};

const P = PAL;
/** I formati: eroi per squadra (1 = duello, 2 = 2v2, 3 = 3v3) e come si chiamano sui bottoni. */
const FORMATI = [1, 2, 3] as const;

type Voce = { id: string; nome: string; ico: () => Node; nota?: string };
type Scelta = { tipo: 'corpo' } | { tipo: 'anello1' } | { tipo: 'anello2' } | { tipo: 'slot'; n: number } | { tipo: 'frecce'; n: number } | { tipo: 'pozione'; n: number };

export function createColosseo(c: ColosseoCtx): Colosseo {
  injectUiStyle();
  if (!document.getElementById('mz-colosseo-style')) { const st = document.createElement('style'); st.id = 'mz-colosseo-style'; st.textContent = CSS_COLOSSEO; document.head.appendChild(st); }
  const online = () => !!c.api && FLAGS.net && !!FLAGS.token;
  // il personaggio di adesso (senza lotto, la stanza di prova: uno nuovo, tenuto qui)
  let eroeProva: HeroState | null = null;
  const eroe = (): HeroState => c.getLot()?.hero ?? (eroeProva ??= newHero());
  const ha = (): Possiede => { const l = c.getLot(), h = eroe(); return (id) => (h.inv[id] ?? 0) + (l?.forziere?.[id] ?? 0); };
  let set: ArenaLoadout = loadoutDi(eroe()), salvato = JSON.stringify(set), scelta: Scelta | null = null;

  // ---- pannello ----
  const box = el('div', 'mz mz-col'); box.id = 'mzColosseo';
  const chiudiBtn = el('button', 'mz-x', '×'); chiudiBtn.type = 'button'; chiudiBtn.setAttribute('aria-label', 'Chiudi');
  const testa = el('div', 'testa'); testa.append(el('b', '', 'COLOSSEO DELL’ARENA'), chiudiBtn);
  const corpo = el('div', 'corpo'), gioca = el('div', 'gioca');
  box.append(testa, corpo, gioca);
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) box.addEventListener(ev, (x) => x.stopPropagation(), { passive: true });
  c.root.append(box);
  const err = el('div', 'err');
  const attesaEl = el('div', 'attesa');
  let aperto = false;

  const nomeOgg = (id: string) => (hasItem(id) ? itemDef(id).nome : id);
  const icoOgg = (id: string, px = 26): Node => (hasItem(id) ? iconOf(itemDef(id), px) : itemIcon('arma', P.pietra, px));
  const icoMagia = (id: string, px = 26): Node => iconaMagia(id, px);
  const nomeMagia = (id: string) => { try { return spellDef(id).nome; } catch { return id; } };
  /** Quello che hai (zaino + Forziere) di un tipo, in ordine di nome. */
  const posseduti = (kinds: string[]): string[] => {
    const l = c.getLot(), h = eroe(), ids = new Set([...Object.keys(h.inv), ...Object.keys(l?.forziere ?? {})]);
    return [...ids].filter((id) => hasItem(id) && kinds.includes(itemDef(id).kind) && ha()(id) > 0).sort((a, b) => nomeOgg(a).localeCompare(nomeOgg(b)));
  };

  function cella(cls: string, ico: Node | null, testo: string, nota: string, tasto: string, sc: Scelta): HTMLButtonElement {
    const b = el('button', `cella ${cls}`) as HTMLButtonElement; b.type = 'button';
    if (tasto) b.append(el('i', '', tasto));
    if (ico) b.append(ico);
    b.append(el('span', '', testo));
    if (nota) b.append(el('small', '', nota));
    if (scelta && JSON.stringify(scelta) === JSON.stringify(sc)) b.classList.add('sel');
    b.addEventListener('click', () => { scelta = scelta && JSON.stringify(scelta) === JSON.stringify(sc) ? null : sc; disegna(); });
    return b;
  }
  /** Le voci tra cui scegliere per la cella aperta. */
  function voci(sc: Scelta): Voce[] {
    const h = eroe();
    if (sc.tipo === 'corpo') return posseduti(['armatura', 'veste']).map((id) => ({ id, nome: nomeOgg(id), ico: () => icoOgg(id) }));
    if (sc.tipo === 'anello1' || sc.tipo === 'anello2') return posseduti(['anello']).map((id) => ({ id, nome: nomeOgg(id), ico: () => icoOgg(id) }));
    if (sc.tipo === 'pozione') return posseduti(['pozione']).map((id) => ({ id, nome: nomeOgg(id), ico: () => icoOgg(id) }));
    if (sc.tipo === 'frecce') {
      const ids = [...new Set([ARENA.frecceBase, ...posseduti(['frecce'])])];
      return ids.map((id) => ({ id, nome: nomeOgg(id), ico: () => icoOgg(id), nota: `${ARENA.frecce} a duello` }));
    }
    const usate = new Set(set.slot.filter((s, i) => s && i !== sc.n).map((s) => (slotMagia(s) ? 'magia:' + s.magia : slotArma(s) ? s.arma : '')));
    return [
      ...posseduti(['arma', 'arco']).filter((id) => !usate.has(id)).map((id): Voce => ({ id, nome: nomeOgg(id), ico: () => icoOgg(id), nota: itemDef(id).kind === 'arco' ? 'arco' : 'arma' })),
      ...h.magie.filter((m) => !usate.has('magia:' + m)).map((m): Voce => { let costo = ''; try { costo = `${spellDef(m).costo} Magicka`; } catch { /* sconosciuta */ } return { id: 'magia:' + m, nome: nomeMagia(m), ico: () => icoMagia(m), nota: costo }; }),
    ];
  }
  function metti(sc: Scelta, id: string | null): void {
    const s: ArenaLoadout = { ...set, slot: [...set.slot], pozioni: [...set.pozioni] };
    if (sc.tipo === 'corpo' || sc.tipo === 'anello1' || sc.tipo === 'anello2') { if (id) s[sc.tipo] = id; else delete s[sc.tipo]; }
    else if (sc.tipo === 'pozione') s.pozioni[sc.n] = id;
    else if (sc.tipo === 'frecce') { const x = s.slot[sc.n]; if (slotArma(x)) s.slot[sc.n] = id && id !== ARENA.frecceBase ? { arma: x.arma, frecce: id } : { arma: x.arma }; }
    else s.slot[sc.n] = !id ? null : id.startsWith('magia:') ? { magia: id.slice(6) } : { arma: id };
    set = s; scelta = null;
    err.textContent = '';
    disegna();
  }

  function disegna(): void {
    const a = c.getLot()?.arena, kids: Node[] = [];
    const oggi = a && a.giorno === Math.floor(Date.now() / 86_400_000) ? a.preso : 0;
    kids.push(el('div', 'stat', online() ? `Vinte ${a?.vinte ?? 0} · perse ${a?.perse ?? 0} · pari ${a?.pari ?? 0} · premio di oggi ${oggi}/${ARENA.premio.tetto} monete` : 'Senza link personale: solo allenamento'));
    kids.push(el('div', 'stat', 'In Arena tutti hanno 100 di Vita, Magicka e Stamina; niente si consuma o si perde.'));
    kids.push(el('h4', '', 'VESTIZIONE'));
    const vest = el('div', 'riga');
    for (const k of ['corpo', 'anello1', 'anello2'] as const) {
      const id = set[k];
      vest.append(cella(id ? '' : 'vuota', id ? icoOgg(id) : null, id ? nomeOgg(id) : k === 'corpo' ? 'Armatura' : 'Anello', '', '', { tipo: k }));
    }
    kids.push(vest, listaPer((sc) => sc.tipo === 'corpo' || sc.tipo === 'anello1' || sc.tipo === 'anello2'));
    kids.push(el('h4', '', `${ARENA.slot} SLOT RAPIDI (TASTI 1-${ARENA.slot})`));
    const sl = el('div', 'riga q');
    set.slot.forEach((s, n) => {
      if (slotMagia(s)) { let costo = ''; try { costo = `${spellDef(s.magia).costo} M`; } catch { /* */ } sl.append(cella('', icoMagia(s.magia), nomeMagia(s.magia), costo, String(n + 1), { tipo: 'slot', n })); }
      else if (slotArma(s)) sl.append(cella('', icoOgg(s.arma), nomeOgg(s.arma), hasItem(s.arma) && itemDef(s.arma).kind === 'arco' ? `${ARENA.frecce} frecce` : '', String(n + 1), { tipo: 'slot', n }));
      else sl.append(cella('vuota', null, 'Vuoto', '', String(n + 1), { tipo: 'slot', n }));
    });
    kids.push(sl, listaPer((sc) => sc.tipo === 'slot'));
    // le frecce di ogni arco
    const archi = set.slot.map((s, n) => ({ s, n })).filter(({ s }) => slotArma(s) && hasItem(s.arma) && itemDef(s.arma).kind === 'arco');
    if (archi.length) {
      kids.push(el('h4', '', 'FRECCE DEGLI ARCHI'));
      const fr = el('div', 'riga d');
      for (const { s, n } of archi) { const f = (slotArma(s) && s.frecce) || ARENA.frecceBase; fr.append(cella('', icoOgg(f), nomeOgg(f), `slot ${n + 1}`, '', { tipo: 'frecce', n })); }
      kids.push(fr, listaPer((sc) => sc.tipo === 'frecce'));
    }
    kids.push(el('h4', '', `${ARENA.pozioni} POZIONI RAPIDE (TASTI 5-6)`));
    const pz = el('div', 'riga d');
    set.pozioni.forEach((p, n) => pz.append(cella(p ? '' : 'vuota', p ? icoOgg(p) : null, p ? nomeOgg(p) : 'Nessuna', 'una a round', String(5 + n), { tipo: 'pozione', n })));
    kids.push(pz, listaPer((sc) => sc.tipo === 'pozione'), err);
    corpo.replaceChildren(...kids);
    disegnaGioca();
  }
  /** La lista delle scelte sotto la riga della cella aperta (se è di quella riga). */
  function listaPer(qui: (sc: Scelta) => boolean): HTMLElement {
    const l = el('div', 'lista');
    if (!scelta || !qui(scelta)) return l;
    const sc = scelta, cur = sc.tipo === 'slot' ? (() => { const s = set.slot[sc.n]; return slotMagia(s) ? 'magia:' + s.magia : slotArma(s) ? s.arma : null; })() : sc.tipo === 'pozione' ? set.pozioni[sc.n] : sc.tipo === 'frecce' ? (() => { const s = set.slot[sc.n]; return (slotArma(s) && s.frecce) || ARENA.frecceBase; })() : set[sc.tipo] ?? null;
    const vv = voci(sc);
    for (const v of vv) {
      const b = el('button', v.id === cur ? 'cur' : ''); b.type = 'button';
      b.append(v.ico(), el('span', '', v.nome), ...(v.nota ? [el('small', '', v.nota)] : []));
      b.dataset['id'] = v.id;
      b.addEventListener('click', () => metti(sc, v.id));
      l.append(b);
    }
    if (sc.tipo !== 'frecce') { const b = el('button', cur ? '' : 'cur', '— Niente —'); b.type = 'button'; b.dataset['id'] = ''; b.addEventListener('click', () => metti(sc, null)); l.append(b); }
    if (!vv.length) l.prepend(el('div', 'stat', 'Non hai niente di questo tipo'));
    l.classList.add('on');
    return l;
  }

  // ---- giocare: coda, sala, allenamento ----
  type Sessione = { ws: WebSocket; modo: 'coda' | 'sala'; codice: string; rete: (ArenaRete & { turni: ArTurno[]; ricevuti: number; attesaV: { chi: number; fino: number } | null; fineV: ArenaRete['fine']; chiusaV: boolean }) | null; run: string; idx: number; voluta: boolean; f: number; dentro: number; serve: number; host: boolean };
  let sess: Sessione | null = null, run: ArenaRun | null = null, ultimo: unknown = null, codiceIn: HTMLInputElement | null = null;
  /** Eroi per squadra della prossima partita (1 = duello, 2 = 2v2, 3 = 3v3). */
  let formato = 1, mappaScelta = '';
  const btn = (cls: string, act: string, testo: string, fn: () => void, dis = false) => { const b = el('button', `mz-btn ${cls}`, testo) as HTMLButtonElement; b.type = 'button'; b.dataset['act'] = act; b.disabled = dis; b.addEventListener('click', fn); return b; };
  function disegnaGioca(): void {
    const kids: Node[] = [];
    if (sess && !sess.rete) {
      const s = sess, squadre = s.f > 1 && s.serve > 0;
      attesaEl.replaceChildren(s.modo === 'coda' ? 'In coda: aspetto gli altri…' : s.codice ? 'Di’ questo codice ai tuoi amici:' : 'Apro la sala…', ...(s.codice ? [el('span', 'codice', s.codice)] : []),
        ...(squadre ? [el('span', 'quanti', `${s.dentro} su ${s.serve}: i posti vuoti li prendono i gladiatori`)] : []));
      const annulla = btn('ghost', 'annulla', 'ANNULLA', () => esci());
      kids.push(attesaEl, ...(s.modo === 'sala' && s.host && squadre ? [btn('coda', 'via', 'PARTI ORA', () => { if (s.ws.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify({ t: 'via' } satisfies ArClientMsg)); })] : []), annulla);
    } else {
      const on = online();
      const fm = el('div', 'formati');
      for (const f of FORMATI) { const b = el('button', f === formato ? 'sel' : '', `${f} CONTRO ${f}`) as HTMLButtonElement; b.type = 'button'; b.dataset['f'] = String(f); b.addEventListener('click', () => { formato = f; disegnaGioca(); }); fm.append(b); }
      // la mappa dell'allenamento: a caso o una a scelta (in coda e in sala la sceglie il server)
      const elenco = ARENA.mappe.filter((m) => m.formati.includes(formato));
      if (!elenco.some((m) => m.id === mappaScelta)) mappaScelta = '';
      const mp = el('div', 'formati m');
      for (const m of [{ id: '', nome: 'A caso' }, ...elenco]) { const b = el('button', m.id === mappaScelta ? 'sel' : '', m.id ? m.nome.split(' ')[0]! : m.nome) as HTMLButtonElement; b.title = m.nome; b.type = 'button'; b.dataset['m'] = m.id; b.addEventListener('click', () => { mappaScelta = m.id; disegnaGioca(); }); mp.append(b); }
      kids.push(fm, el('div', 'mappe', 'MAPPA DELL’ALLENAMENTO (in coda la sceglie il server)'), mp);
      kids.push(btn('coda', 'coda', 'CODA VELOCE', () => void entra('coda'), !on));
      const due = el('div', 'due');
      due.append(btn('ghost', 'sala', 'CREA SALA', () => void entra('sala'), !on), btn('ghost', 'allenamento', 'ALLENAMENTO', () => void allena()));
      kids.push(due);
      const ci = el('div', 'codiceIn');
      codiceIn = el('input') as HTMLInputElement; codiceIn.maxLength = ARENA.rete.codice; codiceIn.placeholder = 'CODICE'; codiceIn.autocomplete = 'off'; codiceIn.disabled = !on;
      codiceIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') void entra('sala', codiceIn!.value); });
      ci.append(codiceIn, btn('ghost', 'codice', 'ENTRA', () => void entra('sala', codiceIn!.value), !on));
      kids.push(ci);
    }
    gioca.replaceChildren(...kids);
  }

  /** Il set va bene ed è salvato (online: sul server, col personaggio). null = sì, altrimenti il motivo. */
  async function salva(): Promise<string | null> {
    const why = erroreLoadout(eroe(), set, ha());
    if (why) return why;
    if (JSON.stringify(set) === salvato) return null;
    if (!online()) { eroeProva = { ...eroe(), arena: set }; salvato = JSON.stringify(set); return null; }
    try { c.setLot(await c.api!.rpg({ t: 'arena', loadout: set })); salvato = JSON.stringify(set); return null; } catch (e) { return e instanceof ApiError ? e.message : 'Set non salvato: riprova'; }
  }

  async function entra(modo: 'coda' | 'sala', codice = ''): Promise<void> {
    if (sess || run || !online()) return;
    const why = await salva();
    if (why) { err.textContent = why; return; }
    const k = codice.trim().toUpperCase();
    if (codice && k.length !== ARENA.rete.codice) { err.textContent = `Il codice ha ${ARENA.rete.codice} lettere`; return; }
    const u = new URL('/ws/arena', location.href);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'; u.searchParams.set('t', FLAGS.token); u.searchParams.set('modo', modo); u.searchParams.set('f', String(formato));
    if (k) u.searchParams.set('codice', k);
    let ws: WebSocket;
    try { ws = new WebSocket(u.toString()); } catch { err.textContent = 'Arena non disponibile, riprova'; return; }
    const s: Sessione = { ws, modo, codice: '', rete: null, run: '', idx: 0, voluta: false, f: formato, dentro: 0, serve: 0, host: false };
    sess = s; disegnaGioca();
    collega(s, ws);
  }
  /** I messaggi del server su questa socket (anche quella di una ripresa dopo una linea persa). */
  function collega(s: Sessione, ws: WebSocket): void {
    ws.onmessage = (ev) => {
      const m = parseArServer(String(ev.data));
      if (m) onMsg(s, m);
    };
    ws.onclose = () => {
      if (sess !== s) return;
      if (!s.rete) { if (!s.voluta) c.hud.toast('L’Arena ha chiuso la coda', 2000); sess = null; disegnaGioca(); return; }
      if (s.rete.fineV || s.voluta) { s.rete.chiusaV = true; return; }
      riprova(s, Date.now() + ARENA.rete.staccatoSecondi * 1000);
    };
  }
  /** Linea persa nel duello: ci si ricollega col numero del prossimo turno che si aspetta, finché c'è tempo. */
  function riprova(s: Sessione, fino: number): void {
    if (sess !== s || !s.rete || s.rete.fineV) return;
    if (Date.now() > fino) { s.rete.chiusaV = true; return; }
    c.hud.toast('Linea persa: mi ricollego…', 1500);
    window.setTimeout(() => {
      if (sess !== s || !s.rete) return;
      const u = new URL('/ws/arena', location.href);
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'; u.searchParams.set('t', FLAGS.token);
      u.searchParams.set('run', s.run); u.searchParams.set('idx', String(s.idx)); u.searchParams.set('n', String(s.rete.ricevuti));
      let ws: WebSocket;
      try { ws = new WebSocket(u.toString()); } catch { riprova(s, fino); return; }
      s.ws = ws; collega(s, ws);
      ws.onclose = () => { if (sess === s && s.ws === ws && s.rete && !s.rete.fineV && !s.voluta) riprova(s, fino); };
    }, 1200);
  }
  function onMsg(s: Sessione, m: ArServerMsg): void {
    if (m.t === 'T') { if (s.rete && m.n === s.rete.ricevuti) { s.rete.turni.push(m); s.rete.ricevuti++; } return; }
    if (m.t === 'attendi') { s.codice = m.codice; s.f = m.f ?? s.f; s.dentro = m.dentro ?? 0; s.serve = m.serve ?? 0; s.host = !!m.host; disegnaGioca(); return; }
    if (m.t === 'errore') { c.hud.toast(m.msg, 3000); err.textContent = m.msg; return; }
    if (m.t === 'attesa') { if (s.rete) s.rete.attesaV = m.chi < 0 ? null : { chi: m.chi, fino: Date.now() + m.ms }; return; }
    if (m.t === 'ripresa') { c.hud.toast('Di nuovo in linea', 1200); return; }
    if (m.t === 'fine') { if (s.rete) s.rete.fineV = { esito: m.esito, premio: m.premio, tetto: m.tetto }; ultimo = { esito: m.esito, premio: m.premio }; return; }
    if (m.t === 'parte') {
      const io = m.io, eroi = m.eroi.map((e): ArenaDuellante => ({ nome: e.nome, look: e.look, eroe: e.eroe }));
      const ws = () => s.ws;
      const rete = {
        turni: [] as ArTurno[], ricevuti: 0, attesaV: null as { chi: number; fino: number } | null, fineV: null as ArenaRete['fine'], chiusaV: false,
        manda: (x: ArClientMsg) => { const w = ws(); if (w.readyState === WebSocket.OPEN) w.send(JSON.stringify(x)); if (x.t === 'esco') s.voluta = true; },
        get chiusa() { return this.chiusaV; }, get attesa() { return this.attesaV; }, get fine() { return this.fineV; },
      };
      s.rete = rete; s.run = m.run; s.idx = io;
      chiudiPannello();
      gioca2(m.seed, eroi, io, rete, m.squadre ? { squadre: m.squadre, mappa: m.mappa ?? 'colosseo' } : undefined);
    }
  }
  function esci(): void {
    const s = sess;
    if (!s) return;
    s.voluta = true; sess = null;
    try { if (s.ws.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify({ t: 'esco' } satisfies ArClientMsg)); s.ws.close(1000, 'ciao'); } catch { /* chiusa */ }
    disegnaGioca();
  }

  /** Allenamento: tu (più i compagni) contro i gladiatori automatici, tutti con una copia del tuo set (si allena la mano, non l'equipaggiamento). */
  async function allena(): Promise<void> {
    if (sess || run) return;
    const why = await salva();
    if (why) { err.textContent = why; return; }
    const h = eroe(), mio = buildArenaEroe(h, pulisciLoadout(h, set, ha())), seed = (Date.now() >>> 0) % 1_000_000;
    const f = formato, mappa = mappaScelta ? arenaMappa(mappaScelta) : mappaPer(f, seed), fo = formatoDi(f, mappa.id);
    chiudiPannello();
    // io primo della mia squadra; poi i compagni e gli avversari, a rotazione dai gladiatori
    const glad = (k: number): ArenaDuellante => { const g = ARENA.gladiatori[k % ARENA.gladiatori.length]!; return { nome: g.nome, look: g.look, eroe: mio }; };
    gioca2(seed, [{ nome: c.nome() || 'Tu', look: c.look(), eroe: mio }, ...Array.from({ length: 2 * f - 1 }, (_, k) => glad(k))], 0, null, fo);
  }

  function gioca2(seed: number, eroi: ArenaDuellante[], io: number, rete: ArenaRete | null, fo?: { squadre: number[]; mappa: string }): void {
    run = startArenaRun(c, { seed, eroi, io, ...(fo ?? {}), ...(rete ? { rete } : {}) });
    const r = run;
    void r.done.then(async (fine) => {
      run = null;
      const s = sess;
      if (s?.rete) { s.voluta = true; sess = null; try { s.ws.close(1000, 'fine'); } catch { /* chiusa */ } }
      c.tornaAllIngresso();
      if (rete && c.api) { try { const l = await c.api.lot(); c.setLot(l); } catch { /* il premio si vede alla prossima lettura */ } }
      if (fine.rivincita) { void allena(); return; }
      apri();
    });
  }
  function chiudiPannello(): void { aperto = false; scelta = null; box.classList.remove('on'); }
  function apri(): void {
    if (run) return;
    set = loadoutDi(eroe()); salvato = JSON.stringify(set); err.textContent = '';
    aperto = true; box.classList.add('on'); disegna();
  }
  chiudiBtn.addEventListener('click', () => { esci(); chiudiPannello(); });
  addEventListener('keydown', (e) => { if (aperto && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); esci(); chiudiPannello(); } }, true);

  registerStateProvider('colosseo', () => ({ aperto, attivo: !!run, formato, set, salvato: JSON.parse(salvato) as unknown, coda: sess ? { modo: sess.modo, codice: sess.codice, duello: !!sess.rete, run: sess.run, io: sess.idx, turni: sess.rete?.ricevuti ?? 0, f: sess.f, dentro: sess.dentro, serve: sess.serve, host: sess.host } : null, ultimo, errore: err.textContent }));
  registerTestHook('arenaSet', (l) => { set = l as ArenaLoadout; disegna(); return erroreLoadout(eroe(), set, ha()); });
  registerTestHook('arenaGioca', (modo, codice, f) => { if (f === 1 || f === 2 || f === 3) formato = f; if (modo === 'allenamento') void allena(); else void entra(modo === 'sala' ? 'sala' : 'coda', typeof codice === 'string' ? codice : ''); return true; });
  registerTestHook('arenaVia', () => { const s = sess; if (!s || s.rete || s.ws.readyState !== WebSocket.OPEN) return false; s.ws.send(JSON.stringify({ t: 'via' } satisfies ArClientMsg)); return true; });
  registerTestHook('arenaEsci', () => { esci(); chiudiPannello(); return true; });
  registerTestHook('arenaAuto', (on) => { arenaLink.auto = !!on; return arenaLink.auto; });
  registerTestHook('arenaLinea', () => { const s = sess; if (!s?.rete) return false; try { s.ws.close(4000, 'prova'); } catch { /* */ } return true; });

  return {
    apri,
    get aperto() { return aperto; },
    get active() { return !!run && run.active; },
    step(f) { run?.step(f); },
    update(alpha, dt, t) { run?.update(alpha, dt, t); },
    allenamento() { void allena(); },
  };
}
