// Costanti tecniche della sim del dungeon (tempi in tick a 60 Hz, distanze in m). I numeri di gioco veri (nemici, armi, bottino)
// stanno in packages/content/src/rpg/*.json; qui solo la «meccanica»: soglie di input, coni di mira, intervalli di calcolo.
import { TICK_HZ } from '../constants.ts';

export const HZ = TICK_HZ;
/** A tenuto oltre questo = carica (mischia). */
export const HOLD_TICKS = Math.round(0.2 * HZ);
/** Coseni dei mezzi angoli: cono del colpo 90°, mira assistita dell'arco ~25°, semicerchio davanti. */
export const COS_CONO_COLPO = 0.7071;
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
/** Danno minimo di un colpo andato a segno. */
export const DANNO_MIN = 1;
