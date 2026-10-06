// Tabella delle armi (tipo × materiale) e ordine voluto da docs/RPG.md §5: «velocità contro danno».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS, WEAPON_TYPES } from '@marea/content/rpg.ts';
import { itemDef } from '../src/rpg/items.ts';

const dps = (id: string): number => (itemDef(id).danno ?? 0) * (itemDef(id).velocita ?? 0);

test('rpg armi: tabella danno / colpi al secondo / DPS (stampata) e ordine di docs/RPG.md', () => {
  const pad = (s: string | number, n: number) => String(s).padStart(n);
  const lines = ['', 'arma          ' + MATERIALS.map((m) => pad(m.id, 18)).join(''), '              ' + MATERIALS.map(() => pad('danno vel  DPS', 18)).join('')];
  for (const t of WEAPON_TYPES) {
    lines.push(t.id.padEnd(14) + MATERIALS.map((m) => {
      const it = itemDef(`${t.id}_${m.id}`);
      return pad(`${(it.danno ?? 0).toFixed(1)} ${(it.velocita ?? 0).toFixed(2)} ${dps(it.id).toFixed(1)}`, 18);
    }).join(''));
  }
  console.log(lines.join('\n'));

  const T = (id: string) => WEAPON_TYPES.find((t) => t.id === id)!;
  const leggere = WEAPON_TYPES.filter((t) => t.classe === 'leggera');
  const pesanti = WEAPON_TYPES.filter((t) => t.classe === 'pesante');
  // nunchaku il più veloce di tutti, martello il più lento e il più forte per colpo
  for (const t of WEAPON_TYPES) {
    if (t.id !== 'nunchaku') assert.ok(T('nunchaku').velocita > t.velocita, `nunchaku più veloce di ${t.id}`);
    if (t.id !== 'martello') { assert.ok(T('martello').velocita < t.velocita, `martello più lento di ${t.id}`); assert.ok(T('martello').danno > t.danno, `martello più forte di ${t.id}`); }
  }
  // ascia: la più lenta delle leggere e la più forte; lancia: la più veloce delle pesanti, danno contenuto, portata migliore
  for (const t of leggere) if (t.id !== 'ascia') assert.ok(T('ascia').velocita < t.velocita && T('ascia').danno > t.danno, t.id);
  for (const t of pesanti) if (t.id !== 'lancia') assert.ok(T('lancia').velocita > t.velocita && T('lancia').danno < t.danno, t.id);
  for (const t of WEAPON_TYPES) if (t.id !== 'lancia') assert.ok(T('lancia').portata > t.portata, `portata lancia > ${t.id}`);
  // velocità contro danno: i DPS dei sei tipi stanno entro ±25 % della media (nessuna arma domina)
  const d = WEAPON_TYPES.map((t) => t.danno * t.velocita);
  const avg = d.reduce((a, b) => a + b, 0) / d.length;
  for (const [i, x] of d.entries()) assert.ok(Math.abs(x - avg) / avg < 0.25, `DPS ${WEAPON_TYPES[i]!.id} fuori scala`);
  // carica: più lenta e più forte con le armi pesanti
  assert.ok(T('martello').carica > T('nunchaku').carica && T('martello').caricaMolt > T('nunchaku').caricaMolt);

  // materiali: legno il più debole; vetro veloce e fragile; ossa le più lente e le più forti; meteorite ignora metà armatura; oro raddoppia il bottino
  const M = (id: string) => MATERIALS.find((m) => m.id === id)!;
  for (const m of MATERIALS) if (m.id !== 'legno') assert.ok(m.arma.danno > M('legno').arma.danno, `legno più debole di ${m.id}`);
  for (const m of MATERIALS) if (m.id !== 'ossa') assert.ok(m.arma.danno < M('ossa').arma.danno && m.arma.velocita > M('ossa').arma.velocita, m.id);
  assert.ok(M('vetro').arma.velocita > M('ferro').arma.velocita && (M('vetro').arma.traits?.fragile ?? 0) > 0);
  assert.equal(M('meteorite').arma.traits?.penetra, 0.5);
  assert.equal(itemDef('martello_meteorite').traits?.penetra, 0.5);
  assert.ok((M('oro').arma.traits?.dropMolt ?? 1) >= 2 && M('oro').arma.danno < M('bronzo').arma.danno, 'oro pessimo ma ricco');
  assert.equal(M('argento').arma.traits?.bonusVs?.nonmorto, 2);
  assert.ok(M('ferro').arma.danno > M('bronzo').arma.danno, 'ferro dopo il bronzo');
  // armature: ossa la più difensiva e pesante; meteorite peso negativo con difesa dell'acciaio; vetro doppio danno contundente
  for (const m of MATERIALS) if (m.id !== 'ossa') assert.ok(M('ossa').armatura.difesa > m.armatura.difesa && M('ossa').armatura.peso > m.armatura.peso, m.id);
  assert.ok(M('meteorite').armatura.peso < 0 && M('meteorite').armatura.difesa === M('ferro').armatura.difesa);
  assert.equal(M('vetro').armatura.vsContundente, 2);
  // archi: vetro ricarica istantanea, ossa il più forte, legno il più corto
  for (const m of MATERIALS) {
    if (m.id !== 'vetro') assert.ok(M('vetro').arco.tensione < m.arco.tensione, `arco vetro più rapido di ${m.id}`);
    if (m.id !== 'ossa') assert.ok(M('ossa').arco.danno > m.arco.danno, m.id);
    if (m.id !== 'legno') assert.ok(M('legno').arco.gittata < m.arco.gittata, m.id);
  }
  assert.equal(M('meteorite').arco.traits?.noGravita, true);
  assert.ok(M('legno').frecce.gravita > M('ferro').frecce.gravita && M('bronzo').frecce.gravita > M('ferro').frecce.gravita);
});
