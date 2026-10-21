// Gli abeti, la neve e la roccia dipinti dello snowboard, nello stile del panorama (sfondo.ts): pezzi fatti da Codex sul panorama come
// riferimento (assets/adrenalina/abeti.webp: 4 abeti in fila su fondo trasparente; neve.webp e roccia.webp: texture che si ripetono).
// - Abeti: un rettangolo per albero che guarda sempre la camera girando solo attorno alla verticale (il dipinto ha già luce e ombre),
//   tutti in un'InstancedMesh; la variante (0-3) è un attributo per istanza.
// - Terreno: le facce di neve prendono la texture della neve vista dall'alto e le normali lisce (niente faccette), quelle ripide la
//   roccia vista di lato. Le geometrie si riordinano in due gruppi, un materiale ciascuno.
// Finché i pezzi non sono arrivati (o con ?dipinto=0) resta la montagna a facce piatte coi colori della palette.
import * as THREE from 'three';

export type Pittura = { abeti: THREE.Texture; neve: THREE.Material; roccia: THREE.Material; abetiMat: THREE.Material; dispose(): void };
/** Le uv dal mondo, viste dall'alto, per una geometria che si dipinge con la neve (la pista chiusa). */
export function uvMondo(g: THREE.BufferGeometry): void {
  const P = g.attributes.position!, uv: number[] = [];
  for (let i = 0; i < P.count; i++) uv.push(P.getX(i) / TEX.neve, P.getZ(i) / TEX.neve);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
}

/** Quanto è grande un abete dipinto a scala 1 (m): come l'abete a coni di prima, ~6 m. */
const ABETE = { alto: 7, largo: 3.5, varianti: 4 } as const;
/** Metri coperti da una ripetizione della neve (vista dall'alto) e della roccia (vista di lato). */
const TEX = { neve: 9, roccia: 7 } as const;

export async function caricaPittura(telefono: boolean): Promise<Pittura | null> {
  const L = new THREE.TextureLoader(), m = telefono ? '_m' : '';
  try {
    const [abeti, neve, roccia] = await Promise.all(['abeti', 'neve', 'roccia'].map((n) => L.loadAsync(`/assets/adrenalina/${n}${m}.webp`)));
    for (const t of [abeti!, neve!, roccia!]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
    for (const t of [neve!, roccia!]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // gli abeti senza mipmap, a pixel netti: da lontano le mipmap li sfumavano in puntini grigi
    abeti!.generateMipmaps = false; abeti!.minFilter = THREE.NearestFilter; abeti!.magFilter = THREE.LinearFilter;
    // la neve dipinta è quasi bianca: sotto il sole della scena (forte, per la neve a facce piatte) la si abbassa un po'
    const matN = new THREE.MeshLambertMaterial({ map: neve!, color: 0xece4da }), matR = new THREE.MeshLambertMaterial({ map: roccia!, color: 0xc8c0b8 });
    const abetiMat = materialeAbeti(abeti!);
    return { abeti: abeti!, neve: matN, roccia: matR, abetiMat, dispose() { for (const x of [abeti, neve, roccia]) x!.dispose(); matN.dispose(); matR.dispose(); abetiMat.dispose(); } };
  } catch (e) { console.warn('[marea] abeti e neve dipinti non caricati', e); return null; }
}

function materialeAbeti(t: THREE.Texture): THREE.Material {
  const mat = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aVar;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\nvMapUv = vec2((uv.x + aVar) / ${ABETE.varianti}.0, uv.y);`)
      // il centro dell'albero dove dice la sua matrice; il rettangolo di lato alla camera e in verticale nel mondo (gira solo attorno a y)
      .replace('#include <project_vertex>', `
        vec4 centro = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz);
        vec4 mvPosition = centro + vec4(position.x * sx * ${ABETE.largo.toFixed(1)}, 0.0, 0.0, 0.0) + viewMatrix * vec4(0.0, position.y * sy * ${ABETE.alto.toFixed(1)}, 0.0, 0.0);
        gl_Position = projectionMatrix * mvPosition;`);
  };
  return mat;
}

/** Gli abeti dipinti nei posti di `matrici` (posizione e scala; la rotazione non conta), varianti a caso ma fisse. */
export function abetiDipinti(pt: Pittura, matrici: THREE.Matrix4[], seme: number): THREE.InstancedMesh {
  const g = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const v = new Float32Array(matrici.length);
  for (let i = 0; i < v.length; i++) v[i] = Math.floor(caso(seme, i) * ABETE.varianti);
  g.setAttribute('aVar', new THREE.InstancedBufferAttribute(v, 1));
  const im = new THREE.InstancedMesh(g, pt.abetiMat, matrici.length);
  matrici.forEach((m, i) => im.setMatrixAt(i, m));
  im.computeBoundingSphere(); im.name = 'snowboard_abeti_dipinti';
  return im;
}

const caso = (a: number, b: number) => { let x = (a * 374761393 + b * 668265263) | 0; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };

/** Dipinge un terreno a facce (geometria senza indici, coi colori della palette): neve e roccia in due gruppi, uv dal mondo, normali lisce
 *  sulla neve. Roccia = faccia ripida o colore scuro (le pareti del canalino). `soloNeve` (salti, trampolino): tutto neve, facce piatte. */
export function dipingiTerreno(mesh: THREE.Mesh, pt: Pittura, soloNeve = false): void {
  const g = mesh.geometry, P = g.attributes.position!, C = g.attributes.color!, nt = P.count / 3;
  const neve: number[] = [], roccia: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const normali: THREE.Vector3[] = [];
  for (let t = 0; t < nt; t++) {
    a.fromBufferAttribute(P, t * 3); b.fromBufferAttribute(P, t * 3 + 1); c.fromBufferAttribute(P, t * 3 + 2);
    n.subVectors(c, a).cross(b.clone().sub(a)).multiplyScalar(-1); // il verso delle facce del terreno: in su
    normali.push(n.clone());
    const lum = C.getX(t * 3) * 0.3 + C.getY(t * 3) * 0.59 + C.getZ(t * 3) * 0.11;
    (!soloNeve && (n.y / (n.length() || 1) < 0.55 || lum < 0.75) ? roccia : neve).push(t);
  }
  // le normali lisce della neve: per ogni punto la media delle facce di neve che lo toccano (pesate per area)
  const chiave = (i: number) => `${Math.round(P.getX(i) * 20)},${Math.round(P.getY(i) * 20)},${Math.round(P.getZ(i) * 20)}`;
  const somma = new Map<string, THREE.Vector3>();
  for (const t of neve) for (let k = 0; k < 3; k++) { const ch = chiave(t * 3 + k), s = somma.get(ch); if (s) s.add(normali[t]!); else somma.set(ch, normali[t]!.clone()); }
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  for (const t of neve) for (let k = 0; k < 3; k++) {
    const i = t * 3 + k, x = P.getX(i), y = P.getY(i), z = P.getZ(i), nf = normali[t]!.clone().normalize();
    const nn = soloNeve ? nf : somma.get(chiave(i))!.clone().normalize(), su = nf.y > 0.55, lato = Math.abs(nf.x) > Math.abs(nf.z);
    pos.push(x, y, z); nor.push(nn.x, nn.y, nn.z); uv.push((su ? x : lato ? z : x) / TEX.neve, (su ? z : y) / TEX.neve);
  }
  for (const t of roccia) {
    const nf = normali[t]!.clone().normalize(), lato = Math.abs(nf.x) > Math.abs(nf.z);
    for (let k = 0; k < 3; k++) {
      const i = t * 3 + k, x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      pos.push(x, y, z); nor.push(nf.x, nf.y, nf.z); uv.push((lato ? z : x) / TEX.roccia, y / TEX.roccia);
    }
  }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ng.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  ng.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  ng.addGroup(0, neve.length * 3, 0); ng.addGroup(neve.length * 3, roccia.length * 3, 1);
  ng.computeBoundingSphere();
  g.dispose();
  mesh.geometry = ng; mesh.material = [pt.neve, pt.roccia];
}
