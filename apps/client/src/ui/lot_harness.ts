// Pagina di prova di M1-isola (lot_harness.html): isola del template + vista economica, senza world.ts. Solo per i test e2e.
// URL: ?t=<token>&test=1 (propria isola) · &ro=<id persona> (visita in sola lettura) · &tpl=<id isola> (template, default lotto → prima isola).
import { parseIsland } from '@marea/sim';
import { ISLANDS } from '@marea/content';
import { FLAGS } from '../flags.ts';
import { createRenderer } from '../render/scene.ts';
import { createLoader } from '../render/loader.ts';
import { createLights } from '../render/light.ts';
import { createWater } from '../render/water.ts';
import { createIsland } from '../render/island.ts';
import { createInput } from '../game/input.ts';
import { createLotView } from '../game/lot.ts';
import { createApi } from '../net/api.ts';
import { createHud } from './hud.ts';
import { installTestApi, registerPerfProvider, registerTestHook, setReady } from '../test/testapi.ts';

async function boot(): Promise<void> {
  installTestApi(__BUILD__);
  const q = new URLSearchParams(location.search);
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const root = document.getElementById('ui') as HTMLElement;
  const hud = createHud({ root, flags: FLAGS });
  const renderer = createRenderer({ canvas, flags: FLAGS });
  registerPerfProvider(() => renderer.stats());
  const loader = await createLoader({ base: '/assets/' });
  createInput({ canvas, root, cameraYaw: () => renderer.diorama.yaw }); // joystick e A/B veri: il tap non deve pestarli
  const def = ISLANDS.find((i) => i.id === (q.get('tpl') ?? 'lotto')) ?? ISLANDS[0];
  if (!def) throw new Error('Nessuna isola');
  const map = parseIsland(def);
  const { scene, diorama } = renderer;
  const lights = createLights(); scene.add(lights.group);
  const size = Math.max(map.w, map.h) * map.tile;
  const water = createWater({ size: size * 3 }); water.mesh.position.set(size / 2, 0, size / 2); scene.add(water.mesh);
  const island = await createIsland({ map, loader }); scene.add(island.group);
  const ro = q.get('ro');
  const api = createApi({ token: FLAGS.token });
  const lot = createLotView({
    scene, loader, origin: [0, 0], tile: map.tile, api, hud, camera: renderer.camera, canvas, template: map, groundY: island.groundY,
    readonly: !!ro, owner: ro ?? undefined, ownerName: ro ?? undefined,
  });
  // camera sul baricentro degli slot (lì stanno gli edifici)
  const cx = map.lots.reduce((a, c) => a + c.cx + 0.5, 0) / Math.max(1, map.lots.length) * map.tile;
  const cz = map.lots.reduce((a, c) => a + c.cz + 0.5, 0) / Math.max(1, map.lots.length) * map.tile;
  let fx = cx, fz = cz;
  diorama.follow(fx, 0.5, fz); diorama.snap?.();
  registerTestHook('look', (x, z, zoom) => { fx = Number(x); fz = Number(z); if (zoom) diorama.setZoom(Number(zoom)); diorama.follow(fx, 0.5, fz); diorama.snap?.(); });
  let last = performance.now(), t = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
    lot.update(dt);
    water.update(t); lights.update(t);
    diorama.follow(fx, 0.5, fz); diorama.update(dt);
    lights.sun.position.set(fx - 30, 40, fz + 20); lights.sun.target.position.set(fx, 0, fz);
    renderer.render(1, t);
    hud.setPerf(renderer.stats());
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  await lot.ready;
  setReady();
  console.log(`[marea] prova isola ${map.id} · ${ro ? 'visita ' + ro : 'mia'}`);
}
boot().catch((e) => { console.error('[marea] prova isola fallita', e); });
