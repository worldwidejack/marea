// Corse tra amici (10 ott 2026, PROTOCOL.md §8): la sala alla porta della Spiaggia e le posizioni degli amici in gara.
// Ognuno corre la SUA gara (sim locale, coi suoi bot se chi preme VIA li vuole; rigiocata dal server come da solo); il DO GaraAmici fa partire tutti insieme (stessa
// pista, stesso seed, un posto in griglia a testa) e gira a ciascuno le posizioni degli altri, che qui diventano «fantasmi»: veicoli
// disegnati dove sono gli amici (niente urti), con nome, e la classifica tra amici.
// - `apri(veicolo)`: entra in sala (WebSocket `/ws/gara`), mostra il pannello con chi c'è e VIA (con almeno 2); `onParte` quando si parte;
// - in gara: `manda(k)` (ogni GA_POS_MS al massimo), `arrivato(ms)` / ritiro; `amici()` = gli altri con la posizione stimata adesso;
// - `chiudi()`: esce dalla sala (si chiude il socket).
import { GA_MAX, GA_POS_MS, parseGaServer } from '@marea/protocol/gara_amici.ts';
import type { GaClientMsg, GaMembro, GaPos } from '@marea/protocol/gara_amici.ts';
import { CORSE_PISTE } from '@marea/content/corse.ts';
import { opzioniGara } from '@marea/sim/corse/gara.ts';
import { veicoloCorse } from '@marea/sim/corse/pista.ts';
import type { Veicolo } from '@marea/sim/corse/veicolo.ts';
import { PAL, el } from '../ui/style.ts';
import { suona } from '../audio/ponte.ts';

export type Partenza = { gara: string; pista: string; seed: number; io: number; membri: GaMembro[]; bot: boolean };
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
  /** Il pannello si chiude da solo per «Torna all'isola»: chi usa la sala rimette l'hub. */
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
const CHIAVE_BOT = 'marea.corse.amiciBot';
function leggiBot(): boolean { try { return localStorage.getItem(CHIAVE_BOT) !== '0'; } catch { return true; } }
function salvaBot(v: boolean): void { try { localStorage.setItem(CHIAVE_BOT, v ? '1' : '0'); } catch { /* niente memoria */ } }

export function creaSalaAmici(o: { root: HTMLElement; token: () => string }): SalaAmici {
  const sc = el('div', 'mz mz-gp-sc'); sc.id = 'mzGpSala';
  for (const ev of ['pointerdown', 'touchstart']) sc.addEventListener(ev, (e) => e.stopPropagation());
  o.root.appendChild(sc);
  let ws: WebSocket | null = null, aperta = false, connesso = false, pista = 'spiaggia_lungomare', veicolo = 'kart', errore: string | null = null;
  let membri: GaMembro[] = [], inCorso: { pista: string; membri: string[] } | null = null;
  let gara: Partenza | null = null, amici: Amico[] = [], ultimo = 0;
  /** Coi bot o no (lo decide chi preme VIA; si ricorda sul telefono). */
  let bot = leggiBot();
  const invia = (m: GaClientMsg) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };

  function disegna() {
    if (!aperta || gara) { sc.classList.remove('on'); return; }
    const box = el('div', 'box');
    const lista = el('div', 'riga');
    for (const m of membri) { const b = el('button', '', m.nome) as HTMLButtonElement; b.type = 'button'; b.disabled = true; b.appendChild(el('small', '', veicoloCorse(m.veicolo).nome)); lista.appendChild(b); }
    if (!membri.length) lista.appendChild(el('div', 'sub', connesso ? '…' : 'mi collego…'));
    const pronti = membri.length >= 2 && !inCorso;
    const via = el('button', 'via', pronti ? `VIA! · ${CORSE_PISTE[pista]?.nome ?? pista}` : 'Aspetta gli amici…') as HTMLButtonElement;
    via.type = 'button'; via.id = 'mzGpSalaVia'; via.disabled = !pronti; via.style.opacity = pronti ? '1' : '.55';
    via.addEventListener('click', () => { suona('click'); invia({ t: 'via', pista, bot }); });
    const scelta = el('div', 'riga');
    for (const [v, nome, sub] of [[true, '🦊 CON I BOT', 'tu, gli amici e 4 animali'], [false, 'SOLO NOI', 'senza avversari finti']] as const) {
      const b = el('button', bot === v ? 'on' : '', nome) as HTMLButtonElement; b.type = 'button'; b.dataset['id'] = v ? 'bot_si' : 'bot_no';
      b.appendChild(el('small', '', sub));
      b.addEventListener('click', () => { bot = v; salvaBot(v); suona('click'); disegna(); });
      scelta.appendChild(b);
    }
    const esci = el('button', 'esci', 'Torna all’isola delle Corse') as HTMLButtonElement; esci.type = 'button'; esci.id = 'mzGpSalaEsci';
    esci.addEventListener('click', () => { chiudi(); sala.onEsci?.(); });
    const nota = inCorso ? `C'è una gara in corso (${inCorso.membri.length}): quando finisce si riparte` : `Chi apre «con gli amici» entra qui · al massimo ${GA_MAX} · chiunque preme VIA`;
    box.append(el('h2', '', '👥 GARA TRA AMICI'), el('div', 'sub', nota), el('div', 'lbl', `IN SALA (${membri.length})`), lista);
    if (errore) { const e = el('div', 'sub', errore); e.style.color = PAL.rosso; box.appendChild(e); }
    box.append(el('div', 'lbl', 'AVVERSARI'), scelta,
      el('div', 'cmd', 'Gli amici li vedi in pista come fantasmi (passi attraverso). I bot li ha ognuno nella sua gara, come da solo. Pista e bot li sceglie chi preme VIA.'), via, esci);
    sc.replaceChildren(box); sc.classList.add('on');
  }

  function connetti() {
    const t = o.token();
    if (!t) { errore = 'Serve il tuo link personale per correre con gli amici'; disegna(); return; }
    const u = new URL('/ws/gara', location.href);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'; u.searchParams.set('t', t);
    const s = new WebSocket(u.toString()); ws = s;
    s.onopen = () => { if (ws !== s) return; connesso = true; errore = null; invia({ t: 'ciao', veicolo }); disegna(); };
    s.onclose = () => {
      if (ws !== s) return;
      ws = null; connesso = false;
      // caduta in sala: si riprova (in gara no: la gara va avanti da sola, gli amici restano fermi dove erano)
      if (aperta && !gara) { errore = 'Connessione persa, riprovo…'; disegna(); setTimeout(() => { if (aperta && !ws && !gara) connetti(); }, 1500); }
    };
    s.onmessage = (ev) => {
      if (ws !== s) return;
      const m = parseGaServer(String(ev.data)); if (!m) return;
      if (m.t === 'sala') { membri = m.membri; inCorso = m.gara; disegna(); }
      else if (m.t === 'errore') { errore = m.msg; disegna(); }
      else if (m.t === 'parte') {
        gara = { gara: m.gara, pista: m.pista, seed: m.seed, io: m.io, membri: m.membri, bot: m.bot === true };
        // il veicolo con cui corre davvero: quello del suo garage se va bene per la pista, se no il primo della famiglia (come la sua gara)
        amici = m.membri.map((x, i) => ({ i, nome: x.nome, look: x.look, veicolo: opzioniGara({ pista: m.pista, veicolo: x.veicolo, bot: '0' })['veicolo']!, q: null, t: 0, fine: null })).filter((a) => a.i !== m.io);
        ultimo = 0; errore = null; disegna();
        sala.onParte?.(gara);
      } else if (m.t === 'p') { const a = amici.find((x) => x.i === m.i); if (a) { a.q = m.q; a.t = performance.now(); } }
      else if (m.t === 'fine') { const a = amici.find((x) => x.i === m.i); if (a) a.fine = m.ms; }
    };
  }

  function chiudi() {
    aperta = false; gara = null; amici = []; membri = []; inCorso = null; errore = null;
    const s = ws; ws = null; connesso = false;
    if (s) { try { if (s.readyState === WebSocket.OPEN) s.send(JSON.stringify({ t: 'esco' })); s.close(1000); } catch { /* già chiuso */ } }
    sc.classList.remove('on');
  }

  const sala: SalaAmici = {
    onParte: null, onEsci: null,
    apri(p, v) {
      pista = p; veicolo = v; errore = null;
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
