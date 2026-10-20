# MAREA — mappa del codice

> Dove sta cosa e chi ci lavora di solito: **J** Jack · **R** Riccardo · **B** birbasan. Una riga per cartella. «Chi» non è un permesso: tutti lavorano su tutto, ma prima di toccare la zona di un altro guarda se ha PR aperte lì.
> Crei una cartella nuova? Aggiungi la sua riga qui nella stessa PR. Le pagine `apps/client/*.html` sono una per banco di prova, `index.html` è il gioco.

## apps/client/src · il gioco nel browser (Vite + Three.js, interfaccia in HTML/CSS)
| Dove | Cosa c'è | Chi |
|---|---|---|
| `main.ts` | avvio, ciclo a 60 Hz, aggancio di ogni isola e modalità | tutti |
| `flags.ts` | interruttori dall'URL (`?test=1`, `?fps=1`, `?faro=1`…) | tutti |
| `game/` | il mondo: avatar, barca, input; Borgo, casa, arredi, negozio dei mobili, botteghe, pala, insetti, pesca; Porto; posti dei minigiochi; ingressi di dungeon e isole a tema; animali | tutti, R sul Borgo |
| `render/` | grafica 3D: scena a metà risoluzione, camera, acqua, luce, meteo e nuvole, isole (un file per isola a tema), mobili | J, R |
| `ui/` | interfaccia: HUD «Allegro», minimappa, bussola, impostazioni, editor dell'avatar, diario, schermate a pixel dei minigiochi, pannelli del Porto | J |
| `net/` | `api.ts` (HTTP `/api/*`), `client.ts` (WebSocket della zona) | tutti |
| `audio/` | suoni e musica: `ponte.ts` nel JS iniziale, il motore in un chunk | tutti |
| `corse/` | Isola delle Corse: hub (`hub/`), gara, veicoli, risultati; banchi `prova/` (piste, garage, scena) e `discesa/` (bici) | J |
| `adrenalina/` | snowboard dell'Adrenalina (chunk dalla funivia) | B |
| `templari/` | partita a ondate dei Templari (chunk entrando in chiesa) | B |
| `rpg/` | dungeon, eroe, forgia, alchimia, contrabbando; duello dell'Arena | R |
| `difesa/` | Difesa alla Plants vs Zombies: `provadifesa.html`, che si apre anche dal cancello dell'isola | J |
| `sparo/` | banco dello sparatutto a missioni (`provasparo.html`) | J |
| `prova3d/`, `provapixel/` | banchi delle prove di stile | J |
| `test/` | `window.__game` per i test (hook solo con `?test=1`) | tutti |

## packages/sim/src · la simulazione pura (gira nel browser e sul server, che rigioca le partite)
| Dove | Cosa c'è | Chi |
|---|---|---|
| `rng.ts`, `trig.ts`, `hash.ts`, `replay.ts` | casualità da seed, seni e coseni uguali su ogni motore, hash, replay degli input | tutti |
| `economy/` | il lotto di ognuno: monete, botteghe e vetrine, casa e ampliamenti, mobili, missioni, diario, pala, insetti, pesci, cambio dei salvataggi; anche il codice spento (edifici, sfide, faro) | J, R |
| `world/` | arcipelago a celle, avatar, barca, collisioni, sblocchi delle isole a tema | tutti |
| `minigames/` | minigiochi nel formato comune (`create`, `step`, `result`, `autopilot`), elencati in `registry.ts` | J |
| `meteo.ts` | nuvole e meteo dall'orologio | J |
| `corse/` | motore delle Corse: pista a nastro, veicoli, gara, oggetti, bici | J |
| `adrenalina/` | piste, barra Adrenalina, classifiche delle discese | B |
| `templari/` | partita a ondate | B |
| `dungeon/` | partita nei dungeon: combattimento, nemici, magie, bottino | R |
| `rpg/` | personaggio: zaino, oggetti, botteghe del GDR, contrabbando | R |
| `arena/` | duello 1v1 | R |
| `difesa/`, `sparo/` | Difesa a corsie, sparatutto | J |

Test della sim: `packages/sim/test/*.test.ts` (node:test), fixture d'oro in `test/fixtures/`.

## packages/content/src · i numeri del gioco (JSON) e i loro tipi
| Dove | Cosa c'è | Chi |
|---|---|---|
| `index.ts`, `types.ts`, `schema.ts` | esporta i contenuti, i tipi, il validatore | tutti |
| `balance.json`, `botteghe.*`, `missioni.json`, `rientro.json` | economia a monete: premi, tetti, botteghe | J |
| `archipelago.json`, `islands.json` | posizione delle isole e loro mappe a celle | tutti, R sul Borgo |
| `borgo.json`, `mobili*.json`, `finiture_testi.json`, `insetti.*`, `pesci.*`, `gente.json`, `porto.ts` | Borgo e Porto: case, negozio, pala, mobili, carte e pavimenti, insetti, pesci, gente | R |
| `avatar.json`, `decor.json`, `diario.*`, `meteo.json`, `porto_amici.*` | avatar e barca, decorazioni, diario, meteo, tabellone dei record | J |
| `minigames/`, `scacchi.json` | un JSON per minigioco | J |
| `corse/`, `corse*.ts` | piste, motore, discesa | J |
| `adrenalina/`, `adrenalina*.ts` | piste e barra dell'Adrenalina | B |
| `templari/`, `templari*.ts` | mappa e numeri dei Templari | B |
| `rpg/`, `rpg*.ts`, `arena/`, `arena.ts` | GDR (armi, materiali, nemici, magie, dungeon) e duello | R |
| `difesa.*`, `sparo.*` | Difesa e sparatutto | J |
| `buildings.json`, `resources.json`, `traguardi.json` | spento: edifici, risorse di prima, traguardi | — |

## packages/protocol/src · tipi dei messaggi WebSocket
`messages.ts` (zona: presenza, emote), `squadra.ts` (dungeon insieme), `gara_amici.ts`, `templari_insieme.ts`, `arena.ts`. Tutti.

## apps/server · il server (Cloudflare Worker, Durable Objects, D1)
| Dove | Cosa c'è | Chi |
|---|---|---|
| `src/worker.ts` | tutte le rotte HTTP `/api/*` e l'aggancio dei WebSocket `/ws/*` | tutti |
| `src/do/` | `Lot` (il lotto di ognuno, replay delle partite; con `lot_rpg`, `lot_templari`, `lot_arena`), `Zone` (presenza), `Spedizioni`, `GaraAmici`, `TemplariInsieme`, `Arena` (partite in tempo reale), `Sfide` (coordinatore unico: buche, discese, feed, record) | tutti |
| `src/*.ts` | auth, database, orologio, feed, Adrenalina, Porto tra amici | tutti |
| `migrations/` | schema del database D1, numerate in fila | tutti |
| `scripts/` | inviti | J |

## tests
| Dove | Cosa c'è | Chi |
|---|---|---|
| `run.mjs` | lanciatore delle suite (`static types sim boot` = le veloci) | tutti |
| `e2e/` | un file per cosa, nel browser vero (`boot`, `look`, `perf`, `m1_*`… `m4_*`) | tutti |
| `lib/` | browser, server statico, wrangler, palette | tutti |
| `shard.mjs`, `durate.json` | divide la suite in 6 gruppi per i controlli della PR, con le durate misurate su GitHub (`tools/durate_test.mjs` le rimisura) | J |

## tools
| Dove | Cosa c'è | Chi |
|---|---|---|
| `build.mjs`, `check_static.mjs`, `check_types.mjs`, `contact.mjs`, `deploy.mjs`, `riordina_git.mjs` | build col budget, controlli, foglio degli screenshot, deploy (lo lancia solo GitHub), riordino di rami e copie di lavoro ferme | J |
| `build_assets.mjs`, `export_gltf.py`, `*_leggero.*`, `icone.py`, `sprite_oggetti.py`, `avatar_giro.*` | asset: Blender → glTF, alleggerimenti, icone, sprite | tutti |
| `corse_piste*`, `corse_foglio.py`, `veicol*` | piste e veicoli delle Corse | J |
| `discesa_sentieri*`, `adrenalina_piste.mjs` | piste delle discese | B |
| `templari_mappa.mjs` | mappa dei Templari | B |
| `borgo_pianta.py`, `borgo_piazza.json`, `mobili_stato.mjs` | pianta del Borgo, stato dei mobili | R |
| `difesa_*` | Difesa: sprite, pelli, bilanciamento | J |
| `ingorgo_livelli.mjs`, `pinguini_livelli.mjs`, `prova*_shots.mjs` | livelli dei minigiochi, screenshot dei banchi | J |

## Altro
`assets/`: sorgenti Blender, atlas, concept art · `apps/client/public/assets/`: modelli esportati (nel repo, così si costruisce senza Blender) · `docs/`: documenti · `docs/archivio/`: storia, non si legge per lavorare.
