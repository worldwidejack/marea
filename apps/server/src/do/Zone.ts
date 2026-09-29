// Zona: presenza in tempo reale via WebSocket con Hibernation API. Stub funzionante (WP0): hello/welcome/pos/join/leave/ping/pong, ritrasmissione immediata. WP4: snap a 10 Hz con delta, limiti, emote.
import { DurableObject } from 'cloudflare:workers';
import { MAX_ZONE_CONNECTIONS, PROTOCOL_VERSION, parseClientMsg } from '@marea/protocol';
import type { Peer, ServerMsg } from '@marea/protocol';
import type { Env } from '../env.ts';

type Attach = { peer: Peer; hello: boolean };

export class Zone extends DurableObject<Env> {
  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('upgrade') !== 'websocket') return new Response('WebSocket atteso', { status: 426 });
    const url = new URL(req.url);
    const id = url.searchParams.get('id') ?? '', nome = url.searchParams.get('nome') ?? 'Ospite', look = url.searchParams.get('look') ?? '{}';
    if (!id) return new Response('Manca la persona', { status: 400 });
    if (this.ctx.getWebSockets().length >= MAX_ZONE_CONNECTIONS) return new Response('Zona piena', { status: 503 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    let parsedLook: Peer['look'] = { pelle: 2, capelli: 0, coloreCapelli: 1, vestito: 0, cappello: 0 };
    try { parsedLook = { ...parsedLook, ...(JSON.parse(look) as Partial<Peer['look']>) }; } catch { /* look di default */ }
    const peer: Peer = { id, nome, x: 0, z: 0, yaw: 0, mode: 'walk', anim: 'idle', look: parsedLook };
    this.ctx.acceptWebSocket(server, [id]);
    server.serializeAttachment({ peer, hello: false } satisfies Attach);
    return new Response(null, { status: 101, webSocket: client });
  }

  private zoneName(): string { return this.ctx.id.name ?? 'zona'; }
  private peers(except?: WebSocket): Peer[] {
    const out: Peer[] = [];
    for (const ws of this.ctx.getWebSockets()) { if (ws === except) continue; const a = ws.deserializeAttachment() as Attach | null; if (a?.hello) out.push(a.peer); }
    return out;
  }
  private send(ws: WebSocket, m: ServerMsg): void { try { ws.send(JSON.stringify(m)); } catch { /* chiusa */ } }
  private broadcast(m: ServerMsg, except?: WebSocket): void { for (const ws of this.ctx.getWebSockets()) if (ws !== except) this.send(ws, m); }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') return;
    const m = parseClientMsg(message);
    const a = ws.deserializeAttachment() as Attach | null;
    if (!m || !a) { ws.close(1003, 'Messaggio non valido'); return; }
    const now = Date.now();
    switch (m.t) {
      case 'hello':
        if (m.v !== PROTOCOL_VERSION) { this.send(ws, { t: 'error', code: 'versione', msg: 'Versione del gioco vecchia: ricarica la pagina' }); ws.close(1008, 'versione'); return; }
        a.hello = true; ws.serializeAttachment(a);
        this.send(ws, { t: 'welcome', now, you: { id: a.peer.id, nome: a.peer.nome }, zone: this.zoneName(), peers: this.peers(ws) });
        this.broadcast({ t: 'join', peer: a.peer }, ws);
        return;
      case 'pos':
        if (!a.hello) return;
        a.peer = { ...a.peer, x: m.x, z: m.z, yaw: m.yaw, mode: m.mode, anim: m.anim }; ws.serializeAttachment(a);
        this.broadcast({ t: 'snap', now, peers: [a.peer] }, ws);
        return;
      case 'ping':
        this.send(ws, { t: 'pong', c: m.c, now });
        return;
      case 'emote':
        if (a.hello) this.broadcast({ t: 'emote', id: m.id, from: a.peer.id }, ws);
        return;
    }
  }
  webSocketClose(ws: WebSocket): void {
    const a = ws.deserializeAttachment() as Attach | null;
    if (a?.hello) this.broadcast({ t: 'leave', id: a.peer.id }, ws);
  }
  webSocketError(ws: WebSocket): void { this.webSocketClose(ws); }
}
