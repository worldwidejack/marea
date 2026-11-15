> Mondo Sotterraneo, §2h: la Tana del Maggiolone, il dungeon dell'isola della Difesa. Le regole comuni stanno nelle altre sezioni: vedi l'[indice](../RPG.md).

## 2h. La Tana del Maggiolone (isola della Difesa, 13 nov 2026, #749)
Riccardo: un dungeon sull'isola della Difesa, **a tema col gioco dell'orto**, coi suoi insetti come nemici e gli unici a tema; **comico** e **facile**, il terzo della progressione.
- **Dove**: cella [31, 17] dell'isola, a est del campo dell'orto (gli insetti arrivano da destra, come nel gioco). Fuori: un vaso di terracotta enorme rovesciato con la tana scavata sotto, il cartello «ONDATE →» e una lumaca di guardia in cima (`game/ingressi_orto.ts`, segnaposto finché manca `prop_ingresso_orto`). Aperta a tutti.
- **Difficoltà 2,5**: dopo la Cripta (2), prima del Drenaggio (3). Autopilota con l'eroe forte, 6 semi: danno preso Cripta ~190, **Tana ~290**, Drenaggio ~410; il capo cade sempre.
- **L'idea**: sotto l'orto c'è il **Comando Centrale delle Ondate**, la burocrazia degli insetti che attaccano l'orto: numerini per le ondate, regolamento, lavagna dei piani, mensa con l'insalata rubata, palestra dove le cavallette imparano a «saltare la prima pianta».
- **Mappa** (pensata per la prima persona, `docs/PRIMA_PERSONA.md` §8): 11 stanze di forma e misura diverse unite da corridoi larghi 1 — Vaso rovesciato (ingresso), Sala d'Attesa delle Ondate, anticamera con la lanterna, Sala del Trono, Ufficio Strategia, Sala delle Mappe, Mensa, Dispensa (lo scrigno), Palestra delle Cavallette, Vivaio, Dormitorio delle lumache. Torce agli incroci. Due lanterne: nella Sala d'Attesa e davanti al trono.
- **Stile `orto`**: gallerie di terra a strati con radici, sassi e cocci di vaso, l'erba che pende dal bordo; le colonne sono **carote giganti** a testa in giù che scendono dal soffitto, con gli occhi arrabbiati. Prima persona: zoccolo e travi di legno, tappeto nelle stanze, foschia marrone (`rpg/orto.ts`, righe in `STYLE` e `STILI_FP`).

| Nemico | Dal gioco dell'orto | Cosa fa (solo comportamenti che c'erano già) |
|---|---|---|
| **Lumaca** | lumaca | lenta; la bava del morso ti rallenta (−35 % per 2 s) |
| **Lumaca con la ghianda** | lumaca con la ghianda | come la lumaca, con la ghianda-elmetto: armatura 8, testata contundente |
| **Scarabeo col vasetto** | scarabeo col vasetto | il vasetto in testa: armatura 12, lento, colpo contundente |
| **Cavalletta** | cavalletta | velocissima a zig-zag; ogni 2 attacchi si ferma 1,6 s a ricaricare la molla delle zampe |
| **Vespa** | vespa | vola alta e scende a pungere a zig-zag |
| **Bruco con lo scudo** | bruco con lo scudo | la foglia para tutto da davanti; un colpo caricato la stacca per sempre |
| **Lumaca capobanda** | la lumaca con la bandierina | sventola la bandierina: ogni 5 s cura un insetto vicino e lo gasa (danno ×1,2 per 5 s) |
| **Sua Maestà il Maggiolone** (capo) | maggiolino gigante | 480 vita, 24 danno; ogni 2 colpi una schiacciata ad area e 4 zolle che saltano dal pavimento attorno a lui |

- **Unici**: dal Maggiolone, sempre, il **Melone Mortaio** (martello: sbilancia, +50 % contro insetti e bestie). Sparsi (`docs/UNICI.md`): a terra nell'Ufficio Strategia la **Carota Cannone** (arco a carica di molla: non si tende, 4 colpi), nei resti del Dormitorio il **Cavolo Corazzato** (armatura, +20 Vita), nello scrigno della Dispensa il **Peperoncino Rabbioso** (katana che brucia).
- **Testi** (§2c): sottotitolo «Comando Centrale delle Ondate · solo insetti»; voci della Lumaca di guardia (il numerino), dello Scarabeo cuoco, della Cavalletta istruttrice e del Maggiolone («…come sarebbe a dire che quaggiù non ci sono le corsie?!»); letture: il Regolamento delle Ondate, la Lavagna della Strategia, il Diario di una lumaca, il Cartello della Sala d'Attesa.
- **Modelli**: per ora tutti segnaposto in codice (`rpg/orto.ts`); i nemici snodati in Blender (`nem_lumaca`, `nem_lumaca_ghianda`, `nem_scarabeo`, `nem_cavalletta`, `nem_vespa`, `nem_bruco`, `nem_capobanda`, `nem_maggiolone`) sono il passo dopo. Test: `dungeon_orto.test.ts`.
