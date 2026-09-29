# MAREA — Handoff (29 set 2026, sera)

> Per chi riprende il progetto in una chat nuova (anche Sonnet 5.5). Leggi questo, poi `CLAUDE.md`, poi `_STATO.md`. Il resto si apre solo se serve.

## Cos'è e dove sta
- **Gioco**: arcipelago 3D low-poly pixel-art condiviso tra gli amici di Jack; la tua isola produce mentre non ci sei, minigiochi nelle zone comuni con scommesse di risorse, si gira in barca. Avatar stile PS1 / Final Fantasy IX. Design: `docs/GDD.md`. Look: `docs/ART_BIBLE.md`. Tecnica: `docs/TECH.md`. Contratti e proprietà dei file: `docs/CONTRACTS.md`. Tappe: `docs/ROADMAP.md`.
- **Sorgente**: `~/Desktop/JACK/_GITHUB/marea/` · repo privato `worldwidejack/marea` (branch `main`). **Online**: https://marea.stanza-idee.workers.dev (Cloudflare Free, Worker + D1 + Durable Object). Link personale di Jack con token: `~/.config/jackos/marea-jack-link.txt` (mai nel repo).
- **Comandi**: `npm run dev` (client; `npm run dev:server` a fianco) · `npm test` (= `node tests/run.mjs all`) · `node tests/run.mjs boot look` · `npm run assets` · `npm run deploy` (build + migrazioni + wrangler deploy + verifica). Tutto è già installato; Node 26 esegue i `.ts` senza build.
- **Scadenza**: serata di collaudo con gli amici **27-30 dic 2026**. Jack mette 2 h/settimana (gusto, collaudo dal telefono, pezzi in Blender). Budget zero.

## Dove siamo arrivati (Sessione 1, 29 set)
- **Fase A** (fatta): documenti, monorepo, scheletro online.
- **Fase B** (6 agenti in parallelo, WP1-WP6): **WP4 ha finito e consegnato**; WP1, WP2, WP3, WP5, WP6 sono stati **fermati a lavoro avanzato** per risparmiare consumo. Il loro lavoro è nell'albero ed è verde tranne un test (vedi sotto).
- **Online adesso**: build `mun6u9ef` con isola fatta di moduli glTF, 18 modelli (edifici L1, barca, prop, atlas 1024²), acqua a pixel, camera diorama, avatar segnaposto a 6 teste, barca con scia e guidatore seduto. Contact sheet: `tests/out/contact.png` (26 viste).
- **Test** (`node tests/run.mjs all`): static 0 errori · types 5/5 · sim 24/24 · build entro budget (js 679 KB, gzip 179, iniziale 0,87 MB) · boot 8/8 · look 6/6 (palette 98-99 %) · perf ok · wp1_look 8/8 · wp2_model 5/5 · wp2_move 12/12 · **wp4_net 5/6: rosso «A cammina, B vede la posizione cambiare»** (passava quando WP4 l'ha scritto; da rivedere dopo le modifiche di WP2 all'input e di WP0 al protocollo: probabile timing o `sendPos` che manda solo se cambiato).

## Cosa manca per chiudere M0 (in ordine)
1. **`apps/client/src/game/world.ts`** (WP0): integrare le richieste in `tests/out/richieste/wp2.md` e `wp4.md`: `avatar.setGround(island.groundY)`; `boat.setDriver(avatar.state, look)`; disegnare i **peer** con `net.peers()` + `net.peerAt(id)` creando un `createAvatar` per ognuno e togliendolo su `leave`; `net.close()` alla chiusura; nota il **segno della yaw** (three: `rotation.y = -yaw`) per ogni oggetto orientato con la yaw della sim.
2. **`chr_base.glb`** manca (WP5 fermato mentre lo faceva): sorgente in `assets/blender/models_chr.py`, convenzioni in `tests/out/richieste/wp2.md` (clip `idle walk run sit row`, materiali `mat_pelle/mat_capelli/mat_vestito/mat_cappello`, nodi `capelli_<n>`, `cappello_<id>`). Rigenerare con `node tools/build_assets.mjs`; anteprime in `assets/export/preview/`.
3. **wp4_net** rosso: capire e sistemare (vedi sopra).
4. **`tests/out/richieste/wp3.md`** se esiste: proposte di taratura dell'economia da riportare nel GDD §5. I test dei 30 giorni sono in `packages/sim/test/economy_30days.test.ts`.
5. `index.html`: rimuovere le regole CSS di `#joystick`/`.btn` ormai sovrascritte da `input.ts` (facoltativo).
6. Poi: **Jack prova dal telefono in 4G** con `?fps=1` (istruzioni in `tests/README.md`), sceglie palette/moduli dal contact sheet, approva l'avatar da 3 varianti. Con il suo ok, M0 è chiusa.

## Poi M1 (13 ott → 6 dic), in breve
Login da link (c'è già: token in D1, `apps/server/scripts/invita.mjs "Nome" --remote` stampa il link), presenza multiplayer visibile, isola con 6 edifici e produzione (il DO `Lot` espone già `GET /api/lot` e `POST /api/lot/collect|build|upgrade`), build mode nella stessa vista, **Regata** con sfida differita e wager (sim pronta: `packages/sim/src/minigames/regata`, `replay.ts`), avatar editor base, feed. Dettagli in `docs/ROADMAP.md`.

## Regole di lavoro che contano
- **Agenti**: lanciarli con `model: "opus"` (grafica, sim, server, asset) o `"sonnet"` (test, glue); mai il modello di default (Fable esaurisce il limite di sessione). Un agente per pacchetto di lavoro, file disgiunti (`CONTRACTS.md` §1), richieste in `tests/out/richieste/<wp>.md`.
- **Ogni sessione finisce deployata** (`npm run deploy`) e con `_STATO.md` aggiornato; poi `python3 "$HOME/Desktop/JACK/0 JACKOS/_strumenti/tabellone.py"`; commit e push (helper: `git -c credential.helper='!f() { echo username=worldwidejack; echo "password=$(cat ~/.config/jackos/gh-token)"; }; f' push`).
- **Verifica prima di dire fatto**: `npm test`, screenshot in `tests/out/`, numeri. File da far vedere a Jack: aprili con `open "<percorso>"`.
- **Look**: solo palette, texture nearest, un atlas, flat shading, avatar a 6 teste. Mai Roblox/Fall Guys.
- **Deviazioni** (cose cambiate rispetto al piano) si annotano in `docs/ROADMAP.md` §Deviazioni.
