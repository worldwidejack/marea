// Banco delle finiture di casa (pavimenti e carte disegnati interi, game/finiture_disegni.ts): la stanza vera (interno.ts) vista come in
// gioco, a ogni livello della casa, senza server. ?pav=<id>&carta=<id>&liv=<0..7>&stanza=terra|cantina|piano per la stanza in 3D;
// ?foglio=pav|muri&liv=<n>[&min=<larghezza css>] per vederle tutte insieme (il pavimento intero, o le tre pareti in fila come un giro). Test: window.__finiture.pronto.
import * as THREE from 'three';
import { BORGO } from '@marea/content';
import { CORRIDOI, scaleDi, stanzeDi, type StanzaId } from '@marea/sim';
import { FLAGS } from '../flags.ts';
import { LUCE_INTERNO } from '../render/ciclo.ts';
import { caricaDisegni, costruisciStanza, SPESSORE, VISTA, type Pianta } from '../game/interno.ts';
import { TEX_MURO, type Muro } from '../game/finiture_kit.ts';

const q = FLAGS.finiture, T = 2;
const liv = Math.max(0, Math.min(BORGO.casa.livelli.length, +(q['liv'] ?? 0)));
const quale = (q['stanza'] ?? 'terra') as StanzaId;
const pianta = (): Pianta => {
  const s = stanzeDi(liv).find((r) => r.id === quale) ?? stanzeDi(liv)[0]!;
  return { pavimento: s.pavimento, corridoio: CORRIDOI[s.id] ?? null, altezza: BORGO.stanza.altezza, scale: scaleDi(liv).filter((x) => x.stanza === s.id).map((x) => ({ cell: x.cell, verso: x.verso })) };
};
const trova = (l: typeof BORGO.pavimenti, id: string | null) => l.find((f) => f.id === id) ?? l[0]!;
const stato = { pronto: false };
(window as unknown as { __finiture: typeof stato }).__finiture = stato;

async function foglio(tipo: string): Promise<void> {
  const m = await caricaDisegni(), p = pianta(), [X0, Z0, X1, Z1] = p.pavimento, cx = X1 - X0, cz = Z1 - Z0, el = document.getElementById('foglio')!;
  document.getElementById('gl')!.remove();
  const lw = cx * T, ld = cz * T, H = p.altezza, giro = 2 * ld + lw;
  el.style.setProperty('--min', q['min'] ?? (tipo === 'pav' ? '300px' : '620px'));
  for (const f of tipo === 'pav' ? BORGO.pavimenti : BORGO.carte) {
    const fig = document.createElement('figure'), cap = document.createElement('figcaption');
    cap.textContent = `${f.nome} · ${f.id}`;
    if (tipo === 'pav') { const c = document.createElement('canvas'); m.disegnaPavimento(c, f, { cx, cz }); fig.append(c); }
    else {
      const row = document.createElement('div'); row.className = 'giro';
      const muri: Muro[] = [
        { lato: 'sx', lung: ld, alt: H, u0: 0, giro, x0: 0, x1: Math.round(ld * TEX_MURO) },
        { lato: 'fondo', lung: lw + 2 * SPESSORE, alt: H, u0: ld - SPESSORE, giro, x0: Math.round(SPESSORE * TEX_MURO), x1: Math.round((SPESSORE + lw) * TEX_MURO) },
        { lato: 'dx', lung: ld, alt: H, u0: ld + lw, giro, x0: 0, x1: Math.round(ld * TEX_MURO) },
      ];
      for (const mu of muri) { const c = document.createElement('canvas'); m.disegnaParete(c, f, mu); c.style.width = `${(mu.x1 - mu.x0) / (giro * TEX_MURO) * 100}%`; c.style.objectFit = 'cover'; row.append(c); }
      fig.append(row);
    }
    fig.append(cap); el.append(fig);
  }
  stato.pronto = true;
}

async function stanza3d(): Promise<void> {
  await caricaDisegni();
  const cv = document.getElementById('gl') as HTMLCanvasElement, r = new THREE.WebGLRenderer({ canvas: cv, antialias: false });
  r.setPixelRatio(Math.min(2, devicePixelRatio)); r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#23201F');
  const L = LUCE_INTERNO, sole = new THREE.DirectionalLight(L.color, L.intensity), el = (L.elev * Math.PI) / 180, az = (L.azim * Math.PI) / 180;
  sole.position.set(Math.cos(el) * Math.sin(az) * 40, Math.sin(el) * 40, Math.cos(el) * Math.cos(az) * 40);
  scene.add(sole, sole.target, new THREE.HemisphereLight(L.sky, L.ground, L.hemiI), new THREE.AmbientLight(L.amb, L.ambI));
  const p = pianta(), [X0, Z0, X1, Z1] = p.pavimento, lw = (X1 - X0) * T, ld = (Z1 - Z0) * T;
  let pav = trova(BORGO.pavimenti, q['pav'] ?? null), carta = trova(BORGO.carte, q['carta'] ?? null);
  const st = costruisciStanza(T, p, pav, carta); scene.add(st.group);
  const cam = new THREE.PerspectiveCamera(VISTA.fov, 1, 0.5, 400);
  const cx = X0 * T + lw / 2, cz = Z0 * T + ld / 2;
  const misura = () => {
    const a = innerWidth / innerHeight, t = Math.tan((VISTA.fov * Math.PI) / 360); cam.aspect = a; cam.updateProjectionMatrix(); r.setSize(innerWidth, innerHeight, false);
    const alto = ld * Math.sin(VISTA.pitch) + p.altezza * Math.cos(VISTA.pitch) + 0.8, dAlto = alto / 2 / t, dLargo = (lw + 1.6) / 2 / (t * a);
    const d = Math.min(Math.max(dAlto * 0.88, dLargo * 0.9), dAlto * 1.4);
    cam.position.set(cx, 0.5 + d * Math.sin(VISTA.pitch), cz + d * Math.cos(VISTA.pitch)); cam.lookAt(cx, 0.5, cz);
  };
  const ui = document.getElementById('ui')!;
  const scelta = (lista: typeof BORGO.pavimenti, v: string, fa: (id: string) => void) => {
    const s = document.createElement('select'); for (const f of lista) s.add(new Option(f.nome, f.id, false, f.id === v));
    s.onchange = () => fa(s.value); ui.append(s);
  };
  scelta(BORGO.pavimenti, pav.id, (id) => { pav = trova(BORGO.pavimenti, id); st.rifinisci(pav, carta); });
  scelta(BORGO.carte, carta.id, (id) => { carta = trova(BORGO.carte, id); st.rifinisci(pav, carta); });
  const lv = document.createElement('select'); for (let i = 0; i <= BORGO.casa.livelli.length; i++) lv.add(new Option(`livello ${i}`, String(i), false, i === liv));
  lv.onchange = () => { location.href = '?' + Object.entries({ ...q, liv: lv.value }).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&'); }; ui.append(lv);
  addEventListener('resize', misura); misura();
  r.setAnimationLoop(() => r.render(scene, cam));
  stato.pronto = true;
}

void (q['foglio'] ? foglio(q['foglio']) : stanza3d());
