// La stanza della casa (#240, #265), stile Animal Crossing: pavimento a piastrelle, tre pareti con la carta da parati (davanti è
// aperta verso la camera, col bordo del pavimento tagliato come un plastico), il portale in fondo che porta al giardino e, sotto, il
// corridoio di assi da cui si entra e si esce in città. Sta nel template `lotto` (BORGO.stanza, celle locali): così baule e decorazioni
// dentro casa sono celle del LotState come in giardino. Dentro la camera è fissa sopra l'ingresso (render/camera.ts `blocca`) e attorno
// è buio: niente mare, pesci, gabbiani, pioggia, cielo né foschia (render/scene.ts `setInterno`). In giardino, sopra al pontile, un
// portale interdimensionale riporta in casa. In casa e in giardino la minimappa si nasconde (body.mz-casa): il giardino sta fuori dalla mappa.
// Pavimenti e carte da parati vengono da borgo.json (il primo è quello di serie); `motivo` dice come si dipinge la texture.
import * as THREE from 'three';
import { BORGO } from '@marea/content';
import { PIANTE_MAX, finitureScelte, livelloCasa, mascheraCase, scaleDi, stanzeDi } from '@marea/sim';
import type { GridMap, LotState, StanzaId } from '@marea/sim';
import type { CasaScala } from '@marea/content';
import type { Velo } from '../ui/velo.ts';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';
import { registerStateProvider } from '../test/testapi.ts';
import { NASCOSTI_DENTRO, costruisciStanza, createInquadratura } from './interno.ts';
import type { Pianta } from './interno.ts';
import { creaPortale } from '../render/portale.ts';
import type { Portale } from '../render/portale.ts';

const ST = BORGO.stanza, [, , C1] = ST.corridoio;
const STANZE_MAX = PIANTE_MAX; // le stanze più grandi che la casa avrà mai: per capire in quale sei
/** La pianta di una stanza a un livello di casa (#386): gli ampliamenti la ingrandiscono. Il piano terra tiene il corridoio e la porta in fondo; cantina e secondo piano no. */
const piantaDi = (livello: number, id: StanzaId = 'terra'): Pianta => {
  const s = stanzeDi(livello).find((r) => r.id === id) ?? stanzeDi(livello)[0]!;
  return id === 'terra' ? { pavimento: s.pavimento, corridoio: ST.corridoio, altezza: ST.altezza, retro: ST.retro[0] } : { pavimento: s.pavimento, corridoio: null, altezza: ST.altezza, retro: null };
};
/** Una scala (#386), in coordinate locali del lotto: una botola con la ringhiera che scende, o una rampa che sale, sulla cella della scala. */
function scala(s: CasaScala, T: number): THREE.BufferGeometry[] {
  const x = (s.cell[0] + 0.5) * T, z = (s.cell[1] + 0.5) * T, g: THREE.BufferGeometry[] = [], b = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  if (s.verso === 'giu') {
    for (const sz of [-1, 1]) g.push(painted(b(1.7, 0.14, 0.16), P.legnoScuro, M(x, 0.08, z + sz * 0.77)));
    for (const sx of [-1, 1]) g.push(painted(b(0.16, 0.14, 1.7), P.legnoScuro, M(x + sx * 0.77, 0.08, z)));
    g.push(painted(b(1.4, 0.04, 1.4), P.neroCaldo, M(x, 0.06, z)));
    [P.legnoChiaro, P.legno, P.legnoScuro, P.roccia].forEach((c, i) => g.push(painted(b(1.1, 0.04, 0.3), c, M(x, 0.1, z - 0.5 + i * 0.33)))); // i gradini che scendono nel buio
    for (const sx of [-1, 1]) g.push(painted(b(0.08, 0.8, 0.08), P.legnoScuro, M(x + sx * 0.8, 0.45, z + 0.8)));
    g.push(painted(b(1.7, 0.07, 0.07), P.legno, M(x, 0.82, z + 0.8)));
  } else {
    for (let i = 0; i < 4; i++) g.push(painted(b(1.3, 0.2 * (i + 1), 0.36), i % 2 ? P.legno : P.legnoChiaro, M(x, 0.1 * (i + 1), z + 0.55 - i * 0.36))); // i gradini che salgono verso il fondo
    for (const sx of [-1, 1]) { g.push(painted(b(0.08, 1.2, 0.08), P.legnoScuro, M(x + sx * 0.7, 0.8, z + 0.65))); g.push(painted(b(0.08, 0.08, 1.5), P.legno, M(x + sx * 0.7, 1.15, z - 0.05))); }
  }
  g.push(painted(b(0.6, 0.02, 0.22), P.giallo, M(x, 0.03, z + (s.verso === 'giu' ? 1.2 : 1.15)))); // la targhetta sul pavimento davanti
  return g;
}
/** Libera geometrie, materiali e texture di un gruppo che non serve più (la stanza si rifà quando la casa cresce). */
function libera(g: THREE.Object3D): void {
  g.traverse((n) => {
    if (!(n instanceof THREE.Mesh)) return;
    n.geometry.dispose();
    for (const m of Array.isArray(n.material) ? n.material : [n.material]) { (m as THREE.MeshLambertMaterial).map?.dispose(); m.dispose(); }
  });
}



export type Stanza = { dentro(): number | null; stanza(): StanzaId | null };

export function createStanza(o: { world: GameWorld; renderer: Renderer; slots: readonly number[]; lotDi?: (slot: number) => LotState | null; /** Per cambiare piano dalle scale (#386). */ velo?: Velo }): Stanza {
  const w = o.world, arch = w.archipelago, T = arch.tile, dio = o.renderer.diorama;
  let pav = BORGO.pavimenti[0]!, carta = BORGO.carte[0]!;
  // la stanza è quella del livello di casa di chi ci abita (#386): si rifà quando cambia
  let room!: THREE.Group, rifinisci!: (p: typeof pav, c: typeof carta) => void, costruitaPer = '';
  const livelloDi = (slot: number): number => livelloCasa(o.lotDi?.(slot)?.casa);
  // la cantina è di pietra, sempre: pavimento e carta scelti con ARREDA valgono per gli altri piani
  const cantinaPav = BORGO.pavimenti.find((f) => f.id === 'lastre') ?? BORGO.pavimenti[0]!, cantinaCarta = BORGO.carte.find((f) => f.id === 'mattoni') ?? BORGO.carte[0]!;
  const costruisci = (livello: number, id: StanzaId) => {
    if (room) { w.scene.remove(room); libera(room); }
    const r = costruisciStanza(T, piantaDi(livello, id), id === 'cantina' ? cantinaPav : pav, id === 'cantina' ? cantinaCarta : carta);
    room = r.group; rifinisci = r.rifinisci; room.name = 'stanza'; room.visible = false; w.scene.add(room); costruitaPer = livello + ':' + id;
    const scale = scaleDi(livello).filter((s) => s.stanza === id).flatMap((s) => scala(s, T));
    if (scale.length) { const m = new THREE.Mesh(merged(scale), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.name = 'scale'; m.castShadow = m.receiveShadow = true; room.add(m); }
  };
  costruisci(0, 'terra');
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  // chi cammina in casa urta i muri della stanza del suo livello, non il bordo del pavimento massimo del template
  let mascherata: GridMap | null = null;
  w.maschera = (m) => (mascherata ??= mascheraCase(m, arch.lots, livelloDi));
  // pavimento e carta di chi ci abita (#265: comprati al negozio dei mobili e scelti con ARREDA): si ridipingono quando cambiano
  const finiture = (slot: number) => {
    const s = finitureScelte(o.lotDi?.(slot) ?? null);
    pav = BORGO.pavimenti.find((f) => f.id === s.pavimento) ?? BORGO.pavimenti[0]!; carta = BORGO.carte.find((f) => f.id === s.carta) ?? BORGO.carte[0]!;
    if (quiStanza !== 'cantina') rifinisci(pav, carta);
  };

  // il portale interdimensionale del giardino verso la stanza (#404), posizionato sopra al pontile
  const gx = ST.giardino[0] * T, gz = (ST.giardino[1] + 0.5) * T;
  const portaliGiardino = new THREE.Group(); portaliGiardino.name = 'passaggi_giardino';
  for (const s of o.slots) {
    const l = arch.lots.find((q) => q.slot === s); if (!l) continue;
    const ox = l.origin[0] * T, oz = l.origin[1] * T;
    portaliGiardino.add(creaPortale({ x: ox + gx, y: w.groundY(ox + gx, oz + gz), z: oz + gz, ry: 0 }));
  }
  if (portaliGiardino.children.length) w.scene.add(portaliGiardino);

  const inq = createInquadratura({ world: w, renderer: o.renderer });

  let qui: number | null = null, quiStanza: StanzaId | null = null, inScala = false, arrediVisibili: string[] = [];
  const nascosti: THREE.Object3D[] = [];
  /** In quale casa e in quale stanza sei (dai bordi delle stanze più grandi: lì dentro non c'è altro che la casa). */
  const dentroDi = (): { slot: number; stanza: StanzaId } | null => {
    const a = w.avatar.state, p = arch.placeAt(a.x, a.z);
    if (!p || p.role !== 'lotto' || p.slot === null) return null;
    const cx = a.x / T - p.origin[0], cz = a.z / T - p.origin[1];
    for (const m of STANZE_MAX) {
      const [x0, z0, x1, z1] = m.pavimento;
      if (cx >= x0 - 1 && cx < x1 + 1 && cz >= z0 - 1 && cz < (m.id === 'terra' ? C1 + 0.5 : z1 + 0.5)) return { slot: p.slot, stanza: m.id };
    }
    return null;
  };
  const entra = (slot: number, id: StanzaId) => { const l = arch.lots.find((q) => q.slot === slot)!; inq.entra(l.origin[0] * T, l.origin[1] * T, piantaDi(livelloDi(slot), id)); };
  /** Le scale si prendono camminandoci sopra: col velo si cambia piano e si arriva davanti alla scala dell'altro piano (a due metri: non si rimbalza). */
  const scalaTick = (origin: readonly [number, number], id: StanzaId) => {
    const v = o.velo, a = w.avatar.state;
    if (!v || qui === null) return;
    let vicina: CasaScala | null = null, dist = 99;
    for (const s of scaleDi(livelloDi(qui)).filter((x) => x.stanza === id)) { const d = Math.hypot(a.x - (origin[0] + s.cell[0] + 0.5) * T, a.z - (origin[1] + s.cell[1] + 0.5) * T); if (d < dist) { dist = d; vicina = s; } }
    if (!vicina || dist > 1.8) { inScala = false; return; }
    if (inScala || dist > 0.8 || w.mode !== 'walk' || w.frozen || w.race.on || v.attivo) return;
    inScala = true;
    const dest = vicina;
    void v.passa(() => w.aPiedi((origin[0] + dest.arrivo[0] + 0.5) * T, (origin[1] + dest.arrivo[1] + 0.5) * T, 0));
  };
  const esce = () => inq.esce();
  // dopo il cull di ogni frame (world.ts): dentro la stanza si nasconde il resto di quel giardino, il mare, i leggii, animali e pioggia
  w.dopoCull = () => {
    for (const n of nascosti) n.visible = true;
    nascosti.length = 0;
    const tempo = performance.now() * 0.001;
    for (const p of portaliGiardino.children) (p as Portale).update?.(tempo);
    (room?.getObjectByName('portale_retro') as Portale | undefined)?.update?.(tempo);
    const prima = qui, primaStanza = quiStanza, d = dentroDi();
    qui = d?.slot ?? null; quiStanza = d?.stanza ?? null;
    if (d && `${livelloDi(d.slot)}:${d.stanza}` !== costruitaPer) { costruisci(livelloDi(d.slot), d.stanza); if (qui === prima && quiStanza === primaStanza) entra(d.slot, d.stanza); } // la casa è cresciuta: stanza nuova e camera nuova
    if (qui !== prima || quiStanza !== primaStanza) { if (d) entra(d.slot, d.stanza); else esce(); } // anche cambiando piano si rifà l'inquadratura
    const pl = arch.placeAt(w.avatar.state.x, w.avatar.state.z);
    document.body.classList.toggle('mz-casa', w.mode === 'walk' && (pl?.role === 'lotto' || pl?.role === 'negozio')); // minimappa via in casa, in giardino e nel negozio
    room.visible = qui !== null;
    if (qui === null) return;
    finiture(qui);
    const l = arch.lots.find((q) => q.slot === qui)!;
    const rr = piantaDi(livelloDi(qui), quiStanza!).pavimento;
    room.position.set(l.origin[0] * T, w.groundY((l.origin[0] + (rr[0] + rr[2]) / 2) * T, (l.origin[1] + (rr[1] + rr[3]) / 2) * T), l.origin[1] * T);
    scalaTick(l.origin, quiStanza!);
    const via = (n: THREE.Object3D | undefined | null) => { if (n && n.visible) { n.visible = false; nascosti.push(n); } };
    via(w.scene.getObjectByName('vista_lotto_' + qui)); via(w.water.mesh); via(w.scene.getObjectByName('libri_ospiti')); via(w.scene.getObjectByName('passaggi_giardino'));
    for (const n of NASCOSTI_DENTRO) via(w.scene.getObjectByName(n));
    const zMuro = (l.origin[1] + rr[1]) * T, v = new THREE.Vector3();
    // i mobili sono una mesh per stanza: quelle degli altri piani non si vedono
    for (const g of w.scene.children) if (g.name.startsWith('lot_')) for (const c of g.children) { c.getWorldPosition(v); if (v.z < zMuro || (c.userData['stanza'] && c.userData['stanza'] !== quiStanza)) via(c); }
    arrediVisibili = w.scene.children.filter((g) => g.name.startsWith('lot_')).flatMap((g) => g.children.filter((c) => c.userData['stanza'] && c.visible).map((c) => String(c.userData['stanza'])));
  };
  registerStateProvider('stanza', () => ({ arrediVisibili, dentro: qui, stanza: quiStanza, livello: qui !== null ? livelloDi(qui) : 0, pianta: piantaDi(qui !== null ? livelloDi(qui) : 0, quiStanza ?? 'terra').pavimento, pavimento: pav.id, carta: carta.id, camera: qui !== null ? { yaw: dio.yaw, dist: +inq.distanza.toFixed(1) } : null, mini: !document.body.classList.contains('mz-casa') }));
  return { dentro: () => qui, stanza: () => quiStanza };
}
