# Prova animazione — stile 7

Generazione: strumento integrato image_gen, nessuna API esterna, nessun subagent. Ogni variante è stata generata direttamente dalla rispettiva posa base, mai dalla variante precedente. Output originali 1254×1254; consegna ridotta a 1024×1024 con PIL e nearest-neighbor. Nessun ritocco o ricostruzione manuale dei personaggi.

## Esito e limiti reali

7 PNG RGBA verificati con Python 3.13 + PIL: dimensioni 1024×1024, alpha 0 in tutti e quattro gli angoli. Le tavole confronto_lumaca.png e confronto_carota.png sono state guardate accanto alla base.

Identità e palette riconoscibili, ma NON è una sequenza pixel-perfect. Le pose più ampie producono deriva nei dettagli. Pixel grossi visivamente coerenti, ma non una griglia matematica uniforme di 48–64 pixel: il ridimensionamento nearest non corregge le irregolarità generate. Sono presenti pixel di alpha basso anche lontano dal soggetto; non è stato applicato un threshold che alterasse l'output.

Ancoraggio richiesto al 92% NON raggiunto dal generatore: sagoma visibile (alpha >=128) della lumaca termina a y≈880–882 (86%), carota y≈894–895 (87%). Margini laterali variabili, talvolta inferiori al 6%. Nessun riallineamento successivo per non mascherare la coerenza effettiva della prova. Per usare in gioco occorre valutare/riallineare le sagome.

## Fotogrammi

- lumaca_1.png — 1 tentativo. Base; verde lime, guscio arancio. Limiti di griglia e ancoraggio descritti sopra.
- lumaca_2.png — 1 tentativo. Collo più sottile, antenne avanti; guscio visivamente stabile. L'allungamento è evidente soprattutto nelle antenne; muso poco avanzato. Piccole variazioni delle luci del corpo.
- lumaca_3.png — 3 tentativi (2 rifacimenti), scelto il terzo. Primo e secondo: guscio rimpicciolito/ridisegnato, scartati. Terzo più vicino alla base ma guscio ancora leggermente più stretto, spirale/luci modificate; contrazione tenue, antenna destra più bassa. Non perfettamente rigido.
- lumaca_4.png — 1 tentativo. Guscio stabile, antenne oscillano a destra più del richiesto; muso e sorriso spostati leggermente, luci del corpo cambiano. Movimento accettato per questa prova, non identità pixel per pixel.
- carota_1.png — 1 tentativo. Base. Vista laterale con entrambi gli occhi visibili; margine destro stretto.
- carota_2.png — 1 tentativo. Compressione molto più forte dei 40px richiesti; cavalletto e foglie visivamente stabili. Occhi più piccoli/accigliati, non davvero socchiusi. Ridisegno delle incisioni arancioni durante la compressione.
- carota_3.png — 3 tentativi (2 rifacimenti), scelto il PRIMO. Rinculo, rondella e sbuffo presenti. Cavalletto traslato leggermente a sinistra e venatura diversa; foglie e incisioni cambiano. Secondo scartato: proiettile diventato carota intera. Terzo scartato: cavalletto più stretto/spostato, sbuffo troppo grande e linee cinetiche aggiunte.

## Prompt esatti

### lumaca_1

Create one standalone game animation sprite, LUMACA frame A1 base pose. True transparent background, square 1024x1024. SNES 16-bit pixel art matching the chunky saturated dark-outlined arcade characters in the user's style reference: about 48-64 actual art pixels tall enlarged with nearest neighbor, equally sized square pixels, limited saturated palette, hard stepped shading, NO smooth gradients, NO antialiasing, no scene/text/shadow. Full side profile facing LEFT: cute slightly cocky garden snail, lime green soft body, two eye stalks with expressive eyes looking left, large orange golden spiral shell with dark purple pixel outline. Normal relaxed extended body, smirking mouth. Entire character centered horizontally, left/right margins approximately 6%, lowest body ground contact at y=942 (92% height), ample transparent space above. Shell centered above rear/right part of body. This is the master identity for a four-frame crawling loop; simple reproducible details. Only one snail.

### carota_1

Create CAROTA CANNONE B1 master base pose, single game sprite on true transparent background, 1024x1024 square. Chunky SNES 16-bit pixel art, equally sized large square pixels, about 48-64 actual art pixels high enlarged nearest neighbor. Saturated limited palette orange carrot, green leaves, warm brown wood, very dark purple stepped outlines, hard flat highlights, NO smooth gradients or antialiasing. Side profile facing RIGHT. Funny horizontal carrot cannon rests on a small sturdy wooden trestle. Green leaves at rear LEFT, thick orange carrot body tapering to a short hollow pointed muzzle at RIGHT; the carrot tip IS the cannon mouth. Two expressive eyes on upper carrot body, alert neutral ready expression. No metal gun, no wheels. Full character centered, about 6% side margins, wooden feet ground contact at 92% image height. Leave enough transparent space in front of muzzle for a future small projectile. No ground shadow, scene, text or border. This exact identity and trestle will be preserved in 2 subsequent firing animation frames.

### lumaca_2

Edit this exact snail master sprite into animation frame A2. Preserve character identity, exact orange spiral shell design and location, palette, dark pixel outlines, pixel size, image framing, scale and transparent background. Only change front green soft body: extend front toward LEFT slightly and make its neck/front thinner, while shell stays behind at exactly original coordinates. Eye stalks lean slightly forward left. Keep full sprite inside canvas and same ground line. No added elements. Genuine chunky SNES pixel art, no smoothing. Output square 1024x1024 true alpha.

### lumaca_3

Edit the supplied BASE snail into crawl frame A3. Exact same character, colors, shell spiral and facets, dark outline thickness and chunky SNES pixel grid, same scale and transparent canvas. Change ONLY pose: shorten and puff up the green body as it contracts; move the entire unchanged shell a small amount LEFT and slightly UP, about 24px left and 12px up on 1024 canvas; bend eye stalks gently back right. Foot remains on same ground line. Keep same smile and eye design. Do not redesign shell or rescale character. Square 1024x1024 true transparency.

### lumaca_3_retry

Make crawl animation A3 from THIS BASE IMAGE. Critical: shell must remain EXACT SAME SIZE AND DESIGN as input, do not shrink it. Copy its shape, spiral, every highlight. Translate shell only 20 pixels left and 10 pixels upward. Keep canvas framing and character scale identical. Change green body below shell to slightly shorter and puffier contraction, head can tuck 20px right and antennae bend a little right. Keep original tail location, foot baseline, smile, colors and pixel thickness. Very subtle pose edit, not a redraw. True alpha 1024 square.

### lumaca_4

Minimal animation edit of supplied snail BASE, frame A4 returning to rest. Preserve shell pixel for pixel in same position and size; preserve green foot and tail, ground line, smile, entire framing, palette and outline. Change ONLY eye stalks: gently sway their tips 12 pixels toward RIGHT, keeping exact eye shapes; front neck almost same as base with extremely subtle relaxation. No rescaling or redrawing shell. Same 1024 square transparent canvas and chunky 16-bit pixel art.

### carota_2

Edit exact supplied CARROT CANNON BASE into B2 charging frame. Lock wooden trestle pixel-for-pixel, same position, feet ground line, size, bolts and wood grain. Keep exact character identity, leaves, palette, dark purple outline, big square pixel size and 1024 square transparent framing. Change ONLY orange carrot: compress it backward toward LEFT, muzzle retracts about 40px left, body swells slightly vertically while rear remains fixed, eyes narrow into determined squint. Leaves barely flex. No projectile or smoke yet. No rescaling whole character. SNES 16-bit pixel art, true alpha.

### carota_3

Edit supplied CARROT CANNON BASE into B3 firing pose. Preserve EXACT wooden trestle, feet, bolts, grain, location and size. Preserve green leaves and identity, colors, chunky square pixel grid, dark outlines and framing. Orange carrot recoils LEFT, muzzle retracts about 100px to leave space to its RIGHT: mouth spits one small orange carrot slice disk and a small cream-colored pixel puff immediately in front of muzzle. Both puff and disk fully within canvas. Eyes wide in surprise. Minimal pose change, no resizing whole sprite or support. Same square 1024x1024 true transparent background, 16-bit SNES pixel art. No text, no floor shadow.

### lumaca_3_retry2

Use supplied master snail as exact edit target. A3 subtle contraction. IMPORTANT shell is rigid, NOT squash-and-stretch: retain exact width, height, spiral, highlights and outline from reference. Move rigid shell only ONE art pixel left and ONE art pixel up. Preserve overall sprite canvas position and scale. Puff green belly up slightly, shorten neck slightly, sway antenna tips slightly back. No changes to smile, eyes, colors, tail or ground baseline. Minimal localized edit; do not regenerate a smaller snail. Transparent 1024 square, same coarse SNES pixel grid.

### carota_3_retry

Localized edit of supplied carrot BASE for B3 firing. FREEZE entire wooden support: identical pixels, position, width, feet and wood grain. Do not shift or scale support at all. Carrot alone recoils left a little and its tapered front compresses enough to place one small carrot round and tiny cream puff to right of muzzle inside canvas. Wide-open surprised eyes. Freeze leaves where possible. Keep orange ridges, palette, coarse pixel blocks, dark outlines, canvas size and alpha. All changes above wooden support only. Transparent square 1024. No overall recentering.

### carota_3_retry2

Edit this supplied original BASE carrot cannon, B3 shooting. Wooden stand must stay exact original position and scale. Carrot recoils left, wide eyes, small cream pixel smoke puff at muzzle and ONE ROUND CARROT SLICE disk flying right (orange circular cross-section with yellow inner ring; NOT a whole carrot, NO leaves on projectile). Keep all inside frame. Preserve original pixel style, colors, details, leaves, line thickness. Do not recenter sprite. True alpha, square 1024.

