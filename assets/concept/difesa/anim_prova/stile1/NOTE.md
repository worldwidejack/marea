# Prova animazione stile 1

Generazione: strumento integrato image_gen, nessuna API/CLI a pagamento, nessun altro agente. Ogni immagine di movimento è generata usando SOLO la rispettiva posa base finale come riferimento (mai il fotogramma precedente). Le basi usano esplorazione_01.jpg.

## Esito e limiti

Set sperimentale, non perfettamente coerente pixel per pixel. La carota tiene meglio del guscio della lumaca in contrazione. Restano variazioni di forma e riflessi descritte sotto: non considerare questi frame già approvati per produzione. Nessun ritocco manuale dei personaggi o interpolazione dei movimenti.

## Preparazione e controllo

Originali del generatore: 1254×1254. Python 3.13 + PIL 12.3.0: PNG RGBA finali 1024×1024. Per le due basi: ritaglio dell'ingombro visibile (alpha >128 per misurare il box, alpha originale conservato), ridimensionamento proporzionale a larghezza 900 px, posizionamento x62 e appoggio y942 su tela trasparente. Questo è un allineamento tecnico della base, non un nuovo fotogramma. I frame successivi sono solo ridotti uniformemente all'intera tela 1024×1024, senza riallinearli singolarmente, così le derive del generatore restano verificabili.

Verificati modo RGBA, dimensioni, alpha minimo 0/massimo 255 e tutti e quattro gli angoli con alpha 0 per ciascun PNG. Confronto visivo affiancato a ogni base eseguito; _confronto.png è un foglio diagnostico aggiuntivo su fondo grigio, non uno sprite.

Il generatore salva automaticamente gli originali nella propria cartella di servizio ~/.codex/generated_images; tutti i file di consegna e lavorazione gestiti qui sono nella sola cartella autorizzata. Nessun comando git, build o modifica ai file di progetto.

## lumaca_1.png (A1)

Tentativi/chiamate: 1.

Base: design riconoscibile ma più lucido del riferimento; presenti lievi sfumature non richieste, soprattutto sul guscio. Normalizzazione tecnica della tela prima di usarla come riferimento.

### Prompt 1

```text
Extract and redraw ONLY the plain purple snail from the supplied game reference as a single animation base sprite A1. Side profile facing LEFT, full body normally extended, two eye stalks, cheeky mildly bossy expression, lavender body, purple spiral shell. Match its Saturday morning 2D cartoon style: very thick black outlines, saturated solid colors, flat cel shadow patches, no gradients. No scenery, no ground shadow, no text or other objects. Genuinely transparent alpha background. Square 1024x1024 canvas. Whole character centered horizontally, leftmost/rightmost extent about x=62/962, ground contact y=942 (92% of canvas), preserve proportions. This is the definitive base for a four-frame crawling loop.
```

## lumaca_2.png (A2)

Tentativi/chiamate: 2.

Scelto tentativo 2. Il guscio resta visivamente abbastanza stabile; cambiano leggermente inclinazione delle palpebre, sorriso e campitura del corpo. Appoggio a y934 invece di y942 (8 px).

### Prompt 1

```text
Edit this exact base sprite to animation frame A2. Preserve 1024 square canvas, exact scale and registration, transparent alpha, colors, line weight, cheeky facial expression and shell design. Change ONLY the front soft body: stretch its head/neck forward LEFT about 25 pixels and make lower front body thinner; gently bend both eye stalks forward, without changing eyes. Shell MUST stay exactly at same position with identical size, spiral, highlight and shading. Tail unchanged. Contact baseline y=942. No whole-image rescaling or recentering. No added elements. Single sprite.
```

### Prompt 2

```text
Precise localized animation edit of attached BASE, correction attempt. Stretch front of soft body LEFT slightly and thin its underside; bend antennae forward a little. Shell and tail must be copied unchanged. Keep original 1024x1024 framing, full character exact scale and original location, feet/sole at y942. Preserve every unmentioned feature, colors, black outline thickness, cel shading and detail. True transparent background. Do not recompose, recenter, or redraw unaffected regions. Output ONE frame.
```

## lumaca_3.png (A3)

Tentativi/chiamate: 3.

Scelto tentativo 3 (massimo due rifacimenti). Rimane una riduzione/deformazione del guscio, con spirale e riflesso diversi; varia anche il sorriso. Non è una pura traslazione rigida. Tentativo 2 scartato anche per appoggio troppo alto. Appoggio finale y937, 5 px sopra la base.

### Prompt 1

```text
Animation frame A3, edit only this supplied base sprite. Same snail, same exact purple/lavender palette, thick black outlines, shell spiral and highlight shapes, eye shapes and expression. Crawl contraction: shorten and puff the lower body, move the entire rigid shell LEFT 24 pixels and UP 12 pixels without deforming or redrawing shell details. Head slightly closer to shell, antennae tilt slightly backward RIGHT. Keep tail grounded at baseline y942, 1024 square transparent canvas. Same character scale and placement otherwise, no cropping, no shadows, no additional elements, no automatic centering.
```

### Prompt 2

```text
Precise localized animation edit of attached BASE, correction attempt. Shorten and puff lower soft body; translate rigid shell 24 pixels LEFT and 12 UP. Do NOT scale or deform shell: preserve its exact diameter, spiral and highlights. Antennae sway slightly right. Keep original 1024x1024 framing, full character exact scale and original location, feet/sole at y942. Preserve every unmentioned feature, colors, black outline thickness, cel shading and detail. True transparent background. Do not recompose, recenter, or redraw unaffected regions. Output ONE frame.
```

### Prompt 3

```text
Localized animation edit, use attached base as exact master. Contract the lower soft body slightly horizontally and puff it UPWARD, while keeping its bottom edge firmly on the SAME ground line y=942. Move the shell only 20px left and 10px up, preserve its original SIZE and round shape exactly. Do not lift entire snail or shorten its diameter. Sway antennae a little right. Preserve exact identity, colors, outlines, highlights, all unaffected details, full canvas composition, same scale. 1024 square, genuine transparent alpha, ground contact y942. No re-centering or global rescaling.
```

## lumaca_4.png (A4)

Tentativi/chiamate: 2.

Scelto tentativo 2. Guscio abbastanza stabile, ma testa e antenne arretrano più dei 12 px richiesti; varia lievemente la forma del sorriso. Appoggio y942.

### Prompt 1

```text
Edit exact base image into A4 final frame of crawl loop. Almost identical to base: shell, spiral, highlights, tail, body, smile must remain unchanged at same coordinates. ONLY sway the eye stalks slightly RIGHT, tips about 12 pixels right, keeping identical eyes and eyelids; lower neck relaxes back almost to base. Preserve exact colors, black line thickness, character scale, transparent 1024x1024 canvas and ground contact y942. No recentering, no new elements. Pixel-faithful edit, not a redesign.
```

### Prompt 2

```text
Precise localized animation edit of attached BASE, correction attempt. Return pose almost identical to base, only sway antenna tips 12 pixels RIGHT. Do not change head shape, smile, body, tail or shell. Keep original 1024x1024 framing, full character exact scale and original location, feet/sole at y942. Preserve every unmentioned feature, colors, black outline thickness, cel shading and detail. True transparent background. Do not recompose, recenter, or redraw unaffected regions. Output ONE frame.
```

## carota_1.png (B1)

Tentativi/chiamate: 1.

Base: cavalletto e carota reinterpretati rispetto al riferimento, con bulloni e riflessi più marcati. Lieve sfumatura del colore nonostante richiesta di campiture piatte. Normalizzazione tecnica della tela.

### Prompt 1

```text
Extract and redraw ONLY the carrot cannon defender from the supplied game reference, single base animation sprite B1. Full side profile facing RIGHT, ready and stationary: horizontal orange carrot body with green leafy tail on LEFT, tapered carrot tip is cannon muzzle pointing RIGHT, bold determined cartoon eyes, small wooden trestle with splayed legs. Keep design very similar to reference. Saturday morning 2D cartoon, thick black outlines, saturated solid colors, flat cel shadows, no gradients. No projectile yet. No scenery, ground shadow, text or other characters. True transparent alpha. Square 1024x1024, full character centered horizontally, about 6% side margins, lowest wooden feet at y=942 (92% height), no cropping. Definitive base for shooting animation.
```

## carota_2.png (B2)

Tentativi/chiamate: 3.

Tre chiamate: due immagini ottenute e una chiamata fallita senza immagine. Scelta ultima immagine. Prima versione troppo compressa; finale più vicina alla base, con carica/occhi stretti piuttosto discreti. Piccole variazioni nelle venature, nei riflessi e nella forma della bocca. Appoggio y941.

### Prompt 1

```text
Edit exact provided carrot base into B2 charging shot frame. Preserve entire wooden trestle absolutely unchanged: same feet coordinates, wood grain, bolts, legs, crossbar. Same green leaves count/shapes, same orange palette, thick black outlines and cel shadows. ONLY compress carrot horizontally backwards LEFT about 45 pixels, puff its body vertically about 20 pixels, narrow its eyes in concentration. Muzzle retracts with body. Leaf fan follows rear of body minimally without changing design. No projectile yet. Same scale, same framing, 1024x1024 transparent alpha canvas; feet baseline y942. No recentering or resizing.
```

### Prompt 2

```text
Precise localized animation edit of attached BASE, correction attempt. Charging shot: compress orange body only 5 percent horizontally toward LEFT and puff it 3 percent vertically, narrow eyelids. Preserve exact eyes size beneath lids. Do not dramatically shorten muzzle. All wooden stand pixels and leaf shapes unchanged. Keep original 1024x1024 framing, full character exact scale and original location, feet/sole at y942. Preserve every unmentioned feature, colors, black outline thickness, cel shading and detail. True transparent background. Do not recompose, recenter, or redraw unaffected regions. Output ONE frame.
```

### Prompt 3

```text
Localized animation edit, use attached base as exact master. Charging shot: orange body compresses only 5 percent horizontally toward left and puffs 3 percent up. Narrow eyelids, preserve eyes size. Keep wooden trestle EXACTLY stationary with identical legs, bolts, grain, crossbar and feet. Preserve green leaf fan shape. No projectile. Preserve exact identity, colors, outlines, highlights, all unaffected details, full canvas composition, same scale. 1024 square, genuine transparent alpha, ground contact y942. No re-centering or global rescaling.
```

## carota_3.png (B3)

Tentativi/chiamate: 2.

Scelto tentativo 2: rondella più sottile e corpo meno rimpicciolito rispetto al primo. Persistono variazioni nelle proporzioni della carota e dei riflessi; foglie più spostate del previsto. Cavalletto visivamente stabile con piccole differenze nei tratti del legno. Effetti e rinculo riducono il margine laterale rispetto al 6% della base.

### Prompt 1

```text
Edit this exact base carrot cannon sprite into firing frame B3. Keep wooden stand exactly fixed, same geometry, bolts, woodgrain, feet at y942. Preserve carrot identity, orange/green colors, leaf count and shapes, thick black outlines. Recoil: carrot body and muzzle slide LEFT 55 pixels, eyes open wide with rounded eyelids, rear leaves flex slightly. Add ONE small orange carrot slice flying RIGHT immediately ahead of muzzle, plus a tiny cream colored cartoon puff, fitting inside canvas x<990. Do not shrink whole character to fit projectile. Same 1024 square transparent canvas and base scale/registration. No scenery, lettering or ground shadow. Small localized change only.
```

### Prompt 2

```text
Make firing animation B3 by editing provided BASE. Crucial correction: orange carrot body must remain EXACTLY same length/height as base, translate it rigidly left 35 pixels for recoil, never shrink it to make space. Keep wooden stand fixed pixel for pixel. Keep green leaf fan identical except it moves with carrot. Open both eyes wide. Add a SMALL thin orange carrot slice, only 35px wide, just outside muzzle on right, and tiny cream puff 15px between. All effects fit within x1008; do not reframe to fit them. Same 1024 square canvas, true transparent alpha, feet y942, same colors, black lines and cel shadow details. One frame, no other changes.
```

