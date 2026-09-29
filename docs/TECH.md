# MAREA — Tech Design

> Architettura, regole di codice, limiti, pipeline. I contratti tra pacchetti sono in `CONTRACTS.md`; il protocollo in `PROTOCOL.md`.

## 1. Architettura in una figura
```
 browser (telefono / desktop)                         Cloudflare (piano Free)
 ┌──────────────────────────────────┐   HTTPS /api/*   ┌─────────────────────────────┐
 │ apps/client  (Vite + Three.js)   │ ───────────────▶ │ apps/server  Worker         │
 │  render/  camera diorama, pixel  │   WS /ws/zone/*  │   worker.ts  router, auth   │
 │  game/    avatar, barca, input   │ ◀──────────────▶ │   do/Zone    presenza WS    │
 │  net/     client WS, clock       │                  │   do/Lot     isola, timer   │
 │  ui/      HUD, build, sfide      │   file statici   │   D1  persone, inviti, ledger│
 │  ▲ usa                           │ ◀─────────────── │   assets = apps/client/dist │
 └──┼───────────────────────────────┘                  └──────────────▲──────────────┘
    │                                                                 │ usa
 ┌──┴──────────────────────────────────────────────────────────────────┴──────────────┐
 │ packages/sim  (TypeScript PURO: rng, economia, mondo, minigiochi, replay)          │
 │ packages/protocol (tipi dei messaggi)   packages/content (JSON: edifici, isole…)  │
 └───────────────────────────────────────────────────────────────────────────────────┘
```
La stessa `sim` gira nel browser (per giocare) e nel Durable Object (per **verificare**: replay dell'input log). È il cuore portabile: un porting a un motore rifà solo `render/` e `ui/`.

## 2. Pacchetti (npm workspaces)
| Pacchetto | Cosa | Dipende da | Vietato |
|---|---|---|---|
| `@marea/sim` | rng seedabile, `economy` (advance/collect/build/ledger), `world` (griglia, collisioni, avatar, barca), `minigames/*`, `replay`, `hash` | `@marea/content` | DOM, `three`, `Math.random`, `Date.now`, `performance.now`, `setTimeout` |
| `@marea/protocol` | tipi dei messaggi WS/HTTP, `PROTOCOL_VERSION`, validatori senza dipendenze | — | tutto ciò che non è tipi/validazione |
| `@marea/content` | JSON data-driven + validatore: `buildings`, `resources`, `islands`, `avatar`, `balance`, `minigames/*` | — | codice di gioco |
| `@marea/client` | Vite + Three.js; UI in HTML/CSS sopra il canvas, **niente framework** | sim, protocol, content, three | logica economica (solo il server decide) |
| `@marea/server` | Worker + DO `Zone` + DO `Lot` + D1 | sim, protocol, content | leggere stream pesanti nel Worker (10 ms CPU) |

## 3. Regole di codice (le controlla `tools/check_static.mjs`)
- **TypeScript ovunque**, `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` + **`erasableSyntaxOnly`**: niente `enum` (usa `as const`), niente `namespace`, niente parameter properties. Così Node 26 esegue i `.ts` **senza build** (test della sim in Node puro).
- **Import relativi con estensione `.ts` esplicita** (`import { createRng } from './rng.ts'`); tra pacchetti `@marea/sim`, `@marea/sim/rng.ts`. Tipi con `import type`.
- **Nessun side effect all'import**: solo `apps/client/src/main.ts` e `apps/server/src/worker.ts` avviano qualcosa. Ogni modulo di `sim`, `protocol`, `content` deve importarsi in Node.
- **Determinismo**: in `sim` la casualità passa solo da `createRng(seed)` e `.fork(label)`; il tempo è `tick` (60 Hz) o `nowMs` passato dal chiamante. Stesso seed + stessi input = stesso `hash()`.
- Numeri di gioco **solo** in `packages/content` (JSON). Costanti tecniche in `packages/sim/src/constants.ts`.
- Testi in italiano nel client; niente i18n in V1. Errori del server in italiano.
- Nessuna dipendenza nuova senza una riga in `ROADMAP.md` §Deviazioni.

## 4. Ciclo di gioco nel client
- Sim a **60 Hz** con accumulatore (`DT = 1/60`), massimo 5 passi per frame; render a rAF con interpolazione `alpha` tra tick precedente e corrente.
- Input campionato una volta per tick (`InputFrame`: joystick `mx, my` ∈ [−1, 1], bottoni `a`, `b`).
- L'avatar e la barca locali sono **client-authoritative** per la posizione (inviata a 10 Hz); tutto il resto (economia, sfide, ledger) è server-authoritative.
- Look pixel: si renderizza su un canvas a **metà risoluzione** (pixel ratio ≤ 1,5 × 0,5) e lo si ingrandisce con `image-rendering: pixelated`. Zero post-processing.

## 5. Budget (la build fallisce se superati, `tools/build.mjs`)
| Cosa | Limite |
|---|---|
| `app.js` (client) | ≤ 900 KB minificato, ≤ 250 KB gzip |
| Caricamento iniziale (html + js + atlas + modelli della prima isola) | ≤ 2 MB |
| Draw call per frame | ≤ 100 |
| Triangoli a schermo | ≤ 150.000 |
| Texture in VRAM | ≤ 16 MB |
| Shadow map | 1 × 1024² (o blob) |
| FPS | 60 su iPhone 12+, ≥ 45 su Android medio, mai < 30 |
Il `perf` test legge `window.__game.perf()` (draw call, triangoli, fps) durante 20 s di navigazione.

## 6. Cloudflare piano Free (verificato il 29 set 2026)
| Servizio | Limite Free | Come lo usiamo |
|---|---|---|
| Worker | 100.000 richieste/giorno, 10 ms CPU | solo routing, auth, piccoli JSON |
| Durable Objects (SQLite) | inclusi nel Free; 100k richieste/giorno, WebSocket contati 20:1 con **Hibernation** | `Zone` (presenza, WS), `Lot` (isola, timer, replay minigiochi: fino a 30 s CPU) |
| D1 | 5 M letture/giorno, 100k scritture/giorno, 5 GB | persone, inviti, sfide, ledger |
| Static assets | illimitati | il client (`apps/client/dist`) servito dallo stesso Worker: un solo URL, zero CORS |
URL: `https://marea.stanza-idee.workers.dev` (il sottodominio `stanza-idee.workers.dev` è dell'account). Stima: 10 amici × 30 min/giorno di posizioni a 10 Hz ≈ 9.000 richieste-equivalenti/giorno. Se un giorno si apre al pubblico: piano Paid 5 $/mese.

## 7. Autenticazione
Link personale con **token** (`?t=<token>` → salvato in `localStorage`, poi header `X-Token`), creato da Jack con uno script (`tools/invita.mjs`, M1) e mandato su WhatsApp. **Passkey** opzionale da M1 («Aggiungi Face ID») per legare un secondo dispositivo, con `@simplewebauthn/server` su WebCrypto. Zero email, zero OAuth, zero servizi terzi.

## 8. Anti-cheat (basta per gli amici)
Ogni partita di minigioco invia al DO `Lot` il **seed** e l'**input log** (uno `InputFrame` compresso per tick). Il DO rigioca la partita con la stessa `sim` e accetta solo il punteggio che ne esce. Orologio: solo del server (`serverNow()` dal client, corretto con ping/pong).

## 9. Pipeline
- `npm run dev` → Vite con proxy `/api` e `/ws` verso `wrangler dev` (`npm run dev:server`, porta 8787).
- `npm run build` → `vite build` in `apps/client/dist` + `version.json {build, when}` + controllo budget.
- `npm run deploy` → build → `wrangler d1 migrations apply DB --remote` → `wrangler deploy` (cwd `apps/server`) → poll di `/version.json` finché `build` coincide → 2 min di `wrangler tail` a campione.
- `npm run assets` → Blender headless (`tools/export_gltf.py`) + `gltf-transform` (dedup, prune, weld, quantize; **niente Draco**) → `apps/client/public/assets/` + `manifest.json`. Gli export sono **committati**: il client si costruisce senza Blender.
- `npm test` → `tests/run.mjs all`: `static` (check_static), `types` (tsc per pacchetto), `sim` (node --test), `boot look perf net` (Playwright su Chrome di sistema, viewport iPhone emulato), `contact` (ffmpeg).
- Flag URL: `?fps=1` overlay prestazioni · `?test=1` `window.__game` con hook mutanti e salvataggio in memoria · `?seed=N` · `?nosound=1` · `?quality=low|high` · `?net=0` offline · `?autopilot=1`.

## 10. Portabilità verso un motore
`packages/sim` non conosce Three né il DOM; `packages/content` è JSON; gli asset sono glTF; questo documento e il GDD non citano API di Three. Le **fixture d'oro** (`packages/sim/test/fixtures/*.json`: seed + input log → hash e punteggio attesi) sono il criterio di parità: un porting è «fatto» quando le passa tutte.

## 11. Registro rischi
| Rischio | Contromisura |
|---|---|
| Impantanarsi nel setup | ogni sessione finisce deployata; contratti e stub prima delle wave; `_STATO.md` aggiornato |
| Prestazioni su telefono | budget in build, mezza risoluzione, atlas unico, `perf` test, collaudo di Jack in 4G |
| Tetti Cloudflare Free | posizioni a 10 Hz con batching, Hibernation, logica nei DO, consumi controllati ogni settimana |
| Amici bloccati al login | link-token senza password; prova con un amico vero nella prima settimana di M1 |
| Look incoerente | regola dell'atlas, art bible, contact sheet approvato prima della serie |
| Deriva degli agenti in parallelo | file disgiunti, `check_static`, contratti congelati, gate verde per WP |
| Le 2 ore di Jack | scelte A/B con screenshot, mai domande aperte |
| Cheating | replay nel DO, orologio del server |
| Node esegue `.ts` solo se «erasable» | `erasableSyntaxOnly` in tsconfig + `types` nel test runner |
