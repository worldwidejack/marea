# MAREA — Roadmap

> Le tappe fino alla serata con gli amici. A fine tappa si annota qui cosa è cambiato e perché (§Deviazioni). Il dettaglio storico sta in `_MEMORIA.md`.

## Tappe

| | **M0 — Setup + prova del look** | **M1 — Vertical slice con gli amici** | **M2 — Rifinitura + serata** |
|---|---|---|---|
| Quando | 30 set → 12 ott 2026 | 13 ott → 6 dic 2026 | 7 → 23 dic; serata **27-30 dic**; 1 settimana di buffer |
| Contiene | Repo, documenti, contratti, pipeline asset, deploy da un comando; un'isola con acqua, barca, avatar che cammina e naviga, camera diorama con zoom, texture pixel, luce calda; server con D1 e `/api/ping`; scheda «anteprima» in jack-tools | Login da link-invito; arcipelago con **1 zona comune** (Porto) + lotti degli amici + percorso Regata; presenza multiplayer a 10 Hz; isola con 6 edifici, 3 risorse, build mode, produzione col tempo; **Regata** con sfida differita e wager; avatar base (pelle, capelli, vestito, 6 cappelli); passkey opzionale | Secondo minigioco (**Lanterne**) se c'è tempo; onboarding 60 s; suoni base; feed «X ti ha sfidato / hai vinto 40 Legno»; bilanciamento su dati veri; facciate del Distretto Neon e dell'Isola Selvaggia viste dalla barca; prova con 5+ persone |
| **Fatta quando** | Jack apre l'URL dal telefono in 4G, cammina e va in barca a 60 fps (≥ 45 su Android medio); `tests/out/contact.png`; `npm test` verde; `npm run deploy` in un comando | 3 amici entrano da telefono col loro link, l'isola produce mentre sono offline, uno sfida l'altro con wager e il libro mastro torna in pari; riconnessione senza perdite; zero errori in console | 5+ persone giocano 60 min senza spiegazioni a voce; difetti raccolti in `_MEMORIA.md`; decisione scritta su cosa viene dopo |
| Jack (2 h/sett.) | Sceglie palette e kit da un contact sheet A/B; approva volto e proporzioni dell'avatar base da 3 varianti; prova dal telefono; 1 h in Blender sul viso dell'avatar o su un modulo eroe (torii o lanterna) | Ogni settimana: 45 min collaudo con note vocali, 45 min direzione artistica su contact sheet, 30 min Blender per 1-2 pezzi esclusivi | Invita gli amici, raccoglie feedback, **taglia** (non aggiunge); nella serata gioca e osserva |
| **Non entra** | Login, multiplayer, economia | Battaglia unità, bot, puzzle, chat testuale, interni, giorno/notte, commercio, pubblico | Tutto quanto sopra; PWA solo se gratis in tempo; musica originale |

Onestà sui tagli: dei 4 tipi di minigioco entro dicembre ne entra **1 sicuro (Regata) e 1 probabile (Lanterne)**. Puzzle e battaglia sono 2027. Le 3 zone esistono a dicembre come **una zona vera + due facciate**.

## Sessioni di lavoro (ogni sessione finisce deployata)
- **Sessione 1 (29 set)**: Fase A (repo, documenti, scheletro online) → Fase B (6 agenti: render-mondo, avatar+barca, sim, server+net, asset, test+deploy) → Fase C (integrazione, deploy, contact sheet, scheda in jack-tools).
- **Sessione 2**: login da link, presenza multiplayer, lotto con i primi edifici.
- **Sessioni 3-8**: economia completa, build mode, Regata, sfide differite, wager, avatar editor, passkey.
- **Sessioni 9-11**: Lanterne, onboarding, suoni, facciate, bilanciamento, prova con gli amici.

## Deviazioni dal piano
Se una scelta si rivela sbagliata sul campo, cambiarla è legittimo: **annotare qui data, cosa e perché**, così questo file resta la mappa del territorio reale.

- *(29 set 2026, Sessione 1)* Connettore GitHub senza permesso di creare repo (403): repo creato via API con il token locale del Mac, come previsto da `_GITHUB/TOKEN_SPOSTATO.md`.
- *(29 set 2026, Sessione 1)* Blender MCP non collegato: gli asset di Sessione 1 passano da Blender **headless** (`tools/export_gltf.py`), che è comunque la via riproducibile. Il bridge serve solo per mostrare a Jack il viewport in diretta.
- *(29 set 2026, Sessione 1)* Aggiunta devDependency `@types/node`: i test della sim usano `node:test` e `node:assert`, e tsc deve conoscerli.
