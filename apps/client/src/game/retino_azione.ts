// La macchina a stati del retino. A tenuto carica (il retino va indietro, si cammina piano); al rilascio parte il colpo: ultimo tratto
// di carica, fendente fino a terra, rete ferma sul prato, ritardo d'atterraggio e risalita. Dal rilascio alla risalita il personaggio
// sta fermo. Niente three né orologi: gira anche nei test di Node, i tempi arrivano da @marea/content (insetti.json `retino.uso`).
import type { RetinoUso } from '@marea/content/insetti.ts';

export type FaseColpo = 'avvio' | 'fendente' | 'impatto' | 'lag' | 'risalita';
export type EventoRetino = 'fendente' | 'impatto' | 'fine';
/** `t` secondi dentro la fase, che dura `durata`; `da` = quanto era carico il retino al rilascio (0..1). */
export type StatoColpo = { fase: FaseColpo; t: number; durata: number; da: number };
export type FaseRetino = 'guardia' | 'carica' | 'colpo';

export type AzioneRetino = {
  /** A (o il bottone) premuto adesso, una volta per tick. La carica parte quando si preme, il colpo quando si rilascia. */
  premi(giu: boolean): void;
  /** Avanza di `dt` secondi; dice cosa è appena successo. */
  passo(dt: number): EventoRetino[];
  /** Torna in guardia (cambio di attrezzo, uscita dal Borgo). Per ricaricare serve premere di nuovo. */
  annulla(): void;
  readonly fase: FaseRetino;
  /** 0 = in guardia, 1 = tutto indietro. */
  readonly carica: number;
  readonly colpo: StatoColpo | null;
  /** Dal rilascio alla risalita: il personaggio non cammina. */
  fermo(): boolean;
  /** Carica o colpo in corso: A è del retino. */
  occupato(): boolean;
};

export function creaAzioneRetino(u: RetinoUso): AzioneRetino {
  let fase: FaseRetino = 'guardia', carica = 0, colpo: StatoColpo | null = null, giuPrima = false;
  const eventi: EventoRetino[] = [];
  const parti = () => {
    const resto = 1 - carica;
    fase = 'colpo';
    if (resto > 0.001) colpo = { fase: 'avvio', t: 0, durata: Math.max(u.avvioS, resto * u.caricaS), da: carica };
    else { colpo = { fase: 'fendente', t: 0, durata: u.fendenteS, da: 1 }; eventi.push('fendente'); }
  };
  const SEGUE: Record<Exclude<FaseColpo, 'risalita'>, [FaseColpo, number, EventoRetino?]> = {
    avvio: ['fendente', u.fendenteS, 'fendente'], fendente: ['impatto', u.impattoS, 'impatto'], impatto: ['lag', u.lagS], lag: ['risalita', u.risalitaS],
  };
  return {
    premi(giu) {
      if (giu && !giuPrima && fase === 'guardia') { fase = 'carica'; carica = 0; }
      else if (!giu && fase === 'carica') parti();
      giuPrima = giu;
    },
    passo(dt) {
      if (fase === 'carica') carica = Math.min(1, carica + dt / u.caricaS);
      else if (colpo) {
        let c: StatoColpo | null = colpo;
        c.t += dt;
        while (c && c.t >= c.durata) {
          const resto: number = c.t - c.durata;
          if (c.fase === 'risalita') { c = null; fase = 'guardia'; carica = 0; eventi.push('fine'); break; }
          const [prossima, durata, ev]: [FaseColpo, number, EventoRetino?] = SEGUE[c.fase];
          c = { fase: prossima, t: resto, durata, da: 1 };
          carica = 1;
          if (ev) eventi.push(ev);
        }
        colpo = c;
      }
      return eventi.splice(0);
    },
    annulla() { fase = 'guardia'; carica = 0; colpo = null; eventi.length = 0; },
    get fase() { return fase; },
    get carica() { return carica; },
    get colpo() { return colpo; },
    fermo: () => fase === 'colpo',
    occupato: () => fase !== 'guardia',
  };
}
