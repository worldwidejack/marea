# MAREA — Handoff (30 set 2026, Sessione 3)

> Per chi riprende in una chat nuova. Leggi questo, poi `CLAUDE.md`, poi `_STATO.md`. Il resto si apre solo se serve.

## Cos'è e dove sta
- **Gioco**: arcipelago 3D low-poly pixel-art condiviso tra gli amici di Jack; la tua isola produce mentre non ci sei, minigiochi con scommesse di risorse, si gira in barca. Design `docs/GDD.md` · look `docs/ART_BIBLE.md` · tecnica `docs/TECH.md` · protocollo `docs/PROTOCOL.md` · contratti e proprietà dei file `docs/CONTRACTS.md` (§11 = Fetta 1, §12 = Fetta 2) · tappe e deviazioni `docs/ROADMAP.md` · idee `docs/BACKLOG.md` · storia `_MEMORIA.md`.
- **Sorgente** `~/Desktop/JACK/_GITHUB/marea/` · repo privato `worldwidejack/marea` (`main`) · **online** https://marea.stanza-idee.workers.dev (build `mune25l7`) · link di Jack con token in `~/.config/jackos/marea-jack-link.txt` (mai nel repo).
- **Comandi**: `npm run dev` (+ `npm run dev:server`) · `npm test` (~8 min, 100 test) · `node tests/run.mjs <suite>` (senza `--no-build` per le suite nuove) · `npm run assets` · `npm run deploy`.
- **Scadenza**: serata con gli amici 27-30 dic 2026. Jack: 2 h/settimana, budget zero. **Jack gioca da PC** (tastiera + mouse): il PC viene prima, il touch resta com'è.

## Dove siamo
- **M1 · Fetta 1 e Fetta 2 online e pushate**, suite 100/100, `_STATO.md` aggiornato.
  - Fetta 1: arcipelago 560×560 celle (Porto, 8 lotti, laguna), spawn sul proprio molo, costruire/raccogliere/migliorare, bussola, sfide con posta lato server.
  - Fetta 2: **Regata sulla laguna** (`packages/sim/src/minigames/regata`, v3, 5 boe fisse in `packages/content/src/minigames/regata.json`, giro ~167 m, medaglie relative al pilota di riferimento 1,1× / 1,4× / 2,3× ≈ 22/28/46 s) e **Tavolo delle Sfide** al Porto (`apps/client/src/ui/tavolo.ts`, `game/regata.ts`, `net/api.ts`). Da PC: **E** vicino al Tavolo (3,5 m) → amico e posta → gara (WASD/frecce, Spazio = A, Shift = B, Esc = ritirati) → il server rigioca gli input e dà l'esito. Nel test client e server danno lo stesso punteggio.
- **Zoom** scelto da Jack: ZMAX 2,2 (`render/camera.ts`).
- **Jack non ha ancora provato la Fetta 2 online.** Il Tavolo richiede almeno un altro invitato da sfidare.

## Primo da fare nella chat nuova
1. Chiedere a Jack com'è andata la prova da PC (Tavolo, regata, zoom). Difetto → test in `tests/e2e/` e correzione; gusto → scelta A/B con screenshot; idea → `BACKLOG.md`.
2. Aperte della Fetta 2, da toccare solo se a Jack danno fastidio:
   - in gara si vede solo la boa successiva; niente linea d'arrivo né effetto raffica (il dato `gust` c'è nella `view()`);
   - l'oro è facile (un pilota a tutto gas con 8 direzioni lo prende): per irrigidirlo stringere `medalsPar.oro`;
   - `ui/tavolo.ts` è 460 righe (limite 400, solo avviso): spezzabile in `ui/tavolo_viste.ts`;
   - la barca in gara usa un adattatore in `game/world.ts` che sovrascrive `boat.state`: meglio un `setState` in `game/boat.ts`.
3. Poi **M1 · Fetta 3** (fatta-quando di M1 in `docs/ROADMAP.md`): avatar editor base, emote, feed. Scrivere prima una §13 in CONTRACTS con proprietà dei file.
4. `_MEMORIA.md` non è aggiornato per la Sessione 3: aggiungere il dettaglio (Fetta 2, zoom 2,2, regata v3).

## Regole di lavoro che contano
- **Agenti**: sempre `model: "opus"` (grafica, sim, server, client, UI) o `"sonnet"` (test, glue); mai il default (Fable esaurisce il limite). Un agente per pacchetto, file disgiunti (CONTRACTS), richieste in `tests/out/richieste/<wp>.md`. Gli agenti non fanno deploy/commit/push.
- **Permessi**: il deploy in produzione e la lettura del D1 remoto vengono bloccati dal controllo automatico finché Jack non dice esplicitamente «vai col deploy».
- **Verifica prima di dire fatto**: suite verde, screenshot guardati, numeri. File per Jack: `open "<percorso>"`. Scelte a Jack solo A/B **con le immagini già pronte**.
- **Fine sessione**: `npm test` → `npm run deploy` (7403 sul D1 = riprova) → `_STATO.md` → `_MEMORIA.md` → tabellone (`python3 "$HOME/Desktop/JACK/0 JACKOS/_strumenti/tabellone.py"`) → commit e push (helper: `git -c credential.helper='!f() { echo username=worldwidejack; echo "password=$(cat ~/.config/jackos/gh-token)"; }; f' push`).
