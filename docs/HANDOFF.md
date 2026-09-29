# MAREA — Handoff (30 set 2026, Sessione 2)

> Per chi riprende in una chat nuova. Leggi questo, poi `CLAUDE.md`, poi `_STATO.md`. Il resto si apre solo se serve.

## Cos'è e dove sta
- **Gioco**: arcipelago 3D low-poly pixel-art condiviso tra gli amici di Jack; la tua isola produce mentre non ci sei, minigiochi con scommesse di risorse, si gira in barca. Design `docs/GDD.md` · look `docs/ART_BIBLE.md` · tecnica `docs/TECH.md` · protocollo `docs/PROTOCOL.md` · contratti e proprietà dei file `docs/CONTRACTS.md` (§11 = fetta attuale) · tappe e deviazioni `docs/ROADMAP.md` · idee `docs/BACKLOG.md` · storia `_MEMORIA.md`.
- **Sorgente** `~/Desktop/JACK/_GITHUB/marea/` · repo privato `worldwidejack/marea` (`main`) · **online** https://marea.stanza-idee.workers.dev · link di Jack con token in `~/.config/jackos/marea-jack-link.txt` (mai nel repo).
- **Comandi**: `npm run dev` (+ `npm run dev:server`) · `npm test` (~13 min, tutte le suite) · `node tests/run.mjs <suite>` · `npm run assets` · `npm run deploy`.
- **Scadenza**: serata con gli amici 27-30 dic 2026. Jack: 2 h/settimana, budget zero.

## Dove siamo
- **M0 chiusa** (ok di Jack il 30/9). Online oggi: build `mun8j5iu` = M0 (peer visibili, avatar `chr_base` col look A scelto da Jack).
- **M1 · Fetta 1 «arcipelago e isola che produce»: fatta, integrata, NON ancora online** (a fine chat stava girando la seconda suite completa; controlla lo stato qui sotto). Contiene:
  - arcipelago continuo 560×560 celle (1.120 m): Porto al centro, 8 lotti (slot 0-7) a ~460 m, laguna, facciate Neon e Selvaggia (`packages/content/src/archipelago.json`, `composeArchipelago` in `packages/sim/src/world/archipelago.ts`);
  - `main.ts`: `/api/me` + `/api/lots` prima del mondo → spawn sul proprio molo, isole altrui in sola lettura (`game/lot.ts`), barra risorse, build mode, raccolta, miglioramenti (`ui/**`, `net/api.ts`), **bussola** Casa/Porto/Laguna (`ui/compass.ts`);
  - server: `persone.slot` (migrazione D1 `0003`), celle validate sul template `lotto`, decorazioni e cappelli a Perle, **sfide con posta** (DO `Sfide`, binding `SFIDE`, migrazione DO `v2`; TECH §6b, PROTOCOL §4), orologio di test `X-Test-Now-Offset` con `--var TEST_CLOCK:1`;
  - 24 modelli nuovi (edifici L2/L3, cantiere, kit del Porto, boe, facciate): **approvati da Jack** (`assets/export/preview/m1_contact.png`, solo locale).
- **Test**: **seconda suite completa verde 88/88** (commit `21e52b9`). Prima era 82/89 → corretto `main.ts` (passava `slot: null` e scavalcava `?slot=`); `m1_mondo` 15/15 e `m1_isola` 11/11 da sole. `m1_isola` è lenta e fragile sotto carico (aspetta 3 min veri): vedi BACKLOG.

## Primo da fare nella chat nuova
1. **Suite e deploy**: la Fetta 1 è committata e pushata ma **non deployata**. se non è cambiato niente dopo `21e52b9` la suite è già verde, altrimenti `npm test`; poi `npm run deploy` (serve l'ok esplicito di Jack) (applica D1 `0003` e DO `v2`; se fallisce con 7403 sulla query D1 riprova, è un intoppo di Cloudflare) → `_STATO.md` → `python3 "$HOME/Desktop/JACK/0 JACKOS/_strumenti/tabellone.py"` → commit e push. Se `m1_isola` è rossa solo nella suite completa, prima passala all'orologio di test (BACKLOG).
2. **Zoom (scelta di Jack, aperta)**: oggi a zoom max (1,6) sul telefono in verticale si vede ~1/3 del proprio lotto. Fargli **due screenshot 390×844 del suo lotto**: A = com'è ora, B = zoom max ~3 (ZMAX in `render/camera.ts`, ART_BIBLE §7). Aprirli con `open`. Lui sceglie A o B.
3. Jack prova dal telefono in 4G col suo link + `?fps=1` (costruisce la Segheria, raccoglie, va al Porto in barca).

## Poi: M1 · Fetta 2 (in breve)
Regata giocabile nel client sulla **laguna** (sim pronta: `packages/sim/src/minigames/regata`, oggi usa ancora la mappa `prova`: spostarla quando non ci sono sfide aperte), boe `prop_boa`/`prop_boa_next`, UI del **Tavolo delle Sfide** al Porto (scegli amico, posta, gioca; ricevute; esito), `inputs` registrati con `packInputs` e mandati a `POST /api/challenges/:id/play`. Poi avatar editor base, emote, feed. Fatta-quando di M1 in `docs/ROADMAP.md`.

## Regole di lavoro che contano
- **Agenti**: sempre `model: "opus"` (grafica, sim, server, asset) o `"sonnet"` (test, glue); mai il default (Fable esaurisce il limite). Un agente per pacchetto, file disgiunti (CONTRACTS §11 o una nuova §12), richieste in `tests/out/richieste/<wp>.md`. Gli agenti non fanno deploy/commit/push.
- **Permessi**: il deploy in produzione e la lettura del D1 remoto vengono bloccati dal controllo automatico finché Jack non dice esplicitamente «vai col deploy».
- **Verifica prima di dire fatto**: suite verde, screenshot guardati, numeri. File per Jack: `open "<percorso>"`. Scelte a Jack solo A/B **con le immagini già pronte**.
- **Fine sessione**: `npm test` → `npm run deploy` → `_STATO.md` → `_MEMORIA.md` → tabellone → commit e push (helper: `git -c credential.helper='!f() { echo username=worldwidejack; echo "password=$(cat ~/.config/jackos/gh-token)"; }; f' push`).
