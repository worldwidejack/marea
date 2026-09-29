// Orchestrazione del mondo locale: mappa, isola, avatar, barca, camera, rete. WP0.
import * as THREE from 'three';
import { canBoard, landingSpot, parseIsland, NO_INPUT } from '@marea/sim';
import type { GridMap, InputFrame } from '@marea/sim';
import { ISLANDS } from '@marea/content';
import type { Look, Peer } from '@marea/protocol';
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
export type GameWorld = { map: GridMap; avatar: Avatar; boat: Boat; net: NetClient; mode: Mode; step(input: InputFrame): void; update(alpha: number, dt: number, t: number): void; dispose(): void };

/** Un altro giocatore: avatar a piedi e, solo quando serve, una barca col suo guidatore. La barca sta in `boatAt` (posizione) e ruota con setYaw. */
type Remote = { avatar: Avatar; look: string; boat: Boat | null; boatAt: THREE.Group | null; loadingBoat: boolean };

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
  avatar.setGround(island.groundY);
  const boat = await createBoat({ loader: o.loader, x: map.boatSpawn.x, z: map.boatSpawn.z, look }); scene.add(boat.object);
  const dock = landingSpot(boat.state, map);
  if (dock) boat.setYaw(Math.atan2(boat.state.x - dock.x, -(boat.state.z - dock.z))); // muso verso il mare aperto, non contro il molo
  const net = createNetClient({ url: '/ws/zone/' + o.flags.zone, token: o.flags.token, build: o.build, enabled: o.flags.net });
  net.connect();

  // ---- peer: creati al primo avvistamento (async), aggiornati ogni frame con peerAt (150 ms nel passato), tolti quando spariscono dalla lista
  const remotes = new Map<string, Remote>(), pending = new Set<string>();
  const addRemote = async (p: Peer) => {
    pending.add(p.id);
    try {
      const a = await createAvatar({ loader: o.loader, look: p.look, x: p.x, z: p.z });
      if (!pending.has(p.id)) return; // se n'è andato mentre caricava
      a.setGround(island.groundY); a.object.name = 'peer_' + p.id; scene.add(a.object);
      remotes.set(p.id, { avatar: a, look: JSON.stringify(p.look), boat: null, boatAt: null, loadingBoat: false });
    } finally { pending.delete(p.id); }
  };
  const remoteBoat = async (r: Remote, p: Peer) => {
    r.loadingBoat = true;
    const b = await createBoat({ loader: o.loader, x: 0, z: 0, look: p.look });
    const at = new THREE.Group(); at.name = 'peer_barca_' + p.id; at.add(b.object);
    b.setDriver(r.avatar.state, p.look); r.boat = b; r.boatAt = at; r.loadingBoat = false;
    if (remotes.get(p.id) === r) scene.add(at);
  };
  const dropRemote = (id: string) => {
    pending.delete(id);
    const r = remotes.get(id); if (!r) return;
    scene.remove(r.avatar.object); if (r.boatAt) scene.remove(r.boatAt);
    remotes.delete(id);
  };
  const unsubLeave = net.on('leave', (m) => dropRemote(m.id));
  const updateRemotes = (dt: number, t: number) => {
    const list = net.peers(), seen = new Set<string>();
    for (const p of list) {
      seen.add(p.id);
      const r = remotes.get(p.id);
      if (!r) { if (!pending.has(p.id)) void addRemote(p); continue; }
      const key = JSON.stringify(p.look);
      if (key !== r.look) { r.look = key; r.avatar.setLook(p.look); r.boat?.driver.setLook(p.look); }
      const pose = net.peerAt(p.id); if (!pose) continue;
      const inBoat = pose.mode === 'boat';
      r.avatar.visible = !inBoat;
      if (inBoat && !r.boat && !r.loadingBoat) void remoteBoat(r, p);
      if (r.boat && r.boatAt) {
        r.boatAt.visible = inBoat;
        if (inBoat) { r.boatAt.position.set(pose.x, 0, pose.z); r.boat.setYaw(pose.yaw); r.boat.update(1, dt, t); }
      }
      if (!inBoat) r.avatar.setPose(pose);
      r.avatar.update(1, dt);
    }
    for (const id of remotes.keys()) if (!seen.has(id)) dropRemote(id);
  };

  let mode: Mode = 'walk', aWas = false, lastSent = 0;
  const state = {
    map, avatar, boat, net,
    get mode() { return mode; },
    step(input: InputFrame) {
      const pressA = input.a && !aWas; aWas = input.a;
      if (mode === 'walk') {
        avatar.step(input, map);
        boat.step(NO_INPUT, map);
        if (pressA && canBoard(avatar.state, boat.state, map)) { mode = 'boat'; boat.setDriver(avatar.state, look); avatar.visible = false; o.hud.toast('Sei in barca: A per accelerare, joystick per virare'); }
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
      updateRemotes(dt, t);
      const f = mode === 'walk' ? avatar.object.position : boat.object.position;
      diorama.follow(f.x, 0.5, f.z); diorama.update(dt);
      lights.sun.position.set(f.x - 30, 40, f.z + 20); lights.sun.target.position.set(f.x, 0, f.z);
    },
    dispose() { unsubLeave(); net.close(); for (const id of [...remotes.keys()]) dropRemote(id); pending.clear(); },
  } as GameWorld;
  registerStateProvider('avatar', () => ({ ...avatar.state }));
  registerStateProvider('boat', () => ({ ...boat.state }));
  registerStateProvider('mode', () => mode);
  registerStateProvider('camera', () => ({ zoom: diorama.zoom, x: diorama.camera.position.x, y: diorama.camera.position.y, z: diorama.camera.position.z }));
  registerStateProvider('net', () => ({ status: net.status, peers: net.peers().length, error: net.lastError }));
  registerStateProvider('peersDrawn', () => [...remotes.entries()].map(([id, r]) => ({ id, x: r.avatar.object.position.x, z: r.avatar.object.position.z, walk: r.avatar.visible, boat: !!r.boatAt?.visible })));
  registerStateProvider('island', () => ({ id: map.id, w: map.w, h: map.h, spawn: map.spawn }));
  registerTestHook('teleport', (x, z) => avatar.teleport(Number(x), Number(z)));
  registerTestHook('setZoom', (z) => diorama.setZoom(Number(z)));
  registerTestHook('setMode', (m) => { if (m === 'boat') { mode = 'boat'; boat.setDriver(avatar.state, look); avatar.visible = false; } else { mode = 'walk'; boat.setDriver(null); avatar.visible = true; avatar.teleport(map.spawn.x, map.spawn.z); } });
  return state;
}
