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
Ogni messaggio del server porta `now` (ms del server). Limiti: `pos` più fitte di 45 ms (oltre ~20 Hz) ignorate; oltre 60 messaggi/s ignorati; messaggio > 2 KB → chiusura **1009**; 10 messaggi non validi → chiusura **1003**; 33ª connessione → `error pieno` + chiusura **1013**; token o versione sbagliati → `error` + chiusura **1008**; stessa persona connessa altrove → la vecchia connessione chiude con **4000** (il client non riconnette e mostra «MAREA è aperta su un altro dispositivo»). Costanti in `packages/protocol` `CLOSE`. Presenza: il server accumula le `pos` e manda uno `snap` al massimo ogni 100 ms con i soli peer cambiati (nessuno snap se nessuno si muove).

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

### Aggiunte M1 · Fetta 1 (30 set 2026)
| Metodo e percorso | Corpo → risposta |
|---|---|
| `GET /api/me` | → `{ id, nome, look, slot: number \| null, now, lotto: LotState }` (**nuovi** `slot`, `now`) |
| `GET /api/persone` | → `{ id, nome, slot, look }[]` tutti (per scegliere chi sfidare) — **nuovo** |
| `GET /api/lots` | → come sopra ma solo chi ha un lotto (`slot` ≠ null), in ordine di slot — **nuovo** (lo usa `net/api.ts` di M1-isola) |
| `POST /api/look` | `Look` → `{ ok }`; **400** se `cappello` è a Perle e non è in `lotto.posseduti` |
| `POST /api/look/hat` | `{ cappello: indice \| id }` → `LotState` (compra, una volta; 409 `{error, manca}` senza Perle o già tuo) — **nuovo** |
| `POST /api/lot/build` | `{ building, cell }`: **400** se la cella non è una `L` del template `lotto`, 409 se occupata |
| `POST /api/lot/decor` | `{ decor, cell, rot: 0-3 }` → `LotState`; prezzo da `DECOR` (Perle); **400** se la cella non è sabbia `.`/erba `g` del template (niente `L`, molo `d`, spawn `P`), 409 se occupata o senza Perle |
| `GET /api/challenges` | → `Challenge[]` (in gioco, mandate e ricevute, + chiuse degli ultimi 7 giorni; max 50, recenti prima) |
| `POST /api/challenges` | `{ minigame, to, stake }` → `Challenge` (stato `gioca_sfidante`, `seed` e `difficulty` dal server; posta dello sfidante in escrow) |
| `POST /api/challenges/:id/play` | `{ inputs: PackedInputs }` → `{ score, medal, detail, challenge }` (replay lato server; tocca a `from` in `gioca_sfidante`, a `to` in `accettata`) |
| `POST /api/challenges/:id/accept` · `/decline` | (corpo vuoto ok) → `Challenge`. Accettare si può solo dopo che lo sfidante ha giocato (`aperta`) |
Errori: `{ error, manca?, code? }`; 400 richiesta rotta/cella non ammessa/posta sotto il minimo, 403 sfida non tua o azione non tua, 404 sfida/persona, 409 turno sbagliato, sfida chiusa/scaduta, niente Tavolo, oltre il tetto, risorse (con `manca`).

**Macchina a stati** (GDD §7): `gioca_sfidante` → (from gioca) `aperta` → (to accetta, posta pari in escrow) `accettata` → (to gioca) `chiusa` {`winner`: `from`|`to`|`pari`, `pot`}. Da `gioca_sfidante`/`aperta`: `decline` → `rifiutata`. Dopo 24 h dalla creazione ogni sfida in gioco → `scaduta`. Rifiutata/scaduta/pari = rimborso. **Colpo di coda** deciso all'accettazione (risorse+escrow di `to` < 50 % di `from`), vale solo se vince `to` (piatto 1,5×, il bonus lo «genera» il banco nel libro mastro). Perle **solo a sfida chiusa**: `max(medaglia 5/10/20, 2)` a entrambi (anche in parità), Faro a chi vince. Niente Perle su rifiuto/scadenza (così non si «coltivano» sfide finte). Le Perle extra oltre le sfide gratis del giorno non si rimborsano.

Nuovi campi facoltativi di `LotState`: `posseduti?: string[]` (cappelli a Perle comprati), `holds?: Record<idSfida, Resources>` (escrow = la loro somma), `settled?: string[]` (idempotenza).

**Orologio di test**: con `wrangler dev --var TEST_CLOCK:1` e richieste da localhost, l'header `X-Test-Now-Offset: <ms>` sposta «adesso» per quella richiesta (usarlo monotono). In produzione è ignorato.

## 5. Input log compresso (`PackedInputs`)
Array di run-length: `[[ticks, mx, my, a, b], ...]` con `mx, my` quantizzati a 1/32 e `a, b` 0/1. Una Regata da 60 s pesa < 4 KB. Il replay è `replay(minigame, seed, difficulty, inputs)` in `packages/sim/src/replay.ts`.

## 6. Errori
Sempre `{ error: string }` in italiano con status HTTP giusto: 400 richiesta rotta, 401 token, 403 non tuo, 404, 409 conflitto (cantiere già in corso, risorse insufficienti: `{ error, manca: Resources }`), 413 troppo grande, 429 troppi messaggi, 500 interno (mai il dettaglio tecnico al client).
