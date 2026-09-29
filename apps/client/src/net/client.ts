// Client WebSocket verso il DO Zone (PROTOCOL.md). hello/welcome/snap/join/leave/pong/emote/error, orologio del server con ping ogni 10 s
// (media mobile), buffer di interpolazione dei peer (peerAt: 150 ms di ritardo tra gli ultimi snap), backoff 1-2-4-8… s (max 30), close() pulito.
// Con enabled = false (?net=0) resta 'off' senza errori.
import { PROTOCOL_VERSION, parseServerMsg } from '@marea/protocol';
import type { ClientMsg, EmoteId, Peer, ServerMsg } from '@marea/protocol';
import { registerStateProvider } from '../test/testapi.ts';

export type NetStatus = 'off' | 'connecting' | 'on';
export type PeerPose = { id: string; x: number; z: number; yaw: number; mode: Peer['mode']; anim: string };
export type NetClient = {
  connect(): void; close(): void; readonly status: NetStatus; me: Peer | null; peers(): Peer[];
  sendPos(p: Extract<ClientMsg, { t: 'pos' }>): void; sendEmote(id: EmoteId): void; serverNow(): number;
  on<T extends ServerMsg['t']>(type: T, fn: (m: Extract<ServerMsg, { t: T }>) => void): () => void; lastError: string;
  /** Posa interpolata di un peer all'ora del server `renderMs` (default serverNow()) meno INTERP_DELAY_MS. null se sconosciuto. */
  peerAt(id: string, renderMs?: number): PeerPose | null;
};

export const INTERP_DELAY_MS = 150;
const PING_MS = 10_000;
const CLOSE_REPLACED = 4000;
type Sample = { t: number; x: number; z: number; yaw: number };
type Track = { peer: Peer; s: Sample[] };

const lerpAngle = (a: number, b: number, k: number) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

export function createNetClient(o: { url: string; token: string; build: string; enabled: boolean }): NetClient {
  let ws: WebSocket | null = null, status: NetStatus = 'off', retry = 1000, lastPos = 0, closed = false;
  let offset = 0, offsetOk = false, bestRtt = Infinity;
  let pingTimer: ReturnType<typeof setInterval> | null = null, retryTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSent = '';
  const tracks = new Map<string, Track>();
  const handlers = new Map<string, Set<(m: ServerMsg) => void>>();
  const emit = (m: ServerMsg) => handlers.get(m.t)?.forEach((f) => { try { f(m); } catch (e) { console.error('[marea] net handler', e); } });
  const send = (m: ClientMsg) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };
  const serverNow = () => performance.now() + offset;

  /** Stima grezza (welcome/snap: senza rtt) solo finché non c'è un pong. */
  const roughClock = (now: number) => { if (!offsetOk) offset = now - performance.now(); };
  const onPong = (c: number, now: number) => {
    const t = performance.now(), rtt = t - c;
    if (rtt < 0 || rtt > 10_000) return;
    const sample = now + rtt / 2 - t;
    if (!offsetOk) { offset = sample; offsetOk = true; bestRtt = rtt; return; }
    // media mobile, più peso ai campioni con rtt basso (meno jitter)
    const k = rtt <= bestRtt * 1.5 ? 0.3 : 0.08;
    bestRtt = Math.min(bestRtt * 1.05, rtt);
    offset += (sample - offset) * k;
  };

  const push = (p: Peer, t: number) => {
    const tr = tracks.get(p.id);
    if (!tr) { tracks.set(p.id, { peer: p, s: [{ t, x: p.x, z: p.z, yaw: p.yaw }] }); return; }
    const last = tr.s[tr.s.length - 1];
    // fermo da un po' (niente snap perché niente delta): ancora un campione fittizio poco prima, così riparte senza scivolare
    if (last && t - last.t > 250) tr.s.push({ t: t - 100, x: last.x, z: last.z, yaw: last.yaw });
    tr.s.push({ t, x: p.x, z: p.z, yaw: p.yaw });
    if (tr.s.length > 4) tr.s.splice(0, tr.s.length - 4);
    tr.peer = p;
  };

  const stopTimers = () => {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  };
  const ping = () => send({ t: 'ping', c: performance.now() });

  const api: NetClient = {
    me: null, lastError: '',
    get status() { return status; },
    connect() {
      if (!o.enabled || !o.token || closed || ws) return;
      status = 'connecting';
      let u: URL;
      try { u = new URL(o.url, location.href); } catch { status = 'off'; api.lastError = 'Indirizzo del server non valido'; return; }
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'; u.searchParams.set('t', o.token);
      const sock = new WebSocket(u.toString());
      ws = sock;
      sock.onopen = () => { send({ t: 'hello', v: PROTOCOL_VERSION, build: o.build.slice(0, 32) }); };
      sock.onmessage = (ev) => {
        if (sock !== ws) return;
        const m = parseServerMsg(String(ev.data)); if (!m) return;
        const t = serverNowFromMsg(ev.data);
        switch (m.t) {
          case 'welcome':
            status = 'on'; retry = 1000; api.lastError = ''; lastSent = '';
            roughClock(m.now);
            api.me = { id: m.you.id, nome: m.you.nome } as Peer;
            tracks.clear(); for (const p of m.peers) push(p, m.now);
            ping(); setTimeout(ping, 1000);
            if (pingTimer) clearInterval(pingTimer);
            pingTimer = setInterval(ping, PING_MS);
            break;
          case 'snap': roughClock(m.now); for (const p of m.peers) if (p.id !== api.me?.id) push(p, m.now); break;
          case 'join': if (m.peer.id !== api.me?.id) push(m.peer, t ?? serverNow()); break;
          case 'leave': tracks.delete(m.id); break;
          case 'pong': onPong(m.c, m.now); break;
          case 'error': api.lastError = m.msg; if (m.code === 'token' || m.code === 'versione') closed = true; break;
          case 'emote': break;
        }
        emit(m);
      };
      sock.onclose = (ev) => {
        if (sock !== ws) return;
        ws = null; status = 'off';
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
        if (ev.code === CLOSE_REPLACED) { closed = true; api.lastError = 'MAREA è aperta su un altro dispositivo'; }
        if (closed) return;
        const wait = retry * (0.8 + Math.random() * 0.4);
        retry = Math.min(30_000, retry * 2);
        retryTimer = setTimeout(() => { retryTimer = null; api.connect(); }, wait);
      };
      sock.onerror = () => { /* onclose segue */ };
    },
    close() {
      closed = true; stopTimers();
      const s = ws; ws = null; status = 'off';
      if (s) { s.onmessage = null; s.onclose = null; try { s.close(1000, 'ciao'); } catch { /* già chiusa */ } }
      tracks.clear();
    },
    peers: () => { const out: Peer[] = []; for (const tr of tracks.values()) if (tr.peer.id !== api.me?.id) out.push(tr.peer); return out; },
    peerAt(id, renderMs = serverNow()) {
      const tr = tracks.get(id); if (!tr) return null;
      const s = tr.s, t = renderMs - INTERP_DELAY_MS;
      let a = s[0], b = s[0];
      if (!a) return null;
      for (let i = s.length - 1; i > 0; i--) { const p = s[i - 1], q = s[i]; if (p && q && p.t <= t) { a = p; b = q; break; } }
      if (a === b || !b || t <= a.t) { const c = t <= a.t ? a : (s[s.length - 1] ?? a); return { id, x: c.x, z: c.z, yaw: c.yaw, mode: tr.peer.mode, anim: tr.peer.anim }; }
      const k = Math.min(1, (t - a.t) / Math.max(1, b.t - a.t));
      return { id, x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: lerpAngle(a.yaw, b.yaw, k), mode: tr.peer.mode, anim: tr.peer.anim };
    },
    sendPos(p) {
      const now = performance.now(); if (now - lastPos < 100) return;
      const q = { t: 'pos' as const, x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, yaw: Math.round(p.yaw * 1000) / 1000, mode: p.mode, anim: p.anim };
      const key = `${q.x},${q.z},${q.yaw},${q.mode},${q.anim}`;
      if (key === lastSent) return; // solo se cambiato (PROTOCOL §3): da fermi zero messaggi
      lastPos = now; lastSent = key; send(q);
    },
    sendEmote: (id) => send({ t: 'emote', id }),
    serverNow,
    on(type, fn) { const set = handlers.get(type) ?? new Set(); handlers.set(type, set); set.add(fn as (m: ServerMsg) => void); return () => set.delete(fn as (m: ServerMsg) => void); },
  };
  registerStateProvider('netPeers', () => api.peers().map((p) => ({ id: p.id, nome: p.nome, x: p.x, z: p.z, mode: p.mode, anim: p.anim, at: api.peerAt(p.id) })));
  return api;
}

/** Il server mette `now` in ogni messaggio (anche join/leave): lo legge senza toccare i tipi del protocollo. */
function serverNowFromMsg(data: unknown): number | null {
  const s = String(data), i = s.lastIndexOf('"now":');
  if (i < 0) return null;
  const n = parseFloat(s.slice(i + 6));
  return Number.isFinite(n) ? n : null;
}
