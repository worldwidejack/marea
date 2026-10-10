---
progetto: MAREA
stato: attivo
aggiornato: 2026-10-10
dettaglio: docs/ROADMAP.md
rimasti: Gara tra amici online, ora anche coi BOT (#200): sala alla porta Spiaggia.
primo_passo: Tu: gara col tuo amico (Spiaggia → CON GLI AMICI → CON I BOT) e dimmi cosa non va.
---
## Siamo arrivati a
10 ott notte (#200): nella sala della gara tra amici si sceglie «CON I BOT» o «SOLO NOI»; coi bot ognuno ha i suoi 4 animali, gli amici partono dietro e restano fantasmi.

10 ott sera (#197): feedback di Riccardo sistemato (GAS a destra col dito, stick solo sterzo, camera di gara come nell'hub), iPhone non più schiacciato, e gara tra amici: alla porta della Spiaggia «CON GLI AMICI», chiunque preme VIA, gli altri si vedono come fantasmi col nome. Dopo: invito nuovo da 8, cancellato l'account vuoto «jack», icona sulla Home per account (id del manifest, #198).

10 ott pomeriggio: l'hub delle Corse alla Diddy Kong Racing è nel gioco (#186): sbarchi all'Isola delle Corse e giri in kart un'isola a parte con paese dei piloti, rotatoria del trofeo, trampolini e 6 porte (Spiaggia aperta → 4 piste, poi si torna nell'hub; le altre sbarrate), garage. Grafica più curata del resto, banco del look futuro. L'isola nell'arcipelago è rifatta come l'hub in piccolo.

10 ott mattina: le Corse del gioco girano sul motore v2: scegli pista e veicolo, animali piloti, avatar al volante, telefono in orizzontale (#173, #178, #182). L'isola nell'arcipelago però è ancora quella del primo Gran Premio.

9 ott notte: sul banco di prova provapiste.html ci sono le 4 piste grezze della Spiaggia e la guida nuova (#170). Il gioco non cambia.
- Guida: sterzo progressivo, drift alla Mario Kart con saltello e scintille blu, arancio, viola, turbo che si vede e si sente.
- Turbo alla partenza (o motore ingolfato), acrobazie sui salti, scia, turbo sommati: ognuno con un interruttore A/B.
- Camere dal menù ⚙ opzioni (dietro, alta, cofano); la pista intera è la minimappa.
- Gas in mano (W o ↑, joystick in avanti), gas automatico solo da menù; il razzo alla partenza col gas.
- Ritocco dopo la prova di Jack: sterzo −15 %, drift che gira molto meno (si arriva al viola), camera cofano negli occhi del pilota.
- Piste: Lungomare, Baia, Porto misto (ruote e barche), Fuga dall'onda.
- Le 4 piste sono vestite (#176): kit di 31 pezzi in Blender e scenografia automatica. Lungomare con spiaggia, paese e faro nel tornante; Baia con isola e arco di roccia; Porto con darsena, gru e container; Fuga sulla scogliera. I manichini girano la testa quando passi. Vista dall'alto: provascena.html.
- Deploy: chiuse le ultime cadute rare. Il server rigioca le partite in barca con gli stessi numeri del gioco, quindi la medaglia è sempre quella che vedi (#169); test dei Templari stabili (#171).

## Prossimo passo
Jack e il suo amico fanno la prima gara insieme coi bot e dicono cosa non va (comandi, fantasmi, bot, partenza). Poi Claude: urti veri tra amici se servono, fantasmi/stelle/sblocchi, musica, zona 2.

Prima (10 ott pomeriggio): Jack e gli amici provano l'hub; Jack dice cosa cambiare (guida libera, look, quartieri). Poi Claude: fantasmi, stelle e sblocchi (A12 punto 6), musica e suoni, veicoli buffi, la zona 2.


Prima (9 ott): Jack: guarda le piste vestite su provapiste.html, sceglie il muretto lungo il mare (A gomme o B pietra, `?muro=pietra`) e dice se si spendono crediti per veicoli buffi e animali con l'AI 3D. Poi Claude: buffi e animali (o fatti in Blender se niente crediti), musica e suoni, il Lungomare al posto del Gran Premio, poi l'hub.

## Traccia automatica
- 2026-10-10 22:36 · claude-code · 118 file toccati: `_MEMORIA.md`, `docs/PROTOCOL.md`, `docs/CONTRACTS.md`, `apps/client/provapiste.html`, `apps/client/provahub.html`, `apps/client/index.html`, `tests/out/report.json`, `tests/out/m4_corse_hub.json`, `tests/out/build.json`, `apps/client/dist/provascena.html`, `apps/client/dist/provapixel.html`, `apps/client/dist/provapiste.html` …
- 2026-10-10 14:30 · claude-code · 122 file toccati: `_MEMORIA.md`, `packages/content/src/minigames/corse.json`, `packages/content/src/islands.json`, `packages/content/src/archipelago.json`, `docs/ROADMAP.md`, `docs/CORSE.md`, `docs/CONTRACTS.md`, `assets/blender/models_corse_hub.py`, `assets/blender/build_all.py`, `assets/blender/atlas.py`, `apps/client/public/assets/manifest_rpg.json`, `apps/client/public/assets/manifest_corse.json` …
- 2026-10-10 05:24 · claude-code · 13 file toccati: `docs/TECH.md`, `docs/ROADMAP.md`, `docs/CORSE.md`, `docs/CONTRACTS.md`, `assets/blender/models_corse_spiaggia.py`, `assets/blender/build_all.py`, `assets/blender/atlas.py`, `apps/client/public/assets/manifest_corse.json`, `apps/client/provascena.html`, `_MEMORIA.md`, `packages/content/src/corse/motore.json`, `CLAUDE.md` …
- 2026-10-09 21:22 · claude-code · 12 file toccati: `packages/content/src/corse/motore.json`, `docs/ROADMAP.md`, `docs/CORSE.md`, `docs/CONTRACTS.md`, `_MEMORIA.md`, `apps/client/provapiste.html`, `tests/out/report.json`, `tests/out/m4_provapiste.json`, `tests/out/build.json`, `docs/GDD.md`, `packages/content/src/rpg/balance.json`, `docs/RPG.md`
