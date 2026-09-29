// Orchestrazione del mondo locale: mappa, isola, avatar, barca, camera, rete. WP0.
import * as THREE from 'three';
import { canBoard, landingSpot, parseIsland, NO_INPUT } from '@marea/sim';
import type { GridMap, InputFrame } from '@marea/sim';
import { ISLANDS } from '@marea/content';
import type { Look } from '@marea/protocol';
import type { Flags } from '../flags.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import { createLights } from '../render/light.ts';
import { createWater } from '../render/water.ts';
import { createIsland } from '../render/island.ts';
import { createAvatar } from '../game/avatar.ts';
import type { Avatar } from '../game/avatar.ts';
import { createBoat } from '../game/boat.ts';
import type { Boat } from '../game/boat.ts';
import { createNetClient } from '../net/client.ts';
import type { NetClient } from '../net/client.ts';
import type { Hud } from '../ui/hud.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type Mode = 'walk' | 'boat';
export type GameWorld = { map: GridMap; avatar: Avatar; boat: Boat; net: NetClient; mode: Mode; step(input: InputFrame): void; update(alpha: number, dt: number, t: number): void };

export async function createGameWorld(o: { renderer: Renderer; loader: Loader; flags: Flags; hud: Hud; build: string }): Promise<GameWorld> {
  const def = ISLANDS[0]; if (!def) throw new Error('Nessuna isola nei contenuti');
  const map = parseIsland(def);
  const { scene, diorama } = o.renderer;
  const lights = createLights(); scene.add(lights.group);
  const size = Math.max(map.w, map.h) * map.tile;
  const water = createWater({ size: size * 3 }); water.mesh.position.set(size / 2, 0, size / 2); scene.add(water.mesh);
  const island = await createIsland({ map, loader: o.loader }); scene.add(island.group);
  const look: Look = { pelle: 2, capelli: 0, coloreCapelli: 1, vestito: 0, cappello: 0 };
  const avatar = await createAvatar({ loader: o.loader, look, x: map.spawn.x, z: map.spawn.z }); scene.add(avatar.object);
  const boat = await createBoat({ loader: o.loader, x: map.boatSpawn.x, z: map.boatSpawn.z }); scene.add(boat.object);
  const dock = landingSpot(boat.state, map);
  if (dock) boat.setYaw(Math.atan2(boat.state.x - dock.x, -(boat.state.z - dock.z))); // muso verso il mare aperto, non contro il molo
  const net = createNetClient({ url: '/ws/zone/' + o.flags.zone, token: o.flags.token, build: o.build, enabled: o.flags.net });
  net.connect();
  let mode: Mode = 'walk', aWas = false, lastSent = 0;
  const state = {
    map, avatar, boat, net,
    get mode() { return mode; },
    step(input: InputFrame) {
      const pressA = input.a && !aWas; aWas = input.a;
      if (mode === 'walk') {
        avatar.step(input, map);
        boat.step(NO_INPUT, map);
        if (pressA && canBoard(avatar.state, boat.state, map)) { mode = 'boat'; boat.setDriver(avatar.state); avatar.visible = false; o.hud.toast('Sei in barca: A per accelerare, joystick per virare'); }
      } else {
        boat.step(input, map);
        avatar.teleport(boat.state.x, boat.state.z);
        if (pressA && boat.state.speed < 2) { const spot = landingSpot(boat.state, map); if (spot) { mode = 'walk'; boat.setDriver(null); avatar.visible = true; avatar.teleport(spot.x, spot.z); o.hud.toast('A terra'); } else o.hud.toast('Avvicinati a un molo per scendere'); }
      }
      const s = mode === 'walk' ? avatar.state : boat.state;
      if (net.status === 'on' && performance.now() - lastSent > 100) { lastSent = performance.now(); net.sendPos({ t: 'pos', x: s.x, z: s.z, yaw: s.yaw, mode, anim: mode === 'walk' ? avatar.state.anim : 'sit' }); }
    },
    update(alpha: number, dt: number, t: number) {
      avatar.update(alpha, dt); boat.update(alpha, dt, t); water.update(t); lights.update(t);
      const f = mode === 'walk' ? avatar.object.position : boat.object.position;
      diorama.follow(f.x, 0.5, f.z); diorama.update(dt);
      lights.sun.position.set(f.x - 30, 40, f.z + 20); lights.sun.target.position.set(f.x, 0, f.z);
    },
  } as GameWorld;
  registerStateProvider('avatar', () => ({ ...avatar.state }));
  registerStateProvider('boat', () => ({ ...boat.state }));
  registerStateProvider('mode', () => mode);
  registerStateProvider('camera', () => ({ zoom: diorama.zoom, x: diorama.camera.position.x, y: diorama.camera.position.y, z: diorama.camera.position.z }));
  registerStateProvider('net', () => ({ status: net.status, peers: net.peers().length, error: net.lastError }));
  registerStateProvider('island', () => ({ id: map.id, w: map.w, h: map.h, spawn: map.spawn }));
  registerTestHook('teleport', (x, z) => avatar.teleport(Number(x), Number(z)));
  registerTestHook('setZoom', (z) => diorama.setZoom(Number(z)));
  registerTestHook('setMode', (m) => { if (m === 'boat') { mode = 'boat'; avatar.visible = false; } else { mode = 'walk'; avatar.visible = true; avatar.teleport(map.spawn.x, map.spawn.z); } });
  void THREE;
  return state;
}
