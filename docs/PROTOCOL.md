# MAREA — Protocollo client ↔ server

> Indipendente da Three e da Cloudflare. I tipi vivono in `packages/protocol/src/`. `PROTOCOL_VERSION = 1`. Un client con versione diversa riceve `error {code:'versione'}` e ricarica.

## 1. Trasporto
- **HTTP** `/api/*` (JSON, `X-Token` header dopo il primo accesso, `cache-control: no-store`).
- **WebSocket** `/ws/zone/<zoneId>?t=<token>` → Durable Object `Zone` (una stanza per zona: `porto`, `lotto:<personaId>`). Testo JSON, un messaggio per riga. Il server usa la Hibernation API: nessun ping applicativo, il client manda `ping` solo per stimare l'orologio.
- Riconnessione: backoff 1, 2, 4, 8 s (max 30); dopo `welcome` lo stato viene rimandato intero (`snap` completo). Nessuno stato locale va perso: l'economia è tutta sul server.

## 2. Autorità
| Cosa | Chi decide |
|---|---|
| Posizione, direzione, animazione del **proprio** avatar/barca | client (inviata a 10 Hz, il server la ritrasmette senza giudicare, con clamp ai confini della zona) |
| Ora | server (`now` in ogni `welcome`, `snap`, `pong`) |
| Economia, edifici, timer, sfide, ledger, Perle | server (DO `Lot`) |
| Esito di un minigioco | server, via replay dell'input log nella `sim` |

## 3. Messaggi WebSocket (V1 = M0/M1)
```ts
// client → server
{ t: 'hello', v: 1, build: string }                                  // subito dopo la connessione (token già nell'URL)
{ t: 'pos', x: number, z: number, yaw: number, mode: 'walk'|'boat', anim: string }   // 10 Hz, solo se cambiato
{ t: 'ping', c: number }                                             // c = performance.now() del client
{ t: 'emote', id: 'saluto'|'esulta'|'ride'|'no' }                    // M1

// server → client
{ t: 'welcome', now: number, you: { id: string, nome: string }, zone: string, peers: Peer[] }
{ t: 'snap', now: number, peers: Peer[] }                            // 10 Hz, solo i peer cambiati
{ t: 'join', peer: Peer } · { t: 'leave', id: string }
{ t: 'pong', c: number, now: number }
{ t: 'emote', id: string, from: string }                             // M1
{ t: 'error', code: 'versione'|'token'|'pieno'|'interno', msg: string }   // msg in italiano

type Peer = { id: string, nome: string, x: number, z: number, yaw: number, mode: 'walk'|'boat', anim: string, look: Look }
type Look = { pelle: number, capelli: number, coloreCapelli: number, vestito: number, cappello: number }   // indici in avatar.json
```
Limiti: `pos` oltre 20 Hz viene ignorato; messaggi > 2 KB chiudono la connessione; una zona accetta al massimo 32 connessioni (`error pieno`).

## 4. HTTP (V1)
| Metodo e percorso | Corpo → risposta | Tappa |
|---|---|---|
| `GET /api/ping` | → `{ ok: true, build, now }` | M0 |
| `GET /api/me` | `X-Token` → `{ id, nome, look, lotto: LotState }` | M1 |
| `POST /api/look` | `Look` → `{ ok }` | M1 |
| `GET /api/lot` · `GET /api/lot/:id` | → `LotState` (proprio / altrui, sola lettura) | M1 |
| `POST /api/lot/collect` | `{ building }` → `LotState` | M1 |
| `POST /api/lot/build` | `{ building, cell }` → `LotState` (spesa + timer) | M1 |
| `POST /api/lot/upgrade` | `{ building }` → `LotState` | M1 |
| `POST /api/lot/decor` | `{ decor, cell, rot }` → `LotState` | M1 |
| `GET /api/challenges` | → `Challenge[]` (aperte, ricevute, chiuse recenti) | M1 |
| `POST /api/challenges` | `{ minigame, to, stake: Resources }` → `Challenge` (seed dal server) | M1 |
| `POST /api/challenges/:id/play` | `{ inputs: PackedInputs }` → `{ score, medal, challenge }` (replay lato server) | M1 |
| `POST /api/challenges/:id/accept` · `/decline` | → `Challenge` | M1 |
| `GET /api/feed` | → `FeedItem[]` | M2 |
| `POST /api/passkey/*` | WebAuthn | M1 (opzionale) |

`LotState`, `Resources`, `Challenge`, `PackedInputs` sono definiti in `packages/sim/src/economy/types.ts` e `packages/sim/src/minigames/types.ts` e ri-esportati da `@marea/protocol`.

## 5. Input log compresso (`PackedInputs`)
Array di run-length: `[[ticks, mx, my, a, b], ...]` con `mx, my` quantizzati a 1/32 e `a, b` 0/1. Una Regata da 60 s pesa < 4 KB. Il replay è `replay(minigame, seed, difficulty, inputs)` in `packages/sim/src/replay.ts`.

## 6. Errori
Sempre `{ error: string }` in italiano con status HTTP giusto: 400 richiesta rotta, 401 token, 403 non tuo, 404, 409 conflitto (cantiere già in corso, risorse insufficienti: `{ error, manca: Resources }`), 413 troppo grande, 429 troppi messaggi, 500 interno (mai il dettaglio tecnico al client).
