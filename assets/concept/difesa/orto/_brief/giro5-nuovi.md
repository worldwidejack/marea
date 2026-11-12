# Personaggi nuovi dell'Orto (livelli 7-12): brief dati a Codex

Generati con Codex (`codex exec`, immagine integrata) a mano di Claude Code. Stile di riferimento: `_FOGLIO_cast.jpg`; foglio dei nuovi:
`_FOGLIO_nuovi.jpg`. Ogni PNG è 1024² (Codex consegna 1254², lo porta a 1024 `tools/difesa_pelle.py`), alpha vero, piedi a y≈942.
Poi `tools/difesa_pelle.py assets/concept/difesa/orto/manifest_nuovi.json --aggiungi`. Tentativi: uno per immagine, tranne la pannocchia
(`chiusi`, uscita uguale a un'altra immagine: rifatta) e l'ala della vespa (`cammina_2`, rifatta con «flat, no blur»).
I PNG stanno solo sul computer di chi li ha fatti (`assets/concept/**/*.png` è ignorato).

## Foglio dei personaggi (un solo disegno, con _FOGLIO_cast.jpg come riferimento di stile)

### nuovi/concept_nuovi.png
Riferimenti: `_FOGLIO_cast.jpg`

The attached image is the art reference of a 2D garden tower-defense game (Plants vs Zombies style): very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning cartoon, vegetables as defenders (they face RIGHT), garden insects as enemies (they face LEFT, angry eyes), a tiny bit of elevated three-quarter view. Design a NEW CHARACTER SHEET for the same game in EXACTLY the same style (same outline thickness, same flat colors, same angry/cute faces, no gradients, no plastic shine, no photographic texture). Landscape image, dark brown background like the bottom of the reference, two rows of cream cards with a thick dark border and a short Italian caption under each character, like the DIFENSORI and NEMICI cards of the reference. Row 1 title DIFENSORI, 5 new defenders facing RIGHT: (1) 'Dionea': a carnivorous Venus flytrap, two big green jaw-leaves with red inside and cartoon teeth, mouth wide open facing right, short green stalk, angry eyes above the jaws. (2) 'Cetriolo gemello': two dark-green cucumbers fused side by side acting as a twin cannon on a small wooden stand like the carrot cannon of the reference, two barrels pointing right, determined eyes. (3) 'Zucca gigante': a very TALL and big orange pumpkin (clearly taller and broader than the small crank pumpkin of the reference), stern face with heavy eyebrows, thick green stem and curly vine on top, NO crank. (4) 'Pannocchia ardente': an upright yellow corn cob with green husk leaves at the base, burning like a torch with a flat-colored orange and yellow flame on top, fierce eyes on the cob. (5) 'Melone mortaio': a round striped watermelon used as a mortar, a fat dark tube sticking up and to the right at 45 degrees from its top, red cut-open smile mouth, small wooden base. Row 2 title NEMICI, 3 new enemies facing LEFT plus 2 projectiles: (6) 'Bruco con lo scudo': a fat orange caterpillar with segmented body and tiny legs, holding a huge green leaf in front of him like a shield, grumpy face. (7) 'Vespa': a flying wasp with yellow and black stripes, big sharp stinger, blurred little wings, angry eyes, hovering. (8) 'Maggiolino gigante': a HUGE dark red-brown stag beetle with two big curved golden-ochre horns, armored shell with a lighter outline, very angry eyes, drawn bigger than all other cards' characters. (9) 'Seme infuocato': a small green pea-like seed covered in flat orange flame. (10) 'Palla di melone': a small round green striped melon ball with a short lit fuse. Keep every character clearly different in silhouette from the existing cast of the reference (carrot cannon, pumpkin with crank, chili pepper, cabbage, radish mine, snail, blue beetle, grasshopper). No text other than the row titles and the character captions.

## Pose base (una per personaggio, dal foglio dei personaggi)

### dionea/fermo.png
Riferimenti: `nuovi/concept_nuovi.png`

Create a production game sprite by redrawing ONLY the specified character from the supplied character sheet, preserving its identity, colors and illustration style. Very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning 2D cartoon. No gradients, no plastic shine, no photographic texture. One whole character, REAL transparent RGBA background (genuine alpha channel, not a painted checkerboard), no ground shadow, no scenery, no text, no floating props. 1024x1024 square. Ground contact (base, feet, stand) at y=942, centered horizontally, at least 82 pixels clear on sides and top. Slight elevated three-quarter view like the sheet. STRICT STYLE: every colored area is a single solid paint color with only 2 or 3 hard-edged cel-shading regions per part, absolutely ZERO smooth gradients or airbrushing. Keep the exact outline thickness of the sheet. Side view facing RIGHT. Subject: the 'Dionea' card, the carnivorous Venus flytrap with the wide-open toothy jaws facing right, angry eyes above the jaws, curved green stalk and leafy base. Idle ready pose, jaws wide open waiting. Base leaves touching the baseline.

### gemello/fermo.png
Riferimenti: `nuovi/concept_nuovi.png`

Create a production game sprite by redrawing ONLY the specified character from the supplied character sheet, preserving its identity, colors and illustration style. Very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning 2D cartoon. No gradients, no plastic shine, no photographic texture. One whole character, REAL transparent RGBA background (genuine alpha channel, not a painted checkerboard), no ground shadow, no scenery, no text, no floating props. 1024x1024 square. Ground contact (base, feet, stand) at y=942, centered horizontally, at least 82 pixels clear on sides and top. Slight elevated three-quarter view like the sheet. STRICT STYLE: every colored area is a single solid paint color with only 2 or 3 hard-edged cel-shading regions per part, absolutely ZERO smooth gradients or airbrushing. Keep the exact outline thickness of the sheet. Side view facing RIGHT. Subject: the 'Cetriolo gemello' card, the twin cucumber cannon on a small wooden stand with two barrels pointing right and determined eyes. Idle ready pose. Stand touching the baseline.

### zuccone/fermo.png
Riferimenti: `nuovi/concept_nuovi.png`

Create a production game sprite by redrawing ONLY the specified character from the supplied character sheet, preserving its identity, colors and illustration style. Very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning 2D cartoon. No gradients, no plastic shine, no photographic texture. One whole character, REAL transparent RGBA background (genuine alpha channel, not a painted checkerboard), no ground shadow, no scenery, no text, no floating props. 1024x1024 square. Ground contact (base, feet, stand) at y=942, centered horizontally, at least 82 pixels clear on sides and top. Slight elevated three-quarter view like the sheet. STRICT STYLE: every colored area is a single solid paint color with only 2 or 3 hard-edged cel-shading regions per part, absolutely ZERO smooth gradients or airbrushing. Keep the exact outline thickness of the sheet. Side view facing RIGHT. Subject: the 'Zucca gigante' card, the very tall and broad orange pumpkin with stern eyebrows, green stem and curly vine on top, no crank. Make it slightly taller than wide. Idle pose looking right. Pumpkin base touching the baseline.

### pannocchia/fermo.png
Riferimenti: `nuovi/concept_nuovi.png`

Create a production game sprite by redrawing ONLY the specified character from the supplied character sheet, preserving its identity, colors and illustration style. Very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning 2D cartoon. No gradients, no plastic shine, no photographic texture. One whole character, REAL transparent RGBA background (genuine alpha channel, not a painted checkerboard), no ground shadow, no scenery, no text, no floating props. 1024x1024 square. Ground contact (base, feet, stand) at y=942, centered horizontally, at least 82 pixels clear on sides and top. Slight elevated three-quarter view like the sheet. STRICT STYLE: every colored area is a single solid paint color with only 2 or 3 hard-edged cel-shading regions per part, absolutely ZERO smooth gradients or airbrushing. Keep the exact outline thickness of the sheet. Side view facing RIGHT. Subject: the 'Pannocchia ardente' card, the upright yellow corn cob in green husk leaves burning like a torch with a flat orange and yellow flame on top, fierce eyes looking right. Idle pose. Husk leaves touching the baseline.

### mortaio/fermo.png
Riferimenti: `nuovi/concept_nuovi.png`

Create a production game sprite by redrawing ONLY the specified character from the supplied character sheet, preserving its identity, colors and illustration style. Very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning 2D cartoon. No gradients, no plastic shine, no photographic texture. One whole character, REAL transparent RGBA background (genuine alpha channel, not a painted checkerboard), no ground shadow, no scenery, no text, no floating props. 1024x1024 square. Ground contact (base, feet, stand) at y=942, centered horizontally, at least 82 pixels clear on sides and top. Slight elevated three-quarter view like the sheet. STRICT STYLE: every colored area is a single solid paint color with only 2 or 3 hard-edged cel-shading regions per part, absolutely ZERO smooth gradients or airbrushing. Keep the exact outline thickness of the sheet. Side view facing RIGHT. Subject: the 'Melone mortaio' card, the striped watermelon mortar with a fat dark tube sticking up and to the right at 45 degrees, red open smile, small wooden base, curly vine. Idle ready pose. Wooden base touching the baseline.

### scudo/fermo.png
Riferimenti: `nuovi/concept_nuovi.png`

Create a production game sprite by redrawing ONLY the specified character from the supplied character sheet, preserving its identity, colors and illustration style. Very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning 2D cartoon. No gradients, no plastic shine, no photographic texture. One whole character, REAL transparent RGBA background (genuine alpha channel, not a painted checkerboard), no ground shadow, no scenery, no text, no floating props. 1024x1024 square. Ground contact (base, feet, stand) at y=942, centered horizontally, at least 82 pixels clear on sides and top. Slight elevated three-quarter view like the sheet. STRICT STYLE: every colored area is a single solid paint color with only 2 or 3 hard-edged cel-shading regions per part, absolutely ZERO smooth gradients or airbrushing. Keep the exact outline thickness of the sheet. Side view facing LEFT. Subject: the 'Bruco con lo scudo' card, the fat orange segmented caterpillar with yellow spots holding a huge green leaf in front of him like a shield, grumpy face looking LEFT, tiny legs. Walking-ready idle pose, the leaf shield is held in front of his face on the LEFT side. Feet touching the baseline.

### vespa/fermo.png
Riferimenti: `nuovi/concept_nuovi.png`

Create a production game sprite by redrawing ONLY the specified character from the supplied character sheet, preserving its identity, colors and illustration style. Very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning 2D cartoon. No gradients, no plastic shine, no photographic texture. One whole character, REAL transparent RGBA background (genuine alpha channel, not a painted checkerboard), no ground shadow, no scenery, no text, no floating props. 1024x1024 square. Ground contact (base, feet, stand) at y=942, centered horizontally, at least 82 pixels clear on sides and top. Slight elevated three-quarter view like the sheet. STRICT STYLE: every colored area is a single solid paint color with only 2 or 3 hard-edged cel-shading regions per part, absolutely ZERO smooth gradients or airbrushing. Keep the exact outline thickness of the sheet. Side view facing LEFT. Subject: the 'Vespa' card, the yellow and black striped wasp with big sharp stinger, small light-blue wings spread and angry eyes looking LEFT, hovering in the air. Keep it hovering; the lowest point of the stinger/legs touches y=942 (this is its reference baseline).

### gigante/fermo.png
Riferimenti: `nuovi/concept_nuovi.png`

Create a production game sprite by redrawing ONLY the specified character from the supplied character sheet, preserving its identity, colors and illustration style. Very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning 2D cartoon. No gradients, no plastic shine, no photographic texture. One whole character, REAL transparent RGBA background (genuine alpha channel, not a painted checkerboard), no ground shadow, no scenery, no text, no floating props. 1024x1024 square. Ground contact (base, feet, stand) at y=942, centered horizontally, at least 82 pixels clear on sides and top. Slight elevated three-quarter view like the sheet. STRICT STYLE: every colored area is a single solid paint color with only 2 or 3 hard-edged cel-shading regions per part, absolutely ZERO smooth gradients or airbrushing. Keep the exact outline thickness of the sheet. Side view facing LEFT. Subject: the 'Maggiolino gigante' card, the huge dark red-brown stag beetle with two big curved golden-ochre horns, glossy-looking armored shell drawn with flat cel colors, six legs, very angry eyes looking LEFT. Idle pose. Feet touching the baseline. It must fill the canvas more than other characters (wide: about 85 percent of the width).

### fuoco/fermo.png
Riferimenti: `nuovi/concept_nuovi.png`

Create a production game sprite by redrawing ONLY the specified character from the supplied character sheet, preserving its identity, colors and illustration style. Very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning 2D cartoon. No gradients, no plastic shine, no photographic texture. One whole character, REAL transparent RGBA background (genuine alpha channel, not a painted checkerboard), no ground shadow, no scenery, no text, no floating props. 1024x1024 square. Ground contact (base, feet, stand) at y=942, centered horizontally, at least 82 pixels clear on sides and top. Slight elevated three-quarter view like the sheet. STRICT STYLE: every colored area is a single solid paint color with only 2 or 3 hard-edged cel-shading regions per part, absolutely ZERO smooth gradients or airbrushing. Keep the exact outline thickness of the sheet. Side view facing RIGHT. Subject: the 'Seme infuocato' card, the small green pea-like seed wrapped in a flat-colored orange and yellow flame, angry little eyes. Flying projectile, centered in the canvas, center of the seed at y=640 (reference center), not touching the baseline. Small: about 30 percent of the canvas width.

### palla/fermo.png
Riferimenti: `nuovi/concept_nuovi.png`

Create a production game sprite by redrawing ONLY the specified character from the supplied character sheet, preserving its identity, colors and illustration style. Very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning 2D cartoon. No gradients, no plastic shine, no photographic texture. One whole character, REAL transparent RGBA background (genuine alpha channel, not a painted checkerboard), no ground shadow, no scenery, no text, no floating props. 1024x1024 square. Ground contact (base, feet, stand) at y=942, centered horizontally, at least 82 pixels clear on sides and top. Slight elevated three-quarter view like the sheet. STRICT STYLE: every colored area is a single solid paint color with only 2 or 3 hard-edged cel-shading regions per part, absolutely ZERO smooth gradients or airbrushing. Keep the exact outline thickness of the sheet. Side view facing RIGHT. Subject: the 'Palla di melone' card, the small round green striped melon ball with a short lit fuse and a tiny spark, angry little eyes. Flying projectile, centered, center of the ball at y=640, not touching the baseline. About 30 percent of the canvas width.

### foglia/fermo.png
Riferimenti: `nuovi/concept_nuovi.png`

Create a production game sprite by redrawing ONLY the specified character from the supplied character sheet, preserving its identity, colors and illustration style. Very thick black cartoon outlines, saturated flat colors, hard-edged cel shadows, Saturday morning 2D cartoon. No gradients, no plastic shine, no photographic texture. One whole character, REAL transparent RGBA background (genuine alpha channel, not a painted checkerboard), no ground shadow, no scenery, no text, no floating props. 1024x1024 square. Ground contact (base, feet, stand) at y=942, centered horizontally, at least 82 pixels clear on sides and top. Slight elevated three-quarter view like the sheet. STRICT STYLE: every colored area is a single solid paint color with only 2 or 3 hard-edged cel-shading regions per part, absolutely ZERO smooth gradients or airbrushing. Keep the exact outline thickness of the sheet. Subject: ONLY the big green leaf shield that the 'Bruco con lo scudo' card caterpillar holds (the leaf alone, no caterpillar), drawn as a flat debris piece, slightly tilted, a bit torn at the edge, with a lighter vein pattern in flat colors. Centered in the canvas, center at y=640, not touching the baseline. About 35 percent of the canvas width.

## Fotogrammi (ognuno è una modifica della posa base del suo personaggio)

### dionea/chiusi.png
Riferimenti: `dionea/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. BLINK FRAME: change ONLY the two eyes to gently closed black curved eyelids in exactly the same eye locations. Keep the open jaws and teeth exactly as in the base. Keep eyebrows, mouth, every body outline, shading patch and ALL other pixels identical to base.

### dionea/inghiotte.png
Riferimenti: `dionea/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. SNAP FRAME: the head lunges forward to the right by about 18 percent of its width and the two jaw-leaves open even wider, teeth bared, eyes wide and fierce. Stalk and root leaves stay in place (the stalk stretches a little). Keep colors and style.

### dionea/mastica_1.png
Riferimenti: `dionea/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. CHEWING FRAME 1: the jaws are fully CLOSED shut (teeth visible only as a zigzag line where they meet) with a round bulge in the upper jaw as if it swallowed something big, cheeks puffed, eyes happy and half closed. Head back at the base position. Stalk and root leaves unchanged.

### dionea/mastica_2.png
Riferimenti: `dionea/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. CHEWING FRAME 2: jaws closed like a chewing frame, but the lower jaw is pushed slightly down-left and the bulge sits a bit lower and to the right, the head tilted 4 degrees down, eyes squeezed shut in satisfaction. Stalk and root leaves unchanged.

### gemello/chiusi.png
Riferimenti: `gemello/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. BLINK FRAME: change ONLY the two eyes to gently closed black curved eyelids in exactly the same eye locations. Keep eyebrows, mouth, every body outline, shading patch and ALL other pixels identical to base.

### gemello/carica.png
Riferimenti: `gemello/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. CHARGE FRAME: the whole cucumber body squashes slightly and leans back about 5 degrees on its stand, both barrels tilting slightly upward, cheeks puffed and eyes narrowed in effort. Wooden stand and base unchanged.

### gemello/spara.png
Riferimenti: `gemello/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. FIRE FRAME: both barrels thrust forward to the right by about 8 percent of the body width, a small flat-colored white-and-yellow smoke burst at each barrel mouth, eyes wide open. Wooden stand unchanged.

### zuccone/chiusi.png
Riferimenti: `zuccone/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. BLINK FRAME: change ONLY the two eyes to gently closed black curved eyelids in exactly the same eye locations. Keep eyebrows, mouth, every body outline, shading patch and ALL other pixels identical to base.

### zuccone/rosicchiato.png
Riferimenti: `zuccone/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. Remove a few small bite-shaped notches ONLY from the outer silhouette on the RIGHT side, facing enemies. Change eyebrows to worried. Preserve everything else, body dimensions and position; bites subtract small pieces, they do not shift or shrink the pumpkin.

### zuccone/mezzo.png
Riferimenti: `zuccone/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. Heavily eaten damage ONLY on the RIGHT side: several large scalloped bites missing from the right side of the pumpkin and torn edges. Tired worried face, one eye half closed, worried eyebrows. Preserve overall scale and position and the intact left, top and bottom silhouette; bites subtract chunks rather than shifting or redesigning the pumpkin. No detached debris.

### pannocchia/chiusi.png
Riferimenti: `pannocchia/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. BLINK FRAME: change ONLY the two eyes to gently closed black curved eyelids in exactly the same eye locations. Keep the flame exactly as in the base. Keep eyebrows, mouth, every body outline, shading patch and ALL other pixels identical to base.

### pannocchia/lampo.png
Riferimenti: `pannocchia/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. FLICKER FRAME: only the flame changes: it flares taller and leans slightly to the left, with a bigger bright-yellow core and one extra pointed tongue; flat colors only. The corn cob, face and husk leaves stay identical.

### mortaio/chiusi.png
Riferimenti: `mortaio/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. BLINK FRAME: change ONLY the two eyes to gently closed black curved eyelids in exactly the same eye locations. Keep eyebrows, mouth, every body outline, shading patch and ALL other pixels identical to base.

### mortaio/carica.png
Riferimenti: `mortaio/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. LOADING FRAME: the dark tube slides down into the watermelon body so that about 25 percent of its length is hidden inside (keep the same 45 degree angle), cheeks puffed and eyes squeezed shut with effort. Wooden base and vine unchanged.

### mortaio/spara.png
Riferimenti: `mortaio/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a RIGHT-facing cartoon tower-defense defender. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. FIRE FRAME: the tube thrusts up and out along its 45 degree axis by about 12 percent and a flat-colored puff of white-and-yellow smoke with a small spark burst bursts out of the tube mouth; the watermelon body squashes slightly downward, eyes wide open and mouth shouting. Wooden base unchanged.

### scudo/cammina_1.png
Riferimenti: `scudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. WALK CYCLE FRAME 1 of 4 (caterpillar crawl): the rear body segments arch upward in a hump while the front segments are low and stretched forward to the LEFT, front tiny legs reaching forward. The leaf shield stays held in front of the face, bobbing 2 percent lower.

### scudo/cammina_2.png
Riferimenti: `scudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. WALK CYCLE FRAME 2 of 4 (caterpillar crawl): the hump moves forward to the middle-rear segments, the head and front segments lift slightly, tiny legs in a mid-step. The leaf shield stays held in front of the face.

### scudo/cammina_3.png
Riferimenti: `scudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. WALK CYCLE FRAME 3 of 4 (caterpillar crawl): the hump is at the middle-front segments, the rear segments flatten and are pulled forward, tiny legs gathered. The leaf shield stays held in front of the face, 2 percent higher.

### scudo/cammina_4.png
Riferimenti: `scudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. WALK CYCLE FRAME 4 of 4 (caterpillar crawl): the front segments arch high near the head, the body is compressed, the rear segments slide forward, tiny legs planted. The leaf shield stays held in front of the face.

### scudo/mangia_1.png
Riferimenti: `scudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. EATING FRAME 1: the head dips forward and down to the LEFT with the mouth wide open showing teeth, biting; the leaf shield tilts forward and slightly down. Body otherwise unchanged.

### scudo/mangia_2.png
Riferimenti: `scudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. EATING FRAME 2: the head comes back up, mouth closed chewing with puffed cheeks and a satisfied frown; the leaf shield tilts back to the base angle. Body otherwise unchanged.

### scudo/ko.png
Riferimenti: `scudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. DEFEATED FRAME: the caterpillar is knocked out lying flat on its side/back on the ground with tiny legs curled up, X-shaped eyes and the tongue out; the leaf shield is gone (not in the picture). Keep colors and outline style, ground contact at y942.

### vespa/cammina_1.png
Riferimenti: `vespa/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. HOVER FRAME 1 of 3: the wings are raised high and apart (up-stroke), the body shifts 3 percent up. Keep the stinger, face and stripes identical.

### vespa/cammina_2.png
Riferimenti: `vespa/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. HOVER FRAME 2 of 3: the wings are horizontal and drawn as two soft flat-colored semi-transparent light-blue blurred shapes (mid-stroke), body at the base height. Keep the stinger, face and stripes identical.

### vespa/cammina_3.png
Riferimenti: `vespa/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. HOVER FRAME 3 of 3: the wings are swept down and back (down-stroke), the body shifts 3 percent down, legs dangling slightly. Keep the stinger, face and stripes identical.

### vespa/ko.png
Riferimenti: `vespa/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. DEFEATED FRAME: the wasp is knocked out, upside down with the legs curled up, X-shaped eyes, drooping wings, stinger pointing up-left. Keep colors and outline style; lowest point at y942.

### gigante/cammina_1.png
Riferimenti: `gigante/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. WALK CYCLE FRAME 1 of 4 (heavy stomp): the body lowers 3 percent, the two front-left legs reach far forward to the LEFT, rear legs pushed back, the horns tilt slightly down. Keep the face and shell identical.

### gigante/cammina_2.png
Riferimenti: `gigante/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. WALK CYCLE FRAME 2 of 4 (heavy stomp): the body rises 2 percent, legs gather under the body in a passing pose, the head sways slightly upward. Keep the face and shell identical.

### gigante/cammina_3.png
Riferimenti: `gigante/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. WALK CYCLE FRAME 3 of 4 (heavy stomp): the body lowers 3 percent, the other set of legs reaches forward to the LEFT, the opposite legs pushed back, the horns tilt slightly down. Keep the face and shell identical.

### gigante/cammina_4.png
Riferimenti: `gigante/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. WALK CYCLE FRAME 4 of 4 (heavy stomp): the body rises 2 percent, legs gather under the body in a passing pose, the head sways slightly to the other side. Keep the face and shell identical.

### gigante/mangia_1.png
Riferimenti: `gigante/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. SMASH FRAME 1 (wind-up): the front half of the body rears up, the front legs lifted off the ground, the horns raised high and tilted back, angrier eyes. Rear legs stay on the ground.

### gigante/mangia_2.png
Riferimenti: `gigante/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. SMASH FRAME 2 (impact): the front half slams down to the LEFT, the horns thrust forward low near the ground, front legs planted, a small flat-colored cloud of dust and two small spiky impact lines at the horn tips, eyes squeezed in rage.

### gigante/mangia_3.png
Riferimenti: `gigante/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. SMASH FRAME 3 (recovery): the body returns almost to the base pose, the horns still low and slightly dirty with a few small dust specks, a smug angry face.

### gigante/ko.png
Riferimenti: `gigante/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. DEFEATED FRAME: the beetle is flipped on its back with all six legs in the air, X-shaped eyes, horns pointing up-left, the shell on the ground. Keep colors and outline style; lowest point at y942.

## Bruco furioso: posa base (dal bruco con la foglia)

### scudoNudo/fermo.png
Riferimenti: `scudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. No ground shadow, text, scene, border, or extra objects. ENRAGED NO-SHIELD BASE: remove the leaf shield completely (the caterpillar alone, same pose, legs and body position, feet on the same baseline). Now ENRAGED: reddish flushed cheeks, eyes wider and furious with a small vein mark on the forehead, two small flat-colored steam puffs near the head, mouth bared with a few teeth, legs tensed ready to run. Same orange color and yellow spots.

## Bruco furioso: fotogrammi (modifiche della sua posa base)

### scudoNudo/corre_1.png
Riferimenti: `scudoNudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. RUN CYCLE FRAME 1 of 4 (furious sprint): the body is stretched long and low toward the LEFT, front legs fully extended forward, rear legs pushed back, head thrust forward, mouth open and furious.

### scudoNudo/corre_2.png
Riferimenti: `scudoNudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. RUN CYCLE FRAME 2 of 4 (furious sprint): the body bunches up into a tall arch (hump in the middle), all tiny legs gathered under the body, eyes furious.

### scudoNudo/corre_3.png
Riferimenti: `scudoNudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. RUN CYCLE FRAME 3 of 4 (furious sprint): the body is stretched long and low again with the other tiny legs reaching forward to the LEFT, head thrust forward even more, mouth open.

### scudoNudo/corre_4.png
Riferimenti: `scudoNudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. RUN CYCLE FRAME 4 of 4 (furious sprint): the body bunches into a smaller arch near the rear, legs gathered under the body, head slightly up, furious eyes.

### scudoNudo/mangia_1.png
Riferimenti: `scudoNudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. EATING FRAME 1: the head dips forward and down to the LEFT with the mouth wide open showing teeth, biting furiously.

### scudoNudo/mangia_2.png
Riferimenti: `scudoNudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. EATING FRAME 2: the head comes back up, mouth closed chewing with puffed cheeks, still furious eyes.

### scudoNudo/ko.png
Riferimenti: `scudoNudo/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. DEFEATED FRAME: the caterpillar is knocked out lying flat on its side on the ground with tiny legs curled up, X-shaped eyes and the tongue out. Keep colors and outline style, ground contact at y942.

## Rifacimento dell'ala della vespa (la prima uscita sfumata)

### vespa/cammina_2.png
Riferimenti: `vespa/fermo.png`

Use case: precise-object-edit. Edit the supplied BASE sprite, a single animation frame for a LEFT-facing cartoon tower-defense enemy. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. Keep all unmentioned pixels and details unchanged. No ground shadow, text, scene, border, or extra objects. HOVER FRAME 2 of 3: the two wings are held out horizontally to the back (right side of the picture), each wing drawn as a FLAT solid light-blue shape with a thick black outline and a few flat lighter veins, exactly like the wings of the base but flattened and horizontal. Absolutely NO blur, NO motion smear, NO soft edges, NO transparency, NO gradients. Body at the base height. Keep the stinger, face and stripes identical.
