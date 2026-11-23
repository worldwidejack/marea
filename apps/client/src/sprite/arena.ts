// Gli eroi dell'Arena a sprite: il protagonista con in mano l'arma o la magia di adesso (un atlante per arma, sprite/atlante.ts), al posto del
// modello 3D e della sua arma. Le pose seguono la fase del colpo che dice la sim; gli effetti (scie, raggi, bombe) restano quelli di sempre.
// Uguali tutti: sotto i piedi c'è l'anello della squadra (acqua la mia, rosso le altre).
import * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import type { ArenaEroe } from '@marea/sim/rpg/arena.ts';
import type { HeroActor } from '../rpg/dungeon_hero.ts';
import type { Strato } from '../render/scene.ts';
import { PAL } from '../ui/style.ts';
import { registerStateProvider } from '../test/testapi.ts';
import { atlante, liberaAtlanti } from './atlante.ts';
import { capriola, creaFigura } from './figura.ts';
import type { Mossa } from './figura.ts';

type Eroe = DungeonView['hero'];
export type ArenaSprite = { update(gruppi: readonly THREE.Object3D[], opacita: (j: number) => number): void; dispose(): void };

/** Fine di ogni posa del colpo da mischia sulla fase della sim: carica, lama, ritorno. */
const FASI = [0.3, 0.42, 0.58, 0.8, 1.01];
/** Il giro del colpo caricato: da quando a quando ruota, e a quanti scatti. */
const GIRO = { da: 0.22, a: 0.72, scatti: 8 };

/** «katana_ferro» → katana: i disegni sono uno per tipo d'arma. */
const tipo = (id: string | null | undefined): string => id?.replace(/_[a-z]+$/, '') ?? '';
type Posa = { nome: string; n: number; giro: number };
/** La posa con l'arma o la magia `a` (nome dell'atlante) nella mano. */
function posaDi(h: Eroe, a: string, muove: boolean, ms: number): Posa {
  const nome = a.replaceAll('_', '');
  const posa = (p: number): Posa => (muove ? { nome: `${nome}mov${p}`, n: 0, giro: 0 } : { nome: `${nome}colpo`, n: p, giro: 0 });
  switch (h.anim) {
    case 'carica': return muove ? posa(1) : { nome: `${nome}carica`, n: 1 + (Math.floor(ms / 60) % 2), giro: 0 };
    case 'attacca':
      if (h.stile !== 'giro') return posa(1 + FASI.findIndex((f) => h.t < f));
      if (h.t < GIRO.da) return posa(1);
      if (h.t > GIRO.a) return posa(h.t < 0.85 ? 4 : 5);
      return { nome: `${nome}giro`, n: 1, giro: (-2 * Math.PI * Math.floor(((h.t - GIRO.da) / (GIRO.a - GIRO.da)) * GIRO.scatti)) / GIRO.scatti };
    case 'tende': return posa(h.t < 0.28 ? 1 : 2);
    case 'tira': return posa(3);
    case 'lancia': return h.canale ? posa(2 + (Math.floor(ms / 120) % 2)) : posa(h.t < 0.28 ? 1 : h.t < 0.55 ? 2 : 3);
    default: return muove ? { nome, n: 0, giro: 0 } : { nome: `${nome}fermo`, n: 1 + (Math.floor(ms / 520) % 2), giro: 0 };
  }
}

export function creaArenaSprite(o: { strato: Strato; scena: THREE.Scene; camera: THREE.Camera; eroi: readonly (HeroActor | null)[]; set: readonly ArenaEroe[]; mia: (j: number) => boolean; gruppi: readonly THREE.Object3D[] }): ArenaSprite {
  const { camera } = o;
  // gli atlanti di quello che si usa in questa partita, subito
  const inMano = o.set.flatMap((e) => e.varianti.map((v) => (v?.manoMagia && v.magia !== null ? v.magie[v.magia]?.id : tipo(v?.arma.id))));
  for (const a of ['borgo', ...inMano.flatMap((x) => (x ? ['arena_' + x] : []))]) atlante(a);
  const anello = new THREE.RingGeometry(0.4, 0.52, 14).rotateX(-Math.PI / 2), disco = new THREE.CircleGeometry(0.42, 12).rotateX(-Math.PI / 2);
  const mat = (c: string, opacity: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mats = { ombra: mat(PAL.abisso, 0.35), mia: mat(PAL.acquaBassa, 0.9), sua: mat(PAL.rosso, 0.9) };
  const figure = o.eroi.map((e, j) => {
    const f = creaFigura(o.strato.nuovo(o.scena), camera), segno = new THREE.Group();
    segno.add(new THREE.Mesh(disco, mats.ombra), new THREE.Mesh(anello, o.mia(j) ? mats.mia : mats.sua));
    segno.position.y = 0.04; segno.visible = false; o.gruppi[j]!.add(segno);
    return { e, f, segno };
  });
  registerStateProvider('arenaSprite', () => figure.map(({ f }) => ({ chiave: f.chiave, visibile: f.sprite.visibile })));
  return {
    update(gruppi, opacita) {
      const ms = performance.now();
      figure.forEach(({ e, f, segno }, j) => {
        const h = e?.posa, borgo = atlante('borgo');
        f.sprite.visibile = false;
        if (!e || !h || !borgo) return;
        const p = e.avatar.object.position, a = h.magia ?? tipo(h.arma);
        const at = a ? atlante('arena_' + a) : undefined, muove = e.velocita > 0.4, yaw = -e.avatar.object.rotation.y, rotola = h.anim === 'schiva';
        e.soloSprite(true);
        segno.visible = true; segno.position.set(p.x, p.y + 0.04, p.z);
        if (!gruppi[j]!.visible) return;
        const posa: Posa = rotola || !at ? { nome: 'camminata', n: rotola ? 2 : 0, giro: 0 } : posaDi(h, a, muove, ms);
        const m: Mossa = { atlante: rotola || !at ? borgo : at, nome: posa.nome, n: posa.n };
        f.sprite.visibile = !!f.mostra(m, { x: p.x, y: p.y + (rotola ? Math.sin(Math.PI * h.t) * 0.2 : 0), z: p.z, yaw, muove, giro: posa.giro, capriola: rotola ? capriola(h.t, yaw, camera) : 0 });
        f.sprite.opaco = opacita(j); f.sprite.lampo = e.lampo ? 0.55 : 0;
      });
    },
    dispose() {
      for (const { e, f, segno } of figure) { f.sprite.togli(); segno.removeFromParent(); e?.soloSprite(false); }
      anello.dispose(); disco.dispose(); for (const m of Object.values(mats)) m.dispose();
      liberaAtlanti('arena_');
    },
  };
}
