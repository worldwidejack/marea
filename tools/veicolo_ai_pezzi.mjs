#!/usr/bin/env node
// I pezzi che si muovono dei veicoli AI (#281): ruote (girano e, davanti, sterzano) e gambe (lo struzzo cammina). Il modello AI arriva
// in un pezzo solo. Le ruote dell'AI non sono tonde: si tolgono (i triangoli dentro l'ovale di tools/veicoli_ai_pezzi.json) e resta un
// nodo vuoto al centro con le misure, dove il gioco monta una ruota tonda vera. Le gambe invece si staccano: i triangoli dentro il box
// diventano un nodo figlio col perno all'anca. `extras` dice al gioco cosa farne (corse/veicoli_ai.ts). Gira sul glb leggero del gioco.
// Uso: node tools/veicolo_ai_pezzi.mjs cs_v_moto [altri…]
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import { dequantize, prune, quantize, weld } from '@gltf-transform/functions';

const SPEC = JSON.parse(fs.readFileSync(new URL('./veicoli_ai_pezzi.json', import.meta.url), 'utf8'));
const io = new NodeIO().registerExtensions([KHRMeshQuantization]);

for (const modello of process.argv.slice(2)) {
  const spec = SPEC[modello];
  if (!spec) throw new Error(`${modello}: non c'è in veicoli_ai_pezzi.json`);
  const file = new URL(`../apps/client/public/assets/veicoli_ai/${modello}.glb`, import.meta.url);
  const doc = await io.read(file.pathname);
  await doc.transform(dequantize());
  const nodo = doc.getRoot().listNodes().find((n) => n.getMesh());
  if (nodo.listChildren().length) throw new Error(`${modello}: i pezzi sono già staccati`);
  const prim = nodo.getMesh().listPrimitives()[0];
  const T = nodo.getTranslation(), S = nodo.getScale()[0]; // scala uniforme, niente rotazione (veicolo_ai_leggero)
  const pos = prim.getAttribute('POSITION'), uv = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices();
  const e = [0, 0, 0], mondo = (i) => { pos.getElement(i, e); return [e[0] * S + T[0], e[1] * S + T[1], e[2] * S + T[2]]; };

  const dentro = (b, m) => b[0] <= m[0] && m[0] <= b[1] && b[2] <= m[1] && m[1] <= b[3] && b[4] <= m[2] && m[2] <= b[5];
  const pezzi = [
    ...(spec.ruote ?? []).map((w) => ({ ...w, perno: w.c, vuoto: true, prende: (m) => {
      const [ay, az] = w.togli ?? [w.r, w.r], dy = m[1] - w.c[1], dz = m[2] - w.c[2];
      return w.x[0] <= m[0] && m[0] <= w.x[1] && (w.rin ?? 0) ** 2 <= dy * dy + dz * dz && (dy / ay) ** 2 + (dz / az) ** 2 <= 1;
    }, extras: { tipo: 'ruota', r: w.r, w: w.w, davanti: !!w.davanti, cerchio: w.cerchio ?? 'pietra' } })),
    ...(spec.gambe ?? []).map((g) => ({ ...g, prende: (m) => dentro(g.box, m), extras: { tipo: 'gamba', fase: g.fase ?? 0 } })),
  ];
  const resto = [], tri = pezzi.map(() => []);
  let via = 0;
  for (let t = 0; t < idx.getCount(); t += 3) {
    const v = [idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2)], p = v.map(mondo);
    const m = [0, 1, 2].map((k) => (p[0][k] + p[1][k] + p[2][k]) / 3);
    if ((spec.via ?? []).some((b) => dentro(b, m))) { via++; continue; } // avanzi della gomma AI attorno alla ruota tonda
    const j = (spec.escludi ?? []).some((b) => dentro(b, m)) ? -1 : pezzi.findIndex((x) => x.prende(m));
    (j < 0 ? resto : tri[j]).push(...v);
  }
  const acc = (arr, tipo) => doc.createAccessor().setType(tipo).setArray(arr).setBuffer(pos.getBuffer());
  pezzi.forEach((x, j) => {
    const perno = [(x.perno[0] - T[0]) / S, (x.perno[1] - T[1]) / S, (x.perno[2] - T[2]) / S];
    if (x.vuoto) { // ruota: i triangoli dell'AI spariscono, resta il punto dove il gioco monta quella tonda
      nodo.addChild(doc.createNode(x.nome).setExtras(x.extras).setTranslation(perno));
      console.log(`${modello} ${x.nome}: tolti ${tri[j].length / 3} triangoli`);
      return;
    }
    const usati = [...new Set(tri[j])], nuovo = new Map(usati.map((v, i) => [v, i]));
    const P = new Float32Array(usati.length * 3), U = new Float32Array(usati.length * 2), u = [0, 0];
    usati.forEach((v, i) => { const w = mondo(v); for (let k = 0; k < 3; k++) P[i * 3 + k] = (w[k] - x.perno[k]) / S; uv.getElement(v, u); U[i * 2] = u[0]; U[i * 2 + 1] = u[1]; });
    const pr = doc.createPrimitive().setMaterial(prim.getMaterial())
      .setAttribute('POSITION', acc(P, 'VEC3')).setAttribute('TEXCOORD_0', acc(U, 'VEC2'))
      .setIndices(acc(new Uint32Array(tri[j].map((v) => nuovo.get(v))), 'SCALAR'));
    const figlio = doc.createNode(x.nome).setMesh(doc.createMesh(x.nome).addPrimitive(pr)).setExtras(x.extras).setTranslation(perno);
    nodo.addChild(figlio);
    console.log(`${modello} ${x.nome}: ${tri[j].length / 3} triangoli`);
  });
  prim.setIndices(acc(new Uint32Array(resto), 'SCALAR'));
  await doc.transform(weld(), quantize(), prune({ keepLeaves: true })); // keepLeaves: i nodi vuoti delle ruote restano
  await io.write(file.pathname, doc);
  console.log(`${modello}: carrozzeria ${resto.length / 3} triangoli (${via} avanzi tolti), ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}
