// Avvio del client: renderer, mondo, moduli delle isole e delle modalità, ciclo a 60 Hz con interpolazione, test API. Unico modulo con
// side effect. I pezzi dell'avvio stanno in avvio/: mete della bussola, tasti, grafica, rientro e il registro delle
// modalità (chi è aperto, chi ferma il mondo, chi si chiude).
import { DT, barcaDi } from '@marea/sim';
import type { InputFrame as Frame, LotState } from '@marea/sim';
import { ARCHIPELAGO } from '@marea/content';
import type { EmoteId } from '@marea/protocol';
import { FLAGS } from './flags.ts';
import { preparaInstallazione } from './installa.ts';
import { createRenderer } from './render/scene.ts';
import { createLoader } from './render/loader.ts';
import { createInput } from './game/input.ts';
import { createGameWorld } from './game/world.ts';
import { createHud } from './ui/hud.ts';
import { createCompass } from './ui/compass.ts';
import { createSegno } from './ui/segno.ts';
import type { Minimappa } from './ui/minimappa.ts';
import { createApi } from './net/api.ts';
import { createLotView } from './game/lot.ts';
import type { LotView } from './game/lot.ts';
import { installTestApi, registerPerfProvider, registerTestHook, setReady } from './test/testapi.ts';
import { setupRegata } from './game/regata.ts';
import { createEditor } from './ui/editor.ts';
import { createFeed } from './ui/feed.ts';
import { createEmotes } from './game/emote.ts';
import { setTopbarHidden, topButton } from './ui/topbar.ts';
import { entraConInvito } from './ui/entra.ts';
import { createMinigiochi } from './game/minigiochi.ts';
import { createIngressi } from './game/ingressi.ts';
import { createTemplari } from './game/templari.ts';
import type { ArenaIsola } from './game/arena.ts';
import type { DifesaIsola } from './game/difesa.ts';
import { createAdrenalina } from './game/adrenalina.ts';
import { createEroe } from './ui/eroe.ts';
import { createBorsa } from './ui/borsa.ts';
import { createPorto } from './game/porto.ts';
import { createPortoAmici } from './game/porto_amici.ts';
import { createImpostazioni } from './ui/impostazioni.ts';
import { createFoto } from './ui/foto.ts';
import { createHudAllegro } from './ui/hud_allegro.ts';
import type { HudAllegro } from './ui/hud_allegro.ts';
import { createDiario } from './game/diario.ts';
import { createTarghette } from './game/targhette.ts';
import { createMiaBarca } from './game/mia_barca.ts';
import { collegaAudio } from './audio/ponte.ts';
import type { Animali } from './game/animali.ts';
import type { Evocato } from './rpg/evocato.ts';
import { createTemi } from './game/temi.ts';
import { createLibri } from './game/libro.ts';
import type { LibroIsola } from './game/libro.ts';
import { createBorgo } from './game/borgo.ts';
import { createVelo } from './ui/velo.ts';
import { createStanza } from './game/stanza.ts';
import type { Arreda } from './game/arreda.ts';
import type { Storia } from './storia/index.ts';
import type { Negozio } from './game/negozio.ts';
import type { Botteghe } from './game/botteghe.ts';
import { SEZIONI, creaMete, dentro } from './avvio/mete.ts';
import { aspettoGrafico } from './avvio/aspetto.ts';
import { avviaRientro } from './avvio/rientro.ts';
import { collegaTasti } from './avvio/tasti.ts';
import { creaRegistro } from './avvio/registro.ts';
import { azioneA } from './avvio/azione_a.ts';
import { apriHome } from './avvio/home.ts';

async function boot(): Promise<void> {
  const home = apriHome(); // schermata iniziale (avvio/home.ts): il mondo carica dietro
  if (FLAGS.invito && !FLAGS.token) { await home.gioca; await entraConInvito(FLAGS.invito); } // link di gruppo: GIOCA, il nome, poi si riparte col token
  installTestApi(__BUILD__);
  preparaInstallazione(); // l'icona sul telefono entra col proprio link
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const root = document.getElementById('ui') as HTMLElement;
  const hud = createHud({ root, flags: FLAGS });
  const renderer = createRenderer({ canvas, flags: FLAGS });
  registerPerfProvider(() => renderer.stats());
  const loader = await createLoader({ base: '/assets/' });
  home.segui(loader); home.passo();
  const input = createInput({ canvas, root, cameraYaw: () => renderer.diorama.yaw });
  const zoomSlider = await import('./ui/zoom_slider.ts').then((m) => m.createZoomSlider({ root, diorama: renderer.diorama })).catch((e: unknown) => { console.warn('[marea] zoom slider non caricato', e); return null; });
  // chi sei e dove abiti (slot del lotto), prima del mondo: lo spawn è sul molo della tua isola
  const api = createApi({ token: FLAGS.token });
  const me = api.enabled && FLAGS.net ? await api.me().catch((e: Error) => { hud.banner?.(e.message); return null; }) : null;
  const owners = me ? await api.lots().catch(() => []) : [];
  const net = me && api.enabled ? api : null; // le chiamate al server, solo con un link valido
  home.passo();
  const world = await createGameWorld({ renderer, loader, flags: FLAGS, hud, build: __BUILD__, slot: me ? me.slot ?? null : undefined, ...(me ? { look: me.look, barca: barcaDi(me.look), meId: me.id } : {}), abitanti: owners, senzaBarca: () => senzaBarca() }); // senza login: ?slot=N dall'URL (test), altrimenti Porto
  renderer.diorama.setZoom(1.6); // si parte larghi: l'isola e i suoi cartelli si vedono subito
  home.passo();
  const arch = world.archipelago;
  // il proprio lotto (azioni) e quelli degli altri (sola lettura): la casa, i mobili, le monete
  const lots: LotView[] = [];
  const myLot = () => lots.find((lv) => !lv.readonly)?.state() ?? null;
  const setMyLot = (l: LotState) => {
    lots.find((lv) => !lv.readonly)?.set(l);
    world.setEquip(l.hero ? { ...l.hero.equip, ...(l.hero.armaturaFuori ? { corpoFuori: true } : {}) } : 'partenza');
  };
  const isole: LibroIsola[] = []; // case abitate col loro libro degli ospiti
  for (const l of arch.lots) {
    const mine = !!me && l.slot === world.slot;
    const other = owners.find((w) => w.slot === l.slot && w.id !== me?.id);
    if (!mine && !other) continue;
    lots.push(createLotView({
      scene: world.scene, loader, origin: l.origin, tile: arch.tile, api, hud,
      template: l.template, groundY: world.groundY, readonly: !mine, owner: other?.id, ownerName: other?.nome, initial: mine ? me?.lotto ?? null : null,
    }));
    isole.push({ slot: l.slot, owner: mine ? me!.id : other!.id, ownerName: mine ? me!.nome : other!.nome, mine, view: lots[lots.length - 1]! });
  }
  const mioLotto = lots.find((lv) => !lv.readonly) ?? null;
  /** Monete cambiate fuori dal lotto (minigioco, editor, novità del feed): la barra si aggiorna subito, non al poll dei 30 s. */
  const refreshMyLot = () => { void mioLotto?.refresh(); };
  const lotto = { getLot: myLot, setLot: setMyLot };
  /** La storia delle prime ore (storia/) è partita e la barca non l'hai ancora comprata da Bepi: niente barca al molo, niente viaggio rapido. */
  const senzaBarca = (): boolean => { const s = myLot()?.storia; return !!s && !s.barca; };

  // ——— isole e modalità, nell'ordine in cui nascono i loro bottoni ———
  const regata = await setupRegata({ world, loader, hud, root, cameraYaw: () => renderer.diorama.yaw }); // in gara la barca la muove la sim
  // minigiochi da solo, ognuno al suo posto; al Tavolo del Porto si gioca a Scacco in 3
  const giochi = createMinigiochi({ world, loader, api: net, hud, root, camera: renderer.camera, canvas, renderer, onLot: refreshMyLot, tavolo: arch.buildings.find((b) => b.kind === 'tavolo') ?? null });
  const ingressi = createIngressi({ world, renderer, loader, api: net, hud, root, canvas, ...lotto }); // dungeon (docs/RPG.md), codice vero nel chunk GDR
  const tpl = createTemplari({ world, renderer, loader, api: net, hud, root, canvas, ...lotto }); // chiesa dei Templari (docs/TEMPLARI.md)
  let ar: ArenaIsola | null = null, dif: DifesaIsola | null = null, storia: Storia | null = null;
  /** Nel dungeon, nella chiesa dei Templari o nel duello dell'Arena: il mondo di superficie sta fermo e la sua interfaccia sparisce. */
  const sotto = () => ingressi.active || tpl.active || !!ar?.active || !!storia?.attiva;
  const vis = aspettoGrafico({ renderer, world, hud }); // luce, ciclo, meteo: si scaricano solo se accesi
  const notte = () => vis.get()?.momento === 'notte';
  // Porto: Mercante, Bacheca, Gente del Porto; Tabellone dei record e il Grande Faro (pannelli scaricati alla prima apertura)
  const porto = createPorto({ world, loader, api: net, me, hud, root, camera: renderer.camera, canvas, ...lotto,
    cielo: () => { const a = vis.get(); return a && a.meteo !== 'spento' ? { pioggia: a.nuvole.pioggia, vento: a.nuvole.vento } : null; } });
  const amici = createPortoAmici({ world, loader, api: net, me, hud, root, camera: renderer.camera, canvas, ...lotto,
    buio: () => vis.get()?.buio ?? 0, pioggia: () => { const a = vis.get(); return a && a.meteo !== 'spento' ? a.nuvole.pioggia : 0; } });
  // isole a tema: sblocchi, barriere in mare, il Vulcano che caccia
  const temi = createTemi({ world, hud, loader, root, camera: renderer.camera, canvas, getLot: myLot, notte });
  const adr = createAdrenalina({ world, renderer, loader, api: net, hud, root, ...lotto, nome: () => me?.nome ?? '', aperta: () => temi.aperta('adrenalina') }); // funivia e snowboard
  // Arena e Difesa: chunk a parte (TECH §5), il portone e il cancello compaiono un attimo dopo il mondo; le mete in bussola ci sono subito
  void import('./game/arena.ts').then((m) => { ar = m.createArena({ world, renderer, loader, api: net, hud, root, canvas, ...lotto, nome: () => me?.nome ?? '' }); }).catch((e: unknown) => { console.warn('[marea] arena non caricata', e); });
  // una partita alla Difesa (che non passa dal server) conta per la missione dell'isola
  const partitaDifesa = () => { if (myLot()?.storia && net) void net.storia('difesa').then(setMyLot).catch(() => { /* la rete: pazienza */ }); };
  void import('./game/difesa.ts').then((m) => { dif = m.createDifesa({ world, renderer, hud, root, canvas, onPartita: partitaDifesa }); }).catch((e: unknown) => { console.warn('[marea] difesa non caricata', e); });
  // il Borgo: porte delle case, la stanza di casa con pavimento e carta di chi ci abita, il libro degli ospiti al molo di ogni isola abitata
  const velo = createVelo({ root, mondo: world }); // dissolvenza dei passaggi città → stanza (case, negozio dei mobili, scale)
  const lotDi = (s: number) => isole.find((i) => i.slot === s)?.view.state() ?? null;
  const borgo = createBorgo({ world, hud, root, velo, cede: () => libri.vicino(), abitanti: [...owners.filter((w) => w.id !== me?.id).map((w) => ({ slot: w.slot, nome: w.nome, mia: false })), ...(world.slot !== null ? [{ slot: world.slot, nome: me?.nome ?? 'Tu', mia: true }] : [])] });
  const stanza = createStanza({ world, renderer, velo, lotDi });
  const libri = createLibri({ world, api: net, me, hud, root, camera: renderer.camera, canvas, isole, onFirma: (e) => emotes.play(e) });
  const eroe = net ? createEroe({ api: net, hud, root, ...lotto }) : null;
  const borsa = me && net ? createBorsa({ api: net, me, root, hud, ...lotto, setLook: (l) => { world.setLook(l); allegro?.setLook(l); } }) : null; // vestiti, cappelli, strumenti, insetti, mobili
  // negozio dei mobili, botteghe, ARREDA in casa tua e modifica dell'isola: chunk a parte, arrivano un attimo dopo il mondo
  let negozio: Negozio | null = null, botteghe: Botteghe | null = null, arreda: Arreda | null = null;
  void import('./game/negozio.ts').then((m) => { negozio = m.createNegozio({ world, renderer, loader, root, hud, velo, api: net, ...lotto }); }).catch(() => { /* senza negozio si gioca lo stesso */ });
  void import('./game/botteghe.ts').then((m) => { botteghe = m.createBotteghe({ world, loader, api: net, me, hud, root, camera: renderer.camera, canvas, ...lotto }); }).catch(() => { /* senza botteghe si gioca lo stesso */ });
  if (world.slot !== null) void import('./game/arreda.ts').then((m) => { arreda = m.createArreda({ world, root, hud, api: net, lotto: mioLotto, slot: world.slot, stanza, loader, apriBaule: () => eroe?.openBuilding('forziere') }); }).catch(() => { /* senza ARREDA si gioca lo stesso */ });
  // Diario del capitano: bottone col libro e tasto J, album nel chunk ui/diario_ui.ts; targhette col nome sopra la testa degli amici
  const diario = createDiario({ root, hud, api: net, me, world, owners, ...lotto, hidden: () => reg.aperto(['gioco']),
    pausa: () => reg.aperto(['pannello', 'personale'], 'diario'), onOpen: () => reg.chiudi(['diario']) });
  // viaggio rapido (storia/viaggio.ts): il Borgo e le isole scoperte con Capitan Remo; tutte coi test (senza ?storia=1) e per chi sviluppa.
  // Chunk al primo tocco
  let viaggio: ReturnType<typeof import('./storia/viaggio.ts').createViaggio> | null = null;
  const teleBtn = topButton({ root, id: 'mzTeleBtn', order: 9, label: 'TP', title: 'Viaggio rapido', onClick: () => {
    if (senzaBarca()) { hud.toast('Senza barca non si va da nessuna parte: Bepi al Cantiere te la vende', 3000); teleBtn.setOn(false); return; }
    void import('./storia/viaggio.ts').then((m) => {
      viaggio ??= m.createViaggio({ root, hud, world, getLot: myLot, tutto: (FLAGS.test && !FLAGS.storia) || !!me?.admin, onClose: () => teleBtn.setOn(false) });
      if (viaggio.isOpen()) viaggio.close(); else { viaggio.open(); teleBtn.setOn(true); }
    });
  } });
  const targhette = createTarghette({ world, camera: renderer.camera, canvas, root });
  const miaBarca = createMiaBarca({ world, camera: renderer.camera, canvas, root }); // il cartellino sopra la tua barca al molo
  // ——— mete, minimappa, impostazioni, guida, foto ———
  const segno = createSegno(); // segnalino del navigatore: si fissa toccando la mappa grande; in cima alle mete, ha lui la freccia sullo schermo
  let mappa: Minimappa | null = null;
  const targets = creaMete({ world, giochi: giochi.spots, ingressi, porto: porto.spots, amici: amici.spots, tpl, adr: adr.spot, temi, vista: (id) => mappa?.vista(id) ?? false });
  targets.unshift(segno.target);
  const compass = createCompass({ root, targets, sezioni: SEZIONI, camera: renderer.camera, canvas, groundY: world.groundY, hidden: () => reg.coperto() });
  // minimappa: cerchio col nord in alto, M o un tocco aprono la mappa intera; isole non visitate o chiuse invisibili. Import a parte (tetto del JS iniziale)
  const places = arch.places.filter((p) => p.role !== 'lotto' && p.role !== 'negozio').map((p) => ({ id: `${p.role}:${p.index}`, nome: p.nome, x0: p.origin[0], z0: p.origin[1], w: p.w, h: p.h, sempre: p.role === 'porto', ...(p.tema ? { chiusa: () => !temi.aperta(p.island) } : {}) }));
  void import('./ui/minimappa.ts').then((m) => { mappa = m.createMinimappa({ root, map: ARCHIPELAGO.mare ? Object.create(world.map, { h: { value: ARCHIPELAGO.mare[1] } }) as typeof world.map : world.map, places, targets: targets.filter((x) => !x.navi), segno, hidden: () => reg.coperto() || document.body.classList.contains('mz-casa') }); }).catch((e: unknown) => { console.warn('[marea] minimappa non caricata', e); }); // senza minimappa si gioca lo stesso
  // test: il livello e i mobili della casa di un lotto scelti da noi (senza server, ?net=0), per vedere cantina e secondo piano senza comprarli
  registerTestHook('casaStato', (slot, patch) => { const lv = isole.find((i) => i.slot === Number(slot))?.view, s = lv?.state(); if (!lv || !s) return false; lv.set({ ...s, casa: { ...(s.casa ?? {}), ...(patch as object) } }); return true; });
  // editor dell'avatar (C), feed (F), emote (1-8, G = ruota): un pannello alla volta
  const link = `${location.origin}/?t=${encodeURIComponent(FLAGS.token)}`; // per entrare come sé da un altro dispositivo (editor: COPIA / MANDA)
  let allegro: HudAllegro | null = null; // HUD «Allegro»: bottone AVATAR, bandierina delle mete, «X è online»; nasce dopo i bottoni dei moduli
  const editor = me && net ? createEditor({ api: net, me, root, link, avatar: { setLook: (l) => { world.setLook(l); allegro?.setLook(l); } }, barca: world, onSaved: () => hud.toast('Look salvato'), onNome: (n) => hud.toast(`Nome salvato: ${n}`), onBarca: () => hud.toast('Barca salvata'), onLot: refreshMyLot }) : null;
  // impostazioni: camera, ciclo giorno/notte, meteo, stampa, contorni, una mano
  const impostazioni = createImpostazioni({ root, onChange: (s) => { input.setUnaMano(s.unaMano, s.padSec); vis.applica(s); } });
  collegaAudio({ world, root, momento: () => vis.get()?.momento ?? 'giorno', gioco: () => giochi.isBusy(), dungeon: sotto, templari: () => tpl.active }); // suoni e musica, al primo gesto
  const feed = net ? createFeed({ api: net, hud, root, onNews: refreshMyLot }) : null; // firme al libro degli ospiti e record battuti
  const emotes = createEmotes({ world, camera: renderer.camera, canvas, root });
  // animali (gabbiani, gatti dei moli, pesci, granchi, delfini, lucciole) e la creatura evocata che ti segue: solo resa, chunk a parte
  let animali: Animali | null = null, evocato: Evocato | null = null, evocatoCarico = false;
  void import('./game/animali.ts').then((m) => { animali = m.createAnimali({ world, camera: renderer.camera, canvas, root, hud, buio: () => vis.get()?.buio ?? 0, avvista: (id) => diario.avvista(id) }); }).catch(() => { /* senza animali si gioca lo stesso */ });
  // ——— il registro: chi è aperto, chi ferma il mondo, chi si chiude (avvio/registro.ts) ———
  const reg = creaRegistro([
    { id: 'diario', gruppo: 'pannello', aperto: () => diario.isOpen(), chiudi: () => diario.close() },
    { id: 'porto', gruppo: 'pannello', aperto: () => porto.isBusy(), chiudi: () => porto.close() },
    { id: 'botteghe', gruppo: 'pannello', aperto: () => !!botteghe?.isBusy(), chiudi: () => botteghe?.close() },
    { id: 'record', gruppo: 'pannello', aperto: () => amici.isBusy(), chiudi: () => amici.close() },
    { id: 'libro', gruppo: 'pannello', aperto: () => libri.isBusy(), chiudi: () => libri.close() },
    { id: 'editor', gruppo: 'personale', aperto: () => !!editor?.isOpen(), chiudi: () => editor?.close() },
    { id: 'feed', gruppo: 'personale', aperto: () => !!feed?.isOpen(), chiudi: () => feed?.close() },
    { id: 'eroe', gruppo: 'personale', aperto: () => !!eroe?.isOpen(), chiudi: () => eroe?.close() },
    { id: 'borsa', gruppo: 'personale', aperto: () => !!borsa?.isOpen(), chiudi: () => borsa?.close() },
    { id: 'regata', gruppo: 'gioco', aperto: () => regata.active },
    { id: 'minigiochi', gruppo: 'gioco', aperto: () => giochi.isBusy() },
    { id: 'sotto', gruppo: 'gioco', aperto: sotto },
    { id: 'dungeon', gruppo: 'gioco', aperto: () => ingressi.isBusy() },
    { id: 'templari', gruppo: 'gioco', aperto: () => tpl.isBusy() },
    { id: 'arena', gruppo: 'gioco', aperto: () => !!ar?.isBusy() },
    { id: 'difesa', gruppo: 'gioco', aperto: () => !!dif?.isBusy() },
    { id: 'funivia', gruppo: 'ferma', aperto: () => adr.isBusy() },
    { id: 'foto', gruppo: 'ferma', aperto: () => foto.isOpen() },
    { id: 'pesca', gruppo: 'ferma', aperto: () => !!negozio?.pescando() },
    { id: 'retino', gruppo: 'ferma', aperto: () => !!negozio?.retinoFermo() },
    { id: 'home', gruppo: 'ferma', aperto: () => home.aperta() },
  ]);

  const apriEditor = () => { if (!editor || reg.occupato()) return false; feed?.close(); editor.open(); return true; };
  const apriFeed = () => { if (!feed || reg.occupato()) return false; editor?.close(); feed.open(); return true; };
  collegaTasti({ reg, foto: { open: () => foto.open() }, editor, feed, eroe, diario, mappa: () => mappa, emotes, apriEditor, apriFeed });
  registerTestHook('openEditor', () => apriEditor());
  registerTestHook('openFeed', () => apriFeed());
  registerTestHook('openHero', () => { if (!eroe || reg.occupato()) return false; eroe.open(); return true; });
  registerTestHook('emote', (id) => emotes.play(String(id) as EmoteId));
  registerTestHook('setLot', (l) => { if (l && typeof l === 'object') { setMyLot(l as LotState); return true; } return false; });
  home.impostazioni(impostazioni); home.passo();
  // modalità foto: macchina fotografica in alto o tasto O; il codice vero (ui/foto_ui.ts) alla prima apertura
  const qui = () => (world.mode === 'walk' ? world.avatar.state : world.boat.state);
  const postoDi = (f: { x: number; z: number }): string | null => {
    const p = arch.placeAt(f.x, f.z) ?? arch.places.find((q) => dentro(arch, q, f.x, f.z)) ?? null;
    if (!p) return 'In mare aperto';
    if (p.role !== 'lotto') return p.nome;
    const chi = me && p.slot === world.slot ? me.nome : owners.find((w) => w.slot === p.slot)?.nome;
    return chi ? `Isola di ${chi}` : null;
  };
  const foto = createFoto({
    root, hud, canvas, diorama: renderer.diorama, rendi: () => renderer.render(acc / DT, t), posto: () => postoDi(qui()),
    puo: () => !reg.aperto(['gioco']),
    prima: () => { reg.chiudi(); mappa?.close(); impostazioni.close(); },
  });
  allegro = createHudAllegro({ root, net: world.net, loader, gl: renderer.gl, look: me?.look ?? null, nome: me?.nome ?? '' });

  // ——— il ciclo: passi fissi a 60 Hz, poi la resa ———
  const FERMO: Frame = { mx: 0, my: 0, a: false, b: false }; // in modalità foto l'avatar sta fermo (il mondo no)
  /** Nel dungeon, nella chiesa, sulla pista dello snowboard o nel duello: il mondo di superficie sta fermo e passo e resa li fa la modalità. */
  const DENTRO = [
    { attiva: () => ingressi.active, passo: (f: Frame) => ingressi.step(f), rendi: (a: number, dt: number, tt: number) => ingressi.update(a, dt, tt) },
    { attiva: () => tpl.active, passo: (f: Frame) => tpl.step(f), rendi: (a: number, dt: number, tt: number) => tpl.update(a, dt, tt) },
    { attiva: () => adr.active, passo: (f: Frame) => adr.step(f), rendi: (a: number, dt: number, tt: number) => adr.update(dt, tt, a) },
    { attiva: () => !!ar?.active, passo: (f: Frame) => ar?.step(f), rendi: (a: number, dt: number, tt: number) => ar?.update(a, dt, tt) },
    { attiva: () => !!storia?.attiva, passo: () => {}, rendi: (_a: number, dt: number) => storia?.update(dt) },
  ];
  /** Chi prende A nel mondo, in quest'ordine: chi lo prende lo toglie a quelli dopo (Porto prima dei minigiochi). */
  const PRENDONO_A: ((a: boolean, b: boolean) => boolean)[] = [
    (a, b) => arreda?.tick(a, b) ?? false, (a) => libri.tick(a), (a) => borgo.tick(a), (a) => negozio?.tick(a) ?? false, (a) => botteghe?.tick(a) ?? false,
    (a) => porto.tick(a), (a) => amici.tick(a),
  ];
  let last = performance.now(), acc = 0, t = 0, eqN = 0;
  const frame = (now: number) => {
    if (dif?.aperta) { last = now; requestAnimationFrame(frame); return; } // il gioco della Difesa è aperto sopra: il mondo sta fermo e non si disegna
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; acc += dt; t += dt; // il primo rAF può avere un orario prima di performance.now() qui sopra
    let passi = 0;
    while (acc >= DT && passi < 5) {
      const f0 = input.sample(), f = foto.isOpen() ? FERMO : f0;
      const dentro = DENTRO.find((d) => d.attiva());
      if (dentro) { dentro.passo(f); acc -= DT; passi++; continue; }
      if (regata.active) regata.step(f);
      else {
        let preso = false;
        for (const prende of PRENDONO_A) preso = prende(f.a && !preso, f.b) || preso;
        giochi.tick(f.a && !preso, f); ingressi.tick(f.a); tpl.tick(f.a); adr.tick(f.a); ar?.tick(f.a); dif?.tick(f.a); animali?.tick(f.a && !preso); // giochi.tick con l'input intero (Consegne)
      }
      world.frozen = reg.aperto(['pannello', 'personale', 'gioco', 'ferma']) && !regata.active;
      world.step(f); acc -= DT; passi++;
    }
    if (passi === 5) acc = 0;
    const alpha = acc / DT, dentro = DENTRO.find((d) => d.attiva());
    if (dentro) dentro.rendi(alpha, dt, t);
    else { world.update(alpha, dt, t); ingressi.update(alpha, dt, t); tpl.update(alpha, dt, t); adr.update(dt, t); ar?.update(alpha, dt, t); dif?.update(); animali?.update(dt, t); }
    regata.update(alpha, dt, t);
    { const ev = myLot()?.hero?.evocato ?? null; if (ev && !evocato && !evocatoCarico) { evocatoCarico = true; void import('./rpg/evocato.ts').then((mod) => { evocato = mod.createEvocato({ world, loader }); }).catch(() => { evocatoCarico = false; }); } try { evocato?.update(dt, t, ev, world.mode === 'walk' && !sotto() && !regata.active); } catch (e) { console.warn('[marea] evocato', e); evocato?.dispose(); evocato = null; } } // solo resa: se qualcosa va storto si spegne, il gioco continua
    emotes.update(dt); setTopbarHidden(regata.active || sotto());
    { // nel mondo B non serve (solo POSA/SPOSTA dell'arredamento); sotto A la scritta di cosa fa adesso
      const nelMondo = !regata.active && !giochi.isBusy() && !sotto() && !adr.active && !document.body.classList.contains('mz-gp');
      input.setB(!nelMondo || !!arreda?.attivo());
      input.setAzione(nelMondo ? (negozio?.azionePesca() ?? (!world.frozen ? azioneA(world, senzaBarca()) : null)) : null);
      allegro?.update();
      zoomSlider?.update();
    }
    const focus = qui();
    giochi.update(t, alpha);
    if (!sotto()) { porto.update(dt, focus); amici.update(dt, focus); libri.update(focus); borgo.update(); arreda?.update(); negozio?.update(dt); botteghe?.update(dt, focus); }
    if (!sotto()) temi.update(dt, t);
    for (const lv of lots) lv.update(dt, focus);
    if (diario.isOpen() && (reg.aperto(['personale']) || porto.isBusy() || amici.isBusy())) diario.close(); // aperto un altro pannello dopo il diario
    diario.update(dt, focus); targhette.update(); miaBarca.update(t); // il diario rilegge ogni 30 s solo l'isola dove sei; timer ed etichette ogni frame
    document.body.classList.toggle('mz-sotto', sotto()); // nel dungeon e nella chiesa: l'interfaccia di superficie si nasconde (CSS dei chunk)
    compass.update(focus, renderer.diorama.yaw, t);
    const arrivato = segno.update(focus); // segnalino raggiunto: si toglie da solo
    if (arrivato) hud.toast(`Sei arrivato${arrivato.nome ? ` · ${arrivato.nome}` : ''}`, 2200);
    mappa?.update({ x: focus.x, z: focus.z, yaw: focus.yaw }, world.net.peers());
    vis.get()?.update(Date.now(), t, focus);
    renderer.render(alpha, t);
    hud.setPerf(renderer.stats());
    if ((eqN++ & 15) === 0) { const l = myLot(); if (l) world.setEquip(l.hero ? { ...l.hero.equip, ...(l.hero.armaturaFuori ? { corpoFuori: true } : {}) } : 'partenza'); } // armatura e arma a vista: si riallinea al personaggio ogni ~¼ di secondo
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // chiusura pulita della rete (il server vede subito il leave); tornando indietro dalla cache del browser si riparte da capo
  addEventListener('pagehide', () => { for (const lv of lots) lv.dispose(); world.dispose(); });
  addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
  avviaRientro({ api, me, hud, root, myView: mioLotto, libri, busy: () => reg.occupato() || reg.aperto(['personale']), dopo: home.chiusa });
  home.pronto(velo); // GIOCA già toccato: si entra adesso
  setReady();
  // la storia delle prime ore (storia/: naufragio, tutorial, barca, missioni), chunk dopo l'avvio; coi test solo con ?storia=1. Senza casa
  // (oltre il 30°) il lotto qui non c'è: niente storia, la barca resta
  // dopo GIOCA: il naufragio non parte sotto la schermata iniziale
  if (me && net && myLot() && (!FLAGS.test || FLAGS.storia)) void home.chiusa.then(() => import('./storia/index.ts')).then((m) => {
    storia = m.createStoria({ renderer, loader, world, root, hud, api: net, porto, negozio: () => negozio, botteghe: () => botteghe, nome: me.nome, look: me.look, barca: barcaDi(me.look), ...lotto,
      inCasa: () => world.slot !== null && stanza.dentro() === world.slot, occupato: () => reg.aperto(['pannello', 'personale', 'gioco', 'ferma']), coperto: () => reg.coperto(),
      mete: targets, focus: (id) => compass.focus(id), dungeon: () => { const id = ingressi.next(); return ingressi.spots.find((s) => s.id === id) ?? null; } });
  }).catch((e: unknown) => { console.warn('[marea] storia non caricata', e); });
  void home.chiusa.then(() => hud.toast(me ? `Ciao ${me.nome}` : 'MAREA', 2500));
  console.log(`[marea] build ${__BUILD__} · isola ${world.map.id} ${world.map.w}×${world.map.h}`);
}
boot().catch((e) => { console.error('[marea] avvio fallito', e); document.body.insertAdjacentHTML('beforeend', `<pre style="color:#F4E3C1;padding:16px">Qualcosa è andato storto all'avvio.\n${String(e)}</pre>`); });
