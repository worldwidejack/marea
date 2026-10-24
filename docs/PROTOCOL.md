# MAREA — Protocollo tra gioco e server

> I principi e dove stanno i messaggi. Il dettaglio è nel codice: i tipi dei WebSocket in `packages/protocol/src/`, le rotte HTTP in `apps/server/src/worker.ts`. Se aggiungi un messaggio o una rotta, il codice basta: qui si scrive solo se cambia un principio.

## 1. Trasporto
- **HTTP** `/api/*`: JSON, header `X-Token` dopo il primo accesso, `cache-control: no-store`.
- **WebSocket** `/ws/…?t=<token>`, testo JSON, un messaggio per riga: la **zona** (`/ws/zone/<id>`, presenza nel mondo) e i **canali in tempo reale** delle modalità (`/ws/squadra/<dungeon>`, `/ws/gara`, `/ws/templari`, `/ws/arena`), ognuno col suo Durable Object.
- Riconnessione con backoff; dopo una caduta lo stato torna intero dal server. Nessuno stato locale va perso: monete e acquisti stanno tutti sul server.
- `PROTOCOL_VERSION` (oggi 1, in `messages.ts`): un client con versione diversa riceve `error {code:'versione'}` e ricarica. Un canale nuovo non la cambia; la cambia solo un messaggio della zona non compatibile.

## 2. Autorità
| Cosa | Chi decide |
|---|---|
| Posizione, direzione, animazione del **proprio** avatar e della barca | il client (inviata a 10 Hz; il server la ritrasmette senza giudicare, dentro i confini della zona) |
| Ora | il server (`now` in ogni messaggio; il client la stima con ping/pong) |
| Monete, casa, acquisti, premi, vetrine | il server (DO `Lot` di ognuno) |
| Esito di una partita | il server, rigiocando l'input log nella `sim` |

## 3. WebSocket della zona
Tipi e parser in `packages/protocol/src/messages.ts`: `ClientMsg` (`hello`, `pos`, `ping`, `emote`), `ServerMsg` (`welcome`, `snap`, `join`, `leave`, `pong`, `emote`, `error`), `Peer`, `Look`, `EMOTE_IDS`. DO `Zone` (`apps/server/src/do/Zone.ts`) con la Hibernation API: le `pos` arrivano a 10 Hz e il server manda uno `snap` al massimo ogni 100 ms coi soli peer cambiati. Limiti di frequenza e di dimensione e codici di chiusura stanno nel DO (4000 = la stessa persona si è collegata da un altro dispositivo). Compatibilità: un client vecchio scarta in silenzio i messaggi che non conosce (`parse…` → `null`), senza errori né chiusure.

## 4. HTTP
Tutte le rotte stanno in `apps/server/src/worker.ts`, una dopo l'altra (`grep -n "'/api/" apps/server/src/worker.ts` le elenca); il client le chiama da `apps/client/src/net/api.ts`. Il Worker fa solo rotte, auth e piccoli JSON (10 ms di CPU): il lavoro vero lo fanno i DO. Le rotte `/api/test/*` rispondono solo dal server locale, per i test. Le rotte `/api/admin/{invito,link,admin}` (POST, `apps/server/src/admin.ts`) rispondono solo a chi ha `admin = 1`: creano il link di gruppo, restituiscono (o cambiano con `ruota`) il link personale di un personaggio, promuovono un altro dev; si usano con `apps/server/scripts/admin.mjs`.

## 5. Input log compresso (`PackedInputs`)
Array di run-length `[[ticks, mx, my, a, b], …]` con `mx, my` quantizzati a 1/32, `a` 0/1, `b` 0/1/2 (2 = `b` con `c`, «dall'altra parte»). Il server controlla la forma con `isPackedInputs` e rigioca con `replay(minigioco, seed, difficoltà, inputs)` di `packages/sim/src/replay.ts`. Una Regata da 60 s pesa meno di 4 KB.

## 6. Errori
Sempre `{ error: string }` in italiano con lo status HTTP giusto: 400 richiesta rotta, 401 token, 403 non tuo, 404, 409 conflitto (per esempio monete che non bastano), 413 troppo grande, 429 troppi messaggi, 500 interno (mai il dettaglio tecnico al client).

## 7. Dungeon insieme
`/ws/squadra/<dungeon>` → DO `Spedizioni`; tipi in `packages/protocol/src/squadra.ts`. È il modello dei canali a turni: aprire il socket = entrare nella squadra (fino a 4); con `via` il DO sceglie il seed e fotografa l'eroe di ognuno dal suo DO `Lot`. Ogni `SQ_TURNO_MS` (50 ms) il DO manda a tutti lo stesso turno con l'input di ciascuno, che vale `SQ_TICKS` (3) tick della sim: ogni telefono fa girare la stessa partita. Il DO non simula; alla fine ognuno chiama `POST /api/dungeon/finish` e il suo DO `Lot` rigioca il log e applica l'esito.

## 8. Corse tra amici
`/ws/gara` → DO `GaraAmici`; tipi in `packages/protocol/src/gara_amici.ts`. Una sala sola (fino a `GA_MAX`); con `via` tutti partono con lo stesso seed e ognuno fa girare la sua gara, coi suoi bot. Le posizioni girano tra gli amici come fantasmi (niente urti tra amici). La sala non dà premi: ognuno chiude la sua corsa come una partita da solo.

## 9. Templari insieme
`/ws/templari?classe=…` → DO `TemplariInsieme`; tipi in `packages/protocol/src/templari_insieme.ts`. Turni come il §7, da 2 a 4 nella stessa chiesa. Il DO salva la partita ogni pochi secondi: chi cade si ricollega da solo (`run`, `idx` e il primo turno che gli manca nell'indirizzo) e riceve i turni persi. Alla fine `POST /api/templari/finish`: il DO `Lot` rigioca e paga le ondate fino a quando sei uscito tu.

## 10. Arena
`/ws/arena?modo=coda|sala[&f=1|2|3][&codice=…]` → DO `Arena` (`f` = eroi per squadra: duello, 2v2, 3v3); tipi in `packages/protocol/src/arena.ts`. Turni come il §7 (un input per eroe, da 2 a 6), ma il DO fa girare anche lui il duello e scarta le azioni che il duello rifiuta. Nei formati a squadre `attendi` dice quanti ci sono e `parte` porta le squadre e la mappa; chi ha aperto la sala manda `via`; i posti vuoti li prendono i gladiatori automatici, i cui input li decide il DO. Se uno cade il duello si ferma e aspetta che si ricolleghi; dopo un po' è dato per arreso. Alla fine il DO rigioca il duello dal log, l'esito del replay decide, e il DO `Lot` di ognuno paga il premio. Il set del duello si salva con `POST /api/rpg`.
