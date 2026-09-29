// window.__game per i test Playwright (contratto CONTRACTS.md §7). Gli hook mutanti funzionano solo con ?test=1.
import { FLAGS } from '../flags.ts';

type Provider = () => unknown;
type Perf = { drawCalls: number; triangles: number; fps: number; frameMs: number };
const providers = new Map<string, Provider>();
let perfProvider: () => Perf = () => ({ drawCalls: 0, triangles: 0, fps: 0, frameMs: 0 });
const hooks: Record<string, (...a: unknown[]) => unknown> = {};

export function registerStateProvider(key: string, fn: Provider): () => void {
  providers.set(key, fn);
  return () => providers.delete(key);
}
export function registerPerfProvider(fn: () => Perf): void { perfProvider = fn; }
export function registerTestHook(name: string, fn: (...a: unknown[]) => unknown): void {
  hooks[name] = (...a) => { if (!FLAGS.test) throw new Error('serve ?test=1'); return fn(...a); };
}
export function installTestApi(build: string): void {
  const g = {
    ready: false, build, flags: FLAGS,
    state: () => { const o: Record<string, unknown> = {}; for (const [k, f] of providers) { try { o[k] = f(); } catch (e) { o[k] = { error: String(e) }; } } return o; },
    perf: () => perfProvider(),
    test: hooks,
  };
  (window as unknown as { __game: typeof g }).__game = g;
}
export function setReady(): void { (window as unknown as { __game: { ready: boolean } }).__game.ready = true; }
