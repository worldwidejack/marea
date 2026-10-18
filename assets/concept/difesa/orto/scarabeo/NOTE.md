# Giro 1 — sprite orto

Generatore: image_gen integrato; nessuna API esterna. Riferimento: esplorazione_01.jpg. Controllo visivo effettuato sui risultati e sul concept. Normalizzazione PIL proporzionale su tela RGBA 1024×1024, base a y=942, margini laterali e superiori >=82px; nessuna deformazione.

## scarabeo/cammina_1.png
Tentativi: 2 (1 rifacimento).
Differenze: testa senza casco ricostruita; antenne più grandi di quanto suggerisce il concept, forma semplificata. Sei zampe leggibili, con sovrapposizione prospettica; piccolo elemento posteriore del guscio da mantenere coerente nei frame successivi. Residua una lieve variazione tonale nelle campiture.

Prompt finale (English):
Correct this isolated blue beetle sprite. Keep the stout blue beetle design, thick black outlines, grumpy expression, left-facing elevated side view and transparent background. MUST show exactly SIX distinct short legs: three near-side blue legs and three far-side darker-blue legs offset between them, all connected under the body, with clearly separated silhouettes. Normal walk-start stance. Shorten the two antennae slightly. Remove ALL shiny white/light-blue oval specular highlights on shell, antennae and feet; use only solid royal-blue base fill and solid dark-blue hard-edged cel shadow shapes. Absolutely no gradients or glossy plastic rendering. Saturday morning hand-drawn cartoon matching the original garden concept. One whole beetle only, no helmet, no ground shadow, text or scenery. 1024x1024 RGBA transparent canvas. Center horizontally, feet on y=942, minimum 82px clear padding at sides and top.

Prompt iniziale (English):
Edit the supplied garden game concept into ONE isolated production sprite: the squat BLUE BEETLE seen in the far right column of rows 3 and 5, but REMOVE its tin bucket helmet completely. Reconstruct the uncovered blue head with two short visible antennae. Keep the same stout proportions, royal blue shell, large white eyes looking LEFT, grumpy lowered eyebrows, small frowning mouth and SIX short insect legs in a normal standing/walking-start pose, three per side visibly readable. Face and walk LEFT, side profile with the same slight elevated three-quarter view as the reference. Match the reference Saturday-morning 2D cartoon style exactly: very thick black outlines, saturated solid colors, hard-edged flat cel shadows, no soft gradients, no plastic reflections, no texture. Output only this complete character, no other objects, no helmet, no ground shadow, no text, no scenery. True transparent alpha background. Square 1024x1024 PNG, horizontally centered, feet touching y=942, all parts within x=82..942 and y=82..942. Preserve ample transparent animation padding. This is the base frame of a sprite animation.

## cavalletta/corre_1.png
Tentativi: 1.
Differenze: personaggio nuovo, quindi nessun modello identico nel concept; anatomia e zampe più articolate rispetto agli altri insetti. Colori lime/giallo e sorrisetto intenzionali. Lievi variazioni tonali residue nelle campiture.

Prompt finale (English):
Use the supplied garden game concept as a STYLE reference, and transform it into one isolated NEW GRASSHOPPER enemy sprite belonging to exactly the same cartoon insect family as its snails and blue beetles. Funny cocky bully grasshopper facing and running LEFT in side profile with slight elevated three-quarter view. Big expressive white eyes looking left, lowered confident eyebrow and mischievous sideways smirk, two antennae, bright LIGHT LIME GREEN body and YELLOW belly contrasting with dark garden grass. Six legs total: four small front/middle legs and two very long powerful folded angular hind legs ready to spring, first running-cycle pose with a grounded foot. Compact friendly readable cartoon anatomy, slightly taller than the reference snails, not humanoid. Match reference VERY THICK BLACK outlines, saturated solid fills and hard-edged flat cel shadows, Saturday morning animated series. No soft gradients, no shiny plastic highlights, no photo textures. True transparent alpha background, only one whole character, no ground shadow, scenery, text or motion lines. 1024x1024 square PNG with horizontal center x=512, lowest foot y=942, at least 82 pixels clear transparent space on sides and top, antennae entirely inside safe area.

## annaffiatoio/fermo.png
Tentativi: 2 (1 rifacimento).
Differenze: bocca superiore e soffione un po' più grandi, tavoletta più regolare e semplificata rispetto al concept. Ombre a bordi netti, ma permane una lieve variazione tonale interna, soprattutto nel legno: non è una replica perfettamente piatta.

Prompt finale (English):
Revise this watering can sprite ONLY in its shading: eliminate all soft gradients and render every surface with solid-color flat cel shading, crisp hard boundaries. The green body must have one emerald green base region and one solid dark green shadow region, with a narrow solid mint rim. No blended color, no plastic sheen. Simplify wooden plank into solid ochre top and brown side, with only two simple wood marks. Spring and perforated nozzle use solid pale blue and dark slate shadow shapes. Keep exactly the same silhouette, thick black outlines, right-facing nozzle, left handle, dark top opening, resting coil spring and wood base; retain true transparency and no ground shadow. Match a flat 2D Saturday morning cartoon garden-game prop. One complete assembly on square 1024x1024 canvas, centered horizontally, lowest base pixel at y=942, minimum 82px margin on sides/top. No text or additional objects.

Prompt iniziale (English):
Extract and faithfully redraw ONE spring-mounted green watering can from the LEFT edge of the supplied garden game concept as an isolated game sprite. Preserve its exact design: squat emerald-green watering can with dark open oval filling hole on top, loop handle on LEFT, short upward-angled spout pointing RIGHT ending in a pale blue-gray round perforated sprinkler rose, can mounted on a visible chunky steel coil spring above a small rectangular honey-brown wooden plank base in perspective. Resting idle pose, no water. View same slight elevated three-quarter side profile as the concept. Match VERY THICK black cartoon outlines, saturated solid fills, simple hard-edged flat cel shadows, Saturday-morning animation. No gradients, no glossy plastic reflections, no photographic wood textures. Only ONE complete watering-can/spring/plank assembly; no character face, no ground shadow, scene, lettering or UI. True transparent alpha background. Square 1024x1024 PNG; horizontal center x=512, bottom of wooden base at y=942. At least 82px transparent margin on sides and top, everything fully visible.

Verifica finale PIL: tutti e tre RGBA 1024×1024, quattro angoli alpha 0, base visibile y=942. Bounding box calcolato su alpha >=128 per escludere residui quasi invisibili del generatore prima del ridimensionamento proporzionale.


# Giro 2 — fotogrammi animazioni

Image_gen integrato; tutte le modifiche partono dalla posa base originale, mai dal fotogramma precedente. Basi e cammina_1..4 non modificati.

Normalizzazione PIL: output generati 1280 quadrati ridotti proporzionalmente a 1024; allineamento solo verticale alla base y942, nessun ricentraggio orizzontale dei personaggi. Effetti centrati con ingombri 410/870/870 px. Verifica: tutti RGBA 1024×1024, quattro angoli alpha 0. Confronto visivo in confronto_giro2.jpg.

## scarabeo/mangia_1.png
Tentativi: 1.
Differenze/residui: Lievi variazioni nel profilo delle zampe e della campitura del guscio; testa protesa e bocca aperta richieste.

Prompt finale (English):
Edit target: original cammina_1.png blue beetle, facing LEFT. Animation mangia_1: extend only the head slightly forward toward LEFT and open its small mouth/mandibles wide for a bite. Keep eyes and angry brows, antenna design, shell, six legs and rear shell tip unchanged. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. No ground shadow, text, scenery or extra objects. Edit only the requested moving parts; copy all unchanged areas exactly from the base.

## scarabeo/mangia_2.png
Tentativi: 1.
Differenze/residui: Guance gonfie richieste; lieve variazione della curva del guscio.

Prompt finale (English):
Edit target: original cammina_1.png blue beetle facing LEFT. Animation mangia_2: change ONLY the mouth and lower cheeks to a CLOSED bite with visibly puffed full cheeks. Keep original angry eyes, brows, antennae, shell, six feet and rear shell tip exactly unchanged, same pixel positions. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. No ground shadow, text, scenery or extra objects. Edit only the requested moving parts; copy all unchanged areas exactly from the base.

## scarabeo/mangia_3.png
Tentativi: 1.
Differenze/residui: Sopracciglia assorbite nelle palpebre chiuse; lieve variazione del guscio.

Prompt finale (English):
Edit original cammina_1.png, blue beetle facing LEFT. Animation mangia_3: chewing, eyes CLOSED as curved black eyelid lines, closed chewing mouth with slightly full cheeks and exactly two tiny green leaf crumbs next to the mouth. Retain original head silhouette, antennae, shell, all six legs and rear tip. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. No ground shadow, text, scenery or extra objects. Edit only the requested moving parts; copy all unchanged areas exactly from the base.

## scarabeo/ko.png
Tentativi: 1.
Differenze/residui: Sopracciglia scomparse con occhi a spirale; antenne e zampe piegate come richiesto.

Prompt finale (English):
Edit original cammina_1.png blue beetle facing LEFT. Animation ko: stunned but STILL STANDING. Change eyes to black spirals inside original white eye shapes, let both antennae droop and all six short legs look limp while retaining upright support and ground level. Keep shell and head size, colors, rear tip and original small mouth. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. No ground shadow, text, scenery or extra objects. Edit only the requested moving parts; copy all unchanged areas exactly from the base.

## mina_a/sotto.png
Tentativi: 2.
Differenze/residui: Rifatto per pietra anteriore deformata. Residui: piccole differenze nelle zolle e nella pietra frontale; foglie lievemente ridisegnate.

Prompt finale (English):
Edit target original armata.png radish mine facing RIGHT. Frame sotto: BURIED asleep. Keep the ENTIRE dirt mound and every stone EXACTLY unchanged at original size and coordinates. Lower the radish vertically behind that mound so only leaves and a small red top cap are visible, with tiny closed sleepy eyes on that exposed red cap. The red warning beacon is OFF, dark red, no glow. Do not shrink leaves or radish; conceal underground portions behind the unchanged mound. No smile or teeth visible. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. No ground shadow, text, scenery or extra objects. Edit only the requested moving parts; copy all unchanged areas exactly from the base. CRITICAL: the mound is an immutable background prop, not something to redraw. Preserve the original central FRONT stone at x490 y895: small rounded tan stone with a dark upper-left facet, NOT a large angular diamond. Match original mound silhouette x120..903 bottom y942 and exact individual clumps. Only lower the vegetable; do not move, resize, simplify or redesign the soil.

## mina_a/spunta.png
Tentativi: 1.
Differenze/residui: Occhi semichiusi e lampada spenta corretti; emersione intermedia piuttosto alta. Lievi differenze nella sagoma delle zolle.

Prompt finale (English):
Edit target original armata.png radish mine facing RIGHT. Frame spunta: radish halfway emerged from soil, between buried and fully armed; lower the vegetable moderately behind the mound without scaling it, eyes HALF OPEN sleepily waking, beacon OFF dark red no light rays or glow. Keep leaf shapes and all original colors. Soil mound is immutable: preserve exact outline, all individual clumps and stones, x120..903 bottom y942. Keep original small rounded tan front stone with dark upper-left facet. Change only vertical emergence and eyelids and dim the beacon. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. No ground shadow, text, scenery or extra objects. Edit only the requested moving parts; copy all unchanged areas exactly from the base.

## mina_a/lampo.png
Tentativi: 1.
Differenze/residui: Luce richiesta presente; piccolo alone sfumato nella lampada malgrado richiesta di campiture nette; leggere variazioni nelle foglie e pietre.

Prompt finale (English):
Edit target original armata.png radish mine facing RIGHT. Frame lampo: change ONLY the red warning beacon to ON, intensely luminous red with pale hot red-white center highlight and a few short red/yellow light rays immediately around the beacon. Flat crisp cartoon glow shapes, no diffuse haze. Entire radish, leaf shapes, eyes, grin, dirt mound and stones must stay exactly unchanged. Absolutely do not enlarge the lamp or move anything to make room for rays. Preserve exact identity, colors, black outline thickness, cel shading, scale and position; 1024 square, genuine transparent alpha, ground contact y942; no re-centering or global rescaling. No ground shadow, text, scenery or extra objects. Edit only the requested moving parts; copy all unchanged areas exactly from the base.

## botto/scoppia_1.png
Tentativi: 1.
Differenze/residui: Generatore ha prodotto lampo troppo grande; normalizzazione proporzionale al 40% della tela. Leggera variazione tonale interna.

Prompt finale (English):
Create a single 2D cartoon game explosion VFX sprite, frame scoppia_1: the initial FLASH only, a small jagged pointed yellow-white starburst centered exactly at (512,512), outer diameter about 410 pixels (40% of a 1024 square). White-yellow core, saturated yellow outer points, very thick clean BLACK cartoon outline, solid fills and hard-edged flat cel shading, cheerful hand-drawn garden tower defense style. No character, no smoke yet, no terrain, no ground shadow, absolutely NO WORDS, letters, numbers, symbols, UI or scenery. Genuine transparent alpha background, 1024x1024 canvas with generous empty transparent space. Center at canvas center, NOT at a ground baseline.

## botto/scoppia_2.png
Tentativi: 1.
Differenze/residui: Nuvola più dettagliata del concept, normalizzata all'85%; lieve variazione tonale nel cuore giallo.

Prompt finale (English):
Create one isolated cartoon explosion VFX sprite scoppia_2, peak explosion. A large rounded and jagged bursting FIRE CLOUD: orange and red fire lobes enclosing a bright solid yellow heart, very thick BLACK outline, several small brown dirt clods flying radially. Overall extent including clods about 85% of a square canvas, centered at (512,512). Match cheerful garden tower-defense 2D animation: saturated solid colors, hard-edged flat cel shading, chunky simple readable shapes, no gradients or realistic smoke. 1024x1024 genuine transparent alpha. No characters, no ground shadow, no scenery. Absolutely NO letters, words, captions, numbers or comic text. Flame cloud center at canvas center, no ground baseline. Whole effect fully in frame.

## botto/scoppia_3.png
Tentativi: 1.
Differenze/residui: Contorno più sottile rispetto ai personaggi; sbuffi grigio-marroni e apertura trasparente presenti.

Prompt finale (English):
Create one isolated 2D cartoon game VFX sprite scoppia_3: aftermath of an orange-red garden mine explosion, now ONLY dissipating grey-brown smoke. Several chunky rounded smoke puffs spread outward radially into a loose broken ring, a large genuinely transparent central opening and transparent gaps between puffs, a few tiny yellow-orange sparks. Very thick black outlines, solid warm gray/taupe/brown fills and simple hard-edged cel shadows, matching cheerful hand-drawn garden tower-defense cartoons. Overall cloud extent about 85% of 1024x1024 canvas, centered exactly at (512,512), fully visible with padding. NO characters, ground, ground shadow, lettering, words or numbers. No realistic vapor, gradients or blur. Genuine transparent alpha everywhere outside puffs and in central hole. No ground baseline.
