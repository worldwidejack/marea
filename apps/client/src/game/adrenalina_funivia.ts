// Isola dell'Adrenalina, la parte grande (chunk scaricato da game/adrenalina.ts quando ti avvicini all'isola): cavi, piloni e due cabine che
// vanno su e giù, il cancello della stazione a valle con il bottone FUNIVIA e la liberatoria da firmare (POST /api/adrenalina/liberatoria).
// Senza link personale la firma vale solo per questa visita. Le discese arrivano col passo 3 (#189).
import * as THREE from 'three';
import type { ArchPlace } from '@marea/sim';
import { AVATAR, ISLANDS } from '@marea/content';
import { ApiError } from '../net/api.ts';
import { FUNIVIA } from '../render/island_adrenalina.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';
import { suona } from '../audio/ponte.ts';
import { PAL, el, injectUiStyle } from '../ui/style.ts';
import { FLAGS } from '../flags.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { topButton } from '../ui/topbar.ts';
import type { AdrenalinaOpts } from './adrenalina.ts';

export type Funivia = {
  tick(a: boolean): void;
  update(t: number): void;
  isBusy(): boolean;
  /** A piedi davanti al cancello, con la camera lì (bottone 🚡 delle prove). */
  vai(): void;
};

/** La liberatoria (docs/ADRENALINA.md §2): stesso testo di @marea/sim LIBERATORIA, qui per non portare la sim nel bundle. */
const TESTO = [
  'Il sottoscritto sale sulla montagna di sua spontanea volontà, con le gambe sue e il casco in testa.',
  'Il parco declina ogni responsabilità per ossa rotte, orgoglio ferito e Perle perse.',
  'Si impegna a non piangere davanti agli amici e a non dare la colpa alla neve.',
];
const CSS = `
#mzLiberatoria { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(420px, calc(100% - 32px)); max-height: calc(100% - 120px); overflow-y: auto; box-sizing: border-box; padding: 16px 16px 12px; z-index: 31; display: none;
  background: ${PAL.pietraChiara}; color: ${PAL.neroCaldo}; border: 3px solid ${PAL.rosso}; box-shadow: 0 4px 0 ${PAL.neroCaldo}; font-size: 14px; line-height: 1.45; }
#mzLiberatoria.on { display: block; }
#mzLiberatoria b { display: block; margin-bottom: 10px; font-size: 13px; letter-spacing: .12em; color: ${PAL.rosso}; text-align: center; }
#mzLiberatoria p { margin: 0 0 8px; }
#mzLiberatoria .firma { margin-top: 12px; padding-top: 6px; border-top: 2px dashed ${PAL.pietraScura}; font-style: italic; }
#mzLiberatoria .bt { display: flex; gap: 8px; justify-content: center; margin-top: 12px; }
#mzLiberatoria button { min-width: 120px; min-height: 44px; border: 2px solid ${PAL.neroCaldo}; font: bold 15px ui-monospace, Menlo, monospace; cursor: pointer; }
#mzLiberatoria button[data-act="firma"] { background: ${PAL.rosso}; color: ${PAL.sabbiaChiara}; }
#mzLiberatoria button[data-act="no"] { background: ${PAL.pietra}; color: ${PAL.neroCaldo}; }
`;
const NEAR_M = 3.2;
/** Un giro di cabina: salita, sosta in vetta, discesa, sosta a valle (secondi). */
const VIAGGIO_S = 11, SOSTA_S = 3;

export function createFunivia(o: AdrenalinaOpts, place: ArchPlace, spot: { id: string; nome: string; x: number; z: number }): Funivia {
  injectUiStyle();
  const arch = o.world.archipelago, def = ISLANDS.find((i) => i.id === 'adrenalina');
  const prop = (k: string) => def?.props?.find((p) => p.k === k);
  const valle = prop('funivia_valle'), monte = prop('funivia_monte');
  const aWorld = (at: readonly number[]) => ({ x: (place.origin[0] + at[0]! + 0.5) * arch.tile, z: (place.origin[1] + at[1]! + 0.5) * arch.tile });
  // le stazioni guardano a sud (rot π): il davanti (−Z locale) è verso il molo, il cavo esce dal retro verso nord
  const pv = valle ? aWorld(valle.at) : null, pm = monte ? aWorld(monte.at) : null;

  // ---- cavi, piloni e cabine ----
  const gruppo = new THREE.Group(); gruppo.name = 'funivia';
  const cabine: THREE.Mesh[] = [];
  let a0 = new THREE.Vector3(), a1 = new THREE.Vector3();
  if (pv && pm) {
    const gy = (x: number, z: number) => o.world.groundY(x, z);
    a0 = new THREE.Vector3(pv.x, gy(pv.x, pv.z) + FUNIVIA.valle.y, pv.z - FUNIVIA.valle.z);
    a1 = new THREE.Vector3(pm.x, gy(pm.x, pm.z) + FUNIVIA.monte.y, pm.z - FUNIVIA.monte.z);
    const dir = a1.clone().sub(a0), len = dir.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
    const parts: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const mid = a0.clone().add(a1).multiplyScalar(0.5).add(new THREE.Vector3(s * FUNIVIA.scarto, 0, 0));
      const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
      parts.push(painted(new THREE.BoxGeometry(0.06, 0.06, len), P.neroCaldo, m));
    }
    // due piloni a traliccio sotto il cavo, dove la montagna lo lascia
    for (const t of [0.33, 0.62]) {
      const c = a0.clone().lerp(a1, t), base = gy(c.x, c.z), h = c.y - base;
      if (h < 1.5) continue;
      for (const s of [-1, 1]) parts.push(painted(new THREE.BoxGeometry(0.22, h, 0.22), P.pietraScura, M(c.x + s * 0.55, base + h / 2, c.z, 0, 0, -s * 0.06)));
      parts.push(painted(new THREE.BoxGeometry(2.0, 0.22, 0.3), P.pietraScura, M(c.x, c.y - 0.1, c.z)));
      for (let k = 1; k < Math.floor(h / 1.6); k++) parts.push(painted(new THREE.BoxGeometry(1.1, 0.08, 0.08), P.pietra, M(c.x, base + k * 1.6, c.z, 0, 0, k % 2 ? 0.6 : -0.6)));
    }
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const cavi = new THREE.Mesh(merged(parts), mat); cavi.name = 'funivia_cavi'; cavi.castShadow = true;
    // cabina rossa con la fascia di vetri e il braccio che la tiene al cavo (pivot all'aggancio)
    const cab = merged([
      painted(new THREE.BoxGeometry(0.1, 1.0, 0.1), P.pietraScura, M(0, -0.5, 0)),
      painted(new THREE.BoxGeometry(1.5, 1.4, 1.2), P.rosso, M(0, -1.7, 0)),
      painted(new THREE.BoxGeometry(1.52, 0.5, 1.0), P.acquaBassa, M(0, -1.45, 0)),
      painted(new THREE.BoxGeometry(1.6, 0.14, 1.3), P.neroCaldo, M(0, -1.0, 0)),
      painted(new THREE.BoxGeometry(1.6, 0.12, 1.3), P.neroCaldo, M(0, -2.42, 0)),
    ]);
    for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(cab, mat); m.name = 'funivia_cabina'; m.castShadow = true; cabine.push(m); gruppo.add(m); }
    gruppo.add(cavi);
    o.world.scene.add(gruppo);
  }

  // ---- la liberatoria ----
  if (!document.getElementById('mz-liberatoria-style')) { const st = document.createElement('style'); st.id = 'mz-liberatoria-style'; st.textContent = CSS; document.head.appendChild(st); }
  const carta = el('div', 'mz'); carta.id = 'mzLiberatoria';
  const firmaRiga = el('p', 'firma', '');
  const bFirma = el('button', '', 'FIRMA') as HTMLButtonElement; bFirma.type = 'button'; bFirma.dataset['act'] = 'firma';
  const bNo = el('button', '', 'Non ora') as HTMLButtonElement; bNo.type = 'button'; bNo.dataset['act'] = 'no';
  const bt = el('div', 'bt'); bt.append(bFirma, bNo);
  carta.append(el('b', '', '🚡 LIBERATORIA · FUNIVIA DELLA VETTA'), ...TESTO.map((r) => el('p', '', r)), firmaRiga, bt);
  for (const ev of ['pointerdown', 'touchstart']) carta.addEventListener(ev, (x) => x.stopPropagation());
  bNo.addEventListener('click', () => { chiudi(); });
  bFirma.addEventListener('click', () => { void firma(); });
  o.root.append(carta);
  const btn = el('button', 'mz mz-play'); btn.id = 'mzFunivia'; btn.type = 'button';
  btn.style.background = PAL.rosso; btn.style.color = PAL.sabbiaChiara;
  btn.replaceChildren(el('span', '', '🚡 FUNIVIA'), el('small', '', 'A'));
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { usa(); });
  o.root.append(btn);

  let firmaQui = false, busy = false, near = false, nearWas = false, aWas = false, firme = 0, rifiuti = 0, salite = 0, ultimo = '';
  const firmata = () => FLAGS.adrenalina || firmaQui || (o.getLot()?.liberatorie ?? []).includes('adrenalina');
  const casco = () => FLAGS.adrenalina || AVATAR.cappelli[o.world.look.cappello]?.id === 'casco';
  const prezzo = AVATAR.cappelli.find((h) => h.id === 'casco')?.perle ?? 0;
  const dice = (testo: string, ms = 3600) => { ultimo = testo; o.hud.toast(testo, ms); };
  const aperta = () => carta.classList.contains('on');
  function chiudi(): void { carta.classList.remove('on'); nearWas = true; }

  function usa(): void {
    if (busy) return;
    if (!firmata()) { firmaRiga.textContent = `Firmato: ${o.nome() || 'il viaggiatore'}`; carta.classList.add('on'); return; }
    if (!casco()) { rifiuti++; dice(`Il guardiano: «Senza casco qui non sale nessuno.» Il Casco costa ${prezzo} Perle: lo compri dal tuo avatar (bottone in alto) o dal Mercante al Porto`, 4800); return; }
    salite++;
    suona('medaglia_bronzo');
    dice('Il guardiano: «Casco in testa, firma fatta: sei dei nostri. Le piste aprono a giorni, la prima è lo snowboard.»', 4600);
  }
  async function firma(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      const api = o.api && FLAGS.token ? o.api : null;
      if (api) { const r = await api.adrenalinaLiberatoria(); o.setLot(r.lot); }
      else firmaQui = true;
      firme++;
      suona('medaglia_argento');
      carta.classList.remove('on');
      if (!api) o.hud.toast('Senza il tuo link personale la firma vale solo per questa visita', 3000);
      setTimeout(() => dice(casco() ? 'Il guardiano: «Bene. Casco in testa, si sale.»' : `Il guardiano: «Bene. Adesso il casco: senza, qui non sale nessuno.» (${prezzo} Perle, dal tuo avatar)`, 4400), api ? 0 : 3100);
    } catch (e) {
      dice(e instanceof ApiError ? e.message : 'La penna non scrive: riprova', 3200);
    } finally { busy = false; }
  }
  function vaiCancello(): void {
    if (!spot || !o.world.vai('adrenalina')) return;
    o.world.avatar.teleport(spot.x, spot.z + 1.2);
    o.renderer.diorama.follow(spot.x, o.world.groundY(spot.x, spot.z), spot.z + 1.2); o.renderer.diorama.snap?.();
    dice('L’Isola dell’Adrenalina: il cancello della funivia è qui davanti (A)', 3000);
  }

  const stato = () => ({
    spot, caricata: true, near, firmata: firmata(), casco: casco(), aperta: o.aperta(), liberatoria: aperta(), firme, rifiuti, salite, ultimo,
    cavo: pv && pm ? { da: a0.toArray().map((v) => +v.toFixed(2)), a: a1.toArray().map((v) => +v.toFixed(2)) } : null,
    cabine: cabine.map((c) => c.position.toArray().map((v) => +v.toFixed(2))),
  });
  registerStateProvider('adrenalina', stato);
  if (FLAGS.adrenalina) topButton({ root: o.root, id: 'mzAdrenalinaVai', order: 9, label: '🚡', title: 'Adrenalina: vai al cancello della funivia (prova)', onClick: () => { vaiCancello(); } });
  /** Test: a piedi davanti al cancello della funivia. */
  registerTestHook('adrenalinaCancello', () => { if (!o.world.vai('adrenalina')) return null; o.world.avatar.teleport(spot.x, spot.z + 0.8); return spot; });
  /** Test: la camera dall'alto sulla funivia (screenshot dell'isola). */
  registerTestHook('adrenalinaVista', (zoom) => {
    if (!pv || !pm) return null;
    const c = a0.clone().lerp(a1, 0.45);
    o.renderer.diorama.setZoom(Number(zoom ?? 1)); o.renderer.diorama.follow(c.x, c.y * 0.4, c.z + 4); o.renderer.diorama.snap?.();
    return true;
  });

  return {
    vai: vaiCancello,
    isBusy: () => aperta() || busy,
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      if (!spot) return;
      const f = o.world.avatar.state;
      near = o.world.mode === 'walk' && !o.world.race.on && !aperta() && Math.hypot(f.x - spot.x, f.z - spot.z) < NEAR_M;
      if (near && !nearWas) o.hud.toast(firmata() ? 'La funivia per la vetta: premi A' : 'Il guardiano della funivia ti aspetta col foglio: premi A', 2600);
      nearWas = near;
      if (near && pressA) usa();
    },
    update(t) {
      btn.classList.toggle('on', near && !busy);
      // due cabine, una sale mentre l'altra scende, ferme qualche secondo alle stazioni; 6 scatti al secondo come il resto
      if (cabine.length) {
        const giro = 2 * (VIAGGIO_S + SOSTA_S), ts = Math.floor(t * 6) / 6;
        for (let i = 0; i < cabine.length; i++) {
          const u = ((ts + i * (VIAGGIO_S + SOSTA_S)) % giro + giro) % giro;
          const k = u < VIAGGIO_S ? u / VIAGGIO_S : u < VIAGGIO_S + SOSTA_S ? 1 : u < 2 * VIAGGIO_S + SOSTA_S ? 1 - (u - VIAGGIO_S - SOSTA_S) / VIAGGIO_S : 0;
          const s = k * k * (3 - 2 * k), x = i ? 1 : -1;
          cabine[i]!.position.copy(a0).lerp(a1, 0.04 + s * 0.92).add(new THREE.Vector3(x * FUNIVIA.scarto, 0, 0));
        }
      }
    },
  };
}
