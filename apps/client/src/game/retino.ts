// Il retino in mano. A tenuto lo carica (il retino va indietro, si cammina piano e gli insetti si accorgono di te da molto più vicino);
// al rilascio parte il colpo, che arriva a terra, resta lì un istante e risale, col personaggio fermo. Qui si collegano la macchina a
// stati (retino_azione.ts), le pose (retino_chiavi.ts), il corpo (retino_anim.ts) e la presa: un insetto è preso solo se finisce dentro
// la rete (retino_presa.ts). Come si muovono gli insetti: insetti_vita.ts; chi li tiene e parla col server: insetti.ts.
import { RETINO as CFG } from '@marea/content/insetti.ts';
import type { GameWorld } from './world.ts';
import type { Disegna } from './animali_vita.ts';
import { prendibile } from './insetti_vita.ts';
import type { Attore } from './insetti_vita.ts';
import { creaAzioneRetino } from './retino_azione.ts';
import type { AzioneRetino, FaseColpo } from './retino_azione.ts';
import { IMPATTO, posaRetino } from './retino_chiavi.ts';
import { creaRetinoAnim } from './retino_anim.ts';
import { capsulaRete, centroRete, daAvatar, dalModello, posaDaMano, presaLungo } from './retino_presa.ts';
import type { Capsula, Punto } from './retino_presa.ts';
import { MIRINO, RETINO } from '../render/insetti_forme.ts';
import { suona } from '../audio/ponte.ts';

const { rete, uso } = CFG;
/** Quanto sopra il prato sta il centro di un insetto, e quanto dentro la sacca si vede l'insetto preso (frazione della sacca). */
const CENTRO = 0.1, NELLA_SACCA = 0.45;
/** A che distanza da A non arriva più niente prima di lasciar perdere la carica (un altro bottone ha preso A). */
const SENZA_A_MS = 160;

export type Retino = {
  /** Carica o colpo in corso: A è del retino. */
  occupato(): boolean;
  /** A (o il bottone) premuto adesso, una volta per tick. */
  premi(giu: boolean): void;
  annulla(): void;
  /** Un colpo al volo, come un tocco di A senza tenerlo (per i test). */
  tocco(): void;
  /** Retino tenuto carico (A premuto, il colpo non è ancora partito). */
  carico(): boolean;
  /** Il colpo è partito: il personaggio sta fermo. */
  fermo(): boolean;
  /** Frazione del raggio a cui gli insetti si accorgono di te (1 = normale). */
  furtivo(): number;
  /** Ogni frame; `attivo` = il retino è in mano e si può usare. */
  update(dt: number, attivo: boolean): void;
  /** Il retino in mano e, da carico, dove atterrerebbe la rete. */
  disegna(put: Disegna): void;
  stato(): object;
  /** Solo per i test: ferma il retino in una posa (`null` lo lascia andare). */
  forza(fase: FaseColpo | 'guardia' | 'carica' | null, t?: number): void;
};

export function creaRetino(o: { w: GameWorld; attori: Map<string, Attore>; preso(a: Attore): void; polvere(x: number, y: number, z: number): void }): Retino {
  const w = o.w, az = creaAzioneRetino(uso), anim = creaRetinoAnim(w);
  let prima: Capsula | null = null, ultimoPremi = 0, forzata: Pick<AzioneRetino, 'fase' | 'carica' | 'colpo'> | null = null, ora: Pick<AzioneRetino, 'fase' | 'carica' | 'colpo'> = az;
  const dentro = new Set<Attore>(); // già nella rete, in attesa del server
  const p1: Punto = { x: 0, y: 0, z: 0 }, p2: Punto = { x: 0, y: 0, z: 0 };

  const impatto = () => {
    const c = dalModello(anim.posa(), 0, centroRete(rete), 0, p1);
    o.polvere(c.x, w.groundY(c.x, c.z) + 0.1, c.z);
    suona('plop');
    let via = false;
    for (const b of o.attori.values()) {
      if (dentro.has(b) || b.stato === 'preso' || b.stato === 'acqua' || b.stato === 'cade' || b.stato === 'scappa' || b.stato === 'via' || b.stato === 'appeso') continue;
      if (Math.hypot(b.x - c.x, b.z - c.z) < uso.allarme) { b.stato = 'scappa'; b.t = 0; b.spavento = true; via = true; }
    }
    if (via) suona('scappato');
  };
  /** Dove atterrerebbe il centro della rete adesso, dalla posizione e dalla prua che hai. */
  const mira = (out: Punto): Punto => {
    const av = w.avatar.object, yaw = -av.rotation.y, m = daAvatar(av.position.x, av.position.z, yaw, IMPATTO.hx, IMPATTO.hz);
    return dalModello(posaDaMano({ x: m.x, y: av.position.y + IMPATTO.hy, z: m.z }, yaw - IMPATTO.giro, IMPATTO.pitch, IMPATTO.roll), 0, centroRete(rete), 0, out);
  };
  const mirino = (put: Disegna) => {
    const c = mira(p2);
    put(MIRINO, c.x, w.groundY(c.x, c.z), c.z, 0, 0, 0, rete.raggio * (1 + 0.08 * Math.sin(performance.now() / 90)));
  };

  return {
    occupato: () => az.occupato(),
    premi(giu) { ultimoPremi = performance.now(); az.premi(giu); },
    annulla() { az.annulla(); w.avatar.passo = 1; },
    tocco() { ultimoPremi = performance.now(); az.premi(true); az.premi(false); },
    carico: () => az.fase === 'carica',
    fermo: () => az.fermo(),
    furtivo: () => (az.fase === 'carica' || az.colpo?.fase === 'avvio' ? uso.furtivoCarico : 1),
    update(dt, attivo) {
      if (!attivo) { anim.aggiorna(null); az.annulla(); forzata = null; w.avatar.passo = 1; prima = null; dentro.clear(); return; }
      if (az.fase === 'carica' && performance.now() - ultimoPremi > SENZA_A_MS) az.annulla();
      const ev = forzata ? [] : az.passo(dt), s = (ora = forzata ?? az);
      w.avatar.passo = s.fase === 'carica' ? uso.passoCarico : 1;
      anim.aggiorna(posaRetino(s));
      // la presa: dal fendente al ritardo d'atterraggio, ogni punto toccato dalla rete da un frame all'altro
      const c = s.colpo;
      if (c && (c.fase === 'fendente' || c.fase === 'impatto' || c.fase === 'lag') && anim.attivo()) {
        const cap = capsulaRete(anim.posa(), rete);
        for (const a of o.attori.values()) {
          if (!prendibile(a)) continue;
          p1.x = a.x; p1.z = a.z; p1.y = w.groundY(a.x, a.z) + a.y + CENTRO;
          if (presaLungo(prima, cap, p1, rete.corpo)) { dentro.add(a); o.preso(a); }
        }
        prima = cap;
      } else prima = null;
      // chi è nella rete ci resta finché il server non risponde
      for (const a of dentro) {
        if (a.stato !== 'preso' || o.attori.get(a.k) !== a) { dentro.delete(a); continue; }
        const q = dalModello(anim.posa(), 0, centroRete(rete), NELLA_SACCA * rete.sacca, p1);
        a.x = q.x; a.z = q.z; a.y = Math.max(0, q.y - w.groundY(q.x, q.z));
      }
      for (const e of ev) { if (e === 'fendente') suona('lancio'); else if (e === 'impatto') impatto(); }
    },
    disegna(put) {
      if (!anim.attivo()) return;
      const p = anim.posa();
      put(RETINO, p.x, p.y, p.z, p.h, p.pitch, p.roll, 1);
      if (ora.fase === 'carica' && ora.carica > 0.5) mirino(put);
    },
    stato: () => ({ fase: az.fase, carica: az.carica, colpo: az.colpo, passo: w.avatar.passo, posa: anim.attivo() ? anim.posa() : null, dentro: dentro.size, mira: mira({ x: 0, y: 0, z: 0 }) }),
    forza(fase, t = 0) {
      if (!fase) { forzata = null; return; }
      const durate: Record<FaseColpo, number> = { avvio: uso.avvioS, fendente: uso.fendenteS, impatto: uso.impattoS, lag: uso.lagS, risalita: uso.risalitaS };
      forzata = fase === 'guardia' || fase === 'carica'
        ? { fase, carica: fase === 'carica' ? t : 0, colpo: null }
        : { fase: 'colpo', carica: 1, colpo: { fase, t: t * durate[fase], durata: durate[fase], da: 1 } };
    },
  };
}
