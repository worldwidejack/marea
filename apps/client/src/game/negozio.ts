// Il negozio dei mobili del Borgo (#265). Fuori: una bottega sullo slargo della prima fontana (borgo.json `negozio`, la scrive
// tools/borgo_pianta.py) con la tenda a strisce, la vetrina e l'insegna MOBILI. Dentro: il template `negozio` oltre il mare (come i
// giardini), la stessa stanza «da plastico» della casa (game/interno.ts: camera fissa sopra l'ingresso, corridoio, buio attorno), il
// mobiliere dietro al bancone, i mobili sulle pedane, i campioni di carta da parati appesi al muro e quelli di pavimento per terra.
// Si entra camminando contro la porta (o A), si esce in fondo al corridoio; davanti a un pezzo A apre la scheda: COMPRA (Perle) → il
// mobile va nel magazzino di casa (ARREDA), pavimento e carta si mettono subito. Prezzi e righe: mobili.json e borgo.json.
// Tutto questo sta in un chunk (main.ts lo scarica subito dopo l'avvio, TECH §5): la bottega compare un attimo dopo il mondo.
import * as THREE from 'three';
import { BORGO, MOBILI } from '@marea/content';
import type { StanzaFinitura } from '@marea/content';
import { casaDi, possiedeFinitura } from '@marea/sim';
import type { LotState } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import type { Velo } from '../ui/velo.ts';
import { ApiError } from '../net/api.ts';
import type { Api } from '../net/api.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';
import { mobileGeo } from '../render/mobili.ts';
import { PAL, el } from '../ui/style.ts';
import { pixIcon } from '../ui/icons.ts';
import { createAvatar } from './avatar.ts';
import type { Avatar } from './avatar.ts';
import { NASCOSTI_DENTRO, costruisciStanza, createInquadratura, texture } from './interno.ts';
import type { Pianta } from './interno.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type Negozio = { tick(a: boolean): boolean; update(dt: number): void; readonly dentro: boolean };
type Pezzo = { kind: 'mobile' | 'pavimento' | 'carta'; id: string; nome: string; perle: number; x: number; z: number; fx: number; fz: number };

const ND = BORGO.negozioDentro, [X0, Z0, X1, Z1] = ND.pavimento, [CX, C0, C1] = ND.corridoio;
const PIANTA: Pianta = { pavimento: ND.pavimento, corridoio: ND.corridoio, altezza: ND.altezza, retro: null };
const RAGGIO = 2.2, VICINO = 1.7;
const CSS = `
#mzNegozioBar { position: absolute; left: 8px; right: 8px; top: calc(max(8px, env(safe-area-inset-top)) + 60px); display: none; justify-content: center; z-index: 15; pointer-events: none; }
#mzNegozioBar.on { display: flex; }
#mzNegozioBar .t { padding: 4px 10px; background: rgba(46,30,20,.93); border: 2px solid ${PAL.legnoChiaro}; color: ${PAL.sabbiaChiara}; font: bold 14px ui-monospace, Menlo, monospace; text-align: center; }
#mzNegozio .prezzo { margin: 8px 0; color: ${PAL.sabbia}; font-size: 15px; }
#mzNegozio .prezzo b { color: ${PAL.giallo}; }
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
  if (!porto || !place) return { tick: () => false, update: () => {}, dentro: false };
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

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
  const pezzi: Pezzo[] = [], parti: THREE.BufferGeometry[] = [];
  const cella = (cx: number, cz: number) => ({ x: (cx + 0.5) * T, z: (cz + 0.5) * T });
  const terra = MOBILI.filter((m) => m.posto === 'terra'), parete = MOBILI.filter((m) => m.posto === 'parete');
  const carte = BORGO.carte.filter((f) => (f.perle ?? 0) > 0), pavimenti = BORGO.pavimenti.filter((f) => (f.perle ?? 0) > 0);
  // in fondo al muro: carte da parati in vendita e i mobili da parete; davanti, una fila di pedane coi mobili a terra; sotto, i campioni di pavimento
  [...carte.map((f) => ({ f, m: null })), ...parete.map((m) => ({ f: null, m }))].forEach((q, i) => {
    const c = cella(X0 + 1 + i * 2, Z0), x = c.x, z = Z0 * T;
    if (q.f) {
      const t = texture(q.f); t.repeat.set(1.2, 1.6);
      const pan = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), new THREE.MeshLambertMaterial({ map: t })); pan.position.set(x, 1.2, z + 0.08); dentroG.add(pan); // davanti alla cornice
      parti.push(painted(new THREE.BoxGeometry(1.4, 1.8, 0.06), P.legnoScuro, M(x, 1.2, z + 0.01)));
      pezzi.push({ kind: 'carta', id: q.f.id, nome: q.f.nome, perle: q.f.perle ?? 0, x, z, fx: x, fz: z + 1.6 });
    } else if (q.m) {
      const g = mobileGeo(q.m.forma, q.m.colori); g.translate(x, -0.4, z); parti.push(g);
      pezzi.push({ kind: 'mobile', id: q.m.id, nome: q.m.nome, perle: q.m.perle, x, z, fx: x, fz: z + 1.6 });
    }
  });
  terra.forEach((m, i) => {
    const c = cella(X0 + 1 + i * 2, Z0 + 2);
    parti.push(painted(new THREE.CylinderGeometry(0.95, 1.05, 0.2, 8), P.pietra, M(c.x, 0.1, c.z)));
    const g = mobileGeo(m.forma, m.colori); g.translate(c.x, 0.2, c.z); parti.push(g);
    pezzi.push({ kind: 'mobile', id: m.id, nome: m.nome, perle: m.perle, x: c.x, z: c.z, fx: c.x, fz: c.z + 1.5 });
  });
  pavimenti.forEach((f, i) => {
    const c = cella(X0 + 1 + i * 2, Z0 + 4), t = texture(f); t.repeat.set(1, 1);
    const tile = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.6), new THREE.MeshLambertMaterial({ map: t })); tile.position.set(c.x, 0.06, c.z); tile.receiveShadow = true; dentroG.add(tile);
    pezzi.push({ kind: 'pavimento', id: f.id, nome: f.nome, perle: f.perle ?? 0, x: c.x, z: c.z, fx: c.x, fz: c.z + 1.4 });
  });
  // il bancone a destra, col registratore di cassa; dietro il mobiliere
  const bc = cella(X1 - 1, Z0 + 2);
  parti.push(painted(new THREE.BoxGeometry(1.4, 1.0, 3.0), P.legno, M(bc.x - 0.4, 0.5, bc.z + 0.6)), painted(new THREE.BoxGeometry(1.5, 0.1, 3.1), P.legnoChiaro, M(bc.x - 0.4, 1.05, bc.z + 0.6)));
  parti.push(painted(new THREE.BoxGeometry(0.5, 0.35, 0.4), P.arancio, M(bc.x - 0.4, 1.28, bc.z)), painted(new THREE.BoxGeometry(0.3, 0.08, 0.2), P.neroCaldo, M(bc.x - 0.4, 1.48, bc.z)));
  const mob = new THREE.Mesh(merged(parti), vc); mob.castShadow = mob.receiveShadow = true; dentroG.add(mob);
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
  let near: Vicino | null = null, aperto: Pezzo | null = null, busy = false, aWas = false, nota = '', comprati = 0;
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
  const chiudi = () => { aperto = null; nota = ''; sheet.classList.remove('on'); sheet.replaceChildren(); };
  const gia = (p: Pezzo): boolean => p.kind !== 'mobile' && possiedeFinitura(o.getLot(), p.kind, p.id);
  function scheda(p: Pezzo): void {
    aperto = p;
    const l = o.getLot(), perle = l?.resources.perle ?? 0;
    const testa = el('div', 'mz-row'); testa.style.alignItems = 'center';
    const x = el('button', 'mz-x', '×'); x.type = 'button'; x.addEventListener('click', chiudi);
    const t = el('b', '', p.nome); t.style.flex = '1'; t.style.color = PAL.giallo; testa.append(t, x);
    const tipo = p.kind === 'mobile' ? 'Mobile: va nel magazzino di casa, lo posi con ARREDA' : p.kind === 'pavimento' ? 'Pavimento: si mette subito in casa tua' : 'Carta da parati: si mette subito in casa tua';
    const prezzo = el('div', 'prezzo'); prezzo.append(el('span', '', `${tipo}. Prezzo `), el('b', '', `${p.perle} Perle`), el('span', '', ` · ne hai ${perle}`));
    const b = el('button', 'mz-btn', ''); b.type = 'button'; b.dataset['act'] = 'compra';
    const g = gia(p);
    b.append(el('span', '', g ? 'Ce l’hai già' : !o.api ? 'Serve il collegamento' : 'COMPRA'), el('b', '', g ? '✓' : `${p.perle}`));
    b.disabled = g || busy || !o.api;
    b.addEventListener('click', () => void compra(p));
    const corpo: Node[] = [testa, prezzo, b];
    if (nota) corpo.push(el('div', 'prezzo', nota));
    sheet.replaceChildren(...corpo); sheet.classList.add('on');
  }
  async function compra(p: Pezzo): Promise<void> {
    const l = o.getLot();
    if (busy || !o.api || !l || gia(p)) return;
    if (l.resources.perle < p.perle) { nota = `Ti mancano ${p.perle - l.resources.perle} Perle: le vinci ai minigiochi e alla Bacheca.`; scheda(p); return; }
    busy = true; scheda(p);
    try {
      const next = await (p.kind === 'mobile' ? o.api.casa('compra', { id: p.id }) : o.api.casa('finitura', { tipo: p.kind, id: p.id }));
      o.setLot(next); comprati++;
      chiudi();
      o.hud.toast(p.kind === 'mobile' ? `${p.nome}: è nel magazzino, arreda da casa tua` : `${p.nome}: messo in casa tua`, 2600);
    } catch (e) { nota = e instanceof ApiError ? e.message : 'Qualcosa non va, riprova'; scheda(p); } finally { busy = false; }
  }
  const vai = (v: Vicino) => {
    if (v.kind === 'porta') passa(entraDentro, () => o.hud.toast('Il negozio dei mobili: avvicinati a un pezzo e premi A', 2600));
    else if (v.kind === 'esci') passa(esciFuori);
    else scheda(v.p);
  };
  btn.addEventListener('click', () => { if (near) vai(near); });

  registerStateProvider('negozio', () => ({
    dentro, aperto: aperto?.id ?? null, near: near ? (near.kind === 'pezzo' ? near.p.id : near.kind) : null, comprati,
    pezzi: pezzi.map((p) => ({ kind: p.kind, id: p.id, perle: p.perle, x: ox + p.fx, z: oz + p.fz })), porta: { x: px, z: pz, muro, verso }, uscita: { x: ox + (CX + 0.5) * T, z: oz + (C0 + 0.5) * T },
    magazzino: casaDi(o.getLot()).magazzino ?? {},
  }));
  registerTestHook('negozio', (conVelo) => { if (conVelo) passa(entraDentro); else entraDentro(); return true; });

  let lastK = '';
  return {
    get dentro() { return dentro; },
    tick(a) {
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
      return !!near;
    },
    update() {
      const k = near ? (near.kind === 'pezzo' ? 'p:' + near.p.id : near.kind) : '';
      if (k !== lastK) {
        lastK = k;
        btn.classList.toggle('on', !!near && near.kind !== 'pezzo');
        if (near?.kind === 'porta') btn.replaceChildren(pixIcon('casa', 24), el('span', '', 'NEGOZIO DEI MOBILI'), el('small', '', 'A'));
        if (near?.kind === 'esci') btn.replaceChildren(pixIcon('casa', 24), el('span', '', 'ESCI'), el('small', '', 'A'));
        bar.classList.toggle('on', near?.kind === 'pezzo');
        if (near?.kind === 'pezzo') bar.replaceChildren(el('div', 't', `${near.p.nome} · ${near.p.perle} Perle · A per guardarlo`));
      }
      if (ciro && dentro) { ciro.setPose({ x: ciroPos.x, z: ciroPos.z, yaw: -Math.PI / 2, anim: 'idle' }); ciro.update(1, 1 / 60); }
    },
  };
}
