# Prova 3D dipinto (#38)

Pagina a parte (`apps/client/prova3d.html`), fuori dalla build del gioco. Serve a decidere lo stile, non è il gioco.

- Avvio: in `apps/client` → `node ../../node_modules/vite/bin/vite.js --host` → `/prova3d.html`
- `?ai=1` oggetti generati con l'AI · `?ai=isola` anche l'isola intera AI (fuori budget) · `?perf` numeri a schermo
- Screenshot, numeri e giro funzionale: `node tools/prova3d_shots.mjs` → `tests/out/prova3d/`

## Come si aggiunge un oggetto AI coerente (ricetta collaudata il 7/10/2026)
1. **Immagine**: Higgsfield `generate_image`, modello `nano_banana` (1 credito), con una delle immagini di `concept/` come `image_references` (per le persone `concept/persona.jpg`). Prompt: «Single isolated 3D game asset, same hand-painted stylized 3D look as the reference image: <oggetto>. Three-quarter view from slightly above, whole object visible and centered, plain flat light grey background, no ground, no text. No anime, no magic.»
2. **3D**: `generate_3d` modello `sam_3_3d` (1 credito) con l'id dell'immagine e un prompt di una parola (`house`, `tree`…). `image_to_3d` costa 20 crediti: non serve.
3. **Alleggerire**: Blender in background, `tools/ai_glb_leggero.py` (triangoli: casa 3000, bancarella 2500, albero 1000, persona 800, lampione 400; texture 512, persone e piccoli 256). Mai col decimate sotto ~20% su oggetti con parti sottili (staccionate, scogliere): si rompono.
4. **Metterlo nel mondo**: glb in `public/assets/prova3d/kit_<tipo>.glb`; nella funzione del kit (`kit.ts`/`kit2.ts`) una riga `if (ctx.ai) ctx.ai.push({ kind: '<tipo>', … })`. `main.ts` ne fa un InstancedMesh per tipo e per isola (un draw call).

Costo per oggetto: 2 crediti, ~5 minuti. Limiti: texture in VRAM (~1,4 MB per tipo a 512²; tetto 16 MB) e niente animazioni (le persone AI sono statue: il giocatore resta quello da codice).
