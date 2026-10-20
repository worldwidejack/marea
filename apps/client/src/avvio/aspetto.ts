// La resa delle impostazioni (passata finale, acqua stampa, ciclo giorno/notte, meteo): si scarica solo se qualcosa è acceso, con tutto
// spento zero byte in più. Più gli agganci dei test su luce e meteo.
import type { GameWorld } from '../game/world.ts';
import type { Hud } from '../ui/hud.ts';
import type { Renderer } from '../render/scene.ts';
import { tuttoSpento } from '../render/viste.ts';
import type { Impostazioni } from '../render/viste.ts';
import type { Aspetto } from '../render/aspetto.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export function aspettoGrafico(o: { renderer: Renderer; world: GameWorld; hud: Hud }): { get(): Aspetto | null; applica(s: Impostazioni): void } {
  const { renderer, world, hud } = o;
  let aspetto: Aspetto | null = null, aspettoLoad: Promise<void> | null = null, voglio: Impostazioni | null = null;
  const applica = (s: Impostazioni) => {
    voglio = s;
    if (aspetto) { aspetto.set(s); return; }
    if (tuttoSpento(s)) return;
    aspettoLoad ??= import('../render/aspetto.ts').then((m) => {
      aspetto = m.createAspetto({ renderer, lights: world.lights, water: world.water, map: world.map, scena: { props: world.archipelago.props, groundY: world.groundY } });
      if (voglio) aspetto.set(voglio);
    }).catch(() => { aspettoLoad = null; hud.toast('Impostazioni non caricate: riprova'); });
  };
  registerTestHook('ciclo', (f) => aspetto?.forzaFase(f === null || f === undefined ? null : Number(f)));
  registerTestHook('aspettoPronto', () => aspettoLoad ?? Promise.resolve());
  registerStateProvider('aspetto', () => ({ momento: aspetto ? aspetto.momento : (renderer.alChiuso ? 'interno' : 'giorno'), post: aspetto?.attivo ?? false, caricato: !!aspetto, luci: aspetto?.luci ?? 0, meteoK: aspetto?.meteoK ?? 0, gocce: aspetto?.gocce ?? 0, chiuso: renderer.alChiuso, interno: renderer.interno }));
  // meteo: il tempo dove sei, 'sereno' | 'bianca' | 'grigia' | 'pioggia' | 'temporale' (la nuvola che hai sopra), 'spento' con l'impostazione
  // spenta; `nuvole` quante ce ne sono, quanto piove e lampeggia dove sei. Dai test: meteo(tipo, k) una nuvola sopra di te (null = l'orologio),
  // nuvole([{ tipo, dx, dz, r }]) nuvole ferme attorno a te, lampo(true) un lampo fisso nel temporale più vicino
  registerStateProvider('meteo', () => aspetto?.meteo ?? 'spento');
  registerStateProvider('nuvole', () => aspetto?.nuvole ?? null);
  registerTestHook('meteo', (st, k) => aspetto?.forzaMeteo(st === null || st === undefined ? null : (String(st) as 'sereno'), k === undefined ? 1 : Number(k)));
  registerTestHook('nuvole', (ns) => aspetto?.forzaNuvole(Array.isArray(ns) ? (ns as { tipo: 'bianca'; dx: number; dz: number; r?: number }[]) : null));
  registerTestHook('lampo', (on) => aspetto?.forzaLampo(on === true));
  return { get: () => aspetto, applica };
}
