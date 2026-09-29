// Avvio del client: renderer, mondo, ciclo a 60 Hz con interpolazione, test API. Unico modulo con side effect.
import { DT } from '@marea/sim';
import { FLAGS } from './flags.ts';
import { createRenderer } from './render/scene.ts';
import { createLoader } from './render/loader.ts';
import { createInput } from './game/input.ts';
import { createGameWorld } from './game/world.ts';
import { createHud } from './ui/hud.ts';
import { installTestApi, registerPerfProvider, setReady } from './test/testapi.ts';

async function boot(): Promise<void> {
  installTestApi(__BUILD__);
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const root = document.getElementById('ui') as HTMLElement;
  const hud = createHud({ root, flags: FLAGS });
  const renderer = createRenderer({ canvas, flags: FLAGS });
  registerPerfProvider(() => renderer.stats());
  const loader = await createLoader({ base: '/assets/' });
  const input = createInput({ canvas, root, cameraYaw: () => renderer.diorama.yaw });
  const world = await createGameWorld({ renderer, loader, flags: FLAGS, hud, build: __BUILD__ });
  let last = performance.now(), acc = 0, t = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt; t += dt;
    let steps = 0;
    while (acc >= DT && steps < 5) { world.step(input.sample()); acc -= DT; steps++; }
    if (steps === 5) acc = 0;
    world.update(acc / DT, dt, t);
    renderer.render(acc / DT, t);
    hud.setPerf(renderer.stats());
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  setReady();
  hud.toast('MAREA · prova del look', 2500);
  console.log(`[marea] build ${__BUILD__} · isola ${world.map.id} ${world.map.w}×${world.map.h}`);
}
boot().catch((e) => { console.error('[marea] avvio fallito', e); document.body.insertAdjacentHTML('beforeend', `<pre style="color:#F4E3C1;padding:16px">Qualcosa è andato storto all'avvio.\n${String(e)}</pre>`); });
