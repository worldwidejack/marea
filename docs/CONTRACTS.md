# MAREA — CONTRACTS (interfacce tra pacchetti; si cambiano con una PR che aggiorna anche questo file)

> Leggere con `TECH.md` §3 (regole di codice) e `ROADMAP.md`. Ogni file della tabella di proprietà esiste già come **stub che esporta l'interfaccia finale**: sostituisci il corpo, tieni nomi e firme. Gli stub segnati «funzionante» fanno girare il walking skeleton: tienili in piedi mentre li sostituisci.

Comandi: `npm run dev` · `npm run build` · `npm run check` (tsc) · `npm test` (= `node tests/run.mjs all`) · `node tests/run.mjs static sim boot` · `npm run deploy`.
Deploy solo da GitHub dopo il merge su `main` (`docs/CONTRIBUIRE.md`). I subagent di una sessione non fanno commit, push né merge.

## 1. Mappa del codice
Dal 1 ott 2026 il codice è di tutti (ognuno lavora su tutto, coordinandosi con le issue: `docs/CONTRIBUIRE.md`). La tabella sotto resta come **mappa di dove sta cosa** e come divisione per i **subagent dentro una sessione** (file disgiunti tra agenti paralleli).
| WP | Possiede |
|---|---|
| **WP0 orchestratore** | `package.json`, `tsconfig*`, `docs/**`, `CLAUDE.md`, `apps/client/index.html`, `apps/client/vite.config.ts`, `apps/client/src/{main,flags}.ts`, `apps/client/src/game/world.ts`, `apps/client/src/ui/**`, `apps/client/src/test/**`, `packages/protocol/**`, `packages/content/**` tranne `balance.json` e `minigames/*.json`, `tools/check_types.mjs` |
| **WP1 render-mondo** | `apps/client/src/render/{scene,camera,water,light,loader,pixel,island,sky}.ts`, `tests/e2e/wp1_*.mjs` |
| **WP2 avatar+barca** | `apps/client/src/game/{input,avatar,boat}.ts`, `apps/client/src/render/anim.ts`, `tests/e2e/wp2_*.mjs` |
| **WP3 sim-core** | `packages/sim/**`, `packages/content/src/balance.json`, `packages/content/src/minigames/*.json` |
| **WP4 server+net** | `apps/server/**`, `apps/client/src/net/**`, `tests/e2e/wp4_*.mjs` |
| **WP5 asset** | `assets/**`, `tools/build_assets.mjs`, `tools/export_gltf.py`, `apps/client/public/assets/**` |
| **WP6 test+deploy** | `tests/run.mjs`, `tests/lib/**`, `tests/e2e/{boot,look,perf}.mjs`, `tools/{build,deploy,check_static,contact}.mjs` |
Subagent: serve un cambiamento in un file di un altro agente → scrivilo in `tests/out/richieste/<wp>.md` (cosa, perché, firma proposta) e vai avanti con un adattatore nei tuoi file; chi coordina la sessione integra.

## 2. Convenzioni
- 1 unità = 1 m, Y su, −Z avanti; posizioni nel mondo `{x, z}` (piano) + `y` solo per la resa. Angoli in radianti, `yaw` attorno a Y, 0 = −Z.
- Sim a 60 Hz, `DT = 1/60` (`@marea/sim/constants.ts`). `InputFrame = { mx: number, my: number, a: boolean, b: boolean }` (`mx, my ∈ [−1, 1]` in **assi mondo**: `mx` = +X, `my` = +Z; il client ruota il joystick per la yaw della camera; `a` azione/accelera, `b` secondario/freno-corsa). Il client campiona **una volta per tick** e quantizza con `quantize()` di `replay.ts` quando registra un minigioco.
- Import relativi con `.ts`; tra pacchetti `@marea/sim`, `@marea/sim/<file>.ts`, ecc. Tipi con `import type`. Niente `enum`/`namespace`.
- Testi utente in italiano. Log tecnici in inglese, prefisso `[marea]`.
- Nessuna dipendenza nuova (nemmeno devDependency) senza riga in `ROADMAP.md` §Deviazioni.

## 3. `@marea/content` (WP0; numeri: WP3)
```ts
export const BUILDINGS: readonly BuildingDef[]        // buildings.json
export const RESOURCES: readonly ResourceDef[]        // resources.json: legno, pietra, perle
export const ISLANDS: readonly IslandDef[]            // islands.json: mappe ASCII (vedi §4)
export const AVATAR: AvatarDef                        // avatar.json: pelle[], capelli[], coloriCapelli[], vestiti[], cappelli[]
export const BALANCE: BalanceDef                      // balance.json: partenza, bufferOre, medaglie→perle, wager, sfideGratis…
export const MINIGAMES_CFG: Record<string, unknown>   // minigames/<id>.json (WP3 ne definisce il tipo per gioco)
export const DECOR: readonly DecorDef[]               // decor.json: { id, nome, perle, model } (le decorazioni si pagano in Perle, `placeDecor` usa `decorDef(id).perle`)
export function validateContent(): string[]           // [] se tutto ok, altrimenti errori in italiano
type BuildingDef = { id: string; nome: string; levels: { cost: Resources; seconds: number; rate?: number; cap?: number; slots?: number; wagerMax?: number; freeChallenges?: number }[]; requires?: string; size: [number, number]; model: string }
type Resources = { legno: number; pietra: number; perle: number }
```

## 4. Mappe (islands.json)
`IslandDef = { id, nome, tile: 2, rows: string[], spawn?: string }`. Un carattere = una cella 2 m: `~` acqua profonda · `,` acqua bassa (navigabile, non camminabile) · `.` sabbia · `g` erba · `r` roccia (non camminabile) · `d` molo (camminabile, la barca attracca accanto) · `P` spawn avatar (sabbia) · `B` spawn barca (acqua bassa) · `L` slot edificio (erba, cella in alto a sinistra). `parseIsland(def)` in `@marea/sim/world/grid.ts` → `GridMap { w, h, tile, at(cx, cz): Tile, worldToCell, cellToWorld, walkable(x,z), navigable(x,z), spawn, boatSpawn, lots: Cell[] }`. Origine del mondo = angolo in alto a sinistra della mappa; `x` cresce a destra, `z` verso il basso della riga.

## 5. `@marea/sim` (WP3) — stub funzionanti in Fase A
```ts
// rng.ts
createRng(seed: number | string): Rng          // sfc32; Rng = { next(): number; int(min, max): number; pick<T>(a: readonly T[]): T; fork(label: string): Rng; readonly seed: number }
// hash.ts
hashJson(v: unknown): number                    // FNV-1a su JSON stabile (chiavi ordinate)
// world/grid.ts   parseIsland, GridMap (vedi §4)
// world/avatar.ts
type AvatarState = { x: number; z: number; yaw: number; vx: number; vz: number; anim: 'idle'|'walk'|'run'|'sit' }
stepAvatar(s: AvatarState, input: InputFrame, map: GridMap): AvatarState      // pura; velocità 3 m/s (run 5 m/s con |joystick| > 0,8); collisioni con celle non camminabili
// world/boat.ts
type BoatState = { x: number; z: number; yaw: number; speed: number; rudder: number; wake: number }
stepBoat(s: BoatState, input: InputFrame, map: GridMap, wind?: { x: number; z: number }): BoatState   // arcade: accel 6 m/s², max 9 m/s, virata 1,6 rad/s scalata con la velocità, attrito; rimbalza sulle celle non navigabili
canBoard(a: AvatarState, b: BoatState): boolean     // avatar su molo entro 3 m dalla barca
// economy/types.ts
type LotState = { owner: string; version: number; nowMs: number; resources: Resources; buildings: PlacedBuilding[]; construction: { building: string; level: number; endsMs: number } | null; decor: PlacedDecor[]; escrow: Resources; ledger: LedgerTotals }
type PlacedBuilding = { id: string; building: string; level: number; cell: [number, number]; buffer: number; lastMs: number }
type LedgerTotals = { generated: Resources; spent: Resources }
// economy/advance.ts
advance(lot: LotState, nowMs: number): LotState             // produzione pigra nei buffer (tetto = bufferOre), chiude il cantiere se finito; pura
// economy/actions.ts   tutte pure, lanciano EconomyError { code, manca? } in italiano
collect(lot, buildingId, nowMs) · build(lot, building, cell, nowMs) · upgrade(lot, buildingId, nowMs) · placeDecor(lot, decor, cell, rot, nowMs)
newLot(owner: string, nowMs: number): LotState             // Molo L1 + partenza da BALANCE
// economy/ledger.ts
checkInvariant(lots: LotState[], escrowGlobal: Resources): string | null   // null se ok: Σ risorse + escrow = generato − speso
// economy/wager.ts
settle(a: LotState, b: LotState, stake: Resources, winner: 'a'|'b'|null): { a: LotState; b: LotState }   // colpo di coda 1,5×, parità = rimborso
// minigames/types.ts
type MinigameResult = { done: boolean; score: number; medal: 'oro'|'argento'|'bronzo'|null; detail: Record<string, number> }
type MinigameModule<S> = { id: string; version: number; maxTicks: number; create(o: { seed: number; difficulty: 1|2|3 }): S; step(s: S, input: InputFrame): void; result(s: S): MinigameResult; autopilot(s: S, rng: Rng): InputFrame; view(s: S): unknown }
// minigames/registry.ts
MINIGAMES: Record<string, MinigameModule<unknown>> · getMinigame(id)
// minigames/regata/regata.ts   modulo `regata` (GDD §6); `view(s)` → { boat, buoys: {x,z,passed}[], next, ms, maxMs, wind, gust, done, finished, medals:{oro,argento,bronzo} (ms), radius, start:{x,z}, island:'laguna' }; export `regataMap()` e `regataCourse()` per il client
// minigames/lanterne.ts   modulo `lanterne` (GDD §6 n. 2); tocco = fronte di salita di `a` con mx = (lanterna + 1) / 8 → `tapFrame(i)`; `view(s)` → LanterneView { phase:'mostra'|'tocca', lit, litKind, len, pos, completate, giuste, ms, maxMs, done, wrong, expected, timeUp, medals, score }
// replay.ts
packInputs(frames: InputFrame[]): PackedInputs · unpackInputs(p): InputFrame[] · replay(id, seed, difficulty, p): MinigameResult
```
Test: `packages/sim/test/*.test.ts` con `node:test` (Node 26 esegue i `.ts` direttamente). Fixture d'oro in `packages/sim/test/fixtures/*.json`.

## 6. `@marea/protocol` (WP0) — `PROTOCOL_VERSION`, tipi `ClientMsg`, `ServerMsg`, `Peer`, `Look`, `parseClientMsg(text): ClientMsg | null`, `parseServerMsg(text): ServerMsg | null`. Vedi `PROTOCOL.md`.

## 7. Client (`apps/client`)
```ts
// flags.ts (WP0)   FLAGS = { fps, test, seed, nosound, quality: 'low'|'high', net, autopilot, zone }  (letti dall'URL, congelati)
// render/scene.ts (WP1)
createRenderer(o: { canvas: HTMLCanvasElement; flags: Flags }): Renderer
type Renderer = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; render(alpha: number, t: number): void; resize(): void; stats(): { drawCalls: number; triangles: number; fps: number; frameMs: number }; dispose(): void }
// render/camera.ts (WP1)   createDioramaCamera(o: { aspect: number; canvas: HTMLCanvasElement }) → { camera; follow(x: number, y: number, z: number): void; zoom: number; setZoom(z): void; update(dt: number): void; dispose(): void }   // pitch 45°, yaw 45°, FOV 30°, distanza 28 m × zoom ∈ [0,6, 1,6]; rotella + pinch
// render/light.ts (WP1)    createLights() → { group: THREE.Group; update(t: number): void }
// render/water.ts (WP1)    createWater(o: { size: number }) → { mesh: THREE.Object3D; update(t: number): void }
// render/sky.ts (WP1)      createSky() → { object: THREE.Object3D }   // bande a pixel
// render/pixel.ts (WP1)    pixelScale(flags): number   // 0,5 normale, 0,4 low
// render/island.ts (WP1)   createIsland(o: { map: GridMap; loader: Loader }) → Promise<{ group: THREE.Group }>   // moduli glTF dal manifest, fallback a box colorati dalla palette se un modello manca
// render/loader.ts (WP1)   createLoader(o: { base: string }) → Loader = { load(name: string): Promise<THREE.Group>; texture(name): Promise<THREE.Texture>; manifest: Manifest }   // NearestFilter, sRGB, cache; `manifest.json` in public/assets
// render/anim.ts (WP2)     createAnimator(root: THREE.Object3D, clips: THREE.AnimationClip[]) → { play(name: string, fadeS?: number): void; update(dt: number): void; current: string }
// game/input.ts (WP2)      createInput(o: { canvas: HTMLCanvasElement; root: HTMLElement; cameraYaw: () => number }) → { sample(): InputFrame; dispose(): void }   // WASD/frecce + joystick touch (#joystick) + bottoni #btnA #btnB creati dal modulo; Shift = b (corsa/freno); il vettore viene ruotato in assi mondo con cameraYaw()
// game/avatar.ts (WP2)     createAvatar(o: { loader: Loader; look: Look }) → Promise<{ object: THREE.Object3D; state: AvatarState; step(input: InputFrame, map: GridMap): void; update(alpha: number, dt: number): void }>
// game/boat.ts (WP2)       createBoat(o: { loader: Loader }) → Promise<{ object: THREE.Object3D; state: BoatState; step(input: InputFrame, map: GridMap): void; update(alpha: number, dt: number): void; setDriver(a: AvatarState | null): void }>
// game/world.ts (WP0, funzionante)   createGameWorld(o) → { step(input): void; update(alpha, dt, t): void; mode: 'walk'|'boat'; state(): unknown }   // orchestrazione: sale/scende dalla barca con `a` quando canBoard, chiama avatar/boat/net
// net/client.ts (WP4)      createNetClient(o: { url: string; token: string; build: string }) → NetClient = { connect(): void; close(): void; status: 'off'|'connecting'|'on'; me: Peer | null; peers(): Peer[]; sendPos(p): void; sendEmote(id): void; serverNow(): number; on(type: ServerMsg['t'], fn): () => void }   // 10 Hz, riconnessione con backoff; con FLAGS.net = 0 resta 'off' senza errori
// ui/hud.ts (WP0)          createHud(o: { root: HTMLElement; flags }) → { setPerf(s): void; toast(text: string, ms?: number): void }
// test/testapi.ts (WP0)    installTestApi() → registerStateProvider(key, fn) · registerPerfProvider(fn) · registerTestHook(name, fn) · setReady()
```
`window.__game = { ready: boolean, build: string, flags, state(): Record<string, unknown>, perf(): { drawCalls, triangles, fps, frameMs }, test: { teleport(x, z), setMode('walk'|'boat'), setZoom(z), ... } }`. Gli hook mutanti funzionano solo con `?test=1`. Ogni scena/modulo registra il suo pezzo di `state()`: `avatar`, `boat`, `camera`, `net`, `island`.

## 8. Server (`apps/server`, WP4)
- `wrangler.jsonc`: `assets` = `../client/dist` con `run_worker_first: ["/api/*", "/ws/*"]`; D1 `DB`; DO `ZONE` (classe `Zone`), `LOT` (classe `Lot`), `new_sqlite_classes`.
- `src/worker.ts`: router `/api/*` (`GET /api/ping` esiste), `/ws/zone/:id` → `Zone.fetch` (upgrade). Errori JSON in italiano.
- `src/do/Zone.ts`: `hello/welcome/pos/snap/join/leave/ping/pong`, Hibernation API (`acceptWebSocket`, `webSocketMessage`, `webSocketClose`), `snap` a 10 Hz solo con delta, max 32 connessioni.
- `src/do/Lot.ts`: stato `LotState` in SQLite del DO, `advance` a ogni lettura, azioni economiche (M1), replay minigiochi (M1).
- `src/auth.ts`: `personaDaToken(env, token)` (D1 `persone`); `src/db.ts` query tipizzate. `migrations/0001_init.sql`: `persone`, `inviti`.
- Test: `tests/e2e/wp4_net.mjs` avvia `wrangler dev --local --port <libera>` da `apps/server` e apre due browser che si vedono in `snap`.

## 9. Asset (WP5) — vedi `ART_BIBLE.md`
`apps/client/public/assets/manifest.json` = `{ atlas: 'atlas.png', models: { [name]: { file, tris, bounds } }, version }`. Nomi obbligatori per Fase B: `mod_sabbia`, `mod_sabbia_bordo`, `mod_erba`, `mod_scogliera`, `mod_molo`, `bld_segheria_l1`, `bld_cava_l1`, `bld_casa_l1`, `boat_barca`, `prop_lanterna`, `prop_torii`, `prop_palma`, `prop_cassa`, `prop_insegna_neon`, `prop_barile`, `chr_base` (con clip `idle walk run sit row`). Sorgenti in `assets/blender/`, atlas sorgente `assets/atlas/atlas.png`, licenze in `assets/licenses.md`. `tools/export_gltf.py` gira con `/Applications/Blender.app/Contents/MacOS/Blender -b <file>.blend -P tools/export_gltf.py -- <out>`.

## 10. Test (WP6) — `tests/run.mjs [static|types|sim|boot|look|perf|net|<wpN_x>|contact|all] [--no-build] [--keep]`
- `static` → `tools/check_static.mjs` (regole TECH §3) · `types` → `tools/check_types.mjs` · `sim` → `node --test packages/sim/test/`.
- e2e: build in `tests/out/dist-<pid>` + server statico su porta libera (o `wrangler dev` per `net`), Playwright su **Chrome di sistema** (`channel: 'chrome'`), viewport iPhone 390×844 con `deviceScaleFactor` 2 e uno 1280×720. ctx: `open(query)`, `waitReady(page)`, `waitState(page, fn, ms)`, `getState(page)`, `shot(page, name)`, `screenStats(page)`, `test(name, fn)`, `noErrors(page)`.
- `boot`: pagina senza `pageerror`, `__game.ready` entro 8 s, canvas non vuoto (varianza > 50). `look`: screenshot delle viste (molo, mare, isola dall'alto, zoom min/max). `perf`: 20 s di navigazione con autopilot, `perf()` entro budget. `contact`: `tests/out/contact.png` con ffmpeg.
- `tools/build.mjs` fa fallire la build oltre i budget di TECH §5; `tools/deploy.mjs` applica le migrazioni, deploya, e attende `/version.json` con lo stesso `build`.

## 11. M1 · Fetta 1 «L'arcipelago e l'isola che produce» (Sessione 2, 30 set 2026)
Obiettivo: entri col tuo link, **spawni sul molo della tua isola** in un arcipelago condiviso (Porto al centro, un'isola per amico attorno, laguna della Regata), vedi le tue risorse, **costruisci, raccogli, migliori**; l'isola produce mentre sei offline; vai in barca al Porto e alle isole degli altri (sola lettura). Sfide/Regata giocabile = Fetta 2.

**Decisioni (WP0)**
- **Un solo mondo continuo**: `packages/content/src/archipelago.json` = `{ id, w, h, tile: 2, islands: [{ island: <id di islands.json>, at: [cx, cz], role: 'porto'|'lotto'|'facciata'|'laguna', slot?: number }] }`. `composeArchipelago(ARCHIPELAGO, ISLANDS)` in `@marea/sim/world/archipelago.ts` → un `GridMap` unico (resto = `~`) + `lots: { slot, origin: [cx, cz], template: string }[]` + `porto: { origin }`. La sim (collisioni avatar/barca) usa quel `GridMap`: niente cambi di mappa.
- **Presenza**: una sola zona WebSocket `porto` per tutto l'arcipelago in V1 (≤ 32 connessioni, basta per il gruppo). `lotto:<id>` resta nel protocollo per il futuro.
- **Lotti**: tutte le isole personali usano lo stesso template `lotto` (islands.json) con celle `L` = slot edificio e `d` = molo. Ogni persona ha uno `slot` (0-7) nel D1 (`persone.slot`, assegnato all'invito, il primo libero). **Le celle di `LotState` sono locali al template** (`[cx, cz]` dall'angolo in alto a sinistra dell'isola `lotto`); il mondo = `origin + cell`. Il server valida che `build` usi una cella `L` del template libera.
- **Spawn**: sul molo del proprio lotto (la `P` del template); senza token o senza slot, al Porto.
- **API client**: un solo modulo HTTP `apps/client/src/net/api.ts` (token in `X-Token`, errori `{ error, manca? }` in italiano) usato dalla vista del lotto.

**Proprietà dei file in questa fetta**
| WP | Possiede |
|---|---|
| **WP0** | `docs/**`, `world.ts` solo nell'integrazione finale, `main.ts`, `flags.ts`, `index.html`, `packages/protocol/**`, `tests/run.mjs`, `tools/**` tranne `build_assets.mjs`/`export_gltf.py` |
| **M1-mondo** (Opus) | `packages/content/src/{archipelago,islands}.json`, `packages/content/src/{index,types,schema}.ts` (solo aggiunte), `packages/sim/src/world/**`, `packages/sim/test/world*.test.ts`, `apps/client/src/render/**`, `apps/client/src/game/{avatar,boat,input}.ts`, `apps/client/src/game/world.ts` (fino all'integrazione), `tests/e2e/m1_mondo*.mjs` |
| **M1-isola** (Opus) | `apps/client/src/game/lot.ts` (nuovo), `apps/client/src/net/api.ts` (nuovo), `apps/client/src/ui/**`, `tests/e2e/m1_isola*.mjs` |
| **M1-server** (Opus) | `apps/server/**`, `apps/client/src/net/client.ts`, `packages/sim/src/{economy,minigames}/**`, `packages/sim/src/replay.ts`, `packages/sim/test/{economy,regata,challenge}*.test.ts`, `packages/content/src/{balance,decor,buildings}.json`, `tests/e2e/wp4_*.mjs`, `tests/e2e/m1_server*.mjs` |
| **M1-asset** (Opus) | `assets/**`, `tools/{build_assets.mjs,export_gltf.py}`, `apps/client/public/assets/**` |
Richieste tra WP in `tests/out/richieste/m1-<wp>.md`. Nessun agente fa deploy, commit o push.

## 12. M1 · Fetta 2 «Regata sulla laguna e Tavolo delle Sfide» (Sessione 3, 30 set 2026)
Obiettivo (PC prima: tastiera + mouse; il touch resta com'è): dal Porto premi **E** vicino al Tavolo, scegli un amico e una posta, giochi la Regata sulla **laguna**, il server rigioca i tuoi input e dà l'esito.

**Decisioni (WP0)**
- La regata si gioca sulla mappa `laguna` (islands.json), non più `prova`; `regata.version` → 3. Le coordinate della sim sono **locali all'isola**: il client aggiunge `arch.laguna.origin × tile` (≈ (636, 508) m) per disegnare.
- Il client registra **un `InputFrame` per tick** (60 Hz, assi mondo, `a`/`b`), poi `packInputs` (`packages/sim/src/replay.ts`, quantizzati a 1/32) e `POST /api/challenges/:id/play`. Nessun conto economico nel client: punteggio, medaglia ed escrow li decide il server.
- Legame tra i due WP client (interfaccia fissa):
  - `apps/client/src/game/regata.ts` esporta `runRegata(o: { challenge: { id: string; minigame: string; difficulty: string; seed: number; [k: string]: unknown }; signal?: AbortSignal }): Promise<PackedInputs | null>`: porta la barca alla partenza, fa correre la gara con HUD, restituisce gli input (null = annullata con Esc).
  - `apps/client/src/ui/tavolo.ts` esporta `createTavolo(o: { api: Api; me: Me; play: (challenge) => Promise<PackedInputs | null>; onClose?: () => void }): { open(): void; close(): void; isOpen(): boolean }`. Il Tavolo chiama `play`, poi `api.play(id, inputs)` e mostra l'esito. Il campo esatto delle sfide lo dà PROTOCOL §4 / `apps/server/src/do/Sfide.ts`.
- Da PC: **E** vicino al Tavolo apre il pannello, **Esc** chiude/annulla, frecce + Invio scelgono amico e posta; in gara WASD/frecce guidano la barca (non l'avatar), **Spazio/E** = `a`, **Shift** = `b`; input azzerati su `blur`/`visibilitychange`; camera non ruotabile in gara.

**Proprietà dei file in questa fetta**
| WP | Possiede |
|---|---|
| **WP0** | `docs/**`, `tests/run.mjs`, `tools/**` tranne `build_assets.mjs`/`export_gltf.py` |
| **F2-sim** (Opus) | `packages/sim/src/minigames/regata/**`, `packages/content/src/minigames/regata.json`, `packages/content/src/{archipelago,islands}.json` (solo aggiunte per la laguna), `packages/sim/test/{regata,challenge}*.test.ts` e fixture d'oro |
| **F2-regata** (Opus) | `apps/client/src/game/regata.ts` (nuovo), `apps/client/src/main.ts`, `apps/client/src/game/world.ts`, `game/input.ts`, `apps/client/src/render/**` (solo boe/percorso), `apps/client/src/ui/hud.ts` per l'HUD di gara |
| **F2-tavolo** (Opus) | `apps/client/src/net/api.ts`, `apps/client/src/ui/tavolo.ts` (nuovo), `apps/client/src/ui/style.ts` (solo aggiunte) |
| **F2-test** (Sonnet, dopo gli altri) | `tests/e2e/m1_regata*.mjs`, `tests/e2e/m1_tavolo*.mjs` |
`main.ts` lo tocca solo F2-regata: cabla `createTavolo` (F2-tavolo) e il tasto E sul Tavolo. Richieste tra WP in `tests/out/richieste/f2-<wp>.md`. Nessun agente fa deploy, commit o push.

## 13. M1 · Fetta 3 «Avatar editor, emote, feed» (Sessione 4, notte del 30 set 2026)
Obiettivo (PC prima; il telefono a 390×844 non si rompe): **C** apre l'editor dell'avatar (anteprima dal vivo sul proprio avatar, Esc annulla, Salva, cappelli a Perle con «Compra»); **1-4** fanno le emote (fumetto sopra la testa, visto anche dagli altri); **F** e la campanella aprono il feed «Anna ti sfida / hai vinto 20 Legno». Pulizie della Fetta 2: `boat.setState`, `tavolo.ts` diviso.

**Decisioni (WP0)**
- **Look in presenza**: nessun messaggio WS nuovo. `POST /api/look` (già esistente) salva in D1 e poi il Worker avvisa `Zone('porto')` con una richiesta interna `POST https://zone/look` (`x-persona`, corpo `Look` già validato dal Worker, cappelli a Perle compresi); la Zone aggiorna l'attachment dei socket vivi di quella persona (anche prima dell'`hello`), lo segna sporco e il prossimo `snap` porta il look nuovo. Best-effort: se l'avviso fallisce la POST risponde comunque `{ ok }`. Il client non cambia (`world.updateRemotes` segue già `peer.look`). `PROTOCOL_VERSION` resta 1.
- **Look locale**: `createGameWorld({ …, look?: Look })` (da `me.look`) + `world.setLook(l)` (avatar, guidatore della barca, look usato a bordo) + `world.look` in lettura. Fatto da WP0.
- **Feed**: tabella `feed (id INTEGER PRIMARY KEY AUTOINCREMENT, persona TEXT, quando INTEGER, tipo TEXT, sfida TEXT, altro TEXT, dati TEXT, letto INTEGER DEFAULT 0)` nel SQLite del DO `Sfide`, massimo 100 righe per persona. Tipi: `sfida_ricevuta` (a `to`, quando lo sfidante ha giocato: stato `aperta`), `sfida_accettata` (a `from`), `sfida_rifiutata` (a `from`), `sfida_scaduta` (a `from`; anche a `to` se la sfida era `aperta`/`accettata`), `sfida_chiusa` (a entrambi: netto `pot − stake` a chi vince, `−stake` a chi perde, 0 in parità; Perle da `perleFor` in `@marea/sim/economy/rewards.ts`). Niente riga alla creazione. La riga si scrive **nello stesso blocco sincrono** del `put` che registra il passaggio di stato (anche nello `sweep`: scadenza e recupero `accettando`); le righe per chi fa l'azione nascono lette. Le rotte `feed`/`feed_letto` passano da `locked()` + `sweep(now)` come le altre.
- **Testo del feed** composto nel Worker in lettura (`apps/server/src/feed.ts`, funzione pura) con i nomi da `elencoPersone`: il DO non legge D1. Testi brevi in italiano: «Anna ti sfida alla Regata: posta 20 Legno. Rispondi al Tavolo entro 24 h» · «Bruno ha accettato la tua sfida» · «Hai battuto Bruno: +20 Legno, +10 Perle» · «Bruno ti ha battuto: −20 Legno, +2 Perle» · «Pari con Bruno: posta restituita, +5 Perle» · «Bruno ha rifiutato: posta restituita» · «La sfida con Bruno è scaduta: posta restituita».
- **HTTP** (PROTOCOL §4): `GET /api/feed` → `{ items: FeedItem[], nonLetti, now }` (ultimi 30, recenti prima) · `POST /api/feed/letto` `{ fino?: id }` → `{ ok, nonLetti }`.
- **Tipi** in `@marea/protocol` (fatti): `FeedTipo`, `FeedItem = { id; quando; tipo; testo; sfida?; da?; letto }`.
- **Emote**: fumetto DOM a pixel proiettato dalla camera (niente clip in `chr_base`: richiesta in `tests/out/richieste/f3-emote.md`); pausa minima 1,5 s nel client e 800 ms per socket nella Zone; niente eco a chi la manda. `net.on('emote')` funziona già (il client emette dopo lo switch).
- **Tasti** (un solo listener in `main.ts`, fase bubble su `window`, fatto da WP0; ignora `repeat` e modificatori): `KeyC` editor, `KeyF` feed, `Digit1-4`/`Numpad1-4` emote nell'ordine di `avatar.json` `emote`. Non valgono con Tavolo aperto, `#mzSheet.on` o gara in corso; un pannello alla volta (aprirne uno chiude l'altro; `#mzSheet.on` li chiude). I pannelli aperti ascoltano `keydown` in **capture** su `window` con `stopPropagation` (mai `keyup`, altrimenti i tasti restano incollati in `input.ts`), come il Tavolo; Esc e il proprio tasto (C/F) li chiudono. `world.frozen = (tavolo.isOpen() || editor.isOpen() || feed.isOpen()) && !regata.active`.
- **Barra in alto** (`ui/topbar.ts`, WP0, fatto): `#mzTop`, bottoni 44×44 in palette. ≥ 700 px: `top: max(8px, safe-top)`, `right: 8px`, in riga. < 700 px: `top: safe-top + 52px`, `left: 8px`, in colonna. Ordine: 1 `#mzFeedBtn` (campanella con badge), 2 `#mzEditorBtn`, 3 `#mzEmoteBtn` (solo con `pointer: coarse`). Nascosta in gara (`setTopbarHidden`). Pannelli editor/feed: classe `mz-sheet mz-side` (in `style.ts`): ≥ 700 px a destra `top: 60px; right: 8px; bottom: 8px; width: 340px`; < 700 px foglio dal basso con `max-height: 46%`.
- **Interfacce fisse** (stub funzionanti di WP0 già cablati in `main.ts`; i proprietari sostituiscono il corpo tenendo firma e id):
  - `ui/topbar.ts`: `topButton(o: { root; id; order; label; title; onClick(): void }) → { el: HTMLButtonElement; setBadge(n): void; setOn(on): void }` · `setTopbarHidden(h): void`
  - `net/api.ts` (+, fatto): `look(l: Look): Promise<void>` · `buyHat(id: string): Promise<LotState>` · `feed(): Promise<{ items: FeedItem[]; nonLetti: number }>` · `feedRead(fino?: number): Promise<number>`
  - `ui/editor.ts`: `createEditor(o: { api; me: Me; root?; avatar: { setLook(l: Look): void }; onSaved?(l: Look); onLot?(lot: LotState); onOpen?(); onClose?() }) → { open(); close(); toggle(); isOpen(): boolean }`; pannello `#mzEditor`, bottone `#mzEditorBtn`; `state().editor = { open, draft, saved, owned, perle }`
  - `ui/feed.ts`: `createFeed(o: { api; hud: Hud; root?; pollMs?; onOpen?(); onClose?() }) → { refresh(): Promise<void>; open(); close(); toggle(); isOpen(): boolean; readonly unread: number }`; pannello `#mzFeed`, bottone `#mzFeedBtn`; `state().feed = { unread, open, lastId, items }`, hook `feedRefresh()`
  - `game/emote.ts`: `createEmotes(o: { world: GameWorld; camera: THREE.Camera; canvas; root }) → { play(id: EmoteId): boolean; update(dt): void; dispose(): void }`; `state().emotes`, hook `emote(id)`
  - `game/world.ts` (+, fatto): `look`, `setLook(l)`, `anchorOf(id: 'me' | peerId) → { x, y, z } | null` (testa: avatar +1,9 m; in barca: barca +1,5 m)
  - `game/boat.ts` (+): `setState(s: BoatState): void` (`prev = state; state = s`, senza `newBoat`)
  - hook già cablati: `test.openEditor()`, `test.openFeed()`, `test.emote(id)`, `test.openTavolo()`

**Proprietà dei file in questa fetta**
| WP | Possiede |
|---|---|
| **WP0** (fatto prima del lancio, poi solo integrazione) | `docs/**`, `packages/protocol/**`, `apps/client/src/ui/topbar.ts`, `apps/client/src/net/api.ts`, `apps/client/src/ui/style.ts` blocco `/* WP0 F3 */`, `tests/run.mjs`, `tests/e2e/m1_integrazione.mjs`, `tools/**` tranne `build_assets.mjs`/`export_gltf.py` |
| **F3-server** (Opus) | `apps/server/**` (`do/Zone.ts`, `do/Sfide.ts`, `worker.ts`, `feed.ts` nuovo), `tests/e2e/m1_server_f3.mjs`, `tests/e2e/wp4_*.mjs` (solo se servono ritocchi) |
| **F3-avatar** (Opus) | `apps/client/src/ui/editor.ts` (+ `ui/editor_parts.ts` se supera 400 righe), `apps/client/src/ui/style.ts` (solo aggiunte nel blocco `/* F3-avatar */`), `tests/e2e/m1_editor*.mjs` |
| **F3-emote-feed** (Opus) | `apps/client/src/game/emote.ts`, `apps/client/src/ui/feed.ts` (CSS nel suo `<style>`), `apps/client/src/game/world.ts`, `apps/client/src/game/avatar.ts` (solo un `gesture` facoltativo), `apps/client/src/main.ts`, `tests/e2e/m1_emote*.mjs`, `tests/e2e/m1_feed*.mjs` |
| **F3-pulizia** (Sonnet) | `apps/client/src/game/boat.ts` (solo `setState`), `apps/client/src/ui/tavolo.ts`, `apps/client/src/ui/tavolo_viste.ts` (nuovo) |
Richieste tra WP in `tests/out/richieste/f3-<wp>.md`. Nessun agente fa deploy, commit o push. Se la build si rompe per un file altrui in lavorazione: riprova tra un minuto, giudica solo i tuoi file. Budget: `app.js` 766/900 KB (gzip 206,7/250): niente immagini o font nuovi, icone a pixel in CSS o `<canvas>` con i colori di `PAL`.

**Com'è finita (consegna degli agenti, stessa notte)**
- Stato e DOM definitivi: `state().editor = { open, draft, saved, owned, perle, busy, note }` · `state().feed = { unread, open, lastId, seenId, items (numero), polls, pollMs, badge }` · `state().emotes = { cooldown, last, coarse, row, shown: [{ who, id, x, y, on, age }] }`. DOM: `#mzEditor` (righe `.mz-ed-row`, piede fisso Annulla/Salva), `#mzFeed .mz-feed-row[data-feed][data-tipo]` (`.new` = non letta o letta in questa apertura), `#mzEmotes > .mz-emote[data-who][data-emote]`, telefono `#mzEmoteRow.on > .mz-emote-pick[data-emote]`.
- `emotes.play(id)` rifiuta (false) anche con `world.frozen` (Tavolo/editor/feed aperti) e in gara, non solo durante la pausa. Col feed aperto il tasto **C** non viene fermato: arriva a `main.ts`, che chiude il feed e apre l'editor.
- Server: righe del feed e `put` della sfida in un'unica transazione (`transactionSync`) con antidoppione per persona + sfida + tipo; la scadenza nasce non letta per entrambi; il DO risponde `{ rows, nonLetti }` e il Worker compone `items` (`FeedItem.da` = l'altra persona). Tabella in `apps/server/src/do/feedStore.ts`, testi in `apps/server/src/feed.ts`.
- `boat.setState` c'è e `world.race.set` lo usa. `tavolo.ts` 286 righe + `tavolo_viste.ts` 235 (`View` e `Note` esportati da `tavolo.ts`, `fmtGara` definita nelle viste e riesportata).
- Aperte: clip di animazione per le emote (`tests/out/richieste/f3-emote.md`, BACKLOG); nomi «umani» dei colori in `avatar.json` (oggi nomi della palette); messaggio del 409 su «Compra».

## 14. Prova con gli amici «capire da soli» (Sessione 5, 30 set 2026)
Obiettivo: un amico che apre MAREA capisce da solo che con la barca va sulle altre isole, che ci sono minigiochi, che con le risorse si costruisce. Fatto dall'orchestratore, senza agenti.
- **Arcipelago** (`archipelago.json`): 290×240 celle; Porto `[110,120]`, Laguna `[170,113]`, lotti 0-7 attorno (0 tra Porto e Laguna, il migliore). Le celle di `LotState` sono locali al template: spostare i lotti non tocca gli stati salvati.
- **Sim** (`economy/rewards.ts`, `economy/types.ts`): `LotState.solo?: { day, premiate, giocate, pending: { minigame, seed, difficulty, startMs } | null }`; `soloOf`, `soloPrize(medal)`, `soloLeft`, `startSolo(lot, minigame, seed, now)`, `finishSolo(lot, medal, now) → { lot, premio, premiata }` (errore `partita` senza partita aperta). Test `packages/sim/test/solo.test.ts`.
- **Server**: `Lot` gestisce `solo_start` / `solo_play` (replay con `@marea/sim/replay.ts`); il Worker espone `/api/solo/start` e `/api/solo/play` (corpo fino a 128 KB).
- **Client**: `game/minigiochi.ts` (posti dei minigiochi: boa grande `prop_boa_next` ×1,8 + cartello DOM, bottone `#mzPlay` e A vicino a 16 m, scheda `#mzEsito` con RIGIOCA/OK, premio che vola nella barra; `state().minigiochi = { spots, near, busy, open, played, last }`, hook `playSpot(id)`, `closeEsito()`) · `ui/guida.ts` (scheda `#mzGuida`, freccia `#mzGuidaPtr`; `state().guida = { done, total, current, pointer }`; progresso in `localStorage` `marea:guida:<id>`) · `ui/compass.ts` (freccia con asta `ARROW_SVG`, icone, `focus(id)`; sul telefono compatta e sotto il chip del cantiere) · `ui/icons.ts` (`pixIcon`: casa, porto, regata, martello) · `game/lot.ts` (cartelli «Costruisci» `.mz-lbl.slot` sugli slot liberi, `.hint` sullo slot suggerito; opzioni `hint` e `hide`; `state().lot.slotSigns`) · `ui/lotpanels.ts` (`PanelCtx.hide`) · `net/api.ts` (`soloStart`, `soloPlay`) · `flags.ts` (`sfide`) · `main.ts` (cablaggio, passi della guida, zoom iniziale 1,6).
- **Sfide con posta spente di default**: senza `?sfide=1` niente Tavolo al Porto, niente campanella del feed, niente Tavolo nel pannello Costruisci. I test di Tavolo, feed, emote, editor e regata aprono con `&sfide=1`. Test nuovo `tests/e2e/m1_solo.mjs` (giro completo del primo avvio).

## 15. Mondo Sotterraneo «dungeon e personaggio» (Sessione 8, 6 ott 2026)
Design: `docs/RPG.md` (dal documento di Riccardo). Obiettivo: dagli ingressi sulle isole si scende in 3 dungeon, si combatte (mischia normale/caricata, archi, magie, pozioni), si raccoglie bottino, si esce; sull'isola Banco da Lavoro (forgia), Tavolo Alchemico (pozioni), Forziere (deposito), Serra (ingredienti); scheda del personaggio (livelli, abilità, perk, inventario a peso, equipaggiamento).

**Decisioni (WP0)**
- **Un dungeon è una partita deterministica** come la Regata, lunga fino a `RPG.dungeon.maxMinuti` (20). `POST /api/dungeon/start {dungeon}` → il DO del lotto sceglie il seed e fotografa il personaggio (`runHeroOf(hero)` → `RunHero`, salvato in `lot.dungeon.pending`); il client gioca con `dungeon.create({ seed, dungeon, hero })` registrando un `DungeonInput` per tick (`quantizeDungeon`); `POST /api/dungeon/finish {inputs, hash}` → il DO rigioca (`replayDungeon`) e applica il risultato del server (`finishDungeon`). Il client mostra **l'esito del server**; se l'hash del client è diverso il DO lo scrive nel log (`[marea] dungeon hash diverso`), non è un errore.
- **Determinismo cross-motore**: in `packages/sim/src/dungeon/**` niente funzioni trascendenti (`Math.sin/cos/atan2/hypot/pow/...`, `**`): direzioni come versori, distanze con `Math.sqrt(dx*dx+dz*dz)`. Lo controlla `check_static`.
- **Il personaggio sta nel lotto**: `LotState.hero?: HeroState`, `LotState.forziere?: Record<string, number>`, `LotState.dungeon?: { pending }`. Niente D1, niente migrazioni: viaggia già con `/api/me`, `/api/lot` e ogni risposta che restituisce il lotto.
- **Contenuti** in `packages/content/src/rpg/*.json`, tipi in `rpg_types.ts`, entry **separata** `@marea/content/rpg.ts` (non `index.ts`). Sim: `@marea/sim/rpg/*.ts` e `@marea/sim/dungeon/*.ts`, **non** esportati da `@marea/sim` (index.ts): si importano per percorso.
- **Bundle**: nel client tutto il GDR vive in `apps/client/src/rpg/**` e si carica con `import('../rpg/index.ts')` (chunk a parte). Fuori da `rpg/` solo `import type` dai moduli GDR (lo controlla `check_static`). Budget: JS iniziale invariato (900/250 KB), chunk caricati dopo ≤ 300 KB (gzip 90), modelli del GDR in `assets/manifest_rpg.json` ≤ 1,5 MB (scaricati con `loader.extend('manifest_rpg.json')` entrando in un dungeon); nel manifest principale solo ingressi ed edifici dell'isola.
- **Edifici nuovi** (buildings.json, celle `L` nuove nel template `lotto`): `banco` Banco da Lavoro, `alchimia` Tavolo Alchemico, `forziere` Forziere (capienza in kg `RPG.forziere[lv-1]`), `serra` Serra (produce ingredienti come la Segheria produce Legno; si raccolgono con l'azione `{ t: 'serra' }` e vanno nel Forziere, o nello zaino se il Forziere non c'è).
- **Input nel dungeon**: A attacca (tocco = normale; tenuto = carica/tende l'arco; sulla scala d'uscita = esci), B corri, C magia, D pozione. PC: Spazio/E/clic sinistro = A, Shift = B, Q = C, R = D. Telefono: joystick + 4 bottoni (A grande, B, C, D). Mira assistita nella sim.
- **Colpi di mischia ad arco** (7 ott 2026, dungeon v3, `sim/dungeon/swing.ts`, numeri in `tuning.ts` `COLPI`): la lama spazza un arco da destra a sinistra tra due fasi dello swing e colpisce ogni nemico in portata quando gli passa sopra (una volta per swing). Stili: `fendente` 150° (armi da taglio e botta), `affondo` 40° (lancia), `pugno` 100°, `giro` 360° = caricato pieno (dura `GIRO_TEMPO`× uno swing). L'angolo di un vettore è un arcotangente polinomiale (`angolo`, solo + − × ÷). Il client anima braccio, arma e scia con le stesse funzioni (`bladeAngle`, `swept`): quel che si vede è quel che colpisce.
- **Morte**: si perde il bottino della spedizione (`RPG.dungeon.morte.bottino` = 0), si tiene l'xp; usati e rotti restano persi.
- **Altari** (7 ott 2026, dungeon v2, `sim/dungeon/altari.ts`): legenda `{ altare: true }` (lettera `A`) → `DMap.altari`. Entrando su un altare la sim salva `s.salvato = { altare, tick, bottino, monete }` ed emette `{ t: 'altare', n }` (solo se cambia altare o bottino). Morte con `salvato` = `risveglio`: eroe sull'altare, barre piene, `bottino/monete` = quelli salvati, `protetto` per `RPG.dungeon.altare.protezione` s (niente danni), nemici senza aggro, evento `{ t: 'risveglio', n }`, `cadute++`; la partita continua. `RunResult.salvato` e `cadute` (facoltativi); `finishDungeon` tiene sempre `salvato` (anche con morte, tempo, `outcome` null) e somma `cadute` a `hero.morti`. Il client, all'evento `altare`, manda gli input fin lì a `POST /api/dungeon/save`: il DO li rigioca e li tiene in `pending.salvataggio = { inputs (encodeDungeon), ticks }` (uno più vecchio non copre uno più nuovo). Una spedizione con salvataggio mai chiusa la chiude `chiudiSalvata` (`sim/dungeon/settle.ts`) alla `dungeon/start` successiva (risposta con `recuperato: { tenuto, monete }`) o `chiudiScaduta` in `Lot.load` dopo `maxMinuti` + 5 min. Esc con un altare toccato consegna gli input (finish con `outcome` null: «SEI RISALITO» col bottino dell'altare).

**Interfacce fisse** (stub di WP0 già nel repo, firme definitive: sostituisci il corpo)
- `@marea/content/rpg.ts`: `RPG, MATERIALS, WEAPON_TYPES, ITEMS_RAW, SPELLS, PERKS, RECIPES, ENEMIES, LOOT, DUNGEONS, SKILLS, ATTRS, dungeonDef(id), enemyDef(id), spellDef(id)`; tipi in `rpg_types.ts`.
- `@marea/sim/rpg/types.ts`: `HeroState, ItemDef, HeroDerived, RunHero (RunWeapon, RunArrows, RunArmor, RunSpell, RunPotion), RunResult, RunOutcome, RpgAction, EquipSlot, DungeonPending`.
- `@marea/sim/rpg/items.ts`: `ITEMS, itemDef(id), hasItem(id)` · `hero.ts`: `newHero(), heroOf(lot), heroDerived(h), runHeroOf(h), gainSkillXp(h, skill, xp), carried(h)` · `actions.ts`: `applyRpgAction(lot, a, nowMs) → LotState` (EconomyError), `parseRpgAction(v) → RpgAction | null` · `run.ts`: `startDungeon(lot, dungeon, seed, nowMs)`, `finishDungeon(lot, result, nowMs) → { lot, tenuto, monete, livelliSu }`, `regataXp(lot, medal)`.
- `@marea/sim/dungeon/types.ts`: `DungeonInput, PackedDungeon, DungeonView, DungeonEvent, HeroAnim, EnemyAnim, DungeonModule` · `dungeon.ts`: `dungeon: DungeonModule<DungeonState>` · `replay.ts`: `quantizeDungeon, packDungeon, unpackDungeon, isPackedDungeon(v, maxTicks), replayDungeon(seed, dungeonId, hero, packed) → RunResult` · `swing.ts`: `SwingStyle, swingStyle(arma, caricato), swept(stile, t), bladeAngle(stile, t), sweepTo(stile, fx, fz, dx, dz, r, addosso), angolo(y, x)`. `DungeonView.hero.stile?: SwingStyle` (solo durante `attacca`).
- **HTTP** (Worker → DO Lot, errori `{ error, code, manca? }` in italiano): `POST /api/rpg {azione: RpgAction}` → `LotState` · `POST /api/dungeon/start {dungeon}` → `{ dungeon, seed, hero: RunHero, lot }` · `POST /api/dungeon/save {inputs, hash}` (corpo ≤ 512 KB) → `{ ok, salvato, ticks }` (409 `altare` se negli input non c'è un altare toccato) · `POST /api/dungeon/finish {inputs: PackedDungeon, hash: number}` (corpo ≤ 512 KB) → `{ result: RunResult, tenuto, monete, livelliSu, lot }`. `dungeon/start` risponde anche `recuperato`. La Regata da solo dà xp di Navigazione (`regataXp` in `solo_play`).
- `net/api.ts` (+): `rpg(a: RpgAction): Promise<LotState>` · `dungeonStart(id): Promise<{ dungeon; seed; hero: RunHero; lot: LotState }>` · `dungeonFinish(inputs, hash): Promise<{ result: RunResult; tenuto; monete; livelliSu; lot: LotState }>`.
- `render/scene.ts` (+, fatto): `renderer.setScene(s | null)` · `render/loader.ts` (+, fatto): `loader.extend(file)` · `game/lot.ts` (+, fatto): `lotView.set(l)` · `main.ts` (fatto): `body.mz-sotto` mentre sei nel dungeon (il chunk nasconde con CSS bussola, topbar, guida, risorse), hook `openHero`, tasto I.
- `apps/client/src/rpg/index.ts` (entry del chunk): `startRun(ctx: RunCtx, o: { dungeon; seed; hero: RunHero }): DungeonRun` con `DungeonRun = { readonly active: boolean; step(f: InputFrame): void; update(alpha, dt, t): void; abort(): void; readonly done: Promise<{ inputs: PackedDungeon; hash: number } | null> }` · `showResult(ctx, r): Promise<void>` (scheda dell'esito del server) · `openHero(ctx: PanelCtx)` · `openBuilding(ctx: PanelCtx, kind: 'banco' | 'alchimia' | 'forziere' | 'serra')` · `closePanels()` · `isPanelOpen()`. `RunCtx = { world; renderer; loader; hud; root; canvas }`, `PanelCtx = { api; hud; root; getLot(): LotState | null; setLot(l: LotState): void }`.
- `game/ingressi.ts` (bundle iniziale, piccolo): `createIngressi(o: { world; renderer; loader; api: Api | null; hud; root; canvas; getLot(): LotState | null; setLot(l: LotState): void }) → { spots: { id; nome; x; z; icon }[]; tick(a: boolean): void; step(f: InputFrame): void; update(alpha, dt, t): void; readonly active: boolean; isBusy(): boolean }`. In `main.ts`: `if (ingressi.active) ingressi.step(f)` al posto di `world.step`; la bussola mostra gli ingressi.
- `ui/eroe.ts` (bundle iniziale, piccolo): `createEroe(o: PanelCtx) → { open(): void; close(): void; isOpen(): boolean; openBuilding(kind): void }`, bottone `#mzHeroBtn` in topbar (tasto **I**). `ui/lotpanels.ts`: per `banco/alchimia/forziere/serra` il foglio dell'edificio ha un bottone d'azione («Forgia», «Prepara», «Apri», «Raccogli») che chiama `eroe.openBuilding(kind)`.
- **Test** (`?test=1`): `state().dungeon = { active, dungeon, tick, outcome, hero: { x, z, vita, magicka, stamina }, nemici, vivi }` · `state().eroe = { open, livello, carico }` · hook `enterDungeon(id)` (porta all'ingresso e entra), `dungeonAutopilot(on)`, `dungeonAltare(n)` (cammina fino all'altare n con input veri), `dungeonPosa(p | null)` (forza i campi della vista dell'eroe per la resa: `anim, t, stile, carica, fx, fz`; la sim non cambia, serve per gli screenshot delle pose), `openHero()`. In `state().dungeon` anche `altari, salvato, cadute, protetto`; in `state().ingressi` `salvataggi, recuperato`.

**Modelli** (ART_BIBLE; pivot a terra al centro, −Z avanti)
- Manifest principale: `prop_ingresso_grotta`, `prop_ingresso_cripta`, `prop_ingresso_vuoto` (4×4 m) · `bld_banco_l1..l3`, `bld_alchimia_l1..l3`, `bld_forziere_l1..l3`, `bld_serra_l1..l3`.
- `manifest_rpg.json`: kit per stile (`grotta`, `cripta`, `vuoto`): `dng_<stile>_pavimento` (2×2 m), `dng_<stile>_muro` (2×2×2,4 m), `dng_<stile>_muro_basso` (2×2×0,6 m: i muri tra camera e eroe), `dng_colonna`, `dng_torcia` (emissiva), `dng_forziere`, `dng_forziere_aperto`, `dng_scala` (uscita), `dng_libro`, `dng_ossa`, `dng_cristallo`, `prop_sacco` (bottino a terra) · nemici `nem_bandito, nem_lupo, nem_ragno, nem_scheletro, nem_nonmorto, nem_re_ossa, nem_spettro, nem_golem, nem_custode` (statici, animati a mano nel client; ≤ 600 tri, i boss ≤ 1.200) · armi `arm_nunchaku, arm_katana, arm_ascia, arm_lancia, arm_spadone, arm_martello, arm_arco, arm_freccia` (impugnatura all'origine, lama verso +Y; le facce della lama col materiale `mat_lama`, che il client tinge col colore del materiale) · `fx_fiammata`.

**Proprietà dei file in questa sessione**
| WP | Possiede |
|---|---|
| **WP0** | `docs/**`, `tools/{check_static,build}.mjs`, `render/{scene,loader}.ts`, `main.ts`, `net/api.ts` (metodi GDR, fatti), `rpg/{index,types}.ts`, `game/lot.ts` (`set`, fatto), `packages/content/src/{rpg.ts,rpg_types.ts,buildings.json,islands.json}`, stub iniziali |
| **R-rpg** (onda 1) | `packages/content/src/rpg/{balance,materials,weapons,items,spells,perks,recipes}.json`, `packages/sim/src/rpg/**`, `packages/sim/src/economy/**` (solo per la Serra e i nuovi edifici), `packages/sim/test/rpg*.test.ts` |
| **R-dungeon** (onda 1) | `packages/content/src/rpg/{enemies,loot,dungeons}.json`, `packages/sim/src/dungeon/**`, `packages/sim/test/dungeon*.test.ts` |
| **R-asset** (onda 1) | `assets/**`, `tools/{build_assets.mjs,export_gltf.py}`, `apps/client/public/assets/**` |
| **R-server** (onda 2) | `apps/server/**`, `tests/e2e/m2_server*.mjs` (i metodi di `net/api.ts` li ha già scritti WP0) |
| **R-scena** (onda 2) | `apps/client/src/rpg/dungeon_*.ts`, `apps/client/src/game/ingressi.ts`, `tests/e2e/m2_dungeon*.mjs` |
| **R-pannelli** (onda 2) | `apps/client/src/rpg/{panels,hero_*,forge,alchemy,chest,items_ui}*.ts`, `apps/client/src/ui/{eroe,lotpanels}.ts`, `tests/e2e/m2_eroe*.mjs` |
Richieste tra WP in `tests/out/richieste/r-<wp>.md`. Nessun agente fa deploy, commit o push.
