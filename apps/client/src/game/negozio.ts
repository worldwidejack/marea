// Il negozio dei mobili del Borgo (#265). Fuori: una bottega sullo slargo della prima fontana (borgo.json `negozio`, la scrive
// tools/borgo_pianta.py) con la tenda a strisce, la vetrina e l'insegna MOBILI. Dentro: il template `negozio` oltre il mare (come i
// giardini), la stessa stanza «da plastico» della casa (game/interno.ts: camera fissa sopra l'ingresso, corridoio, buio attorno), il
// mobiliere dietro al bancone, i mobili del giorno sulle pedane e sul muro, i campioni di carta da parati appesi al muro e quelli di pavimento per terra.
// I mobili in mostra cambiano ogni giorno (mezzanotte di Roma, sim `vetrinaDelGiorno`, #384): uguali per tutti, pescati da tutto mobili.json,
// e si compra solo quello che è esposto (lo controlla anche il server). Il banco del mobiliere dice cosa c'è oggi e quando cambia.
// Si entra camminando contro la porta (o A), si esce in fondo al corridoio; davanti a un pezzo A apre la scheda: COMPRA (monete) → il
// mobile va nel magazzino di casa (ARREDA), pavimento e carta si mettono subito. Prezzi e righe: mobili.json e borgo.json.
// Tutto questo sta in un chunk (main.ts lo scarica subito dopo l'avvio, TECH §5): la bottega compare un attimo dopo il mondo.
import * as THREE from 'three';
import { BORGO, MOBILI, MOBILI_VETRINA } from '@marea/content';
import type { MobileDef, StanzaFinitura } from '@marea/content';
import { MAX_LIVELLO_CASA, ampliatoOggi, casaDi, finoAMezzanotte, giornoRoma, livelloCasa, possiedeFinitura, prossimoAmpliamento, vetrinaDelGiorno } from '@marea/sim';
import { possiedePala } from '@marea/sim/economy/pala.ts';
import { INSETTI, RETINO } from '@marea/content/insetti.ts';
import { insettiOf, possiedeRetino } from '@marea/sim/economy/insetti.ts';
import { CANNA, PESCI } from '@marea/content/pesci.ts';
import { pesciOf, possiedeCanna } from '@marea/sim/economy/pesci.ts';
import type { LotState } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import type { Velo } from '../ui/velo.ts';
import type { Part } from '../rpg/dungeon_kit.ts';
import { ApiError } from '../net/api.ts';
import type { Api } from '../net/api.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';
import { mobileGeo } from '../render/mobili.ts';
import { PAL, el } from '../ui/style.ts';
import { fmtDur } from '../ui/sheet.ts';
import { pixIcon } from '../ui/icons.ts';
import { createAvatar } from './avatar.ts';
import type { Avatar } from './avatar.ts';
import { NASCOSTI_DENTRO, costruisciStanza, createInquadratura, texture } from './interno.ts';
import type { Pianta } from './interno.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { createPalaBorgo } from './pala.ts';
import { createInsettiBorgo } from './insetti.ts';
import { insettoCanvas } from '../ui/insetti_sprite.ts';
import { createPescaBorgo } from './pesca.ts';
import { pesceCanvas } from '../ui/pesci_sprite.ts';

export type Negozio = {
  tick(a: boolean): boolean; update(dt: number): void; readonly dentro: boolean;
  /** Si sta pescando (#457, game/pesca.ts): il mondo sta fermo. */
  pescando(): boolean;
  /** La scritta sotto A della pesca (null = non c'entra). */
  azionePesca(): string | null;
};
type Pezzo = { kind: 'mobile' | 'pavimento' | 'carta' | 'banco' | 'pala' | 'retino' | 'canna'; id: string; nome: string; monete: number; x: number; z: number; fx: number; fz: number };

const ND = BORGO.negozioDentro, [X0, Z0, X1] = ND.pavimento, [CX, C0, C1] = ND.corridoio;
const PIANTA: Pianta = { pavimento: ND.pavimento, corridoio: ND.corridoio, altezza: ND.altezza };
const RAGGIO = 2.2, VICINO = 1.7;
/** I posti in fila (pedane, quadri a muro, campioni di pavimento): una cella sì e una no, a partire dalla seconda; l'ultima cella è del banco. */
const POSTI = Math.floor((X1 - X0 - 1) / 2), posto = (i: number): number => X0 + 1 + i * 2;
const CSS = `
#mzNegozioBar { position: absolute; left: 8px; right: 8px; top: calc(max(8px, env(safe-area-inset-top)) + 60px); display: none; justify-content: center; z-index: 15; pointer-events: none; }
#mzNegozioBar.on { display: flex; }
#mzNegozioBar .t { padding: 4px 10px; background: rgba(46,30,20,.93); border: 2px solid ${PAL.legnoChiaro}; color: ${PAL.sabbiaChiara}; font: bold 14px ui-monospace, Menlo, monospace; text-align: center; }
#mzNegozio .prezzo { margin: 8px 0; color: ${PAL.sabbia}; font-size: 15px; }
#mzNegozio .prezzo b { color: ${PAL.giallo}; }
#mzNegozio .prezzo .manca { color: ${PAL.rosso}; }
#mzNegozio h3 { margin: 12px 0 2px; color: ${PAL.giallo}; font: bold 14px ui-monospace, Menlo, monospace; }
`;

/** La bottega vista da fuori (davanti verso +Z): muri chiari, tetto rosso, vetrina, porta, tenda a strisce, insegna (a parte, con la scritta). */
function bottega(): THREE.BufferGeometry {
  const g: THREE.BufferGeometry[] = [], b = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  g.push(painted(b(4.4, 3.2, 3.6), P.pietraChiara, M(0, 1.6, 0)), painted(b(4.6, 0.3, 3.8), P.pietra, M(0, 0.15, 0)));
  for (const s of [-1, 1]) g.push(painted(b(2.6, 0.18, 4.2), P.rosso, M(s * 1.15, 3.75, 0, 0, 0, s * -0.5)));
  g.push(painted(b(0.3, 0.3, 4.3), P.legnoScuro, M(0, 4.3, 0)));
  g.push(painted(b(1.1, 2.2, 0.12), P.legno, M(-1.2, 1.1, 1.82)), painted(b(0.12, 0.12, 0.16), P.giallo, M(-0.85, 1.1, 1.9)));
  g.push(painted(b(1.9, 1.5, 0.1), P.legnoScuro, M(0.9, 1.55, 1.82)), painted(b(1.7, 1.3, 0.12), P.acquaBassa, M(0.9, 1.55, 1.84)));
  for (let i = 0; i < 6; i++) g.push(painted(b(0.74, 0.08, 1.0), i % 2 ? P.pietraChiara : P.arancio, M(-1.85 + i * 0.74, 2.62, 2.25, 0.35, 0, 0)));
  g.push(painted(b(0.6, 0.5, 0.5), P.legnoChiaro, M(0.9, 0.95, 2.0)), painted(b(0.36, 0.3, 0.3), P.rosso, M(0.9, 1.35, 2.0))); // in vetrina
  return merged(g);
}
/** L'insegna MOBILI: una tavola con la scritta dipinta a pixel (texture nearest, colori della palette). */
function insegna(): THREE.Mesh {
  const c = document.createElement('canvas'); c.width = 64; c.height = 16;
  const x = c.getContext('2d')!;
  x.fillStyle = P.legnoScuro; x.fillRect(0, 0, 64, 16); x.fillStyle = P.giallo; x.font = 'bold 12px monospace'; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText('MOBILI', 32, 8.5);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: t }));
  m.position.set(0, 3.3, 1.86);
  return m;
}

export function createNegozio(o: { world: GameWorld; renderer: Renderer; loader: Loader; root: HTMLElement; hud: Hud; velo: Velo; api: Api | null; getLot(): LotState | null; setLot(l: LotState): void }): Negozio {
  const w = o.world, arch = w.archipelago, T = arch.tile;
  const porto = arch.places.find((p) => p.role === 'porto'), place = arch.places.find((p) => p.role === 'negozio');
  if (!porto || !place) return { tick: () => false, update: () => {}, dentro: false, pescando: () => false, azionePesca: () => null };
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  /** L'ora del server (l'economia non usa mai l'orologio del client); senza collegamento l'orologio locale, solo per mostrare qualcosa. */
  const adesso = (): number => o.api?.serverNow() ?? Date.now();

  // ——— fuori: la bottega sullo slargo, girata verso la porta ———
  const N = BORGO.negozio, fuori = new THREE.Group(); fuori.name = 'negozio_mobili';
  const bx = (porto.origin[0] + N.at[0] + 0.5) * T, bz = (porto.origin[1] + N.at[1] + 0.5) * T;
  const corpo = new THREE.Mesh(bottega(), vc); corpo.castShadow = corpo.receiveShadow = true;
  fuori.add(corpo, insegna()); fuori.position.set(bx, w.groundY(bx, bz), bz); fuori.rotation.y = N.rot + Math.PI; // il modello guarda +Z, `rot` è il verso −Z
  w.scene.add(fuori);
  const px = (porto.origin[0] + N.porta[0] + 0.5) * T, pz = (porto.origin[1] + N.porta[1] + 0.5) * T;
  const vx = bx - px, vz = bz - pz, vl = Math.hypot(vx, vz) || 1, verso = { x: vx / vl, z: vz / vl };
  const muro = { x: px + verso.x * 0.9, z: pz + verso.z * 0.9 };

  // ——— dentro: la stanza del negozio, gli espositori, il bancone col mobiliere ———
  const ox = place.origin[0] * T, oz = place.origin[1] * T;
  const fin = (l: readonly StanzaFinitura[], id: string) => l.find((f) => f.id === id) ?? l[0]!;
  const { group: dentroG } = costruisciStanza(T, PIANTA, fin(BORGO.pavimenti, ND.finitura.pavimento), fin(BORGO.carte, ND.finitura.carta));
  dentroG.name = 'negozio_dentro'; dentroG.visible = false;
  dentroG.position.set(ox, w.groundY(ox + (X0 + 1) * T, oz + (Z0 + 1) * T), oz);
  w.scene.add(dentroG);
  const pezzi: Pezzo[] = [], pezziFissi: Pezzo[] = [], pezziGiorno: Pezzo[] = [], parti: THREE.BufferGeometry[] = [];
  const cella = (cx: number, cz: number) => ({ x: (cx + 0.5) * T, z: (cz + 0.5) * T });
  // fisse: le pedane (vuote o piene) e il bancone; tutto quello che si vende cambia col giorno (monta)
  for (let i = 0; i < Math.min(MOBILI_VETRINA.terra, POSTI); i++) {
    const c = cella(posto(i), Z0 + 2);
    parti.push(painted(new THREE.CylinderGeometry(0.95, 1.05, 0.2, 8), P.pietra, M(c.x, 0.1, c.z)));
  }
  // il bancone nell'ultima cella a destra, col registratore di cassa; dietro il mobiliere, e accanto l'espositore fisso della pala (#438)
  const bc = cella(X1 - 1, Z0 + 2);
  parti.push(painted(new THREE.BoxGeometry(1.4, 1.0, 3.0), P.legno, M(bc.x - 0.4, 0.5, bc.z + 0.6)), painted(new THREE.BoxGeometry(1.5, 0.1, 3.1), P.legnoChiaro, M(bc.x - 0.4, 1.05, bc.z + 0.6)));
  parti.push(painted(new THREE.BoxGeometry(0.5, 0.35, 0.4), P.arancio, M(bc.x - 0.4, 1.28, bc.z)), painted(new THREE.BoxGeometry(0.3, 0.08, 0.2), P.neroCaldo, M(bc.x - 0.4, 1.48, bc.z)));
  parti.push(painted(new THREE.CylinderGeometry(0.45, 0.5, 0.16, 8), P.legnoScuro, M(bc.x - 0.4, 0.08, bc.z + 2.65)), painted(new THREE.CylinderGeometry(0.05, 0.05, 1.15, 6), P.legnoChiaro, M(bc.x - 0.4, 0.72, bc.z + 2.65, 0, 0, 0.18)));
  parti.push(painted(new THREE.BoxGeometry(0.26, 0.05, 0.08), P.legnoScuro, M(bc.x - 0.5, 1.28, bc.z + 2.65, 0, 0, 0.18)), painted(new THREE.BoxGeometry(0.28, 0.34, 0.05), P.pietra, M(bc.x - 0.3, 0.24, bc.z + 2.65, 0, 0, 0.18)));
  pezziFissi.push({ kind: 'banco', id: 'banco', nome: 'Il mobiliere', monete: 0, x: bc.x - 0.4, z: bc.z + 0.6, fx: bc.x - 1.9, fz: bc.z + 0.6 }); // davanti al banco
  pezziFissi.push({ kind: 'pala', id: BORGO.pala.id, nome: BORGO.pala.nome, monete: BORGO.pala.monete, x: bc.x - 0.4, z: bc.z + 2.65, fx: bc.x - 1.9, fz: bc.z + 2.65 });
  // e dopo la pala l'espositore del retino (#445): asta, cerchio e rete
  const rz = bc.z + 4.3;
  parti.push(painted(new THREE.CylinderGeometry(0.45, 0.5, 0.16, 8), P.legnoScuro, M(bc.x - 0.4, 0.08, rz)), painted(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6), P.legnoChiaro, M(bc.x - 0.4, 0.8, rz, 0, 0, -0.12)));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; parti.push(painted(new THREE.BoxGeometry(0.16, 0.03, 0.03), P.pietra, M(bc.x - 0.58 + Math.cos(a) * 0.2, 1.62 + Math.sin(a) * 0.2, rz, 0, 0, a + Math.PI / 2)), painted(new THREE.BoxGeometry(0.165, 0.035, 0.035), P.sabbiaChiara, M(bc.x - 0.58 + Math.cos(a) * 0.2, 1.62 + Math.sin(a) * 0.2, rz + 0.015, 0, 0, a + Math.PI / 2))); }
  parti.push(painted(new THREE.CylinderGeometry(0.19, 0.12, 0.16, 8), P.pietraChiara, M(bc.x - 0.58, 1.62, rz + 0.08, -Math.PI / 2)), painted(new THREE.CylinderGeometry(0.12, 0.04, 0.16, 8), P.pietraChiara, M(bc.x - 0.58, 1.59, rz + 0.23, -Math.PI / 2)));
  pezziFissi.push({ kind: 'retino', id: RETINO.id, nome: RETINO.nome, monete: RETINO.monete, x: bc.x - 0.4, z: rz, fx: bc.x - 1.9, fz: rz });
  // e dall'altra parte del bancone la canna da pesca (#457), dritta sul suo piedistallo col mulinello
  const cz = bc.z - 3.2;
  parti.push(painted(new THREE.CylinderGeometry(0.45, 0.5, 0.16, 8), P.legnoScuro, M(bc.x - 0.4, 0.08, cz)), painted(new THREE.CylinderGeometry(0.035, 0.045, 0.6, 6), P.legnoScuro, M(bc.x - 0.4, 0.45, cz, 0, 0, 0.08)));
  parti.push(painted(new THREE.CylinderGeometry(0.015, 0.03, 1.5, 5), P.legnoChiaro, M(bc.x - 0.49, 1.48, cz, 0, 0, 0.08)), painted(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8), P.pietra, M(bc.x - 0.33, 0.55, cz, 0, 0, Math.PI / 2)));
  parti.push(painted(new THREE.SphereGeometry(0.07, 6, 4), P.rosso, M(bc.x - 0.62, 1.95, cz)));
  pezziFissi.push({ kind: 'canna', id: CANNA.id, nome: CANNA.nome, monete: CANNA.monete, x: bc.x - 0.4, z: cz, fx: bc.x - 1.9, fz: cz });
  const fisso = new THREE.Mesh(merged(parti), vc); fisso.castShadow = fisso.receiveShadow = true; dentroG.add(fisso);

  // la merce del giorno (#384, #393): sulle pedane i mobili a terra, al muro in cornice le carte da parati e (dopo) i mobili a parete, per terra i
  // campioni di pavimento. Si rifà quando cambia il giorno e quando arrivano i modelli 3D (Blender, `mob_<id>`): finché non ci sono, la scatola o la
  // forma procedurale di render/mobili.ts.
  const giornoG = new THREE.Group(); giornoG.name = 'negozio_giorno'; dentroG.add(giornoG);
  let giornoMostrato = 0, token = 0, modelli: typeof import('../render/mobili_modelli.ts') | null = null;
  const monta = (g: number, vivi: ReadonlyMap<string, Part[]>) => {
    for (const c of giornoG.children.slice()) { // le geometrie dei modelli sono in cache: vivono nei gruppi, non qui; le texture dei campioni sì (si ridipingono)
      giornoG.remove(c);
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); if (c.userData['campione']) { const m = c.material as THREE.MeshLambertMaterial; m.map?.dispose(); m.dispose(); } }
    }
    pezziGiorno.length = 0;
    const v = vetrinaDelGiorno(g), geo: THREE.BufferGeometry[] = [];
    const metti = (m: MobileDef, x: number, y: number, z: number) => {
      const [cw, cd] = m.posto === 'terra' ? m.celle ?? [1, 1] : [1, 1], sc = cw * cd > 1 ? 1.7 / (2 * Math.max(cw, cd)) : 1; // un mobile da più celle sta in piccolo sulla pedana
      const ps = vivi.get(m.id);
      if (ps && modelli) { const mg = modelli.gruppoModello(ps); mg.position.set(x, y, z); mg.scale.setScalar(sc); giornoG.add(mg); return; }
      const gg = mobileGeo(m.forma, m.colori, m); gg.scale(sc, sc, sc); gg.translate(x, y, z); geo.push(gg);
    };
    const def = (id: string) => MOBILI.find((m) => m.id === id);
    v.terra.slice(0, POSTI).forEach((id, i) => {
      const m = def(id); if (!m) return;
      const c = cella(posto(i), Z0 + 2);
      metti(m, c.x, 0.2, c.z);
      pezziGiorno.push({ kind: 'mobile', id: m.id, nome: m.nome, monete: m.monete, x: c.x, z: c.z, fx: c.x, fz: c.z + 1.5 });
    });
    // al muro: prima le carte da parati appese in cornice, poi i mobili a parete
    const carte = v.carte.flatMap((id) => BORGO.carte.find((f) => f.id === id) ?? []).slice(0, POSTI);
    carte.forEach((f, i) => {
      const c = cella(posto(i), Z0), x = c.x, z = Z0 * T;
      const t = texture(f); t.repeat.set(1.2, 1.6);
      const pan = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), new THREE.MeshLambertMaterial({ map: t })); pan.position.set(x, 1.2, z + 0.08); pan.userData['campione'] = true; giornoG.add(pan); // davanti alla cornice
      geo.push(painted(new THREE.BoxGeometry(1.4, 1.8, 0.06), P.legnoScuro, M(x, 1.2, z + 0.01)));
      pezziGiorno.push({ kind: 'carta', id: f.id, nome: f.nome, monete: f.monete ?? 0, x, z, fx: x, fz: z + 1.6 });
    });
    v.pavimenti.flatMap((id) => BORGO.pavimenti.find((f) => f.id === id) ?? []).slice(0, POSTI).forEach((f, i) => {
      const c = cella(posto(i), Z0 + 4), t = texture(f); t.repeat.set(1, 1);
      const tile = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.6), new THREE.MeshLambertMaterial({ map: t })); tile.position.set(c.x, 0.06, c.z); tile.receiveShadow = true; tile.userData['campione'] = true; giornoG.add(tile);
      pezziGiorno.push({ kind: 'pavimento', id: f.id, nome: f.nome, monete: f.monete ?? 0, x: c.x, z: c.z, fx: c.x, fz: c.z + 1.4 });
    });
    v.parete.slice(0, Math.max(0, POSTI - carte.length)).forEach((id, j) => {
      const m = def(id); if (!m) return;
      const c = cella(posto(carte.length + j), Z0), z = Z0 * T;
      metti(m, c.x, 0, z);
      pezziGiorno.push({ kind: 'mobile', id: m.id, nome: m.nome, monete: m.monete, x: c.x, z, fx: c.x, fz: z + 1.6 });
    });
    if (geo.length) { const mesh = new THREE.Mesh(merged(geo), vc); mesh.castShadow = mesh.receiveShadow = true; giornoG.add(mesh); }
    pezzi.length = 0; pezzi.push(...pezziFissi, ...pezziGiorno);
  };
  const allestisci = (g: number) => {
    giornoMostrato = g; const t = ++token;
    monta(g, new Map());
    const v = vetrinaDelGiorno(g);
    void import('../render/mobili_modelli.ts').then(async (mm) => {
      const vivi = await mm.modelliMobili([...v.terra, ...v.parete]);
      if (t !== token || !vivi.size) return;
      modelli = mm; monta(g, vivi);
    }).catch(() => { /* senza modelli restano le scatole */ });
  };
  allestisci(giornoRoma(adesso()));
  let ciro: Avatar | null = null;
  const ciroPos = { x: ox + bc.x + 0.6, z: oz + bc.z + 0.6 };
  void createAvatar({ loader: o.loader, look: { pelle: 2, capelli: 5, coloreCapelli: 3, vestito: 4, cappello: 0 }, x: ciroPos.x, z: ciroPos.z }).then((av) => {
    av.setGround(w.groundY); av.object.name = 'mobiliere'; av.object.visible = false; w.scene.add(av.object); ciro = av;
  }).catch(() => { /* senza mobiliere il negozio funziona lo stesso */ });

  // ——— dentro / fuori, camera, cose nascoste ———
  const inq = createInquadratura({ world: w, renderer: o.renderer });
  let dentro = false;
  const nascosti: THREE.Object3D[] = [];
  const qui = () => { const a = w.avatar.state, p = arch.placeAt(a.x, a.z); return w.mode === 'walk' && p?.role === 'negozio'; };
  const prima = w.dopoCull;
  w.dopoCull = () => {
    prima?.();
    for (const n of nascosti) n.visible = true;
    nascosti.length = 0;
    const ora = qui();
    if (ora !== dentro) { dentro = ora; if (ora) inq.entra(ox, oz, PIANTA); else inq.esce(); }
    dentroG.visible = dentro; if (ciro) ciro.object.visible = dentro;
    if (!dentro) return;
    const via = (n: THREE.Object3D | undefined | null) => { if (n && n.visible) { n.visible = false; nascosti.push(n); } };
    via(w.scene.getObjectByName('vista_negozio')); via(w.water.mesh);
    for (const n of NASCOSTI_DENTRO) via(w.scene.getObjectByName(n));
  };

  // ——— entrare e uscire (come le case: camminando contro la porta o con A, dietro il velo) ———
  const entraDentro = () => { const c = cella(CX, C0); w.aPiedi(ox + c.x, oz + c.z - 0.2, 0); };
  const esciFuori = () => w.aPiedi(px - verso.x * 2.5, pz - verso.z * 2.5, Math.atan2(-verso.x, verso.z));
  const passa = (fn: () => void, poi?: () => void) => void o.velo.passa(fn).then((ok) => { if (ok) poi?.(); });

  // ——— bottone (A), barra, scheda ———
  const btn = el('button', 'mz mz-play'); btn.id = 'mzNegozioBtn'; btn.type = 'button';
  const bar = el('div', 'mz'); bar.id = 'mzNegozioBar';
  const sheet = el('div', 'mz mz-sheet'); sheet.id = 'mzNegozio';
  o.root.append(btn, bar, sheet);
  for (const e of [btn, bar, sheet]) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation());
  type Vicino = { kind: 'porta' } | { kind: 'esci' } | { kind: 'pezzo'; p: Pezzo };
  let near: Vicino | null = null, aperto: Pezzo | null = null, busy = false, consegnati = 0, aWas = false, nota = '', comprati = 0, ultimo = 0, conferma = false, ampliati = 0, confermaT = 0;
  const libero = () => w.mode === 'walk' && !w.frozen && !w.race.on && !o.velo.attivo;
  const trova = (): Vicino | null => {
    if (!libero()) return null;
    const f = w.avatar.state;
    if (Math.hypot(f.x - px, f.z - pz) < RAGGIO) return { kind: 'porta' };
    if (!dentro) return null;
    const cz = (f.z - oz) / T;
    if (cz > C1 - 0.9) return { kind: 'esci' };
    let best: Pezzo | null = null, bd = VICINO;
    for (const p of pezzi) { const d = Math.hypot(f.x - ox - p.fx, f.z - oz - p.fz); if (d < bd) { bd = d; best = p; } }
    return best ? { kind: 'pezzo', p: best } : null;
  };
  const chiudi = () => { aperto = null; nota = ''; conferma = false; sheet.classList.remove('on'); sheet.replaceChildren(); };
  const gia = (p: Pezzo): boolean => p.kind === 'pala' ? possiedePala(o.getLot()) : p.kind === 'retino' ? possiedeRetino(o.getLot()) : p.kind === 'canna' ? possiedeCanna(o.getLot()) : (p.kind === 'pavimento' || p.kind === 'carta') && possiedeFinitura(o.getLot(), p.kind, p.id);
  /** Le descrizioni dei mobili e delle finiture: si scaricano alla prima scheda, non pesano sull'avvio. */
  let testi: Record<string, string> | null = null;
  const caricaTesti = () => {
    if (!testi) {
      testi = {};
      void Promise.all([
        import('@marea/content/mobili_testi.json', { with: { type: 'json' } }).then((m) => (m.default as { testi: Record<string, string> }).testi).catch(() => ({})),
        import('@marea/content/finiture_testi.json', { with: { type: 'json' } }).then((m) => (m.default as { testi: Record<string, string> }).testi).catch(() => ({})),
      ]).then(([m1, m2]) => { testi = { ...m1, ...m2 }; ridisegna(); }).catch(() => {});
    }
  };
  const ridisegna = () => { if (aperto) scheda(aperto); };
  const celleDi = (m: MobileDef): number => m.posto === 'parete' ? 1 : (m.celle?.[0] ?? 1) * (m.celle?.[1] ?? 1);
  const dove = (m: MobileDef): string => m.posto === 'parete' ? 'Si appende al muro' : celleDi(m) > 1 ? `Per terra: occupa ${celleDi(m)} celle` : 'Per terra: occupa una cella';
  const testata = (titolo: string): HTMLElement => {
    const testa = el('div', 'mz-row'); testa.style.alignItems = 'center';
    const x = el('button', 'mz-x', '×'); x.type = 'button'; x.addEventListener('click', chiudi);
    const t = el('b', '', titolo); t.style.flex = '1'; t.style.color = PAL.giallo; testa.append(t, x);
    return testa;
  };
  /** Il banco: cosa c'è in vetrina oggi, la pala di Borgo Marea e gli ampliamenti della casa. */
  function banco(): void {
    const v = vetrinaDelGiorno(giornoRoma(adesso())), n = v.terra.length + v.parete.length + v.carte.length + v.pavimenti.length;
    const corpo: Node[] = [testata('IL MOBILIERE')];
    corpo.push(el('div', 'prezzo', n ? `Oggi in vetrina: ${v.terra.length + v.parete.length} mobili, ${v.carte.length} carte da parati e ${v.pavimenti.length} pavimenti. Vendo solo quelli: gli altri tornano un altro giorno.` : 'Oggi la vetrina è vuota.'));
    corpo.push(el('div', 'prezzo', `Merce nuova fra ${fmtDur(finoAMezzanotte(adesso()) / 1000)}.`));
    const l = o.getLot(), haPala = possiedePala(l), pPala = pezziFissi.find((x) => x.kind === 'pala')!;
    corpo.push(el('h3', '', 'STRUMENTI · LA PALA'));
    corpo.push(el('div', 'prezzo', `Scava buche a Borgo Marea per seppellire o dissotterrare oggetti, mobili e monete (${BORGO.pala.monete} monete, peso 0 nello zaino).`));
    const bp = el('button', 'mz-btn', ''); bp.type = 'button'; bp.dataset['act'] = 'compra-pala';
    bp.append(el('span', '', haPala ? 'Ce l’hai già nello zaino' : !o.api ? 'Serve il collegamento' : 'COMPRA LA PALA'), el('b', '', haPala ? '✓' : `${BORGO.pala.monete}`));
    bp.disabled = haPala || busy || !o.api;
    bp.addEventListener('click', () => void compra(pPala));
    corpo.push(bp);
    // il retino e la collezione degli insetti (#445): gli insetti dello zaino si consegnano qui, gratis, e diventano tuoi nel Diario
    const haRetino = possiedeRetino(l), pRet = pezziFissi.find((x) => x.kind === 'retino')!;
    corpo.push(el('h3', '', 'STRUMENTI · IL RETINO'));
    corpo.push(el('div', 'prezzo', `Per catturare gli insetti di Borgo Marea (${RETINO.monete} monete, peso 0 nello zaino). Si cambia attrezzo col bottone accanto o col tasto Q.`));
    const br = el('button', 'mz-btn', ''); br.type = 'button'; br.dataset['act'] = 'compra-retino';
    br.append(el('span', '', haRetino ? 'Ce l’hai già nello zaino' : !o.api ? 'Serve il collegamento' : 'COMPRA IL RETINO'), el('b', '', haRetino ? '✓' : `${RETINO.monete}`));
    br.disabled = haRetino || busy || !o.api;
    br.addEventListener('click', () => void compra(pRet));
    corpo.push(br);
    // la canna e la collezione dei pesci (#457): come gli insetti
    const haCanna = possiedeCanna(l), pCan = pezziFissi.find((x) => x.kind === 'canna')!;
    corpo.push(el('h3', '', 'STRUMENTI · LA CANNA DA PESCA'));
    corpo.push(el('div', 'prezzo', `Per pescare dalle rive di Borgo Marea e dalla barca ferma in mare aperto (${CANNA.monete} monete, peso 0 nello zaino). Si mette in mano col bottone dell’attrezzo o col tasto Q.`));
    const bc2 = el('button', 'mz-btn', ''); bc2.type = 'button'; bc2.dataset['act'] = 'compra-canna';
    bc2.append(el('span', '', haCanna ? 'Ce l’hai già nello zaino' : !o.api ? 'Serve il collegamento' : 'COMPRA LA CANNA'), el('b', '', haCanna ? '✓' : `${CANNA.monete}`));
    bc2.disabled = haCanna || busy || !o.api;
    bc2.addEventListener('click', () => void compra(pCan));
    corpo.push(bc2);
    corpo.push(...collezione(l), ...collezionePesci(l));
    // gli ampliamenti della casa (#386): uno alla volta, costano tanto; per non sbagliare dal telefono si conferma con un secondo tocco
    const liv = livelloCasa(casaDi(l)), prossimo = prossimoAmpliamento(liv);
    corpo.push(el('h3', '', 'INGRANDISCI LA CASA'));
    if (!prossimo || !l) corpo.push(el('div', 'prezzo', 'La tua casa è grande al massimo: non c’è altro da ampliare.'));
    else {
      corpo.push(el('div', 'prezzo', `Ampliamento ${liv + 1} di ${MAX_LIVELLO_CASA}: `), el('div', 'prezzo', prossimo.desc));
      corpo[corpo.length - 2]!.appendChild(el('b', '', prossimo.nome));
      const serve = prossimo.monete, ho = l.monete;
      const d = el('div', 'prezzo'); d.append(el('span', '', 'Prezzo '), el('b', '', `${serve} monete`), el('span', ho >= serve ? 'ok' : 'manca', ho >= serve ? ` · ne hai ${ho} ✓` : ` · ti mancano ${serve - ho}`));
      corpo.push(d);
      const fattoOggi = ampliatoOggi(l, adesso());
      if (fattoOggi) corpo.push(el('div', 'prezzo', `Hai già fatto un ampliamento oggi. Il mobiliere riprenderà i lavori domani (fra ${fmtDur(finoAMezzanotte(adesso()) / 1000)}).`));
      const b = el('button', 'mz-btn', ''); b.type = 'button'; b.dataset['act'] = 'amplia';
      b.append(el('span', '', !o.api ? 'Serve il collegamento' : fattoOggi ? 'TORNA DOMANI' : conferma ? 'SICURO? TOCCA ANCORA' : 'AMPLIA'), el('b', '', !fattoOggi && conferma ? '✓' : ''));
      b.disabled = busy || !o.api || fattoOggi;
      b.addEventListener('click', () => void amplia(liv));
      corpo.push(b);
    }
    if (nota) corpo.push(el('div', 'prezzo', nota));
    sheet.replaceChildren(...corpo); sheet.classList.add('on');
  }
  /** Gli insetti: quanti ne hai dato al mobiliere e quelli nello zaino da consegnare (gratis: spariscono e nel Diario diventano tuoi). */
  function collezione(l: LotState | null): Node[] {
    const s = insettiOf(l, adesso()), inv = l?.hero?.inv ?? {}, out: Node[] = [el('h3', '', `LA COLLEZIONE DI INSETTI · ${s.posseduti.length}/${INSETTI.length}`)];
    const zaino = INSETTI.filter((d) => (inv[d.id] ?? 0) > 0);
    out.push(el('div', 'prezzo', zaino.length ? 'Me li regali? Li tengo io e nel tuo Diario si sblocca la loro scheda. Se ce l’ho già, vendilo al Contrabbandiere.' : 'Portami gli insetti che prendi col retino: li tengo io e nel tuo Diario si sblocca la loro scheda.'));
    for (const d of zaino) {
      const ce = s.posseduti.includes(d.id), b = el('button', 'mz-btn', ''); b.type = 'button'; b.dataset['act'] = 'consegna'; b.dataset['insetto'] = d.id;
      const ic = insettoCanvas(d, 2); ic.style.flex = 'none';
      b.append(ic, el('span', '', `${d.nome} ×${inv[d.id]}`), el('b', '', ce ? 'Ce l’ho già' : 'CONSEGNA'));
      b.disabled = ce || busy || !o.api;
      b.addEventListener('click', () => void consegna(d.id));
      out.push(b);
    }
    return out;
  }
  /** I pesci (#457): come gli insetti, consegnati gratis diventano «catturati» nel Diario. */
  function collezionePesci(l: LotState | null): Node[] {
    const s = pesciOf(l, adesso()), inv = l?.hero?.inv ?? {}, out: Node[] = [el('h3', '', `LA COLLEZIONE DI PESCI · ${s.posseduti.length}/${PESCI.length}`)];
    const zaino = PESCI.filter((d) => (inv[d.id] ?? 0) > 0);
    out.push(el('div', 'prezzo', zaino.length ? 'Che bei pesci! Me li lasci? Li tengo io e nel tuo Diario si sblocca la loro scheda. Se ce l’ho già, vendilo al Contrabbandiere.' : 'Portami i pesci che peschi con la canna: li tengo io e nel tuo Diario si sblocca la loro scheda.'));
    for (const d of zaino) {
      const ce = s.posseduti.includes(d.id), b = el('button', 'mz-btn', ''); b.type = 'button'; b.dataset['act'] = 'consegna-pesce'; b.dataset['pesce'] = d.id;
      const ic = pesceCanvas(d, 2); ic.style.flex = 'none';
      b.append(ic, el('span', '', `${d.nome} ×${inv[d.id]}`), el('b', '', ce ? 'Ce l’ho già' : 'CONSEGNA'));
      b.disabled = ce || busy || !o.api;
      b.addEventListener('click', () => void consegna(d.id, 'pesci'));
      out.push(b);
    }
    return out;
  }
  async function consegna(id: string, cosa: 'insetti' | 'pesci' = 'insetti'): Promise<void> {
    if (busy || !o.api) return;
    busy = true; banco();
    try {
      const r = cosa === 'pesci' ? await o.api.pesci('consegna', { id }) : await o.api.insetti('consegna', { id }); o.setLot(r.lot); consegnati++; nota = '';
      const d = cosa === 'pesci' ? PESCI.find((x) => x.id === id) : INSETTI.find((x) => x.id === id);
      o.hud.toast(`«Che meraviglia, ${d?.nome ?? id}! Lo tengo io.» La sua scheda è nel tuo Diario`, 3200);
    } catch (e) { nota = e instanceof ApiError ? e.message : 'Qualcosa non va, riprova'; } finally { busy = false; if (aperto?.kind === 'banco') banco(); }
  }
  async function amplia(da: number): Promise<void> {
    const l = o.getLot(), prossimo = prossimoAmpliamento(da);
    if (busy || !o.api || !l || !prossimo) return;
    if (ampliatoOggi(l, adesso())) { conferma = false; nota = 'Hai già fatto un ampliamento oggi: torna domani!'; banco(); return; }
    if (l.monete < prossimo.monete) { conferma = false; nota = `Non hai ancora abbastanza: ti mancano ${prossimo.monete - l.monete} monete.`; banco(); return; }
    if (!conferma) { conferma = true; nota = ''; banco(); clearTimeout(confermaT); confermaT = window.setTimeout(() => { if (conferma && aperto?.kind === 'banco') { conferma = false; banco(); } }, 4000); return; }
    clearTimeout(confermaT); conferma = false; busy = true; banco();
    try {
      o.setLot(await o.api.casa('amplia', { da })); ampliati++; nota = '';
      o.hud.toast(`${prossimo.nome}: fatto! Torna a casa a vederla`, 3200);
    } catch (e) { nota = e instanceof ApiError ? e.message : 'Qualcosa non va, riprova'; } finally { busy = false; if (aperto?.kind === 'banco') banco(); }
  }
  function scheda(p: Pezzo): void {
    aperto = p; caricaTesti();
    if (p.kind === 'banco') { banco(); return; }
    const l = o.getLot(), monete = l?.monete ?? 0, m = p.kind === 'mobile' ? MOBILI.find((x) => x.id === p.id) ?? null : null;
    const tipo = p.kind === 'canna'
      ? 'Strumento (peso 0 nello zaino): pesca dalle rive di Borgo Marea e dalla barca ferma in mare aperto'
      : p.kind === 'retino'
      ? 'Strumento (peso 0 nello zaino): cattura gli insetti di Borgo Marea, in giro, sotto i sassi e sugli alberi scossi'
      : p.kind === 'pala'
      ? 'Strumento (peso 0 nello zaino): scava buche a Borgo Marea per seppellire oggetti, mobili e monete o cercare il bottino del giorno'
      : p.kind === 'mobile' ? 'Mobile: va nel magazzino di casa, lo posi con ARREDA' : p.kind === 'pavimento' ? 'Pavimento: si mette subito in casa tua' : 'Carta da parati: si mette subito in casa tua';
    const prezzo = el('div', 'prezzo'); prezzo.append(el('span', '', `${tipo}. Prezzo `), el('b', '', `${p.monete} monete`), el('span', '', ` · ne hai ${monete}`));
    const b = el('button', 'mz-btn', ''); b.type = 'button'; b.dataset['act'] = 'compra';
    const g = gia(p);
    b.append(el('span', '', g ? 'Ce l’hai già' : !o.api ? 'Serve il collegamento' : 'COMPRA'), el('b', '', g ? '✓' : `${p.monete}`));
    b.disabled = g || busy || !o.api;
    b.addEventListener('click', () => void compra(p));
    const corpo: Node[] = [testata(p.nome)];
    if (testi?.[p.id]) corpo.push(el('div', 'prezzo', testi[p.id]!));
    if (m) corpo.push(el('div', 'prezzo', dove(m)));
    corpo.push(prezzo);
    const mag = m ? casaDi(l).magazzino?.[m.id] : 0;
    if (mag) corpo.push(el('div', 'prezzo', `Ne hai già ${mag} nel magazzino.`));
    corpo.push(b);
    if (nota) corpo.push(el('div', 'prezzo', nota));
    sheet.replaceChildren(...corpo); sheet.classList.add('on');
  }
  async function compra(p: Pezzo): Promise<void> {
    const l = o.getLot();
    if (busy || !o.api || !l || p.kind === 'banco' || gia(p)) return;
    if (l.monete < p.monete) { nota = `Ti mancano ${p.monete - l.monete} monete: le vinci ai minigiochi, ai Templari, nell'Arena e nei dungeon.`; ridisegna(); return; }
    busy = true; ridisegna();
    try {
      const next = await (p.kind === 'canna' ? o.api.casa('canna', {}) : p.kind === 'retino' ? o.api.casa('retino', {}) : p.kind === 'pala' ? o.api.casa('pala', {}) : p.kind === 'mobile' ? o.api.casa('compra', { id: p.id }) : o.api.casa('finitura', { tipo: p.kind, id: p.id }));
      o.setLot(next); comprati++;
      chiudi();
      if (p.kind === 'retino' || p.kind === 'canna') insetti.prendi(p.kind);
      o.hud.toast(p.kind === 'canna' ? 'Canna comprata! Ce l’hai in mano: vai sulla riva o fermati con la barca al largo' : p.kind === 'retino' ? 'Retino comprato! Ce l’hai in mano: cambi attrezzo col bottone accanto o col tasto Q' : p.kind === 'pala' ? 'Pala comprata! La trovi nello zaino (Strumenti) e puoi usarla a Borgo Marea' : p.kind === 'mobile' ? `${p.nome}: è nel magazzino, arreda da casa tua` : `${p.nome}: messo in casa tua`, 2800);
    } catch (e) { nota = e instanceof ApiError ? e.message : 'Qualcosa non va, riprova'; ridisegna(); } finally { busy = false; }
  }
  const vai = (v: Vicino) => {
    if (v.kind === 'porta') passa(entraDentro, () => o.hud.toast('Il negozio dei mobili: avvicinati a un pezzo e premi A', 2600));
    else if (v.kind === 'esci') passa(esciFuori);
    else scheda(v.p);
  };
  btn.addEventListener('click', () => { if (near) vai(near); });

  registerStateProvider('negozio', () => ({
    dentro, aperto: aperto?.id ?? null, ampliati, conferma, livello: livelloCasa(casaDi(o.getLot())), near: near ? (near.kind === 'pezzo' ? near.p.id : near.kind) : null, comprati, giorno: giornoMostrato,
    vetrina: vetrinaDelGiorno(giornoMostrato),
    pezzi: pezzi.map((p) => ({ kind: p.kind, id: p.id, monete: p.monete, x: ox + p.fx, z: oz + p.fz })), porta: { x: px, z: pz, muro, verso }, uscita: { x: ox + (CX + 0.5) * T, z: oz + (C0 + 0.5) * T },
    magazzino: casaDi(o.getLot()).magazzino ?? {}, consegnati,
  }));
  registerTestHook('negozio', (conVelo) => { if (conVelo) passa(entraDentro); else entraDentro(); return true; });

  const insetti = createInsettiBorgo({ world: w, root: o.root, hud: o.hud, api: o.api, getLot: o.getLot, setLot: o.setLot, negozioDentro: () => dentro });
  const pala = createPalaBorgo({ world: w, root: o.root, hud: o.hud, api: o.api, getLot: o.getLot, setLot: o.setLot, negozioDentro: () => dentro, inMano: insetti.attrezzo, occupato: insetti.occupato, zolle: insetti.zolle });
  const pesca = createPescaBorgo({ world: w, root: o.root, hud: o.hud, api: o.api, camera: o.renderer.camera, canvas: o.renderer.gl.domElement, yaw: () => o.renderer.diorama.yaw,
    getLot: o.getLot, setLot: o.setLot, negozioDentro: () => dentro, inMano: insetti.attrezzo });
  let lastK = '';
  return {
    get dentro() { return dentro; },
    pescando: () => pesca.attiva(),
    azionePesca: () => pesca.azione(),
    tick(a) {
      if (pesca.attiva() || w.mode === 'boat') { near = null; if (aperto) chiudi(); const r = pesca.tick(a); aWas = a; return r; } // pescando, A è della pesca
      const pa = a && !aWas; aWas = a;
      near = trova();
      // camminando contro la porta si entra; in fondo al corridoio si esce
      const f = w.avatar.state, sp = Math.hypot(f.vx, f.vz);
      if (libero() && sp > 0.5) {
        if (!dentro && Math.hypot(f.x - muro.x, f.z - muro.z) < 0.6 && f.vx * verso.x + f.vz * verso.z > 0.4 * sp) { vai({ kind: 'porta' }); return true; }
        if (dentro && (f.z - oz) / T > C1 - 0.4 && f.vz > 0) { chiudi(); vai({ kind: 'esci' }); return true; }
      }
      if (aperto && (!near || near.kind !== 'pezzo' || near.p !== aperto)) chiudi();
      if (near && pa) { vai(near); return true; }
      if (near) return true;
      return pesca.tick(a) || insetti.tick(a) || pala.tick(a);
    },
    update(dt) {
      // a mezzanotte di Roma la vetrina cambia: si controlla una volta al secondo; chi è dentro se ne accorge (scheda chiusa, toast)
      ultimo += dt;
      if (ultimo >= 1) {
        ultimo = 0;
        const g = giornoRoma(adesso());
        if (g !== giornoMostrato) { allestisci(g); if (dentro) { chiudi(); o.hud.toast('Il mobiliere ha messo in mostra merce nuova', 2600); } }
      }
      const k = near ? (near.kind === 'pezzo' ? 'p:' + near.p.id : near.kind) : '';
      if (k !== lastK) {
        lastK = k;
        btn.classList.toggle('on', !!near && near.kind !== 'pezzo');
        if (near?.kind === 'porta') btn.replaceChildren(pixIcon('casa', 24), el('span', '', 'NEGOZIO DEI MOBILI'), el('small', '', 'A'));
        if (near?.kind === 'esci') btn.replaceChildren(pixIcon('casa', 24), el('span', '', 'ESCI'), el('small', '', 'A'));
        bar.classList.toggle('on', near?.kind === 'pezzo');
        if (near?.kind === 'pezzo') bar.replaceChildren(el('div', 't', near.p.kind === 'banco' ? 'Il mobiliere · A per parlargli' : `${near.p.nome} · ${near.p.monete} monete · A per guardarlo`));
      }
      if (ciro && dentro) { ciro.setPose({ x: ciroPos.x, z: ciroPos.z, yaw: -Math.PI / 2, anim: 'idle' }); ciro.update(1, 1 / 60); }
      insetti.update(dt);
      pala.update(dt);
      pesca.update(dt);
    },
  };
}
