---
progetto: MAREA
stato: attivo
aggiornato: 2026-10-10
dettaglio: docs/ROADMAP.md
rimasti: Corse nel gioco sul motore v2 (4 piste, veicoli, avatar); manca l'hub alla Diddy Kong Racing.
primo_passo: Tu: scegli dove sta l'hub: A dentro l'arcipelago o B mondo a parte.
---
## Siamo arrivati a
10 ott: le Corse del gioco girano sul motore v2: scegli pista e veicolo, animali piloti, avatar al volante, telefono in orizzontale (#173, #178, #182). L'isola nell'arcipelago però è ancora quella del primo Gran Premio.

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
Jack sceglie dove si costruisce l'hub alla Diddy Kong Racing: A dentro l'arcipelago (vedi gli amici in kart, lavoro più lungo e più rischioso) o B mondo a parte (più grande e curato, giri da solo; consigliato da Claude). Poi Claude lo costruisce dalla concept corse_01_hub e corse_13_hub_arrivo.

Prima (9 ott): Jack: guarda le piste vestite su provapiste.html, sceglie il muretto lungo il mare (A gomme o B pietra, `?muro=pietra`) e dice se si spendono crediti per veicoli buffi e animali con l'AI 3D. Poi Claude: buffi e animali (o fatti in Blender se niente crediti), musica e suoni, il Lungomare al posto del Gran Premio, poi l'hub.

## Traccia automatica
- 2026-10-10 05:24 · claude-code · 13 file toccati: `docs/TECH.md`, `docs/ROADMAP.md`, `docs/CORSE.md`, `docs/CONTRACTS.md`, `assets/blender/models_corse_spiaggia.py`, `assets/blender/build_all.py`, `assets/blender/atlas.py`, `apps/client/public/assets/manifest_corse.json`, `apps/client/provascena.html`, `_MEMORIA.md`, `packages/content/src/corse/motore.json`, `CLAUDE.md` …
- 2026-10-09 21:22 · claude-code · 12 file toccati: `packages/content/src/corse/motore.json`, `docs/ROADMAP.md`, `docs/CORSE.md`, `docs/CONTRACTS.md`, `_MEMORIA.md`, `apps/client/provapiste.html`, `tests/out/report.json`, `tests/out/m4_provapiste.json`, `tests/out/build.json`, `docs/GDD.md`, `packages/content/src/rpg/balance.json`, `docs/RPG.md`
