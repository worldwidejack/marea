// Avvio del client: renderer, mondo, ciclo a 60 Hz con interpolazione, test API. Unico modulo con side effect.
import { DT, barcaDi, canBoard } from '@marea/sim';
import { FLAGS } from './flags.ts';
import { preparaInstallazione } from './installa.ts';
import { createRenderer } from './render/scene.ts';
import { createLoader } from './render/loader.ts';
import { createInput } from './game/input.ts';
import { createGameWorld } from './game/world.ts';
import { createHud } from './ui/hud.ts';
import { createCompass } from './ui/compass.ts';
import type { Minimappa } from './ui/minimappa.ts';
import type { CompassSezione, CompassTarget } from './ui/compass.ts';
import { createApi } from './net/api.ts';
import { createLotView } from './game/lot.ts';
import type { LotView } from './game/lot.ts';
import { installTestApi, registerPerfProvider, registerStateProvider, registerTestHook, setReady } from './test/testapi.ts';
import { runRegata, setupRegata } from './game/regata.ts';
import { createTavolo } from './ui/tavolo.ts';
import { AVATAR, ISLANDS } from '@marea/content';
import type { EmoteId } from '@marea/protocol';
import { createEditor } from './ui/editor.ts';
import { createFeed } from './ui/feed.ts';
import { createEmotes } from './game/emote.ts';
import { setTopbarHidden } from './ui/topbar.ts';
import { entraConInvito } from './ui/entra.ts';
import { createMinigiochi } from './game/minigiochi.ts';
import { createGuida } from './ui/guida.ts';
import type { Guida, GuidaStep } from './ui/guida.ts';
import { createIngressi } from './game/ingressi.ts';
import { createEroe } from './ui/eroe.ts';
import { createPorto } from './game/porto.ts';
import { createPortoAmici } from './game/porto_amici.ts';
import { createImpostazioni } from './ui/impostazioni.ts';
import { createFoto } from './ui/foto.ts';
import { createDiario } from './game/diario.ts';
import { createTarghette } from './game/targhette.ts';
import { diarioOf, titoloDi } from '@marea/sim/economy/diario.ts';
import { collegaAudio } from './audio/ponte.ts';
import type { Aspetto } from './render/aspetto.ts';
import type { Animali } from './game/animali.ts';
import { tuttoSpento } from './render/viste.ts';
import type { Impostazioni } from './render/viste.ts';
import type { LotState } from '@marea/sim';
import { createTemi } from './game/temi.ts';
import type { PixId } from './ui/icons.ts';
import { RIENTRO } from '@marea/content';
import { createLibri } from './game/libro.ts';
import type { LibroIsola } from './game/libro.ts';

const TAVOLO_R = 3.5; // m: quanto vicino al Tavolo per aprirlo con E / A

async function boot(): Promise<void> {
  if (FLAGS.invito && !FLAGS.token) await entraConInvito(FLAGS.invito); // link di gruppo: prima il nome, poi si riparte col token
  installTestApi(__BUILD__);
  preparaInstallazione(); // l'icona sul telefono entra col proprio link
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const root = document.getElementById('ui') as HTMLElement;
  const hud = createHud({ root, flags: FLAGS });
  const renderer = createRenderer({ canvas, flags: FLAGS });
  registerPerfProvider(() => renderer.stats());
  const loader = await createLoader({ base: '/assets/' });
  const input = createInput({ canvas, root, cameraYaw: () => renderer.diorama.yaw });
  // chi sei e dove abiti (slot del lotto), prima del mondo: lo spawn è sul molo della tua isola
  const api = createApi({ token: FLAGS.token });
  const me = api.enabled && FLAGS.net ? await api.me().catch((e: Error) => { hud.banner?.(e.message); return null; }) : null;
  const owners = me ? await api.lots().catch(() => []) : [];
  let guideStep: string | null = null; // passo corrente della guida «Primi passi» (serve al lotto per lo slot suggerito)
  const world = await createGameWorld({ renderer, loader, flags: FLAGS, hud, build: __BUILD__, slot: me ? me.slot ?? null : undefined, ...(me ? { look: me.look, barca: barcaDi(me.look), meId: me.id } : {}), abitanti: owners }); // senza login: ?slot=N dall'URL (test), altrimenti Porto; la barca (#107) e gli ormeggi degli amici (#6)
  renderer.diorama.setZoom(1.6); // si parte larghi: l'isola e i suoi cartelli si vedono subito
  // il proprio lotto (azioni) e quelli degli altri (sola lettura); la guida suggerisce dove costruire la Segheria
  const lots: LotView[] = [];
  const HIDE = FLAGS.sfide ? [] : ['tavolo']; // senza sfide con posta il Tavolo sull'isola non serve
  const segCell = ISLANDS.find((i) => i.id === 'lotto')?.slots?.find((sl) => sl.kind === 'segheria')?.at ?? null;
  const myLot = () => lots.find((lv) => !lv.readonly)?.state() ?? null;
  const freeCell = (prefer: readonly [number, number] | null): [number, number] | null => {
    const l = myLot(), tpl = ISLANDS.find((i) => i.id === 'lotto');
    if (!l || !tpl) return null;
    const busy = (c: readonly [number, number]) => l.buildings.some((b) => b.cell[0] === c[0] && b.cell[1] === c[1]) || l.decor.some((d) => d.cell[0] === c[0] && d.cell[1] === c[1]);
    if (prefer && !busy(prefer)) return [prefer[0], prefer[1]];
    const sl = (tpl.slots ?? []).find((x) => !busy(x.at) && x.kind !== 'tavolo');
    return sl ? [sl.at[0], sl.at[1]] : null;
  };
  const hint = (): { cell: [number, number]; building: string } | null => {
    if (guideStep !== 'segheria') return null;
    const c = freeCell(segCell);
    return c ? { cell: c, building: 'segheria' } : null;
  };
  const isole: LibroIsola[] = []; // isole abitate col loro libro degli ospiti (#86)
  for (const l of world.archipelago.lots) {
    const mine = !!me && l.slot === world.slot;
    const other = owners.find((w) => w.slot === l.slot && w.id !== me?.id);
    if (!mine && !other) continue;
    const owner = mine ? me!.id : other!.id, ownerName = mine ? me!.nome : other!.nome;
    lots.push(createLotView({
      scene: world.scene, loader, origin: l.origin, tile: world.archipelago.tile, api, hud, camera: renderer.camera, canvas,
      template: l.template, groundY: world.groundY, readonly: !mine, owner: other?.id, ownerName: other?.nome, initial: mine ? me?.lotto ?? null : null,
      ...(mine ? { hint, hide: HIDE } : {}),
    }));
    isole.push({ slot: l.slot, owner, ownerName, mine, view: lots[lots.length - 1]! });
  }
  const arch = world.archipelago, targets: CompassTarget[] = [];
  if (world.slot !== null) targets.push({ id: 'casa', label: 'Casa', icon: 'casa', ...arch.spawnOf(world.slot) });
  targets.push({ id: 'porto', label: 'Porto', icon: 'porto', ...arch.spawnOf(null), sezione: 'porto' });
  // bussola a sezioni: quello che sta al Porto (Mercante, Bacheca, Scacchi, Consegne, Ingorgo) in una riga che si apre, le isole a tema in un'altra
  const SEZIONI: CompassSezione[] = [{ id: 'porto', nome: 'Porto', icon: 'porto' }, { id: 'isole', nome: 'Isole', icon: 'isole' }];
  const portoPl = arch.places.find((p) => p.role === 'porto') ?? null;
  const dentro = (p: { origin: readonly number[]; w: number; h: number }, x: number, z: number) => x >= (p.origin[0]! - 4) * arch.tile && x <= (p.origin[0]! + p.w + 4) * arch.tile && z >= (p.origin[1]! - 4) * arch.tile && z <= (p.origin[1]! + p.h + 4) * arch.tile;
  /** Sezione della bussola di un posto: al Porto → 'porto', su un'isola a tema → 'isole' (i suoi minigiochi), altrove nessuna. */
  const sezioneDi = (x: number, z: number) => (portoPl && dentro(portoPl, x, z) ? 'porto' : arch.places.some((p) => p.role === 'tema' && dentro(p, x, z)) ? 'isole' : undefined);
  // Regata e Tavolo: E (o A) vicino al Tavolo del Porto apre il pannello; in gara la barca la muove la sim, l'avatar sta fermo.
  const regata = await setupRegata({ world, loader, hud, root, cameraYaw: () => renderer.diorama.yaw });
  // minigiochi da solo: ognuno al suo posto (la Regata al molo della Laguna), premio in risorse deciso dal server
  // senza sfide con posta il Tavolo del Porto diventa il posto di Scacco in 3
  const tavoloAt = arch.buildings.find((b) => b.kind === 'tavolo') ?? null;
  const giochi = createMinigiochi({ world, loader, api: me && api.enabled ? api : null, hud, root, camera: renderer.camera, canvas, onLot: () => refreshMyLot(), tavolo: FLAGS.sfide ? null : tavoloAt });
  for (const sp of giochi.spots) { const sez = sezioneDi(sp.x, sp.z); targets.push({ id: sp.id, label: sp.nome, icon: sp.icon, x: sp.x, z: sp.z, ...(sp.aperta ? { show: sp.aperta } : {}), ...(sez ? { sezione: sez } : {}) }); } // aperta: minigiochi delle isole a tema (Ghiacci, Giardino, Tempesta, Vulcano)
  // Mondo Sotterraneo (docs/RPG.md, CONTRACTS §15): ingressi dei dungeon sulle isole e scheda del personaggio; il codice vero è nel chunk GDR
  const setMyLot = (l: LotState) => { lots.find((lv) => !lv.readonly)?.set(l); };
  const ingressi = createIngressi({ world, renderer, loader, api: me && api.enabled ? api : null, hud, root, canvas, getLot: () => myLot(), setLot: setMyLot });
  // dei dungeon la bussola mostra solo il più facile non ancora completato (difficoltà invisibile, docs/RPG.md §2)
  for (const sp of ingressi.spots) targets.push({ id: sp.id, label: sp.nome, icon: sp.icon, x: sp.x, z: sp.z, show: () => ingressi.next() === sp.id, group: 'dungeon' });
  // Porto (#63-#65): Mercante delle Perle, Bacheca delle missioni, Gente del Porto; i pannelli si scaricano alla prima apertura
  const porto = createPorto({ world, loader, api: me && api.enabled ? api : null, me, hud, root, camera: renderer.camera, canvas, getLot: () => myLot(), setLot: setMyLot });
  // nella sezione del Porto subito dopo la piazza: Mercante e Bacheca prima dei minigiochi
  targets.splice(targets.findIndex((t) => t.id === 'porto') + 1, 0, ...porto.spots.map((sp): CompassTarget => ({ id: sp.id, label: sp.id === 'mercante' ? 'Mercante' : sp.id === 'contrabbando' ? 'Contrabbando' : 'Bacheca', icon: sp.id, x: sp.x, z: sp.z, sezione: 'porto' })));
  // Porto tra amici (#110 #111): Tabellone dei record in piazza e Faro comune sullo scoglio; pannelli scaricati alla prima apertura
  const amici = createPortoAmici({ world, loader, api: me && api.enabled ? api : null, me, hud, root, camera: renderer.camera, canvas, getLot: () => myLot(), setLot: setMyLot, notte: () => aspetto?.momento === 'notte' });
  targets.splice(targets.findIndex((t) => t.id === 'bacheca') + 1, 0, ...amici.spots.map((sp): CompassTarget => ({ id: sp.id, label: sp.id === 'record' ? 'Record' : 'Faro', icon: sp.id, x: sp.x, z: sp.z, sezione: 'porto' })));
  // Isole a tema (#68): sblocchi, barriere in mare, il Vulcano che caccia; in bussola appena scoperte (minimappa), col lucchetto in mappa finché chiuse
  const temi = createTemi({ world, hud, loader, root, camera: renderer.camera, canvas, getLot: () => myLot(), notte: () => aspetto?.momento === 'notte' });
  for (const p of temi.isole) targets.push({ id: 'tema:' + p.island, label: p.nome.replace(/^Isola (della |dei |del )?/, ''), icon: p.island as PixId, x: p.spawn.x, z: p.spawn.z, show: () => mappa?.vista(`${p.role}:${p.index}`) ?? false, sezione: 'isole' });
  // Libro degli ospiti e «Mentre eri via» (#86): leggio vicino al molo di ogni isola abitata; la cartolina al rientro (dopo i primi passi)
  const libri = createLibri({ world, api: me && api.enabled ? api : null, me, hud, root, camera: renderer.camera, canvas, isole, onFirma: (e) => emotes.play(e) });
  const eroe = me && api.enabled ? createEroe({ api, hud, root, getLot: () => myLot(), setLot: setMyLot }) : null;
  // Diario del capitano (#87): bottone col libro e tasto J, album nel chunk ui/diario_ui.ts; targhette con nome e titolo sopra la testa
  const diario = createDiario({ root, hud, api: me && api.enabled ? api : null, me, world, owners, getLot: () => myLot(), setLot: setMyLot, hidden: () => regata.active || giochi.isBusy() || ingressi.active || ingressi.isBusy(),
    pausa: () => !!eroe?.isOpen() || !!editor?.isOpen() || !!feed?.isOpen() || !!tavolo?.isOpen() || porto.isBusy() || amici.isBusy() || libri.isBusy() || !!document.querySelector('#mzSheet.on'),
    onOpen: () => { editor?.close(); feed?.close(); eroe?.close(); porto.close(); amici.close(); if (tavolo?.isOpen()) tavolo.close(); document.querySelector<HTMLElement>('#mzSheet.on .mz-x')?.click(); } });
  const targhette = createTarghette({ world, camera: renderer.camera, canvas, root, mio: () => { const l = myLot(); return me && l ? { nome: me.nome, titolo: titoloDi(diarioOf(l).titolo) } : null; } });
  // mete: comprimibile, caselle per scegliere, sezioni Porto e Isole; con una sola accesa anche la freccia sullo schermo (nascosta quando c'è sopra un pannello)
  const compass = createCompass({ root, targets, sezioni: SEZIONI, camera: renderer.camera, canvas, groundY: world.groundY, hidden: () => coperto() });
  // minimappa (#62): cerchio con l'arcipelago attorno a te, M o un tocco aprono la mappa intera; isole non visitate nella nebbia.
  // Si scarica subito dopo l'avvio (import a parte): il JS iniziale ha un tetto (TECH §5), il cerchio arriva un attimo dopo il mondo.
  const places = arch.places.map((p) => ({ id: `${p.role}:${p.index}`, nome: p.role === 'lotto' ? (p.slot === world.slot ? 'Casa' : '') : p.nome, x0: p.origin[0], z0: p.origin[1], w: p.w, h: p.h, sempre: p.role === 'porto' || (p.role === 'lotto' && p.slot === world.slot), ...(p.tema ? { chiusa: () => !temi.aperta(p.island) } : {}) }));
  let mappa: Minimappa | null = null;
  void import('./ui/minimappa.ts').then((m) => { mappa = m.createMinimappa({ root, map: world.map, places, targets, hidden: () => coperto() }); }).catch((e: unknown) => { console.warn('[marea] minimappa non caricata', e); }); // senza minimappa si gioca lo stesso
  let closedAt = 0, nearWas = false, aWasT = false;
  /** Risorse cambiate fuori dal lotto (posta, esito di una sfida): la barra si aggiorna subito, non al poll dei 30 s. */
  const refreshMyLot = () => { void lots.find((lv) => !lv.readonly)?.refresh(); };
  const tavolo = FLAGS.sfide && me && api.enabled ? createTavolo({ api, me, root, play: (challenge) => runRegata({ challenge }), onClose: () => { closedAt = performance.now(); }, onLot: refreshMyLot }) : null;
  const nearTavolo = () => !!tavoloAt && world.mode === 'walk' && !world.race.on && Math.hypot(world.avatar.state.x - tavoloAt.x, world.avatar.state.z - tavoloAt.z) < TAVOLO_R;
  const openTavolo = () => {
    // un pannello alla volta: il foglio del lotto (#mzSheet) si chiude col suo bottone, così la vista del lotto lo sa
    if (tavolo) { document.querySelector<HTMLElement>('#mzSheet.on .mz-x')?.click(); if (!tavolo.isOpen()) tavolo.open(); return true; }
    hud.toast(me ? 'Le sfide con gli amici arrivano presto' : 'Per sfidare serve il tuo link personale', 2500);
    return false;
  };
  /** Un tick: vicino al Tavolo, A/E/Spazio (fronte di salita) lo apre; il suggerimento compare quando ci arrivi. */
  const tickTavolo = (a: boolean) => {
    const pressA = a && !aWasT; aWasT = a;
    if (!tavolo) return; // sfide con posta spente: il Tavolo del Porto è solo un edificio
    const near = nearTavolo(), open = tavolo.isOpen();
    if (near && !nearWas && !open) hud.toast('E · Tavolo delle Sfide', 2500);
    nearWas = near;
    if (near && pressA && !open && performance.now() - closedAt > 400) openTavolo();
  };
  registerStateProvider('tavolo', () => ({ exists: !!tavolo, near: nearTavolo(), open: !!tavolo?.isOpen(), at: tavoloAt ? { x: tavoloAt.x, z: tavoloAt.z } : null }));
  registerTestHook('openTavolo', () => openTavolo());
  // F3 (CONTRACTS §13): editor dell'avatar (C), feed (F), emote (1-8, G = ruota, #90). Un pannello alla volta; niente con Tavolo aperto, foglio del lotto o gara.
  const link = `${location.origin}/?t=${encodeURIComponent(FLAGS.token)}`; // per entrare come sé da un altro dispositivo (editor: COPIA / MANDA)
  const editor = me && api.enabled ? createEditor({ api, me, root, link, avatar: { setLook: (l) => world.setLook(l) }, barca: world, onSaved: () => hud.toast('Look salvato'), onBarca: () => hud.toast('Barca salvata'), onLot: refreshMyLot }) : null;
  // impostazioni (#53): camera, ciclo giorno/notte, meteo (#85), stampa, contorni; di serie (#59) ciclo, camera 22° e contorni, per chiunque (anche senza link)
  // la resa delle impostazioni (passata finale, acqua stampa, ciclo) si scarica solo se qualcosa è acceso: con tutto spento zero byte in più
  let aspetto: Aspetto | null = null, aspettoLoad: Promise<void> | null = null, voglio: Impostazioni | null = null;
  const applica = (s: Impostazioni) => {
    voglio = s;
    if (aspetto) { aspetto.set(s); return; }
    if (tuttoSpento(s)) return;
    aspettoLoad ??= import('./render/aspetto.ts').then((m) => {
      aspetto = m.createAspetto({ renderer, lights: world.lights, water: world.water, map: world.map, scena: { props: world.archipelago.props, groundY: world.groundY } });
      if (voglio) aspetto.set(voglio);
    }).catch(() => { aspettoLoad = null; hud.toast('Impostazioni non caricate: riprova'); });
  };
  let guidaRef: Guida | null = null; // la guida si crea più sotto (dopo i passi); le Impostazioni la riaccendono
  const impostazioni = createImpostazioni({ root, onChange: applica, guida: { on: () => !(guidaRef?.chiusa() ?? false), set: (v) => guidaRef?.setChiusa(!v) } });
  collegaAudio({ world, root, momento: () => aspetto?.momento ?? 'giorno', gioco: () => giochi.isBusy(), dungeon: () => ingressi.active }); // suoni e musica (audio/ponte.ts), al primo gesto
  registerTestHook('ciclo', (f) => aspetto?.forzaFase(f === null || f === undefined ? null : Number(f)));
  registerTestHook('aspettoPronto', () => aspettoLoad ?? Promise.resolve());
  registerStateProvider('aspetto', () => ({ momento: aspetto?.momento ?? 'giorno', post: aspetto?.attivo ?? false, caricato: !!aspetto, luci: aspetto?.luci ?? 0, meteoK: aspetto?.meteoK ?? 0, gocce: aspetto?.gocce ?? 0 }));
  // meteo (#85): 'sereno' | 'nuvoloso' | 'pioggia' | 'nebbia' | 'vento', 'spento' con l'impostazione spenta; dai test si forza (k di serie 1, null = l'orologio)
  registerStateProvider('meteo', () => aspetto?.meteo ?? 'spento');
  registerTestHook('meteo', (st, k) => aspetto?.forzaMeteo(st === null || st === undefined ? null : (String(st) as 'sereno'), k === undefined ? 1 : Number(k)));
  // feed: con le sfide con posta spente resta per le visite al libro degli ospiti (#86)
  const feed = me && api.enabled ? createFeed({ api, hud, root, ...(FLAGS.sfide ? {} : { vuoto: 'Niente di nuovo. Quando un amico firma il libro della tua isola o batte un tuo record, lo vedi qui.' }), onNews: (news) => { if (news.some((n) => n.tipo !== 'sfida_ricevuta' && n.tipo !== 'sfida_accettata')) refreshMyLot(); } }) : null;
  const emotes = createEmotes({ world, camera: renderer.camera, canvas, root });
  // Animali (#67): gabbiani, gatti dei moli (fusa con A o un tocco), pesci, granchi, delfini, lucciole di notte. Solo resa, chunk a parte
  let animali: Animali | null = null;
  void import('./game/animali.ts').then((m) => { animali = m.createAnimali({ world, camera: renderer.camera, canvas, root, hud, buio: () => aspetto?.buio ?? 0, avvista: (id) => diario.avvista(id) }); }).catch(() => { /* senza animali si gioca lo stesso */ });
  const EMOTES = AVATAR.emote as EmoteId[];
  /** Pannelli aperti che non sono il foglio delle isole (#mzSheet): lì sotto le decorazioni non rispondono ad A. */
  const panelsBusyNoSheet = () => diario.isOpen() || porto.isBusy() || amici.isBusy() || libri.isBusy() || !!tavolo?.isOpen() || regata.active || giochi.isBusy() || ingressi.active || ingressi.isBusy() || !!editor?.isOpen() || !!feed?.isOpen() || !!eroe?.isOpen();
  const panelsBusy = () => diario.isOpen() || porto.isBusy() || amici.isBusy() || libri.isBusy() || !!tavolo?.isOpen() || !!document.querySelector('#mzSheet.on') || regata.active || giochi.isBusy() || ingressi.active || ingressi.isBusy();
  const openEditor = () => { if (!editor || panelsBusy()) return false; feed?.close(); editor.open(); return true; };
  const openFeed = () => { if (!feed || panelsBusy()) return false; editor?.close(); feed.open(); return true; };
  // Un solo listener in bubble: i pannelli aperti fermano il keydown in capture, quindi qui arrivano solo i tasti «liberi».
  addEventListener('keydown', (e) => {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'KeyO' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { foto.open(); return; } // modalità foto (#109): dentro, O ed Esc escono (ui/foto_ui.ts)
    if (e.code === 'KeyC') { if (editor?.isOpen()) editor.close(); else openEditor(); return; }
    if (e.code === 'KeyF') { if (feed?.isOpen()) feed.close(); else openFeed(); return; }
    if (e.code === 'KeyM') { if (!panelsBusy()) mappa?.toggle(); return; }
    if (e.code === 'KeyJ') { if (diario.isOpen()) diario.close(); else if (!panelsBusy()) { editor?.close(); feed?.close(); eroe?.close(); diario.open(); } return; } // Diario del capitano (#87)
    if (e.code === 'KeyI') { if (eroe?.isOpen()) eroe.close(); else if (eroe && !panelsBusy()) { editor?.close(); feed?.close(); eroe.open(); } return; }
    if (e.code === 'KeyG') { if (emotes.wheelOpen) emotes.closeWheel(); else if (!panelsBusy() && !editor?.isOpen() && !feed?.isOpen()) emotes.toggleWheel(); return; }
    const m = /^(?:Digit|Numpad)([1-8])$/.exec(e.code);
    if (m && !panelsBusy() && !editor?.isOpen() && !feed?.isOpen()) { const id = EMOTES[Number(m[1]) - 1]; if (id) emotes.play(id); }
  });
  registerTestHook('openEditor', () => openEditor());
  registerTestHook('openFeed', () => openFeed());
  registerTestHook('openHero', () => { if (!eroe || panelsBusy()) return false; eroe.open(); return true; });
  registerTestHook('emote', (id) => emotes.play(String(id) as EmoteId));
  // guida «Primi passi»: costruire → barca → minigioco → costruire col premio, poi le cose nuove: parla al Porto, pesca o perle, mappa, un'isola
  // nuova. Senza isola propria niente Segheria né costruisci. I primi quattro restano in testa e in quest'ordine: il vecchio progresso salvato
  // (un numero) vale per loro (ui/guida.ts). I passi si contano anche fuori ordine.
  const home = world.slot !== null ? arch.spawnOf(world.slot) : null, homeDock = world.slot !== null ? arch.boatOf(world.slot) : null;
  const hasLot = !!me && world.slot !== null && lots.some((lv) => !lv.readonly);
  const cellTarget = (c: [number, number] | null) => { if (!c || world.slot === null) return null; const w = arch.lotCellToWorld(world.slot, c); return { x: w.x, y: world.groundY(w.x, w.z) + 1.2, z: w.z }; };
  const giocate = () => (myLot()?.solo?.giocate ?? 0) + giochi.played();
  const reg = giochi.spots[0] ?? null;
  const qui = () => (world.mode === 'walk' ? world.avatar.state : world.boat.state);
  const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
  const piuVicino = <T extends { x: number; z: number }>(l: readonly T[]): T | null => { const f = qui(); let best: T | null = null; for (const p of l) if (!best || dist(p, f) < dist(best, f)) best = p; return best; };
  const portoAt = arch.spawnOf(null);
  const barcaTarget = () => { const p = world.boat.object.position; return { x: p.x, y: 1.8, z: p.z }; };
  const isolaVista = (p: { role: string; index: number }) => mappa?.vista(`${p.role}:${p.index}`) ?? false;
  const steps: GuidaStep[] = [
    ...(hasLot ? [{ id: 'segheria', titolo: 'Costruisci la Segheria', come: 'Tocca il cartello giallo: la Segheria fa Legno anche quando non giochi.', done: () => !!myLot()?.buildings.some((b) => b.building === 'segheria'), target: () => cellTarget(hint()?.cell ?? null) }] : []),
    { id: 'barca', titolo: 'Sali in barca', come: 'Cammina fino alla barca e premi A: con la barca vai sulle altre isole.', done: () => world.mode === 'boat' || giocate() > 0, target: barcaTarget },
    ...(reg ? [{ id: reg.id, titolo: `Vai alla ${reg.nome}`, come: 'Segui la freccia fino alla bandiera: una medaglia vale Legno, Pietra e Perle.', done: () => giocate() > 0, target: () => ({ x: reg.x, y: 4, z: reg.z }) }] : []),
    ...(hasLot ? [{ id: 'costruisci', titolo: 'Costruisci col premio', come: 'Torna a casa e tocca un cartello: Cava, Magazzino, Casa, Faro.', done: () => (myLot()?.buildings.filter((b) => b.building !== 'molo' && b.building !== 'segheria').length ?? 0) > 0, target: () => {
      const f = qui();
      if (home && homeDock && Math.hypot(f.x - home.x, f.z - home.z) > 45) return { x: homeDock.x, y: 2, z: homeDock.z };
      return cellTarget(freeCell(null));
    } }] : []),
    { id: 'parla', titolo: 'Fai due chiacchiere al Porto', come: 'Al Porto c\'è gente che parla volentieri, anche troppo. Vai vicino e premi A.', done: () => porto.aperto() === 'parla', target: () => {
      const p = piuVicino(porto.gente());
      return p && dist(p, qui()) < 80 ? { x: p.x, y: world.groundY(p.x, p.z) + 2.4, z: p.z } : { x: portoAt.x, y: 3, z: portoAt.z };
    } },
    { id: 'universale', titolo: 'Pesca o tuffati', come: 'Barca ferma in mare aperto: PESCA. Su acqua bassa vicino a riva: TUFFATI.', done: () => !!document.querySelector('#mzPescaGioco.on, #mzPerleGioco.on'), target: () => (world.mode === 'walk' ? barcaTarget() : null) },
    { id: 'mappa', titolo: 'Guarda la mappa', come: 'Tocca il cerchio della mappa (o M). La nebbia copre dove non sei mai stato.', done: () => !!mappa?.isOpen(), target: () => null },
    ...(temi.isole.length ? [{ id: 'isola', titolo: 'Scopri un\'isola nuova', come: 'Segui la freccia nella nebbia. Certe isole non ti fanno entrare: è carattere.', done: () => temi.isole.some(isolaVista), target: () => {
      const p = piuVicino(temi.isole.filter((x) => !isolaVista(x)).map((x) => x.spawn));
      return p ? { x: p.x, y: 3, z: p.z } : null;
    } }] : []),
  ];
  /** Gara, minigioco, dungeon o un pannello aperto: le frecce sullo schermo (guida, mete) si tolgono. */
  const coperto = () => diario.isOpen() || porto.isBusy() || amici.isBusy() || libri.isBusy() || regata.active || giochi.isBusy() || !!tavolo?.isOpen() || !!editor?.isOpen() || !!feed?.isOpen() || ingressi.active || ingressi.isBusy() || !!eroe?.isOpen();
  const META_DEL_PASSO: Record<string, string> = { segheria: 'casa', costruisci: 'casa', parla: 'porto' };
  const guida = createGuida({
    root, camera: renderer.camera, canvas, steps, vecchi: (hasLot ? 2 : 0) + 1 + (reg ? 1 : 0), storeKey: `marea:guida:${me?.id ?? 'ospite'}`,
    hidden: coperto,
    onFocus: (id) => {
      compass.focus(id === null ? null : META_DEL_PASSO[id] ?? (targets.some((t) => t.id === id) ? id : null));
      mappa?.evidenzia(id === 'mappa'); // il cerchio lampeggia finché non lo apri
    },
  });
  guidaRef = guida;
  // Modalità foto (#109): macchina fotografica nella barra in alto o tasto O; interfaccia via, camera che gira attorno, SCATTA con cornice.
  // Il codice vero (ui/foto_ui.ts) si scarica alla prima apertura; lo scatto è un render apposito letto nello stesso frame.
  const postoDi = (f: { x: number; z: number }): string | null => {
    const p = arch.placeAt(f.x, f.z) ?? arch.places.find((q) => dentro(q, f.x, f.z)) ?? null;
    if (!p) return 'In mare aperto';
    if (p.role !== 'lotto') return p.nome;
    const chi = me && p.slot === world.slot ? me.nome : owners.find((w) => w.slot === p.slot)?.nome;
    return chi ? `Isola di ${chi}` : null;
  };
  const foto = createFoto({
    root, hud, canvas, diorama: renderer.diorama, rendi: () => renderer.render(acc / DT, t), posto: () => postoDi(qui()),
    puo: () => !(regata.active || giochi.isBusy() || ingressi.active || ingressi.isBusy()),
    prima: () => { editor?.close(); feed?.close(); eroe?.close(); porto.close(); amici.close(); libri.close(); diario.close(); mappa?.close(); impostazioni.close(); if (tavolo?.isOpen()) tavolo.close(); document.querySelector<HTMLElement>('#mzSheet.on .mz-x')?.click(); },
  });
  const FERMO = { mx: 0, my: 0, a: false, b: false }; // in modalità foto l'avatar sta fermo (il mondo no)
  // Decorazioni libere (#108): vicino a una decorazione della tua isola, a piedi, A apre la sua scheda (in SPOSTA conferma)
  const mioLotto = lots.find((lv) => !lv.readonly) ?? null;
  const decorTick = (a: boolean): boolean => {
    if (!mioLotto) return false;
    const aPiedi = world.mode === 'walk' && !world.frozen && !panelsBusyNoSheet() && !canBoard(world.avatar.state, world.boat.state, world.map);
    return mioLotto.tick(a, aPiedi ? world.avatar.state : null);
  };
  let last = performance.now(), acc = 0, t = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt; t += dt;
    let steps = 0;
    while (acc >= DT && steps < 5) {
      const f0 = input.sample(), f = foto.isOpen() ? FERMO : f0;
      if (ingressi.active) { ingressi.step(f); acc -= DT; steps++; continue; } // nel dungeon il mondo di superficie sta fermo
      if (regata.active) regata.step(f); else { const aP0 = porto.tick(f.a), aP1 = libri.tick(f.a && !aP0) || aP0, aP2 = amici.tick(f.a && !aP1) || aP1, aPorto = decorTick(f.a && !aP2) || aP2; tickTavolo(f.a && !aPorto); giochi.tick(f.a && !aPorto, f); ingressi.tick(f.a); animali?.tick(f.a && !aPorto); } // Porto prima di Tavolo e minigiochi · giochi.tick con l'input intero (Consegne) · Animali (#67)
      world.frozen = (diario.isOpen() || porto.isBusy() || amici.isBusy() || libri.isBusy() || !!tavolo?.isOpen() || !!editor?.isOpen() || !!feed?.isOpen() || giochi.isBusy() || ingressi.isBusy() || !!eroe?.isOpen() || foto.isOpen()) && !regata.active;
      world.step(f); acc -= DT; steps++;
    }
    if (steps === 5) acc = 0;
    if (ingressi.active) ingressi.update(acc / DT, dt, t); else { world.update(acc / DT, dt, t); ingressi.update(acc / DT, dt, t); animali?.update(dt, t); } // Animali (#67)
    regata.update(acc / DT, dt, t);
    emotes.update(dt); setTopbarHidden(regata.active || ingressi.active);
    giochi.update(t); if (!ingressi.active) { porto.update(dt, world.mode === 'walk' ? world.avatar.state : world.boat.state); amici.update(dt, world.mode === 'walk' ? world.avatar.state : world.boat.state); libri.update(world.mode === 'walk' ? world.avatar.state : world.boat.state); } guideStep = guida.current(); guida.update(t);
    if (!ingressi.active) temi.update(dt, t); // Isole a tema (#68)
    if (document.querySelector('#mzSheet.on')) { if (tavolo?.isOpen()) tavolo.close(); editor?.close(); feed?.close(); porto.close(); amici.close(); libri.close(); diario.close(); } // aperto un edificio: gli altri pannelli lasciano il posto
    const focus = world.mode === 'walk' ? world.avatar.state : world.boat.state;
    for (const lv of lots) lv.update(dt, focus);
    if (diario.isOpen() && (editor?.isOpen() || feed?.isOpen() || eroe?.isOpen() || porto.isBusy() || amici.isBusy())) diario.close(); // aperto un altro pannello dopo il diario
    diario.update(dt, focus); targhette.update(); // Diario del capitano (#87) // rilettura ogni 30 s solo per l'isola dove sei; timer ed etichette ogni frame
    document.body.classList.toggle('mz-sotto', ingressi.active); // nel dungeon: l'interfaccia di superficie si nasconde (CSS del chunk GDR)
    compass.update(focus, renderer.diorama.yaw, t);
    mappa?.update({ x: focus.x, z: focus.z, yaw: focus.yaw }, renderer.diorama.yaw, world.net.peers());
    aspetto?.update(Date.now(), t, focus);
    renderer.render(acc / DT, t);
    hud.setPerf(renderer.stats());
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // chiusura pulita della rete (il server vede subito il leave); tornando indietro dalla cache del browser si riparte da capo
  addEventListener('pagehide', () => { for (const lv of lots) lv.dispose(); world.dispose(); });
  addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
  // Rientro (#86): il server dice cosa è successo mentre eri via (e segna che ci sei); poi «ci sono» ogni RIENTRO.presenzaSecondi
  let rientro: Promise<void> = Promise.resolve();
  if (me && api.enabled && FLAGS.net) {
    const myView = lots.find((lv) => !lv.readonly) ?? null;
    const ciSono = () => { if (document.visibilityState === 'visible') void api.presenza().catch(() => { /* riprova al prossimo giro */ }); };
    rientro = api.rientro().then(async (r) => {
      myView?.set(r.lot);
      if (r.riepilogo && (!FLAGS.test || FLAGS.rientro)) await libri.cartolina(r.riepilogo, r.novita, myView ? () => { void myView.collectAll().then((g) => { if (g.legno + g.pietra + g.perle > 0) hud.toast(`Raccolto: ${[g.legno && `+${g.legno} Legno`, g.pietra && `+${g.pietra} Pietra`, g.perle && `+${g.perle} Perle`].filter(Boolean).join(', ')}`, 2600); }); } : null);
    }).catch(() => { /* senza rientro si gioca lo stesso */ }).finally(() => {
      setInterval(ciSono, RIENTRO.presenzaSecondi * 1000);
      document.addEventListener('visibilitychange', ciSono);
    });
  }
  registerTestHook('rientroPronto', () => rientro);
  setReady();
  hud.toast(me ? `Ciao ${me.nome}` : 'MAREA', 2500);
  console.log(`[marea] build ${__BUILD__} · isola ${world.map.id} ${world.map.w}×${world.map.h}`);
}
boot().catch((e) => { console.error('[marea] avvio fallito', e); document.body.insertAdjacentHTML('beforeend', `<pre style="color:#F4E3C1;padding:16px">Qualcosa è andato storto all'avvio.\n${String(e)}</pre>`); });
