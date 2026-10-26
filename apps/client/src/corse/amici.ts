// Corse tra amici (10 ott 2026, PROTOCOL.md §8): la sala alla porta della Spiaggia e le posizioni degli amici in gara.
// Ognuno corre la SUA gara (sim locale, coi suoi bot se chi preme VIA li vuole; rigiocata dal server come da solo); il DO GaraAmici fa partire tutti insieme (stessa
// pista, stesso seed, un posto in griglia a testa) e gira a ciascuno le posizioni degli altri, che qui diventano «fantasmi»: veicoli
// disegnati dove sono gli amici (niente urti), con nome, e la classifica tra amici.
// - `apri(pista, veicolo)`: entra in sala (WebSocket `/ws/gara`), mostra il pannello con chi c'è e VIA (con almeno 2); `onParte` quando si parte;
// - in gara: `manda(k)` (ogni GA_POS_MS al massimo), `arrivato(ms)` / ritiro; `amici()` = gli altri con la posizione stimata adesso;
// - `chiudi()`: esce dalla sala (si chiude il socket).
import { GA_MAX, GA_POS_MS, parseGaServer } from '@marea/protocol/gara_amici.ts';
import type { GaClientMsg, GaMembro, GaPos } from '@marea/protocol/gara_amici.ts';
import { CORSE_PISTE, CORSE_PISTE_SPIAGGIA } from '@marea/content/corse.ts';
import { opzioniGara } from '@marea/sim/corse/gara.ts';
import { veicoloCorse } from '@marea/sim/corse/pista.ts';
import type { Veicolo } from '@marea/sim/corse/veicolo.ts';
import { el } from '../ui/style.ts';
import { suona } from '../audio/ponte.ts';
import { ICONA, tracciato } from './pannelli.ts';

export type Partenza = { gara: string; pista: string; seed: number; io: number; membri: GaMembro[]; bot: boolean; oggetti: boolean };
/** Un amico in gara: com'era all'ultimo messaggio (`q`), quando è arrivato (ms di performance.now), e se ha finito. */
export type Amico = { i: number; nome: string; look: GaMembro['look']; veicolo: string; q: GaPos | null; t: number; fine: number | null };

export type SalaAmici = {
  /** Entra in sala col veicolo del garage `veicolo` (la gara lo cambia se la pista vuole un'altra famiglia) e la pista `pista` (quella che parte se premi VIA tu). */
  apri(pista: string, veicolo: string): void;
  /** Esce dalla sala e chiude il socket. */
  chiudi(): void;
  aperta(): boolean;
  /** Si parte (lo chiama il server per tutti): chi usa la sala fa partire la gara con queste opzioni. */
  onParte: ((p: Partenza) => void) | null;
  /** Il pannello si chiude da solo per «Torna all'isola»: chi usa la sala rimette il mondo. */
  onEsci: (() => void) | null;
  /** In gara: la mia posizione (si manda al massimo ogni GA_POS_MS). */
  manda(k: Veicolo): void;
  /** In gara: arrivato (ms di gara) o ritirato (−1). */
  fine(ms: number): void;
  /** Gli amici della gara in corso (senza di me), o [] fuori gara. */
  amici(): Amico[];
  /** Per i test. */
  info(): { aperta: boolean; connesso: boolean; membri: string[]; gara: Partenza | null; amici: { nome: string; veicolo: string; prog: number | null; fine: number | null }[]; errore: string | null };
};

const posDi = (k: Veicolo): GaPos => [r2(k.prog), k.ramo, r2(k.s), r2(k.lat), r2(k.h), r3(k.hf), r3(k.hl), r2(k.v), k.drift, k.giro, k.caduto > 0 ? 1 : 0];
const r2 = (x: number) => Math.round(x * 100) / 100, r3 = (x: number) => Math.round(x * 1000) / 1000;
const CHIAVE_BOT = 'marea.corse.amiciBot', CHIAVE_OGG = 'marea.corse.amiciOggetti';
/** Le piste della gara tra amici (quelle della Spiaggia, come alla porta). */
const PISTE_AMICI = Object.entries(CORSE_PISTE).filter(([id]) => CORSE_PISTE_SPIAGGIA.includes(id));
function leggiBot(): boolean { try { return localStorage.getItem(CHIAVE_BOT) !== '0'; } catch { return true; } }
function salvaBot(v: boolean): void { try { localStorage.setItem(CHIAVE_BOT, v ? '1' : '0'); } catch { /* niente memoria */ } }
function leggiOggetti(): boolean { try { return localStorage.getItem(CHIAVE_OGG) === '1'; } catch { return false; } }
function salvaOggetti(v: boolean): void { try { localStorage.setItem(CHIAVE_OGG, v ? '1' : '0'); } catch { /* niente memoria */ } }

const CSS = `
#mzGpSala { position: absolute; inset: 0; z-index: 30; display: none; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box; background: rgba(18, 48, 110, 0.65); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); font-family: 'MzTitan', 'Arial Rounded MT Bold', ui-rounded, system-ui, sans-serif; --navy: #12306e; pointer-events: auto; color: #fff; -webkit-user-select: none; user-select: none; }
#mzGpSala.on { display: flex; }
#mzGpSala .box { position: relative; width: min(820px, 96vw); max-height: min(370px, calc(100vh - 16px)); box-sizing: border-box; padding: 10px 16px 12px; background: rgba(20, 52, 118, 0.94); border: 3px solid rgba(143, 216, 255, 0.75); border-radius: 18px; box-shadow: 0 10px 32px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.25); color: #fff; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; }
#mzGpSala .top-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
#mzGpSala .titolo { height: 36px; display: inline-flex; align-items: center; padding: 0 48px 0 14px; background: linear-gradient(90deg, #2a7ff0 0%, #1d63d6 65%, rgba(29,99,214,0) 100%); transform: skewX(-14deg); border-radius: 6px; position: relative; }
#mzGpSala .titolo::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 44px; background: conic-gradient(#6fd0ff 25%, #1d63d6 0 50%, #6fd0ff 0 75%, #1d63d6 0) 0 0 / 14px 14px; -webkit-mask: linear-gradient(90deg, #000, transparent); mask: linear-gradient(90deg, #000, transparent); }
#mzGpSala .titolo h2 { margin: 0; transform: skewX(14deg); font-style: italic; font-weight: 400; font-size: 19px; letter-spacing: .02em; text-transform: uppercase; white-space: nowrap; -webkit-text-stroke: 4px var(--navy); paint-order: stroke fill; color: #fff; }
#mzGpSala .chiudi-x { width: 30px; height: 30px; border-radius: 50%; background: #fff; color: var(--navy); border: 3px solid var(--navy); font-size: 16px; font-weight: bold; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,.3); flex-shrink: 0; transition: transform 0.1s; }
#mzGpSala .chiudi-x:active { transform: scale(0.92); }
#mzGpSala .sub { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 600; color: #bde4ff; margin: 0 0 6px; text-shadow: 0 1px 2px rgba(0,0,0,0.6); }
#mzGpSala .griglia { display: grid; grid-template-columns: 1fr 1.15fr; gap: 12px; flex: 1; min-height: 0; }
#mzGpSala .col { display: flex; flex-direction: column; gap: 6px; justify-content: space-between; }
#mzGpSala .lbl { font-size: 11px; font-style: italic; color: #ffd93a; -webkit-text-stroke: 3px var(--navy); paint-order: stroke fill; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 2px; }
#mzGpSala .riga { display: flex; gap: 6px; flex-wrap: wrap; }
#mzGpSala .riga.membri { display: flex; flex-wrap: wrap; gap: 4px; min-height: 26px; }
#mzGpSala .riga.membri button { background: rgba(12, 34, 82, 0.85); border: 2px solid rgba(143, 216, 255, 0.55); border-radius: 8px; padding: 2px 7px; color: #fff; font-size: 11px; display: inline-flex; align-items: center; gap: 5px; cursor: default; }
#mzGpSala .riga.membri button small { background: rgba(255,255,255,0.18); border-radius: 4px; padding: 1px 4px; font-size: 10px; color: #ffd93a; font-family: system-ui, sans-serif; }
#mzGpSala .sez-opt .riga button { flex: 1; min-height: 30px; padding: 2px 6px; border-radius: 10px; background: rgba(12, 34, 82, 0.8); border: 2px solid rgba(255,255,255,.45); color: #fff; font-size: 11px; font-weight: bold; cursor: pointer; transition: all 0.15s ease; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; line-height: 1.1; }
#mzGpSala .sez-opt .riga button small { font-size: 9px; opacity: 0.8; font-weight: normal; margin-top: 1px; font-family: system-ui, sans-serif; }
#mzGpSala .sez-opt .riga button.on { background: #ffd93a; color: var(--navy); border-color: #fff; box-shadow: 0 0 10px rgba(255,217,58,0.7); }
#mzGpSala .sez-opt .riga button.on small { color: #12306e; opacity: 0.95; }
#mzGpSala .riga.piste { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
#mzGpSala .riga.piste button { background: rgba(12, 34, 82, 0.7); border: 2px solid rgba(255,255,255,0.4); border-radius: 12px; padding: 3px; display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: all 0.15s ease; text-align: center; }
#mzGpSala .riga.piste button .traccia { width: 68px; height: 38px; display: flex; align-items: center; justify-content: center; }
#mzGpSala .riga.piste button .traccia canvas { width: 100%; height: 100%; object-fit: contain; }
#mzGpSala .riga.piste button .pista-nome { font-size: 11px; font-style: italic; -webkit-text-stroke: 2px var(--navy); paint-order: stroke fill; white-space: nowrap; text-transform: uppercase; }
#mzGpSala .riga.piste button small { font-size: 9px; color: #8fd8ff; font-family: system-ui, sans-serif; }
#mzGpSala .riga.piste button.on { background: #2a7ff0; border: 3px solid #ffe34d; box-shadow: 0 0 14px rgba(255,227,77,0.85); transform: scale(1.02); }
#mzGpSala .riga.piste button.on small { color: #fff8d0; }
#mzGpSala .cmd { font-family: system-ui, -apple-system, sans-serif; font-size: 10px; line-height: 1.25; color: rgba(220, 240, 255, 0.85); background: rgba(0, 0, 0, 0.25); border-radius: 8px; padding: 3px 6px; margin: 2px 0; }
#mzGpSala .via { width: 100%; min-height: 42px; border-radius: 21px; transform: skewX(-8deg); background: linear-gradient(#fff07a 0%, #ffd21c 45%, #ffaa00 100%); border: 3px solid #fff3b0; color: var(--navy); font-style: italic; font-size: 17px; font-family: inherit; -webkit-text-stroke: 2px #fff8d0; paint-order: stroke fill; box-shadow: 0 0 16px rgba(255,205,40,.6), inset 0 -4px 0 rgba(210,120,0,.35), 0 4px 0 rgba(0,0,0,.25); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform .1s; margin-top: 2px; }
#mzGpSala .via:disabled { opacity: 0.55 !important; cursor: not-allowed; background: linear-gradient(#90a4ae, #546e7a); border-color: #b0bec5; color: #eceff1; -webkit-text-stroke: none; box-shadow: none; }
#mzGpSala .via:active:not(:disabled) { transform: skewX(-8deg) translateY(2px); }
#mzGpSala .esci { background: none; border: none; color: #8fd8ff; font-family: system-ui, sans-serif; font-size: 11px; text-decoration: underline; cursor: pointer; align-self: center; margin-top: 2px; padding: 2px; }
#mzGpSala .esci:hover { color: #fff; }
#mzGpSala .errore { background: rgba(232, 67, 63, 0.85); color: #fff; font-family: system-ui, sans-serif; font-size: 11px; font-weight: bold; border-radius: 6px; padding: 3px 6px; margin-bottom: 4px; text-align: center; border: 1px solid #ff7979; }
`;

function iniettaCss(): void {
  if (document.getElementById('mz-gp-sala-style')) return;
  const st = document.createElement('style'); st.id = 'mz-gp-sala-style'; st.textContent = CSS; document.head.appendChild(st);
}

export function creaSalaAmici(o: { root: HTMLElement; token: () => string }): SalaAmici {
  iniettaCss();
  const sc = el('div', 'mz mz-gp-sc'); sc.id = 'mzGpSala';
  for (const ev of ['pointerdown', 'touchstart']) sc.addEventListener(ev, (e) => e.stopPropagation());
  o.root.appendChild(sc);
  let ws: WebSocket | null = null, aperta = false, connesso = false, pista = 'spiaggia_lungomare', veicolo = 'kart', errore: string | null = null;
  let membri: GaMembro[] = [], inCorso: { pista: string; membri: string[] } | null = null;
  let gara: Partenza | null = null, amici: Amico[] = [], ultimo = 0;
  let bot = leggiBot();
  let oggetti = leggiOggetti();
  const invia = (m: GaClientMsg) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };

  function disegna() {
    if (!aperta || gara) { sc.classList.remove('on'); document.body.classList.remove('mz-rulli'); return; }
    document.body.classList.add('mz-rulli');
    const box = el('div', 'box');
    const topBar = el('div', 'top-bar');
    const tit = el('div', 'titolo'); tit.appendChild(el('h2', '', '👥 GARA TRA AMICI'));
    const chiudiX = el('button', 'chiudi-x', '✕') as HTMLButtonElement; chiudiX.type = 'button'; chiudiX.title = 'Torna all’isola delle Corse';
    chiudiX.addEventListener('click', () => { chiudi(); sala.onEsci?.(); });
    topBar.append(tit, chiudiX);

    const nota = inCorso ? `C'è una gara in corso (${inCorso.membri.length}): quando finisce si riparte` : `Chi apre «con gli amici» entra qui · al massimo ${GA_MAX} · chiunque preme VIA`;
    const sub = el('div', 'sub', nota);
    const griglia = el('div', 'griglia'), colSx = el('div', 'col col-sx'), colDx = el('div', 'col col-dx');

    // Sinistra: Membri, Bot, Oggetti
    const sezMembri = el('div', 'sez'); sezMembri.appendChild(el('div', 'lbl', `IN SALA (${membri.length})`));
    const lista = el('div', 'riga membri');
    for (const m of membri) {
      const b = el('button', '', `${ICONA[m.veicolo] ?? '🏎️'} ${m.nome}`) as HTMLButtonElement; b.type = 'button'; b.disabled = true;
      b.appendChild(el('small', '', veicoloCorse(m.veicolo).nome)); lista.appendChild(b);
    }
    if (!membri.length) lista.appendChild(el('div', 'sub', connesso ? 'In attesa di amici…' : 'Mi collego…'));
    sezMembri.appendChild(lista);

    const sezBot = el('div', 'sez sez-opt'); sezBot.appendChild(el('div', 'lbl', 'AVVERSARI'));
    const sceltaBot = el('div', 'riga');
    for (const [v, nome, subTxt] of [[true, '🦊 CON I BOT', 'tu, gli amici e 4 animali'], [false, 'SOLO NOI', 'senza avversari finti']] as const) {
      const b = el('button', bot === v ? 'on' : '', nome) as HTMLButtonElement; b.type = 'button'; b.dataset['id'] = v ? 'bot_si' : 'bot_no';
      b.appendChild(el('small', '', subTxt));
      b.addEventListener('click', () => { bot = v; salvaBot(v); suona('click'); disegna(); });
      sceltaBot.appendChild(b);
    }
    sezBot.appendChild(sceltaBot);

    const sezOgg = el('div', 'sez sez-opt'); sezOgg.appendChild(el('div', 'lbl', 'OGGETTI'));
    const sceltaOgg = el('div', 'riga');
    for (const [v, nome, subTxt] of [[true, '🎁 CON OGGETTI', 'scatole in pista'], [false, 'GUIDA PURA', 'solo guida']] as const) {
      const b = el('button', oggetti === v ? 'on' : '', nome) as HTMLButtonElement; b.type = 'button'; b.dataset['id'] = v ? 'ogg_si' : 'ogg_no';
      b.appendChild(el('small', '', subTxt));
      b.addEventListener('click', () => { oggetti = v; salvaOggetti(v); suona('click'); disegna(); });
      sceltaOgg.appendChild(b);
    }
    sezOgg.appendChild(sceltaOgg);
    colSx.append(sezMembri, sezBot, sezOgg);

    // Destra: Pista, Info, VIA, Esci
    const sezPiste = el('div', 'sez'); sezPiste.appendChild(el('div', 'lbl', 'PISTA'));
    const listaPiste = el('div', 'riga piste');
    for (const [id, d] of PISTE_AMICI) {
      const b = el('button', id === pista ? 'on' : '', '') as HTMLButtonElement; b.type = 'button'; b.dataset['id'] = id;
      const tr = el('div', 'traccia'); tr.appendChild(tracciato(id, 76, 42));
      b.append(tr, el('span', 'pista-nome', d.nome), el('small', '', d.tipo === 'fuga' ? 'fuga dall’onda' : `${d.giri} giri`));
      b.addEventListener('click', () => { pista = id; suona('click'); disegna(); });
      listaPiste.appendChild(b);
    }
    sezPiste.appendChild(listaPiste);

    const cmd = el('div', 'cmd', 'Gli amici li vedi in pista come fantasmi (passi attraverso). I bot li ha ognuno nella sua gara, come da solo: gli oggetti colpiscono i bot, non gli amici. Pista, bot e oggetti li sceglie chi preme VIA.');
    const pronti = membri.length >= 2 && !inCorso;
    const via = el('button', 'via', pronti ? `VIA! · ${CORSE_PISTE[pista]?.nome ?? pista}` : 'Aspetta gli amici…') as HTMLButtonElement;
    via.type = 'button'; via.id = 'mzGpSalaVia'; via.disabled = !pronti;
    via.addEventListener('click', () => { suona('click'); invia({ t: 'via', pista, bot, oggetti }); });
    const esci = el('button', 'esci', 'Torna all’isola delle Corse') as HTMLButtonElement; esci.type = 'button'; esci.id = 'mzGpSalaEsci';
    esci.addEventListener('click', () => { chiudi(); sala.onEsci?.(); });
    colDx.append(sezPiste, cmd, via, esci);

    griglia.append(colSx, colDx);
    box.append(topBar, sub);
    if (errore) { const e = el('div', 'errore', errore); box.appendChild(e); }
    box.appendChild(griglia);
    sc.replaceChildren(box); sc.classList.add('on');
  }

  function connetti() {
    const t = o.token();
    if (!t) { errore = 'Serve il tuo link personale: aprilo dal messaggio che ti è arrivato (questo browser non sa chi sei)'; disegna(); return; }
    const u = new URL('/ws/gara', location.href);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'; u.searchParams.set('t', t);
    const s = new WebSocket(u.toString()); ws = s;
    s.onopen = () => { if (ws !== s) return; connesso = true; errore = null; invia({ t: 'ciao', veicolo }); disegna(); };
    s.onclose = () => {
      if (ws !== s) return;
      ws = null; connesso = false;
      if (aperta && !gara) { errore = 'Connessione persa, riprovo…'; disegna(); setTimeout(() => { if (aperta && !ws && !gara) connetti(); }, 1500); }
    };
    s.onmessage = (ev) => {
      if (ws !== s) return;
      const m = parseGaServer(String(ev.data)); if (!m) return;
      if (m.t === 'sala') { membri = m.membri; inCorso = m.gara; disegna(); }
      else if (m.t === 'errore') { errore = m.msg; disegna(); }
      else if (m.t === 'parte') {
        gara = { gara: m.gara, pista: m.pista, seed: m.seed, io: m.io, membri: m.membri, bot: m.bot === true, oggetti: m.oggetti === true };
        amici = m.membri.map((x, i) => ({ i, nome: x.nome, look: x.look, veicolo: opzioniGara({ pista: m.pista, veicolo: x.veicolo, bot: '0' })['veicolo']!, q: null, t: 0, fine: null })).filter((a) => a.i !== m.io);
        ultimo = 0; errore = null; disegna();
        sala.onParte?.(gara);
      } else if (m.t === 'p') { const a = amici.find((x) => x.i === m.i); if (a) { a.q = m.q; a.t = performance.now(); } }
      else if (m.t === 'fine') { const a = amici.find((x) => x.i === m.i); if (a) a.fine = m.ms; }
    };
  }

  function chiudi() {
    aperta = false; gara = null; amici = []; membri = []; inCorso = null; errore = null;
    document.body.classList.remove('mz-rulli');
    const s = ws; ws = null; connesso = false;
    if (s) { try { if (s.readyState === WebSocket.OPEN) s.send(JSON.stringify({ t: 'esco' })); s.close(1000); } catch { /* già chiuso */ } }
    sc.classList.remove('on');
  }

  const sala: SalaAmici = {
    onParte: null, onEsci: null,
    apri(p, v) {
      pista = p; veicolo = v; errore = null;
      document.body.classList.add('mz-rulli');
      if (aperta && ws) { invia({ t: 'ciao', veicolo }); gara = null; amici = []; disegna(); return; }
      aperta = true; gara = null; amici = []; disegna(); connetti();
    },
    chiudi,
    aperta: () => aperta,
    manda(k) {
      if (!gara) return;
      const now = performance.now(); if (now - ultimo < GA_POS_MS) return;
      ultimo = now; invia({ t: 'p', q: posDi(k) });
    },
    fine(ms) { if (gara) invia({ t: 'fine', ms: Math.max(-1, Math.round(ms)) }); },
    amici: () => amici,
    info: () => ({ aperta, connesso, membri: membri.map((m) => m.nome), gara, amici: amici.map((a) => ({ nome: a.nome, veicolo: a.veicolo, prog: a.q ? a.q[0] : null, fine: a.fine })), errore }),
  };
  return sala;
}
