// Client WebSocket verso il DO Zone (PROTOCOL.md). Stub funzionante (WP0): hello/welcome/snap/pong, 10 Hz, backoff. WP4 rifinisce.
import { PROTOCOL_VERSION, parseServerMsg } from '@marea/protocol';
import type { ClientMsg, EmoteId, Peer, ServerMsg } from '@marea/protocol';
export type NetStatus = 'off' | 'connecting' | 'on';
export type NetClient = { connect(): void; close(): void; readonly status: NetStatus; me: Peer | null; peers(): Peer[]; sendPos(p: Extract<ClientMsg, { t: 'pos' }>): void; sendEmote(id: EmoteId): void; serverNow(): number; on<T extends ServerMsg['t']>(type: T, fn: (m: Extract<ServerMsg, { t: T }>) => void): () => void; lastError: string };
export function createNetClient(o: { url: string; token: string; build: string; enabled: boolean }): NetClient {
  let ws: WebSocket | null = null, status: NetStatus = 'off', offset = 0, retry = 1000, lastPos = 0, closed = false;
  const peers = new Map<string, Peer>();
  const handlers = new Map<string, Set<(m: ServerMsg) => void>>();
  const emit = (m: ServerMsg) => handlers.get(m.t)?.forEach((f) => f(m));
  const send = (m: ClientMsg) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };
  const api: NetClient = {
    me: null, lastError: '',
    get status() { return status; },
    connect() {
      if (!o.enabled || !o.token || closed) return;
      status = 'connecting';
      const u = new URL(o.url, location.href); u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'; u.searchParams.set('t', o.token);
      ws = new WebSocket(u.toString());
      ws.onopen = () => send({ t: 'hello', v: PROTOCOL_VERSION, build: o.build });
      ws.onmessage = (ev) => {
        const m = parseServerMsg(String(ev.data)); if (!m) return;
        if (m.t === 'welcome') { status = 'on'; retry = 1000; offset = m.now - performance.now(); api.me = { id: m.you.id, nome: m.you.nome } as Peer; peers.clear(); for (const p of m.peers) peers.set(p.id, p); }
        else if (m.t === 'snap') { offset = m.now - performance.now(); for (const p of m.peers) peers.set(p.id, p); }
        else if (m.t === 'join') peers.set(m.peer.id, m.peer);
        else if (m.t === 'leave') peers.delete(m.id);
        else if (m.t === 'pong') offset = m.now - performance.now();
        else if (m.t === 'error') { api.lastError = m.msg; if (m.code === 'token' || m.code === 'versione') closed = true; }
        emit(m);
      };
      ws.onclose = () => { status = 'off'; ws = null; if (!closed) { setTimeout(() => api.connect(), retry); retry = Math.min(30000, retry * 2); } };
      ws.onerror = () => { /* onclose segue */ };
    },
    close() { closed = true; ws?.close(); status = 'off'; },
    peers: () => [...peers.values()].filter((p) => p.id !== api.me?.id),
    sendPos(p) { const now = performance.now(); if (now - lastPos < 100) return; lastPos = now; send(p); },
    sendEmote: (id) => send({ t: 'emote', id }),
    serverNow: () => performance.now() + offset,
    on(type, fn) { const set = handlers.get(type) ?? new Set(); handlers.set(type, set); set.add(fn as (m: ServerMsg) => void); return () => set.delete(fn as (m: ServerMsg) => void); },
  };
  return api;
}
