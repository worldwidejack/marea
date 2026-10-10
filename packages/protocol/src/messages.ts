// Messaggi client ↔ server. Contratto: docs/PROTOCOL.md. Nessuna dipendenza (solo il tipo `Indossa`, cancellato in compilazione).
import type { Indossa } from '@marea/sim/rpg/indossa.ts';
export type { Indossa };
export const PROTOCOL_VERSION = 1 as const;

export type Mode = 'walk' | 'boat';
export type Look = { pelle: number; capelli: number; coloreCapelli: number; vestito: number; cappello: number };
/** `titolo` (#87, facoltativo): id del traguardo scelto, il client lo mostra sotto il nome (testo in @marea/content/diario.ts). */
/** La tua barca (#107): id dei colori di avatar.json `barca` per scafo e vela ('nessuna' = senza vela), nome già ripulito dal server. */
export type BarcaLook = { scafo: string; vela: string; nome: string };
/** `barca` (#107, facoltativo): assente = la barca di serie. `indossa` (#190, facoltativo): armatura, arma e frecce che si vedono addosso (id del catalogo); assente = niente. */
export type Peer = { id: string; nome: string; x: number; z: number; yaw: number; mode: Mode; anim: string; look: Look; titolo?: string; barca?: BarcaLook; indossa?: Indossa };
/** Look come sta in D1 (`persone.look`): più il titolo scelto nel diario (#87), che la Zone passa nel Peer. Niente migrazioni. */
export type LookSalvato = Look & { titolo?: string; barca?: BarcaLook; indossa?: Indossa };
/** Emote (PROTOCOL §3): le prime 4 da M1, le altre 4 dal #90. Un client vecchio scarta in silenzio quelle che non conosce. */
export type EmoteId = 'saluto' | 'esulta' | 'ride' | 'no' | 'applauso' | 'cuore' | 'sorpresa' | 'balla';
/** Feed (M1 · Fetta 3, PROTOCOL §4): righe scritte dal DO Sfide a ogni passaggio di stato, testo composto dal Worker con i nomi. */
/** `visita` (#86): un amico è passato sulla tua isola e ha firmato il libro degli ospiti (`da` = chi, `emote` = il suo saluto). */
export type FeedTipo = 'sfida_ricevuta' | 'sfida_accettata' | 'sfida_rifiutata' | 'sfida_scaduta' | 'sfida_chiusa' | 'visita' | 'record' | 'faro';
export type FeedItem = { id: number; quando: number; tipo: FeedTipo; testo: string; sfida?: string; da?: string; emote?: string; letto: boolean };

export type ClientMsg =
  | { t: 'hello'; v: number; build: string }
  | { t: 'pos'; x: number; z: number; yaw: number; mode: Mode; anim: string }
  | { t: 'ping'; c: number }
  | { t: 'emote'; id: EmoteId };

export type ErrorCode = 'versione' | 'token' | 'pieno' | 'interno';
export type ServerMsg =
  | { t: 'welcome'; now: number; you: { id: string; nome: string }; zone: string; peers: Peer[] }
  | { t: 'snap'; now: number; peers: Peer[] }
  | { t: 'join'; now: number; peer: Peer }
  | { t: 'leave'; now: number; id: string }
  | { t: 'pong'; c: number; now: number }
  | { t: 'emote'; now: number; id: EmoteId; from: string }
  | { t: 'error'; now: number; code: ErrorCode; msg: string };

/** Codici di chiusura WebSocket usati dal server (PROTOCOL.md §3). */
export const CLOSE = { ALTRO_DISPOSITIVO: 4000, TROPPO_GRANDE: 1009, ZONA_PIENA: 1013, TOKEN_O_VERSIONE: 1008, NON_VALIDO: 1003 } as const;

export const MAX_MSG_BYTES = 2048;
/** Messaggi del server (lato client): un `welcome` o uno `snap` con tutto il gruppo supera presto i 2 KB (#107: look, titolo e barca per peer). */
export const MAX_SERVER_MSG_BYTES = 65536;
export const MAX_ZONE_CONNECTIONS = 32;
export const POS_HZ = 10;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown, max = 64): v is string => typeof v === 'string' && v.length <= max;
const isMode = (v: unknown): v is Mode => v === 'walk' || v === 'boat';
export const EMOTE_IDS: readonly EmoteId[] = ['saluto', 'esulta', 'ride', 'no', 'applauso', 'cuore', 'sorpresa', 'balla'];
const EMOTES: readonly string[] = EMOTE_IDS;
/** `now` è in ogni messaggio del server; se manca (server vecchio) vale 0. */
const nowOf = (m: Record<string, unknown>): number => (isNum(m['now']) ? m['now'] : 0);

function parse(text: string, max = MAX_MSG_BYTES): Record<string, unknown> | null {
  if (text.length > max) return null;
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Valida un messaggio del client. null = scarta (e chiudi se recidivo). */
export function parseClientMsg(text: string): ClientMsg | null {
  const m = parse(text);
  if (!m) return null;
  switch (m['t']) {
    case 'hello':
      return isNum(m['v']) && isStr(m['build'], 32) ? { t: 'hello', v: m['v'], build: m['build'] } : null;
    case 'pos':
      return isNum(m['x']) && isNum(m['z']) && isNum(m['yaw']) && isMode(m['mode']) && isStr(m['anim'], 16)
        ? { t: 'pos', x: m['x'], z: m['z'], yaw: m['yaw'], mode: m['mode'], anim: m['anim'] }
        : null;
    case 'ping':
      return isNum(m['c']) ? { t: 'ping', c: m['c'] } : null;
    case 'emote':
      return isStr(m['id'], 16) && EMOTES.includes(m['id']) ? { t: 'emote', id: m['id'] as EmoteId } : null;
    default:
      return null;
  }
}

export function isPeer(v: unknown): v is Peer {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return isStr(p['id']) && isStr(p['nome']) && isNum(p['x']) && isNum(p['z']) && isNum(p['yaw']) && isMode(p['mode']) && isStr(p['anim'], 16) && !!p['look'];
}

/** Valida un messaggio del server (lato client). */
export function parseServerMsg(text: string): ServerMsg | null {
  const m = parse(text, MAX_SERVER_MSG_BYTES);
  if (!m) return null;
  switch (m['t']) {
    case 'welcome': {
      const you = m['you'] as Record<string, unknown> | undefined;
      return isNum(m['now']) && you && isStr(you['id']) && isStr(you['nome']) && isStr(m['zone']) && Array.isArray(m['peers']) && m['peers'].every(isPeer)
        ? { t: 'welcome', now: m['now'], you: { id: you['id'], nome: you['nome'] }, zone: m['zone'], peers: m['peers'] }
        : null;
    }
    case 'snap':
      return isNum(m['now']) && Array.isArray(m['peers']) && m['peers'].every(isPeer) ? { t: 'snap', now: m['now'], peers: m['peers'] } : null;
    case 'join':
      return isPeer(m['peer']) ? { t: 'join', now: nowOf(m), peer: m['peer'] } : null;
    case 'leave':
      return isStr(m['id']) ? { t: 'leave', now: nowOf(m), id: m['id'] } : null;
    case 'pong':
      return isNum(m['c']) && isNum(m['now']) ? { t: 'pong', c: m['c'], now: m['now'] } : null;
    case 'emote':
      return isStr(m['id'], 16) && EMOTES.includes(m['id']) && isStr(m['from']) ? { t: 'emote', now: nowOf(m), id: m['id'] as EmoteId, from: m['from'] } : null;
    case 'error':
      return isStr(m['code'], 16) && isStr(m['msg'], 200) ? { t: 'error', now: nowOf(m), code: m['code'] as ErrorCode, msg: m['msg'] } : null;
    default:
      return null;
  }
}
