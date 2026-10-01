# MAREA — Handoff (1 ott 2026, dopo la Sessione 4 notturna)

> Per chi riprende in una chat nuova. Leggi questo, poi `CLAUDE.md`, poi `_STATO.md`. Il resto si apre solo se serve.

## Cos'è e dove sta
- **Gioco**: arcipelago 3D low-poly pixel-art condiviso tra gli amici di Jack; la tua isola produce mentre non ci sei, minigiochi con scommesse di risorse, si gira in barca. Design `docs/GDD.md` · look `docs/ART_BIBLE.md` · tecnica `docs/TECH.md` · protocollo `docs/PROTOCOL.md` · contratti e proprietà dei file `docs/CONTRACTS.md` (§11 Fetta 1, §12 Fetta 2, **§13 Fetta 3**) · tappe e deviazioni `docs/ROADMAP.md` · idee `docs/BACKLOG.md` · storia `_MEMORIA.md`.
- **Sorgente** `~/Desktop/JACK/_GITHUB/marea/` · repo privato `worldwidejack/marea` (`main`) · **online** https://marea.stanza-idee.workers.dev (build `mune25l7` = Fetta 1+2; **la Fetta 3 è su `main` ma non deployata**) · link di Jack con token in `~/.config/jackos/marea-jack-link.txt` (mai nel repo).
- **Comandi**: `npm run dev` (+ `npm run dev:server`) · `npm test` (~10 min, 128 test) · `node tests/run.mjs <suite>` · `npm run assets` · `npm run deploy`.
- **Scadenza**: serata con gli amici 27-30 dic 2026. Jack: 2 h/settimana, budget zero. **Jack gioca da PC** (tastiera + mouse): il PC viene prima, il touch resta com'è.

## Lavoro in gruppo (1 ott 2026, sera) — attivo
- Si lavora con **issue → ramo → PR → `/consegna`**, anche il Claude di Jack. Deploy solo da GitHub Actions (`deploy.yml`): suite completa (~16 min, una riprova per le e2e cadute) → `tools/deploy.mjs --no-tail`. Primo deploy da GitHub riuscito: build `mupynbxd-cf01cc2`, 140/140. Guida `docs/CONTRIBUIRE.md`, bacheca issue #1-#9.
- Sul Mac: `gh` installato e loggato come `worldwidejack` con scope `workflow` (push con `git -c credential.helper= -c credential.helper='!gh auth git-credential' push`). Segreti `CLOUDFLARE_API_TOKEN` (token `marea-github`) e `CLOUDFLARE_ACCOUNT_ID` nel repo.
- GitHub Actions gira a 2-4 fps: test e2e con tempi fissi brevi cadono lì. Aspettare lo stato, non il tempo.
- **Da fare**: amici → scrivono lo username GitHub nel gruppo → `gh api -X PUT repos/worldwidejack/marea/collaborators/<user> -f permission=push`.

## Dove siamo
- **M1 · Fetta 1, 2 e 3 nel repo**, suite 128/128, `_STATO.md` aggiornato.
  - Fetta 1: arcipelago 560×560, spawn sul proprio molo, costruire/raccogliere/migliorare, bussola, sfide con posta lato server.
  - Fetta 2: Regata sulla laguna (v3, 5 boe, medaglie ≈ 22/28/46 s) e Tavolo delle Sfide al Porto (**E** vicino al Tavolo).
  - Fetta 3 (notte del 30 set): **C** = editor dell'avatar (`ui/editor.ts`: pelle, capelli, colore, vestito, cappello; anteprima dal vivo, Esc annulla, Salva, cappelli a Perle con «Compra»); **1-4** = emote (`game/emote.ts`: fumetto a pixel sopra la testa, visto dagli altri; sul telefono bottone faccina); **F** / campanella = feed (`ui/feed.ts`: «Anna ti sfida alla Regata…», badge dei non letti, poll 30 s). Server: feed nel DO `Sfide` (`do/feedStore.ts`, testi in `feed.ts`), `POST /api/look` aggiorna anche la presenza, emote limitate a una ogni 800 ms. Pulizie: `boat.setState`, `tavolo.ts` diviso in `tavolo_viste.ts`.
- **Jack non ha provato online né la Fetta 2 né la 3.** Per il Tavolo e per vedere le emote degli altri serve almeno un altro invitato.

## Primo da fare nella chat nuova
1. **Deploy**: chiedere a Jack «vai col deploy?». Con il suo ok: `npm run deploy` (7403 sul D1 = riprova), poi `_STATO.md` con la build nuova, commit e push.
2. Prova da PC di Jack: C, 1-4, F, Tavolo, regata, zoom. Difetto → test in `tests/e2e/` e correzione; gusto → scelta A/B con screenshot; idea → `BACKLOG.md`.
3. Aperte, solo se a Jack danno fastidio: in gara si vede solo la boa successiva (niente linea d'arrivo né effetto raffica, il dato `gust` c'è nella `view()`); l'oro è facile (stringere `medalsPar.oro`); le emote sono fumetti senza clip (richiesta in `tests/out/richieste/f3-emote.md`); i colori nell'editor hanno i nomi della palette («legno scuro»), non nomi da capelli; il 409 di «Compra» dice «Risorse insufficienti: ti mancano 10 Perle».
4. Poi la **fatta-quando di M1** (`docs/ROADMAP.md`): 3 amici entrano da telefono col loro link → inviti con `node apps/server/scripts/invita.mjs "Nome" --remote`, riconnessione senza perdite, zero errori in console. Passkey opzionale. Quello che resta di M1 è collaudo con persone vere, non codice nuovo.

## Regole di lavoro che contano
- **Agenti**: sempre `model: "opus"` (grafica, sim, server, client, UI) o `"sonnet"` (test, glue); mai il default (Fable esaurisce il limite). Un agente per pacchetto, file disgiunti (CONTRACTS), richieste in `tests/out/richieste/<wp>.md`. Gli agenti non fanno deploy/commit/push. Funziona bene: l'orchestratore scrive prima gli stub e le interfacce (Fase A), poi lancia gli agenti in un solo messaggio.
- **Permessi**: il deploy in produzione e la lettura del D1 remoto vengono bloccati dal controllo automatico finché Jack non dice esplicitamente «vai col deploy».
- **Verifica prima di dire fatto**: suite verde, screenshot guardati, numeri. File per Jack: `open "<percorso>"`. Scelte a Jack solo A/B **con le immagini già pronte**.
- **Fine sessione**: `npm test` → `npm run deploy` (se autorizzato) → `_STATO.md` → `_MEMORIA.md` → tabellone (`python3 "$HOME/Desktop/JACK/0 JACKOS/_strumenti/tabellone.py"`) → commit e push (helper: `git -c credential.helper='!f() { echo username=worldwidejack; echo "password=$(cat ~/.config/jackos/gh-token)"; }; f' push`).
