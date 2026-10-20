# MAREA — Tech Design

> Architettura, regole di codice, convenzioni, limiti, pipeline. Dove sta il codice: `MAPPA.md`; messaggi tra gioco e server: `PROTOCOL.md`.

## 1. Architettura in una figura
```
 browser (telefono / desktop)                         Cloudflare (piano Free)
 ┌──────────────────────────────────┐   HTTPS /api/*   ┌─────────────────────────────┐
 │ apps/client  (Vite + Three.js)   │ ───────────────▶ │ apps/server  Worker         │
 │  render/  camera diorama, pixel  │   WS /ws/*       │   worker.ts  rotte, auth    │
 │  game/    avatar, barca, input   │ ◀──────────────▶ │   do/Zone    presenza WS    │
 │  net/     client WS, clock       │                  │   do/Lot     lotto, replay  │
 │  ui/      HUD, pannelli          │   file statici   │   D1  persone, inviti       │
 │  ▲ usa                           │ ◀─────────────── │   assets = apps/client/dist │
 └──┼───────────────────────────────┘                  └──────────────▲──────────────┘
    │                                                                 │ usa
 ┌──┴──────────────────────────────────────────────────────────────────┴──────────────┐
 │ packages/sim  (TypeScript PURO: rng, economia, mondo, minigiochi, modalità, replay)│
 │ packages/protocol (tipi dei messaggi)   packages/content (JSON dei numeri di gioco)│
 └───────────────────────────────────────────────────────────────────────────────────┘
```
La stessa `sim` gira nel browser (per giocare) e nel Durable Object (per **verificare**: replay dell'input log). È il cuore portabile: un porting a un motore rifà solo `render/` e `ui/`.

## 2. Pacchetti (npm workspaces)
| Pacchetto | Cosa | Dipende da | Vietato |
|---|---|---|---|
| `@marea/sim` | rng seedabile, economia del lotto, mondo (griglia, collisioni, avatar, barca), minigiochi e modalità, `replay`, `hash` | `@marea/content` | DOM, `three`, `Math.random`, `Date.now`, `performance.now`, `setTimeout`, funzioni trascendenti di `Math` (al loro posto `trig.ts`) |
| `@marea/protocol` | tipi dei messaggi WebSocket, `PROTOCOL_VERSION`, validatori senza dipendenze | — | tutto ciò che non è tipi/validazione |
| `@marea/content` | JSON dei numeri di gioco, i loro tipi e il validatore | — | codice di gioco |
| `@marea/client` | Vite + Three.js; UI in HTML/CSS sopra il canvas, **niente framework** | sim, protocol, content, three | logica economica (solo il server decide) |
| `@marea/server` | Worker + Durable Objects + D1 | sim, protocol, content | leggere stream pesanti nel Worker (10 ms CPU) |

## 3. Regole di codice (le controlla `tools/check_static.mjs`)
- **TypeScript ovunque**, `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` + **`erasableSyntaxOnly`**: niente `enum` (usa `as const`), niente `namespace`, niente parameter properties. Così Node 26 esegue i `.ts` **senza build** (test della sim in Node puro).
- **Import relativi con estensione `.ts` esplicita** (`import { createRng } from './rng.ts'`); tra pacchetti `@marea/sim`, `@marea/sim/rng.ts`. Tipi con `import type`.
- **Nessun side effect all'import**: solo `apps/client/src/main.ts` e `apps/server/src/worker.ts` avviano qualcosa. Ogni modulo di `sim`, `protocol`, `content` deve importarsi in Node.
- **Determinismo**: in `sim` la casualità passa solo da `rng.ts`: `createRng(seed)` e `.fork(label)`, o `casoIntero(s)` quando il seme sta nello stato serializzabile della partita (Difesa, Sparo); il tempo è `tick` (60 Hz) o `nowMs` passato dal chiamante. Stesso seed + stessi input = stesso `hash()`.
- Numeri di gioco **solo** in `packages/content` (JSON). Costanti tecniche in `packages/sim/src/constants.ts`.
- Testi in italiano nel client; niente i18n. Errori del server in italiano.
- Dipendenza nuova: solo se serve, col perché nella PR.
- **Guardiani** (`tools/guardiani.mjs`, girano dentro `check_static`): niente file né export che nessuno usa; file ≤ 400 righe (quelli più lunghi di oggi non possono crescere); `?parametro=` letti solo in `flags.ts`; ogni banco di prova in `apps/client/banchi.json`; documenti ≤ 40k caratteri (CLAUDE.md 6k, MAPPA 8k); ogni cartella in `MAPPA.md`; nei commenti nuovi niente numeri di PR, date o «deciso da Jack»; `noUnusedLocals` e `noUnusedParameters` accesi. Le violazioni di oggi stanno in `tools/guardiani_eccezioni.json`: si tolgono o si stringono (`--aggiorna`), non si aggiungono.

## 3b. Convenzioni
- **Spazio**: 1 unità = 1 m, Y in su, −Z avanti. Posizioni nel mondo `{x, z}` sul piano, `y` solo per la resa. Angoli in radianti; `yaw` attorno a Y, 0 = −Z.
- **Input**: `InputFrame = { mx, my, a, b }` con `mx, my ∈ [−1, 1]` in **assi mondo** (`mx` = +X, `my` = +Z; il client ruota il joystick con la camera), `a` azione/accelera, `b` secondario/freno; `c` facoltativo («dall'altra parte»). Si campiona una volta per tick e si quantizza con `quantize()` di `replay.ts` quando si registra una partita.
- **Minigiochi e modalità**: modulo puro e deterministico a 60 Hz (`MinigameModule` in `sim/src/minigames/types.ts`): `create({ seed, difficulty, opzioni })`, `step(state, input)`, `result(state)` → `{ done, score, medal, detail }` (il punteggio è sempre «più alto vince»), `autopilot`, `view`. Si registrano in `minigames/registry.ts`; il server rigioca gli input con `replay()`.
- **Mappe delle isole** (`islands.json`): un carattere = una cella da 2 m. `~` acqua profonda · `,` acqua bassa (navigabile) · `.` sabbia · `g` erba · `r` roccia (non camminabile) · `d` molo · `P` spawn dell'avatar · `B` spawn della barca · `L` slot. `parseIsland()` in `sim/src/world/grid.ts`; l'arcipelago intero è un `GridMap` solo (`world/archipelago.ts`).
- **Test nel browser**: `window.__game = { ready, build, flags, state(), perf(), test: {…} }` (`apps/client/src/test/testapi.ts`). Ogni modulo registra il suo pezzo di `state()` con `registerStateProvider` e i suoi hook con `registerTestHook`; gli hook che cambiano il gioco funzionano solo con `?test=1`.
- **Asset**: `apps/client/public/assets/manifest.json` = `{ atlas, models: { [nome]: { file, tris, bounds } }, version }`, più manifest secondari caricati quando servono (`manifest_rpg`, `manifest_corse`, `manifest_mobili`). Sorgenti in `assets/blender/`, licenze in `assets/licenses.md`.
- Log tecnici in inglese col prefisso `[marea]`.

## 4. Ciclo di gioco nel client
- Sim a **60 Hz** con accumulatore (`DT = 1/60`), massimo 5 passi per frame; render a rAF con interpolazione `alpha` tra tick precedente e corrente.
- L'avatar e la barca locali sono **client-authoritative** per la posizione (inviata a 10 Hz); tutto il resto (economia, partite, premi) è server-authoritative.
- Look pixel: si renderizza su un canvas a **metà risoluzione** (pixel ratio ≤ 1,5 × 0,5) e lo si ingrandisce con `image-rendering: pixelated`.

## 5. Budget (la build fallisce se superati, `tools/build.mjs`)
I numeri veri del JS e dei MB stanno in `BUDGET` di `tools/build.mjs`; draw call e triangoli in `tests/e2e/m3_prestazioni.mjs`. Non sono un dictat (Jack, 11 ott 2026): prima si prova a spostare codice in chunk `import()`; se non basta si alza il limite lì, col perché nella PR. All'avvio sul telefono non si rallenta mai.

| Cosa | Limite (19 ott 2026) |
|---|---|
| JS iniziale | ~1,3 MB minificato, ~394 KB gzip |
| Ogni chunk caricato dopo con `import()` (GDR, minimappa, isole, giochi a schermo, audio) | ≤ 600 KB minificato, ≤ 180 KB gzip; tutti insieme ≤ 3000 KB, ≤ 900 KB gzip |
| Caricamento iniziale (html + js + atlas + modelli della prima isola) | ≤ 3 MB |
| Manifest secondari: modelli dei dungeon · kit delle Corse · mobili · pelli della Difesa | ≤ 1,5 · 2,5 · 3 · 4 MB |
| Draw call per frame | ≤ 100 (sul PC, solo a zoom massimo sopra il Borgo: ≤ 110; dal 19 ott oscillava fra 101 e 105 con insetti, pesci e botteghe: da riportare sotto 100 unendo cappelli e ingressi in pezzi unici) |
| Triangoli a schermo | ≤ 200.000 |
| Texture in VRAM | ≤ 16 MB (eccezione: le ondate dei Templari col dipinto, `TEMPLARI.md` §3b) |
| Shadow map | una, 1024² (le Corse in HD: 2048² al PC) |
| FPS | 60 su iPhone 12+, ≥ 45 su Android medio, mai < 30 |

### 5b. Come si sta nel budget (camera di serie a 22°)
Con la camera bassa si vede fino all'orizzonte: senza accorgimenti si disegnerebbe mezzo arcipelago. Le regole, tutte in `render/island.ts` e `render/island_sagoma.ts`:
- **Culling per isola**: ogni isola ha una scatola stretta (rettangolo delle celle + 4 m, dal pelo dell'acqua alla cima); `Island.cull(camera)` (chiamato da `world.ts` prima di ogni render) spegne le isole fuori inquadratura.
- **Sagoma da lontano**: oltre `LOD_M` (210 m dalla camera al bordo dell'isola) si disegna la sagoma: terreno, rive, scogliere, palme e blocchi in **una** geometria (1 draw call, niente ombre). Isteresi 15 m.
- **Scenografia minuta** (sassi, cespugli, casse, barili, lanterne): niente ombre e spenta oltre `MINUTI_M` (150 m).
- **Tutto fuso per isola**: moduli del terreno, prop ed edifici stanno sull'atlas (materiali `mat_atlas` e `mat_emissivo`) e si fondono in una geometria per isola, materiale e gruppo. Un'isola costa ~5-8 draw call invece di 15-30.
- Un modello nuovo per le isole: **sull'atlas** (così si fonde). Una scenografia nuova vicino a un'isola: dentro il suo gruppo, o con un culling suo (come `temi_fx.ts`, `porto.ts`, `animali.ts`).
- Controllo: `tests/e2e/m3_prestazioni.mjs` (giro di tutte le isole e del mare aperto, camere e zoom diversi, giorno e notte, telefono e PC; numeri in `tests/out/m3_prestazioni.json`). Hook di test `disegnati()`: mesh per mesh cosa si disegna nella vista e nell'ombra.

## 6. Cloudflare piano Free (verificato il 29 set 2026)
| Servizio | Limite Free | Come lo usiamo |
|---|---|---|
| Worker | 100.000 richieste/giorno, 10 ms CPU | solo rotte, auth, piccoli JSON |
| Durable Objects (SQLite) | inclusi nel Free; 100k richieste/giorno, WebSocket contati 20:1 con **Hibernation** | `Lot` (il lotto di ognuno, replay delle partite: fino a 30 s CPU), `Zone` (presenza), partite in tempo reale, `Sfide` (coordinatore unico) |
| D1 | 5 M letture/giorno, 100k scritture/giorno, 5 GB | persone, inviti |
| Static assets | illimitati | il client (`apps/client/dist`) servito dallo stesso Worker: un solo URL, zero CORS |

URL: `https://marea.stanza-idee.workers.dev`. Se un giorno si apre al pubblico: piano Paid 5 $/mese.
Il DO `Sfide` (un'istanza sola, `idFromName('tavolo')`) è il **coordinatore unico** dell'arcipelago: buche del Borgo, discese dell'Adrenalina, feed, tabellone dei record. Tra due DO non c'è transazione: ogni operazione su un lotto è idempotente e il coordinatore scrive prima l'intento, poi chiama i lotti.

## 7. Autenticazione
Link personale con **token** (`?t=<token>` → salvato in `localStorage`, poi header `X-Token`), creato con `node apps/server/scripts/invita.mjs "Nome" --remote`; oppure link di gruppo `?invito=<codice>`, dove si sceglie il nome (`ui/entra.ts` → `POST /api/entra`). Zero email, zero password, zero servizi terzi. I link e i codici non vanno mai nel repo.

## 8. Anti-cheat (basta per gli amici)
Ogni partita invia al DO `Lot` il **seed** e l'**input log** (uno `InputFrame` compresso per tick). Il DO rigioca la partita con la stessa `sim` e accetta solo il punteggio che ne esce. Orologio: solo del server (`serverNow()` dal client, corretto con ping/pong).

## 9. Pipeline
- `npm run dev` → Vite con proxy `/api` e `/ws` verso `wrangler dev` (`npm run dev:server`, porta 8787).
- `npm run build` → `vite build` in `apps/client/dist` + `version.json {build, when}` + controllo budget.
- Deploy (`tools/deploy.mjs`, lo lancia solo GitHub dopo il merge): build → migrazioni D1 → `wrangler deploy` → attende `/version.json` col build nuovo.
- `npm run assets` → Blender headless (`tools/export_gltf.py`) + `gltf-transform` (dedup, prune, weld, quantize; **niente Draco**) → `apps/client/public/assets/`. Gli export sono **nel repo**: il client si costruisce senza Blender.
- `npm test` → `tests/run.mjs all`: `static` (check_static), `types` (tsc per pacchetto), `sim` (node --test), poi le suite e2e (Playwright su Chrome di sistema, viewport iPhone emulato), `contact` (ffmpeg). Dettagli: `tests/README.md`.
- Flag URL: tutti in `apps/client/src/flags.ts`, ognuno col suo commento. I più usati: `?fps=1` prestazioni · `?test=1` `window.__game` con gli hook · `?seed=N` · `?nosound=1` · `?net=0` offline.

## 10. Portabilità verso un motore
`packages/sim` non conosce Three né il DOM; `packages/content` è JSON; gli asset sono glTF. Le **fixture d'oro** (`packages/sim/test/fixtures/*.json`: seed + input log → hash e punteggio attesi) sono il criterio di parità: un porting è «fatto» quando le passa tutte.

## 11. Registro rischi
| Rischio | Contromisura |
|---|---|
| Impantanarsi | PR piccole, una cosa alla volta, sempre online |
| Prestazioni su telefono | budget in build, mezza risoluzione, atlas unico, test delle prestazioni |
| Tetti Cloudflare Free | posizioni a 10 Hz con batching, Hibernation, logica nei DO |
| Look incoerente | atlas, art bible, screenshot approvati da Jack prima della PR |
| Tre AI in parallelo sugli stessi file | PR piccole, `check_static`, `main` sempre verde, `MAPPA.md` |
| Cheating | replay nel DO, orologio del server |
| Node esegue `.ts` solo se «erasable» | `erasableSyntaxOnly` in tsconfig + `types` nel test runner |
