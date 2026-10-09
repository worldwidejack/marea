// Costanti tecniche della sim del dungeon (tempi in tick a 60 Hz, distanze in m). I numeri di gioco veri (nemici, armi, bottino)
// stanno in packages/content/src/rpg/*.json; qui solo la «meccanica»: soglie di input, coni di mira, intervalli di calcolo.
import { TICK_HZ } from '../constants.ts';

export const HZ = TICK_HZ;
/** A tenuto oltre questo = carica (mischia). */
export const HOLD_TICKS = Math.round(0.2 * HZ);
const DEG = Math.PI / 180;
/** Colpi di mischia (swing.ts): la lama spazza `arco` partendo da `inizio` (relativo alla faccia, + = destra) verso sinistra, tra le fasi
 *  `da` e `a` dello swing; ogni nemico in portata è colpito quando la lama gli passa sopra. Il client anima con gli stessi numeri. */
export const COLPI = {
  /** Fendente orizzontale da destra a sinistra, 150° davanti. */
  fendente: { inizio: 75 * DEG, arco: 150 * DEG, da: 0.3, a: 0.58 },
  /** Lancia: affondo stretto (40°), la portata fa il resto. */
  affondo: { inizio: 20 * DEG, arco: 40 * DEG, da: 0.32, a: 0.52 },
  /** Pugni: gancio di 100°. */
  pugno: { inizio: 50 * DEG, arco: 100 * DEG, da: 0.3, a: 0.55 },
  /** Caricato pieno: giro completo, parte da dietro a destra (dove la carica tiene l'arma). */
  giro: { inizio: 135 * DEG, arco: 360 * DEG, da: 0.22, a: 0.72 },
} as const;
/** Il giro del colpo caricato dura questo multiplo di uno swing normale. */
export const GIRO_TEMPO = 1.4;
/** Coseni dei mezzi angoli: mira assistita dell'arco ~25°, semicerchio davanti. */
export const COS_CONO_ARCO = 0.976;
export const COS_SEMICERCHIO = 0;
/** Il nemico colpisce solo se l'eroe è ancora davanti a lui (~145°) e in portata (+ tolleranza). */
export const COS_CONO_NEMICO = 0.3;
export const TOLLERANZA_NEMICO = 0.2;
/** Freccia: altezza di partenza, tensione minima al rilascio, durata massima del volo. */
export const FRECCIA_Y = 1.4;
export const TENSIONE_MIN = 0.25;
export const VOLO_MAX_TICKS = 4 * HZ;
/** Proiettili magici e nemici: altezza e durata massima. */
export const MAGIA_Y = 1.2;
export const MAGIA_GITTATA = 24;
/** Altezza utile di un bersaglio (un proiettile più alto lo sorvola). */
export const ALTEZZA_BERSAGLIO = 2.0;
/** Uscita: A entro questa distanza dal centro della scala. */
export const RAGGIO_USCITA = 1.2;
/** Altare di salvataggio: l'eroe lo tocca entro questa distanza dal centro della cella. */
export const RAGGIO_ALTARE = 1.2;
/** Raccolta automatica: distanza dal centro del bottino oltre al raggio dell'eroe. */
export const RAGGIO_RACCOLTA = 0.6;
/** Nemici aggiornati ogni tick solo entro questa distanza dall'eroe. */
export const RAGGIO_ATTIVO = 30;
/** Flow field verso l'eroe ricalcolato ogni N tick. */
export const FLOW_OGNI = 15;
/** Svegli quelli vicini a chi entra in aggro. */
export const RAGGIO_ALLARME = 6;
/** Chi dorme vede a questa frazione della vista. */
export const VISTA_DORMENDO = 0.5;
/** Probabilità che un nemico parta addormentato. */
export const P_DORME = 0.4;
/** Boss: ogni N attacchi uno ad area (raggio × portata, danno ×, preparazione ×). */
export const BOSS_AREA_OGNI = 3;
export const BOSS_AREA_RAGGIO = 1.7;
export const BOSS_AREA_DANNO = 1.25;
export const BOSS_AREA_PREP = 1.4;
/** Arcieri e maghi tengono questa frazione della gittata come distanza minima. */
export const DISTANZA_TIRATORI = 0.45;
/** Sanguinamento: durata. Sbilancia: spinta. */
export const SANGUINA_TICKS = 3 * HZ;
export const SPINTA = 1.2;
/** Animazioni brevi. */
export const COLPITO_TICKS = Math.round(0.25 * HZ);
export const COLPISCE_TICKS = Math.round(0.15 * HZ);
export const LANCIA_TICKS = Math.round(0.35 * HZ);
export const BEVE_TICKS = Math.round(0.5 * HZ);
/** Alleato evocato: compare a questa distanza davanti e resta entro questa distanza dall'eroe se non ha bersagli. */
export const ALLEATO_SEGUE = 2.5;
/** Pugni (arma rotta o nessuna arma): ripiego se RunHero non li descrive. */
export const PUGNI = { danno: 4, tempo: 0.5, portata: 1.1, carica: 0.8, caricaMolt: 1.6 } as const;
/** Monete per colpo dell'arco d'oro e per colpo preso con l'armatura d'oro. */
export const MONETE_COLPO: readonly [number, number] = [1, 3];
/** Peso di un oggetto non elencato in hero.pesi. */
export const PESO_IGNOTO = 1;
/** Drenaggio: A entro questa distanza dal centro della valvola la gira; il bacino si svuota in SCOLO_TICKS. */
export const RAGGIO_VALVOLA = 1.4;
export const SCOLO_TICKS = Math.round(3 * HZ);
/** Geyser attorno al Capoturno: 8 direzioni (versori), la prima cambia a ogni colpo ad area. */
const D = 0.7071067811865476;
export const GEYSER_DIR: readonly (readonly [number, number])[] = [[1, 0], [D, D], [0, 1], [-D, D], [-1, 0], [-D, -D], [0, -1], [D, -D]];
/** Archivio: A entro questa distanza dal centro del timone ferma la corrente; le carte cominciano a volare (avviso) così prima della
 *  raffica. Spinta da fuori: se l'eroe fa meno di questa frazione del passo voluto ha sbattuto contro un muro. */
export const RAGGIO_TIMONE = 1.4;
export const AVVISO_RAFFICA = Math.round(0.8 * HZ);
export const URTO_FRAZ = 0.5;
/** Bombardiere: distanza che tiene dall'eroe (frazioni della gittata della bomba). */
export const BOMBA_VICINO = 0.35;
export const BOMBA_LONTANO = 0.65;
/** Rosa dei venti dell'Astrolabio: 16 direzioni (versori), le salve pari usano quelle pari, le dispari quelle a mezzo spicchio. */
const C1 = 0.9238795325112867, S1 = 0.3826834323650898;
export const DIR16: readonly (readonly [number, number])[] = [
  [1, 0], [C1, S1], [D, D], [S1, C1], [0, 1], [-S1, C1], [-D, D], [-C1, S1], [-1, 0], [-C1, -S1], [-D, -D], [-S1, -C1], [0, -1], [S1, -C1], [D, -D], [C1, -S1],
];
/** Fucina: raggio di una cascata d'acqua (dal centro della sua cella); le crepe della lava si accendono così prima che scorra; chi brucia
 *  vede il danno a numeri ogni BRUCIA_NUMERO tick; al massimo FUOCHI_MAX chiazze di fuoco a terra (le più vecchie si spengono). Il
 *  Golem-Palombaro attacca solo con l'eroe così davanti (coseno); da dietro (coseno sotto RETRO_SCAFANDRO) gli colpisci le valvole. */
export const GETTO_RAGGIO = 1.1;
export const AVVISO_LAVA = Math.round(0.8 * HZ);
export const BRUCIA_NUMERO = Math.round(0.5 * HZ);
export const FUOCHI_MAX = 48;
export const COS_SCAFANDRO = 0.8;
export const RETRO_SCAFANDRO = -0.5;
/** Danno minimo di un colpo andato a segno. */
export const DANNO_MIN = 1;
