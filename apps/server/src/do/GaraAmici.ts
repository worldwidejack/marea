// Corse tra amici (PROTOCOL.md §8, 10 ott 2026): una sala sola (idFromName('garaamici')), socket normali senza ibernazione come
// Spedizioni (finché c'è qualcuno in sala il DO resta sveglio). Aprire `/ws/gara` = entrare in sala; VIA (chiunque, con almeno 2 in sala
// e nessuna gara in corso) → id, seed e posto in griglia a tutti. Il server non simula niente: gira le posizioni (`p`) e gli arrivi
// (`fine`) agli altri corridori, che disegnano gli amici come fantasmi. Ognuno manda il suo esito come una partita da solo (rigiocata dal
// DO del suo lotto). Una gara alla volta; si chiude quando tutti sono arrivati o usciti, o dopo GARA_MAX_MS. Chi è arrivato resta
// collegato e vede ancora gli altri; se esce dopo il suo `fine`, l'arrivo resta (il −1 automatico solo per chi esce senza aver finito).
import { DurableObject } from 'cloudflare:workers';
import { CORSE, CORSE_PISTE } from '@marea/content/corse.ts';
import type { Look } from '@marea/protocol';
import { GA_MAX, parseGaClient } from '@marea/protocol/gara_amici.ts';
import type { GaMembro, GaPos, GaServerMsg } from '@marea/protocol/gara_amici.ts';
import type { Env } from '../env.ts';

/** Rete di sicurezza: una gara aperta da più di 8 minuti si chiude da sola. */
const GARA_MAX_MS = 8 * 60_000;
const MAX_P_PER_S = 25;
const MAX_MSG_PER_S = 40;
/** Messaggi non validi di fila prima della chiusura (1003). */
const MAX_BAD = 10;
const VEICOLI = new Set(CORSE.veicoli.map((v) => v.id));

type Conn = { ws: WebSocket; id: string; nome: string; look: Look; veicolo: string; s: number; n: number; np: number; bad: number };
type Corridore = { m: GaMembro; conn: Conn | null; finito: boolean };
type Gara = { id: string; pista: string; seed: number; corridori: Corridore[]; t0: number; timer: ReturnType<typeof setTimeout> };

export class GaraAmici extends DurableObject<Env> {
  /** La sala, in ordine di entrata (= ordine di griglia). */
  private sala: Conn[] = [];
  private gara: Gara | null = null;

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('upgrade') !== 'websocket') return new Response('WebSocket atteso', { status: 426 });
    const url = new URL(req.url);
    const id = url.searchParams.get('id') ?? '', nome = url.searchParams.get('nome') ?? 'Ospite';
    let look: Look = { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 1 };
    try { const l = JSON.parse(url.searchParams.get('look') ?? '{}') as Look; if (l && typeof l === 'object') look = { ...look, ...l }; } catch { /* look di default */ }
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    const fatto = new Response(null, { status: 101, webSocket: client });
    if (!id) { this.send(server, { t: 'errore', msg: 'Chi sei?' }); server.close(1008, 'id'); return fatto; }
    // la stessa persona in un'altra scheda: quella vecchia esce (se era in gara, per gli altri si ritira)
    for (const o of [...this.sala]) if (o.id === id) { this.esce(o, false); try { o.ws.close(1000, 'altra scheda'); } catch { /* chiusa */ } }
    if (this.sala.length >= GA_MAX) { this.annuncia(); this.send(server, { t: 'errore', msg: `La sala è piena (${GA_MAX})` }); server.close(1013, 'piena'); return fatto; }
    const c: Conn = { ws: server, id, nome, look, veicolo: 'kart', s: 0, n: 0, np: 0, bad: 0 };
    server.addEventListener('message', (ev) => this.onMessage(c, ev.data));
    server.addEventListener('close', () => this.esce(c));
    server.addEventListener('error', () => this.esce(c));
    this.sala.push(c);
    this.annuncia();
    return fatto;
  }

  private send(ws: WebSocket, m: GaServerMsg): void { try { ws.send(JSON.stringify(m)); } catch { /* chiusa */ } }
  private membro(c: Conn): GaMembro { return { id: c.id, nome: c.nome, look: c.look, veicolo: c.veicolo }; }
  /** La sala a tutti (a ogni cambio). */
  private annuncia(): void {
    const g = this.gara;
    const m: GaServerMsg = { t: 'sala', membri: this.sala.map((c) => this.membro(c)), max: GA_MAX, gara: g ? { pista: g.pista, membri: g.corridori.map((r) => r.m.id) } : null };
    const s = JSON.stringify(m);
    for (const c of this.sala) { try { c.ws.send(s); } catch { /* chiusa */ } }
  }
  /** A tutti i corridori collegati tranne `i`. */
  private agliAltri(g: Gara, i: number, m: GaServerMsg): void {
    const s = JSON.stringify(m);
    g.corridori.forEach((r, k) => { if (k !== i && r.conn) { try { r.conn.ws.send(s); } catch { /* chiusa */ } } });
  }

  private onMessage(c: Conn, data: unknown): void {
    if (!this.sala.includes(c)) return;
    const sec = Math.floor(Date.now() / 1000);
    if (sec !== c.s) { c.s = sec; c.n = 0; c.np = 0; }
    const m = typeof data === 'string' ? parseGaClient(data) : null;
    if (!m) { if (++c.bad >= MAX_BAD) { this.esce(c); try { c.ws.close(1003, 'Messaggi non validi'); } catch { /* chiusa */ } } return; }
    c.bad = 0;
    if (m.t === 'p') { if (++c.np <= MAX_P_PER_S) this.posizione(c, m.q); return; }
    if (++c.n > MAX_MSG_PER_S) return;
    this.scaduta();
    switch (m.t) {
      case 'ciao': c.veicolo = VEICOLI.has(m.veicolo) ? m.veicolo : 'kart'; this.annuncia(); return;
      case 'via': this.parti(c, m.pista); return;
      case 'fine': { const g = this.gara, i = g ? g.corridori.findIndex((r) => r.conn === c) : -1; if (g && i >= 0) this.finito(g, i, m.ms); return; }
      case 'esco': this.esce(c); try { c.ws.close(1000, 'ciao'); } catch { /* chiusa */ } return;
    }
  }

  /** VIA: tutti quelli in sala partono, in ordine di entrata. */
  private parti(c: Conn, pista: string): void {
    if (!pista.startsWith('spiaggia_') || !CORSE_PISTE[pista]) { this.send(c.ws, { t: 'errore', msg: 'Pista sconosciuta' }); return; }
    if (this.gara) { this.send(c.ws, { t: 'errore', msg: "C'è già una gara in corso: aspetta che finisca" }); return; }
    if (this.sala.length < 2) { this.send(c.ws, { t: 'errore', msg: 'Servono almeno 2 amici in sala' }); return; }
    const id = crypto.randomUUID(), seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    const corridori: Corridore[] = this.sala.map((x) => ({ m: this.membro(x), conn: x, finito: false }));
    const g: Gara = { id, pista, seed, corridori, t0: Date.now(), timer: setTimeout(() => this.chiudi(g, 'tempo'), GARA_MAX_MS) };
    this.gara = g;
    const membri = corridori.map((r) => r.m);
    corridori.forEach((r, io) => { if (r.conn) this.send(r.conn.ws, { t: 'parte', gara: id, pista, seed, io, membri }); });
    console.log(`[marea] gara tra amici: ${pista}, ${corridori.length} corridori, gara ${id}`);
    this.annuncia();
  }

  private posizione(c: Conn, q: GaPos): void {
    const g = this.gara, i = g ? g.corridori.findIndex((r) => r.conn === c) : -1;
    if (g && i >= 0) this.agliAltri(g, i, { t: 'p', i, q });
  }

  /** Il corridore i è arrivato (ms ≥ 0) o si è ritirato (−1): lo sanno gli altri; finiti tutti, la gara si chiude. */
  private finito(g: Gara, i: number, ms: number, annuncia = true): void {
    const r = g.corridori[i];
    if (!r || r.finito) return;
    r.finito = true;
    this.agliAltri(g, i, { t: 'fine', i, ms });
    if (g.corridori.every((x) => x.finito)) this.chiudi(g, 'finita', annuncia);
  }

  /** Esce dalla sala (socket chiusa, `esco`, altra scheda); se era in gara e non aveva ancora finito, si ritira (−1). */
  private esce(c: Conn, annuncia = true): void {
    const k = this.sala.indexOf(c);
    if (k < 0) return;
    this.sala.splice(k, 1);
    const g = this.gara, i = g ? g.corridori.findIndex((r) => r.conn === c) : -1;
    if (g && i >= 0) { this.finito(g, i, -1, false); g.corridori[i]!.conn = null; }
    if (annuncia) this.annuncia();
  }

  private chiudi(g: Gara, perche: string, annuncia = true): void {
    if (this.gara !== g) return;
    clearTimeout(g.timer);
    this.gara = null;
    console.log(`[marea] gara tra amici chiusa (${perche}): ${g.pista}, gara ${g.id}`);
    if (annuncia) this.annuncia();
  }
  /** Doppia rete: se il timer non è scattato (DO sospeso), la gara troppo vecchia si chiude al primo messaggio. */
  private scaduta(): void {
    const g = this.gara;
    if (g && Date.now() - g.t0 > GARA_MAX_MS) this.chiudi(g, 'tempo');
  }
}
