// L'accampamento stretto (docs/TEMPLARI.md §12b punto 2): dalla taverna e dal cimitero al Mercante si fa meno strada di prima, la spiaggia
// non ha più spiazzi dove girare in tondo (il più grande quadrato libero è piccolo), palizzata e nave sono muri che fermano anche la
// vista, l'approdo del Mercante è l'unico posto dove si arriva alla riva, e i vicoli ciechi ci sono davvero.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { apriPorta } from '../src/templari/porte.ts';
import { C, TIPO } from '../src/templari/mappa.ts';

function partita(): TState {
  const s = templari.create({ seed: 1, opzioni: { subito: true } });
  s.eroe.punti = 1e6;
  for (const p of s.arena.porte) apriPorta(s, p);
  return s;
}
/** Passi (a 4 vicini) dalla cella `da` a ogni cella libera per l'eroe. */
function distanze(s: TState, da: number): Int32Array {
  const g = s.gr.eroe, d = new Int32Array(g.w * g.h).fill(-1), q = [da];
  d[da] = 0;
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!, cx = i % g.w;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, j = i + dx + dz * g.w;
      if (nx < 0 || nx >= g.w || j < 0 || j >= d.length || d[j]! >= 0 || g.solid[j]) continue;
      d[j] = d[i]! + 1; q.push(j);
    }
  }
  return d;
}
/** La cella libera accanto alla porta, dalla parte di `verso` (−1 / +1 sull'asse della porta). */
function fuoriDa(s: TState, id: string, dx: number, dz: number): number {
  const p = s.arena.porte.find((x) => x.id === id)!;
  return p.celle[0]! + dx + dz * s.arena.w;
}

test('accampamento: dalla taverna e dal cimitero al Mercante si fa meno strada di prima', () => {
  const s = partita(), a = s.arena, me = a.personaggi.find((x) => x.id === 'mercante')!;
  const m = Math.floor(me.z - me.fz) * a.w + Math.floor(me.x - me.fx); // la cella davanti, da dove gli si parla
  const dTav = distanze(s, fuoriDa(s, 'spiaggia_taverna', -1, 0))[m]!, dCim = distanze(s, fuoriDa(s, 'spiaggia_cimitero', 0, -1))[m]!;
  // prima (spiaggia larga, Mercante in fondo alla riva): 48 passi dalla porta della taverna, 61 dal cancello del cimitero (ora 40 e 44)
  assert.ok(dTav > 0 && dTav <= 42, `dalla taverna ${dTav} passi`);
  assert.ok(dCim > 0 && dCim <= 46, `dal cimitero ${dCim} passi`);
  assert.ok(me.z > 70 && me.fz === 1, JSON.stringify(me));
});

test('accampamento: niente spiazzi — il più grande quadrato libero sulla sabbia è di 5×5 (prima di 11×11)', () => {
  const s = partita(), a = s.arena, g = s.gr.eroe;
  // quadrato libero più grande che finisce in (cx, cz), solo sulla sabbia (programmazione dinamica)
  const q = new Int32Array(a.w * a.h);
  let max = 0;
  for (let cz = 0; cz < a.h; cz++) for (let cx = 0; cx < a.w; cx++) {
    const i = cz * a.w + cx;
    if (g.solid[i] || a.cell[i] === C.fuori || a.suolo[i] !== 5) continue;
    q[i] = cx && cz ? 1 + Math.min(q[i - 1]!, q[i - a.w]!, q[i - a.w - 1]!) : 1;
    max = Math.max(max, q[i]!);
  }
  assert.ok(max <= 5, `quadrato libero di ${max}×${max} sulla sabbia`);
});

test('accampamento: palizzata e nave sono muri che fermano la vista; alla riva si arriva solo dall\'approdo', () => {
  const s = partita(), a = s.arena;
  const pal = [...a.tipo.keys()].filter((i) => a.tipo[i] === TIPO.palizzata), nave = [...a.tipo.keys()].filter((i) => a.tipo[i] === TIPO.nave);
  assert.ok(pal.length >= 40 && nave.length >= 20, `palizzata ${pal.length}, nave ${nave.length}`);
  for (const i of [...pal, ...nave]) assert.ok(a.cell[i] === C.muro && a.opaque[i] === 1);
  // celle di sabbia libere che toccano il mare (a sud c'è il fuori): tutte nell'approdo, attorno al Mercante
  const me = a.personaggi.find((x) => x.id === 'mercante')!;
  const riva = [...a.cell.keys()].filter((i) => a.cell[i] === C.terra && a.suolo[i] === 5 && a.cell[i + a.w] === C.fuori);
  assert.ok(riva.length > 0 && riva.length <= 5, `riva libera: ${riva.length} celle`);
  for (const i of riva) assert.ok(Math.abs((i % a.w) + 0.5 - me.x) <= 2.5, `riva libera lontano dall'approdo in ${i % a.w},${Math.floor(i / a.w)}`);
});

test('accampamento: vicoli ciechi — almeno 6 celle di sabbia chiuse su tre lati', () => {
  const s = partita(), a = s.arena, g = s.gr.eroe;
  let ciechi = 0;
  for (let i = 0; i < a.cell.length; i++) {
    if (g.solid[i] || a.suolo[i] !== 5) continue;
    if ([1, -1, a.w, -a.w].filter((d) => g.solid[i + d]).length >= 3) ciechi++;
  }
  assert.ok(ciechi >= 6, `vicoli ciechi: ${ciechi}`);
});
