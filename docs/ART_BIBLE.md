# MAREA — Art Bible

> Vale per ogni pixel, modello e luce del gioco. Indipendente dal motore: parla di texel, metri e colori, non di Three.js.

## 1. Look in una frase
**Diorama 3D low-poly con texture pixel art, luce calda del tardo pomeriggio, mare turchese, lanterne accese.** Come i mondi 3D pixel-art in browser dei post d'ispirazione; personaggi umani semplici alla **PS1 / Final Fantasy IX**.

## 2. Palette (unica, 24 colori + 6 neon emissivi)
Tutti i colori del gioco vengono da qui; nessun altro hex nel codice o nelle texture. Il dithering è permesso solo tra colori adiacenti della stessa famiglia.

| Famiglia | Nome | Hex |
|---|---|---|
| Sabbia/legno | sabbia chiara | `#F4E3C1` |
| | sabbia | `#E2B97F` |
| | legno chiaro | `#C98A4B` |
| | legno | `#8E5A2B` |
| | legno scuro | `#5A3A1E` |
| | ombra calda | `#2E1E14` |
| Verdi | erba chiara | `#D9E872` |
| | erba | `#8FC35B` |
| | erba scura | `#4E9A46` |
| | bosco | `#2C6B3F` |
| | bosco ombra | `#1E4A3A` |
| Acqua | acqua bassa | `#7FE3E0` |
| | acqua | `#3FB9C9` |
| | acqua profonda | `#2478A8` |
| | abisso | `#163F73` |
| Pietra | pietra chiara | `#E8E1D6` |
| | pietra | `#B9AFA3` |
| | pietra scura | `#7F7568` |
| | roccia | `#4A4340` |
| | nero caldo | `#23201F` |
| Accenti | rosso lanterna | `#E8433F` |
| | arancio | `#F2A33A` |
| | giallo | `#F5D547` |
| | viola | `#A64DFF` |
| **Neon (emissivi)** | rosa neon | `#FF3DA6` |
| | ciano neon | `#3DF5FF` |
| | verde neon | `#B6FF3D` |
| | ambra neon | `#FFB03D` |
| | viola neon | `#8A5CFF` |
| | rosso neon | `#FF5C3D` |

Pelle degli avatar (6 toni, dentro la palette estesa dell'atlas avatar): `#FBE2C8 #EFC29B #D9A070 #B8784C #8C5636 #5A3A28`.

## 3. Regole delle texture
- **Densità**: **16 texel per metro** su terreni, edifici, barche e prop. **32 texel/m** su visi, mani e insegne (devono leggersi nel diorama).
- **Un solo atlas** `atlas.png` 1024×1024 per tutto il mondo: terreni e edifici (righe 0-511), prop (512-767), avatar e vestiti (768-895), emissivi e UI (896-1023). Un materiale → una zona intera in 1-3 draw call.
- Filtro **nearest**, niente mipmap (se scintilla: nearest-mipmap-nearest), colori sRGB. **Niente** normal map, roughness map, PBR, gradienti lisci, foto.
- **Mondo pulito** (Jack, 13 ott 2026, #286): niente puntini sparsi di rumore. Terreni e materiali a **tinta unita** con le sole forme grandi (lastre, assi, mattoni, ciottoli, fasce dei fianchi). Il gioco carica `atlas_pulito.png` (stesso `atlas.py` con `MAREA_PULITO=0`) al posto di `atlas.png` e il terreno delle isole disegna senza puntini.
- Le texture dei kit CC0 si **buttano** e si rifà l'UV sull'atlas: è la regola che rende coerente il kitbash di kit diversi.
- Flat shading (facce piatte), ombre di contatto semplici; **una** shadow map 1024 dal sole, o «blob» sotto avatar e barca sul telefono.

## 4. Scala e moduli
- 1 unità = 1 metro. Avatar **1,6 m**. Porta 2,2 m. Piano di un edificio 3 m. Barca 4,5 m.
- Griglia dei moduli **2 m**; pivot **a terra, al centro**; Y su, −Z avanti. Nomi: `mod_<tipo>_<variante>.glb` (terreno), `bld_<edificio>_l<livello>.glb`, `prop_<nome>.glb`, `chr_<nome>.glb`, `boat_<nome>.glb`.
- Budget: avatar ≤ 1.500 tri (eccezioni: `chr_base` fatto con l'AI ≤ 3.500, #287; i personaggi del Borgo `npc_<id>` ≤ 7.000 in tutto tra dettagliato e leggero, §5); edificio 300-800; prop 50-200; modulo terreno ≤ 60; barca ≤ 600.

## 5. Personaggi
- **Look 3 (voto del gruppo, ottobre 2026)**: mondo 3D e personaggi 2.5D in pixel art a 16 direzioni (9 viste disegnate + 7 specchiate, 4 disegni per mossa). La ricetta per farli è la skill `.claude/skills/sprite-marea/SKILL.md`, gli script stanno in `tools/sprite/`, i riferimenti approvati (il protagonista F3) in `assets/concept/personaggio/`. Dal 29/10/2026 personaggi, modelli 3D, luoghi ed effetti nascono nell'**Atelier di MAREA** (`worldwidejack/marea-atelier`, galleria https://worldwidejack.github.io/marea-atelier/): lì stanno lo stile comune (`STILE.md`), i fogli generati e gli approvati; qui entra solo quello che va nel gioco. Dove questa sezione dice altro (6 teste, modello 3D, Mixamo), per i personaggi a sprite vale la skill finché l'Art Bible non si riscrive sul look 3.
- **Personaggi del Borgo (Riccardo, 20 ott 2026)**: la gente del Porto (Ishi, il Furetto, Gigi, Capitan Remo, Nonna Pina), i paesani (Zia Nella, Tonio, Bice, Sor Gaspare, Ada dei Fiori) e i bottegai (Brando, Sibilla, Bepi) hanno ognuno **un modello suo** (`npc_<id>`, `assets/blender/models_gente.py` + `gente_*.py`), non più `chr_base` ricolorato. Regola: si devono riconoscere **dalla sagoma e dai colori a pixel grossi** e restare in mente: corporatura diversa (botte, stecco, bambino, nonnina curva), un copricapo o un oggetto che è solo loro (torre di cappelli, furetto sulle spalle, gatto in braccio, ramazza, canna da pesca, martello, pozione), andatura e posa da fermi diverse. Sono un po' più caricaturali degli avatar dei giocatori (circa 5 teste, occhi ovali col puntino di luce) proprio per staccarsi da loro. Colori nei vertici e un materiale solo (1 draw call a testa contro le 5 di `chr_base`), fino a ~5.000 triangoli più una versione leggera da ~1.800 (`npc_<id>_lod`, stesse ossa, decimata in Blender salvando i confini tra i colori) che il gioco mostra da lontano (`game/gente_lod.ts`), file in `manifest_gente.json` (scaricato dopo l'avvio). I bottegai seguono i loro ritratti (`public/assets/botteghe/*.webp`). Anteprime: `npm run assets npc_<id>`.
- **Avatar nuovo (Jack, 13 ott 2026, #283)**: low-poly a faccette pulite, poco anime (occhi piccoli e naturali, viso calmo), capelli a poche ciocche grosse, 6 teste. Outfit base semplice: camicia bianca a maniche corte, pantaloncini teal senza stampe, ciabatte, niente cappello. Riferimento: `assets/concept/avatar/avatar_sheet_completo.jpg` (giro attorno, 8 pose, 3 look); i giri di scelta stanno nella stessa cartella. Modello 3D (Jack, 14 ott 2026, #287): fatto con l'AI 3D (Hunyuan3D v3 «LowPoly» dalla vista a T dello sheet, ridotto a 3.000 triangoli: `assets/ai/avatar/hunyuan_3000.glb`), montato da `assets/blender/models_chr_ai.py` sullo scheletro e sulle clip di sempre. Nel gioco si vede a pixel grossi, come il resto. Ha una texture sua (`chr_base.png`, 512): pelle, capelli e camicia sono grigi e li tinge il client, pantaloncini, ciabatte e occhi hanno i colori veri. Un solo taglio di capelli (quello a punte), di cui si cambia il colore. Prima da codice e da Tripo/SAM erano usciti «inguardabili»: un personaggio low-poly decente deve nascere low-poly, ridurre un modello dettagliato deforma il viso. Giro attorno: `tools/avatar_giro.sh [indice | json del look] [--pixel]`.
- Stile **PS1 / Final Fantasy IX**: proporzioni quasi vere (**6 teste**), forme semplici, viso dipinto a pixel (occhi, sopracciglia, bocca: **mai** occhi a puntino, **mai** forme a blocchi o da giocattolo tipo Roblox / Fall Guys / KayKit).
- Base: Quaternius Ultimate Modular Men/Women (CC0) o modellati in Blender da Jack; rig umanoide standard; **animazioni Mixamo** (idle, walk, run, sit, remata) ricondotte al rig e esportate in glTF.
- Personalizzazione = mesh intercambiabili sullo stesso atlas (capelli, vestito, cappello) + colori da tabella (`avatar.json`). Le emote (8: saluto, esulta, ride, no, applauso, cuore, sorpresa, balla) oggi sono un fumetto a pixel sopra la testa (icone 16×16 in palette, contorno nero caldo) + per le ultime 4 un gesto del corpo a scatti (saltello/giro, niente clip); clip corte nel glb quando ci saranno.

## 6. Mood per zona
| Zona | Materiali | Luce e accenti |
|---|---|---|
| **Porto** (villaggio asiatico) | legno, tegole scure, carta, corde, pietra | lanterne rosse e ambra accese, torii, insegne dipinte, riflessi caldi sull'acqua |
| **Distretto Neon** (facciata in V1) | cemento, metallo scuro, vetro | insegne ciano/rosa/viola emissive, pioggia di luce sul molo |
| **Isola Selvaggia** (facciata in V1) | sabbia, erba alta, roccia, palme | verde saturo, sabbia chiara, acqua bassa turchese |
| **Isole personali** | quelli del Porto, più semplici | il giocatore le colora con le decorazioni |

## 7. Camera e luce
- Camera **diorama**: prospettica, FOV **30°**, pitch **45°** verso il basso, yaw **45°**, segue l'avatar con smorzamento; distanza base 28 m × zoom (**0,6-2,2**, rotella su PC o barra su mobile). Mai sotto l'orizzonte, mai dietro le spalle in V1.
- Sole: direzionale, colore `#FFD9A3`, da sud-ovest, elevazione ~40°. Cielo: emisferico `#9FD3FF` sopra, `#7A5A3A` sotto. Le ombre tendono al blu-viola grazie all'ambiente, mai grigio neutro.
- Sfondo cielo: gradiente a bande di 4 colori (nessun gradiente liscio), nuvole piatte a pixel opzionali.
- Resa a **metà risoluzione** con ingrandimento nearest: è insieme il look pixel e il risparmio di prestazioni. Niente post-processing oltre a questo.
- **Niente foschia e niente retino a schermo** (Jack, 13 ott 2026, #282: «un'orribile griglia a pois sopra tutto… elimina la foschia definitivamente»). Il lontano si vede pulito fino all'orizzonte; i passaggi di luce (cielo, dungeon) sono a bande nette, mai a puntini. Il dithering resta solo dentro le texture e nei disegni della UI. Le isole a tema chiuse (Giardino) restano nascoste dalla loro nebbia di scena: è gioco, non resa.
- **Le Corse sono tornate pixel** (Jack, 13 ott 2026 sera, #281): l'HD di #277 è durato mezza giornata. Il mondo in HD mostrava tutti i limiti di terreno, case e alberi, e rifarlo «alla Mario Kart 8» è lavoro da grafico 3D pista per pista (provati: resa nuova, kit rifatto da codice, case con l'AI 3D: deformate da vicino). Resta il tasto H in gara per vedere l'HD. **I veicoli invece si fanno con l'AI 3D** (`corse/veicoli_ai.ts`): oggetti tondi visti da dietro, dove l'AI regge; il resto dell'ambientazione resta del kit Blender e del fondale dipinto. In HD (tasto H) al telefono si parte da 1,5× con ombre a 1024 (memoria dell'iPhone, #295).

## 8. Acqua
**Di serie il mare della stampa giapponese** (Jack, 13 ott 2026, #286; `render/water2.ts` modo 1): fasce di blu per profondità, righe d'onda chiare e creste di schiuma, schiuma bianca spessa sulla riva. Le righe d'onda si vedono entro 70 m dalla camera; oltre il mare è a tinta unita (lontano si sbriciolerebbero in puntini). Riflessi: no.

## 9. UI
Font pixel leggibile (Press Start 2P per i titoli, un pixel-sans per il corpo), maiuscole solo nei titoli, testo in italiano. Pannelli con bordo a 2 px e angoli squadrati, colore `#2E1E14` a 90 %, testo `#F4E3C1`. Icone delle risorse a 16×16 texel: Legno (tronco), Pietra (ciottolo), Perle (perla rosa).

## 10. Fonti permesse e vietate
- **Permesse (CC0)**: Kenney (Pirate Kit, Nature Kit, City Kit, Fantasy Town Kit, Watercraft Pack), Quaternius (Ultimate Modular Men/Women, Ultimate Nature, Modular Buildings, Cyberpunk), KayKit (City Builder, Medieval Builder: solo edifici e prop, **non** i personaggi), Poly Pizza (solo CC0; i CC-BY vanno in `assets/licenses.md` con credito), Poly Haven (HDRI solo come riferimento luce), Mixamo (animazioni, licenza Adobe).
- **Vietate**: Sketchfab non-CC0, generatori 3D a crediti, foto, texture realistiche, personaggi a blocchi o da giocattolo, qualsiasi IP di terzi.

## 11. Come si approva un asset
Contact sheet (`tests/out/contact.png` o `assets/export/preview/*.png`) con 3 varianti a confronto → si sceglie A/B/C: la persona con cui lavori, il gruppo se il pezzo cambia il look comune. Nessuna produzione in serie prima dell'ok sul primo pezzo della famiglia.
