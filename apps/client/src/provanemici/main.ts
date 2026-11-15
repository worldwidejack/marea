// Banco dei nemici (provanemici.html, issue 723): i nemici di un dungeon in fila, coi modelli veri e le pose vere (rpg/dungeon_actors.ts +
// nemici_pose.ts), su un pavimento piatto e senza server. In alto si sceglie il dungeon e lo stato: fermo, cammina, corre, colpisce (prepara,
// colpisce, recupera in giro), colpito, dorme, muore. Si trascina per girare la camera, la rotella per avvicinarsi.
// Per i test e le foto: window.__nemici = { pronto, dungeon(nome), stato(s), solo(id | null), camera(yaw, pitch, dist) }.
import * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { createLoader } from '../render/loader.ts';
import { createActors } from '../rpg/dungeon_actors.ts';
import type { DungeonScene } from '../rpg/dungeon_scene.ts';
import { PAL } from '../ui/style.ts';

const GRUPPI: Record<string, string[]> = {
  Grotta: ['bandito', 'bandito_arciere', 'lupo', 'ragno', 'scheletro', 'nonmorto', 're_ossa', 'spettro', 'golem', 'custode'],
  Drenaggio: ['tubo_strisciante', 'operaio_arrugginito', 'valvola_sparavapore', 'capoturno'],
  Archivio: ['archivista_molla', 'idro_ragno', 'aerostato_spia', 'astrolabio', 'anello_astrolabio'],
  Fucina: ['scintilla_vapore', 'fornace_semovente', 'golem_palombaro', 'mastro_forgiatore'],
  Mausoleo: ['chierico_ingranaggi', 'sentinella_egida', 'guardia_onore', 'custode_egida'],
  Diga: ['guardiano_paratia', 'fuciliere_acquafonda', 'albatros_pece', 'capitano_vaelen'],
  Baita: ['acrobata_fuoripista', 'alchimista_bombardino', 'sparaneve_automatico', 'jean_claude'],
  Ceneri: ['lanciatore_lava', 'guerriero_colossale', 'sciamano_fumo', 'fuoco_fatuo', 'mite_lava', 'korok'],
};
const STATI = ['fermo', 'cammina', 'corre', 'colpisce', 'tira', 'colpito', 'dorme', 'muore'] as const;
type Stato = typeof STATI[number];
const HZ = 60;

const canvas = document.getElementById('gl') as HTMLCanvasElement;
const gl = new THREE.WebGLRenderer({ canvas, antialias: false });
gl.setPixelRatio(Math.min(2, devicePixelRatio));
const scene = new THREE.Scene(); scene.background = new THREE.Color(PAL.neroCaldo);
scene.add(new THREE.HemisphereLight(PAL.sabbiaChiara, PAL.ombraCalda, 1.6));
const sole = new THREE.DirectionalLight(PAL.sabbiaChiara, 1.8); sole.position.set(-3, 6, -5); scene.add(sole);
const pav = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: PAL.pietraScura }));
scene.add(pav);
const griglia = new THREE.GridHelper(80, 40, PAL.pietra, PAL.pietra); (griglia.material as THREE.Material).opacity = 0.25; (griglia.material as THREE.Material).transparent = true; griglia.position.y = 0.01; scene.add(griglia);
const cam = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
const vista = { yaw: Math.PI, pitch: 0.18, dist: 9, ty: 1.2 };

const stato = { pronto: false, dungeon: 'Grotta', s: 'fermo' as Stato, solo: null as string | null };
const finta = { scene, floorY: 0, light: () => 1 } as unknown as DungeonScene;

async function main(): Promise<void> {
  const { ENEMIES } = await import('@marea/content/rpg.ts'); // il GDR resta fuori dal pacchetto iniziale
  const loader = await createLoader({ base: '/assets/' });
  await loader.extend('manifest_rpg.json');
  let attori = createActors({ loader, scene: finta, fp: true });
  let tick = 0, t0 = performance.now() / 1000, acc = 0;
  const ui = document.getElementById('ui')!;
  ui.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:6px;font:13px monospace;align-items:flex-start;height:auto;bottom:auto';
  const bottoni = (lista: readonly string[], scegli: (x: string) => void, attivo: () => string) => {
    const riga = document.createElement('div'); riga.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;width:100%';
    for (const x of lista) {
      const b = document.createElement('button'); b.textContent = x;
      b.style.cssText = `padding:6px 9px;border:2px solid ${PAL.neroCaldo};background:${PAL.sabbiaChiara};font:inherit;cursor:pointer`;
      b.onclick = () => { scegli(x); aggiorna(); };
      riga.append(b); (b as HTMLButtonElement & { attivo?: () => boolean }).attivo = () => attivo() === x;
    }
    ui.append(riga);
  };
  const aggiorna = () => ui.querySelectorAll('button').forEach((b) => { const a = (b as HTMLButtonElement & { attivo?: () => boolean }).attivo?.(); b.style.background = a ? PAL.giallo : PAL.sabbiaChiara; });
  const rifai = () => { attori.dispose(); attori = createActors({ loader, scene: finta, fp: true }); tick = 0; t0 = performance.now() / 1000; };
  bottoni(Object.keys(GRUPPI), (x) => { stato.dungeon = x; rifai(); }, () => stato.dungeon);
  bottoni(STATI, (x) => { stato.s = x as Stato; rifai(); }, () => stato.s);
  aggiorna();

  const ids = () => (stato.solo ? [stato.solo] : GRUPPI[stato.dungeon]!).filter((id) => ENEMIES.some((d) => d.id === id));
  /** La vista finta della sim al tick k: i nemici in fila a 3 m, lo stato scelto, la fase in giro. */
  const vistaAl = (k: number): DungeonView => {
    const s = k / HZ, lista = ids();
    const nemici = lista.map((id, i) => {
      const d = ENEMIES.find((e) => e.id === id)!, boss = !!d.boss;
      let x = (i - (lista.length - 1) / 2) * 3.2, z = 0, anim: DungeonView['nemici'][number]['anim'] = 'veglia', t = 0, tiro = false;
      const st = stato.s;
      let fx = 0, fz = -1;
      if (st === 'cammina' || st === 'corre') { // in tondo (raggio 1,5 m) attorno al suo posto, così resta nell'inquadratura
        const v = st === 'corre' ? 3.6 : 1.4, rg = stato.solo ? 0.7 : 1.5, a = (s * v) / rg;
        x += rg * Math.cos(a); z = rg * Math.sin(a); fx = -Math.sin(a); fz = Math.cos(a); anim = 'insegue';
      }
      if (st === 'colpisce' || st === 'tira') { // prepara 0,9 s, colpisce 0,2, recupera 0,5, fermo 0,6
        tiro = st === 'tira'; const c = s % 2.2;
        if (c < 0.9) { anim = 'prepara'; t = c / 0.9; } else if (c < 1.1) { anim = 'colpisce'; t = (c - 0.9) / 0.2; } else if (c < 1.6) { anim = 'recupera'; t = (c - 1.1) / 0.5; } else anim = 'insegue';
      }
      if (st === 'colpito') { const c = s % 1.2; if (c < 0.35) { anim = 'colpito'; t = c / 0.35; } else anim = 'insegue'; }
      if (st === 'dorme') anim = 'dorme';
      if (st === 'muore') anim = s % 4 < 0.5 ? 'insegue' : 'morto';
      return { id: i + 1, tipo: id, model: d.model, x, z, fx, fz, anim, t, vita: 10, max: 10, alleato: false, sanguina: false, boss, tiro } as DungeonView['nemici'][number];
    });
    return { nemici, proiettili: [], bottini: [] } as unknown as DungeonView;
  };

  let trascina: { x: number; y: number } | null = null;
  canvas.onpointerdown = (e) => { trascina = { x: e.clientX, y: e.clientY }; };
  addEventListener('pointerup', () => { trascina = null; });
  addEventListener('pointermove', (e) => { if (!trascina) return; vista.yaw -= (e.clientX - trascina.x) * 0.008; vista.pitch = Math.max(-0.2, Math.min(1.3, vista.pitch + (e.clientY - trascina.y) * 0.006)); trascina = { x: e.clientX, y: e.clientY }; });
  canvas.onwheel = (e) => { vista.dist = Math.max(2, Math.min(40, vista.dist * (e.deltaY > 0 ? 1.1 : 0.9))); };

  let ultimo = performance.now() / 1000;
  const giro = () => {
    const ora = performance.now() / 1000, dt = Math.min(0.1, ora - ultimo); ultimo = ora;
    acc += dt;
    while (acc >= 1 / HZ) { attori.tick(vistaAl(tick++)); acc -= 1 / HZ; }
    attori.update(acc * HZ, dt, ora - t0, { x: 0, z: 40 });
    const w = innerWidth, h = innerHeight; if (canvas.width !== Math.floor(w * gl.getPixelRatio())) gl.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    cam.position.set(Math.sin(vista.yaw) * Math.cos(vista.pitch) * vista.dist, vista.ty + Math.sin(vista.pitch) * vista.dist, Math.cos(vista.yaw) * Math.cos(vista.pitch) * vista.dist);
    cam.lookAt(0, vista.ty, 0);
    gl.render(scene, cam);
    requestAnimationFrame(giro);
  };
  requestAnimationFrame(giro);
  const api = {
    get pronto() { return stato.pronto; },
    dungeon: (d: string) => { stato.dungeon = d; rifai(); aggiorna(); },
    stato: (s: Stato) => { stato.s = s; rifai(); aggiorna(); },
    solo: (id: string | null) => { stato.solo = id; rifai(); },
    camera: (yaw: number, pitch: number, dist: number, ty = 1.2) => Object.assign(vista, { yaw, pitch, dist, ty }),
  };
  (window as unknown as { __nemici: typeof api }).__nemici = api;
  stato.pronto = true;
}
void main();
