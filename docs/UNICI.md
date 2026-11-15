# MAREA — Unici sparsi nei dungeon

> Oltre all'unico del capo (`RPG.md` §2), ogni dungeon nasconde **tre unici** (due al Mausoleo, che ne ha già cinque dal sarcofago): **uno a terra** da raccogliere, **uno nei resti di un avventuriero** da frugare, **uno in uno scrigno** in un angolo lontano. Ci sono sempre, a ogni spedizione, come l'unico del capo. Ognuno ha il suo disegno nel menu (16×16) e, le armi e le magie, in mano in prima persona. Numeri in `packages/content/src/rpg/` (`items.json`, `spells.json`, `loot.json` → `scrigno_<dungeon>` e `resti_<dungeon>`); dove stanno: `dungeons.json`, legenda `%` (a terra), `&` (resti), `$` (scrigno). Lo controlla `dungeon_unici_sparsi.test.ts`. **[proposta, da tarare giocando]**

## 1. Come si trovano
- **A terra**: il disegno dell'oggetto in piedi che galleggia su un cerchio di luce dorata; **E** (o il cartellino dal telefono) lo prende subito, come i libri.
- **Resti di un avventuriero**: uno scheletro accasciato accanto al suo zaino; si fruga come un cadavere («Resti di un avventuriero»).
- **Scrigno**: un forziere come gli altri, con l'unico sempre dentro e qualche moneta.
- Le **magie** arrivano col loro libro: preso il libro, la magia è imparata. Nel menu il libro ha il disegno della magia.

## 2. Il catalogo
| Dungeon | A terra | Resti | Scrigno |
|---|---|---|---|
| Grotta | **Remo del Contrabbandiere** (lancia 3,4 m, sbilancia) | **Giubba del Furetto** (armatura leggera, corsa +8 %) | Libro: **Lampo del Faro** (proiettile elettrico velocissimo) |
| Cripta | **Falce del Becchino** (ascia, ruba il 15 % del danno come Vita, +50 % ai non morti) | **Sudario del Priore** (veste, +50 Magicka, evocazioni −20 %) | Libro: **Corteo d'Ossa** (evoca uno scheletro) |
| Portale del Vuoto | **Scheggia dell'Orizzonte** (katana, ignora metà armatura, +50 % agli spettri) | **Anello dell'Eco Vuota** (+40 Magicka, Distruzione +20 %, magie nemiche −15 %) | Libro: **Squarcio del Vuoto** (bomba elettrica forte) |
| Drenaggio | **Chiave Inglese del Capoturno** (martello più rapido, sbilancia) | **Scafandro Rattoppato** (armatura, +30 Vita) | **Arco della Valvola** (frecce che ignorano il 30 % d'armatura) |
| Archivio | **Compasso del Cartografo** (nunchaku rapidissimo, sanguina) | **Mantella del Navigatore** (veste, corsa +10 %) | Libro: **Bussola Fulminante** (raggio elettrico lungo 11 m) |
| Fucina | **Tenaglia del Mastro** (martello che brucia) | **Grembiule di Brace** (armatura, magie nemiche −30 %) | Libro: **Colata** (raggio di fuoco largo) |
| Mausoleo | **Spilla della Dama di Corte** (+40 Stamina, armi leggere più veloci) | — | Libro: **Valzer delle Lame** (bomba elettrica larga) |
| Diga | **Arpione del Palombaro** (lancia 3,8 m, **gelo**: rallenta) | **Cerata del Disertore** (armatura, rigenera la Vita) | Libro: **Salva del Fuciliere** (colpo di fuoco forte) |
| Tempio «Doppia Nera» | **Bastoncini da Sci Gemelli** (nunchaku, **gelo**) | **Tuta Fluo del Maestro** (armatura leggera, corsa +12 %) | **Arco a Carrucola dello Skilift** (ignora il 40 % d'armatura) |
| Santuario delle Ceneri | **Mazza del Lucignolo** (martello, brucia e sbilancia) | **Lanterna dell'Arconte** (+30 Vita, Magicka doppia, Distruzione +25 %) | Libro: **Pioggia di Braci** (bomba di fuoco enorme) |
| Tana del Maggiolone | **Carota Cannone** (arco a molla: non si tende, 4 colpi) | **Cavolo Corazzato** (armatura di foglie, +20 Vita) | **Peperoncino Rabbioso** (katana che brucia) |

## 3. Tratti nuovi (sim, `combat.ts`)
- **`rubaVita`**: una frazione del danno fatto **in mischia** torna come Vita (non frecce, magie o evocazioni).
- **`gelo`**: il colpo **in mischia** rallenta il nemico come le magie elettriche (velocità × `molt` per `secondi` s; i boss a metà effetto).
- Il resto usa i tratti e i modificatori che c'erano già. Gli unici restano più deboli dell'unico del capo dello stesso dungeon.

## 4. I disegni
- **In mano**: sprite dell'atlante `fp/mani.png`, `u_<id>` per le armi e `b_<id>` per le bacchette, fatti con Codex nello stile della prima persona e ridotti da `tools/sprite/fp_atlas.py --unici` (`UNICI`).
- **Nel menu**: `apps/client/src/rpg/icone_unici.ts` (armi), `icone_corredo.ts` (armature, vesti, anelli), `icone_magie_uniche.ts` (magie).
