// Input log del dungeon (RLE, mx/my a 1/8) e replay deterministico per il server. STUB di WP0: lo riempie R-dungeon.
import type { RunHero, RunResult } from '../rpg/types.ts';
import type { DungeonInput, PackedDungeon } from './types.ts';

export function quantizeDungeon(f: DungeonInput): DungeonInput { return f; }
export function packDungeon(frames: readonly DungeonInput[]): PackedDungeon { void frames; return []; }
export function unpackDungeon(p: PackedDungeon): DungeonInput[] { void p; return []; }
export function isPackedDungeon(v: unknown, maxTicks: number): v is PackedDungeon { void v; void maxTicks; return false; }
export function replayDungeon(seed: number, dungeonId: string, hero: RunHero, p: PackedDungeon): RunResult { void seed; void dungeonId; void hero; void p; throw new Error('TODO R-dungeon: replayDungeon'); }
