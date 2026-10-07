#!/usr/bin/env node
// Personaggio con scheletro (Meshy via Higgsfield) → glb per il gioco: texture a 512 JPEG; con --solo-animazione toglie
// mesh e texture e tiene scheletro + clip (le altre clip si attaccano allo stesso personaggio per nome delle ossa).
// Uso: node tools/eroe_glb_leggero.mjs in.glb out.glb [--solo-animazione]   (serve python3 con PIL per la texture)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { prune, quantize, weld } from '@gltf-transform/functions';
const [src, dst, flag] = process.argv.slice(2);
const io = new NodeIO();
const doc = await io.read(src);
const root = doc.getRoot();
if (flag === '--solo-animazione') {
  for (const n of root.listNodes()) { if (n.getMesh()) n.setMesh(null); n.setSkin(null); }
  for (const m of root.listMeshes()) m.dispose();
  for (const m of root.listMaterials()) m.dispose();
  for (const t of root.listTextures()) t.dispose();
} else {
  for (const t of root.listTextures()) {
    const tmp = path.join(os.tmpdir(), `eroe_${process.pid}`), a = tmp + '.png', b = tmp + '.jpg';
    fs.writeFileSync(a, t.getImage());
    execFileSync('python3', ['-c', `from PIL import Image; Image.open('${a}').convert('RGB').resize((512,512), Image.LANCZOS).save('${b}', quality=85)`]);
    t.setImage(fs.readFileSync(b)).setMimeType('image/jpeg').setURI('');
  }
}
// via le tangenti (il materiale Lambert non le usa), vertici saldati, dati orfani tolti
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const t = p.getAttribute('TANGENT'); if (t) { p.setAttribute('TANGENT', null); t.dispose(); } }
await doc.transform(weld(), quantize(), prune());
await io.write(dst, doc);
console.log(dst, (fs.statSync(dst).size / 1024).toFixed(0) + ' KB');
