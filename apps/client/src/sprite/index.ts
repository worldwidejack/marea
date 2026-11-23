// I giocatori a sprite 2.5D nel mondo, a piedi: tu e gli amici, al posto del modello 3D (che resta sotto, spento: le ossa servono ancora al
// retino e alla lenza). Camminata in 16 direzioni, retino, canna e pala in mano; schivata = capriola; emote = saltello e giro. In barca, nei
// dungeon e nelle altre modalità si resta in 3D. Impostazioni → «Personaggi 2.5D». Arena: sprite/arena.ts.
import * as THREE from 'three';
import type { Renderer } from '../render/scene.ts';
import type { Avatar } from '../game/avatar.ts';
import { BALANCE } from '@marea/content';
import { PAL } from '../ui/style.ts';
import type { InMano } from '../game/in_mano.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { atlante } from './atlante.ts';
import { creaStrato } from './strato.ts';
import { capriola, creaFigura } from './figura.ts';
import type { Figura, Mossa } from './figura.ts';
import { creaLuce } from './luce.ts';

export type PersonaggiSprite = { dispose(): void };
type Uno = { av: Avatar; corpo: THREE.Object3D; y0: number; yaw0: number; figura: Figura; ombra: THREE.Mesh; visto: number };

/** Che mossa fa: gli attrezzi del Borgo, la pala, la camminata. */
function mossaDi(av: Avatar, m: InMano | null, muove: boolean): { nome: string; n: Mossa['n'] } {
  const az = av.azioneInCorso;
  if (az && az !== 'scuoti') { // la pala: i disegni durano quanto dice l'atlante, sul tempo dell'azione
    const k = av.azioneProgresso;
    return { nome: 'pala', n: (q, ms) => { let tot = 0; for (let i = 1; i <= q; i++) tot += ms(i); let t = k * tot, i = 1; while (i < q && t >= ms(i)) t -= ms(i++); return i; } };
  }
  if (!m || az) return { nome: 'camminata', n: 0 };
  const k = m.k;
  if (k !== null) return { nome: m.attrezzo, n: (q) => 2 + Math.floor(Math.min(0.999, k) * (q - 1)) };
  return muove ? { nome: 'passo' + m.attrezzo, n: 0 } : { nome: m.attrezzo, n: 1 };
}

export function creaPersonaggi(o: { renderer: Renderer; scena: THREE.Scene }): PersonaggiSprite {
  const { renderer, scena } = o, cam = renderer.camera, strato = creaStrato(renderer), luce = creaLuce(scena);
  const tutti = new Map<THREE.Object3D, Uno>();
  const disco = new THREE.CircleGeometry(0.42, 12).rotateX(-Math.PI / 2);
  const ombraMat = new THREE.MeshBasicMaterial({ color: PAL.abisso, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const punta = new THREE.Vector3();
  let giro = 0, prova: InMano | null = null;

  function nuovo(ob: THREE.Object3D, av: Avatar): Uno {
    const corpo = ob.children[0]!, ombra = new THREE.Mesh(disco, ombraMat);
    ombra.name = 'ombra_sprite'; ombra.position.y = 0.03; ob.add(ombra);
    const u: Uno = { av, corpo, y0: corpo.position.y, yaw0: corpo.rotation.y, figura: creaFigura(strato.nuovo(scena), cam), ombra, visto: 0 };
    tutti.set(ob, u);
    return u;
  }
  function togli(ob: THREE.Object3D, u: Uno): void {
    u.figura.sprite.togli(); u.ombra.removeFromParent(); u.corpo.visible = true; u.av.sprite = null; tutti.delete(ob);
  }
  function uno(ob: THREE.Object3D, u: Uno): void {
    const { av, figura } = u, s = av.state, muove = Math.hypot(s.vx, s.vz) > 0.2 && s.anim !== 'sit';
    const m = mossaDi(av, ob.name === 'avatar' && prova ? prova : av.inMano, muove), borgo = atlante('borgo');
    figura.sprite.visibile = false;
    if (!borgo) return; // finché gli sprite non arrivano resta il 3D
    av.sprite ??= { punta: null };
    u.corpo.visible = false; u.ombra.visible = true;
    if (!ob.visible) return;
    const p = ob.position, rotola = s.anim === 'roll', t = rotola ? 1 - (s.rollT ?? 0) / (BALANCE.avatar.schivata.durata * 60) : 0;
    const scuoti = av.azioneInCorso === 'scuoti' ? Math.sin(av.azioneTempo * 40) * 0.04 : 0;
    const salto = u.corpo.position.y - u.y0 + (rotola ? Math.sin(Math.PI * t) * 0.2 : 0);
    const yaw = -ob.rotation.y;
    const voce = figura.mostra({ atlante: borgo, nome: rotola ? 'camminata' : m.nome, n: rotola ? 2 : m.n },
      { x: p.x + scuoti, y: p.y + salto, z: p.z, yaw, muove, giro: -(u.corpo.rotation.y - u.yaw0), capriola: rotola ? capriola(t, yaw, cam) : 0 });
    if (!voce) return;
    figura.sprite.visibile = true;
    luce(p.x, p.y + 1, p.z, figura.sprite.luce);
    av.sprite.punta = voce[7] !== undefined ? figura.sprite.punto(voce[7], voce[8]!, punta).clone() : null;
  }

  // a ogni frame, dopo che il mondo ha mosso tutti e prima del disegno (render/scene.ts)
  const gancio = new THREE.Object3D(); gancio.name = 'personaggi_sprite';
  gancio.userData['preRender'] = () => {
    giro++;
    for (const ob of scena.children) {
      const av = ob.userData['avatar'] as Avatar | undefined;
      if (!av || !av.usesModel) continue;
      const u = tutti.get(ob) ?? nuovo(ob, av);
      u.visto = giro; uno(ob, u);
    }
    for (const [ob, u] of tutti) if (u.visto !== giro) togli(ob, u);
  };
  scena.add(gancio);
  renderer.setStrato(strato);
  atlante('borgo');
  registerStateProvider('sprite', () => ({ strato: renderer.strato === strato, piena: strato.piena, pronto: !!atlante('borgo'), figure: [...tutti].map(([ob, u]) => ({ nome: ob.name, chiave: u.figura.chiave, visibile: u.figura.sprite.visibile, corpo: u.corpo.visible })) }));
  // prove e foto: un attrezzo in mano al proprio personaggio anche senza averlo (spriteInMano('canna', 0.5); null = quello vero)
  registerTestHook('spriteInMano', (a, k) => { prova = a ? { attrezzo: String(a) as InMano['attrezzo'], k: typeof k === 'number' ? k : null } : null; return true; });
  return {
    dispose() {
      gancio.removeFromParent();
      for (const [ob, u] of [...tutti]) togli(ob, u);
      renderer.setStrato(null); strato.dispose(); disco.dispose(); ombraMat.dispose();
    },
  };
}
