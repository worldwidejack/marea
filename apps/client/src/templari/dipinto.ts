// Prova «chiesa dipinta» (?dipinto=1, solo in locale): la chiesa vista dall'alto con la stessa direzione della camera diorama (yaw 45°,
// pitch 45°, che nel gioco non cambia mai), fotografata con una camera ortografica; la foto dei blocchi la ridipinge un'IA di immagini
// e il dipinto torna sui blocchi proiettato da quella stessa camera (projection mapping, come i matte painting del cinema).
// - foto(): PNG dei soli pezzi fermi della chiesa (niente porte, assi, campana, eroe, zombie), con una luce piatta e chiara.
// - carica(url): il dipinto (stessa inquadratura della foto) diventa il colore delle facce dentro la chiesa che la camera della foto
//   vedeva davvero (mappa di profondità dalla stessa camera: quello che stava dietro un muro resta coi suoi colori di prima).
// La luce del gioco (luna, lanterna, bracieri) resta: il dipinto fa da colore della superficie. Tasto P: dipinto sì/no; O: palette.
// Ombre della luna cotte una volta (mappa di profondità dalla direzione della luna, solo pezzi fermi): dentro la scatola la luna non
// arriva dietro muri e colonne e anche la luce d'ambiente cala. «Cupo» (0-2): dipinto più spento e scuro, cielo e ambiente più bassi,
// così restano a illuminare bracieri, candele e lanterna. Tasto L: ombre sì/no; K: cupo 0 → 1 → 2.
// Ombre delle luci ferme (bracieri, candele, rogo, fuochi, il camino della taverna…; mai la lanterna dell'eroe né le luci che si muovono):
// per ogni luce una cube map di distanze, cotta una volta e copiata in un tassello «a ottaedro» di un'unica texture (atlas), così le luci
// non hanno limite di sampler; nel ciclo delle luci puntiformi la luce si riconosce dalla posizione. Le luci che arrivano dopo (fuochi,
// Strega, Mercante) si cuociono quando compaiono; quelle che si spostano escono dall'elenco.
import * as THREE from 'three';
import type { Arena } from '@marea/sim/templari/mappa.ts';
import { TIPO } from '@marea/sim/templari/mappa.ts';
import { PAL } from '../ui/style.ts';
import { ShaderChunk } from 'three';

export type Dipinto = {
  /** La foto dei blocchi (PNG, data URL) e la sua grandezza in pixel. */
  foto(): { png: string; w: number; h: number };
  /** Carica il dipinto e lo accende. */
  carica(url: string): Promise<void>;
  setAcceso(on: boolean): void;
  setPalette(on: boolean): void;
  setOmbre(on: boolean): void;
  /** Prove: cambia a mano un uniform del dipinto (uDpOmbraLuna, uDpOmbraAmb, uDpNL…). */
  uniforme(nome: string, valore: number): void;
  /** Prove: PNG della scena com'è nel gioco (camera diorama, zoom 1) puntata su (x, z), senza muovere l'eroe. */
  vista(x: number, z: number, w?: number, h?: number): string;
  /** Prove: l'atlas delle distanze delle luci (grigio = distanza / portata) e le luci cotte. */
  atlasPng(): { png: string; luci: number[][] };
  /** 0 = come il gioco, 1 = cupo, 2 = molto cupo. */
  setCupo(n: number): void;
  info(): { box: number[]; w: number; h: number; mesh: string[]; acceso: boolean; palette: boolean; caricato: boolean; ombre: boolean; cupo: number; luci: number };
  dispose(): void;
};

const STRATO = 5; // layer dei pezzi dipinti: la camera della foto vede solo loro (e le sue luci)
const PX_M = 32; // pixel della foto per metro (il gioco, a metà risoluzione, ne mostra ~28 per metro a zoom 1)
const LUNA = new THREE.Vector3(-30, 50, -20).normalize(); // da dove viene la luna (scena.ts: luna.position − target)
// luci con l'ombra: al massimo 32, ognuna un tassello 256×256 dell'atlas (8 × 4)
const MAX_LUCI = 32, PX_CUBO = 256, PX_OTT = 256, COL_ATLAS = 8, RIGHE_ATLAS = MAX_LUCI / COL_ATLAS;
// pezzi che si muovono, spariscono o stanno fuori: restano coi loro colori
const FUORI = new Set(['assi', 'campana', 'campana_a_terra', 'calice', 'nave', 'mare', 'bandiera_nera', 'aste', 'nebbia', 'rogo', 'fiamme_bracieri', 'fiammelle', 'stendardi']);

const PARS_V = /* glsl */ `
varying vec3 vDpW;
`;
const MAIN_V = /* glsl */ `
	{
		vec4 dpW = vec4( transformed, 1.0 );
		#ifdef USE_BATCHING
		dpW = batchingMatrix * dpW;
		#endif
		#ifdef USE_INSTANCING
		dpW = instanceMatrix * dpW;
		#endif
		vDpW = ( modelMatrix * dpW ).xyz;
	}
`;
const PARS_F = /* glsl */ `
varying vec3 vDpW;
uniform sampler2D uDpTex;
uniform sampler2D uDpProf;
uniform mat4 uDpMat;
uniform vec3 uDpMin;
uniform vec3 uDpMax;
uniform float uDpOn;
uniform float uDpPal;
uniform float uDpBias;
uniform vec3 uDpColori[ 32 ];
uniform float uDpN;
uniform sampler2D uDpLunaProf;
uniform mat4 uDpLunaMat;
uniform float uDpLunaBias;
uniform float uDpOmbre;
uniform float uDpOmbraLuna;
uniform float uDpOmbraAmb;
uniform float uDpCupo;
uniform mat4 uDpVistaInv;
uniform vec3 uDpLP[ ${MAX_LUCI} ];
uniform float uDpLF[ ${MAX_LUCI} ];
uniform float uDpNL;
uniform sampler2D uDpAtlas;
// direzione → quadrato [0,1]² (ottaedro con l'asse y al centro)
vec2 dpOtt( vec3 d ) {
	d /= abs( d.x ) + abs( d.y ) + abs( d.z );
	vec2 p = d.xz;
	if ( d.y < 0.0 ) p = ( 1.0 - abs( p.yx ) ) * vec2( p.x >= 0.0 ? 1.0 : - 1.0, p.y >= 0.0 ? 1.0 : - 1.0 );
	return p * 0.5 + 0.5;
}
// la luce puntiforme in posizione (vista) vp: 0 se un pezzo fermo le sta davanti, 1 se no (o se non è una luce cotta).
// vn = normale (vista): il punto controllato si stacca un po' dalla faccia, di più lontano dalla luce (un tassello dell'atlas copre più mondo)
float dpLuceVis( vec3 vp, vec3 vn ) {
	if ( uDpOmbre < 0.5 || uDpNL < 0.5 || any( lessThan( vDpW, uDpMin ) ) || any( greaterThan( vDpW, uDpMax ) ) ) return 1.0;
	vec3 wl = ( uDpVistaInv * vec4( vp, 1.0 ) ).xyz;
	for ( int k = 0; k < ${MAX_LUCI}; k ++ ) {
		if ( float( k ) > uDpNL - 0.5 ) break;
		if ( distance( wl, uDpLP[ k ] ) > 0.05 ) continue;
		vec3 nW = normalize( mat3( uDpVistaInv ) * vn );
		vec3 d0 = vDpW - uDpLP[ k ];
		vec3 d = d0 + nW * ( 0.03 + 0.03 * length( d0 ) );
		vec2 t = clamp( dpOtt( d ), 0.5 / ${PX_OTT}.0, 1.0 - 0.5 / ${PX_OTT}.0 );
		vec2 cella = vec2( mod( float( k ), ${COL_ATLAS}.0 ), floor( float( k ) / ${COL_ATLAS}.0 ) );
		float dist = texture2D( uDpAtlas, ( cella + t ) / vec2( ${COL_ATLAS}.0, ${RIGHE_ATLAS}.0 ) ).r * uDpLF[ k ];
		return length( d ) - 0.05 > dist ? 0.0 : 1.0;
	}
	return 1.0;
}
vec3 dpPalette( vec3 c ) {
	vec3 best = c; float bd = 1e9;
	for ( int i = 0; i < 32; i++ ) {
		if ( float( i ) >= uDpN ) break;
		vec3 d = uDpColori[ i ] - c; float dd = dot( d, d );
		if ( dd < bd ) { bd = dd; best = uDpColori[ i ]; }
	}
	return best;
}
`;
// dopo map e colori per istanza: dentro la scatola della chiesa e visto dalla camera della foto → il colore è quello del dipinto
const COLORE_F = /* glsl */ `
	float dpOmbra = 0.0;
	if ( uDpOmbre > 0.5 && all( greaterThanEqual( vDpW, uDpMin ) ) && all( lessThanEqual( vDpW, uDpMax ) ) ) {
		vec4 dpL = uDpLunaMat * vec4( vDpW, 1.0 );
		vec3 dpLn = dpL.xyz / dpL.w * 0.5 + 0.5;
		if ( all( greaterThan( dpLn, vec3( 0.0 ) ) ) && all( lessThan( dpLn, vec3( 1.0 ) ) ) && dpLn.z > texture2D( uDpLunaProf, dpLn.xy ).r + uDpLunaBias ) dpOmbra = 1.0;
	}
	if ( uDpOn > 0.5 && all( greaterThanEqual( vDpW, uDpMin ) ) && all( lessThanEqual( vDpW, uDpMax ) ) ) {
		vec4 dpC = uDpMat * vec4( vDpW, 1.0 );
		vec3 dpN = dpC.xyz / dpC.w * 0.5 + 0.5;
		if ( all( greaterThan( dpN.xy, vec2( 0.0 ) ) ) && all( lessThan( dpN.xy, vec2( 1.0 ) ) ) && dpN.z <= texture2D( uDpProf, dpN.xy ).r + uDpBias ) {
			vec3 dpT = texture2D( uDpTex, dpN.xy ).rgb;
			dpT = mix( vec3( dot( dpT, vec3( 0.299, 0.587, 0.114 ) ) ), dpT, 1.0 - 0.2 * uDpCupo ) * ( 1.0 - 0.17 * uDpCupo );
			diffuseColor.rgb = uDpPal > 0.5 ? dpPalette( dpT ) : dpT;
		}
	}
`;

// la luna dentro il ciclo delle luci direzionali (nel gioco c'è solo lei), la luce d'ambiente subito dopo
const LUCI_F = ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= 1.0 - uDpOmbraLuna * dpOmbra;')
  .replace('getPointLightInfo( pointLight, geometryPosition, directLight );', 'getPointLightInfo( pointLight, geometryPosition, directLight );\n\t\tdirectLight.color *= dpLuceVis( pointLight.position, geometryNormal );')
  + '\n\tirradiance *= 1.0 - uDpOmbraAmb * dpOmbra;\n';

/** Distanza dal punto `uRef` diviso `uFar` (per le cube map delle luci): anche le mesh instanziate, entrambe le facce. */
function materialeDistanza(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uRef: { value: new THREE.Vector3() }, uFar: { value: 10 } },
    vertexShader: `varying vec3 vW;
void main() {
	vec4 p = vec4( position, 1.0 );
	#ifdef USE_INSTANCING
	p = instanceMatrix * p;
	#endif
	vec4 w = modelMatrix * p; vW = w.xyz;
	gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform vec3 uRef; uniform float uFar; varying vec3 vW;
void main() { gl_FragColor = vec4( length( vW - uRef ) / uFar, 0.0, 0.0, 1.0 ); }`,
  });
}

/** Copia la cube map `uCubo` in un quadrato a ottaedro (l'inverso di dpOtt). */
function materialeOttaedro(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { uCubo: { value: null as THREE.Texture | null } },
    vertexShader: `varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,
    fragmentShader: `uniform samplerCube uCubo; varying vec2 vUv;
void main() {
	vec2 f = vUv * 2.0 - 1.0;
	vec3 n = vec3( f.x, 1.0 - abs( f.x ) - abs( f.y ), f.y );
	float t = max( - n.y, 0.0 );
	n.x += n.x >= 0.0 ? - t : t; n.z += n.z >= 0.0 ? - t : t;
	gl_FragColor = vec4( textureCube( uCubo, normalize( n ) ).r, 0.0, 0.0, 1.0 );
}`,
  });
}

/** Scatola della chiesa: le sue celle vicine all'altare (la cripta, staccata a nord-ovest, resta fuori), con un metro di margine. */
function scatolaChiesa(a: Arena): THREE.Box3 {
  const W = a.w, T = a.tile, chiesa = new Uint8Array(a.w * a.h);
  let seme = -1, best = Infinity;
  for (let i = 0; i < a.tipo.length; i++) {
    if (a.tipo[i] !== TIPO.chiesa) continue;
    chiesa[i] = 1;
    const dx = ((i % W) + 0.5) * T - a.altare.x, dz = (Math.floor(i / W) + 0.5) * T - a.altare.z, d = dx * dx + dz * dz;
    if (d < best) { best = d; seme = i; }
  }
  const box = new THREE.Box3();
  if (seme < 0) return box.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(W * T, 6, a.h * T));
  // celle di muro a due celle o meno l'una dall'altra stanno insieme (finestre e porte bucano il muro)
  const seen = new Uint8Array(a.w * a.h), coda = [seme]; seen[seme] = 1;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let k = 0; k < coda.length; k++) {
    const c = coda[k]!, cx = c % W, cz = (c - cx) / W;
    x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); z0 = Math.min(z0, cz); z1 = Math.max(z1, cz);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const nx = cx + dx, nz = cz + dz, j = nz * W + nx;
      if (nx < 0 || nz < 0 || nx >= W || nz >= a.h || seen[j] || !chiesa[j]) continue;
      seen[j] = 1; coda.push(j);
    }
  }
  return box.set(new THREE.Vector3(x0 * T - 1, -0.1, z0 * T - 1), new THREE.Vector3((x1 + 1) * T + 1, 6.5, (z1 + 1) * T + 1));
}

export function createDipinto(o: { scene: THREE.Scene; gl: THREE.WebGLRenderer; arena: Arena; zona: 'chiesa' | 'isola'; setTaglia(on: boolean): void }): Dipinto {
  // la chiesa (la prima prova) o tutta l'isola (il dipinto lo cuciono a tasselli: dipinti/strumenti)
  const box = o.zona === 'isola' ? new THREE.Box3(new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(o.arena.w * o.arena.tile, 9, o.arena.h * o.arena.tile)) : scatolaChiesa(o.arena);
  const PX_OMBRA = o.zona === 'isola' ? 4096 : 2048;
  // camera della foto: la direzione della diorama (render/camera.ts: da sud-est, 45° dall'alto), ortografica, stretta sulla scatola
  const dir = new THREE.Vector3(Math.sin(Math.PI / 4) * Math.cos(Math.PI / 4), Math.sin(Math.PI / 4), Math.cos(Math.PI / 4) * Math.cos(Math.PI / 4));
  const centro = box.getCenter(new THREE.Vector3());
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  cam.position.copy(centro).addScaledVector(dir, 80); cam.lookAt(centro); cam.updateMatrixWorld(true);
  const v = new THREE.Vector3(), lo = new THREE.Vector3(Infinity, Infinity, Infinity), hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let k = 0; k < 8; k++) {
    v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).applyMatrix4(cam.matrixWorldInverse);
    lo.min(v); hi.max(v);
  }
  cam.left = lo.x; cam.right = hi.x; cam.bottom = lo.y; cam.top = hi.y; cam.near = -hi.z - 1; cam.far = -lo.z + 1;
  cam.updateProjectionMatrix(); cam.layers.set(STRATO);
  const W = Math.round((hi.x - lo.x) * PX_M), H = Math.round((hi.y - lo.y) * PX_M);

  // camera della luna: ortografica lungo la luce, stretta sulla scatola (più 8 m in alto per chi fa ombra da sopra)
  const camL = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camL.position.copy(centro).addScaledVector(LUNA, 120); camL.lookAt(centro); camL.updateMatrixWorld(true);
  const loL = new THREE.Vector3(Infinity, Infinity, Infinity), hiL = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let k = 0; k < 8; k++) {
    v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y + 8 : box.min.y, k & 4 ? box.max.z : box.min.z).applyMatrix4(camL.matrixWorldInverse);
    loL.min(v); hiL.max(v);
  }
  camL.left = loL.x; camL.right = hiL.x; camL.bottom = loL.y; camL.top = hiL.y; camL.near = -hiL.z - 30; camL.far = -loL.z + 1;
  camL.updateProjectionMatrix(); camL.layers.set(STRATO);
  const ombra = new THREE.WebGLRenderTarget(PX_OMBRA, PX_OMBRA, { depthTexture: new THREE.DepthTexture(PX_OMBRA, PX_OMBRA), depthBuffer: true });
  ombra.depthTexture!.minFilter = ombra.depthTexture!.magFilter = THREE.NearestFilter;

  // luce della foto: piatta e chiara, le tre facce che si vedono (sopra, sud, est) con tre toni diversi
  const amb = new THREE.AmbientLight(0xffffff, 0.55 * Math.PI), sole = new THREE.DirectionalLight(0xffffff, 0.75 * Math.PI);
  sole.position.copy(centro).add(new THREE.Vector3(0.3, 1, 0.6).multiplyScalar(30)); sole.target.position.copy(centro);
  for (const l of [amb, sole, sole.target]) { l.layers.set(STRATO); o.scene.add(l); }

  // i pezzi fermi della chiesa (quelli in scena adesso, prima di eroe e zombie)
  const mesh: THREE.Mesh[] = [];
  o.scene.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || !(m.material as THREE.MeshLambertMaterial).isMeshLambertMaterial) return;
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (FUORI.has(p.name) || p.name.startsWith('porta_')) return;
    mesh.push(m);
  });
  for (const m of mesh) m.layers.enable(STRATO);

  const prof = new THREE.WebGLRenderTarget(W, H, { depthTexture: new THREE.DepthTexture(W, H), depthBuffer: true });
  prof.depthTexture!.minFilter = prof.depthTexture!.magFilter = THREE.NearestFilter;
  const vuota = new THREE.DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1); vuota.needsUpdate = true;
  const colori = Object.values(PAL).slice(0, 32).map((c) => new THREE.Color(c)), nColori = colori.length;
  while (colori.length < 32) colori.push(new THREE.Color(0, 0, 0));
  const u = {
    uDpTex: { value: vuota as THREE.Texture }, uDpProf: { value: prof.depthTexture as THREE.Texture },
    uDpMat: { value: new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse) },
    uDpMin: { value: box.min.clone() }, uDpMax: { value: box.max.clone() },
    uDpOn: { value: 0 }, uDpPal: { value: 0 },
    uDpBias: { value: 0.12 / (cam.far - cam.near) }, // 12 cm di tolleranza nella profondità
    uDpColori: { value: colori }, uDpN: { value: nColori },
    uDpLunaProf: { value: ombra.depthTexture as THREE.Texture },
    uDpLunaMat: { value: new THREE.Matrix4().multiplyMatrices(camL.projectionMatrix, camL.matrixWorldInverse) },
    uDpVistaInv: { value: new THREE.Matrix4() }, uDpLP: { value: [...Array(MAX_LUCI)].map(() => new THREE.Vector3()) }, uDpLF: { value: new Array<number>(MAX_LUCI).fill(1) }, uDpNL: { value: 0 },
    uDpAtlas: { value: null as THREE.Texture | null },
    uDpLunaBias: { value: 0.1 / (camL.far - camL.near) }, uDpOmbre: { value: 0 }, uDpOmbraLuna: { value: 1 }, uDpOmbraAmb: { value: 0.35 }, uDpCupo: { value: 0 },
  };
  const ritoccati = new Set<THREE.Material>();
  for (const m of mesh) {
    const mat = m.material as THREE.Material;
    if (ritoccati.has(mat)) continue;
    ritoccati.add(mat);
    const prima = mat.onBeforeCompile.bind(mat), chiave = mat.customProgramCacheKey.bind(mat);
    mat.onBeforeCompile = (sh, r) => {
      prima(sh, r);
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + PARS_V)
        .replace('#include <fog_vertex>', MAIN_V + '\n#include <fog_vertex>');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + PARS_F)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + COLORE_F)
        .replace('#include <lights_fragment_begin>', LUCI_F);
    };
    mat.customProgramCacheKey = () => chiave() + '|dipinto';
    mat.needsUpdate = true;
  }

  // la foto e la profondità vedono solo quello che sta dentro la scatola (fuori: sfondo)
  const piani = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -box.min.x), new THREE.Plane(new THREE.Vector3(-1, 0, 0), box.max.x), new THREE.Plane(new THREE.Vector3(0, 1, 0), -box.min.y),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), box.max.y), new THREE.Plane(new THREE.Vector3(0, 0, 1), -box.min.z), new THREE.Plane(new THREE.Vector3(0, 0, -1), box.max.z)];
  /** Disegna i pezzi della chiesa dalla camera della foto in `rt` (taglio sull'eroe, nebbia e luci del gioco spenti). */
  const scatta = (rt: THREE.WebGLRenderTarget, sfondo: THREE.Color | null, c: THREE.Camera = cam) => {
    const fog = o.scene.fog, bg = o.scene.background, on = u.uDpOn.value, om = u.uDpOmbre.value, prev = o.gl.getRenderTarget();
    o.scene.fog = null; o.scene.background = sfondo; u.uDpOn.value = 0; u.uDpOmbre.value = 0; o.setTaglia(false);
    const clip = o.gl.clippingPlanes; o.gl.clippingPlanes = c === cam ? piani : []; // la luna vede anche chi fa ombra da fuori
    o.gl.setRenderTarget(rt); o.gl.clear(); o.gl.render(o.scene, c);
    o.gl.clippingPlanes = clip;
    o.gl.setRenderTarget(prev);
    o.scene.fog = fog; o.scene.background = bg; u.uDpOn.value = on; u.uDpOmbre.value = om; o.setTaglia(true);
  };
  let profPronta = false;
  // luci ferme dentro la scatola: una cube map di distanze ciascuna, copiata nel suo tassello dell'atlas
  const atlas = new THREE.WebGLRenderTarget(COL_ATLAS * PX_OTT, RIGHE_ATLAS * PX_OTT, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false });
  u.uDpAtlas.value = atlas.texture;
  const cubo = new THREE.WebGLCubeRenderTarget(PX_CUBO, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
  const cc = new THREE.CubeCamera(0.05, 20, cubo);
  for (const c of cc.children) c.layers.set(STRATO);
  const ott = materialeOttaedro(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ott), scenaQ = new THREE.Scene(), camQ = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quad.frustumCulled = false; scenaQ.add(quad);
  const dist = materialeDistanza();
  const mobili = new Set<string>(), visti = new Map<string, THREE.Vector3>();
  /** Le luci ferme adesso (non la lanterna, non quelle che si sono già mosse), con la loro chiave di posizione. */
  const luciFerme = () => {
    const luci: { id: string; p: THREE.Vector3; far: number; i: number }[] = [], dentro = box.clone().expandByScalar(0.5);
    o.scene.traverse((n) => {
      const l = n as THREE.PointLight;
      if (!l.isPointLight || l.name === 'lanterna') return;
      const p = l.getWorldPosition(new THREE.Vector3()), prima = visti.get(l.uuid);
      if (prima && prima.distanceToSquared(p) > 0.01) mobili.add(l.uuid);
      visti.set(l.uuid, p);
      if (!mobili.has(l.uuid) && dentro.containsPoint(p)) luci.push({ id: l.uuid, p, far: Math.min(20, (l.distance || 12) + 1), i: l.intensity });
    });
    return luci.sort((a, b) => b.i - a.i).slice(0, MAX_LUCI);
  };
  let chiaveLuci = '';
  const cuociLuci = () => {
    const luci = luciFerme();
    chiaveLuci = luci.map((l) => l.id).sort().join();
    const over = o.scene.overrideMaterial, prev = o.gl.getRenderTarget(), auto = o.gl.autoClear;
    // la coppa del braciere starebbe tra la fiamma e il pavimento: un disco nero sotto ogni braciere
    const coppe: THREE.Object3D[] = []; o.scene.traverse((n) => { if (n.name === 'bracieri' && n.visible) { coppe.push(n); n.visible = false; } });
    o.setTaglia(false);
    // vuoto = lontanissimo (bianco): niente sfondo della scena nelle cube map
    const cc0 = o.gl.getClearColor(new THREE.Color()), ca0 = o.gl.getClearAlpha(), bg = o.scene.background;
    o.scene.background = null; o.gl.setClearColor(0xffffff, 1);
    o.gl.setRenderTarget(atlas); o.gl.clear();
    luci.forEach((l, k) => {
      o.scene.overrideMaterial = dist;
      cc.position.copy(l.p); cc.updateMatrixWorld(true);
      dist.uniforms['uRef']!.value.copy(l.p); dist.uniforms['uFar']!.value = l.far;
      o.gl.autoClear = true; cc.update(o.gl, o.scene);
      o.scene.overrideMaterial = over;
      ott.uniforms['uCubo']!.value = cubo.texture;
      const x = (k % COL_ATLAS) * PX_OTT, y = Math.floor(k / COL_ATLAS) * PX_OTT;
      atlas.viewport.set(x, y, PX_OTT, PX_OTT); atlas.scissor.set(x, y, PX_OTT, PX_OTT); atlas.scissorTest = true;
      o.gl.autoClear = false; o.gl.setRenderTarget(atlas); o.gl.render(scenaQ, camQ);
      atlas.viewport.set(0, 0, atlas.width, atlas.height); atlas.scissorTest = false;
      u.uDpLP.value[k]!.copy(l.p); u.uDpLF.value[k] = l.far;
    });
    o.gl.autoClear = auto; o.gl.setRenderTarget(prev); o.setTaglia(true);
    o.gl.setClearColor(cc0, ca0); o.scene.background = bg;
    for (const c of coppe) c.visible = true;
    u.uDpNL.value = luci.length;
    return luci.length;
  };
  let nLuci = 0, giri = 0;
  const vistaPrima = o.scene.onBeforeRender;
  o.scene.onBeforeRender = (r, sc, c, g, m, gr) => {
    vistaPrima.call(o.scene, r, sc, c, g, m, gr);
    u.uDpVistaInv.value.copy(c.matrixWorld);
    // ogni due secondi circa: luci nuove (fuochi accesi, personaggi arrivati) o luci che si sono mosse → si ricuoce
    if (profPronta && ++giri % 120 === 0) { const ora = luciFerme().map((l) => l.id).sort().join(); if (ora !== chiaveLuci) nLuci = cuociLuci(); }
  };
  const preparaProf = () => {
    if (profPronta) return;
    o.setTaglia(false); scatta(prof, null); scatta(ombra, null, camL); nLuci = cuociLuci(); o.setTaglia(true); profPronta = true;
  };
  // cielo e ambiente del gioco (non le luci della foto): «cupo» li abbassa
  const ambienti: { l: THREE.Light; i: number }[] = [];
  o.scene.traverse((n) => { const l = n as THREE.Light; if ((l as THREE.HemisphereLight).isHemisphereLight || ((l as THREE.AmbientLight).isAmbientLight && l !== amb)) ambienti.push({ l, i: l.intensity }); });
  let cupo = 0;

  let caricato = false;
  const api: Dipinto = {
    foto() {
      const rt = new THREE.WebGLRenderTarget(W, H); rt.texture.colorSpace = THREE.SRGBColorSpace;
      scatta(rt, new THREE.Color(PAL.neroCaldo));
      const px = new Uint8Array(W * H * 4);
      o.gl.readRenderTargetPixels(rt, 0, 0, W, H, px); rt.dispose();
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const c2 = cv.getContext('2d')!, img = c2.createImageData(W, H);
      for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); // WebGL legge dal basso
      c2.putImageData(img, 0, 0);
      return { png: cv.toDataURL('image/png'), w: W, h: H };
    },
    async carica(url) {
      const t = await new THREE.TextureLoader().loadAsync(url);
      t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      if (u.uDpTex.value !== vuota) u.uDpTex.value.dispose();
      u.uDpTex.value = t; caricato = true;
      preparaProf(); u.uDpOn.value = 1; u.uDpOmbre.value = 1; api.setCupo(1);
    },
    setAcceso(on) { if (caricato) { preparaProf(); u.uDpOn.value = on ? 1 : 0; } },
    setPalette(on) { u.uDpPal.value = on ? 1 : 0; },
    uniforme(nome, valore) { const x = (u as Record<string, { value: unknown }>)[nome]; if (x && typeof x.value === 'number') x.value = valore; },
    atlasPng() {
      const w = atlas.width, h = atlas.height, px = new Uint16Array(w * h * 4);
      o.gl.readRenderTargetPixels(atlas, 0, 0, w, h, px);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c2 = cv.getContext('2d')!, img = c2.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = Math.round(Math.min(1, THREE.DataUtils.fromHalfFloat(px[(y * w + x) * 4]!)) * 255), i = ((h - 1 - y) * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      c2.putImageData(img, 0, 0);
      return { png: cv.toDataURL('image/png'), luci: [...Array(u.uDpNL.value).keys()].map((k) => [...u.uDpLP.value[k]!.toArray().map((x) => +x.toFixed(2)), +u.uDpLF.value[k]!.toFixed(1)]) };
    },
    vista(x, z, w = 1280, h = 720) {
      const c = new THREE.PerspectiveCamera(30, w / h, 1, 300);
      c.position.set(x, 0.9, z).addScaledVector(dir, 28); c.lookAt(x, 0.9, z); c.updateMatrixWorld(true);
      const rt = new THREE.WebGLRenderTarget(w, h); rt.texture.colorSpace = THREE.SRGBColorSpace;
      const prev = o.gl.getRenderTarget(); o.setTaglia(false);
      o.gl.setRenderTarget(rt); o.gl.clear(); o.gl.render(o.scene, c); o.gl.setRenderTarget(prev); o.setTaglia(true);
      const px = new Uint8Array(w * h * 4); o.gl.readRenderTargetPixels(rt, 0, 0, w, h, px); rt.dispose();
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c2 = cv.getContext('2d')!, img = c2.createImageData(w, h);
      for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      c2.putImageData(img, 0, 0); return cv.toDataURL('image/png');
    },
    setOmbre(on) { preparaProf(); u.uDpOmbre.value = on ? 1 : 0; },
    setCupo(n) { cupo = n; u.uDpCupo.value = n; for (const a of ambienti) a.l.intensity = a.i * (1 - 0.3 * n); },
    info: () => ({ box: [...box.min.toArray(), ...box.max.toArray()], w: W, h: H, mesh: mesh.map((m) => m.name || m.parent?.name || '?'), acceso: u.uDpOn.value > 0.5, palette: u.uDpPal.value > 0.5, caricato, ombre: u.uDpOmbre.value > 0.5, cupo, luci: nLuci }),
    dispose() {
      prof.dispose(); prof.depthTexture?.dispose(); ombra.dispose(); ombra.depthTexture?.dispose(); vuota.dispose();
      for (const a of ambienti) a.l.intensity = a.i;
      atlas.dispose(); cubo.dispose(); ott.dispose(); dist.dispose(); quad.geometry.dispose();
      o.scene.onBeforeRender = vistaPrima;
      if (u.uDpTex.value !== vuota) u.uDpTex.value.dispose();
      for (const l of [amb, sole, sole.target]) o.scene.remove(l);
    },
  };
  return api;
}
