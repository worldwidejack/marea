// ARREDA (#265): in casa tua (la stanza del tuo lotto) un bottone apre il magazzino dei mobili e i pavimenti e le carte che hai. POSA mette
// il mobile davanti a te come in Animal Crossing: ti muovi, la sagoma (verde = va bene, rossa = no) ti segue, A posa, B annulla, GIRA lo
// gira (quelli a terra). Quelli a parete vanno sul muro che guardi. Davanti a un mobile già posato A apre la sua scheda: SPOSTA, GIRA,
// METTI VIA (torna nel magazzino); davanti al baule (il Forziere) anche APRI. Le regole sono quelle del server (economy/casa.ts).
import * as THREE from 'three';
import { BORGO } from '@marea/content';
import type { MobileDef } from '@marea/content';
import { baule, casaDi, celleMobile, decorDi, finitureScelte, inStanza, livelloCasa, mobile, possiedeFinitura, postoMobileError, stanzaAt, stanzaTerra } from '@marea/sim';
import type { LotState, Muro, PlacedMobile, PostoMobile } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { LotView } from './lot.ts';
import type { Stanza } from './stanza.ts';
import type { Hud } from '../ui/hud.ts';
import { ApiError } from '../net/api.ts';
import type { Api } from '../net/api.ts';
import { PAL, el } from '../ui/style.ts';
import { bottoneKit, campioneKit, cartaKit, fermaTocchi, injectKit, rigaKit, schedeKit, veloKit } from '../ui/kit.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { postoArredo } from './arredi_vista.ts';
import type { Loader } from '../render/loader.ts';

export type Arreda = { tick(a: boolean, b: boolean): boolean; update(): void; /** POSA o SPOSTA in corso: B serve (chiude). */ attivo(): boolean };
type Modo = { kind: 'posa'; mobile: MobileDef; rot: number } | { kind: 'sposta'; id: string; mobile: MobileDef; rot: number } | { kind: 'baule' };
type Vicino = { kind: 'mobile'; a: PlacedMobile; def: MobileDef } | { kind: 'baule' };

const [X0, Z0] = BORGO.stanza.pavimento; // la stanza di serie: solo per la quota del pavimento (le stanze vere dipendono dal livello della casa, #386)
const OK = '#B6FF3D', NO = '#FF5C3D'; // verde e rosso neon della sagoma (ART_BIBLE §2), come SPOSTA in giardino
const BAULE: MobileDef = { id: 'baule', nome: 'Baule', categoria: 'contenitori', monete: 1, posto: 'terra', forma: 'baule', colori: [PAL.legno] };

/** Cornice (4 listelli) w×d nel piano XZ, alta `s`: la sagoma per terra (w e d = ingombro del mobile). */
function cornice(w: number, d: number, s: number): THREE.BufferGeometry[] {
  const t = 0.14, hw = w / 2, hd = d / 2;
  return [[0, -hd, w, t], [0, hd, w, t], [-hw, 0, t, d], [hw, 0, t, d]].map(([x, z, a, b]) => { const g = new THREE.BoxGeometry(a!, s, b!); g.translate(x!, s / 2, z!); return g; });
}

export function createArreda(o: { world: GameWorld; root: HTMLElement; hud: Hud; api: Api | null; lotto: LotView | null; slot: number | null; stanza: Stanza; loader: Loader; apriBaule?: () => void }): Arreda {
  const w = o.world, arch = w.archipelago, T = arch.tile;
  const lotDef = o.slot !== null ? arch.lots.find((l) => l.slot === o.slot) ?? null : null;
  const ox = lotDef ? lotDef.origin[0] * T : 0, oz = lotDef ? lotDef.origin[1] * T : 0;
  injectKit();
  const btn = fermaTocchi(el('button', 'mk-btn mk-pill', 'Arreda')); btn.id = 'mzArredaBtn'; btn.type = 'button'; o.root.appendChild(btn);
  const bar = fermaTocchi(el('div', 'mk-barra')); bar.id = 'mzArredaBar'; o.root.appendChild(bar);
  const sheet = veloKit(o.root, 'mzArreda');
  sheet.addEventListener('click', (e) => { if (e.target === sheet) chiudi(); }); // un tocco fuori dalla carta chiude
  // sagoma: per terra una cornice, a parete una cornice in piedi; più l'anteprima del mobile
  const matOk = new THREE.MeshBasicMaterial({ color: OK }), matNo = new THREE.MeshBasicMaterial({ color: NO });
  const sagoma = new THREE.Group(); sagoma.name = 'arreda_sagoma'; sagoma.visible = false; w.scene.add(sagoma);
  const fTerra = new THREE.Group(); let fTerraKey = '';
  const fMuro = new THREE.Group(); for (const g of cornice(1.5, 1.5, 0.08)) fMuro.add(new THREE.Mesh(g, matOk)); fMuro.rotation.x = -Math.PI / 2; fMuro.position.set(0, 2.1, 0.06);
  sagoma.add(fTerra, fMuro);
  const anteprima = new THREE.Group(); sagoma.add(anteprima);
  let mobiliMod: typeof import('../render/mobili.ts') | null = null;
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

  let modo: Modo | null = null, aperto = false, busy = false, aWas = false, bWas = false, vicino: Vicino | null = null, target: PostoMobile | null = null, ok = false, prevKey = '', confermaSvuota = false;
  const lot = (): LotState | null => o.lotto?.state() ?? null;
  const mia = () => !!o.api && !!o.lotto && o.slot !== null && o.stanza.dentro() === o.slot && w.mode === 'walk';
  const def = (id: string) => mobile(id); // anche le decorazioni del Mercante («decor:<id>»)
  /** Il pavimento della stanza che contiene la cella (a quel livello di casa), o quello del piano terra. */
  const rettDi = (cell: readonly [number, number]) => { const l = livelloCasa(casaDi(lot())); return (stanzaAt(l, cell) ?? stanzaTerra(l)).pavimento; };

  /** La cella (e il muro) davanti a te: per terra un passo avanti; a parete il muro che guardi (verso sud: il muro di lato più vicino). */
  const davanti = (parete: boolean): PostoMobile => {
    const a = w.avatar.state, dx = Math.sin(a.yaw), dz = -Math.cos(a.yaw);
    const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const cx = (a.x - ox) / T, cz = (a.z - oz) / T;
    const [X0, Z0, X1, Z1] = rettDi([Math.floor(cx), Math.floor(cz)]); // la stanza in cui sei
    if (!parete) return { cell: [cl(Math.floor(cx + dx * 0.75), X0, X1 - 1), cl(Math.floor(cz + dz * 0.75), Z0, Z1 - 1)] };
    const ix = cl(Math.floor(cx), X0, X1 - 1), iz = cl(Math.floor(cz), Z0, Z1 - 1);
    const muro: Muro = Math.abs(dz) >= Math.abs(dx) ? (dz < 0 ? 'n' : cx - X0 < X1 - cx ? 'o' : 'e') : dx < 0 ? 'o' : 'e';
    if (muro === 'n') return { cell: [ix, Z0], muro };
    return { cell: [muro === 'o' ? X0 : X1 - 1, iz], muro };
  };
  const problema = (l: LotState, m: Modo, p: PostoMobile): string | null => {
    if (m.kind === 'baule') { const b = baule(l); if (!b) return 'Niente baule'; const { baule: _b, ...senza } = casaDi(l), e = postoMobileError({ ...l, casa: senza }, BAULE, { cell: p.cell }); return e && !(b.cell[0] === p.cell[0] && b.cell[1] === p.cell[1]) ? e.msg : null; }
    const e = postoMobileError(l, m.mobile, { ...p, rot: m.rot }, m.kind === 'sposta' ? m.id : null);
    return e ? e.msg : null;
  };

  const errore = (e: unknown) => o.hud.toast(e instanceof ApiError ? e.message : 'Qualcosa non va, riprova', 2400);
  const fai = async (fn: () => Promise<LotState>, dopo?: () => void): Promise<boolean> => {
    if (busy || !o.api || !o.lotto) return false;
    busy = true;
    try { o.lotto.set(await fn()); dopo?.(); return true; } catch (e) { errore(e); return false; } finally { busy = false; disegna(); }
  };
  const chiudi = () => { aperto = false; confermaSvuota = false; sheet.classList.remove('on'); sheet.replaceChildren(); disegna(); };
  const inizia = (m: Modo) => {
    chiudi(); modo = m; prevKey = '';
    void import('../render/mobili.ts').then((mod) => { mobiliMod = mod; prevKey = ''; }).catch(() => {});
  };
  const fine = () => { modo = null; sagoma.visible = false; anteprima.clear(); prevKey = ''; disegna(); };
  const conferma = async () => {
    const l = lot(); if (!modo || !l || !target || problema(l, modo, target)) return;
    const m = modo, p = target;
    if (m.kind === 'posa') await fai(() => o.api!.casa('posa', { id: m.mobile.id, cell: p.cell, ...(p.muro ? { muro: p.muro } : {}), rot: m.rot }), () => { o.hud.toast(`${m.mobile.nome}: posato`, 1600); fine(); });
    else if (m.kind === 'sposta') await fai(() => o.api!.casa('sposta', { id: m.id, cell: p.cell, ...(p.muro ? { muro: p.muro } : {}) }), () => { o.hud.toast(`${m.mobile.nome}: spostato`, 1600); fine(); });
    else await fai(() => o.api!.casa('baule', { cell: p.cell }), () => { o.hud.toast('Baule spostato', 1600); fine(); });
  };

  let finitureTesti: Record<string, string> | null = null;
  const caricaFinitureTesti = () => {
    if (!finitureTesti) {
      finitureTesti = {};
      void import('@marea/content/finiture_testi.json', { with: { type: 'json' } })
        .then((m) => { finitureTesti = (m.default as { testi: Record<string, string> }).testi; if (aperto) apri(); })
        .catch(() => {});
    }
  };

  // ——— il pannello (kit dei pannelli, ui/kit.ts): schede Mobili, Pavimento, Pareti; davanti a un mobile la sua scheda ———
  type Scheda = 'mobili' | 'pavimento' | 'carta';
  let tab: Scheda = 'mobili';
  /** La carta del pannello, alta quanto serve: `sopra` (le schede) resta ferma, `corpo` scorre. */
  const mostra = (titolo: string, sopra: Node | null, corpo: Node[]) => {
    const c = cartaKit(titolo, chiudi);
    if (sopra) c.carta.insertBefore(sopra, c.corpo);
    c.corpo.append(...corpo);
    c.carta.classList.add('corta');
    sheet.replaceChildren(c.carta); sheet.classList.add('on');
  };
  /** Bottone d'azione di una riga: spento con la spunta se è già così. */
  const azione = (testo: string, fn: () => void, attuale = false) => { const b = bottoneKit(attuale ? '✓' : testo, fn); b.disabled = attuale; return b; };
  function apri(): void {
    const l = lot(); if (!l) return;
    aperto = true;
    caricaFinitureTesti();
    const st = o.stanza.stanza() ?? 'terra', stanzaAttiva = st === 'piano' ? 'piano' : 'terra';
    if (st === 'cantina') tab = 'mobili';
    const c = casaDi(l), mag = c.magazzino ?? {}, scelte = finitureScelte(l, stanzaAttiva);
    const schede = st === 'cantina' ? null : schedeKit<Scheda>([{ id: 'mobili', nome: 'Mobili' }, { id: 'pavimento', nome: 'Pavimento' }, { id: 'carta', nome: 'Pareti' }], tab, (t) => { tab = t; confermaSvuota = false; apri(); });
    const corpo: Node[] = [];
    if (tab === 'mobili') {
      const inStanzaMob = (c.arredi ?? []).filter((a) => (stanzaAt(livelloCasa(c), a.cell)?.id ?? 'terra') === st);
      if (confermaSvuota) {
        corpo.push(el('div', 'mk-nota', `Vuoi togliere tutti i mobili da questa stanza (${inStanzaMob.length})? Torneranno nel magazzino.`));
        const fila = el('div', 'mk-fila');
        const bSi = bottoneKit('Sì, svuota la stanza', () => {
          confermaSvuota = false;
          void fai(() => o.api!.casa('svuota', { stanza: st }), () => {
            o.hud.toast('Stanza svuotata: mobili nel magazzino', 2000);
            apri();
          });
        });
        bSi.dataset['act'] = 'conferma-svuota';
        const bNo = bottoneKit('Annulla', () => { confermaSvuota = false; apri(); }, 'carta');
        fila.append(bSi, bNo);
        corpo.push(fila);
      } else {
        const ids = Object.keys(mag).filter((k) => mag[k]! > 0 && def(k));
        if (!ids.length && !inStanzaMob.length) corpo.push(el('div', 'mk-nota', 'Vuoto: i mobili si comprano al negozio dei mobili del Borgo, le decorazioni dal Mercante, al Porto.'));
        for (const id of ids) {
          const d = def(id)!, b = azione('Posa', () => inizia({ kind: 'posa', mobile: d, rot: 0 })); b.dataset['mobile'] = id;
          corpo.push(rigaKit({ icona: campioneKit(d.colori), nome: d.nome, sotto: [mag[id]! > 1 ? `Ne hai ${mag[id]}` : decorDi(id) ? 'Decorazione, va per terra' : d.posto === 'parete' ? 'Va sul muro' : 'Va per terra'], azione: b }));
        }
        if (baule(l) && inStanza(baule(l)!.cell)) corpo.push(rigaKit({ icona: campioneKit(BAULE.colori), nome: 'Baule', sotto: ['Il tuo forziere'], azione: azione('Sposta', () => inizia({ kind: 'baule' })) }));
        if (inStanzaMob.length > 0) {
          const bSvuota = bottoneKit('Svuota stanza', () => { confermaSvuota = true; apri(); }, 'carta');
          bSvuota.dataset['act'] = 'svuota-stanza';
          corpo.push(rigaKit({ icona: campioneKit([PAL.rosso]), nome: 'Svuota la stanza', sotto: [`${inStanzaMob.length} mobili posati: li rimette tutti nel magazzino`], azione: bSvuota }));
        }
      }
    } else {
      const lista = tab === 'pavimento' ? BORGO.pavimenti : BORGO.carte;
      for (const f of lista) if (possiedeFinitura(l, tab, f.id)) {
        const tipo = tab, b = azione('Metti', () => void fai(() => o.api!.casa('scegli', { tipo, id: f.id, stanza: stanzaAttiva }), () => apri()), scelte[tipo] === f.id);
        b.dataset['finitura'] = `${tipo}:${f.id}`;
        const r = rigaKit({ icona: campioneKit(f.colori), nome: f.nome, sotto: finitureTesti?.[f.id] ? [finitureTesti[f.id]!] : [], azione: b });
        r.classList.toggle('on', scelte[tipo] === f.id);
        corpo.push(r);
      }
    }
    mostra('Arreda', schede, corpo);
    disegna();
  }
  function scheda(v: Vicino): void {
    aperto = true;
    const fila = el('div', 'mk-fila');
    if (v.kind === 'baule') {
      fila.append(bottoneKit('Apri', () => { chiudi(); o.apriBaule?.(); }), bottoneKit('Sposta', () => inizia({ kind: 'baule' }), 'carta'), bottoneKit('Gira', () => void fai(() => o.api!.casa('baule', {})), 'carta'));
    } else {
      const a = v.a, d = v.def;
      fila.append(bottoneKit('Sposta', () => inizia({ kind: 'sposta', id: a.id, mobile: d, rot: a.rot ?? 0 })));
      if (!a.muro) fila.append(bottoneKit('Gira', () => void fai(() => o.api!.casa('ruota', { id: a.id })), 'carta'));
      fila.append(bottoneKit('Metti via', () => void fai(() => o.api!.casa('ritira', { id: a.id }), () => { chiudi(); o.hud.toast(`${d.nome}: nel magazzino`, 1600); }), 'carta'));
    }
    const nome = v.kind === 'baule' ? 'Baule' : v.def.nome, colori = v.kind === 'baule' ? BAULE.colori : v.def.colori;
    mostra(nome, null, [rigaKit({ icona: campioneKit(colori), nome, sotto: [v.kind === 'baule' ? 'Il tuo forziere' : 'Cosa ne fai?'] }), fila]);
  }
  btn.addEventListener('click', () => { if (aperto) chiudi(); else apri(); disegna(); });

  /** Il mobile (o il baule) davanti a te, entro un passo. */
  const trovaVicino = (l: LotState): Vicino | null => {
    const terra = davanti(false), b = baule(l);
    if (b && b.cell[0] === terra.cell[0] && b.cell[1] === terra.cell[1] && inStanza(b.cell)) return { kind: 'baule' };
    const arr = casaDi(l).arredi ?? [];
    const a0 = arr.find((x) => { const d = def(x.mobile); return !x.muro && !!d && celleMobile(d, x.cell, x.rot ?? 0).some((q) => q[0] === terra.cell[0] && q[1] === terra.cell[1]); }); // anche una cella qualsiasi di un mobile lungo
    if (a0 && def(a0.mobile)) return { kind: 'mobile', a: a0, def: def(a0.mobile)! };
    const m = davanti(true), a = w.avatar.state, p = postoArredo(m, T, [1, 1], rettDi(m.cell)), vicinoMuro = Math.hypot(a.x - ox - p.x, a.z - oz - p.z) < 2.6;
    const a1 = vicinoMuro ? arr.find((x) => x.muro === m.muro && x.cell[0] === m.cell[0] && x.cell[1] === m.cell[1]) : null;
    return a1 && def(a1.mobile) ? { kind: 'mobile', a: a1, def: def(a1.mobile)! } : null;
  };

  // ——— barra in alto: in POSA/SPOSTA i comandi, altrimenti «A modifica» davanti a un mobile ———
  let barKey = '';
  function disegna(): void {
    const qui = mia();
    btn.classList.toggle('on', qui && !modo && !aperto);
    const k = !qui ? '' : modo ? `m:${modo.kind}:${ok}:${busy}` : vicino ? `v:${vicino.kind === 'baule' ? 'baule' : vicino.a.id}` : '';
    if (k === barKey) return;
    barKey = k;
    bar.classList.toggle('on', !!k);
    if (!k) { bar.replaceChildren(); return; }
    if (modo) {
      const nome = modo.kind === 'baule' ? 'Baule' : modo.mobile.nome;
      const t = el('div', 'mk-cartello', ok ? `${nome}: muoviti e premi A` : `${nome}: qui non ci sta`);
      const r = el('div', 'mk-fila');
      const qui2 = bottoneKit('Qui', () => void conferma()); qui2.disabled = !ok || busy; r.append(qui2);
      if (modo.kind === 'posa' && modo.mobile.posto === 'terra') r.append(bottoneKit('Gira', () => { if (modo?.kind === 'posa') { modo.rot = (modo.rot + 1) % 4; prevKey = ''; } }, 'carta'));
      r.append(bottoneKit('Annulla', fine, 'carta'));
      bar.replaceChildren(t, r);
    } else if (vicino) bar.replaceChildren(el('div', 'mk-cartello', `${vicino.kind === 'baule' ? 'Baule' : vicino.def.nome}: A per modificarlo`));
  }

  registerStateProvider('arreda', () => {
    const l = lot();
    return { mia: mia(), modo: modo ? modo.kind : null, aperto, target, ok, vicino: vicino ? (vicino.kind === 'baule' ? 'baule' : vicino.a.id) : null, magazzino: casaDi(l).magazzino ?? {}, arredi: casaDi(l).arredi ?? [], finiture: finitureScelte(l, (o.stanza.stanza() === 'piano' ? 'piano' : 'terra')), confermaSvuota, tab };
  });
  registerTestHook('arredaApri', () => { if (!mia()) return false; apri(); disegna(); return true; });
  registerTestHook('arredaPosa', (id) => { const d = def(String(id)); if (!mia() || !d) return false; inizia({ kind: 'posa', mobile: d, rot: 0 }); return true; });

  return {
    attivo: () => !!modo,
    tick(a, b) {
      const pa = a && !aWas, pb = b && !bWas; aWas = a; bWas = b;
      if (!mia()) { if (modo) fine(); if (aperto) chiudi(); vicino = null; return false; }
      const l = lot();
      if (modo && l) {
        target = davanti(modo.kind !== 'baule' && modo.mobile.posto === 'parete');
        ok = !problema(l, modo, target);
        if (pb) { fine(); return true; }
        if (pa) { void conferma(); return true; }
        return true; // in POSA A e B sono di ARREDA
      }
      vicino = !aperto && l ? trovaVicino(l) : null;
      if (vicino && pa) { scheda(vicino); return true; }
      return false;
    },
    update() {
      disegna();
      if (!modo || !target || !mia()) { sagoma.visible = false; return; }
      const parete = !!target.muro, rot = modo.kind === 'baule' ? casaDi(lot()).bauleRot ?? 0 : modo.rot;
      const celle = modo.kind === 'baule' ? [1, 1] as [number, number] : modo.mobile.celle ?? [1, 1];
      const p = postoArredo({ cell: target.cell, ...(target.muro ? { muro: target.muro } : {}), rot }, T, celle, rettDi(target.cell));
      const fk = celle.join('x');
      if (fk !== fTerraKey) { fTerraKey = fk; fTerra.clear(); for (const g of cornice(celle[0] * T - 0.1, celle[1] * T - 0.1, 0.08)) fTerra.add(new THREE.Mesh(g, matOk)); }
      sagoma.visible = true; fTerra.visible = !parete; fMuro.visible = parete;
      sagoma.position.set(ox + p.x, w.groundY(ox + (X0 + 1) * T, oz + (Z0 + 1) * T) + 0.03, oz + p.z); sagoma.rotation.y = p.ry;
      for (const g of [fTerra, fMuro]) for (const c of g.children) (c as THREE.Mesh).material = ok ? matOk : matNo;
      const key = `${modo.kind === 'baule' ? 'baule' : modo.mobile.id}:${mobiliMod ? 1 : 0}`;
      if (key !== prevKey && mobiliMod) {
        prevKey = key; anteprima.clear();
        const geo = modo.kind === 'baule' ? mobiliMod.bauleGeo(baule(lot()!)?.livello ?? 1) : mobiliMod.mobileGeo(modo.mobile.forma, modo.mobile.colori, modo.mobile);
        anteprima.add(new THREE.Mesh(geo, vc));
        const dec = modo.kind !== 'baule' ? decorDi(modo.mobile.id) : null;
        if (dec) { // una decorazione: l'anteprima è il suo modello, girato come quando è posata
          const k = key;
          void import('../render/decor.ts').then((dm) => dm.decorObject(dec.id, o.loader)).then(({ obj }) => { if (prevKey === k) { anteprima.clear(); const g = new THREE.Group(); g.rotation.y = Math.PI; g.add(obj); anteprima.add(g); } }).catch(() => {});
        } else if (modo.kind !== 'baule') { // se il mobile ha il suo modello 3D, l'anteprima è quello
          const k = key, id = modo.mobile.id;
          void import('../render/mobili_modelli.ts').then(async (mm) => { const ps = await mm.modelloMobile(id); if (ps && prevKey === k) { anteprima.clear(); anteprima.add(mm.gruppoModello(ps)); } }).catch(() => {});
        }
      }
    },
  };
}
