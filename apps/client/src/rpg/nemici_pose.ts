// Pose dei nemici snodati (issue 723): chi è, che colpo tira, e i bipedi. Ogni fotogramma: ossa a riposo, poi la posa dello stato della
// sim (`anim` e la sua fase `t` 0..1): fermo (respiro, sguardo), cammina/corre (passo legato ai metri fatti: niente piedi che
// scivolano), prepara (il telegrafo: carica lenta e leggibile, trema in fondo), colpisce (scatto), recupera, colpito (contraccolpo),
// stordito, dorme, muore (si accascia e cade con un tonfo). Il corpo intero (`b`) lo muove qui solo la posa; le tinte e i lampeggi restano
// in dungeon_actors.ts. Assi del modello: +X su una gamba o un braccio che pende = in avanti; +X sul busto = indietro.
import type * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import type { Rig } from './nemici_rig.ts';
import { campana, clamp01, colpo, esce, lerp, tonfo } from './nemici_rig.ts';
import { posaBestia } from './nemici_bestie.ts';

export type NemV = DungeonView['nemici'][number] & { area?: number };
export type Posa = {
  rig: Rig; n: NemV; b: THREE.Object3D; t: number;
  /** Secondi da quando è morto; metri camminati (fase del passo); velocità adesso (m/s); un numero suo per sfasare. */
  morto: number; passo: number; vel: number; seme: number;
  /** Arcieri: arco alzato e corda tesa (0..1), già calcolati da dungeon_actors per l'arco. */
  su: number; tesa: number; tiro: boolean;
  /** Prima persona, non-morti: dormono distesi; secondi da quando si sono svegliati (0 mentre dormono), −1 se non vale. */
  alzata: number;
};
export type Famiglia = 'bipede' | 'quadrupede' | 'ragno' | 'spettro' | 'uccello' | 'serpe' | 'macchina' | 'fiamma' | 'centauro';
/** Colpo in mischia e colpo a distanza (quando la sim dice `tiro`). */
export type Colpo = 'fendente' | 'mazzata' | 'affondo' | 'pugni' | 'morso' | 'magia' | 'lancio' | 'sparo' | 'arco' | 'zampata' | 'spinta' | 'scudo';
/** `mancino`: l'arma è nella sinistra (le pose del colpo si specchiano); `tavola`: sta sulla tavola da snowboard (niente passi). */
type Chi = { f: Famiglia; mischia: Colpo; tiro?: Colpo; mancino?: boolean; tavola?: boolean };

const CHI: Record<string, Chi> = {
  nem_bandito: { f: 'bipede', mischia: 'fendente', tiro: 'arco' },
  nem_scheletro: { f: 'bipede', mischia: 'fendente', tiro: 'arco' },
  nem_nonmorto: { f: 'bipede', mischia: 'fendente' },
  nem_re_ossa: { f: 'bipede', mischia: 'mazzata' },
  nem_golem: { f: 'bipede', mischia: 'pugni' },
  nem_custode: { f: 'spettro', mischia: 'mazzata', tiro: 'magia' },
  nem_spettro: { f: 'spettro', mischia: 'magia', tiro: 'magia' },
  nem_lupo: { f: 'quadrupede', mischia: 'morso' },
  nem_ragno: { f: 'ragno', mischia: 'zampata' },
  nem_tubo: { f: 'serpe', mischia: 'morso' },
  nem_operaio: { f: 'bipede', mischia: 'mazzata' },
  nem_valvola: { f: 'macchina', mischia: 'sparo', tiro: 'sparo' },
  nem_capoturno: { f: 'bipede', mischia: 'mazzata' },
  nem_archivista: { f: 'bipede', mischia: 'fendente' },
  nem_idroragno: { f: 'ragno', mischia: 'zampata', tiro: 'sparo' },
  nem_aerostato: { f: 'macchina', mischia: 'sparo', tiro: 'sparo' },
  nem_astrolabio: { f: 'macchina', mischia: 'sparo', tiro: 'sparo' },
  nem_anello: { f: 'macchina', mischia: 'spinta' },
  nem_scintilla: { f: 'fiamma', mischia: 'spinta' },
  nem_fornace: { f: 'macchina', mischia: 'spinta' },
  nem_palombaro: { f: 'bipede', mischia: 'pugni' },
  nem_forgiatore: { f: 'centauro', mischia: 'mazzata', tiro: 'mazzata' },
  nem_chierico: { f: 'bipede', mischia: 'magia', tiro: 'magia' },
  nem_sentinella: { f: 'bipede', mischia: 'scudo' },
  nem_guardia: { f: 'bipede', mischia: 'fendente', tiro: 'fendente', mancino: true },
  nem_custode_egida: { f: 'bipede', mischia: 'scudo', tiro: 'magia' },
  nem_guardiano: { f: 'bipede', mischia: 'scudo' },
  nem_fuciliere: { f: 'bipede', mischia: 'sparo', tiro: 'sparo' },
  nem_albatros: { f: 'uccello', mischia: 'morso' },
  nem_vaelen: { f: 'bipede', mischia: 'affondo', tiro: 'affondo' },
  nem_acrobata: { f: 'bipede', mischia: 'spinta', tavola: true },
  nem_alchimista: { f: 'bipede', mischia: 'lancio', tiro: 'lancio' },
  nem_sparaneve: { f: 'macchina', mischia: 'sparo', tiro: 'sparo' },
  nem_jean_claude: { f: 'bipede', mischia: 'mazzata' },
  nem_lanciatore_lava: { f: 'bipede', mischia: 'lancio', tiro: 'lancio' },
  nem_colosso: { f: 'bipede', mischia: 'mazzata' },
  nem_sciamano: { f: 'spettro', mischia: 'magia', tiro: 'magia' },
  nem_fatuo: { f: 'fiamma', mischia: 'spinta' },
  nem_mite: { f: 'bipede', mischia: 'pugni' },
  nem_korok: { f: 'bipede', mischia: 'mazzata', tiro: 'magia' },
};
export const chiE = (model: string): Chi => CHI[model] ?? { f: 'bipede', mischia: 'fendente', tiro: 'magia' };

/** Mette in posa il nemico. Ritorna false se il modello non ha le ossa che servono (allora anima dungeon_actors a corpo intero). */
export function posaNemico(p: Posa): boolean {
  const chi = chiE(p.n.model), r = p.rig;
  const ok = chi.f === 'bipede' ? r.ha('coscia_sx') : chi.f === 'quadrupede' || chi.f === 'centauro' ? r.ha('zampa_as') : chi.f === 'ragno' ? r.ha('zampa_1') : r.ha('corpo');
  if (!ok) return false;
  r.riposo();
  p.b.position.set(0, 0, 0); p.b.rotation.set(0, 0, 0);
  const fatto = chi.f === 'bipede' ? bipede(p, chi) : posaBestia(p, chi.f, p.n.tiro && chi.tiro ? chi.tiro : chi.mischia);
  accessori(p);
  return fatto;
}

/** I pezzi che si muovono da soli: la chiave della molla (gira forte mentre ricarica), aureole e schegge, l'anello che rotola, il pendolo
 *  dell'Astrolabio, il pallone che dondola, la fiamma che sfarfalla. */
function accessori(p: Posa): void {
  const { rig: r, n, t } = p, s = p.seme;
  r.ruota('chiave', 0, 0, t * (n.molla ? 16 : 2));
  r.ruota('aureola', 0, 0, t * 0.9); r.ruota('schegge', 0, t * 1.4, 0);
  r.ruota('anello', 0, 0, -t * 2.5 - p.passo / 0.42);
  r.ruota('pendolo', 0, 0, 0.35 * Math.sin(t * 2.2 + s));
  r.ruota('pallone', 0.04 * Math.sin(t * 0.9 + s), 0, 0.05 * Math.sin(t * 0.7 + s));
  r.ruota('fiamma', 0.15 * Math.sin(t * 9 + s), 0.3 * Math.sin(t * 5 + s), 0.12 * Math.sin(t * 11 + s));
}

// ------------------------------------------------------------------ bipedi
/** Pose chiave del colpo: [carica (fine di prepara), scatto (colpisce)], per osso: [x, y, z]. */
export type Chiave = Record<string, [number, number, number]>;
const CARICA: Record<string, Chiave> = {
  fendente: { busto: [0.14, -0.45, 0], braccio_dx: [2.7, 0, 0.25], avambraccio_dx: [0.7, 0, 0], braccio_sx: [0.5, 0, -0.35], avambraccio_sx: [0.6, 0, 0], testa: [-0.1, 0.25, 0] },
  mazzata: { busto: [0.3, -0.15, 0], braccio_dx: [2.9, 0, -0.15], braccio_sx: [2.9, 0, 0.15], avambraccio_dx: [0.6, 0, 0], avambraccio_sx: [0.6, 0, 0], testa: [-0.2, 0, 0] },
  pugni: { busto: [0.1, -0.6, 0], braccio_dx: [0.3, 0, 0.5], avambraccio_dx: [1.9, 0, 0], braccio_sx: [1.2, 0, -0.2], avambraccio_sx: [1.2, 0, 0], testa: [-0.15, 0.4, 0] },
  affondo: { busto: [0.1, -0.5, 0], braccio_dx: [0.9, 0, 0.3], avambraccio_dx: [1.3, 0, 0], braccio_sx: [0.8, 0, -0.3], avambraccio_sx: [0.5, 0, 0] },
  magia: { busto: [0.25, 0, 0], braccio_dx: [2.6, 0, 0.5], braccio_sx: [2.6, 0, -0.5], avambraccio_dx: [0.4, 0, 0], avambraccio_sx: [0.4, 0, 0], testa: [0.3, 0, 0] },
  lancio: { busto: [0.2, -0.6, 0], braccio_dx: [2.4, 0, 0.6], avambraccio_dx: [1.4, 0, 0], braccio_sx: [1.3, 0, -0.2], testa: [0, 0.3, 0] },
  spinta: { busto: [0.15, -0.2, 0], braccio_dx: [1.0, 0, 0.2], braccio_sx: [1.0, 0, -0.2], avambraccio_dx: [1.6, 0, 0], avambraccio_sx: [1.6, 0, 0] },
  sparo: { busto: [0.05, -0.3, 0], braccio_dx: [1.35, -0.2, 0.15], avambraccio_dx: [0.25, 0, 0], braccio_sx: [1.5, -0.4, -0.05], avambraccio_sx: [0.15, 0, 0], testa: [-0.1, 0.25, 0] },
  scudo: { busto: [0.1, -0.4, 0], braccio_dx: [-0.6, 0, 0.3], avambraccio_dx: [1.8, 0, 0], braccio_sx: [0.2, 0, -0.05], avambraccio_sx: [1.4, 0, 0], testa: [-0.1, 0, 0] },
};
const SCATTO: Record<string, Chiave> = {
  fendente: { busto: [-0.35, 0.45, 0], braccio_dx: [0.55, 0, -0.15], avambraccio_dx: [0.15, 0, 0], braccio_sx: [-0.4, 0, -0.3], avambraccio_sx: [0.3, 0, 0], testa: [0.1, -0.2, 0] },
  mazzata: { busto: [-0.5, 0, 0], braccio_dx: [0.7, 0, -0.1], braccio_sx: [0.7, 0, 0.1], avambraccio_dx: [0.1, 0, 0], avambraccio_sx: [0.1, 0, 0], testa: [0.25, 0, 0] },
  pugni: { busto: [-0.2, 0.5, 0], braccio_dx: [1.55, 0, 0], avambraccio_dx: [0.05, 0, 0], braccio_sx: [0.2, 0, -0.3], avambraccio_sx: [1.4, 0, 0], testa: [0, -0.3, 0] },
  affondo: { busto: [-0.25, 0.4, 0], braccio_dx: [1.55, 0, 0], avambraccio_dx: [0.05, 0, 0], braccio_sx: [0.2, 0, -0.4], avambraccio_sx: [0.3, 0, 0] },
  magia: { busto: [-0.2, 0, 0], braccio_dx: [1.5, 0, 0.1], braccio_sx: [1.5, 0, -0.1], avambraccio_dx: [0, 0, 0], avambraccio_sx: [0, 0, 0], testa: [-0.1, 0, 0] },
  lancio: { busto: [-0.3, 0.5, 0], braccio_dx: [1.2, 0, 0], avambraccio_dx: [0.1, 0, 0], braccio_sx: [-0.3, 0, -0.3], testa: [0, -0.2, 0] },
  spinta: { busto: [-0.3, 0, 0], braccio_dx: [1.5, 0, 0.1], braccio_sx: [1.5, 0, -0.1], avambraccio_dx: [0, 0, 0], avambraccio_sx: [0, 0, 0] },
  sparo: { busto: [0.2, -0.3, 0], braccio_dx: [1.4, -0.2, 0.15], avambraccio_dx: [0.15, 0, 0], braccio_sx: [1.5, -0.4, -0.05], avambraccio_sx: [0.1, 0, 0], testa: [0.1, 0.25, 0] },
  scudo: { busto: [-0.3, 0.35, 0], braccio_dx: [1.5, 0, 0], avambraccio_dx: [0.1, 0, 0], braccio_sx: [0.5, 0, -0.1], avambraccio_sx: [1.2, 0, 0], testa: [0.1, 0, 0] },
};
/** In guardia: chi ha un'arma la tiene avanti (fendente, affondo), chi picchia a due mani la tiene bassa, il mago le mani aperte. */
const GUARDIA: Record<string, Chiave> = {
  fendente: { braccio_dx: [0.45, 0, 0.1], avambraccio_dx: [0.55, 0, 0], braccio_sx: [0.15, 0, -0.15], avambraccio_sx: [0.4, 0, 0] },
  affondo: { braccio_dx: [0.45, 0, 0.1], avambraccio_dx: [0.7, 0, 0] },
  mazzata: { braccio_dx: [0.35, 0, -0.1], braccio_sx: [0.35, 0, 0.1], avambraccio_dx: [0.5, 0, 0], avambraccio_sx: [0.5, 0, 0] },
  pugni: { braccio_dx: [0.3, 0, 0.25], braccio_sx: [0.3, 0, -0.25], avambraccio_dx: [1.2, 0, 0], avambraccio_sx: [1.2, 0, 0] },
  magia: { braccio_dx: [0.3, 0, 0.35], braccio_sx: [0.3, 0, -0.35], avambraccio_dx: [0.5, 0, 0], avambraccio_sx: [0.5, 0, 0] },
  lancio: { braccio_dx: [0.3, 0, 0.2], avambraccio_dx: [0.9, 0, 0] },
  spinta: { braccio_dx: [0.4, 0, 0.1], braccio_sx: [0.4, 0, -0.1], avambraccio_dx: [0.9, 0, 0], avambraccio_sx: [0.9, 0, 0] },
  sparo: { braccio_dx: [0.55, 0, 0.1], avambraccio_dx: [0.35, 0, 0], braccio_sx: [0.6, -0.5, -0.1], avambraccio_sx: [1.0, 0, 0] },
  scudo: { braccio_sx: [0.05, 0, -0.05], avambraccio_sx: [1.4, 0, 0], braccio_dx: [0.3, 0, 0.2], avambraccio_dx: [1.0, 0, 0] },
};
const VUOTA: Chiave = {};
/** Le chiavi per chi tiene l'arma nella sinistra: _sx e _dx scambiati, girate al contrario. */
const specchi = new Map<Chiave, Chiave>();
function specchia(k: Chiave): Chiave {
  let o = specchi.get(k);
  if (!o) {
    o = Object.fromEntries(Object.entries(k).map(([n, [x, y, z]]) => [n.replace(/_sx$/, '_TMP').replace(/_dx$/, '_sx').replace(/_TMP$/, '_dx'), [x, -y, -z]]));
    specchi.set(k, o);
  }
  return o;
}
/** Le chiavi del colpo `stile` da una tabella, specchiate per i mancini. */
export function chiave(tab: Record<string, Chiave>, stile: string, mancino = false): Chiave {
  const k = tab[stile] ?? VUOTA;
  return mancino ? specchia(k) : k;
}
export { CARICA, SCATTO, GUARDIA };

/** Somma alla posa le chiavi `a` e `b` mescolate (k da 0 = a a 1 = b), per `peso`. */
export function chiavi(r: Rig, a: Chiave, b: Chiave, k: number, peso = 1): void {
  const nomi = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const nome of nomi) {
    const x = a[nome] ?? [0, 0, 0], y = b[nome] ?? [0, 0, 0];
    r.ruota(nome, lerp(x[0], y[0], k) * peso, lerp(x[1], y[1], k) * peso, lerp(x[2], y[2], k) * peso);
  }
}

function bipede(p: Posa, chi: Chi): boolean {
  const { rig: r, n, t, b } = p, H = r.h, s = p.seme;
  const stile = n.tiro && chi.tiro ? chi.tiro : chi.mischia, mc = !!chi.mancino;
  const respiro = Math.sin(t * 2.1 + s), cammina = clamp01(p.vel / 1.2), corre = clamp01((p.vel - 2.2) / 2);
  const fase = (p.passo / (0.62 * H + 0.1 * corre * H)) * Math.PI, sl = Math.sin(fase), cl = Math.cos(fase);
  // passo: cosce avanti e indietro, il ginocchio si piega mentre la gamba torna avanti, le braccia al contrario, il bacino che ondeggia
  const gambe = (A: number, ginocchio: number) => {
    r.ruota('coscia_sx', A * sl); r.ruota('coscia_dx', -A * sl);
    r.ruota('stinco_sx', -ginocchio * Math.max(0, cl)); r.ruota('stinco_dx', -ginocchio * Math.max(0, -cl));
  };
  const braccia = (A: number) => {
    r.ruota('braccio_sx', -A * sl, 0, -0.06); r.ruota('braccio_dx', A * sl, 0, 0.06);
    r.ruota('avambraccio_sx', 0.25 + 0.3 * A); r.ruota('avambraccio_dx', 0.25 + 0.3 * A);
  };
  const morto = n.anim === 'morto';
  if (morto) { muore(p); return true; }
  if (p.alzata >= 0 && (n.anim === 'dorme' || p.alzata < ALZATA)) { risorge(p); return true; }
  if (p.tiro) { arciere(p, cammina, fase); return true; }
  if (n.attacco === 'fucile' && n.anim !== 'colpito') { // il Fuciliere mira in ginocchio, fermo
    b.position.y = -0.2 * H;
    r.ruota('coscia_dx', 1.5); r.ruota('stinco_dx', -1.55); r.ruota('coscia_sx', -0.15); r.ruota('stinco_sx', -1.7);
    const k = n.anim === 'colpisce' ? 1 : n.anim === 'recupera' ? 1 - esce(n.t) : 0;
    chiavi(r, chiave(CARICA, 'sparo'), chiave(SCATTO, 'sparo'), k);
    return true;
  }
  if (chi.tavola) { tavola(p, stile); return true; }
  switch (n.anim) {
    case 'dorme': { // seduto a terra, la testa ciondola, il respiro lento
      const r2 = Math.sin(t * 1.1 + s);
      b.position.y = -0.24 * H;
      r.ruota('coscia_sx', 1.45, 0.25); r.ruota('coscia_dx', 1.45, -0.25); r.ruota('stinco_sx', -1.6); r.ruota('stinco_dx', -1.6);
      r.ruota('busto', -0.35 + 0.04 * r2); r.ruota('testa', -0.55 + 0.05 * r2, 0, 0.15);
      r.ruota('braccio_sx', 0.7, 0, -0.1); r.ruota('braccio_dx', 0.7, 0, 0.1); r.ruota('avambraccio_sx', 0.5); r.ruota('avambraccio_dx', 0.5);
      return true;
    }
    case 'prepara': {
      const k = esce(n.t), trema = n.t > 0.75 ? 0.025 * Math.sin(t * 70) : 0;
      gambe(0.5 * cammina, 0.8 * cammina);
      r.ruota('coscia_sx', 0.3 * k); r.ruota('coscia_dx', -0.25 * k); r.ruota('stinco_dx', -0.35 * k); r.ruota('stinco_sx', -0.2 * k);
      b.position.y = -0.03 * H * k; b.position.z = 0.04 * H * k;
      chiavi(r, chiave(GUARDIA, stile, mc), chiave(CARICA, stile, mc), k);
      r.ruota('busto', trema, trema);
      return true;
    }
    case 'colpisce': case 'recupera': {
      const su = n.anim === 'colpisce' ? colpo(n.t) : 1, giu = n.anim === 'recupera' ? esce(n.t) : 0;
      const affondo = 0.22 * H * su * (1 - giu);
      r.ruota('coscia_sx', lerp(0.55, 0.1, giu)); r.ruota('coscia_dx', lerp(-0.45, -0.05, giu)); r.ruota('stinco_dx', lerp(-0.5, 0, giu)); r.ruota('stinco_sx', lerp(-0.25, 0, giu));
      b.position.z = -affondo; b.position.y = -0.05 * H * (1 - giu);
      if (giu > 0) chiavi(r, chiave(SCATTO, stile, mc), chiave(GUARDIA, stile, mc), giu);
      else chiavi(r, chiave(CARICA, stile, mc), chiave(SCATTO, stile, mc), su);
      return true;
    }
    case 'colpito': { // contraccolpo: busto e testa indietro, braccia larghe, mezzo passo indietro
      const k = campana(n.t || 0.5);
      b.position.z = 0.12 * H * k;
      r.ruota('busto', 0.4 * k, 0.15 * k); r.ruota('testa', 0.45 * k);
      r.ruota('braccio_sx', 0.5 * k, 0, -0.6 * k); r.ruota('braccio_dx', 0.5 * k, 0, 0.6 * k);
      r.ruota('coscia_dx', -0.35 * k); r.ruota('stinco_sx', -0.4 * k); r.ruota('coscia_sx', 0.2 * k);
      return true;
    }
    default: { // fermo o in cammino: respiro, sguardo, guardia; correndo si piega in avanti
      const fermo = 1 - cammina;
      gambe(0.55 + 0.25 * corre, 0.9 + 0.5 * corre);
      braccia(0.55 * cammina * (1 - 0.4 * (stile === 'fendente' ? 1 : 0)) + 0.35 * corre);
      b.position.y = 0.03 * H * cammina * Math.abs(cl) - 0.01 * H * cammina + 0.004 * H * respiro * fermo;
      r.ruota('bacino', 0, 0.12 * sl * cammina, 0.04 * cl * cammina);
      r.ruota('busto', -0.08 * cammina - 0.2 * corre + 0.025 * respiro * fermo, -0.18 * sl * cammina);
      r.ruota('testa', 0.06 * cammina, fermo * 0.35 * Math.sin(t * 0.45 + s * 3), 0);
      chiavi(r, VUOTA, chiave(GUARDIA, stile, mc), 1, n.anim === 'insegue' ? 1 : 0.5);
      if (n.stordito || n.paralizzato) { r.ruota('testa', 0.25, 0, 0.3 * Math.sin(t * 3)); r.ruota('busto', -0.15); }
      return true;
    }
  }
}

/** Sulla tavola da snowboard: ginocchia piegate, di traverso, braccia larghe per l'equilibrio; carica accucciato e fa la trottola. */
function tavola(p: Posa, stile: Colpo): void {
  const { rig: r, n, t, b } = p, H = r.h, s = p.seme, va = clamp01(p.vel / 1.5);
  const piega = n.anim === 'prepara' ? 0.35 + 0.45 * esce(n.t) : 0.35 + 0.1 * va;
  r.sposta('bacino', 0, -0.12 * H * piega, 0);
  r.ruota('coscia_sx', piega, 0, -0.08); r.ruota('coscia_dx', piega, 0, 0.08); r.ruota('stinco_sx', -2 * piega); r.ruota('stinco_dx', -2 * piega);
  b.rotation.y = -Math.PI / 2; // la tavola nel verso della corsa, lui di traverso che guarda avanti
  r.ruota('busto', -0.15 - 0.2 * va, 0.5 + 0.15 * Math.sin(t * 2 + s), 0.1 * Math.sin(t * 1.3 + s));
  r.ruota('testa', 0, 0.9); r.ruota('braccio_sx', 0.2, 0, -0.9 - 0.15 * Math.sin(t * 2.5 + s)); r.ruota('braccio_dx', 0.2, 0, 0.9 + 0.15 * Math.sin(t * 2.5 + s));
  r.ruota('avambraccio_sx', 0.3); r.ruota('avambraccio_dx', 0.3);
  b.rotation.z = 0.08 * Math.sin(t * 1.7 + s) * va;
  if (n.anim === 'colpisce' || n.anim === 'recupera') { // la trottola
    const k = n.anim === 'colpisce' ? n.t : 1 + esce(n.t);
    b.rotation.y = -Math.PI / 2 + k * Math.PI * 2; b.position.y = 0.25 * H * campana(n.anim === 'colpisce' ? n.t : 0);
  }
  if (n.anim === 'colpito') { const k = campana(n.t || 0.5); r.ruota('busto', 0.4 * k); }
  void stile;
}

const ALZATA = 0.8;
/** Non-morto disteso nella tomba: braccia incrociate; svegliato si mette seduto, puntella una mano, piega le ginocchia e si tira su. */
function risorge(p: Posa): void {
  const { rig: r, b, n, t } = p, H = r.h;
  const k = n.anim === 'dorme' ? 0 : clamp01(p.alzata / ALZATA), siede = esce(k / 0.55), sta = esce((k - 0.45) / 0.55);
  const giu = 1 - siede;
  b.rotation.x = 1.5 * giu; b.position.set(0, 0.1 * H * giu + 0.0, 0.5 * giu - 0.25 * H * (siede - sta) * 0.3);
  b.position.y += -0.25 * H * siede * (1 - sta);
  const ginocchia = siede * (1 - sta);
  r.ruota('coscia_sx', 1.5 * ginocchia); r.ruota('coscia_dx', 1.3 * ginocchia); r.ruota('stinco_sx', -1.7 * ginocchia); r.ruota('stinco_dx', -1.5 * ginocchia);
  r.ruota('busto', -0.3 * ginocchia + 0.02 * Math.sin(t * 0.8) * giu);
  r.ruota('braccio_sx', lerp(0.6, -0.4, siede) * (1 - sta), 0, -0.3 * giu); r.ruota('braccio_dx', lerp(0.6, 0.2, siede) * (1 - sta), 0, 0.3 * giu);
  r.ruota('avambraccio_sx', 1.6 * giu); r.ruota('avambraccio_dx', 1.6 * giu);
  r.ruota('testa', -0.2 * giu + 0.4 * ginocchia * Math.sin(k * 12));
}

/** Arciere: di fianco, il braccio sinistro alza l'arco verso il bersaglio, il destro tira la corda a gradini (come l'arco di arco.ts). */
function arciere(p: Posa, cammina: number, fase: number): void {
  const { rig: r, n } = p, su = p.su, tesa = p.tesa, sl = Math.sin(fase);
  r.ruota('coscia_sx', 0.5 * cammina * sl + 0.2 * su); r.ruota('coscia_dx', -0.5 * cammina * sl - 0.15 * su);
  p.b.rotation.y = -0.9 * su; // di fianco, come l'arco di dungeon_actors (FIANCO)
  r.ruota('busto', 0.05 * su); r.ruota('testa', 0, 0.85 * su);
  r.ruota('braccio_sx', 1.5 * su, 0.9 * su, -0.1 * su);
  r.ruota('braccio_dx', 1.45 * su, 0.9 * su, 0.35 * su * tesa); r.ruota('avambraccio_dx', 0.3 + 1.8 * tesa * su);
  if (n.anim === 'colpisce') r.ruota('busto', 0.08);
}

/** Muore: le ginocchia cedono, poi cade all'indietro (o di lato, a seconda del seme) con un tonfo; le braccia si allargano. */
function muore(p: Posa): void {
  const { rig: r, b, morto: s } = p, H = r.h;
  const piega = esce(s / 0.25), cade = tonfo((s - 0.12) / 0.45), lato = p.seme % 2 < 1 ? 1 : -1;
  r.ruota('coscia_sx', 0.9 * piega); r.ruota('coscia_dx', 0.6 * piega); r.ruota('stinco_sx', -1.4 * piega); r.ruota('stinco_dx', -1.1 * piega);
  r.ruota('busto', 0.3 * cade, 0.3 * lato * cade); r.ruota('testa', 0.5 * cade, 0, 0.3 * lato * cade);
  r.ruota('braccio_sx', 0.6 * piega, 0, -1.1 * cade); r.ruota('braccio_dx', 0.6 * piega, 0, 1.1 * cade);
  b.position.y = -0.18 * H * piega + 0.12 * H * cade;
  b.rotation.x = 1.45 * cade; b.rotation.z = 0.25 * lato * cade;
  b.position.z = 0.25 * H * cade;
}
