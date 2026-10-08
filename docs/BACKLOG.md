# MAREA — Backlog (idee parcheggiate, zero sensi di colpa)

> Ogni idea nuova → una riga qui. Entra in una milestone solo tramite `ROADMAP.md`. Niente deroghe alla V1.

## Dopo dicembre 2026
- Battaglia carte/unità in tempo reale (Clash Royale-like): netcode a bassa latenza, bot, bilanciamento. Unica ragione per il piano Paid di Cloudflare.
- Puzzle leggero con i moduli dell'isola (tubi/tessere).
- Distretto Neon e Isola Selvaggia come zone vere (oggi facciate).
- Progetti comuni (ponte, faro del Porto) finanziati insieme.
- Bot per i minigiochi in tempo reale.
- Chat testuale (oggi solo emote).
- Interni degli edifici; meteo. (Il ciclo giorno/notte è entrato: #54.)
- Commercio di risorse tra giocatori.
- PWA installabile; notifiche «la Cava è finita».
- Musica originale (ElevenLabs Music), voci per l'onboarding.
- Apertura al pubblico: inviti a catena, moderazione, dominio, piano Paid.
- Passaggio a un motore (Godot) se il browser mostra un tetto: le fixture d'oro di `packages/sim` sono il criterio di parità.

- Negozio dei cappelli (M1): i cappelli con costo in Perle si comprano una volta (campo `posseduti` nel `LotState`, azione `buyHat`); finché non c'è, `/api/look` accetta solo i cappelli gratuiti.
- Barche per giocatore: oggi ogni client ha la sua barca a `boatSpawn`, quindi al molo la barca di un peer si sovrappone alla tua (vuota). In M1: una barca per lotto/persona con posto al molo proprio, o la tua barca nascosta finché non ci sali.
- Caricamento a due tempi dei modelli: all'avvio solo L1 e ciò che serve al proprio lotto; L2/L3, Porto e facciate dopo (oggi 1,53 MB iniziali su 2).
- Bordo del mondo: la barca può uscire dalla mappa (mare infinito). Un muro morbido o una corrente che riporta indietro.
- Test `m1_isola`: usare l'orologio di test di M1-server (`X-Test-Now-Offset` con `--var TEST_CLOCK:1`) invece di aspettare 3 minuti veri.
- Runner dei test: quando una suite va in timeout non spegne il `wrangler dev` staccato (processi orfani).
- ~~Regata sulla laguna~~ fatto in Fetta 2 (v3).
- Casa, «slot cosmetici 2 → 4 → 6» (GDD §5): nessun codice li usa. Da decidere con Jack (A/B): A = set salvati di look da richiamare con un tasto; B = la Casa sblocca colori/capelli extra. Finché non si decide, la Casa produce solo il numero mostrato nel pannello.
- Clip di animazione per le 4 emote in `chr_base.glb` (oggi fumetto): 30 min di Blender, poi `avatar.setEmote(id)`.
- Modello `dng_altare` (oggi piedistallo di box + cristallo che si accende, in `rpg/dungeon_scene.ts`): un pezzo per stile (grotta, cripta, vuoto) nel `manifest_rpg.json`.
- Test e2e con `wrangler dev` su Windows: `npx` va lanciato come `node node_modules/wrangler/bin/wrangler.js` e lo spegnimento con `process.kill(-pid)` non esiste (serve `taskkill /T`).

- Minigiochi da soli su altre isole (un gioco per ogni isola a tema; le Lanterne sono state tolte l'8 ott 2026): il formato c'è (`game/minigiochi.ts`, un posto per minigioco).
- Sfide con posta tra amici (`?sfide=1`): si riaccendono quando la prova da soli è piaciuta; da decidere se il Tavolo sull'isola resta o se la sfida si lancia dal posto del minigioco.

- Isole a tema dopo la Tempesta (GDD §3): **Ghiacci** (iceberg, aurora, pinguini), **Vulcano** (lava, ossidiana, forge: aggancio con Riccardo), **Giardino** (ciliegi, templi, carpe koi). Sblocchi da distribuire: livello del personaggio, un cappello «se no gli abitanti ti linciano», una mappa.
- Minigiochi universali dopo la pesca: caccia alle perle (consegne in barca e ingorgo al porto fatti l'8 ott 2026, GDD §6).

## Mai
- Soldi veri per risorse o acceleratori. (Cosmetici a pagamento: solo se un giorno si apre al pubblico, e solo cosmetici.)
- Attacchi alle isole altrui.
