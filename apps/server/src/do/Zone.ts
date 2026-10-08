// Zona: presenza in tempo reale via WebSocket con Hibernation API (PROTOCOL.md §3).
// 10 Hz con delta: le `pos` aggiornano l'attachment del socket e segnano il peer come «sporco»; uno `snap` parte al massimo ogni 100 ms
// solo con i peer cambiati. Il flush usa un setTimeout interno (non un alarm): costa zero richieste e tiene sveglio il DO solo finché
// arrivano posizioni; quando nessuno si muove non resta nessun timer e il DO può ibernare (lo stato dei peer vive negli attachment).
// Rotta interna `POST /look` (dal Worker dopo `POST /api/look`, CONTRACTS §13): aggiorna il look dei socket di quella persona e lo manda nel
// prossimo `snap`; il corpo può avere anche `titolo` (#87, id di un traguardo: il client lo mostra sotto il nome). Emote: al massimo una ogni 800 ms per connessione, mai in eco a chi la manda.
import { DurableObject } from 'cloudflare:workers';
import { ARCHIPELAGO, ISLANDS } from '@marea/content';
import { MAX_MSG_BYTES, MAX_ZONE_CONNECTIONS, POS_HZ, PROTOCOL_VERSION, parseClientMsg } from '@marea/protocol';
import type { Look, Peer, ServerMsg } from '@marea/protocol';
import { TRAGUARDI } from '@marea/content/diario.ts';
/** Messaggio in uscita: `now` lo aggiunge `send`/`broadcast`. */
type Outgoing = { [K in ServerMsg['t']]: Omit<Extract<ServerMsg, { t: K }>, 'now'> & { now?: number } }[ServerMsg['t']];
import type { Env } from '../env.ts';

type Attach = { peer: Peer; hello: boolean; lastPos: number; gone?: boolean };

const SNAP_MS = 1000 / POS_HZ;          // 100 ms
const MIN_POS_MS = 45;                   // > 20 Hz (con un po' di tolleranza sul jitter) = ignorato
const MAX_MSG_PER_S = 60;                // oltre: ignorati (non chiude: un telefono lento può mandare a raffiche)
const MAX_BAD = 10;                      // messaggi non validi prima della chiusura
const EMOTE_MS = 800;                    // pausa minima tra due emote della stessa connessione
export const CLOSE_REPLACED = 4000;      // stessa persona connessa altrove
const DEFAULT_LOOK: Look = { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 1 };

// Confini larghi della zona: il lato più grande tra l'arcipelago intero (M1: un solo mondo continuo) e ogni isola, × 3 (il mare attorno è navigabile).
const WORLD = (() => {
  let m = Math.max(64, ARCHIPELAGO.w * ARCHIPELAGO.tile, ARCHIPELAGO.h * ARCHIPELAGO.tile);
  for (const i of ISLANDS) m = Math.max(m, i.rows.length * (i.tile || 2), (i.rows[0]?.length ?? 0) * (i.tile || 2));
  return m;
})();
const LOOK_KEYS = ['pelle', 'capelli', 'coloreCapelli', 'vestito', 'cappello'] as const;
/** Forma di un Look: cinque interi ≥ 0 (i limiti veri li controlla il Worker con avatar.json). */
function asLook(v: unknown): Look | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>, out = {} as Look;
  for (const k of LOOK_KEYS) { const x = o[k]; if (typeof x !== 'number' || !Number.isInteger(x) || x < 0 || x > 255) return null; out[k] = x; }
  return out;
}
/** Titolo del diario (#87): id di un traguardo esistente, altrimenti niente. */
function asTitolo(v: unknown): string | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const t = (v as Record<string, unknown>)['titolo'];
  return typeof t === 'string' && TRAGUARDI.some((x) => x.id === t) ? t : undefined;
}
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const r2 = (v: number) => Math.round(v * 100) / 100;

export class Zone extends DurableObject<Env> {
  // Stato in memoria: si perde con l'ibernazione, ma è vuoto quando non c'è un timer attivo.
  private dirty = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastFlush = 0;
  // anche `emote` (ultima inoltrata) si perde con l'ibernazione: al peggio passa una emote in più
  private rate = new Map<WebSocket, { s: number; n: number; bad: number; emote: number }>();

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/look') return this.nuovoLook(req);
    if (req.headers.get('upgrade') !== 'websocket') return new Response('WebSocket atteso', { status: 426 });
    const id = url.searchParams.get('id') ?? '', nome = url.searchParams.get('nome') ?? 'Ospite', look = url.searchParams.get('look') ?? '{}';
    if (!id) return new Response('Manca la persona', { status: 400 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Stessa persona già dentro: chiudi la vecchia connessione (senza `leave`: la nuova la sostituisce).
    for (const old of this.ctx.getWebSockets(id)) {
      const a = this.att(old);
      if (a) { a.gone = true; old.serializeAttachment(a); }
      try { old.close(CLOSE_REPLACED, 'Aperto su un altro dispositivo'); } catch { /* già chiusa */ }
    }
    if (this.live().length >= MAX_ZONE_CONNECTIONS) {
      server.accept();
      this.send(server, { t: 'error', code: 'pieno', msg: 'La zona è piena: riprova tra poco' });
      server.close(1013, 'pieno');
      return new Response(null, { status: 101, webSocket: client });
    }

    let parsedLook: Look = DEFAULT_LOOK, titolo: string | undefined;
    try { const raw = JSON.parse(look) as Record<string, unknown>; parsedLook = asLook({ ...DEFAULT_LOOK, ...raw }) ?? DEFAULT_LOOK; titolo = asTitolo(raw); } catch { /* look di default */ }
    const peer: Peer = { id, nome, x: 0, z: 0, yaw: 0, mode: 'walk', anim: 'idle', look: parsedLook, ...(titolo ? { titolo } : {}) };
    this.ctx.acceptWebSocket(server, [id]);
    server.serializeAttachment({ peer, hello: false, lastPos: 0 } satisfies Attach);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Look salvato dal Worker (già validato lì: qui solo la forma). Vale anche per i socket che non hanno ancora fatto `hello`. */
  private async nuovoLook(req: Request): Promise<Response> {
    const id = req.headers.get('x-persona') ?? '';
    let look: Look | null = null, titolo: string | undefined;
    try { const raw: unknown = await req.json(); look = asLook(raw); titolo = asTitolo(raw); } catch { /* corpo rotto */ }
    if (!id || !look) return new Response(null, { status: 400 });
    let any = false;
    for (const ws of this.ctx.getWebSockets(id)) {
      const a = this.att(ws);
      if (!a || a.gone) continue;
      const { titolo: _via, ...resto } = a.peer; // il titolo arriva sempre insieme al look (#87): assente = tolto
      a.peer = { ...resto, look, ...(titolo ? { titolo } : {}) };
      try { ws.serializeAttachment(a); any = true; } catch { /* socket già finito */ }
    }
    if (any) { this.dirty.add(id); this.schedule(); }
    return new Response(null, { status: 204 });
  }

  private zoneName(): string { return this.ctx.id.name ?? 'zona'; }
  private att(ws: WebSocket): Attach | null { try { return ws.deserializeAttachment() as Attach | null; } catch { return null; } }
  /** Socket vivi (non sostituiti né in chiusura). */
  private live(): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => ws.readyState <= 1 && !this.att(ws)?.gone);
  }
  private peers(except?: WebSocket): Peer[] {
    const out: Peer[] = [];
    for (const ws of this.live()) { if (ws === except) continue; const a = this.att(ws); if (a?.hello) out.push(a.peer); }
    return out;
  }
  /** Ogni messaggio porta `now` del server (anche join/leave/emote/error: campo in più, i parser lo ignorano). */
  private send(ws: WebSocket, m: Outgoing, now = Date.now()): void { this.sendRaw(ws, JSON.stringify({ ...m, now })); }
  private sendRaw(ws: WebSocket, s: string): void { try { ws.send(s); } catch { /* chiusa */ } }
  private broadcast(m: Outgoing, except?: WebSocket): void {
    const s = JSON.stringify({ ...m, now: Date.now() });
    for (const ws of this.live()) { if (ws === except) continue; const a = this.att(ws); if (a?.hello) this.sendRaw(ws, s); }
  }

  private schedule(): void {
    if (this.timer) return;
    const wait = Math.max(0, SNAP_MS - (Date.now() - this.lastFlush));
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, wait);
  }
  /** Uno snap con i soli peer cambiati; ogni destinatario riceve tutti tranne sé stesso. */
  private flush(): void {
    this.lastFlush = Date.now();
    if (!this.dirty.size) return;
    const changed = new Map<string, Peer>();
    const socks = this.live();
    for (const ws of socks) { const a = this.att(ws); if (a?.hello && this.dirty.has(a.peer.id)) changed.set(a.peer.id, a.peer); }
    this.dirty.clear();
    if (!changed.size) return;
    const now = Date.now();
    const all = JSON.stringify({ t: 'snap', now, peers: [...changed.values()] } satisfies ServerMsg);
    for (const ws of socks) {
      const a = this.att(ws); if (!a?.hello) continue;
      if (!changed.has(a.peer.id)) { this.sendRaw(ws, all); continue; }
      const others = [...changed.values()].filter((p) => p.id !== a.peer.id);
      if (others.length) this.sendRaw(ws, JSON.stringify({ t: 'snap', now, peers: others } satisfies ServerMsg));
    }
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const size = typeof message === 'string' ? message.length : message.byteLength;
    if (size > MAX_MSG_BYTES) { ws.close(1009, 'Messaggio troppo grande'); return; }
    if (typeof message !== 'string') return;
    const now = Date.now();
    let r = this.rate.get(ws);
    if (!r) { r = { s: Math.floor(now / 1000), n: 0, bad: 0, emote: 0 }; this.rate.set(ws, r); }
    const sec = Math.floor(now / 1000); if (sec !== r.s) { r.s = sec; r.n = 0; }
    if (++r.n > MAX_MSG_PER_S) return;
    const a = this.att(ws);
    if (!a || a.gone) return;
    const m = parseClientMsg(message);
    if (!m) { if (++r.bad >= MAX_BAD) ws.close(1003, 'Messaggi non validi'); return; }
    switch (m.t) {
      case 'hello':
        if (m.v !== PROTOCOL_VERSION) { this.send(ws, { t: 'error', code: 'versione', msg: 'Versione del gioco vecchia: ricarica la pagina' }, now); ws.close(1008, 'versione'); return; }
        if (a.hello) return;
        a.hello = true; ws.serializeAttachment(a);
        this.send(ws, { t: 'welcome', now, you: { id: a.peer.id, nome: a.peer.nome }, zone: this.zoneName(), peers: this.peers(ws) }, now);
        this.broadcast({ t: 'join', peer: a.peer }, ws);
        return;
      case 'pos': {
        if (!a.hello || now - a.lastPos < MIN_POS_MS) return;
        a.peer = { ...a.peer, x: r2(clamp(m.x, -WORLD, WORLD * 2)), z: r2(clamp(m.z, -WORLD, WORLD * 2)), yaw: Math.round(m.yaw * 1000) / 1000, mode: m.mode, anim: m.anim };
        a.lastPos = now; ws.serializeAttachment(a);
        this.dirty.add(a.peer.id);
        this.schedule();
        return;
      }
      case 'ping':
        this.send(ws, { t: 'pong', c: m.c, now }, now);
        return;
      case 'emote':
        if (!a.hello || now - r.emote < EMOTE_MS) return;
        r.emote = now;
        this.broadcast({ t: 'emote', id: m.id, from: a.peer.id }, ws);
        return;
    }
  }

  private gone(ws: WebSocket): void {
    this.rate.delete(ws);
    const a = this.att(ws);
    if (!a || a.gone) return;
    a.gone = true;
    try { ws.serializeAttachment(a); } catch { /* socket già finito */ }
    this.dirty.delete(a.peer.id);
    if (a.hello) this.broadcast({ t: 'leave', id: a.peer.id }, ws);
  }
  webSocketClose(ws: WebSocket, code: number): void {
    this.gone(ws);
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, 'ciao'); } catch { /* già chiusa */ }
  }
  webSocketError(ws: WebSocket): void { this.gone(ws); }
}
