# Il Santuario del Capo Ardente — Isola Vulcano (difficoltà 10)

Il dungeon più difficile del gioco, **aperto a tutti**. Scheda di Riccardo (scritta con Gemini, adattata al gioco vero); **i numeri sono [proposta, da tarare giocando]**. Dati in `packages/content/src/rpg/` (`dungeons.json` id `ceneri`, `enemies.json`, `loot.json`, `items.json`), regole in `packages/sim/src/dungeon/` (`braci.ts`, `ceneri.ts`, `korok.ts`), segnaposto in codice in `apps/client/src/rpg/ceneri.ts` e `ceneri_fx.ts`. Test: `packages/sim/test/dungeon_ceneri.test.ts`. Le regole generali dei dungeon sono in `docs/RPG.md` §2–§4.

- **Dove**: Isola Vulcano, cella [15, 18]: altare di basalto col braciere acceso (l'esterno non cambia). Mappa 48×32, celle da 2 m (le portate della scheda in «celle» sono diventate metri).
- **Percorso**: l'**Atrio della Purificazione** (scala, lanterna A) → il corridoio di lava → la **Sala delle Vasche d'Olio** → il canale di lava → il **Canale di Scoria** → il canale di lava → la **Soglia del Cratere** (lanterna B, fuori dalla vista di Korok) → l'**arena**. Due stanze laterali: la **Camera dei Giuramenti** (a nord-ovest, forziere raro e il diario) e la **Fonderia** (a sud-est, forziere raro).

## Il Fuoco del Giuramento (la meccanica)
- **Bracieri** (`braciere: n`, 12): spenti all'inizio; **A accanto** (una cella di distanza) ne accende uno, per tutti. Un braciere acceso illumina e ripara l'**area 3×3** attorno a sé e **svela gli Sciamani del Fumo** entro 3 celle. Bracieri: 2 nell'Atrio, 3 nelle Vasche, 3 nel Canale di Scoria, 4 agli angoli dell'arena.
- **Stanza chiusa** = tutti i suoi bracieri accesi: le **trappole di lava** (`lava: n` con `stanza: n`: 26-28 al secondo per 3 s a chi ci cammina) fanno la crosta, e il **canale di lava** davanti (`acqua: n`) si raffredda in 3 s e si passa. Se un braciere si spegne, le trappole tornano.
- **Bracieri spenti dai nemici**: il calcio del Colosso e i globi di Korok (sputo e pioggia) che cadono sul braciere.
- **Ondate di calore** (`ondate`, 3 zone: Vasche, Canale di Scoria, Fonderia): ogni 8-10 s l'aria si scalda per ~1,7 s (la zona si arroventa a scatti) e poi **46-52 danni** a chi sta nella zona, tranne nell'area di un braciere acceso.
- **Carboni ardenti** (`rottami`, 28 ogni 0,8 s) a chiazze nelle stanze.
- **Lava istantanea** (`lava: 9`, il bordo dell'arena): **210 di colpo** (una volta ogni 0,6 s) e ti rimanda verso il centro.

## Nemici (vita · danno · armatura; i più forti del gioco)
- **Lanciatore di Lava** 210 · globo 58 · 8, `umano`: tiene 9 m; entro 15 m **carica 1,2 s** con il lanternino che brilla: sul pavimento compaiono due cerchi rossi (il primo dove sei, il secondo attorno), poi i globi cadono (58 e una pozza di lava: 22 al secondo). **Un colpo di mischia mentre carica lo stordisce 2 s e i globi si dissolvono.**
- **Guerriero Colossale** 520 · clava 82 · 26, `umano`, lento (1,55 m/s): la clava cade su una **corsia davanti a lui** (4,4 m, larga 2,4; rettangolo rosso, 1 s d'avviso) e poi resta **incastrata 1,5 s**: **da dietro un colpo di mischia lo stordisce 3 s** e fa × 1,5. Ogni 9 s, se c'è un braciere acceso entro 7 m, **ci va e lo spegne con un calcio**.
- **Sciamano del Fumo** 150 · 20 · 0, `spettro`: **invisibile e intoccabile** se non è entro 3 celle da un braciere acceso. Tiene 7 m; ogni 7 s una **linea rossa ti lega a lui** per 1 s e poi evoca 2 **fuochi fatui** (al massimo 4 vivi). **Un colpo di mischia (visibile) sulla lanterna lo stordisce 3 s e lo rende visibile per sempre.**
- **Fuoco fatuo** 14 · 38, lento (1,9 m/s): ti insegue e scoppia a contatto; dopo 6 s si dissolve. **Mite di lava** 70 · 46 (raggio 2,2), 3 m/s: scoppia a contatto o dopo 5 s. Nascono dagli Sciamani e da Korok, non lasciano bottino.

## Il capo: Korok, il Cuore di Lava
3600 · 70 · 22, resiste un po' alla magia (30 %), `mostro`, alto tre metri. **Arena** 9×9 celle: il bordo è lava istantanea, dentro 7×7 di pavimento, ai quattro angoli i bracieri; si entra da un ponticello di pietra. Il **nucleo** sul petto è l'unico punto debole: fuori dalle finestre di punizione la corazza di magma smorza ogni colpo (× 0,55); nelle finestre (dopo l'attacco, fermo) un colpo di **mischia** vale × 2 o × 3 (le frecce e le magie no) e il nucleo brilla.
- **Fase 1** (sopra metà vita): **sputo** (due globi di lava di fila, il primo dove sei entro 8 m; 96 e un lago di fuoco; cerchio che si riempie in 2 s; poi la bocca si raffredda 3 s: nucleo × 2) e **Mite** (batte i pugni: tre cerchi attorno a te, da cui nascono i Mite; 2 s fermo: nucleo × 2).
- **Fase 2** (sotto metà, dopo 2,2 s di ruggito intoccabile): **onda di calore** (gran cerchio di 9,5 m che si riempie in 3 s: 130 a chi non sta nell'area di un braciere acceso), **schianto eruttivo** (cerchio di 5,2 m, 105, poi crepe di fuoco per 10 s, 26 al secondo; resta incastrato 4 s: nucleo × 3) e lo sputo.
- **Sotto un quarto di vita** si aggiunge la **pioggia di braci** (sei cerchi di 2 m, tre sul tuo posto, 64 l'uno; poi 2 s fermo: nucleo × 2).

## L'unico: Manto del Primo Lucignolo (dal capo, sempre)
Veste da mago: **+18 Difesa, +80 Magicka, Distruzione +30 %** (almeno la Veste dell'Arcimago, che è del quarto dungeon). **Sovralimentazione della Brace**: immune alle bruciature, ai carboni, alla lava delle trappole e alle ondate di calore delle stanze (non ai colpi di Korok né alla lava istantanea); ogni magia di Fuoco a segno o colpo caricato in mischia accende una carica di **Vampa** (3 al massimo); a 3 cariche la prossima magia di Fuoco ha raggio ×2, +40 % di danno e lascia una chiazza di brace (8 al secondo per 3 s). Lo droppano anche, di rado, i Colossi (2 %) e il forziere raro (3 %).

## Lanterne e lore
- **Lanterne**: A nell'Atrio; B nella Soglia, **ripartendo da lì i due canali di lava sono già freddi**.
- **Lore** (`docs/RPG.md` §2c): sottotitolo «Dove la pietra sanguina fuoco e il silenzio brucia.»; quattro voci dell'eco del santuario (la lanterna, la preghiera, la lava, il Capo Ardente) e due letture: la **Targa del Primo Lucignolo** (incisione nell'Atrio) e il **Diario di un Esploratore** (libro nella Camera dei Giuramenti).
