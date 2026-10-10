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
{ t: 'emote', id: EmoteId }                                          // M1 (8 emote dal #90, vedi sotto)

// server → client
{ t: 'welcome', now: number, you: { id: string, nome: string }, zone: string, peers: Peer[] }
{ t: 'snap', now: number, peers: Peer[] }                            // 10 Hz, solo i peer cambiati
{ t: 'join', peer: Peer } · { t: 'leave', id: string }
{ t: 'pong', c: number, now: number }
{ t: 'emote', id: string, from: string }                             // M1
{ t: 'error', code: 'versione'|'token'|'pieno'|'interno', msg: string }   // msg in italiano

type Peer = { id: string, nome: string, x: number, z: number, yaw: number, mode: 'walk'|'boat', anim: string, look: Look }
type Look = { pelle: number, capelli: number, coloreCapelli: number, vestito: number, cappello: number }   // indici in avatar.json
type EmoteId = 'saluto'|'esulta'|'ride'|'no'|'applauso'|'cuore'|'sorpresa'|'balla'   // EMOTE_IDS in packages/protocol; ordine = tasti 1-8
```
**Emote (#90, 8 ott 2026)**: da 4 a 8 (`applauso`, `cuore`, `sorpresa`, `balla` in coda), stesso messaggio, `PROTOCOL_VERSION` invariata. Retrocompatibile: la Zone accetta e inoltra le 8; un client vecchio che riceve un id che non conosce lo scarta in silenzio (`parseServerMsg` → null, niente errore né chiusura) e le sue 4 continuano a passare. Un id fuori elenco dal client resta un messaggio non valido (conta per la chiusura 1003). Client e Zone vanno online insieme (stesso deploy).
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
| `GET /api/feed` | → `{ items: FeedItem[], nonLetti, now }` | M1 · Fetta 3 (era M2) |
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
| `POST /api/solo/start` | `{ minigame }` → `{ minigame, seed, difficulty, lot }`: partita da solo aperta nel DO del lotto (`LotState.solo.pending`; la nuova sostituisce la vecchia). 400 se il minigioco non esiste — **nuovo (Sessione 5)** |
| `POST /api/solo/play` | `{ inputs: PackedInputs }` → `{ score, medal, detail, premio, premiata, lot }`: replay lato server col seed aperto, premio da `balance.solo` (zero oltre le partite premiate del giorno). 409 senza partita aperta, 400 se gli input non sono validi — **nuovo (Sessione 5)** |
Errori: `{ error, manca?, code? }`; 400 richiesta rotta/cella non ammessa/posta sotto il minimo, 403 sfida non tua o azione non tua, 404 sfida/persona, 409 turno sbagliato, sfida chiusa/scaduta, niente Tavolo, oltre il tetto, risorse (con `manca`).

**Macchina a stati** (GDD §7): `gioca_sfidante` → (from gioca) `aperta` → (to accetta, posta pari in escrow) `accettata` → (to gioca) `chiusa` {`winner`: `from`|`to`|`pari`, `pot`}. Da `gioca_sfidante`/`aperta`: `decline` → `rifiutata`. Dopo 24 h dalla creazione ogni sfida in gioco → `scaduta`. Rifiutata/scaduta/pari = rimborso. **Colpo di coda** deciso all'accettazione (risorse+escrow di `to` < 50 % di `from`), vale solo se vince `to` (piatto 1,5×, il bonus lo «genera» il banco nel libro mastro). Perle **solo a sfida chiusa**: `max(medaglia 5/10/20, 2)` a entrambi (anche in parità), Faro a chi vince. Niente Perle su rifiuto/scadenza (così non si «coltivano» sfide finte). Le Perle extra oltre le sfide gratis del giorno non si rimborsano.

Nuovi campi facoltativi di `LotState`: `posseduti?: string[]` (cappelli a Perle comprati), `holds?: Record<idSfida, Resources>` (escrow = la loro somma), `settled?: string[]` (idempotenza).

**Orologio di test**: con `wrangler dev --var TEST_CLOCK:1` e richieste da localhost, l'header `X-Test-Now-Offset: <ms>` sposta «adesso» per quella richiesta (usarlo monotono). In produzione è ignorato.

### Aggiunte M1 · Fetta 3 (30 set 2026)
| Metodo e percorso | Corpo → risposta |
|---|---|
| `POST /api/look` | come prima; **in più** il Worker avvisa il DO `Zone('porto')` (richiesta interna `POST https://zone/look`, `x-persona`, corpo `Look` validato) che aggiorna il look del peer e lo manda nel prossimo `snap`. Best-effort: se l'avviso fallisce la risposta è comunque `{ ok }`. Nessun messaggio WebSocket nuovo, `PROTOCOL_VERSION` resta 1 |
| `GET /api/feed` | → `{ items: FeedItem[], nonLetti: number, now }`: ultime 30 novità, le più recenti prima — **nuovo** |
| `POST /api/feed/letto` | `{ fino?: number }` → `{ ok, nonLetti }`: segna letti gli id ≤ `fino` (tutti senza `fino`) — **nuovo** |

`FeedTipo = 'sfida_ricevuta' | 'sfida_accettata' | 'sfida_rifiutata' | 'sfida_scaduta' | 'sfida_chiusa'` · `FeedItem = { id: number; quando: number; tipo: FeedTipo; testo: string; sfida?: string; da?: string; letto: boolean }` (in `packages/protocol`). Le righe le scrive il DO `Sfide` a ogni passaggio di stato (niente riga alla creazione: lo sfidato viene avvisato quando lo sfidante ha giocato); il `testo` in italiano lo compone il Worker in lettura con i nomi delle persone. Emote: la Zone inoltra al massimo una emote ogni 800 ms per connessione, senza eco a chi la manda.

### Aggiunte Porto (#63-#65, 8 ott 2026)
| Metodo e percorso | Corpo → risposta |
|---|---|
| `POST /api/missioni/riscuoti` | `{ i: 0-2 }` → `{ premio: Resources, missione, lot: LotState }`: RISCUOTI una missione della Bacheca compiuta oggi (giorno UTC). 409 `{ error, code: 'missione' }` se non è compiuta o è già riscossa, 404 se l'indice non esiste, 400 se `i` non è un intero — **nuovo** |

Le missioni di oggi non hanno una GET: client e server le calcolano dal lotto con `missioniOf(lot, now)` di `@marea/sim/economy/missioni.ts` (seed = giorno + persona). Nuovo campo facoltativo di `LotState`: `missioni?: { day, prog: Record<tipo, number>, riscosse: number[] }`, aggiornato dal DO del lotto dopo `collect`, `build`, `upgrade`, `decor`, `hat`, `solo/play`, `dungeon/finish`. `POST /api/look/hat` vale anche per i cappelli esclusivi del Mercante (`mercante: true`).

### Aggiunte Rientro e libro degli ospiti (#86, 8 ott 2026)
| Metodo e percorso | Corpo → risposta |
|---|---|
| `POST /api/rientro` | `{}` → `{ riepilogo: Riepilogo \| null, novita: number, lot: LotState, now }`: all'avvio del client. Il DO del lotto confronta `lot.visto` con adesso: oltre `RIENTRO.sogliaMinuti` manda il riepilogo dell'assenza (`assenteMs`, `depositi`, `cantiere` finito, `ospiti` = firme arrivate, `ospitiTot`, `missioniNuove`), null al primo ingresso o dopo poco; poi `visto = adesso`. `novita` = righe del feed non lette che non sono visite — **nuovo** |
| `POST /api/presenza` | `{}` → `{ ok, now }`: «ci sono» del client ogni `RIENTRO.presenzaSecondi` a scheda visibile (l'assenza si misura da quando esci) — **nuovo** |
| `POST /api/libro/firma` | `{ isola: idProprietario, emote }` → `LotState` dell'isola firmata. Nome dal link di chi firma, `emote` di `avatar.json`. 400 isola o saluto non validi, 404 isola inesistente, 409 `{ error, code: 'firma' }` sul proprio libro o se hai già firmato oggi (giorno UTC). Il libro tiene le ultime `RIENTRO.firme.tetto` firme; il proprietario riceve nel feed una riga `visita` — **nuovo** |

Nuovi campi facoltativi di `LotState`: `visto?`, `ospiti?: { chi, nome, emote, quando }[]`, `finito?: { building, level, endsMs }` (ultimo cantiere chiuso da `advance`). `FeedTipo` + `'visita'` e `FeedItem.emote?` (il saluto della firma). Il campanello del feed ora c'è anche senza `?sfide=1`. `PROTOCOL_VERSION` resta 1.
### Aggiunte Diario del capitano (#87, 8 ott 2026)
| Metodo e percorso | Corpo → risposta |
|---|---|
| `POST /api/diario/visto` | `{ animali?: string[], isole?: string[] }` (≤ 20 a lista) → `{ nuovi: { animali, isole }, lot }`: avvistamenti dal client. Si tengono solo id dei cataloghi (`diario.json` animali; isole dell'arcipelago che non sono lotti; `lotto:<persona>` solo di un'altra persona con un'isola, lo controlla il Worker), una volta. 400 se le liste non sono liste di stringhe — **nuovo** |
| `POST /api/diario/riscuoti` | `{ id }` → `{ premio: Resources, traguardo, lot }`: RISCUOTI un traguardo compiuto (Perle nel lotto e nel libro mastro, una volta). 409 `{ error, code: 'traguardo' }` se non è compiuto o è già riscosso, 404 se non esiste — **nuovo** |
| `POST /api/diario/titolo` | `{ id: string \| null }` → `LotState`: titolo sotto il nome (id di un traguardo **riscosso**; null lo toglie). 409 se non è riscosso, 404 se non esiste. Il Worker lo scrive anche nel look in D1 (`look.titolo`) e avvisa la Zone come `POST /api/look` — **nuovo** |

Nuovo campo facoltativo di `LotState`: `diario?: { pesci, perle, medaglie, giocati, animali, isole, dungeon, riscossi, titolo }` (`DiarioState` in `economy/types.ts`). Pesci, perle (per tipo), medaglia migliore e partite li scrive `solo/play` dopo il replay; le spedizioni `dungeon/finish`. `GET /api/lot/:id` lo dà anche per gli altri (diario degli amici in sola lettura). `GET /api/me` e `/api/lots` hanno `look.titolo` se scelto; `POST /api/look` non lo tocca.
**Presenza**: `Peer.titolo?: string` (id del traguardo; il client lo traduce col testo di `traguardi.json`). Arriva nel `welcome`/`join` (dal look in D1) e negli `snap` dopo un cambio di titolo. Campo facoltativo: `PROTOCOL_VERSION` resta 1.

### Aggiunte Decorazioni libere (#108, 8 ott 2026)
| Metodo e percorso | Corpo → risposta |
|---|---|
| `POST /api/lot/decor/move` | `{ id, cell }` → `LotState`: sposta una decorazione della tua isola. Stesse celle di `POST /api/lot/decor` (sabbia `.`/erba `g`, non il leggio del libro degli ospiti `RIENTRO.libro.lotto` né le decorazioni fisse del template); **400** cella non ammessa o rotta, **409** `{ code: 'cella' }` se occupata, **404** id che non c'è. Nella stessa cella: niente da fare — **nuovo** |
| `POST /api/lot/decor/rotate` | `{ id }` → `LotState`: un quarto di giro (`rot` 0 → 1 → 2 → 3 → 0) — **nuovo** |
| `POST /api/lot/decor/sell` | `{ id }` → `LotState`: la decorazione sparisce e tornano `floor(prezzo × BALANCE.decor.rimborso)` Perle (metà, per difetto), scritte nel libro mastro come entrata — **nuovo** |

`PlacedDecor.rot` diventa facoltativo (assente = 0: i lotti salvati restano validi; `rot` 0 non si scrive più). Le isole degli altri restano in sola lettura (il DO è quello della persona del token). Nessuna migrazione, `PROTOCOL_VERSION` resta 1.

### Aggiunte La tua barca (#107, 8 ott 2026)
| Metodo e percorso | Corpo → risposta |
|---|---|
| `POST /api/barca` | `{ scafo, vela, nome? }` → `{ ok, barca }`: colori = id di `avatar.json` `barca.colori` (`vela` anche `'nessuna'`), nome ripulito dal server (lettere senza accenti, cifre, spazio, `' . ! ? -`, max `barca.nomeMax` = 14). 400 se un colore non esiste o è esclusivo e non è in `lotto.posseduti`. Il Worker la scrive nel look in D1 (`LookSalvato.barca`; la barca di serie non si scrive) e avvisa la Zone come `POST /api/look` — **nuovo** |
| `POST /api/barca/colore` | `{ id }` → `LotState`: compra un colore esclusivo (`mercante: true`), una volta; in `posseduti` come `"barca:<id>"`. 400 sconosciuto, 409 `{ error, manca }` senza Perle, 409 se è gratis o già tuo. Conta per la missione `mercante` — **nuovo** |

`POST /api/look` e `POST /api/diario/titolo` conservano la barca salvata; `GET /api/me` e `/api/lots` la danno nel `look`. **Presenza**: `Peer.barca?: { scafo, vela, nome }` (assente = di serie), nel `welcome`/`join` dal look in D1 e negli `snap` dopo un cambio. Il client accetta messaggi del server fino a `MAX_SERVER_MSG_BYTES` = 64 KB (quelli del client restano ≤ 2 KB). `PROTOCOL_VERSION` resta 1.

### Aggiunte Porto tra amici (#110 #111, 8 ott 2026)
| Metodo e percorso | Corpo → risposta |
|---|---|
| `POST /api/solo/play` | come prima, **in più** `minigame` e `record: { oggi, sempre } \| null` (la partita è il migliore di oggi / di sempre). Il Worker manda il punteggio rigiocato dal DO del lotto al tabellone (DO `Sfide`, best-effort) |
| `GET /api/record` | → `{ voci: { minigame, nome, oggi: RecordVista \| null, sempre: RecordVista \| null }[] }`, una voce per minigioco di `diario.json`; `RecordVista = { chi, nome, score, medal, detail, quando }`. «Oggi» = giorno UTC — **nuovo** |
| `GET /api/faro` | → `{ faro: FaroVista }`, `FaroVista = { legno, pietra, livello, max, livelli: ms[], bonus, prossimo: { livello, legno, pietra, bonus } \| null, classifica: { id, nome, legno, pietra }[] }` — **nuovo** |
| `POST /api/faro/versa` | `{ legno?, pietra? }` → `{ faro: FaroVista, saliti: number[], dono: { legno, pietra }, lot: LotState }`: il versamento è dosato (interi ≥ 0, mai oltre quello che manca al faro completo); il Magazzino paga (409 `{ error, manca }` se non basta), il faro conta. 400 `{ code: 'faro' }` se non c'è niente da versare, 409 `{ code: 'faro' }` a faro completo — **nuovo** |

`FeedTipo` + `'record'` («Mia ha battuto il tuo record alla Regata», a chi perde il record di sempre) e `'faro'` («Il Faro del Porto è salito al livello 2, grazie a Luca: Segherie e Cave +10 % per tutti», a chi ha un'isola). Nuovo campo facoltativo di `LotState`: `faro?: { livelli: ms[], versato: { legno, pietra }, doni: id[] }` (momenti delle salite del faro, quanto ha versato l'isola, ultimi versamenti per l'idempotenza). `POST /api/rientro` porta al lotto i livelli del faro se se li era persi. `PROTOCOL_VERSION` resta 1.

### Aggiunte Armature e armi a vista (#190, 10 ott 2026)
**Presenza**: `Peer.indossa?: { corpo?, arma?, frecce? }` = id del catalogo GDR di quello che si vede addosso (armatura o veste, arma di mischia o arco, frecce); assente = niente. Come `titolo` e `barca` arriva nel `welcome`/`join` (dal look in D1) e negli `snap` dopo un cambio. **Non lo manda il client**: lo ricava il Worker dal personaggio vero (`heroOf(lotto).equip`; senza personaggio salvato vale l'equipaggiamento di partenza) a ogni `GET /api/me`, `GET /api/lot`, `POST /api/rpg` e `POST /api/dungeon/finish|save`; se è cambiato lo scrive nel look in D1 (`LookSalvato.indossa`) e avvisa la Zone come `POST /api/look`. `POST /api/look`, `/api/diario/titolo` e `/api/barca` lo conservano e non lo leggono dal corpo (nessuno si vede addosso quello che non ha). La Zone scarta gli id che non esistono o non stanno nello slot giusto (`indossaValida` in `@marea/sim/rpg/indossa.ts`). Niente migrazioni; `GET /api/me` e `/api/lots` lo danno nel `look`. `PROTOCOL_VERSION` resta 1.

## 5. Input log compresso (`PackedInputs`)
Array di run-length: `[[ticks, mx, my, a, b], ...]` con `mx, my` quantizzati a 1/32 e `a, b` 0/1. Una Regata da 60 s pesa < 4 KB. Il replay è `replay(minigame, seed, difficulty, inputs)` in `packages/sim/src/replay.ts`.

## 6. Errori
Sempre `{ error: string }` in italiano con status HTTP giusto: 400 richiesta rotta, 401 token, 403 non tuo, 404, 409 conflitto (cantiere già in corso, risorse insufficienti: `{ error, manca: Resources }`), 413 troppo grande, 429 troppi messaggi, 500 interno (mai il dettaglio tecnico al client).

## 7. Dungeon insieme (#118, 8 ott 2026)
Squadre all'ingresso dei dungeon e spedizioni in tempo reale: **WebSocket** `/ws/squadra/<dungeon>?t=<token>` → DO `Spedizioni` (un'istanza sola, `idFromName('spedizioni')`, socket normali senza ibernazione). Tipi e parser in `packages/protocol/src/squadra.ts` (`SqClientMsg`, `SqServerMsg`, `parseSqClient`, `parseSqServer`, `SQ_TURNO_MS` = 50, `SQ_TICKS` = 3). `PROTOCOL_VERSION` resta 1 (canale nuovo, la Zone non cambia).
```ts
// client → server
{ t: 'via' }                                 // SCENDIAMO: chiunque della squadra, con almeno 2 membri
{ t: 'carico' }                              // dungeon caricato: il primo turno parte quando l'hanno detto tutti (o dopo 20 s)
{ t: 'in', f: [mx8, my8, bit, mira?] }       // input per i prossimi turni (solo se cambia: il server ripete l'ultimo); bit = a|b<<1|c<<2|d<<3 (c = alterna arma/magia in mano); mira = indice d'angolo 1..240 del mouse, solo mentre punta (v6)
{ t: 'az', a: DungeonAzione }                // equip, butta, salva, esci (mai `ritira`): va nel prossimo turno
{ t: 'esco' }                                // esco dalla squadra o dalla spedizione

// server → client
{ t: 'squadra', dungeon, membri: { id, nome }[], max }                        // la squadra all'ingresso, a ogni cambio
{ t: 'parte', run, dungeon, seed, io, eroi: { id, nome, look, hero: RunHero, stato: HeroState | null }[] }   // si scende; io = il mio indice
{ t: 'T', n, f: [mx8, my8, bit][], az?: [eroe, DungeonAzione][] }             // turno n: un input per eroe (in ordine), azioni prima del primo tick
{ t: 'errore', msg }                                                          // squadra piena, da soli, non si parte…
```
- **Squadra**: aprire il socket = entrare nella squadra di quel dungeon (al massimo `RPG.dungeon.gruppo.max` = 4, la 5ª riceve `errore` e chiusura 1013). La stessa persona da un'altra scheda sostituisce la vecchia. Chiudere il socket o `esco` = uscire. Il client chiude da solo se ci si allontana dall'ingresso.
- **Partenza**: con `via` il DO sceglie seed e id della spedizione e per ogni membro chiama il DO del suo lotto (`POST /dungeon_party_start {dungeon, seed, run, idx}` → `{hero, stato, lot}`: fotografia dell'eroe e `pending.party = {run, idx}`; mai esposta dal Worker). Se un lotto fallisce la squadra resta all'ingresso con un `errore`.
- **Turni**: ogni 50 ms (a tempo di orologio: un timer in ritardo recupera fino a 10 turni) un turno con l'input più vecchio in coda di ciascuno, o l'ultimo se la coda è vuota (chi è uscito: fermo); un turno vale 3 tick della sim. Coda oltre 4 input: i più vecchi si scartano tenendo i bottoni premuti. Al massimo 40 messaggi/s per socket, 390 azioni per eroe. Chi esce: azione `ritira` nel turno dopo (per lui la spedizione finisce senza esito, gli altri continuano). Finito il tempo (`maxTicks`) il DO chiude i socket.
- **Client**: la sim avanza solo coi turni (stessi input e azioni = stessa partita per tutti); il mio input va una volta per turno (joystick dell'ultimo tick, bottoni premuti in qualunque tick del turno). Cuscinetto di 2 turni contro i ritardi, recupero di corsa dopo uno stacco.
- **Fine**: il client chiude il socket e chiama `POST /api/dungeon/finish` (corpo qualunque): il DO del lotto, vedendo `pending.party`, chiede il log al DO Spedizioni (`POST /log {run, idx}` → `{dungeon, seed, eroi, inputs: string[] (encodeDungeon), azioni}`; da quel momento l'eroe idx è fuori), lo rigioca con `replayParty` e applica l'esito del suo eroe come una spedizione da solo (stessa risposta). Log salvati nello storage del DO (ogni 10 s e a fine spedizione, tenuti un giorno): se il DO si riavvia a metà, la spedizione si chiude dove era arrivata. Senza log (perso) la spedizione si chiude senza niente (409 `code: 'gruppo'`). Una spedizione insieme rimasta aperta si chiude alla discesa dopo (`dungeon_start`). `POST /api/dungeon/save` insieme non serve (409).

## 8. Corse tra amici (10 ott 2026)
Gara in tempo reale tra amici, a fantasmi (niente urti tra amici): **WebSocket** `/ws/gara?t=<token>` → DO `GaraAmici` (una sala sola, `idFromName('garaamici')`, socket normali senza ibernazione). Tipi e parser in `packages/protocol/src/gara_amici.ts` (`GaClientMsg`, `GaServerMsg`, `GaMembro`, `GaPos`, `parseGaClient`, `parseGaServer`, `GA_MAX` = 6, `GA_POS_MS` = 80). `PROTOCOL_VERSION` resta 1 (canale nuovo).
```ts
// client → server
{ t: 'ciao', veicolo }                       // entro in sala o cambio veicolo (id di CORSE.veicoli; sconosciuto → 'kart', che è anche il default)
{ t: 'via', pista, bot? }                    // VIA: chiunque in sala, pista della Spiaggia (id in CORSE_PISTE che comincia con 'spiaggia_'); bot: true = anche gli animali piloti
{ t: 'p', q: GaPos }                         // la mia posizione, ~ogni 80 ms: [prog, ramo, s, lat, h, hf, hl, v, drift, giro, caduto]
{ t: 'fine', ms }                            // sono arrivato (ms di gara ≥ 0) o mi ritiro (−1)
{ t: 'esco' }                                // esco dalla sala

// server → client
{ t: 'sala', membri: GaMembro[], max, gara: { pista, membri: id[] } | null }   // a ogni cambio, a tutti; GaMembro = { id, nome, look, veicolo }
{ t: 'parte', gara, pista, seed, io, membri: GaMembro[], bot }                  // si parte: membri in ordine di griglia, io = il mio posto, bot = coi bot
{ t: 'p', i, q: GaPos }                                                         // posizione del corridore i (indice in `membri` di `parte`)
{ t: 'fine', i, ms }                                                            // il corridore i è arrivato (ms) o si è ritirato (−1)
{ t: 'errore', msg }                                                            // sala piena, da soli, pista sbagliata, gara in corso
```
- **Sala**: aprire il socket = entrare (in ordine di entrata, che è l'ordine di griglia). Al massimo 6: il 7° riceve `errore` («La sala è piena (6)») e chiusura 1013. La stessa persona da un'altra scheda sostituisce la vecchia (se era in gara, conta come uscita). Chiudere il socket o `esco` = uscire.
- **Partenza**: una gara alla volta. `via` con una gara in corso → `errore` («C'è già una gara in corso: aspetta che finisca»); con meno di 2 in sala → `errore` («Servono almeno 2 amici in sala»). Altrimenti il DO sceglie id (UUID) e seed (0…2³²−1), i corridori sono tutti quelli in sala, e ognuno riceve `parte` col suo `io`; poi la sala con `gara`. Chi entra in sala durante una gara aspetta la prossima.
- **In gara**: ognuno corre la sua sim locale col seed comune, coi suoi 4 bot se `bot` (11 ott, #199: i bot sono di ognuno, come da solo; gli amici partono dietro ai bot, il posto `io` dopo di loro); `p` va agli altri corridori col suo indice (al massimo 25 `p` al secondo per socket, gli altri si scartano). `fine` va agli altri; un secondo `fine` è ignorato. Chi è arrivato resta collegato e riceve ancora `p` e `fine` degli altri finché la gara è in corso. Chi esce senza aver finito conta come `fine` −1 per gli altri; chi esce dopo il suo arrivo no (l'arrivo resta). Quando tutti hanno finito (arrivati o ritirati) la gara si chiude: sala con `gara: null`. Rete di sicurezza: una gara aperta da più di 8 minuti si chiude da sola.
- **Esito**: il server della gara non dà premi né rigioca niente; ognuno chiude la sua corsa come una partita da solo (rigiocata dal DO del suo lotto).
- **Abusi**: messaggi oltre 512 caratteri o non validi si scartano; 10 non validi di fila → chiusura 1003. Al massimo 40 messaggi al secondo (oltre ai `p`).
