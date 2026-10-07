// Atmosfera del 3D dipinto: cielo al tramonto, mare (colore per profondità, schiuma, scia del sole), luci, nebbia, aloni delle lanterne.
import * as THREE from 'three';
import type { DistField } from './terrain.ts';

/** Direzione verso il sole visibile (basso sull'orizzonte, davanti alla camera) e verso la luce delle ombre (più alta). */
export const SUN_VIS = new THREE.Vector3(0.22, 0.075, -1).normalize();
export const SUN_LIGHT = new THREE.Vector3(-0.5, 0.7, -0.65).normalize();
export const SKY = {
  horizon: new THREE.Color('#ffae6a'), mid: new THREE.Color('#ee8466'), top: new THREE.Color('#4c5fa6'), sun: new THREE.Color('#fff0c0'),
  fog: new THREE.Color('#e9a283'), cloudLit: new THREE.Color('#ffc48a'), cloudShade: new THREE.Color('#a8668e'),
};

const NOISE = /* glsl */`
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
`;

export function createSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN_VIS }, uH: { value: SKY.horizon }, uM: { value: SKY.mid }, uT: { value: SKY.top }, uS: { value: SKY.sun }, uCL: { value: SKY.cloudLit }, uCS: { value: SKY.cloudShade }, uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz); gl_Position = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position, 1.0)).xyz, 1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun, uH, uM, uT, uS, uCL, uCS; uniform float uTime; varying vec3 vDir;
      ${NOISE}
      void main(){
        vec3 d = normalize(vDir); float e = d.y;
        vec3 c = mix(uH, uM, smoothstep(0.0, 0.16, e)); c = mix(c, uT, smoothstep(0.12, 0.6, e));
        float s = max(dot(d, uSun), 0.0);
        c += uS * (pow(s, 900.0) * 6.0 + pow(s, 60.0) * 0.55 + pow(s, 8.0) * 0.28);
        // nuvole dipinte: bande basse, bordo illuminato verso il sole
        vec2 uv = d.xz / (e + 0.12) * 1.3 + vec2(uTime * 0.004, 0.0);
        float n = fbm(uv * vec2(0.9, 2.6));
        float band = smoothstep(0.0, 0.05, e) * (1.0 - smoothstep(0.22, 0.45, e));
        float cl = smoothstep(0.52, 0.7, n) * band;
        vec3 cc = mix(uCS, uCL, smoothstep(0.55, 0.85, n) * 0.6 + pow(s, 4.0) * 0.6);
        c = mix(c, cc, cl * 0.85);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  m.frustumCulled = false; m.renderOrder = -1;
  return m;
}

export function createSea(df: DistField): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uSun: { value: SUN_VIS }, uSunC: { value: new THREE.Color('#ffcf8a') },
      uDeep: { value: new THREE.Color('#0f4677') }, uMidC: { value: new THREE.Color('#0f87a0') }, uShallow: { value: new THREE.Color('#2fc4bb') }, uSand: { value: new THREE.Color('#c9d29a') },
      uSkyH: { value: SKY.horizon }, uSkyT: { value: SKY.top }, uDist: { value: df.tex }, uReg: { value: df.region },
    }]),
    vertexShader: /* glsl */`
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uSun, uSunC, uDeep, uMidC, uShallow, uSand, uSkyH, uSkyT; uniform sampler2D uDist; uniform vec4 uReg;
      varying vec3 vW;
      #include <fog_pars_fragment>
      ${NOISE}
      float wav(vec2 p){ return vnoise(p * 0.55 + vec2(uTime * 0.12, uTime * 0.07)) * 0.6 + vnoise(p * 1.7 - vec2(uTime * 0.2, -uTime * 0.13)) * 0.3 + vnoise(p * 4.1 + vec2(-uTime * 0.31, uTime * 0.25)) * 0.05; }
      void main(){
        vec2 p = vW.xz;
        vec2 ruv = (p - uReg.xy) / uReg.z;
        float inside = step(0.0, ruv.x) * step(ruv.x, 1.0) * step(0.0, ruv.y) * step(ruv.y, 1.0);
        float d = mix(uReg.w, texture2D(uDist, ruv).r * uReg.w, inside);
        // normale dalle onde (differenze finite), più calme vicino a riva
        float e = 0.15, h0 = wav(p), hx = wav(p + vec2(e, 0.0)), hz = wav(p + vec2(0.0, e));
        float amp = 0.22;
        vec3 N = normalize(vec3((h0 - hx) * amp / e, 1.0, (h0 - hz) * amp / e));
        vec3 V = normalize(cameraPosition - vW);
        // colore per profondità
        vec3 col = mix(uShallow, uMidC, smoothstep(0.6, 6.0, d));
        col = mix(col, uDeep, smoothstep(5.0, 20.0, d));
        col = mix(uSand, col, smoothstep(0.0, 0.9, d) * 0.6 + 0.4);
        // riflessi sul fondo basso
        float ca = vnoise(p * 1.3 + vec2(uTime * 0.25, uTime * 0.18)) * vnoise(p * 1.9 - vec2(uTime * 0.21, 0.0));
        col += vec3(0.55, 0.65, 0.5) * smoothstep(0.32, 0.5, ca) * (1.0 - smoothstep(1.0, 5.0, d)) * 0.35;
        // cielo riflesso (fresnel) e scia del sole
        vec3 R = reflect(-V, N);
        float fr = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        vec3 sky = mix(uSkyH, uSkyT, clamp(R.y * 2.5, 0.0, 1.0)) * 0.8;
        col = mix(col, sky, fr * 0.5);
        float s = max(dot(R, uSun), 0.0);
        float toSun = smoothstep(0.55, 1.0, max(dot(normalize(vec3(-V.x, 0.0, -V.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0));
        col += uSunC * (pow(s, 380.0) * 6.0 + pow(s, 40.0) * 0.45) * (0.35 + 0.65 * toSun);
        // schiuma: fascia a riva e onde che arrivano
        float fn = vnoise(p * 2.2 + uTime * 0.3);
        float shore = 1.0 - smoothstep(0.1, 0.45 + fn * 0.4, d);
        float lap = smoothstep(0.9, 0.98, sin((d - uTime * 0.55) * 3.2) * 0.5 + 0.5) * (1.0 - smoothstep(0.5, 1.8, d)) * smoothstep(0.45, 0.65, fn);
        col = mix(col, vec3(1.0, 0.97, 0.9), clamp(max(shore, lap) * 0.9, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), mat);
  sea.frustumCulled = false;
  return sea;
}

/** Luci: sole caldo con ombre morbide, cielo/terra (caldo sopra, viola-freddo sotto), riempitivo dal lato camera. */
export function createLights(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight('#ffc39a', '#5d4f86', 0.95);
  const sun = new THREE.DirectionalLight('#ffb066', 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  const fill = new THREE.DirectionalLight('#ff9f7a', 0.6);
  fill.position.set(-0.4, 0.5, 1).multiplyScalar(50);
  scene.add(hemi, sun, sun.target, fill);
  return {
    /** Ombre attorno al giocatore (la mappa 1024² copre 68 m). Agganciata alla griglia dei texel: niente tremolio. */
    follow(x: number, z: number) {
      const step = 68 / 1024;
      const tx = Math.round(x / step) * step, tz = Math.round(z / step) * step;
      sun.target.position.set(tx, 0, tz);
      sun.position.set(tx + SUN_LIGHT.x * 80, SUN_LIGHT.y * 80, tz + SUN_LIGHT.z * 80);
    },
  };
}

/** Aloni delle lanterne: un solo draw call di punti additivi, con un leggero tremolio. */
export function createGlows(glows: { x: number; y: number; z: number; size: number; color: THREE.Color }[]) {
  const n = glows.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  glows.forEach((g, i) => { pos.set([g.x, g.y, g.z], i * 3); col.set([g.color.r, g.color.g, g.color.b], i * 3); size[i] = g.size; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 400 } },
    vertexShader: /* glsl */`attribute float size; attribute vec3 color; varying vec3 vC; uniform float uTime, uScale;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float fl = 0.88 + 0.12 * sin(uTime * 7.0 + position.x * 3.1 + position.z * 1.7);
      vC = color * fl; gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`varying vec3 vC; void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; float a = exp(-r * r * 5.0) * 0.55 + exp(-r * r * 40.0) * 0.5; if (a < 0.01) discard; gl_FragColor = vec4(vC * a, 1.0); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}
