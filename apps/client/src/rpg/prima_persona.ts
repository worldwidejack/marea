// Dungeon in prima persona: la camera sta negli occhi dell'eroe e la sim riceve come direzione di mira quella dello sguardo, in piano (mira.ts)
// e in alto e in basso (alzo.ts). Qui stanno la camera (passi, schivata, scosse, caduta, lo zoom dell'Occhio d'aquila), l'input che ne deriva,
// le mani e i filtri dell'HUD. Comandi in fp_comandi.ts, corpo in fp_corpo.ts, sprite davanti agli occhi in fp_mani.ts e fp_pose.ts, avvisi
// in fp_avvisi.ts; alla Skyrim: bottino da frugare in fp_fruga.ts, barre e bersaglio in fp_hud.ts, mappa con la nebbia in fp_mappa.ts, pericoli in
// piedi in fp_pericoli.ts.
import * as THREE from 'three';
import type { InputFrame } from '@marea/sim';
import { aimIndex } from '@marea/sim/dungeon/mira.ts';
import { swingStyle } from '@marea/sim/dungeon/swing.ts';
import { OCCHI_Y, alzoIndex, quotaNemico } from '@marea/sim/dungeon/alzo.ts';
import { lineOfSight } from '@marea/sim/dungeon/map.ts';
import type { DMap } from '@marea/sim/dungeon/map.ts';
import type { DungeonState } from '@marea/sim/dungeon/state.ts';
import type { DungeonAzione, DungeonView } from '@marea/sim/dungeon/types.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import { RPG, spellDef } from '@marea/content/rpg.ts';
import type { DioramaCamera } from '../render/camera.ts';
import type { Loader } from '../render/loader.ts';
import type { Avatar } from '../game/avatar.ts';
import { dungeonLink } from '../game/ingressi.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { coloreMagia, palColor } from './items_ui.ts';
import { stile } from './magie_stile.ts';
import type { DungeonScene } from './dungeon_scene.ts';
import type { Mischia } from './dungeon_actors.ts';
import { creaSguardo } from './fp_comandi.ts';
import { creaCorpo } from './fp_corpo.ts';
import { creaMani, haPezzo } from './fp_mani.ts';
import type { Colore } from './fp_mani.ts';
import { posa, puntaRaggio } from './fp_pose.ts';
import type { Arnese } from './fp_pose.ts';
import { creaAvvisi } from './fp_avvisi.ts';
import { creaFruga } from './fp_fruga.ts';
import type { Corpo } from './corpi_a_terra.ts';
import { creaHudFp } from './fp_hud.ts';
import { creaMappaFp } from './fp_mappa.ts';
import { creaPericoli } from './fp_pericoli.ts';

type EroeVista = DungeonView['hero'];
export type PrimaPersona = {
  /** Telefono in verticale: da soli la partita aspetta. */
  readonly fermo: boolean;
  /** Ogni frame, prima di disegnare: camera e mani. `p` = posizione dell'eroe interpolata, `punta` = la A è giù con la magia in mano. */
  update(dt: number, t: number, p: THREE.Vector3, v: DungeonView, punta: boolean): void;
  /** La punta della bacchetta in mondo: da lì parte il raggio (magie_fx.ts). */
  punta(): THREE.Vector3;
  /** La direzione dello sguardo in mondo (versore): il tuo raggio va di lì. */
  sguardo(): THREE.Vector3;
  /** Il colpo di mischia che l'eroe darebbe adesso (i nemici che ci stanno dentro brillano): null con arco o magia in mano, o a terra. */
  mischia(v: DungeonView): Mischia | null;
  /** Ogni frame, in fondo all'update della spedizione: gira e arretra il corpo (chi lo segue ha già letto la posizione vera). */
  fine(): void;
  /** Mira da mandare alla sim adesso (angolo e alzo): solo mentre serve, così il log resta corto; null = niente. */
  mira(v: DungeonView, preme: boolean, h: { act: string; raffica: number }): { m: number; p: number } | null;
  /** La schivata da fermi va all'indietro. */
  muovi(f: InputFrame): InputFrame;
  colpito(): void;
  /** Un tasto (E sul bottino sotto il mirino): true = preso qui. */
  tasto(e: KeyboardEvent): boolean;
  /** Dove far nascere i numeri che riguardano l'eroe: poco davanti agli occhi. */
  davanti(): THREE.Vector3;
  /** Le barre sopra le teste: in prima persona solo alleati ed evocazioni (quella del nemico sta in alto, fp_hud.ts), e non attraverso i muri. */
  barre<T extends { pos: THREE.Vector3; ally?: boolean }>(l: T[]): T[];
  clic(): boolean;
  riprendi(): void;
  dispose(): void;
};

/** Altezza degli occhi (m: quella della sim, da cui partono frecce e magie), passi, FOV orizzontale e limiti di quello verticale (°), lontananza massima (m, la nebbia si ferma prima). */
const OCCHI = OCCHI_Y, FOV_H = 90, FOV_MIN = 50, FOV_MAX = 65, FAR = 60;
const PASSO = { freq: 3.1, y: 0.035, x: 0.012, vPiena: 2.6 }, MANI_PASSO = { x: 0.012, y: 0.02 };
const SCHIVA = { giu: 0.4, rollio: 0.2 }, MORTE = { durata: 0.9, y: 0.3, rollio: 1.15, pitch: 0.15 };
/** Mira assistita dal telefono: coseno del cono attorno allo sguardo, portata (m). */
const COS_AIUTO = Math.cos((12 * Math.PI) / 180), AIUTO_M = 16;
const ATTIVE = new Set(['press', 'carica', 'tende', 'punta']);
const CAMBIO = 0.24, TIPI = new Set<string>(['katana', 'ascia', 'nunchaku', 'lancia', 'spadone', 'martello']);
const colore = (hex: string): Colore => { const c = new THREE.Color(hex); return [Math.min(1.1, c.r * 1.25), Math.min(1.1, c.g * 1.25), Math.min(1.1, c.b * 1.25)]; };
/** Le lame sono disegnate in grigio medio: il grigio medio diventa il colore del materiale, le luci restano più chiare. */
const coloreLama = (hex: string): Colore => { const c = new THREE.Color(hex), k = 1 / 0.45; return [Math.min(1.6, c.r * k), Math.min(1.6, c.g * k), Math.min(1.6, c.b * k)]; };
const BIANCO: Colore = [1, 1, 1];

/** Il corridoio più lungo visto da (x, z): da lì si comincia a guardare, non contro un muro o contro la scala. */
function verso(map: DMap, x: number, z: number, h: { fx: number; fz: number }): number {
  let best = Math.atan2(-h.fx, -h.fz), lung = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, fx = -Math.sin(a), fz = -Math.cos(a);
    let d = 0;
    while (d < 24 && lineOfSight(map, x, z, x + fx * (d + 1), z + fz * (d + 1))) d++;
    if (d > lung) { lung = d; best = a; }
  }
  return best;
}

export function createPrimaPersona(o: {
  root: HTMLElement; canvas: HTMLCanvasElement; loader: Loader; diorama: DioramaCamera; sc: DungeonScene; avatar: Avatar; hero0: EroeVista; attivo(): boolean; onPerso(): void;
  /** La partita (bottino e perk) e le azioni dal menu (`fruga`, `prendi`): come lo zaino. */
  stato(): DungeonState; act(a: DungeonAzione): string | null; avviso(t: string): void;
  /** Dove giace il nemico caduto `id` (dungeon_actors.ts): il bottino si fruga dove si vede il corpo. */
  corpo(id: number): Corpo | null;
}): PrimaPersona {
  const camera = o.diorama.camera, far0 = camera.far, map = o.sc.map;
  const sg = creaSguardo({ canvas: o.canvas, root: o.root, yaw: verso(map, o.hero0.x, o.hero0.z, o.hero0), onPerso: o.onPerso });
  const corpo = creaCorpo(o.avatar), mani = creaMani({ camera, canvas: o.canvas, loader: o.loader }), avvisi = creaAvvisi(o.root);
  const fruga = creaFruga({ root: o.root, tocco: sg.tocco, stato: o.stato, act: o.act, avviso: o.avviso, occhi: camera.position, floorY: o.sc.floorY, corpo: o.corpo }), hud = creaHudFp({ root: o.root, map });
  const mappa = creaMappaFp({ root: o.root, map, tocco: sg.tocco, attivo: o.attivo });
  const pericoli = creaPericoli({ scene: o.sc.scene, floorY: o.sc.floorY, root: o.root });
  o.diorama.pilota!(true); camera.far = FAR; camera.rotation.order = 'YXZ'; o.sc.scene.add(camera);
  let px = o.hero0.x, pz = o.hero0.z, vel = 0, lat = 0, fase = 0, scossa = 0, caduta = 0, fov = 0, zoom = 1, clock = 0, swY = 0, swP = 0, cambio = 0, chiave = '', animPrima = '', nColpo = 0, frugaMandata = false;
  let arnese: Arnese = 'pugni', sprite = '', lama: Colore = BIANCO, magia: Colore = BIANCO, forma: string | undefined, tinta: [number, number, number] = [1, 1, 1];
  const qui = new THREE.Vector3(), tip = new THREE.Vector3(), dir = new THREE.Vector3();
  let bobX = 0, bobY = 0, magiaId = '', ultima: DungeonView | null = null;
  /** Per i test: i nemici più vicini (posizione, stato) e i bottini attorno. */
  const vicini = () => {
    const v = ultima; if (!v) return { nemici: [], bottini: [] };
    const d = (x: number, z: number) => Math.hypot(x - v.hero.x, z - v.hero.z);
    return { nemici: v.nemici.filter((n) => !n.alleato).map((n) => ({ id: n.id, tipo: n.tipo, x: n.x, z: n.z, anim: n.anim, vita: n.vita, d: d(n.x, n.z) })).sort((a, b) => a.d - b.d).slice(0, 6),
      bottini: v.bottini.map((b) => ({ id: b.id, tipo: b.tipo, x: b.x, z: b.z, vuoto: b.vuoto, d: d(b.x, b.z) })).sort((a, b) => a.d - b.d).slice(0, 6) };
  };
  const togliState = registerStateProvider('fp', () => ({ yaw: sg.yaw, pitch: sg.pitch, catturato: sg.catturato, tocco: sg.tocco, fov: camera.fov, zoom, near: camera.near, far: camera.far, arnese, k: mani.k, fruga: frugaMandata, hero: ultima ? { x: ultima.hero.x, z: ultima.hero.z } : null, ...vicini() }));
  registerTestHook('dungeonGuarda', (y, p) => { sg.yaw = Number(y) || 0; sg.pitch = Number(p) || 0; return true; });

  /** Cosa c'è in mano: cambia di rado, si rilegge quando cambia. */
  const inMano = (h: EroeVista) => {
    const k = `${h.magia ?? ''}|${h.arma ?? ''}`;
    if (k === chiave) return;
    if (chiave) cambio = 1;
    chiave = k;
    if (h.magia) {
      arnese = 'bacchetta';
      try { const sp = spellDef(h.magia); magia = colore(stile(h.magia)?.mano ?? coloreMagia(h.magia, sp.scuola)); forma = sp.forma; } catch { magia = BIANCO; forma = undefined; }
      return;
    }
    const def = h.arma && hasItem(h.arma) ? itemDef(h.arma) : null;
    arnese = !def ? 'pugni' : def.kind === 'arco' ? 'arco' : def.tipo && TIPI.has(def.tipo) ? def.tipo as Arnese : 'katana';
    lama = def?.colore ? coloreLama(palColor(def.colore)) : BIANCO;
    sprite = def?.unico && haPezzo(`u_${def.id}`) ? `u_${def.id}` : '';
  };

  return {
    get fermo() { return sg.verticale; },
    update(dt, t, p, v, punta) {
      const h = dungeonLink.posa ? { ...v.hero, ...dungeonLink.posa } as EroeVista : v.hero;
      ultima = v; sg.frame(o.attivo());
      // si entra frugando a mano (sim/dungeon/fruga.ts); l'autopilota dei test raccoglie da solo come sempre
      if (!frugaMandata && o.attivo() && !dungeonLink.autopilot) { o.act({ t: 'fruga' }); frugaMandata = true; }
      if (dungeonLink.autopilot > 0) sg.yaw = Math.atan2(-h.fx, -h.fz); // l'autopilot dei test guarda dove va
      clock += dt;
      const yaw = sg.yaw, rx = Math.cos(yaw), rz = -Math.sin(yaw);
      if (dt > 0) {
        const vx = (p.x - px) / dt, vz = (p.z - pz) / dt, k = Math.min(1, dt * 12);
        vel += (Math.sqrt(vx * vx + vz * vz) - vel) * k; lat += (vx * rx + vz * rz - lat) * k;
        px = p.x; pz = p.z;
      }
      fase += dt * vel * PASSO.freq;
      scossa *= Math.exp(-dt * 9);
      caduta = h.anim === 'morto' ? Math.min(1, caduta + dt / MORTE.durata) : 0;
      const forza = Math.min(1, vel / PASSO.vPiena), su = -Math.abs(Math.sin(fase)) * PASSO.y * forza, lato = Math.cos(fase) * PASSO.x * forza;
      const sch = h.anim === 'schiva' ? Math.sin(Math.PI * h.t) : 0, cad = caduta * caduta * (3 - 2 * caduta);
      const giro = h.anim === 'attacca' && h.stile === 'giro' ? Math.sin(Math.PI * h.t) * 0.05 : 0;
      camera.position.set(p.x + rx * lato, o.sc.floorY + OCCHI + su - sch * SCHIVA.giu - cad * (OCCHI - MORTE.y), p.z + rz * lato);
      camera.rotation.set(sg.pitch + Math.sin(t * 57) * 0.012 * scossa + cad * MORTE.pitch, yaw, Math.cos(t * 43) * 0.018 * scossa + sch * SCHIVA.rollio * -Math.sign(lat || 1) + cad * MORTE.rollio + giro);
      // Occhio d'aquila (perk): con l'arco teso del tutto la vista si stringe e il mouse rallenta, per mirare lontano
      inMano(h);
      const occhio = !!o.stato().runHero.perk?.zoomArco && arnese === 'arco' && h.anim === 'tende' && h.carica >= 1;
      zoom += ((occhio ? RPG.perk?.occhio.zoom ?? 1 : 1) - zoom) * Math.min(1, dt * 9);
      if (Math.abs(zoom - 1) < 0.004) zoom = 1;
      sg.scala = zoom;
      // FOV: 90° in orizzontale su ogni schermo largo, senza stirare in verticale
      const f = Math.max(FOV_MIN, Math.min(FOV_MAX, (2 * Math.atan(Math.tan((FOV_H * Math.PI) / 360) / camera.aspect) * 180) / Math.PI)) * zoom;
      if (f !== fov || camera.fov !== f) { fov = f; camera.fov = f; camera.updateProjectionMatrix(); }
      o.diorama.yaw = yaw; o.sc.scene.userData.camYaw = yaw; // gli effetti piatti (unici_fx, mausoleo_fx) si girano verso la camera
      // ---- mani ----
      if (h.anim === 'attacca' && animPrima !== 'attacca') nColpo++;
      animPrima = h.anim;
      const sc = sg.scarto();
      swY = (swY + sc.dy) * Math.exp(-dt * 10); swP = (swP + sc.dp) * Math.exp(-dt * 10); cambio = Math.max(0, cambio - dt / CAMBIO);
      const bob = forza * (vel > 4.6 ? 1.6 : 1), luce = o.sc.luceQui(p.x, p.z);
      for (let i = 0; i < 3; i++) { // la tinta della stanza, a gradini: le mani stanno nella stessa luce di quello che le circonda
        const voluta = Math.round(Math.min(1.12, 0.66 + luce[i]! * 0.4) * 10) / 10;
        tinta[i] = tinta[i]! + (voluta - tinta[i]!) * Math.min(1, dt * 6);
      }
      bobX = Math.cos(fase) * MANI_PASSO.x * bob; bobY = -Math.abs(Math.sin(fase)) * MANI_PASSO.y * bob - scossa * 0.03; magiaId = h.magia ?? '';
      const pezzi = posa({
        h, arnese, sprite, lama, magia, magiaId: h.magia ?? '', forma, punta, clock, nColpo, u: mani.u, portata: o.stato().hero.arma.portata,
        bobX, bobY,
        swayX: Math.max(-0.05, Math.min(0.05, swY * 0.3)), swayY: Math.max(-0.04, Math.min(0.04, -swP * 0.25)),
        giu: Math.max(Math.sin(Math.PI * cambio), sch * 0.8, cad, fruga.aperta ? 0.7 : 0),
      });
      mani.disegna(pezzi, tinta);
      // ---- alla Skyrim: bersaglio, mappa, pericoli, bottino ----
      for (const e of v.eventi) if (e.t === 'colpo' && e.su === 'nemico' && e.id !== undefined && (e.eroe === undefined || e.eroe === v.io)) hud.colpito(e.id);
      hud.update(v, t, yaw, camera.position);
      mappa.update(v, yaw);
      pericoli.update(v, t, yaw);
      fruga.update(v, yaw, sg.pitch);
      avvisi.update(dt, v, yaw, map, { croce: !!h.magia || arnese === 'arco', rosso: hud.mirato >= 0 });
    },
    punta() {
      const p = puntaRaggio({ magiaId, u: mani.u, bobX, bobY }), d = 0.6, a = 2 * Math.tan((camera.fov * Math.PI) / 360) * d;
      camera.updateMatrixWorld();
      return tip.set(p.x * a, (p.y - 0.5) * a, -d).applyMatrix4(camera.matrixWorld);
    },
    sguardo() { return camera.getWorldDirection(dir); },
    mischia(v) {
      const s = o.stato(), h = v.hero, a = s.hero.arma;
      if (h.anim === 'morto' || h.magia || a.kind === 'arco' || a.portata <= 0) return null;
      return { st: swingStyle(a, h.anim === 'carica' && h.carica >= 1), portata: a.portata, fx: -Math.sin(sg.yaw), fz: -Math.cos(sg.yaw), r: s.runHero.raggio, forte: h.anim === 'carica' };
    },
    fine() { corpo.update(sg.yaw, caduta > 0); },
    mira(v, preme, h) {
      if (!preme && !ATTIVE.has(h.act) && !(h.raffica > 0)) return null;
      const fx = -Math.sin(sg.yaw), fz = -Math.cos(sg.yaw);
      if (sg.tocco) {
        // dal telefono il colpo si aggancia al nemico davanti, anche in alto e in basso: al centro del suo corpo
        let best: { x: number; z: number; d: number; y: number } | null = null, bd = AIUTO_M;
        const s = o.stato();
        for (const n of v.nemici) {
          if (n.alleato || n.anim === 'morto' || n.invisibile) continue;
          const dx = n.x - v.hero.x, dz = n.z - v.hero.z, d = Math.sqrt(dx * dx + dz * dz);
          if (d < 1e-3 || d >= bd || (dx * fx + dz * fz) / d < COS_AIUTO || !lineOfSight(map, v.hero.x, v.hero.z, n.x, n.z)) continue;
          const e = s.enemies.find((x) => x.id === n.id), q = e ? quotaNemico(s, e) : [0, 1.8];
          bd = d; best = { x: dx, z: dz, d, y: (q[0]! + q[1]!) / 2 };
        }
        if (best) return { m: aimIndex(best.x, best.z), p: alzoIndex(Math.atan2(best.y - OCCHI, best.d)) };
      }
      return { m: aimIndex(fx, fz), p: alzoIndex(sg.pitch) };
    },
    muovi(f) {
      if (!f.roll || f.mx * f.mx + f.my * f.my > 0.01) return f;
      return { ...f, mx: Math.sin(sg.yaw), my: Math.cos(sg.yaw) };
    },
    colpito() { scossa = 1; avvisi.colpito(); },
    tasto: (e) => fruga.tasto(e),
    davanti() { return qui.set(camera.position.x - Math.sin(sg.yaw) * 1.5, camera.position.y + 0.25, camera.position.z - Math.cos(sg.yaw) * 1.5); },
    barre(l) { return l.filter((b) => b.ally && lineOfSight(map, camera.position.x, camera.position.z, b.pos.x, b.pos.z)); },
    clic: () => sg.clic(),
    riprendi: () => sg.riprendi(),
    dispose() {
      togliState(); sg.dispose(); mani.dispose(); avvisi.dispose(); fruga.dispose(); hud.dispose(); mappa.dispose(); pericoli.dispose();
      o.sc.scene.remove(camera); camera.far = far0; camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0); o.diorama.pilota!(false);
    },
  };
}
