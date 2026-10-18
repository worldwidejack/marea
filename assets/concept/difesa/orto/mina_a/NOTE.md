# Pose base — mine e gelo

Generazione: strumento integrato image_gen, nessuna API esterna o altro agente. Un tentativo per immagine, zero rifacimenti. Riferimenti: esplorazione_01.jpg e orto/carota/fermo.png. Risultati finali guardati e confrontati con entrambi.

Verifica con Python 3.13 + PIL: tutti PNG RGBA 1024×1024, quattro angoli alpha 0, contatto inferiore y=941 (bbox esclusiva 942). Gli originali generati erano 1254×1254. Rimossi residui quasi invisibili alpha ≤8; ritaglio al contenuto, ridimensionamento proporzionale Lanczos e posizionamento su tela trasparente. Nessuna deformazione. Nessuna ombra a terra aggiunta. Sorgenti conservate nella cartella predefinita di Codex.

## mina_a/armata.png

Tentativi: 1.

Osservazioni / scostamenti: Personaggio nuovo: non esiste nel concept. Tratto e occhi coerenti con la carota; allarme più grande di una semplice lucina e foglie molto sviluppate. Vista a tre quarti rivolta a destra. Lievi variazioni tonali interne rimangono, oltre alle ombre principali a bordo netto.

Prompt finale (inglese):

Use case: stylized-concept. Create one production game sprite, PNG 1024x1024, genuinely transparent background. Match the supplied garden tower defense concept and carrot sprite: VERY THICK solid black outlines, saturated solid colors, crisp flat cel-shaded shadow shapes, Saturday morning 2D cartoon, large white eyes with black pupils and expressive black eyebrows. No soft gradients, plastic rendering, photographic texture, lettering, shadow on ground or scenery. Entire single character, right-facing side profile with slight three-quarter view from above, horizontally centered. Leave at least 82 px transparent margin at both sides and top. Lowest ground contact at y=942. Dirt mound requested for mines is part of the sprite, not a background. Subject: ARMED RADISH MINE. A round red radish with a small tuft of saturated green leaves on its head, half emerging from a compact brown dirt mound. Cunning eyes looking RIGHT and a mischievous toothy grin on its right-facing face. A small red alarm indicator lamp nestled between the leaves, shown by flat bright red and white shapes without glowing haze. Low squat silhouette, ready to explode when stepped on. No legs, no cannon. Adapt the attached reference cartoon style to this new character.

Sorgente: ~/.codex/generated_images/01a149b7-0aa4-7133-a027-d1fc54c7378f/exec-466d167a-0520-4d84-8f88-9f16176732a9.png

## mina_b/armata.png

Tentativi: 1.

Osservazioni / scostamenti: Personaggio nuovo: non esiste nel concept. Spine grosse e stilizzate; occhi sulla castagna centrale nell'apertura del riccio. Vista a tre quarti più frontale della carota, sguardo a destra. Nessuna copia esatta da confrontare nel concept.

Prompt finale (inglese):

Use case: stylized-concept. Create one production game sprite, PNG 1024x1024, genuinely transparent background. Match the supplied garden tower defense concept and carrot sprite: VERY THICK solid black outlines, saturated solid colors, crisp flat cel-shaded shadow shapes, Saturday morning 2D cartoon, large white eyes with black pupils and expressive black eyebrows. No soft gradients, plastic rendering, photographic texture, lettering, shadow on ground or scenery. Entire single character, right-facing side profile with slight three-quarter view from above, horizontally centered. Leave at least 82 px transparent margin at both sides and top. Lowest ground contact at y=942. Dirt mound requested for mines is part of the sprite, not a background. Subject: ARMED CHESTNUT BUR MINE. A round green spiky chestnut husk half emerging from a compact brown dirt mound, cunning eyes facing RIGHT nestled between big readable triangular green spikes. A glossy warm brown chestnut visible through the opening in the middle of the husk; gloss is just a small hard-edged cream highlight. Mischievous armed expression, squat and compact. Distinct from a radish: spiky green silhouette, warm brown central chestnut. No legs, no cannon. Adapt the attached reference cartoon style to this new character.

Sorgente: ~/.codex/generated_images/01a149b7-0aa4-7133-a027-d1fc54c7378f/exec-7b442cdf-531f-4474-a79d-134de39ffb6e.png

## gelo_a/fermo.png

Tentativi: 1.

Osservazioni / scostamenti: Stessa identità, posa e ingombro della carota: bbox finale (62,447,962,942), originale (62,451,962,942). Non è una modifica pixel-identica: piccole differenze nelle linee del corpo, venature/cavalletto e occhi. Per conservare scala e posizione dell'originale i margini laterali sono 62 px, come il riferimento, invece degli 82 px generali. Brina e cristalli aggiungono dettaglio rispetto al concept.

Prompt finale (inglese):

Use case: precise-object-edit. Edit target is the attached carrot cannon PNG; other image is style reference only. Produce PNG 1024x1024 with genuine alpha transparency. Make EXACTLY the SAME carrot cannon frozen. Keep identical body shape, silhouette, barrel, facial expression, eye placement, wooden stand geometry and colors, pose, scale, position and empty space as the reference carrot. Feet end at y approximately 942. Change ONLY orange carrot to ICE BLUE with hard-edged white highlights, add a few small frost crystals on body and barrel tip, and change green leaves to pale blue-green frosted leaves. Wooden stand stays unchanged. All outlines remain VERY THICK BLACK, saturated flat cel shading, crisp shadow boundaries. No soft gradients, no plastic shine, no floor shadow, no text, no background, no additional objects. Right-facing. Do not enlarge or reposition the original character.

Sorgente: ~/.codex/generated_images/01a149b7-0aa4-7133-a027-d1fc54c7378f/exec-c91ad0fb-c2af-458b-a4fe-b7df866ab636.png

## gelo_b/fermo.png

Tentativi: 1.

Osservazioni / scostamenti: Personaggio nuovo: non esiste nel concept. Cetriolo scuro, puntini e cannone a destra leggibili. Cristalli grandi e più geometrici dei personaggi originali, coerenti con la funzione gelo. Cavalletto simile ma non identico a quello della carota.

Prompt finale (inglese):

Use case: stylized-concept. Create one production game sprite, PNG 1024x1024, genuinely transparent background. Match the supplied garden tower defense concept and carrot sprite: VERY THICK solid black outlines, saturated solid colors, crisp flat cel-shaded shadow shapes, Saturday morning 2D cartoon, large white eyes with black pupils and expressive black eyebrows. No soft gradients, plastic rendering, photographic texture, lettering, shadow on ground or scenery. Entire single character, right-facing side profile with slight three-quarter view from above, horizontally centered. Leave at least 82 px transparent margin at both sides and top. Lowest ground contact at y=942. Dirt mound requested for mines is part of the sprite, not a background. Subject: FROZEN CUCUMBER CANNON. A dark green cucumber with sparse simple lighter green dots on its peel, lying horizontally on a chunky wooden trestle like the carrot cannon's wooden stand. Distinct elongated cucumber shape, rounded rear left and short rounded hollow cannon muzzle at the RIGHT tip; determined large cartoon eyes looking right with bold eyebrows on front side. Pale cyan frost patches and chunky ice crystals on top, hard-edged white highlights. Keep dark green body clearly visible. Same appealing cartoon universe as carrot, pumpkin and cabbage; same very heavy outlines and restrained crisp cel shading. No carrot leaves or orange body, no projectile. All wooden feet on y approximately 942.

Sorgente: ~/.codex/generated_images/01a149b7-0aa4-7133-a027-d1fc54c7378f/exec-a71fb5c6-61f5-4dec-95dc-e3b899d9071e.png

