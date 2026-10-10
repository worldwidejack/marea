// Finestra sull'eroe e luce a celle (#208): due ritocchi ai materiali flat (Lambert e Basic, onBeforeCompile) per le scene chiuse
// (dungeon, arena dei Templari). Niente geometria che cambia mentre cammini: muri e colonne restano sempre della loro altezza.
// - `taglia`: quello che sta tra la camera e l'eroe, sopra il ginocchio e dentro un cerchio attorno a lui sullo schermo, non si disegna
//   (bordo a retino 4×4, a pixel); dentro al taglio il retro delle facce diventa un coperchio scuro, così un muro tagliato sembra pieno.
//   Il cerchio segue l'eroe in modo continuo: niente fasce per cella che scattano.
// - `griglia` (solo Lambert): due DataTexture sul piano del pavimento, lette col filtro lineare e ridotte a 4 gradini col retino (niente
//   sfumature lisce, bordi a pixel): la luce cotta delle torce (RGB, `res` texel per cella) e la nebbia (R, un texel per cella: 0 mai visto,
//   poco = già visto, 1 = in vista). Le pareti le leggono un po' davanti alla faccia, così un muro non prende luce né vista dalla stanza dietro.
// Un'unica tabella di uniform per scena: `aggiorna` una volta per frame e vale per tutti i materiali ritoccati.
import * as THREE from 'three';

export type FinestraOpz = {
  /** Raggio del taglio attorno all'eroe (m, alla distanza dell'eroe). */
  raggio: number;
  /** Sotto quest'altezza (m, mondo) non si taglia mai: pavimento, muretti, piedi. */
  altezza: number;
  /** Colore del coperchio dentro al taglio (palette). */
  coperchio: string;
  /** Luce e nebbia a celle (solo dungeon): texture, celle (w × h), lato della cella, texel di luce per cella, colore del buio. */
  griglia?: { luce: THREE.DataTexture; nebbia: THREE.DataTexture; w: number; h: number; tile: number; res: number; buio: string };
};
/** taglia = finestra sull'eroe; griglia = luce e nebbia a celle (solo Lambert); minimo: `acceso` = una volta visto resta pieno (fiamme),
 *  `sempre` = mai sotto il «già visto», anche prima di vederlo (scala d'uscita, altari: i punti sicuri si vedono da subito). */
export type Ritocco = { taglia?: boolean; griglia?: boolean; minimo?: 'acceso' | 'sempre' };
export type Finestra = {
  /** Copia ritoccata del materiale (una per sorgente e tipo di ritocco; l'originale non cambia). */
  materiale<M extends THREE.Material>(m: M, o: Ritocco): M;
  /** Ritocca i materiali di tutte le mesh sotto `root` (copie, come `materiale`); `salta` per lasciarne fuori qualcuna. */
  applica(root: THREE.Object3D, o: Ritocco, salta?: (m: THREE.Mesh) => boolean): void;
  /** Ogni frame: camera ed eroe (x, z a terra; y = altezza del petto). `fiamma` ∈ ~[0,9, 1,1]: tremolio delle torce a scatti. */
  aggiorna(cam: THREE.Camera, x: number, y: number, z: number, fiamma?: number): void;
  /** Taglio acceso o spento. */
  setTaglia(on: boolean): void;
  dispose(): void;
};

const PARS_V = /* glsl */ `
varying vec3 vMzW;
#ifdef MZ_GRIGLIA
varying vec3 vMzN;
#endif
`;
const MAIN_V = /* glsl */ `
	{
		vec4 mzW = vec4( transformed, 1.0 );
		#ifdef USE_BATCHING
		mzW = batchingMatrix * mzW;
		#endif
		#ifdef USE_INSTANCING
		mzW = instanceMatrix * mzW;
		#endif
		vMzW = ( modelMatrix * mzW ).xyz;
		#ifdef MZ_GRIGLIA
		vec3 mzN = objectNormal;
		#ifdef USE_INSTANCING
		mzN = mat3( instanceMatrix ) * mzN;
		#endif
		vMzN = normalize( mat3( modelMatrix ) * mzN );
		#endif
	}
`;
const PARS_F = /* glsl */ `
varying vec3 vMzW;
uniform vec3 uMzEroe;
uniform vec3 uMzCam;
uniform float uMzRaggio;
uniform float uMzAltezza;
uniform float uMzTaglia;
uniform vec3 uMzCoperchio;
#ifdef MZ_GRIGLIA
varying vec3 vMzN;
uniform sampler2D uMzLuce;
uniform sampler2D uMzNebbia;
uniform vec2 uMzInv;
uniform float uMzPassoL;
uniform float uMzPassoN;
uniform float uMzFiamma;
uniform vec3 uMzBuio;
#endif
const float MZ_BAYER[16] = float[16]( 0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0 );
float mzRetino() {
	ivec2 p = ivec2( mod( floor( gl_FragCoord.xy ), 4.0 ) );
	return ( MZ_BAYER[ p.y * 4 + p.x ] + 0.5 ) / 16.0;
}
// n gradini; il retino copre una fascia larga a del passaggio tra un gradino e l'altro (1 = tutto, 0 = bande nette)
float mzGradini( float v, float r, float n, float a ) { return clamp( floor( v * n + 0.5 + ( r - 0.5 ) * a ) / n, 0.0, 1.0 ); }
`;
// subito dopo i piani di taglio: le facce davanti all'eroe dentro al cerchio spariscono, il loro retro dentro al cerchio fa da coperchio
const TAGLIO_F = /* glsl */ `
	bool mzCop = false;
	float mzR = mzRetino();
	#ifdef MZ_TAGLIA
	{
		vec3 mzV = uMzEroe - uMzCam;
		float mzL = length( mzV );
		vec3 mzD = vMzW - uMzCam;
		float mzT = dot( mzD, mzV ) / ( mzL * mzL );
		vec3 mzP = mzD - mzV * mzT;
		float mzRag = uMzRaggio * mzT * ( 0.8 + 0.2 * mzR );
		bool mzDentro = uMzTaglia > 0.5 && mzT * mzL < mzL - 0.7 && dot( mzP, mzP ) < mzRag * mzRag;
		if ( gl_FrontFacing ) { if ( mzDentro && vMzW.y > uMzAltezza ) discard; }
		else { if ( !mzDentro || vMzW.y > uMzAltezza ) discard; mzCop = true; }
	}
	#endif
`;
// prima del colore finale: luce cotta delle torce e nebbia, a gradini col retino; il coperchio è un colore pieno
const LUCE_F = /* glsl */ `
	#ifdef MZ_GRIGLIA
	{
		// la luce vera (lanterna, altare, direzionale) a gradini come quella cotta: niente aloni lisci attorno all'eroe
		vec3 mzDd = reflectedLight.directDiffuse;
		float mzDm = max( mzDd.r, max( mzDd.g, mzDd.b ) );
		if ( mzDm > 0.002 ) outgoingLight += mzDd * ( mzGradini( mzDm, mzR, 6.0, 0.3 ) / mzDm - 1.0 );
		vec2 mzN2 = vec2( vMzN.x, vMzN.z );
		vec3 mzL = texture2D( uMzLuce, ( vMzW.xz + mzN2 * uMzPassoL ) * uMzInv ).rgb * 2.0 * uMzFiamma;
		float mzM = max( mzL.r, max( mzL.g, mzL.b ) );
		if ( mzM > 0.002 ) mzL *= mzGradini( mzM * 0.5, mzR, 8.0, 0.3 ) * 2.0 / mzM;
		outgoingLight += diffuseColor.rgb * mzL;
		if ( mzCop ) outgoingLight = uMzCoperchio;
		float mzA = texture2D( uMzNebbia, ( vMzW.xz + mzN2 * uMzPassoN ) * uMzInv ).r;
		#ifdef MZ_ACCESO
		mzA = mzA > 0.08 ? 1.0 : 0.0;
		#endif
		#ifdef MZ_SEMPRE
		mzA = max( mzA, 0.3 );
		#endif
		outgoingLight = mix( uMzBuio, outgoingLight, mzGradini( mzA, mzR, 4.0, 1.0 ) );
	}
	#else
	if ( mzCop ) outgoingLight = uMzCoperchio;
	#endif
`;

export function createFinestra(o: FinestraOpz): Finestra {
  const g = o.griglia;
  const u = {
    uMzEroe: { value: new THREE.Vector3() }, uMzCam: { value: new THREE.Vector3() },
    uMzRaggio: { value: o.raggio }, uMzAltezza: { value: o.altezza }, uMzTaglia: { value: 1 },
    uMzCoperchio: { value: new THREE.Color(o.coperchio) },
    uMzLuce: { value: g?.luce ?? null }, uMzNebbia: { value: g?.nebbia ?? null },
    uMzInv: { value: new THREE.Vector2(g ? 1 / (g.w * g.tile) : 1, g ? 1 / (g.h * g.tile) : 1) },
    // le pareti leggono il texel di pavimento subito davanti alla faccia (mezzo texel di luce, mezza cella di nebbia)
    uMzPassoL: { value: g ? g.tile / g.res / 2 : 0 }, uMzPassoN: { value: g ? g.tile / 2 : 0 },
    uMzFiamma: { value: 1 }, uMzBuio: { value: new THREE.Color(g?.buio ?? '#000000') },
  };
  const copie = new Map<THREE.Material, Map<string, THREE.Material>>();
  const tutte: THREE.Material[] = [];
  const api: Finestra = {
    materiale(m, k) {
      const lambert = (m as unknown as THREE.MeshLambertMaterial).isMeshLambertMaterial === true;
      const taglia = !!k.taglia, griglia = !!k.griglia && !!g && lambert;
      const chiave = (taglia ? 't' : '') + (griglia ? 'g' + (k.minimo ?? '') : '');
      if (!chiave) return m;
      let per = copie.get(m);
      if (!per) { per = new Map(); copie.set(m, per); }
      let c = per.get(chiave);
      if (!c) {
        c = m.clone();
        // il coperchio è il retro delle facce: servono entrambi i lati (fuori dal taglio il retro si scarta, come prima)
        if (taglia) c.side = THREE.DoubleSide;
        const defines: Record<string, string> = {};
        if (taglia) defines['MZ_TAGLIA'] = '';
        if (griglia) { defines['MZ_GRIGLIA'] = ''; if (k.minimo === 'acceso') defines['MZ_ACCESO'] = ''; if (k.minimo === 'sempre') defines['MZ_SEMPRE'] = ''; }
        c.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, u);
          sh.defines = { ...sh.defines, ...defines };
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + PARS_V)
            .replace('#include <project_vertex>', '#include <project_vertex>\n' + MAIN_V);
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + PARS_F)
            .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + TAGLIO_F)
            .replace('#include <opaque_fragment>', LUCE_F + '\n#include <opaque_fragment>');
        };
        c.customProgramCacheKey = () => 'mz-finestra-' + chiave;
        per.set(chiave, c); tutte.push(c);
      }
      return c as typeof m;
    },
    applica(root, k, salta) {
      const ok = (x: THREE.Material) => (x as THREE.MeshLambertMaterial).isMeshLambertMaterial || (x as THREE.MeshBasicMaterial).isMeshBasicMaterial;
      root.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (!mesh.isMesh || salta?.(mesh)) return;
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map((x) => (ok(x) ? api.materiale(x, k) : x)) : ok(mesh.material) ? api.materiale(mesh.material, k) : mesh.material;
      });
    },
    aggiorna(cam, x, y, z, fiamma = 1) {
      cam.getWorldPosition(u.uMzCam.value);
      u.uMzEroe.value.set(x, y, z);
      u.uMzFiamma.value = fiamma;
    },
    setTaglia(on) { u.uMzTaglia.value = on ? 1 : 0; },
    dispose() { for (const m of tutte) m.dispose(); tutte.length = 0; copie.clear(); },
  };
  return api;
}
