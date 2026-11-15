// Come si vede ogni magia nel dungeon (docs/RPG.md §Magie): colore in mano, forma in volo (magie_forme.ts), scia, colpo a segno, scoppio
// e raggio (magie_colpi.ts, magie_raggi.ts), famiglia del suono d'impatto (audio/effetti.ts). Solo colori di palette. Vale soltanto dove la
// sim manda l'id della magia (`m`), cioè fuori dall'Arena: lì restano i disegni di sempre per elemento (magie_fx.ts, dungeon_actors.ts).
import { PAL } from '../ui/style.ts';

/** Famiglia del suono d'impatto. */
export type Famiglia = 'fuoco' | 'sparo' | 'elettro' | 'luce' | 'vuoto' | 'acqua' | 'cura' | 'furia' | 'evoca';
/** Forma in volo. */
export type Volo = 'palla' | 'pallottola' | 'saetta' | 'dardo' | 'bomba' | 'brace' | 'atomo' | 'vuoto' | 'lame' | 'sfera_cura' | 'sfera_furia';
/** Cosa resta indietro mentre vola. */
export type Scia = 'braci' | 'fumo' | 'scintille' | 'luce' | 'vuoto' | 'gocce' | 'croci' | 'rosa';
/** Il colpo a segno dei proiettili. */
export type Impatto = 'sbuffo' | 'nuvola' | 'scintille' | 'stella';
/** Lo scoppio delle bombe. */
export type Scoppio = 'fungo' | 'pop' | 'saette' | 'squarcio' | 'vortice' | 'croci' | 'chevron';
/** Il disegno del raggio continuo. */
export type Raggio = 'fiamma' | 'zigzag' | 'colata' | 'bussola' | 'elica' | 'chevron';

export type Stile = { mano: string; col: readonly string[]; suono: Famiglia; volo?: Volo; scia?: Scia; impatto?: Impatto; scoppio?: Scoppio; raggio?: Raggio };

const FUOCO = [PAL.giallo, PAL.arancio, PAL.rosso, PAL.arancio] as const;
const ELETTRO = [PAL.giallo, PAL.acquaBassa, PAL.sabbiaChiara, PAL.giallo] as const;
const STILI: Record<string, Stile> = {
  fiammata: { mano: PAL.arancio, col: FUOCO, suono: 'fuoco', volo: 'palla', scia: 'braci', impatto: 'sbuffo' },
  salva_fuciliere: { mano: PAL.rosso, col: [PAL.giallo, PAL.arancio, PAL.pietraChiara, PAL.pietra], suono: 'sparo', volo: 'pallottola', scia: 'fumo', impatto: 'nuvola' },
  fulmine: { mano: PAL.giallo, col: ELETTRO, suono: 'elettro', volo: 'saetta', scia: 'scintille', impatto: 'scintille' },
  lampo_faro: { mano: PAL.sabbiaChiara, col: [PAL.sabbiaChiara, PAL.giallo, PAL.sabbiaChiara, PAL.acquaBassa], suono: 'luce', volo: 'dardo', scia: 'luce', impatto: 'stella' },
  fuoco_continuo: { mano: PAL.arancio, col: FUOCO, suono: 'fuoco', raggio: 'fiamma' },
  colata: { mano: PAL.giallo, col: [PAL.giallo, PAL.arancio, PAL.rosso, PAL.legnoScuro], suono: 'fuoco', raggio: 'colata' },
  elettro_continuo: { mano: PAL.giallo, col: ELETTRO, suono: 'elettro', raggio: 'zigzag' },
  bussola_fulminante: { mano: PAL.acquaBassa, col: [PAL.acquaBassa, PAL.sabbiaChiara, PAL.acqua, PAL.giallo], suono: 'elettro', raggio: 'bussola' },
  cura_flusso: { mano: PAL.erba, col: [PAL.erbaChiara, PAL.erba, PAL.sabbiaChiara, PAL.acquaBassa], suono: 'cura', raggio: 'elica' },
  furia_flusso: { mano: PAL.rosaNeon, col: [PAL.rosso, PAL.rosaNeon, PAL.arancio, PAL.giallo], suono: 'furia', raggio: 'chevron' },
  bomba_fuoco: { mano: PAL.rosso, col: FUOCO, suono: 'fuoco', volo: 'bomba', scia: 'fumo', scoppio: 'fungo' },
  pioggia_braci: { mano: PAL.arancio, col: FUOCO, suono: 'fuoco', volo: 'brace', scia: 'braci', scoppio: 'pop' },
  bomba_elettrica: { mano: PAL.giallo, col: ELETTRO, suono: 'elettro', volo: 'atomo', scia: 'scintille', scoppio: 'saette' },
  squarcio_vuoto: { mano: PAL.viola, col: [PAL.viola, PAL.neroCaldo, PAL.rosaNeon, PAL.viola], suono: 'vuoto', volo: 'vuoto', scia: 'vuoto', scoppio: 'squarcio' },
  valzer_lame: { mano: PAL.acquaBassa, col: [PAL.acquaBassa, PAL.acqua, PAL.sabbiaChiara, PAL.giallo], suono: 'acqua', volo: 'lame', scia: 'gocce', scoppio: 'vortice' },
  cura_bomba: { mano: PAL.erba, col: [PAL.erbaChiara, PAL.erba, PAL.sabbiaChiara, PAL.erba], suono: 'cura', volo: 'sfera_cura', scia: 'croci', scoppio: 'croci' },
  furia_bomba: { mano: PAL.rosaNeon, col: [PAL.rosso, PAL.rosaNeon, PAL.arancio, PAL.giallo], suono: 'furia', volo: 'sfera_furia', scia: 'rosa', scoppio: 'chevron' },
};
/** Le evocazioni: il cerchio viola dove nasce l'alleato. */
export const EVOCA: readonly string[] = [PAL.viola, PAL.rosaNeon, PAL.sabbiaChiara, PAL.viola];

/** Numero «casuale» stabile (0..1) per un intero: i tremolii si ridisegnano a scatti, non a ogni frame. */
export const rnd = (n: number): number => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
/** 0..1 a gradini (`n` scatti): niente movimenti lisci. */
export const scatti = (v: number, n: number): number => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;

/** Lo stile della magia `id` (undefined = una magia senza disegno suo: si vede com'era). */
export const stile = (id: string | undefined): Stile | undefined => (id ? STILI[id] : undefined);
