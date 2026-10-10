// Mausoleo Cinetico (Epopea della Regata, dungeon 4): gli effetti della scena. Le lancette dell'orologio (barra d'ottone a mezza gamba
// che gira attorno al perno, con la scia d'acqua dietro), le onde del Custode (un anello di cresta a tasselli con i varchi vuoti; la
// scarica della Barriera è d'oro e senza varchi) e i varchi dell'ondata che si accendono a terra mentre la prepara, la chiave di carica
// (la farfalla gira a scatti mentre il cancello scende), il sarcofago (il coperchio scivola via quando il Custode cade), la nebbia del
// secondo cuore (strati di vapore a scatti nel Santuario) col punto dove ricompare, l'alone del cuore sotto il Custode e le cinque tacche
// della Barriera sopra la testa, il raggio del Chierico che ripara. Tutto a scatti, colori di palette; i modelli veri (dng_mausoleo_leva,
// dng_mausoleo_sarcofago) vincono sui segnaposto di mausoleo.ts.
import * as THREE from 'three';
import { enemyDef } from '@marea/content/rpg.ts';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { M, merged, painted, px } from '../render/island_parts.ts';
import type { Loader } from '../render/loader.ts';
import { PAL } from '../ui/style.ts';
import { object } from './dungeon_kit.ts';
import type { DungeonScene } from './dungeon_scene.ts';
import { chiaveObj, colori, coperchio, farfalla, sarcofagoObj } from './mausoleo.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cil = (r0: number, r1: number, h: number, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s);
const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;
const SEG = 48, MAXO = 6, ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const CUORE = [PAL.acqua, PAL.pietraChiara, PAL.giallo] as const;

export type MausoleoFx = {
  tick(v: DungeonView): void;
  update(t: number, hero: { x: number; z: number }, v: DungeonView, gioco: boolean): void;
  counts(): { lancette: number; onde: number; varchi: number; chiavi: number; sarcofago: boolean; aperto: boolean; vapore: boolean; scatto: boolean; cure: number };
  dispose(): void;
};

/** Barra della lancetta lungo +X (dal perno alla punta), a mezza gamba, col contrappeso dietro e il collare attorno al perno. */
function lancettaGeo(lunga: number, largo: number): THREE.BufferGeometry {
  const L = lunga - 0.7;
  return merged([
    painted(cil(0.8, 0.8, 0.3, 10), PAL.arancio, M(0, 0.55, 0)), // collare sul perno
    painted(box(L, 0.16, largo * 2), PAL.giallo, M(0.35 + L / 2, 0.55, 0)), painted(box(L, 0.06, largo * 0.6), PAL.neroCaldo, M(0.35 + L / 2, 0.64, 0)), // barra
    painted(new THREE.ConeGeometry(largo * 1.6, 0.9, 4), PAL.giallo, M(lunga - 0.3, 0.55, 0, 0, 0, -Math.PI / 2)), // punta
    painted(box(1.2, 0.2, largo * 2.4), PAL.arancio, M(-0.9, 0.55, 0)), // contrappeso
  ]);
}

export function createMausoleoFx(o: { sc: DungeonScene; loader: Loader; say(text: string, ms: number): void; occupato(): boolean }): MausoleoFx {
  const root = new THREE.Group(); root.name = 'mausoleo_fx'; o.sc.scene.add(root);
  const fy = o.sc.floorY, map = o.sc.map;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), YA = new THREE.Vector3(0, 1, 0);
  const C = enemyDef('custode_egida').custode!;

  // lancette: barra e scia (un ventaglio d'acqua dietro, dalla parte da cui arriva)
  const scia = new THREE.MeshBasicMaterial({ color: PAL.acquaBassa, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const lancette = map.lancette.map((l) => {
    const g = new THREE.Group(); g.position.set(l.x, fy, l.z); root.add(g);
    g.add(new THREE.Mesh(lancettaGeo(l.lunga, l.largo), colori('lancetta')));
    const fan = new THREE.CircleGeometry(l.lunga, 6, l.giro >= 0 ? 0 : -0.45, 0.45); fan.rotateX(-Math.PI / 2);
    const f = new THREE.Mesh(fan, scia); f.position.y = 0.06; f.renderOrder = 1; g.add(f);
    return { l, g };
  });
  // onde: tasselli di cresta su un anello (uno ogni SEG-esimo di giro), d'acqua o d'oro per la scarica della Barriera
  const tassello = box(1, 0.4, 1); tassello.translate(0, 0.2, 0);
  const crestaA = new THREE.InstancedMesh(tassello, new THREE.MeshLambertMaterial({ color: PAL.acquaBassa, flatShading: true, emissive: PAL.acqua, emissiveIntensity: 0.35, transparent: true, opacity: 0.85 }), MAXO * SEG);
  const crestaB = new THREE.InstancedMesh(tassello, new THREE.MeshLambertMaterial({ color: PAL.giallo, flatShading: true, emissive: PAL.giallo, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }), MAXO * SEG);
  for (const [im, n] of [[crestaA, 'onda'], [crestaB, 'onda_barriera']] as const) { im.name = n; im.frustumCulled = false; im.count = 0; im.renderOrder = 2; root.add(im); }
  // i varchi dell'ondata mentre la prepara: strisce verdi a terra
  const strisciaGeo = box(1, 0.04, 1); strisciaGeo.translate(0.5, 0, 0);
  const varchiMat = new THREE.MeshBasicMaterial({ color: PAL.erbaChiara, transparent: true, opacity: 0.6, depthWrite: false });
  const varchi = new THREE.InstancedMesh(strisciaGeo, varchiMat, 4); varchi.name = 'varchi'; varchi.frustumCulled = false; varchi.count = 0; varchi.renderOrder = 1; root.add(varchi);
  // chiave di carica: cassa (modello o segnaposto) e farfalla in codice, con la gemma che dice a che punto è
  const chiavi = map.valvole.map((v) => {
    const holder = new THREE.Group(); holder.position.set(v.x, fy, v.z); root.add(holder);
    const f = farfalla(); holder.add(f);
    const gemma = new THREE.MeshLambertMaterial({ color: PAL.rosso, flatShading: true, emissive: PAL.rosso, emissiveIntensity: 0.3 });
    const gm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), gemma); gm.position.set(0, 0.95, -0.45); holder.add(gm);
    void object(o.loader, 'dng_mausoleo_leva', chiaveObj).then((g) => holder.add(g));
    return { holder, f, gemma, n: v.n, aperta: false, girata: -1 };
  });
  // il sarcofago: cassa (modello o segnaposto) e coperchio in codice
  const sf = map.sarcofago;
  const sarc = sf ? (() => {
    const holder = new THREE.Group(); holder.position.set(sf.x, fy, sf.z); root.add(holder);
    void object(o.loader, 'dng_mausoleo_sarcofago', sarcofagoObj).then((g) => holder.add(g));
    const c = coperchio(); holder.add(c);
    return { holder, c, aperto: false, t0: -1 };
  })() : null;
  // nebbia del vapore: due strati a pixel che si spostano a scatti
  const nebTex = (() => {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const g = c.getContext('2d')!;
    for (const [x, y, w, h] of [[0, 1, 7, 4], [9, 0, 6, 3], [3, 7, 9, 4], [12, 9, 4, 5], [0, 12, 6, 3], [7, 13, 5, 3]] as const) px(g, PAL.pietraChiara, x, y, w, h);
    for (const [x, y] of [[2, 2], [10, 1], [6, 9], [13, 11], [1, 13]] as const) px(g, PAL.sabbiaChiara, x, y, 2, 1);
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5);
    return t;
  })();
  const nebbia = [0.9, 1.9].map((y, k) => {
    const g = new THREE.PlaneGeometry(56, 56); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: nebTex, transparent: true, opacity: k ? 0.35 : 0.5, depthWrite: false }));
    m.name = 'nebbia_' + k; m.position.y = fy + y; m.renderOrder = 4; m.visible = false; root.add(m);
    return m;
  });
  // dove ricompare: nuvola di vapore e cerchio rosso che si riempie a scatti
  const nuvola = new THREE.Mesh(merged([
    painted(cil(0.9, 1.1, 0.7, 7), PAL.pietraChiara, M(0, 0.35, 0)), painted(cil(0.7, 0.95, 0.7, 7), PAL.sabbiaChiara, M(0.15, 1.0, 0.1)), painted(cil(0.5, 0.7, 0.6, 7), PAL.pietraChiara, M(-0.1, 1.6, -0.05)),
  ]), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.75, emissive: PAL.sabbiaChiara, emissiveIntensity: 0.3 }));
  nuvola.name = 'scatto_nuvola'; nuvola.visible = false; root.add(nuvola);
  const ringGeo = new THREE.RingGeometry(0.92, 1, 20, 1); ringGeo.rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(1, 20); discGeo.rotateX(-Math.PI / 2);
  const cerchio = new THREE.Group(); cerchio.add(new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.85, depthWrite: false })), new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.3, depthWrite: false })));
  cerchio.visible = false; cerchio.renderOrder = 1; root.add(cerchio);
  // alone del cuore sotto il Custode e le tacche della Barriera sopra la testa
  const aloneMat = new THREE.MeshBasicMaterial({ color: PAL.acqua, transparent: true, opacity: 0.5, depthWrite: false });
  const alone = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.8, 16, 1).rotateX(-Math.PI / 2), aloneMat); alone.visible = false; alone.renderOrder = 1; root.add(alone);
  const tacche = new THREE.Group(); tacche.visible = false; root.add(tacche);
  const taccaOn = new THREE.MeshBasicMaterial({ color: PAL.giallo }), taccaOff = new THREE.MeshBasicMaterial({ color: PAL.pietraScura });
  const tacca = box(0.28, 0.28, 0.28);
  for (let k = 0; k < C.barriera.colpi; k++) { const m = new THREE.Mesh(tacca, taccaOff); m.position.set((k - (C.barriera.colpi - 1) / 2) * 0.42, 0, 0); tacche.add(m); }
  // raggio del Chierico che ripara, e il lampo sull'automa riparato
  const raggioMat = new THREE.MeshBasicMaterial({ color: PAL.acquaBassa, transparent: true, opacity: 0.8, depthWrite: false });
  const raggi = new THREE.InstancedMesh(box(1, 0.08, 0.08), raggioMat, 6); raggi.name = 'cura'; raggi.frustumCulled = false; raggi.count = 0; root.add(raggi);
  const lampi: { x: number; z: number; t0: number }[] = [];
  const lampoMesh = new THREE.InstancedMesh(new THREE.RingGeometry(0.5, 0.7, 10, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PAL.erbaChiara, transparent: true, opacity: 0.85, depthWrite: false }), 6);
  lampoMesh.name = 'cura_lampo'; lampoMesh.frustumCulled = false; lampoMesh.count = 0; root.add(lampoMesh);
  let nO = 0, nV = 0, nR = 0, ondateDette = 0, lancetteDette = 0;

  return {
    tick(v) {
      const now = performance.now() / 1000;
      for (const e of v.eventi) {
        if (e.eroe !== undefined && e.eroe !== v.io && e.t !== 'cura' && e.t !== 'ondata') continue;
        if (e.t === 'cura') { lampi.push({ x: e.x, z: e.z, t0: now }); if (lampi.length > 6) lampi.shift(); }
        if (e.t === 'ondata' && !e.barriera) ondateDette++;
        if (e.t === 'lancetta') lancetteDette++;
      }
      for (const k of chiavi) {
        const a = v.valvole.find((x) => x.n === k.n)?.aperta ?? false;
        if (a && !k.aperta) k.girata = now;
        k.aperta = a;
      }
      if (sarc && v.sarcofago?.aperto && !sarc.aperto) { sarc.aperto = true; sarc.t0 = now; }
    },
    update(t, hero, v, gioco) {
      // lancette: girano come nella sim (la vista ha il versore di adesso)
      for (const { l, g } of lancette) {
        const lv = v.lancette.find((x) => x.n === l.n);
        g.visible = !!lv && o.sc.light(l.x, l.z) > 0;
        if (lv) g.rotation.y = Math.atan2(-lv.dz, lv.dx);
      }
      // onde: un anello di tasselli, vuoto nei varchi
      let nA = 0, nB = 0;
      nO = 0;
      for (const w of v.onde) {
        if (nO >= MAXO) break;
        nO++;
        const lato = Math.max(0.3, (2 * Math.PI * w.r) / SEG) * 1.05, h = 1 - steps(w.r / w.max, 4) * 0.6;
        for (let k = 0; k < SEG; k++) {
          const a = (k / SEG) * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a);
          if (w.varchi.some(([vx, vz]) => ux * vx + uz * vz >= 0.93)) continue;
          const x = w.x + ux * w.r, z = w.z + uz * w.r;
          if (o.sc.light(x, z) <= 0) continue;
          m4.compose(p3.set(x, fy, z), q.setFromAxisAngle(YA, -a), s3.set(w.spessore * 2, h, lato));
          if (w.barriera) crestaB.setMatrixAt(nB++, m4); else crestaA.setMatrixAt(nA++, m4);
        }
      }
      crestaA.count = nA; crestaB.count = nB; crestaA.instanceMatrix.needsUpdate = true; crestaB.instanceMatrix.needsUpdate = true;
      // il Custode: varchi dell'ondata a terra, dove ricompare, alone del cuore, tacche della Barriera
      const k = v.nemici.find((n) => n.tipo === 'custode_egida' && n.anim !== 'morto');
      nV = 0;
      if (k?.varchi) for (const [vx, vz] of k.varchi) {
        varchi.setMatrixAt(nV++, m4.compose(p3.set(k.x, fy + 0.05, k.z), q.setFromAxisAngle(YA, Math.atan2(-vz, vx)), s3.set(C.ondata.raggio, 1, 1.4)));
      }
      varchi.count = nV; varchi.instanceMatrix.needsUpdate = true;
      varchiMat.opacity = Math.floor(t * 8) % 2 ? 0.75 : 0.4;
      const scatto = !!k && k.attacco === 'scatto' && k.anim === 'prepara' && !!k.mira;
      nuvola.visible = cerchio.visible = scatto;
      if (scatto && k?.mira) {
        nuvola.position.set(k.mira[0], fy, k.mira[1]); nuvola.rotation.y = Math.floor(t * 6) * 0.5; nuvola.scale.setScalar(0.6 + 0.4 * steps(k.t, 4));
        cerchio.position.set(k.mira[0], fy + 0.05, k.mira[1]); cerchio.scale.setScalar(C.scatto.raggio);
        cerchio.children[1]!.scale.setScalar(Math.max(0.05, steps(k.t, 5)));
      }
      alone.visible = !!k && o.sc.light(k.x, k.z) > 0;
      if (k) {
        alone.position.set(k.x, fy + 0.04, k.z);
        const c = CUORE[Math.min(2, k.fase ?? 0)]!;
        if (aloneMat.color.getHexString() !== c.slice(1).toLowerCase()) aloneMat.color.set(c);
        aloneMat.opacity = k.attacco === 'cambio' ? (Math.floor(t * 10) % 2 ? 0.9 : 0.2) : 0.45;
      }
      tacche.visible = !!k && k.colpi !== undefined && alone.visible;
      if (k && tacche.visible) {
        tacche.position.set(k.x, fy + 4.4, k.z); tacche.quaternion.setFromAxisAngle(YA, Math.PI / 4); // di fronte alla camera (da sud-est)
        tacche.children.forEach((c, i) => { (c as THREE.Mesh).material = i < (k.cariche ?? 0) ? taccaOn : taccaOff; });
      }
      // nebbia del secondo cuore: nel Santuario, attorno all'eroe
      const vapore = !!k && (k.fase ?? 0) === 1 && o.sc.light(k.x, k.z) > 0 && Math.abs(k.x - hero.x) < 30 && Math.abs(k.z - hero.z) < 20;
      for (const [i, n] of nebbia.entries()) { n.visible = vapore; if (vapore) n.position.set(hero.x, fy + (i ? 1.9 : 0.9), hero.z); }
      nebTex.offset.set(Math.floor(t * 3) / 48, Math.floor(t * 2) / 64);
      // chiave di carica: gemma rossa che pulsa (da caricare), farfalla che gira a scatti mentre il cancello scende, poi verde
      for (const c of chiavi) {
        c.holder.visible = o.sc.light(c.holder.position.x, c.holder.position.z) > 0;
        if (!c.holder.visible) continue;
        const scende = c.aperta && (v.acque.find((a) => a.n === c.n)?.livello ?? 0) > 0;
        if (scende) c.f.rotation.y = Math.floor((t - c.girata) * 6) * (Math.PI / 4);
        const col = c.aperta ? (scende ? PAL.arancio : PAL.erbaChiara) : PAL.rosso;
        if (c.gemma.color.getHexString() !== col.slice(1).toLowerCase()) { c.gemma.color.set(col); c.gemma.emissive.set(col); }
        c.gemma.emissiveIntensity = c.aperta ? 0.3 : 0.15 + 0.3 * (Math.floor(t * 3) % 2);
      }
      // sarcofago: il coperchio scivola di lato a scatti e si posa inclinato
      if (sarc) {
        sarc.holder.visible = o.sc.light(sarc.holder.position.x, sarc.holder.position.z) > 0;
        const k2 = sarc.aperto ? steps((performance.now() / 1000 - sarc.t0) / 1.2, 6) : 0;
        sarc.c.position.set(1.3 * k2, 1.05 - 0.75 * k2, 0); sarc.c.rotation.z = -0.35 * k2;
      }
      // il Chierico che prega: raggio verso chi ripara; il lampo verde quando lo ripara
      nR = 0;
      for (const n of v.nemici) {
        if (n.attacco !== 'cura' || !n.mira || nR >= 6 || o.sc.light(n.x, n.z) <= 0) continue;
        const dx = n.mira[0] - n.x, dz = n.mira[1] - n.z, len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.1 || Math.floor(t * 10 + n.id) % 3 === 0) continue;
        raggi.setMatrixAt(nR++, m4.compose(p3.set((n.x + n.mira[0]) / 2, fy + 1.6, (n.z + n.mira[1]) / 2), q.setFromAxisAngle(YA, Math.atan2(-dz, dx)), s3.set(len, 1, 1)));
      }
      raggi.count = nR; raggi.instanceMatrix.needsUpdate = true;
      const now = performance.now() / 1000;
      let nL = 0;
      for (const l of lampi) {
        const a = (now - l.t0) / 0.45;
        if (a >= 1) continue;
        lampoMesh.setMatrixAt(nL++, m4.compose(p3.set(l.x, fy + 0.06, l.z), q.identity(), s3.setScalar(1 + steps(a, 3) * 1.2)));
      }
      lampoMesh.count = nL; lampoMesh.instanceMatrix.needsUpdate = true;
      // la prima volta che ti prende una lancetta (e la prima ondata), come si passa: appena nessuno sta parlando
      if (gioco && lancetteDette === 1 && !o.occupato()) { lancetteDette = 2; o.say('Le lancette non aspettano: entra subito dopo che è passata, e seguila', 3200); }
      if (gioco && ondateDette === 1 && !o.occupato()) { ondateDette = 2; o.say('Ondata: mettiti nel varco (le strisce verdi) o dietro una colonna', 3200); }
    },
    counts: () => ({
      lancette: lancette.filter((x) => x.g.visible).length, onde: nO, varchi: nV, chiavi: chiavi.length, sarcofago: !!sarc, aperto: !!sarc?.aperto,
      vapore: nebbia[0]!.visible, scatto: nuvola.visible, cure: nR,
    }),
    dispose() { root.removeFromParent(); tassello.dispose(); strisciaGeo.dispose(); ringGeo.dispose(); discGeo.dispose(); tacca.dispose(); nebTex.dispose(); },
  };
}
