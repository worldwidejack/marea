#!/usr/bin/env node
// Veicolo delle Corse fatto con l'AI 3D (#281, già preparato in Blender: verso, misura, triangoli) → glb leggero per il gioco:
// texture a 512 JPEG, niente normali (arrivano «a faccette», un vertice per angolo di triangolo: senza, i vertici si saldano e il file
// scende di due terzi; il client le ricalcola lisce in veicoli_ai.ts), vertici saldati, coordinate quantizzate.
// Uso: node tools/veicolo_ai_leggero.mjs in.glb out.glb   (serve python3 con PIL per la texture)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import { prune, quantize, weld } from '@gltf-transform/functions';
const [src, dst] = process.argv.slice(2);
const io = new NodeIO().registerExtensions([KHRMeshQuantization]); // sennò le coordinate quantizzate non si dichiarano
const doc = await io.read(src);
const root = doc.getRoot();
for (const t of root.listTextures()) {
  const tmp = path.join(os.tmpdir(), `veicolo_ai_${process.pid}`), a = tmp + '.img', b = tmp + '.jpg';
  fs.writeFileSync(a, t.getImage());
  execFileSync('python3', ['-c', `from PIL import Image; Image.open('${a}').convert('RGB').resize((512,512), Image.LANCZOS).save('${b}', quality=85)`]);
  t.setImage(fs.readFileSync(b)).setMimeType('image/jpeg').setURI('');
}
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) for (const s of ['NORMAL', 'TANGENT']) {
  const a = p.getAttribute(s); if (a) { p.setAttribute(s, null); a.dispose(); }
}
await doc.transform(weld(), quantize(), prune());
await io.write(dst, doc);
console.log(dst, (fs.statSync(dst).size / 1024).toFixed(0) + ' KB');
