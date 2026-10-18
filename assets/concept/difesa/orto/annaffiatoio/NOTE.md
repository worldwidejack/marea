# Giro 2 — fotogrammi annaffiatoio e capobanda

Generati con lo strumento integrato image_gen; ogni modifica parte dalla base originale indicata, mai dal fotogramma precedente. Nessuna API esterna.

Verifica tecnica con Python 3 + PIL: RGBA, 1024×1024, quattro angoli alpha 0. Gli output di misura diversa sono ridotti proporzionalmente senza spostamento orizzontale; solo allineamento verticale automatico del contatto visibile a y≈942 (soglia alpha 128); per le lumache successive alla prima è preservata la quota della rispettiva base, compresa tra y933 e y942. Alpha originale conservato. Confronto visivo affiancato eseguito per ogni file. Le differenze residue sono riportate sotto; non si garantisce identità pixel per pixel.

## annaffiatoio/scatta_1.png

- Base: `annaffiatoio/fermo.png`
- Tentativi: 3
- Verifica e cambiamenti indesiderati: Tentativo 1 scartato: riduzione globale del personaggio, tavoletta più stretta, una spira aggiuntiva. Tentativo 2 scartato: prospettiva della tavoletta e terminazione della molla alterate. Tentativo 3 consegnato (limite raggiunto): rimangono leggere variazioni nella prospettiva/altezza della tavoletta, nel manico e nei contorni dell'annaffiatoio; identità e palette mantenute, nessuna espressione aggiunta. Output nativo 1254×1254, ridotto proporzionalmente a 1024 e traslato solo verticalmente +10 px per appoggio y942. Non è una copia pixel-identica della base.
- Generazione scelta: `/Users/giacomolevi/.codex/generated_images/01a14eee-8f14-7f40-ba29-f4bda3c4406e/exec-67167cd7-7e72-433b-9611-c481ee2d9b43.png`

### Final prompt (English)

Use case: precise-object-edit. ORIGINAL IMAGE is the absolute geometry/color reference, a 1024x1024 game sprite. Make a tiny localized edit, never redraw or reinterpret the overall sprite. Preserve the complete orange wooden base EXACTLY, including its perspective and all contour coordinates: x164..770, top edge y676, bottom edge y942. Preserve the original can size: green body x197..660, handle x84..289, nozzle x731..940; keep the original nozzle shape and seven holes. Extend the existing three-turn spring a little upwards, without changing its width, coil thickness or attachment, then tilt the original FULL SIZE can slightly clockwise toward RIGHT. Only pose articulation is permitted. Add a bright cyan powerful straight jet issuing horizontally RIGHT from the watering holes, cropped at the right canvas border. The short visible length of the water is intentional: never make the can smaller or change its original layout to make room. No new curls at the bottom of the spring. Keep all original colors and thick black linework. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Background fully transparent; no cast ground shadow, text or scenery.

## annaffiatoio/scatta_2.png

- Base: `annaffiatoio/fermo.png`
- Tentativi: 2
- Verifica e cambiamenti indesiderati: Tentativo 1 scartato: beccuccio leggermente ridotto e corpo più stretto. Tentativo 2 scelto: proporzioni più vicine, tre spire e sette fori conservati; piccole variazioni locali nei contorni e nelle campiture della tavoletta e del manico, non pixel-identici. Molla più compressa e spruzzi differenti rispetto a scatta_1. Output 1254×1254 normalizzato a 1024, offset verticale +2 px, appoggio y942.
- Generazione scelta: `/Users/giacomolevi/.codex/generated_images/01a14eee-8f14-7f40-ba29-f4bda3c4406e/exec-9f0b00a4-77e2-4bfd-9df6-9445466f398b.png`

### Final prompt (English)

Use case: precise-object-edit. Create scatta_2, a subtle recoil animation frame by editing this ORIGINAL 1024x1024 base sprite. Only three changes are permitted: extend the spring very slightly (20px upward, not a long stretched spring); tilt the SAME can forward slightly clockwise towards RIGHT; add a forceful straight horizontal cyan water jet issuing RIGHT, with different splashes (three tiny angular droplets above, two separated larger droplets below). Water is clipped at the right border. ABSOLUTELY RETAIN the original sizes: nozzle is about 205 pixels wide and 284 pixels tall, NOT smaller or rounder; can body is about 463 pixels wide, handle is about 205 pixels wide. Retain exactly seven nozzle holes. The can does NOT shrink. Preserve every outline coordinate and marking of the orange wooden platform, x164..770, top y676 bottom y942, same perspective and shadows. Same three-turn coil, same full width, same bottom attachment. A surgical articulation change, not a reinterpretation. The nozzle should remain near the right canvas edge, leaving very little room for water; this is intentional. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. No face, new details, extra spring turns, ground shadow, text, scenery or background.

## capobanda/cammina_1.png

- Base: `lumaca/cammina_1.png`
- Tentativi: 1
- Verifica e cambiamenti indesiderati: Primo tentativo scelto. Confronto affiancato: identità, posa, espressione, scala e colori della lumaca visivamente coerenti; minime differenze di rasterizzazione/contorno. La bandierina è uscita più grande delle coordinate suggerite nel prompt (circa 260 px di larghezza, asta fino a y110); questa misura è stata usata come riferimento di coerenza nelle varianti successive, con variazioni residue riportate sotto. Output 1254×1254 ridotto a 1024, offset verticale +1 px, appoggio y942.
- Generazione scelta: `/Users/giacomolevi/.codex/generated_images/01a14eee-8f14-7f40-ba29-f4bda3c4406e/exec-3c240635-de17-4d43-80af-62d8ab57f160.png`

### Final prompt (English)

Use case: precise-object-edit. The supplied image is the EXACT original bare snail animation frame; retain the entire snail unchanged in its existing pixel positions. Add ONLY one accessory: a small triangular solid RED pennant on a thin brown wooden stick planted at the very top center of the purple shell, near x675 y395. The stick goes vertically upwards to about y220. The red triangle is attached near the top, and waves backwards to the RIGHT, extending about 135 pixels rightwards; it has the same bold black cartoon outline and a single flat darker-red fold. Do not cover or modify the shell spiral or highlight. The snail faces LEFT. Preserve ALL original shell/body shapes, purple/lavender colors, highlights, shadows, eyes, pupils, eyebrows, stalks, mouth expression, exact existing pose and tail, with no retouch or redraw. Do NOT move or resize the snail to fit the flag: there is already abundant empty space above the shell. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Same 2D cartoon full-color sprite; no ground shadow, text, scene elements, symbols or decorations on the flag. Frame cammina_1: flag almost fully extended to the RIGHT, with just one gentle downward fold along its lower edge. Only add this accessory; change nothing else.

## capobanda/cammina_2.png

- Base: `lumaca/cammina_2.png`
- Tentativi: 2
- Verifica e cambiamenti indesiderati: Tentativo 1 scartato: bandiera troppo grande rispetto a cammina_1. Tentativo 2 scelto: corpo visivamente coerente con la base (posa, espressione e colori), piccole differenze di rasterizzazione. Restano lievi variazioni nella lunghezza/posizione dell'asta e nelle dimensioni della bandiera rispetto a cammina_1: da controllare nella sequenza. Output 1254×1254 ridotto a 1024 senza traslazione; contatto y933 come la base originale.
- Generazione scelta: `/Users/giacomolevi/.codex/generated_images/01a14eee-8f14-7f40-ba29-f4bda3c4406e/exec-d9390eea-547e-4ec4-9eed-b97b6f55942d.png`

### Final prompt (English)

Use case: precise-object-edit. The supplied image is the EXACT original bare snail animation frame; retain the entire snail unchanged in its existing pixel positions. Add ONLY one accessory: a small triangular solid RED pennant on a thin brown wooden stick planted at the very top center of the purple shell, near x675 y395. The stick goes vertically upwards to about y220. The red triangle is attached near the top, and waves backwards to the RIGHT, extending about 135 pixels rightwards; it has the same bold black cartoon outline and a single flat darker-red fold. Do not cover or modify the shell spiral or highlight. The snail faces LEFT. Preserve ALL original shell/body shapes, purple/lavender colors, highlights, shadows, eyes, pupils, eyebrows, stalks, mouth expression, exact existing pose and tail, with no retouch or redraw. Do NOT move or resize the snail to fit the flag: there is already abundant empty space above the shell. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Same 2D cartoon full-color sprite; no ground shadow, text, scene elements, symbols or decorations on the flag. Frame cammina_2: small pennant pointed to the RIGHT, very slightly upturned at its rightmost tip, one shallow dark red fold. Keep the accessory compact: flag width at most HALF the diameter of the shell. Keep its wooden pole thin. Preserve the entire snail precisely. Only add this accessory; change nothing else.

## capobanda/cammina_3.png

- Base: `lumaca/cammina_3.png`
- Tentativi: 1
- Verifica e cambiamenti indesiderati: Primo tentativo scelto. Corpo, guscio, coda ed espressione visivamente coerenti con la base; piccole variazioni di rasterizzazione/contorni, non una copia pixel-identica. Bandiera con punta appena abbassata, asta inserita sulla sommità del guscio. Output 1254×1254 ridotto a 1024, offset verticale −2 px, contatto y936 come la base.
- Generazione scelta: `/Users/giacomolevi/.codex/generated_images/01a14eee-8f14-7f40-ba29-f4bda3c4406e/exec-f50c05c1-8790-4f80-8a70-2cd29cd703a5.png`

### Final prompt (English)

Use case: precise-object-edit. The supplied image is the EXACT original bare snail animation frame; retain the entire snail unchanged in its existing pixel positions. Add ONLY one accessory: a small triangular solid RED pennant on a thin brown wooden stick planted at the very top center of the purple shell, near x675 y395. The stick goes vertically upwards to about y220. The red triangle is attached near the top, and waves backwards to the RIGHT, extending about 135 pixels rightwards; it has the same bold black cartoon outline and a single flat darker-red fold. Do not cover or modify the shell spiral or highlight. The snail faces LEFT. Preserve ALL original shell/body shapes, purple/lavender colors, highlights, shadows, eyes, pupils, eyebrows, stalks, mouth expression, exact existing pose and tail, with no retouch or redraw. Do NOT move or resize the snail to fit the flag: there is already abundant empty space above the shell. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Same 2D cartoon full-color sprite; no ground shadow, text, scene elements, symbols or decorations on the flag. Frame cammina_3: pennant pointing RIGHT, its pointed end dips very slightly downward, one shallow horizontal dark-red fabric fold. Keep the flag compact, width at most HALF the shell diameter. Stick rigid. Add only this flag to the existing image. No change to the snail.

## capobanda/cammina_4.png

- Base: `lumaca/cammina_4.png`
- Tentativi: 3
- Verifica e cambiamenti indesiderati: Tre tentativi: 1 scartato per asta troppo corta e pomello non richiesto; 2 scartato per asta/bandiera troppo grandi; 3 scelto. Corpo, occhi, espressione e guscio visivamente coerenti con la base. Rimangono lievi variazioni dello spessore/posizione dell'asta tra i frame e piccole differenze di rasterizzazione. Output 1254×1254 ridotto a 1024, offset verticale −1 px, contatto y941 come la base.
- Generazione scelta: `/Users/giacomolevi/.codex/generated_images/01a14eee-8f14-7f40-ba29-f4bda3c4406e/exec-2d3f9a7a-95d1-423e-a70c-964c125d5684.png`

### Final prompt (English)

Use case: precise-object-edit. Add ONLY a red triangular pennant on a thin straight wooden stick planted on top of the purple shell in the supplied original snail sprite. Do not redraw the snail. The stick is plain brown with a simple rounded end, NO spherical knob, finial, cap, decoration or extra attachment. The exposed stick height above the shell is a little LESS THAN HALF the diameter of the shell, about 230 pixels in the original 1024 square, reaching from shell top y390 up to y150. The stick is near x665. The red flag is attached near its top and extends backwards towards RIGHT, its width about 200 pixels (clearly less than half the shell diameter), its hoist height about 110 pixels. The pennant has a slight S-shaped fold, a level pointed right tip, and ONE flat darker-red crease. Preserve every detail of the original snail exactly: silhouette, scale, eye-stalks, expression, eye direction, shell spiral and highlights, lavender foot and tail, and all original pixels/coordinates. Do not shrink, reposition or reshape the snail to accommodate the flag. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Same chunky cartoon 2D look. No background, shadow on ground, text, symbols, scenery or new body details. Only add the accessory; change nothing else.

## capobanda/mangia_1.png

- Base: `lumaca/mangia_1.png`
- Tentativi: 1
- Verifica e cambiamenti indesiderati: Primo tentativo scelto. Nessuna modifica indesiderata evidente a bocca aperta, denti, lingua, occhi o guscio nel confronto affiancato; minime differenze di rasterizzazione. Asta e bandiera vicine a cammina_4, piega diversa. Output 1254×1254 ridotto a 1024 senza traslazione, contatto y942.
- Generazione scelta: `/Users/giacomolevi/.codex/generated_images/01a14eee-8f14-7f40-ba29-f4bda3c4406e/exec-174c268e-9802-4e88-9721-7ffbc822bc06.png`

### Final prompt (English)

Use case: precise-object-edit. Add ONLY a red triangular pennant on a thin straight wooden stick planted on top of the purple shell in the supplied original snail sprite. Do not redraw the snail. The stick is plain brown with a simple rounded end, NO spherical knob, finial, cap, decoration or extra attachment. The exposed stick height above the shell is a little LESS THAN HALF the diameter of the shell, about 230 pixels in the original 1024 square, reaching from shell top y390 up to y150. The stick is near x665. The red flag is attached near its top and extends backwards towards RIGHT, its width about 200 pixels (clearly less than half the shell diameter), its hoist height about 110 pixels. The pennant has a gentle downward fold, with a slightly raised pointed right tip, and ONE flat darker-red crease. Preserve every detail of the original snail exactly: silhouette, scale, eye-stalks, expression, eye direction, shell spiral and highlights, lavender foot and tail, and all original pixels/coordinates. Do not shrink, reposition or reshape the snail to accommodate the flag. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Same chunky cartoon 2D look. No background, shadow on ground, text, symbols, scenery or new body details. Only add the accessory; change nothing else. Frame mangia_1: preserve the original wide-open mouth, every tooth, the tongue, mouth interior and exact eye expression. Do not invent a new eating pose. Add the flag only.

## capobanda/mangia_2.png

- Base: `lumaca/mangia_2.png`
- Tentativi: 1
- Verifica e cambiamenti indesiderati: Primo tentativo scelto. Nessuna modifica indesiderata evidente alle guance gonfie, alla bocca chiusa o all'espressione; scala e posizione della lumaca visivamente coerenti. Minime differenze nei contorni/rasterizzazione, lieve variazione del punto di inserimento dell'asta rispetto a mangia_1. Output 1254×1254 ridotto a 1024 senza traslazione, contatto y942.
- Generazione scelta: `/Users/giacomolevi/.codex/generated_images/01a14eee-8f14-7f40-ba29-f4bda3c4406e/exec-c7effab1-acb1-4f3f-96cc-1a408721f453.png`

### Final prompt (English)

Use case: precise-object-edit. Add ONLY a red triangular pennant on a thin straight wooden stick planted on top of the purple shell in the supplied original snail sprite. Do not redraw the snail. The stick is plain brown with a simple rounded end, NO spherical knob, finial, cap, decoration or extra attachment. The exposed stick height above the shell is a little LESS THAN HALF the diameter of the shell, about 230 pixels in the original 1024 square, reaching from shell top y390 up to y150. The stick is near x665. The red flag is attached near its top and extends backwards towards RIGHT, its width about 200 pixels (clearly less than half the shell diameter), its hoist height about 110 pixels. The pennant has a small shallow downward wave, with a slightly downward-pointing right tip, and ONE flat darker-red crease. Preserve every detail of the original snail exactly: silhouette, scale, eye-stalks, expression, eye direction, shell spiral and highlights, lavender foot and tail, and all original pixels/coordinates. Do not shrink, reposition or reshape the snail to accommodate the flag. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Same chunky cartoon 2D look. No background, shadow on ground, text, symbols, scenery or new body details. Only add the accessory; change nothing else. Frame mangia_2: preserve the original puffed cheeks, closed chewing mouth, eyes, cheek highlights and exact expression. Do not open its mouth or invent a new chewing pose. Add the flag only.

## capobanda/mangia_3.png

- Base: `lumaca/mangia_3.png`
- Tentativi: 1
- Verifica e cambiamenti indesiderati: Primo tentativo scelto. Occhi chiusi, bocca e due frammenti verdi conservati visivamente come nella base; nessuna nuova espressione o dettaglio corporeo evidente. Minime differenze di rasterizzazione; piega della bandiera diversa. Output 1254×1254 ridotto a 1024, offset verticale −1 px, contatto y942.
- Generazione scelta: `/Users/giacomolevi/.codex/generated_images/01a14eee-8f14-7f40-ba29-f4bda3c4406e/exec-180bcf99-fbd2-4cc9-a79a-336e51dc34e0.png`

### Final prompt (English)

Use case: precise-object-edit. Add ONLY a red triangular pennant on a thin straight wooden stick planted on top of the purple shell in the supplied original snail sprite. Do not redraw the snail. The stick is plain brown with a simple rounded end, NO spherical knob, finial, cap, decoration or extra attachment. The exposed stick height above the shell is a little LESS THAN HALF the diameter of the shell, about 230 pixels in the original 1024 square, reaching from shell top y390 up to y150. The stick is near x665. The red flag is attached near its top and extends backwards towards RIGHT, its width about 200 pixels (clearly less than half the shell diameter), its hoist height about 110 pixels. The pennant has a soft upward ripple along the lower edge, with its pointed right tip almost level, and ONE flat darker-red crease. Preserve every detail of the original snail exactly: silhouette, scale, eye-stalks, expression, eye direction, shell spiral and highlights, lavender foot and tail, and all original pixels/coordinates. Do not shrink, reposition or reshape the snail to accommodate the flag. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Same chunky cartoon 2D look. No background, shadow on ground, text, symbols, scenery or new body details. Only add the accessory; change nothing else. Frame mangia_3: retain the EXACT closed eyelids, pursed chewing mouth, the two little existing green leaf fragments by the mouth and all other original pixels. Do not open the eyes, remove leaves, change mouth, or create a new expression. Add the flag only.

## capobanda/ko.png

- Base: `lumaca/ko.png`
- Tentativi: 1
- Verifica e cambiamenti indesiderati: Primo tentativo scelto. Occhi a spirale, lingua e posa KO visivamente coerenti con la base. Bandierina floscia e piegata verso il basso a destra come richiesto. L'asta è risultata circa 35–45 px più alta rispetto alle pose mangia, variazione indesiderata dell'accessorio; minime differenze di rasterizzazione nel corpo. Output 1254×1254 ridotto a 1024 senza traslazione, contatto y942.
- Generazione scelta: `/Users/giacomolevi/.codex/generated_images/01a14eee-8f14-7f40-ba29-f4bda3c4406e/exec-064780f5-593f-4c70-9c31-e8c14d18a8c6.png`

### Final prompt (English)

Use case: precise-object-edit. The supplied image is the EXACT original KO snail game sprite. Add ONLY a red triangular pennant on a thin plain brown wooden stick planted at the very top of its purple shell, near x665 y390, extending about 230 pixels above the shell to y150. Stick has a simple rounded end, no knob or decoration. This is the defeated KO frame: the red fabric hangs visibly LIMP, DROOPING DOWN under gravity on the RIGHT side of the stick. It is the same triangular pennant, normal unfolded width about 200px and hoist 110px, but now folded softly downward so its tip points down-right, no wind, no proud horizontal streaming. Use one flat darker-red fold with a thick black outline. Keep the wooden stick upright and intact. Preserve the entire snail EXACTLY as supplied: dizzy spiral pupils, the particular eye-stalk pose, tongue hanging out, mouth, lavender body, foot, tail, purple shell, shell spiral, every highlight and shadow, outline thickness, proportions and location. Do not redraw, rescale or reposition the snail; do not add other defeat effects. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Cartoon 2D full colors, flat shadows. No ground shadow, background, scenery, text, extra symbols or other accessories. Only add the limp flag, change nothing else.

## Controllo finale

- Consegnati 10 PNG: 2 annaffiatoio + 8 capobanda.
- Tutti RGBA, 1024×1024, alpha minimo 0/massimo 255 e quattro angoli alpha 0.
- Totale PNG: 5113,6 KiB.
- SHA256 delle 9 immagini di riferimento verificati identici a inizio lavoro.
- Foglio finale dei 10 fotogrammi guardato; confronto temporaneo rimosso.
- Nessun git, build, server, codice, test, diario o file fuori dalle due cartelle assegnate modificato manualmente. Output nativi dello strumento conservati in ~/.codex/generated_images/.
- Limite qualitativo: piccole variazioni geometriche nell’annaffiatoio e nelle aste/bandierine; vedi note per fotogramma. Il corpo delle varianti capobanda risulta visivamente fedele alle rispettive basi.
