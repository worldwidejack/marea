# Sprite orto — giro 1

Generati con image_gen integrato, senza API esterne. Riferimento: esplorazione_01.jpg. Nessun file esterno alle tre cartelle di consegna è stato modificato; gli originali prodotti dal generatore restano nella sua cartella predefinita.

Verifica con Python/Pillow: tutti PNG RGBA 1024×1024, quattro angoli alpha 0, sfondo trasparente, bordo inferiore del contenuto a y=942. Ritaglio dei margini del generatore usando il bounding box alpha ≥128 (per evitare pixel quasi invisibili fuori sagoma), preservando l’alpha dentro il ritaglio. Ridimensionamento proporzionale e centratura su tela trasparente; nessuna deformazione. Nessuna ombra a terra. Controllo visivo rispetto al concept effettuato.

## zucca/fermo.png

Tentativi: 3.

Scostamenti dal concept: Manovella e apertura superiore più grandi; sorriso e guance reinterpretati. Sportellino presente. Restano lievi variazioni tonali morbide nelle campiture nonostante due rifacimenti: non è una copia perfettamente piatta del concept.

Prompt finale (English):

Create a production game sprite by redrawing ONLY the specified character from the supplied garden game concept, preserving its identity and illustration style. Very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning 2D cartoon. No gradients, no plastic shine, no photographic texture. One whole character, transparent RGBA background, no ground shadow, no scenery, no text, no coins or floating props. 1024x1024 square. Ground contact at y=942, centered horizontally, at least 82 pixels clear on sides and top. Side view facing RIGHT with the slight elevated three-quarter view of the concept. Subject: the happy squat orange segmented crank pumpkin in row 2 column 1 and row 5 column 1. Copy its short broad lobed silhouette, orange cheeks, big white oval eyes with black pupils looking right and open happy smile. Wooden hand crank on top, horizontal wooden grip extending left, vertical spindle in recessed cream-rimmed opening. Include the small hatch integrated into the pumpkin. No arms, no legs, no extra machinery. Idle smiling pose, base of pumpkin touching baseline. STRICT STYLE CORRECTION: every colored area must be a single solid paint color, with only 2 or 3 hard-edged cel-shading regions per part. Absolutely ZERO smooth gradients or airbrushing anywhere, including wood and pumpkin. Use the simple small smiling face and rounded orange cheek lobes of the reference, not a huge open mouth. The wooden crank must stay modest in size like the reference, not oversized. Bold black lines also divide the pumpkin segments. FINAL CORRECTION: the small outlined hatch MUST be visible on the upper left side of the pumpkin body. Reduce crank grip to one quarter of pumpkin body width. Draw ALL regions as perfectly uniform solid ink colors with crisp boundaries, flat vector-like cartoon cel art. Keep orange cheek circles and modest smile.

## peperoncino/fermo.png

Tentativi: 2.

Scostamenti dal concept: Scintilla ridotta nel secondo tentativo. Stelo più lungo e sagoma leggermente più incurvata; piedino marrone semplificato. Lievi variazioni tonali residue nel rosso.

Prompt finale (English):

Create a production game sprite by redrawing ONLY the specified character from the supplied garden game concept, preserving its identity and illustration style. Very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning 2D cartoon. No gradients, no plastic shine, no photographic texture. One whole character, transparent RGBA background, no ground shadow, no scenery, no text, no coins or floating props. 1024x1024 square. Ground contact at y=942, centered horizontally, at least 82 pixels clear on sides and top. Side view facing RIGHT with the slight elevated three-quarter view of the concept. Subject: the red upright fuse chili pepper in row 4 column 2. Copy its curved tapered red body, slightly hooked lower tip, green curved stem with short fuse and a small sharp yellow-orange spark at its end. Angry black eyebrows, white eyes looking RIGHT, small stern mouth. Copy the tiny brown base/feet shown in the reference. No arms or extra accessories. Idle ready pose. Keep spark small and flat-colored without glow. Correction: the spark must be TINY, no wider than one eye, not a large explosion star. Use perfectly uniform flat red and green fill areas, no gradients at all. Match the reference's slender almost upright silhouette and small brown foot/base, avoid oversized separate shoes. Preserve thick black outline and rightward gaze.

## cavolo/fermo.png

Tentativi: 1.

Scostamenti dal concept: Foglie e sopracciglia più geometriche e regolari; espressione leggermente più severa. Lievi variazioni tonali residue nel verde.

Prompt finale (English):

Create a production game sprite by redrawing ONLY the specified character from the supplied garden game concept, preserving its identity and illustration style. Very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning 2D cartoon. No gradients, no plastic shine, no photographic texture. One whole character, transparent RGBA background, no ground shadow, no scenery, no text, no coins or floating props. 1024x1024 square. Ground contact at y=942, centered horizontally, at least 82 pixels clear on sides and top. Side view facing RIGHT with the slight elevated three-quarter view of the concept. Subject: the intact armored green cabbage in the center of rows 2 and 4. Copy the large round cabbage with thick folded overlapping light-green inner leaves and dark saturated green outer leaves, scalloped leafy crown, broad splayed leafy base, determined white eyes and heavy angry black eyebrows looking RIGHT. Mouth small and stern. No limbs, no equipment, no bites or damage. Match the reference leaf structure rather than adding realistic veins. Idle defensive pose.



# Animazioni — giro 2

Generazione: image_gen integrato, ogni tentativo usa esclusivamente il relativo fermo.png originale. Pose base non sovrascritte. Confronto visivo affiancato effettuato per tutti i fotogrammi.

Originali generati 1254×1254: ridimensionamento proporzionale con Pillow su tela RGBA 1024×1024, origine x/y invariata (nessun ricentramento), fattore ricavato dal bordo inferiore alpha ≥128 per contatto a y≈942. Alpha del generatore preservato, nessuna ombra aggiunta. Verificati mode RGBA, misura 1024×1024 e alpha 0 in tutti e quattro gli angoli. Il generatore non garantisce identità pixel per pixel: gli scostamenti visibili residui sono indicati sotto.

## zucca/manovella_1.png

Tentativi: 1.

Scostamenti residui: Guance con piccoli riflessi aggiunti; lieve variazione del sorriso e del tratto. Sagoma del corpo visivamente coerente.

Prompt finale (English):

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a right-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. Rotate only the top wooden crank by one quarter turn around its upright shaft, foreshortening its leftward handle toward the viewer. Puff the cheeks with effort and squeeze both eyes shut. Keep the pumpkin body silhouette, panel hatch CLOSED, rim, shaft and smile position unchanged.

## zucca/manovella_2.png

Tentativi: 1.

Scostamenti residui: Lievi variazioni di contorno e campiture; nessun cambiamento sostanziale di identità rilevato nel confronto.

Prompt finale (English):

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a right-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. Rotate only the top wooden crank by one half turn from the base, so the handle extends to the RIGHT of the upright shaft instead of the left. The little orange hatch on the upper LEFT shoulder of the pumpkin begins to lift, slightly ajar. Keep eyes and happy expression as in the base, body silhouette unchanged.

## zucca/seme.png

Tentativi: 1.

Scostamenti residui: Due segni di movimento dorati aggiunti sotto il seme; lievi variazioni del tratto. Seme e sportello nella zona richiesta.

Prompt finale (English):

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a right-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. Open the little rectangular orange hatch on the upper LEFT shoulder of the pumpkin. One shiny GOLDEN SEED (pointed oval pumpkin seed, not a coin) jumps upward out of that hatch into the empty space above that left shoulder, without overlapping the crank. Happy open-mouth expression. Keep base eyes, crank orientation, pumpkin body silhouette and all other details identical. Keep the seed small enough to fit existing empty canvas; do not move or shrink the pumpkin.

## peperoncino/gonfio.png

Tentativi: 1.

Scostamenti residui: Il piedino e la curva inferiore presentano piccole differenze; il gonfiore è indicativo, non una trasformazione geometrica esatta del 10%.

Prompt finale (English):

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a right-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. Inflate only the red pepper body approximately 10 percent, anchored at its existing ground contact and preserving its curved silhouette and original wooden foot. Puff cheeks and squeeze eyes shut with effort. Shorten the small tan fuse at the green stem tip and enlarge its spark. Keep original red colors and stem design.

## peperoncino/rovente.png

Tentativi: 3.

Scostamenti residui: Tre tentativi totali: il primo manteneva gli occhi troppo arrabbiati; il secondo aveva gonfiore poco evidente e alterava la curva. Finale con pancia più gonfia, occhi sgranati e due sbuffi. Persistono leggere variazioni di piedino, stelo e campiture; il 18% è indicativo, non misurato come deformazione esatta.

Prompt finale (English):

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a right-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. Inflate only the pepper body approximately 18 percent, anchored to original ground contact; keep original wooden foot and curved pepper identity. Body now hot bright red-orange with flat cel-shaded luminous highlights (no external glow wash). Eyes wide open, looking RIGHT. Add two small cartoon steam puffs above the head. Tan fuse almost burned away, big yellow-orange spark at its tip. Preserve green stem. All effects fit the existing empty canvas. FINAL CORRECTION: keep the exact original curved pepper tip and exact original foot at x460..650, y850..942. The BODY ONLY must visibly balloon horizontally by 18 percent: broad round cheeks and broad belly, noticeably rounder than the base. Keep its original height, stem at the original coordinates and ground contact fixed. Eyes wide open with raised worried brows and pupils looking RIGHT. Short tan fuse almost gone. Only two compact steam puffs and a larger spark, no extra flying embers. Red-orange cel highlights. Do not stretch or straighten the hooked lower body, do not move the foot.

## cavolo/rosicchiato.png

Tentativi: 1.

Scostamenti residui: Lievi variazioni del disegno degli occhi insieme alle sopracciglia preoccupate; foglie intatte visivamente coerenti.

Prompt finale (English):

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a right-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. Remove a few small bite-shaped notches ONLY from the outer leaves on the RIGHT side, facing enemies. Change eyebrows to worried. Preserve all leaf arrangement, colors, body dimensions and position; bites subtract small pieces, they do not shift or shrink the cabbage. Keep mouth and eyes otherwise unchanged.

## cavolo/mezzo.png

Tentativi: 1.

Scostamenti residui: Piccole variazioni del tratto sulle foglie intatte e della bocca; danni più estesi a destra, senza ricentrare il personaggio.

Prompt finale (English):

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a right-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. Heavily eaten damage ONLY on the RIGHT side: several large scalloped bites missing from the right outer leaves and torn right leaf edges. Tired worried face, one eye half closed, worried eyebrows. Preserve overall original scale and position and intact left/top/bottom silhouette; bites subtract chunks rather than shifting, shrinking or redesigning the cabbage. No detached debris.

## zucca/chiusi.png

Tentativi: 1.

Scostamenti residui: Lievi variazioni di rasterizzazione e campiture: non identico pixel per pixel fuori dagli occhi, ma sagoma e dettagli visivamente coerenti.

Prompt finale (English):

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a right-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. BLINK FRAME: change ONLY the two eyes to gently closed black curved eyelids in exactly the same eye locations. Keep eyebrows, cheeks, smile, crank, hatch, every body outline, shading patch and ALL other pixels identical to base.

## cavolo/chiusi.png

Tentativi: 1.

Scostamenti residui: Lievi variazioni di rasterizzazione, sopracciglia e campiture: non identico pixel per pixel fuori dagli occhi, ma disposizione delle foglie e sagoma visivamente coerenti.

Prompt finale (English):

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a right-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. BLINK FRAME: change ONLY the two eyes to closed black curved eyelids in exactly the same eye locations. Keep angry eyebrows, frowning mouth, every leaf shape, all colors and shading patches and ALL other pixels identical to base.
