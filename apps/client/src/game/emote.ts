// Emote (F3-emote-feed, CONTRACTS §13). STUB di WP0: play() manda l'emote in rete con una pausa di 1,5 s; niente fumetto ancora.
// F3-emote-feed sostituisce il corpo: fumetto DOM a pixel sopra la testa (world.anchorOf proiettato con la camera), anche per i peer
// (net.on('emote')), bottone #mzEmoteBtn su touch. Firma e id restano.
import type { Camera } from 'three';
import type { EmoteId } from '@marea/protocol';
import type { GameWorld } from './world.ts';
import { registerStateProvider } from '../test/testapi.ts';

export type Emotes = { play(id: EmoteId): boolean; update(dt: number): void; dispose(): void };
export const EMOTE_COOLDOWN_S = 1.5;

export function createEmotes(o: { world: GameWorld; camera: Camera; canvas: HTMLCanvasElement; root: HTMLElement }): Emotes {
  let cooldown = 0, last: { id: EmoteId; at: number } | null = null;
  registerStateProvider('emotes', () => ({ cooldown, last, shown: [] as { who: string; id: string; x: number; y: number; age: number }[] }));
  return {
    play(id) {
      if (cooldown > 0) return false;
      cooldown = EMOTE_COOLDOWN_S; last = { id, at: performance.now() };
      if (o.world.net.status === 'on') o.world.net.sendEmote(id);
      return true;
    },
    update(dt) { if (cooldown > 0) cooldown = Math.max(0, cooldown - dt); },
    dispose() { /* niente da liberare nello stub */ },
  };
}
