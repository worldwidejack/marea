// Ombre cotte e tono cupo dell'isola dei Templari (docs/TEMPLARI.md §3b). Le ombre vengono dai blocchi veri, non da un'immagine: si
// cuociono una volta all'ingresso e poi costano solo una lettura di texture.
// - Ombre della luna (mappa di profondità dalla direzione della luna, solo pezzi fermi): dietro muri e colonne la luna non arriva e la luce
//   d'ambiente cala.
// - Ombre delle luci ferme (bracieri, candele, rogo, fuochi, camino…; mai la lanterna dell'eroe né le luci che si muovono): per ogni luce una
//   cube map di distanze, cotta una volta e copiata in un tassello «a ottaedro» di un'unica texture (atlas). Ogni frame si dice al shader
//   quale tassello è di quale luce puntiforme (l'ordine delle luci di three.js è quello della scena). Le luci che arrivano dopo si cuociono
//   quando compaiono; quelle che si spostano escono dall'elenco.
// - «Cupo» (0-2): colori dei pezzi fermi più spenti e scuri, cielo e ambiente più bassi: restano a illuminare bracieri, candele e lanterna.
//   Di serie 1.
// Telefono (dito): metà risoluzione per le ombre.
import * as THREE from 'three';
import { ShaderChunk } from 'three';
import type { Arena } from '@marea/sim/templari/mappa.ts';

export type Ombre = {
  /** Cuoce le ombre (con le luci già in scena) e le accende, col cupo 1. */
  accendi(): void;
  setOmbre(on: boolean): void;
  /** 0 = come il gioco, 1 = cupo, 2 = molto cupo. */
  setCupo(n: number): void;
  info(): { ombre: boolean; cupo: number; luci: number; cotture: number };
  dispose(): void;
};

const LEGGERO = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const STRATO = 5; // layer dei pezzi fermi: le camere della luna e delle luci vedono solo loro
const PX_LUNA = LEGGERO ? 2048 : 4096;
const LUNA = new THREE.Vector3(-30, 50, -20).normalize(); // da dove viene la luna (scena.ts: luna.position − target)
// luci con l'ombra: al massimo 24, un tassello dell'atlas ciascuna (8 × 3); le luci puntiformi della scena al massimo 24 (oltre: senza ombre)
const MAX_LUCI = 24, MAX_PUNTI = 24, PX_OTT = LEGGERO ? 128 : 256, COL_ATLAS = 8, RIGHE_ATLAS = MAX_LUCI / COL_ATLAS;
// pezzi che si muovono, spariscono o stanno fuori: niente ombre cotte né cupo
const FUORI = new Set(['assi', 'campana', 'campana_a_terra', 'calice', 'nave', 'mare', 'bandiera_nera', 'aste', 'nebbia', 'rogo', 'fiamme_bracieri', 'fiammelle', 'stendardi', 'bocche_grate', 'indizi']);

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
uniform vec3 uDpMin;
uniform vec3 uDpMax;
uniform sampler2D uDpLunaProf;
uniform mat4 uDpLunaMat;
uniform float uDpLunaBias;
uniform float uDpOmbre;
uniform float uDpOmbraLuna;
uniform float uDpOmbraAmb;
uniform float uDpCupo;
uniform mat3 uDpVistaRot;
uniform vec4 uDpL[ ${MAX_LUCI} ];
uniform float uDpIdx[ ${MAX_PUNTI} ];
uniform sampler2D uDpAtlas;
// direzione → quadrato [0,1]² (ottaedro con l'asse y al centro)
vec2 dpOtt( vec3 d ) {
	d /= abs( d.x ) + abs( d.y ) + abs( d.z );
	vec2 p = d.xz;
	if ( d.y < 0.0 ) p = ( 1.0 - abs( p.yx ) ) * vec2( p.x >= 0.0 ? 1.0 : - 1.0, p.y >= 0.0 ? 1.0 : - 1.0 );
	return p * 0.5 + 0.5;
}
// la luce cotta k (−1 = non cotta): 0 se un pezzo fermo le sta davanti, 1 se no. vn = normale (vista): il punto controllato si stacca
// un po' dalla faccia, di più lontano dalla luce (un tassello dell'atlas copre più mondo)
float dpLuceVis( float kf, vec3 vn ) {
	if ( kf < - 0.5 || uDpOmbre < 0.5 || any( lessThan( vDpW, uDpMin ) ) || any( greaterThan( vDpW, uDpMax ) ) ) return 1.0;
	int k = int( kf + 0.5 );
	vec4 l = uDpL[ k ];
	vec3 d0 = vDpW - l.xyz;
	vec3 d = d0 + normalize( uDpVistaRot * vn ) * ( 0.03 + 0.03 * length( d0 ) ) * ${256 / PX_OTT}.0;
	vec2 t = clamp( dpOtt( d ), 0.5 / ${PX_OTT}.0, 1.0 - 0.5 / ${PX_OTT}.0 );
	vec2 cella = vec2( mod( kf, ${COL_ATLAS}.0 ), floor( ( kf + 0.5 ) / ${COL_ATLAS}.0 ) );
	return length( d ) - 0.05 > texture2D( uDpAtlas, ( cella + t ) / vec2( ${COL_ATLAS}.0, ${RIGHE_ATLAS}.0 ) ).r * l.w ? 0.0 : 1.0;
}
`;
// dopo map e colori per istanza: ombra della luna e colore più spento e scuro col cupo
const COLORE_F = /* glsl */ `
	float dpOmbra = 0.0;
	if ( uDpOmbre > 0.5 && all( greaterThanEqual( vDpW, uDpMin ) ) && all( lessThanEqual( vDpW, uDpMax ) ) ) {
		vec4 dpL = uDpLunaMat * vec4( vDpW, 1.0 );
		vec3 dpLn = dpL.xyz / dpL.w * 0.5 + 0.5;
		if ( all( greaterThan( dpLn, vec3( 0.0 ) ) ) && all( lessThan( dpLn, vec3( 1.0 ) ) ) && dpLn.z > texture2D( uDpLunaProf, dpLn.xy ).r + uDpLunaBias ) dpOmbra = 1.0;
	}
	diffuseColor.rgb = mix( vec3( dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) ) ), diffuseColor.rgb, 1.0 - 0.2 * uDpCupo ) * ( 1.0 - 0.17 * uDpCupo );
`;
// la luna dentro il ciclo delle luci direzionali (nel gioco c'è solo lei), le luci puntiformi col loro tassello (il ciclo si srotola: [ i ]
// diventa il numero della luce), la luce d'ambiente subito dopo
const LUCI_F = ShaderChunk.lights_fragment_begin
  .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= 1.0 - uDpOmbraLuna * dpOmbra;')
  .replace('getPointLightInfo( pointLight, geometryPosition, directLight );', `getPointLightInfo( pointLight, geometryPosition, directLight );
		#if NUM_POINT_LIGHTS <= ${MAX_PUNTI}
		directLight.color *= dpLuceVis( uDpIdx[ i ], geometryNormal );
		#endif`)
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

/** Una camera ortografica dalla direzione `dir`, stretta sulla scatola `box` (con `alto` metri in più sopra). */
function cameraSu(box: THREE.Box3, dir: THREE.Vector3, alto: number, primaDavanti: number): THREE.OrthographicCamera {
  const centro = box.getCenter(new THREE.Vector3()), c = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  c.position.copy(centro).addScaledVector(dir, 120); c.lookAt(centro); c.updateMatrixWorld(true);
  const v = new THREE.Vector3(), lo = new THREE.Vector3(Infinity, Infinity, Infinity), hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let k = 0; k < 8; k++) {
    v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y + alto : box.min.y, k & 4 ? box.max.z : box.min.z).applyMatrix4(c.matrixWorldInverse);
    lo.min(v); hi.max(v);
  }
  c.left = lo.x; c.right = hi.x; c.bottom = lo.y; c.top = hi.y; c.near = -hi.z - primaDavanti; c.far = -lo.z + 1;
  c.updateProjectionMatrix(); c.layers.set(STRATO);
  return c;
}

export function createOmbre(o: { scene: THREE.Scene; gl: THREE.WebGLRenderer; arena: Arena }): Ombre {
  // solo il sopra (§12b punto 3: dalla riga `sopra` in giù ci sono le catacombe, senza luna)
  const box = new THREE.Box3(new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(o.arena.w * o.arena.tile, 9, o.arena.sopra * o.arena.tile));
  // camera della luna (più 8 m in alto e 30 davanti per chi fa ombra da sopra o da fuori)
  const camL = cameraSu(box, LUNA, 8, 30);
  const ombra = new THREE.WebGLRenderTarget(PX_LUNA, PX_LUNA, { depthTexture: new THREE.DepthTexture(PX_LUNA, PX_LUNA, THREE.UnsignedShortType), depthBuffer: true });
  ombra.depthTexture!.minFilter = ombra.depthTexture!.magFilter = THREE.NearestFilter;

  // i pezzi fermi dell'isola (quelli in scena adesso, prima di eroe, zombie e personaggi)
  const mesh: THREE.Mesh[] = [];
  o.scene.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || !(m.material as THREE.MeshLambertMaterial).isMeshLambertMaterial) return;
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (FUORI.has(p.name) || p.name.startsWith('porta_')) return;
    mesh.push(m);
  });
  for (const m of mesh) m.layers.enable(STRATO);

  // luci ferme: una cube map di distanze alla volta, copiata nel suo tassello dell'atlas
  const atlas = new THREE.WebGLRenderTarget(COL_ATLAS * PX_OTT, RIGHE_ATLAS * PX_OTT, { type: THREE.HalfFloatType, format: THREE.RedFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false });
  const cubo = new THREE.WebGLCubeRenderTarget(PX_OTT, { type: THREE.HalfFloatType, format: THREE.RedFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
  const cc = new THREE.CubeCamera(0.05, 20, cubo);
  for (const c of cc.children) c.layers.set(STRATO);
  const ott = materialeOttaedro(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ott), scenaQ = new THREE.Scene(), camQ = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quad.frustumCulled = false; scenaQ.add(quad);
  const dist = materialeDistanza();

  const vuota = new THREE.DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1); vuota.needsUpdate = true;
  const u = {
    uDpMin: { value: box.min.clone() }, uDpMax: { value: box.max.clone() },
    uDpLunaProf: { value: ombra.depthTexture as THREE.Texture },
    uDpLunaMat: { value: new THREE.Matrix4().multiplyMatrices(camL.projectionMatrix, camL.matrixWorldInverse) },
    uDpLunaBias: { value: 0.1 / (camL.far - camL.near) },
    uDpOmbre: { value: 0 }, uDpOmbraLuna: { value: 1 }, uDpOmbraAmb: { value: 0.35 }, uDpCupo: { value: 0 },
    uDpVistaRot: { value: new THREE.Matrix3() },
    uDpL: { value: [...Array(MAX_LUCI)].map(() => new THREE.Vector4(0, 0, 0, 1)) },
    uDpIdx: { value: new Array<number>(MAX_PUNTI).fill(-1) },
    uDpAtlas: { value: atlas.texture as THREE.Texture },
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
    mat.customProgramCacheKey = () => chiave() + '|ombre';
    mat.needsUpdate = true;
  }

  /** La profondità dalla luna (nebbia e ombre spenti; la profondità staccata dai materiali, sennò si scrive nella
   *  texture che lo shader legge e il browser scarta il disegno). */
  const scattaLuna = () => {
    const fog = o.scene.fog, bg = o.scene.background, om = u.uDpOmbre.value, prev = o.gl.getRenderTarget();
    o.scene.fog = null; o.scene.background = null; u.uDpOmbre.value = 0; u.uDpLunaProf.value = vuota;
    const clip = o.gl.clippingPlanes; o.gl.clippingPlanes = [];
    o.gl.setRenderTarget(ombra); o.gl.clear(); o.gl.render(o.scene, camL);
    o.gl.clippingPlanes = clip; o.gl.setRenderTarget(prev);
    o.scene.fog = fog; o.scene.background = bg; u.uDpOmbre.value = om; u.uDpLunaProf.value = ombra.depthTexture!;
  };

  const mobili = new Set<string>(), visti = new Map<string, THREE.Vector3>(), tassello = new Map<string, number>();
  /** Le luci ferme adesso (non la lanterna, non quelle che si sono già mosse), le più forti prima. */
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
  let cotture = 0;
  const cuociLuci = () => {
    const luci = luciFerme(); cotture++;
    chiaveLuci = luci.map((l) => l.id).sort().join();
    tassello.clear();
    const over = o.scene.overrideMaterial, prev = o.gl.getRenderTarget(), auto = o.gl.autoClear;
    // la coppa del braciere starebbe tra la fiamma e il pavimento: un disco nero sotto ogni braciere
    const coppe: THREE.Object3D[] = []; o.scene.traverse((n) => { if (n.name === 'bracieri' && n.visible) { coppe.push(n); n.visible = false; } });
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
      u.uDpL.value[k]!.set(l.p.x, l.p.y, l.p.z, l.far); tassello.set(l.id, k);
    });
    o.gl.autoClear = auto; o.gl.setRenderTarget(prev);
    o.gl.setClearColor(cc0, ca0); o.scene.background = bg;
    for (const c of coppe) c.visible = true;
    return luci.length;
  };
  let pronta = false, nLuci = 0, giri = 0;
  const prepara = () => {
    if (pronta) return;
    scattaLuna(); nLuci = cuociLuci(); pronta = true;
  };
  const vistaPrima = o.scene.onBeforeRender;
  o.scene.onBeforeRender = (r, sc, c, g, m, gr) => {
    vistaPrima.call(o.scene, r, sc, c, g, m, gr);
    u.uDpVistaRot.value.setFromMatrix4(c.matrixWorld);
    // le luci puntiformi nell'ordine in cui three.js le passa allo shader (visibili, nel layer della camera, in ordine di scena)
    let i = 0;
    o.scene.traverseVisible((n) => { if ((n as THREE.PointLight).isPointLight && n.layers.test(c.layers) && i < MAX_PUNTI) u.uDpIdx.value[i++] = tassello.get(n.uuid) ?? -1; });
    // ogni due secondi circa: luci nuove (personaggi arrivati) o luci che si sono mosse → si ricuoce
    if (pronta && ++giri % 120 === 0) { const ora = luciFerme().map((l) => l.id).sort().join(); if (ora !== chiaveLuci) nLuci = cuociLuci(); }
  };
  // cielo e ambiente del gioco: «cupo» li abbassa
  const ambienti: { l: THREE.Light; i: number }[] = [];
  o.scene.traverse((n) => { const l = n as THREE.Light; if ((l as THREE.HemisphereLight).isHemisphereLight || (l as THREE.AmbientLight).isAmbientLight) ambienti.push({ l, i: l.intensity }); });
  let cupo = 0;

  const api: Ombre = {
    accendi() { prepara(); u.uDpOmbre.value = 1; api.setCupo(1); },
    setOmbre(on) { prepara(); u.uDpOmbre.value = on ? 1 : 0; },
    setCupo(n) { cupo = n; u.uDpCupo.value = n; for (const a of ambienti) a.l.intensity = a.i * (1 - 0.3 * n); },
    info: () => ({ ombre: u.uDpOmbre.value > 0.5, cupo, luci: nLuci, cotture }),
    dispose() {
      for (const a of ambienti) a.l.intensity = a.i;
      o.scene.onBeforeRender = vistaPrima;
      ombra.dispose(); ombra.depthTexture?.dispose(); vuota.dispose();
      atlas.dispose(); cubo.dispose(); ott.dispose(); dist.dispose(); quad.geometry.dispose();
    },
  };
  return api;
}
