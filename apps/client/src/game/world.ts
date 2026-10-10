// Orchestrazione del mondo locale: arcipelago (un solo GridMap continuo), isole, avatar, barca, camera, rete. WP0 / M1-mondo.
// Spawn sul molo del proprio lotto (`slot`), barca ormeggiata lì; senza slot al Porto.
// Barche degli altri (#6, #107): chi naviga si vede dov'è, coi suoi colori; chi è a piedi (o offline) ha la barca ormeggiata al molo della
// SUA isola. La tua, quando è vuota e uno scafo altrui la tocca, si sposta al posto libero più vicino (ormeggioLibero): mai una sopra l'altra.
import * as THREE from 'three';
import { BARCA_DI_SERIE, barcaDi, barcheSovrapposte, canBoard, composeArchipelago, correnteBordo, landingSpot, NO_INPUT, ormeggioLibero, yawOrmeggio } from '@marea/sim';
import type { Archipelago, ArchPlace, BoatState, GridMap, InputFrame, Posa } from '@marea/sim';
import { ARCHIPELAGO, ISLANDS } from '@marea/content';
import type { BarcaLook, Indossa, Look, LookSalvato, Peer } from '@marea/protocol';
import type { Flags } from '../flags.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import { createLights } from '../render/light.ts';
import type { Lights } from '../render/light.ts';
import type { Water } from '../render/water.ts';
import { createWater } from '../render/water.ts';
import { createIsland } from '../render/island.ts';
import { LOD_M } from '../render/island_sagoma.ts';
import { INGRESSI } from './ingressi.ts';
import { PORTO_AMICI } from '@marea/content/porto_amici.ts';
import { GENTE } from '@marea/content/porto.ts';
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
  /** Equipaggiamento di chi gioca (`hero.equip` del lotto): armatura sul corpo e arma sulla schiena (#190), su avatar e guidatore della barca. Si può
   *  chiamare di continuo: rifà qualcosa solo se quello che si vede è cambiato. */
  setEquip(equip: Readonly<Partial<Record<string, string>>> | 'partenza' | undefined): void;
  /** Punto sopra la testa (mondo): 'me' oppure l'id di un peer; in barca sopra la barca. null se non c'è. */
  anchorOf(id: 'me' | string): { x: number; y: number; z: number } | null;
  /** Gesto delle emote (#90) sull'avatar a piedi di 'me' o di un peer: saltello `hop` (m) e giro `spin` (rad); (0, 0) lo riporta fermo. */
  gesto(id: 'me' | string, hop: number, spin: number): void;
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
  /** Isole a tema (#68): vincolo sulla barca dopo ogni passo (barriere in mare: game/temi.ts) e «rimettiti in barca» (il Vulcano ti caccia). */
  vincoloBarca: ((prev: BoatState, next: BoatState) => BoatState | null) | null;
  reimbarca(): boolean;
  /** A piedi sull'isola `id` (es. 'templari'), con la barca ormeggiata al suo molo: per i bottoni delle prove. null se non c'è. */
  vai(id: string): ArchPlace | null;
  /** La tua barca (#107): colori e nome; setBarca la ridipinge (anteprima dell'editor, dopo il salvataggio). */
  readonly barca: BarcaLook;
  setBarca(b: BarcaLook): void;
};
/** Chi abita un'isola (GET /api/lots): la sua barca sta ormeggiata al suo molo quando non naviga (#6). */
export type Abitante = { id: string; slot: number | null; look?: LookSalvato };

/** Adattatore finché main.ts non passa lo slot da /api/me: `?slot=N` nell'URL. */
function slotFromUrl(): number | null {
  try {
    const v = new URLSearchParams(location.search).get('slot');
    if (v === null || v === '') return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch { return null; }
}

/** Un altro giocatore collegato: l'avatar a piedi (la barca sta nella flotta). */
type Remote = { avatar: Avatar; look: string };
/** La barca di un altro (#6): creata la prima volta che serve; `at` ne porta la posizione, `naviga` = c'è lui al timone. */
type BarcaAltrui = { boat: Boat | null; at: THREE.Group | null; loading: boolean; look: string; naviga: boolean; posa: Posa | null };
/** Oltre questa distanza da chi gioca le barche ormeggiate degli amici non si disegnano (e non si creano). */
const VISTA_ORMEGGI_M = 150;

const DEFAULT_LOOK: Look = { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 1 }; // avatar A (Sessione 2)
const HEAD_Y = 1.9, BOAT_TOP_Y = 1.5; // metri sopra il piede dell'avatar / la barca, per fumetti ed etichette

export async function createGameWorld(o: { renderer: Renderer; loader: Loader; flags: Flags; hud: Hud; build: string; slot?: number | null; look?: Look; barca?: BarcaLook; meId?: string; abitanti?: readonly Abitante[] }): Promise<GameWorld> {
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
    // davanti agli ingressi dei dungeon niente scenografia (prima la toglieva ingressi.ts dagli InstancedMesh: ora i prop sono fusi)
    libere: [
      ...INGRESSI.flatMap((d) => { const p = arch.places.find((q) => q.island === d.island); return p ? [{ x: (p.origin[0] + d.at[0] + 0.5) * arch.tile, z: (p.origin[1] + d.at[1] + 0.5) * arch.tile, r: 6 }] : []; }),
      // Porto tra amici (#110 #111): niente palme né sassi sul Tabellone dei record e attorno al Faro comune
      // e il banco del Contrabbandiere accanto alla Grotta
      ...[PORTO_AMICI.tabellone.at, PORTO_AMICI.faro.at, PORTO_AMICI.faro.fronte, GENTE.posti.contrabbando.at, GENTE.posti.contrabbando.fronte].flatMap((c) => { const p = arch.places.find((q) => q.role === 'porto'); return p ? [{ x: (p.origin[0] + c[0] + 0.5) * arch.tile, z: (p.origin[1] + c[1] + 0.5) * arch.tile, r: 3.5 }] : []; }),
    ],
  });
  scene.add(island.group);
  // prima di ogni render: si disegnano solo le isole nell'inquadratura, da lontano la sagoma (render/island.ts, TECH §5);
  // gli edifici dei lotti (game/lot.ts, gruppi «lot_*» nella scena) stanno nella loro isola: fuori inquadratura o oltre LOD_M non si disegnano
  const lotti = { box: new Map<THREE.Object3D, THREE.Box3>(), frame: 0 }, fr = new THREE.Frustum(), pv = new THREE.Matrix4();
  island.group.userData.preRender = () => {
    const cam = o.renderer.camera;
    island.cull?.(cam);
    const rifai = lotti.frame++ % 30 === 0; // gli edifici cambiano di rado: la scatola si rifà ogni mezzo secondo
    fr.setFromProjectionMatrix(pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    for (const g of scene.children) {
      if (!g.name.startsWith('lot_')) continue;
      let b = lotti.box.get(g);
      if (!b || rifai) { g.visible = true; b = new THREE.Box3().setFromObject(g); lotti.box.set(g, b); }
      if (b.isEmpty()) continue;
      const dx = Math.max(b.min.x - cam.position.x, 0, cam.position.x - b.max.x), dz = Math.max(b.min.z - cam.position.z, 0, cam.position.z - b.max.z);
      g.visible = fr.intersectsBox(b) && Math.hypot(dx, dz) < LOD_M;
    }
  };
  let look: Look = o.look ?? DEFAULT_LOOK, equipKey = 'null';
  const avatar = await createAvatar({ loader: o.loader, look, x: home.x, z: home.z }); scene.add(avatar.object);
  avatar.setGround(island.groundY);
  const boat = await createBoat({ loader: o.loader, x: homeBoat.x, z: homeBoat.z, look, barca: o.barca ?? BARCA_DI_SERIE }); scene.add(boat.object);
  const setEquip = (e: Readonly<Partial<Record<string, string>>> | 'partenza' | undefined): void => {
    const i: Indossa | 'partenza' | undefined = e === 'partenza' ? e : e && (e['corpo'] || e['arma'] || e['frecce']) ? { corpo: e['corpo'], arma: e['arma'], frecce: e['frecce'] } : undefined, k = JSON.stringify(i ?? null);
    if (k !== equipKey) { equipKey = k; avatar.setIndossa(i); boat.driver.setIndossa(i); }
  };
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
      a.setIndossa(p.indossa);
      remotes.set(p.id, { avatar: a, look: JSON.stringify([p.look, p.indossa ?? null]) });
    } finally { pending.delete(p.id); }
  };
  const dropRemote = (id: string) => {
    pending.delete(id);
    const r = remotes.get(id); if (!r) return;
    scene.remove(r.avatar.object);
    remotes.delete(id);
  };
  const unsubLeave = net.on('leave', (m) => dropRemote(m.id));

  // ---- flotta (#6, #107): la barca di ogni altro, al timone dove naviga o ormeggiata al molo della sua isola
  const abitanti = new Map((o.abitanti ?? []).filter((a) => a.id !== o.meId).map((a) => [a.id, a] as const));
  const ormeggioDi = new Map<string, Posa>();
  for (const a of abitanti.values()) {
    if (a.slot === null || !arch.lots.some((l) => l.slot === a.slot)) continue;
    const b = arch.boatOf(a.slot);
    ormeggioDi.set(a.id, { x: b.x, z: b.z, yaw: yawOrmeggio(b.x, b.z, map) });
  }
  const flotta = new Map<string, BarcaAltrui>();
  const creaBarca = async (id: string, f: BarcaAltrui, look: Look, barca: BarcaLook) => {
    f.loading = true;
    try {
      const b = await createBoat({ loader: o.loader, x: 0, z: 0, look, barca });
      const at = new THREE.Group(); at.name = 'peer_barca_' + id; at.add(b.object); at.visible = false;
      f.boat = b; f.at = at; scene.add(at);
    } finally { f.loading = false; }
  };
  let focus = { x: home.x, z: home.z };
  const updateFlotta = (dt: number, t: number) => {
    const peers = new Map(net.peers().map((p) => [p.id, p] as const));
    for (const id of new Set([...abitanti.keys(), ...peers.keys()])) {
      const p = peers.get(id), pose = p ? net.peerAt(id) : null, naviga = pose?.mode === 'boat';
      const posa: Posa | null = naviga && pose ? { x: pose.x, z: pose.z, yaw: pose.yaw } : ormeggioDi.get(id) ?? null;
      let f = flotta.get(id);
      const vede = !!posa && (naviga || Math.hypot(posa.x - focus.x, posa.z - focus.z) < VISTA_ORMEGGI_M);
      if (!f) { if (!vede) continue; f = { boat: null, at: null, loading: false, look: '', naviga: false, posa: null }; flotta.set(id, f); }
      f.naviga = naviga; f.posa = vede ? posa : null;
      // collegato: la barca è quella della presenza (assente = di serie); offline: quella salvata in /api/lots
      const look = p?.look ?? abitanti.get(id)?.look ?? null, barca = p ? p.barca ?? BARCA_DI_SERIE : barcaDi(abitanti.get(id)?.look);
      if (!f.boat) { if (vede && !f.loading && look) void creaBarca(id, f, look, barca); continue; }
      if (!f.at) continue;
      f.boat.setBarca(barca);
      const indossa = p ? p.indossa : abitanti.get(id)?.look?.indossa, key = JSON.stringify([look, indossa ?? null]); // collegato: l'equipaggiamento della presenza; offline: quello salvato
      if (look && key !== f.look) { f.look = key; f.boat.driver.setLook(look); f.boat.driver.setIndossa(indossa); }
      f.at.visible = vede;
      if (!vede || !posa) continue;
      const r = remotes.get(id);
      f.boat.setDriver(naviga && r ? r.avatar.state : null);
      f.at.position.set(posa.x, 0, posa.z); f.boat.setYaw(posa.yaw); f.boat.update(1, dt, t);
    }
  };
  const updateRemotes = (dt: number, t: number) => {
    const list = net.peers(), seen = new Set<string>();
    for (const p of list) {
      seen.add(p.id);
      const r = remotes.get(p.id);
      if (!r) { if (!pending.has(p.id)) void addRemote(p); continue; }
      const key = JSON.stringify([p.look, p.indossa ?? null]);
      if (key !== r.look) { r.look = key; r.avatar.setLook(p.look); r.avatar.setIndossa(p.indossa); }
      const pose = net.peerAt(p.id); if (!pose) continue;
      const inBoat = pose.mode === 'boat';
      r.avatar.visible = !inBoat;
      if (!inBoat) r.avatar.setPose(pose);
      r.avatar.update(1, dt);
    }
    for (const id of remotes.keys()) if (!seen.has(id)) dropRemote(id);
    updateFlotta(dt, t);
  };
  /** Barche degli altri che si vedono adesso (per l'ormeggio libero e i test). */
  const altreBarche = (): (Posa & { id: string; naviga: boolean })[] =>
    [...flotta.entries()].flatMap(([id, f]) => (f.at?.visible && f.posa ? [{ id, ...f.posa, naviga: f.naviga }] : []));
  // la tua barca vuota si scansa se uno scafo altrui la tocca per più di mezzo secondo (chi ormeggia accanto, chi ci si ferma sopra)
  let liberaT = 0, toccataT = 0;
  const liberaOrmeggio = (dt: number) => {
    liberaT += dt;
    if (liberaT < 0.25) return;
    const passo = liberaT; liberaT = 0;
    if (mode !== 'walk' || racing) { toccataT = 0; return; }
    const mia = { x: boat.state.x, z: boat.state.z, yaw: boat.state.yaw }, altre = altreBarche();
    if (!altre.some((b) => barcheSovrapposte(mia, b))) { toccataT = 0; return; }
    toccataT += passo;
    if (toccataT < 0.5) return;
    toccataT = 0;
    const p = ormeggioLibero(map, mia.x, mia.z, altre);
    if (p) { boat.teleport(p.x, p.z, p.yaw); dockAt = landingSpot(boat.state, map) ?? dockAt; }
  };

  let mode: Mode = 'walk', aWas = false, lastSent = 0, frozen = false;
  // Isole a tema (#68) e bordo del mondo (#5): dopo il passo della barca la corrente al bordo e le barriere delle isole chiuse
  let vincoloBarca: GameWorld['vincoloBarca'] = null, bordoToast = 0;
  const dopoBarca = () => {
    const c = correnteBordo(boat.state, map);
    if (c.attiva) { Object.assign(boat.state, c.s); if (performance.now() > bordoToast) { bordoToast = performance.now() + 8000; o.hud.toast('La corrente ti riporta verso le isole', 2500); } }
    const v = vincoloBarca?.(boat.prev, boat.state); if (v) Object.assign(boat.state, v);
  };
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
    get barca() { return boat.barca; },
    setBarca(b: BarcaLook) { boat.setBarca(b); },
    get mode() { return mode; },
    get frozen() { return frozen; },
    set frozen(v: boolean) { frozen = v; },
    get look() { return look; },
    get vincoloBarca() { return vincoloBarca; },
    set vincoloBarca(f) { vincoloBarca = f; },
    vai(id) { return racing ? null : goto(id); },
    reimbarca() {
      if (mode !== 'walk' || racing) return false;
      moor(boat.state.x, boat.state.z); // prua verso il largo
      mode = 'boat'; boat.setDriver(avatar.state, look); avatar.visible = false; avatar.teleport(boat.state.x, boat.state.z);
      return true;
    },
    setLook(l) { look = l; avatar.setLook(l); boat.driver.setLook(l); },
    setEquip,
    anchorOf(id) {
      if (id === 'me') { const p = mode === 'boat' ? boat.object.position : avatar.object.position; return { x: p.x, y: p.y + (mode === 'boat' ? BOAT_TOP_Y : HEAD_Y), z: p.z }; }
      const r = remotes.get(id); if (!r) return null;
      const f = flotta.get(id);
      if (f?.naviga && f.at?.visible) return { x: f.at.position.x, y: f.at.position.y + BOAT_TOP_Y, z: f.at.position.z };
      const p = r.avatar.object.position; return { x: p.x, y: p.y + HEAD_Y, z: p.z };
    },
    gesto(id, hop, spin) { (id === 'me' ? avatar : remotes.get(id)?.avatar)?.gesto(hop, spin); },
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
        boat.step(input, map); dopoBarca();
        avatar.teleport(boat.state.x, boat.state.z);
        if (pressA && boat.state.speed < 2) { const spot = landingSpot(boat.state, map); if (spot) { mode = 'walk'; boat.setDriver(null); avatar.visible = true; avatar.teleport(spot.x, spot.z); o.hud.toast('A terra'); } else o.hud.toast('Avvicinati a un molo per scendere'); }
      }
      const s = mode === 'walk' ? avatar.state : boat.state;
      if (net.status === 'on' && performance.now() - lastSent > 100) { lastSent = performance.now(); net.sendPos({ t: 'pos', x: s.x, z: s.z, yaw: s.yaw, mode, anim: mode === 'walk' ? avatar.state.anim : 'sit' }); }
    },
    update(alpha: number, dt: number, t: number) {
      avatar.update(alpha, dt); boat.update(alpha, dt, t); water.update(t); lights.update(t);
      updateRemotes(dt, t); liberaOrmeggio(dt);
      const f = mode === 'walk' ? avatar.object.position : boat.object.position;
      focus = { x: f.x, z: f.z };
      diorama.follow(f.x, 0.5, f.z); diorama.update(dt);
      lights.sun.position.set(f.x - 30, 40, f.z + 20); lights.sun.target.position.set(f.x, 0, f.z);
      water.follow(f.x, f.z);
    },
    dispose() { unsubLeave(); net.close(); for (const id of [...remotes.keys()]) dropRemote(id); pending.clear(); for (const f of flotta.values()) if (f.at) scene.remove(f.at); flotta.clear(); },
  } as GameWorld;
  registerStateProvider('avatar', () => ({ ...avatar.state }));
  registerStateProvider('boat', () => ({ ...boat.state }));
  registerStateProvider('mode', () => mode);
  registerStateProvider('camera', () => ({ zoom: diorama.zoom, x: diorama.camera.position.x, y: diorama.camera.position.y, z: diorama.camera.position.z }));
  registerStateProvider('net', () => ({ status: net.status, peers: net.peers().length, error: net.lastError }));
  registerStateProvider('peersDrawn', () => [...remotes.entries()].map(([id, r]) => ({ id, x: r.avatar.object.position.x, z: r.avatar.object.position.z, walk: r.avatar.visible, boat: !!(flotta.get(id)?.naviga && flotta.get(id)?.at?.visible) })));
  // barche (#6, #107): la tua (posa e colori) e quelle degli altri che si vedono; `sovrapposte` = la tua tocca uno scafo altrui
  registerStateProvider('barche', () => {
    const mia = { x: boat.state.x, z: boat.state.z, yaw: boat.state.yaw }, altre = altreBarche();
    return {
      mia: { ...mia, barca: boat.barca, vuota: mode === 'walk' }, sovrapposte: altre.some((b) => barcheSovrapposte(mia, b)),
      altre: altre.map((b) => ({ ...b, barca: flotta.get(b.id)?.boat?.barca ?? null })),
    };
  });
  // `island.spawn` = dove si nasce (il molo del proprio lotto o il Porto); `island.dock` = il punto del molo accanto alla barca ormeggiata.
  let spawnAt = { ...home }, dockAt = landingSpot(boat.state, map) ?? home;
  registerStateProvider('island', () => ({ id: map.id, w: map.w, h: map.h, tile: map.tile, spawn: spawnAt, dock: dockAt }));
  registerStateProvider('arch', () => ({ slot, place: arch.placeAt(avatar.state.x, avatar.state.z)?.island ?? null, lots: arch.lots.length, chunks: island.chunks?.map((c) => ({ id: c.id, tris: c.tris, visible: c.group.visible && c.group.parent?.visible !== false })) }));
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
  registerTestHook('peerIndossa', (id) => remotes.get(String(id))?.avatar.indossaStato() ?? null);
  registerTestHook('setEquip', (e) => setEquip(e as Record<string, string> | undefined)); // con ?test=1 e senza login (col login lo riallinea main.ts al personaggio vero)
  registerTestHook('setMode', (m) => { if (m === 'boat') { mode = 'boat'; boat.setDriver(avatar.state, look); avatar.visible = false; } else { mode = 'walk'; boat.setDriver(null); avatar.visible = true; avatar.teleport(spawnAt.x, spawnAt.z); } });
  registerTestHook('goto', (name) => { const p = goto(name); return p ? { island: p.island, slot: p.slot, x: p.spawn.x, z: p.spawn.z } : null; });
  /** Test (#6): sposta la tua barca in (x, z) con la prua a `yaw` (se ci sei sopra, anche te). */
  registerTestHook('barcaA', (x, z, yaw) => { boat.teleport(Number(x), Number(z), Number(yaw ?? 0)); if (mode === 'boat') avatar.teleport(Number(x), Number(z)); });
  /** Test (prestazioni): cosa si disegna nel prossimo frame, mesh per mesh, nella vista e nel passo delle ombre (triangoli per mesh). */
  registerTestHook('disegnati', () => new Promise((res) => {
    const vista = new Set<THREE.Mesh>(), ombra = new Set<THREE.Mesh>(), prima = new Map<THREE.Object3D, [THREE.Object3D['onBeforeRender'], THREE.Object3D['onBeforeShadow']]>();
    const nome = (n: THREE.Object3D) => { let p: THREE.Object3D | null = n, s = n.name || n.type; while ((p = p.parent)) if (p.name.startsWith('isola_')) { s = p.name + '/' + s; break; } return s; };
    const tri = (n: THREE.Mesh) => { const g = n.geometry, c = (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3; return Math.round(c * ((n as THREE.InstancedMesh).isInstancedMesh ? (n as THREE.InstancedMesh).count : 1)); };
    scene.traverse((n) => {
      if (!(n as THREE.Mesh).isMesh) return;
      prima.set(n, [n.onBeforeRender, n.onBeforeShadow]);
      n.onBeforeRender = () => { vista.add(n as THREE.Mesh); };
      n.onBeforeShadow = () => { ombra.add(n as THREE.Mesh); };
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      for (const [n, [a, b]] of prima) { n.onBeforeRender = a; n.onBeforeShadow = b; }
      const lista = (m: Set<THREE.Mesh>) => { const t = new Map<string, number>(); for (const n of m) t.set(nome(n), (t.get(nome(n)) ?? 0) + tri(n)); return [...t].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, t: v })); };
      res({ vista: lista(vista), ombra: lista(ombra) });
    }));
  }));
  return state;
}
