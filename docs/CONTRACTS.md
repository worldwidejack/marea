# MAREA — CONTRACTS (congelato in Fase A; cambia solo tramite l'orchestratore)

> Leggere con `TECH.md` §3 (regole di codice) e `ROADMAP.md`. Ogni file della tabella di proprietà esiste già come **stub che esporta l'interfaccia finale**: sostituisci il corpo, tieni nomi e firme. Gli stub segnati «funzionante» fanno girare il walking skeleton: tienili in piedi mentre li sostituisci.

Comandi: `npm run dev` · `npm run build` · `npm run check` (tsc) · `npm test` (= `node tests/run.mjs all`) · `node tests/run.mjs static sim boot` · `npm run deploy`.
Gli agenti **non** fanno deploy né push: lo fa l'orchestratore in Fase C.

## 1. Proprietà dei file (Fase B: si toccano solo i propri; il resto si legge)
| WP | Possiede |
|---|---|
| **WP0 orchestratore** | `package.json`, `tsconfig*`, `docs/**`, `CLAUDE.md`, `apps/client/index.html`, `apps/client/vite.config.ts`, `apps/client/src/{main,flags}.ts`, `apps/client/src/game/world.ts`, `apps/client/src/ui/**`, `apps/client/src/test/**`, `packages/protocol/**`, `packages/content/**` tranne `balance.json` e `minigames/*.json`, `tools/check_types.mjs` |
| **WP1 render-mondo** | `apps/client/src/render/{scene,camera,water,light,loader,pixel,island,sky}.ts`, `tests/e2e/wp1_*.mjs` |
| **WP2 avatar+barca** | `apps/client/src/game/{input,avatar,boat}.ts`, `apps/client/src/render/anim.ts`, `tests/e2e/wp2_*.mjs` |
| **WP3 sim-core** | `packages/sim/**`, `packages/content/src/balance.json`, `packages/content/src/minigames/*.json` |
| **WP4 server+net** | `apps/server/**`, `apps/client/src/net/**`, `tests/e2e/wp4_*.mjs` |
| **WP5 asset** | `assets/**`, `tools/build_assets.mjs`, `tools/export_gltf.py`, `apps/client/public/assets/**` |
| **WP6 test+deploy** | `tests/run.mjs`, `tests/lib/**`, `tests/e2e/{boot,look,perf}.mjs`, `tools/{build,deploy,check_static,contact}.mjs` |
Serve un cambiamento in un file altrui → scrivilo in `tests/out/richieste/<wp>.md` (cosa, perché, firma proposta) e vai avanti con un adattatore nei tuoi file. L'orchestratore integra.

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
// minigames/regata/regata.ts   modulo `regata` (GDD §6); `view(s)` → { boat: BoatState; buoys: {x,z,passed}[]; next: number; ms: number; wind }
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
