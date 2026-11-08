# MAREA — Dungeon in prima persona

> Come si gioca un dungeon dagli occhi dell'eroe, alla Skyrim. Si sceglie nelle Impostazioni («Dungeon in prima persona»; `?fp=1` / `?fp=0` la forzano). Le regole del combattimento, dei perk e dei dungeon stanno in `RPG.md`: qui solo quello che la prima persona cambia. In terza persona (e nell'Arena) non cambia niente: i suoi log si rigiocano uguali.
> Numeri in `packages/content/src/rpg/*.json` (`balance.json` → `dungeon.furtivo`, `perk.occhio`, `perk.manoFerma`; `enemies.json` → `altezza`, `quota`).

## 1. Comandi
- **PC**: il mouse guarda (il primo clic lo cattura, Esc lo lascia e apre la Pausa), WASD cammina, Maiusc corre, clic o Spazio = A, V schiva, R pozione, 1-2-3 i preferiti, I lo zaino. **E** fruga quello che hai sotto il mirino (se non c'è niente da frugare resta la Scarica dell'arco).
- **Telefono** in orizzontale: joystick a sinistra, il pollice destro trascinato gira la visuale (anche partendo dalla A); il cartellino del bottino sotto il mirino si tocca.

## 2. Mira in alto e in basso
- Frecce, magie e raggi vanno **dove punta il mirino**, anche in alto e in basso: partono dagli occhi (1,4 m) e la sim li fa salire o scendere con lo sguardo (`DungeonInput.p`, l'**alzo**: 81 passi da −60° a +60°, solo mentre si mira).
- I nemici sono **alti quanto il loro modello** (`altezza`; chi vola sta alla sua `quota`, che è anche quella disegnata): un ragno o un lupo si colpiscono guardando in basso, l'Aerostato in volo guardando in su. Si concede 0,2 m di margine: meglio un colpo regalato che uno che sembra preso e non conta.
- Le frecce cadono con la loro gravità (si mira un po' più su per i bersagli lontani); soffitto e pavimento fermano i colpi, le magie ad area ci scoppiano contro.
- **Raggi a flusso**: seguono lo sguardo e si fermano al primo muro, al pavimento o al soffitto; si vedono finire sul primo nemico che prendono, con le scintille. Più lunghi di prima (Fuoco continuo 6,5 m, Elettricità continua 9 m, Cura e Furia a flusso 8 m). In alto e in basso il raggio è grosso la metà che di lato.
- **Bombe** (di fuoco, elettriche, Cura, Furia): atterrano dove lo sguardo tocca terra (guardando in su, in fondo alla gittata), o sul primo nemico davanti prima di lì.
- Dal telefono il colpo si aggancia al nemico davanti, al centro del suo corpo (anche in alto e in basso).

## 3. Bottino da frugare
- I nemici uccisi **restano a terra** (niente più sacco), i forzieri si aprono. Guardando un bottino a portata di mano (1,9 m) compare **«E · Fruga · Bandito»** (o «Apri · Forziere», «Prendi · Libro: …»; «vuoto» se non c'è più niente).
- La **finestra** mostra cosa c'è dentro (monete, oggetti, peso): un tocco o un clic prende quella riga (quanti ne entrano nello zaino), **«Prendi tutto»** (R) tutto quello che entra; E, Esc o Tab chiudono. Da soli la partita si ferma mentre è aperta; insieme no. I libri si prendono subito.
- Sotto: appena entri il client manda l'azione `fruga` (l'eroe non raccoglie più passandoci sopra), ogni presa è l'azione `prendi` (`sim/dungeon/fruga.ts`), registrata col tick e rigiocata dal server come quelle dello zaino. Insieme ognuno fruga la sua parte, uguale per tutti.

## 4. Furtività
- Camminando (senza correre) i nemici ti notano più tardi: a **¾ della loro vista**, e chi dorme ancora più tardi (un bandito che dorme si sveglia a meno di 2 m). Correre si sente come sempre.
- **Attacco furtivo**: il colpo su chi non ti ha ancora visto (dorme o veglia) fa **×2** (i capi no), con la scritta e il suono. L'**occhio** sotto il mirino lo dice: una riga chiusa = nessuno ti ha visto, rosso aperto = qualcuno ti è addosso.
- I non-morti che dormono stanno **distesi a terra** e si tirano su quando ti sentono.

## 5. Arco
- Via l'**Automira** (le frecce che curvano dagli occhi si leggevano male). Al suo posto, nello stesso ramo:
  - **Occhio d'aquila** (30): con l'arco teso del tutto la vista si avvicina (campo al 55 %) e il mouse rallenta, per mirare lontano.
  - **Mano ferma** (60): mentre tendi l'arco il mondo va ai **due terzi** (nemici, i loro tiri e le trappole saltano un tick ogni tre; tu e le tue frecce no) e lo schermo si tinge. Solo da soli: insieme e in Arena no.
- Chi aveva preso l'Automira si ritrova i punti da spendere (`fitHero`).

## 6. Nemici e pericoli
- I nemici non arrivano più addosso agli occhi: in prima persona restano almeno 0,35 m più in là (`SPAZIO_FP`), così si vedono interi anche in mischia.
- Tutto quello che dall'alto si leggeva come un disegno a terra si alza in piedi (`rpg/fp_pericoli.ts`): i cerchi d'avviso (bombe, magma, geyser, cannonate, colpi ad area dei capi, forme della Baita) diventano **muri di luce** con l'orlo che sale col tempo; le corsie dei colpi dritti due pareti; le onde del Mausoleo un muro d'acqua coi suoi varchi; le lancette lastre in piedi; le zone del calore del Santuario quattro muri; le linee di mira (il Fuciliere, i raggi dei capi) un filo rosso all'altezza del petto.
- Quello che viene lanciato (bombe dell'Aerostato e dell'Albatros, magma del Mastro, globi del Lanciatore, sputi di Korok) **vola da chi lo lancia** fin dove cade; le cannonate cadono dall'alto.
- Se ci sei dentro: **«Pericolo: spostati»**, poi **«VIA DI LÌ!»**, una freccia attorno al mirino verso l'uscita più corta (o verso il varco dell'onda) e un bip che accelera. Chi prepara un colpo fuori dalla vista accende il bordo di quel lato.

## 7. Interfaccia
- In alto la **bussola** (punti cardinali, scala d'uscita, lanterne, il capo, i nemici che ti stanno addosso) e sotto la **barra del nemico** sotto il mirino o appena colpito (il capo col nome in oro). Niente barre sopra le teste dei nemici (restano quelle degli alleati).
- In basso al centro le tre barre (Magicka, Vita, Stamina) con frecce, pozioni, peso, monete e tempo. Mirino sempre: un punto con le armi, la croce con arco e magie, rosso sopra un nemico.
- Vita sotto il 30 %: bordi rossi che pulsano col **battito del cuore**.

## 8. Come funziona sotto
Dungeon **v12** (`sim/dungeon/dungeon.ts`): log degli input **formato 5** (un byte d'alzo per riga, solo nelle partite che lo usano), azioni `fruga` e `prendi`, `SqInput` della squadra con l'alzo in quinta posizione. Moduli: `sim/dungeon/alzo.ts` (pendenza, altezze, raggio in 3D), `fruga.ts` (bottino a mano, furtività), `perk.ts` (Mano ferma); client `rpg/prima_persona.ts` con `fp_fruga.ts`, `fp_hud.ts`, `fp_pericoli.ts`. La prova: `tests/e2e/m2_prima_persona.mjs` e `packages/sim/test/dungeon_prima_persona.test.ts`.
