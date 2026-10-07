// Orchestrazione del mondo locale: arcipelago (un solo GridMap continuo), isole, avatar, barca, camera, rete. WP0 / M1-mondo.
// Spawn sul molo del proprio lotto (`slot`), barca ormeggiata lì; senza slot al Porto.
import * as THREE from 'three';
import { canBoard, composeArchipelago, landingSpot, NO_INPUT } from '@marea/sim';
import type { Archipelago, ArchPlace, BoatState, GridMap, InputFrame } from '@marea/sim';
import { ARCHIPELAGO, ISLANDS } from '@marea/content';
import type { Look, Peer } from '@marea/protocol';
import type { Flags } from '../flags.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import { createLights } from '../render/light.ts';
import type { Lights } from '../render/light.ts';
import type { Water } from '../render/water.ts';
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
export type GameWorld = {
  map: GridMap; avatar: Avatar; boat: Boat; net: NetClient; mode: Mode;
  /** Il mondo composto (lotti, Porto, laguna, facciate) e la scena three: li usa la vista del lotto (game/lot.ts). */
  archipelago: Archipelago; scene: THREE.Scene;
  /** Lo slot del lotto di chi gioca (null = nessun lotto, spawn al Porto). */
  slot: number | null;
  /** Quota del terreno in (x, z): piano delle isole, cima delle rocce, 0 in acqua. */
  groundY(x: number, z: number): number;
  /** Luci e acqua del mondo: le ricolora il ciclo giorno/notte delle impostazioni (render/aspetto.ts, #53). */
  lights: Lights; water: Water;
  step(input: InputFrame): void; update(alpha: number, dt: number, t: number): void; dispose(): void;
  /** Fermo (Tavolo, editor o feed aperti): l'avatar e la barca ignorano l'input. */
  frozen: boolean;
  /** Look di chi gioca (da /api/me); setLook lo applica ad avatar e guidatore della barca (F3, editor dal vivo). */
  readonly look: Look;
  setLook(l: Look): void;
  /** Punto sopra la testa (mondo): 'me' oppure l'id di un peer; in barca sopra la barca. null se non c'è. */
  anchorOf(id: 'me' | string): { x: number; y: number; z: number } | null;
  /** Regata (F2): la barca la muove la sim del minigioco (game/regata.ts); il mondo la disegna, la segue con la camera e manda la posizione. */
  race: {
    readonly on: boolean;
    /** Sale in barca e la porta in (x, z) con la prua a `yaw`, ricordando dov'eri. */
    begin(x: number, z: number, yaw: number): void;
    /** Un tick della sim, in coordinate mondo. */
    set(s: BoatState): void;
    /** Torna dov'eri prima della gara. */
    end(): void;
  };
};

/** Adattatore finché main.ts non passa lo slot da /api/me: `?slot=N` nell'URL. */
function slotFromUrl(): number | null {
  try {
    const v = new URLSearchParams(location.search).get('slot');
    if (v === null || v === '') return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch { return null; }
}

/** Un altro giocatore: avatar a piedi e, solo quando serve, una barca col suo guidatore. La barca sta in `boatAt` (posizione) e ruota con setYaw. */
type Remote = { avatar: Avatar; look: string; boat: Boat | null; boatAt: THREE.Group | null; loadingBoat: boolean };

const DEFAULT_LOOK: Look = { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 1 }; // avatar A (Sessione 2)
const HEAD_Y = 1.9, BOAT_TOP_Y = 1.5; // metri sopra il piede dell'avatar / la barca, per fumetti ed etichette

export async function createGameWorld(o: { renderer: Renderer; loader: Loader; flags: Flags; hud: Hud; build: string; slot?: number | null; look?: Look }): Promise<GameWorld> {
  const arch = composeArchipelago(ARCHIPELAGO, ISLANDS);
  const map = arch.map;
  let slot = o.slot !== undefined ? o.slot : slotFromUrl();
  if (slot !== null && !arch.lots.some((l) => l.slot === slot)) slot = null;
  const home = arch.spawnOf(slot), homeBoat = arch.boatOf(slot);
  const { scene, diorama } = o.renderer;
  const lights = createLights(); scene.add(lights.group);
  const water = createWater({ size: 0 }); water.follow(home.x, home.z); scene.add(water.mesh);
  const island = await createIsland({
    map, loader: o.loader,
    areas: arch.places.map((p) => ({ id: p.island + (p.slot !== null ? '_' + p.slot : ''), x0: p.origin[0], z0: p.origin[1], w: p.w, h: p.h, style: p.style, scenery: p.scenery })),
    props: arch.props, buildings: arch.buildings, paved: arch.paved,
  });
  scene.add(island.group);
  let look: Look = o.look ?? DEFAULT_LOOK;
  const avatar = await createAvatar({ loader: o.loader, look, x: home.x, z: home.z }); scene.add(avatar.object);
  avatar.setGround(island.groundY);
  const boat = await createBoat({ loader: o.loader, x: homeBoat.x, z: homeBoat.z, look }); scene.add(boat.object);
  /** Ormeggia la barca in (x, z) col muso verso il mare aperto, non contro il molo. */
  const moor = (x: number, z: number) => {
    boat.teleport(x, z);
    const dock = landingSpot(boat.state, map);
    if (dock) boat.setYaw(Math.atan2(boat.state.x - dock.x, -(boat.state.z - dock.z)));
  };
  moor(homeBoat.x, homeBoat.z);
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

  let mode: Mode = 'walk', aWas = false, lastSent = 0, frozen = false;
  let racing: { mode: Mode; avatar: { x: number; z: number }; boat: { x: number; z: number; yaw: number } } | null = null;
  const race: GameWorld['race'] = {
    get on() { return !!racing; },
    begin(x, z, yaw) {
      if (!racing) racing = { mode, avatar: { x: avatar.state.x, z: avatar.state.z }, boat: { x: boat.state.x, z: boat.state.z, yaw: boat.state.yaw } };
      mode = 'boat'; boat.setDriver(avatar.state, look); avatar.visible = false;
      boat.teleport(x, z, yaw); avatar.teleport(x, z);
      diorama.follow(x, 0.5, z); diorama.snap?.();
    },
    set(s) {
      // boat.setState (F3-pulizia, CONTRACTS §13): prev = state, state = s. Finché non c'è, l'adattatore di prima: step a vuoto
      // (prev = stato del tick prima) e poi si sovrascrive lo stato nuovo con quello della sim, così interpolazione, scia e remi seguono.
      const b = boat as Boat & { setState?(st: BoatState): void };
      if (typeof b.setState === 'function') b.setState({ ...s });
      else { boat.step(NO_INPUT, map); Object.assign(boat.state, s); }
      avatar.teleport(s.x, s.z);
    },
    end() {
      const r = racing; if (!r) return;
      racing = null;
      boat.setDriver(null);
      if (r.mode === 'walk') { mode = 'walk'; avatar.visible = true; avatar.teleport(r.avatar.x, r.avatar.z); moor(r.boat.x, r.boat.z); }
      else { mode = 'boat'; boat.setDriver(avatar.state, look); boat.teleport(r.boat.x, r.boat.z, r.boat.yaw); avatar.teleport(r.boat.x, r.boat.z); }
      const f = mode === 'walk' ? avatar.state : boat.state;
      diorama.follow(f.x, 0.5, f.z); diorama.snap?.();
    },
  };
  const state = {
    map, avatar, boat, net, archipelago: arch, scene, slot, groundY: island.groundY, race, lights, water,
    get mode() { return mode; },
    get frozen() { return frozen; },
    set frozen(v: boolean) { frozen = v; },
    get look() { return look; },
    setLook(l) { look = l; avatar.setLook(l); boat.driver.setLook(l); },
    anchorOf(id) {
      if (id === 'me') { const p = mode === 'boat' ? boat.object.position : avatar.object.position; return { x: p.x, y: p.y + (mode === 'boat' ? BOAT_TOP_Y : HEAD_Y), z: p.z }; }
      const r = remotes.get(id); if (!r) return null;
      if (r.boatAt?.visible) return { x: r.boatAt.position.x, y: r.boatAt.position.y + BOAT_TOP_Y, z: r.boatAt.position.z };
      const p = r.avatar.object.position; return { x: p.x, y: p.y + HEAD_Y, z: p.z };
    },
    step(input: InputFrame) {
      if (frozen || racing) input = NO_INPUT; // la gara muove la barca da sé (race.set); col Tavolo aperto l'avatar sta fermo
      const pressA = input.a && !aWas; aWas = input.a;
      if (racing) {
        // niente: la barca l'ha già posata race.set
      } else if (mode === 'walk') {
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
      water.follow(f.x, f.z);
    },
    dispose() { unsubLeave(); net.close(); for (const id of [...remotes.keys()]) dropRemote(id); pending.clear(); },
  } as GameWorld;
  registerStateProvider('avatar', () => ({ ...avatar.state }));
  registerStateProvider('boat', () => ({ ...boat.state }));
  registerStateProvider('mode', () => mode);
  registerStateProvider('camera', () => ({ zoom: diorama.zoom, x: diorama.camera.position.x, y: diorama.camera.position.y, z: diorama.camera.position.z }));
  registerStateProvider('net', () => ({ status: net.status, peers: net.peers().length, error: net.lastError }));
  registerStateProvider('peersDrawn', () => [...remotes.entries()].map(([id, r]) => ({ id, x: r.avatar.object.position.x, z: r.avatar.object.position.z, walk: r.avatar.visible, boat: !!r.boatAt?.visible })));
  // `island.spawn` = dove si nasce (il molo del proprio lotto o il Porto); `island.dock` = il punto del molo accanto alla barca ormeggiata.
  let spawnAt = { ...home }, dockAt = landingSpot(boat.state, map) ?? home;
  registerStateProvider('island', () => ({ id: map.id, w: map.w, h: map.h, tile: map.tile, spawn: spawnAt, dock: dockAt }));
  registerStateProvider('arch', () => ({ slot, place: arch.placeAt(avatar.state.x, avatar.state.z)?.island ?? null, lots: arch.lots.length, chunks: island.chunks?.map((c) => ({ id: c.id, tris: c.tris, visible: c.group.visible })) }));
  /** Porta a piedi sulla P di un'isola ('porto', 'laguna', 'neon', 'selvaggia', 'lotto:N') con la barca ormeggiata alla sua B. */
  const goto = (name: unknown): ArchPlace | null => {
    const n = String(name);
    const m = /^lotto:(\d+)$/.exec(n);
    const place = m ? arch.places.find((p) => p.role === 'lotto' && p.slot === Number(m[1])) : arch.places.find((p) => p.island === n || p.role === n);
    if (!place) return null;
    mode = 'walk'; boat.setDriver(null); avatar.visible = true;
    avatar.teleport(place.spawn.x, place.spawn.z); moor(place.boat.x, place.boat.z);
    spawnAt = { ...place.spawn }; dockAt = landingSpot(boat.state, map) ?? place.spawn;
    diorama.follow(place.spawn.x, 0.5, place.spawn.z); diorama.snap?.();
    return place;
  };
  registerTestHook('teleport', (x, z) => avatar.teleport(Number(x), Number(z)));
  registerTestHook('setZoom', (z) => diorama.setZoom(Number(z)));
  registerTestHook('setMode', (m) => { if (m === 'boat') { mode = 'boat'; boat.setDriver(avatar.state, look); avatar.visible = false; } else { mode = 'walk'; boat.setDriver(null); avatar.visible = true; avatar.teleport(spawnAt.x, spawnAt.z); } });
  registerTestHook('goto', (name) => { const p = goto(name); return p ? { island: p.island, slot: p.slot, x: p.spawn.x, z: p.spawn.z } : null; });
  return state;
}
