# G4 — 10 · Spiaggia MAREA 3D

- Immagine: `assets/concept/difesa/esplorazione_10.png`
- Strumento: image_gen integrato, nessuna API esterna o script di generazione.
- Tentativi: **1**, accettato dopo controllo visivo.
- Formato: PNG, 1536 × 1024.

## Controllo visivo
Cinque corsie orizzontali e nove colonne, base di legno con teli a sinistra, mare e ingresso nemici a destra. Sette difensori, sei nemici, cinque palette a molla, proiettili verso destra, due perle sospese. Sei carte con costi corretti e quinta scurita, contatore 150, pala e barra con due bandiere. Nessuna scritta inventata. Volumi poligonali e ombre nette distinguono questa schermata dalla 02 disegnata in pixel art. Limite: la pixelatura dei personaggi è più fine del riferimento Corse; alcuni granchi sono orientati verso sinistra e anche verso la camera. La base appare come una capanna allungata con più teli.

## Cast
### Difensori
- **Castello di sabbia**: torretta ferma che spara palline di sabbia verso destra.
- **Conchiglia rosa**: si apre e produce perle da raccogliere.
- **Secchiello rovesciato**: muro turchese con manico arancione che assorbe gli attacchi.
- **Anguria esplosiva**: fetta con miccia che esplode contro i nemici vicini.

### Nemici
- **Granchio rosso**: nemico base senza protezioni.
- **Granchio col tappo**: tappo metallico di bottiglia come armatura leggera.
- **Paguro in lattina**: corpo viola e guscio di lattina come armatura pesante.

- **Valuta**: perle luminose.
- **Ultima difesa**: paletta rossa da spiaggia montata su molla, una per corsia.
- **Base**: capanna di legno con teli corallo, fuori dal campo a sinistra.

## Sprite
Ricreare/renderizzare separatamente i quattro difensori, i tre nemici (armature staccabili), paletta e molla, pallina di sabbia, perla e scintille, oltre a tile chiaro/scuro, capanna e componenti UI; vista ortografica a tre quarti coerente, difensori verso destra e nemici verso sinistra, ombre su livello separato. Lo screenshot è un concept: i ritagli diretti conservano sfondo e occlusioni, quindi non sono sprite pronti.

## Prompt finale (inglese)

Use case: stylized-concept. Make ONE landscape 1536 x 1024 fake gameplay screenshot for an original friendly beach lane tower defense. Reference the attached MAREA kart coastal image ONLY for rendering style: genuinely polygonal 3D meshes, flat shaded triangular planes, low-resolution framebuffer enlarged with crisp chunky nearest-neighbor pixels, modern PS1/N64 appearance. NOT hand-drawn 2D pixel art, NOT voxel cubes, NOT smooth toy CGI. Saturated turquoise ocean, warm sand, clean whites, noon sun, simple hard shadows. The separate beach defense reference establishes the cast and gameplay layout; recreate that scene as an actual low-poly 3D game.

Camera fixed front and elevated three-quarter orthographic, looking down enough to see the entire rectangular board. Horizontal lanes run LEFT TO RIGHT across the image, never into depth. Board occupies x=280..1370, y=245..890 with exactly FIVE horizontal ROWS and NINE columns, 45 alternating light and darker sand square tiles, clear visible boundaries; modest foreshortening only. Large readable silhouettes on phones. Wooden hut with coral canvas awnings OUTSIDE the board on the LEFT. Turquoise water and white surf OUTSIDE the board on the RIGHT, enemies arriving from water and facing LEFT. Sparse palms and a distant rocky island outside the playable area.

Original cast from the beach reference, all visibly 3D angular faceted low-poly objects:
Seven stationary defenders, all shooters facing RIGHT: two golden sandcastle turret cannons with small orange pennants, two open pink scallop shells producing luminous ivory pearls, two inverted turquoise beach buckets with orange handles as walls (closed flat bottoms uppermost, wider open rims resting on sand), one triangular red watermelon wedge with green rind and tiny fuse as explosive. Place row1 col2 sandcastle; row2 col1 shell and col4 bucket; row3 col3 sandcastle; row4 col2 watermelon and col4 bucket; row5 col1 shell.
Six enemies, all facing and moving LEFT: row1 col8 friendly red crab; row2 col7 red crab with silver bottle cap helmet; row3 col9 purple hermit crab with a dented silver tin-can shell; row4 col8 normal red crab; row5 col7 bottle-cap crab and col9 tin-can hermit. Cartoon eyes, funny, no horror. Render shell/cap armor distinctly and no guns. Sandcastle cannon barrels point RIGHT, sand ball projectiles fly RIGHT on rows 1 and 3. Two glowing pearl currency pickups, one descending above a tile with short sparkle trail.
Exactly five spring-loaded red beach shovels, one OUTSIDE the left edge at the start of each row, pointed RIGHT, last-resort lane defenses.

Top overlay UI: wood frames, chunky crisp pixel edges matching the 3D beach game, high contrast legible numerals. Upper left luminous pearl icon and exact text "150". Beside it exactly SIX unit cards, each with a low-poly defender portrait, costs left-to-right exactly "25", "50", "50", "100", "150", "175". Portraits: sandcastle, pearl shell, inverted bucket, watermelon, darkened watermelon variant, reinforced sandcastle variant. Fifth card darkened to signal cooldown. Red shovel tool icon to right of cards. Bottom RIGHT small wave progress bar in wood frame with turquoise fill and exactly TWO orange flags. No words, no invented letters, no logos or watermark. Only those specified numerals. No Plants vs Zombies characters, plants, sunflowers, peas, walnuts, zombies or recognizable franchise designs. Preserve big readable 3D volumes and horizontal five-lane geometry. Deliver exactly 1536x1024.

