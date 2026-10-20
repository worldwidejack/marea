// Pezzi in comune delle sale in tempo reale (Arena, gara tra amici, Templari insieme, spedizioni nei dungeon):
// chi entra, l'apertura della socket, il limitatore dei messaggi e la coda degli input.
import type { Look } from '@marea/protocol';
import type { SqInput } from '@marea/protocol/squadra.ts';

const LOOK_BASE: Look = { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 1 };

/** Chi entra, dall'URL della socket: id, nome e look (quello di base se manca o è rotto). */
export function ospite(url: URL): { id: string; nome: string; look: Look } {
  let look: Look = { ...LOOK_BASE };
  try { const l = JSON.parse(url.searchParams.get('look') ?? '{}') as Look; if (l && typeof l === 'object') look = { ...look, ...l }; } catch { /* look di base */ }
  return { id: url.searchParams.get('id') ?? '', nome: url.searchParams.get('nome') ?? 'Ospite', look };
}

/** Apre la socket dal lato del server: `server` è la nostra, `fatto` la risposta 101 da restituire al Worker. */
export function apriSocket(): { server: WebSocket; fatto: Response } {
  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]];
  server.accept();
  return { server, fatto: new Response(null, { status: 101, webSocket: client }) };
}

/** Chiude una socket che potrebbe essere già chiusa. */
export function chiudi(ws: WebSocket, codice: number, perche: string): void { try { ws.close(codice, perche); } catch { /* chiusa */ } }

/** Il conto dei messaggi di una connessione nel secondo `s`. */
export type Contatore = { s: number; n: number };
/** Limitatore: al massimo `max` messaggi al secondo; false = questo si ignora (non si chiude: un telefono lento manda a raffiche). */
export function passa(c: Contatore, max: number, ora = Date.now()): boolean {
  const sec = Math.floor(ora / 1000);
  if (sec !== c.s) { c.s = sec; c.n = 0; }
  return ++c.n <= max;
}

/** Mette un input nella coda di un giocatore: oltre `max` il più vecchio si fonde nel successivo senza perdere i tasti premuti
 *  (e, con `mira`, la mira se il successivo non ne ha una). */
export function accoda(coda: SqInput[], f: SqInput, max: number, mira = false): void {
  coda.push(f);
  while (coda.length > max) {
    const old = coda.shift()!, h = coda[0]!;
    h[2] |= old[2];
    if (mira && old[3] && !h[3]) h[3] = old[3];
  }
}
