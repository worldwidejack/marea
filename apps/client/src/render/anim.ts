// Animazioni glTF con crossfade (WP2). Contratto: play(name, fadeS?), update(dt), current.
// Aggiunte: velocità della clip (setSpeed), loop/once con callback, fase sincronizzata walk↔run, ricerca tollerante dei nomi
// ("Armature|Walk" → "walk"), alias (run → walk più veloce se il modello non ha la corsa).
import * as THREE from 'three';

export type PlayOpts = { once?: boolean; onDone?: () => void; restart?: boolean };
export type Animator = {
  /** Passa alla clip `name` con crossfade di `fadeS` s (default 0,15). Ritorna false se la clip non esiste (nessun effetto). */
  play(name: string, fadeS?: number, opts?: PlayOpts): boolean;
  update(dt: number): void;
  /** Nome richiesto dell'ultima clip avviata. */
  current: string;
  has(name: string): boolean;
  /** Moltiplicatore di velocità della clip corrente (es. velocità avatar / velocità nominale). */
  setSpeed(k: number): void;
  readonly speed: number;
};

const ALIAS: Record<string, { to: string; scale: number }> = { run: { to: 'walk', scale: 1.6 }, walk: { to: 'idle', scale: 1 }, sit: { to: 'idle', scale: 1 }, row: { to: 'sit', scale: 1 } };
const norm = (n: string): string => (n.split(/[|:/]/).pop() ?? n).toLowerCase().replace(/[^a-z0-9]/g, '');

export function createAnimator(root: THREE.Object3D, clips: THREE.AnimationClip[]): Animator {
  const mixer = new THREE.AnimationMixer(root);
  const byKey = new Map<string, THREE.AnimationAction>();
  for (const c of clips) { const k = norm(c.name); if (!byKey.has(k)) byKey.set(k, mixer.clipAction(c)); }
  /** clip esatta, poi nome che inizia così ("walking"); con `alias` cade su un ripiego (run → walk più veloce). */
  const find = (name: string, alias: boolean, scale = 1): { action: THREE.AnimationAction; scale: number } | null => {
    const k = norm(name);
    const hit = byKey.get(k) ?? [...byKey.entries()].find(([kk]) => kk.startsWith(k))?.[1];
    if (hit) return { action: hit, scale };
    const al = alias ? ALIAS[k] : undefined;
    return al ? find(al.to, true, scale * al.scale) : null;
  };
  let cur: THREE.AnimationAction | null = null, curOnce = false, base = 1, k = 1, onDone: (() => void) | undefined;
  mixer.addEventListener('finished', (e) => { if ((e as unknown as { action: THREE.AnimationAction }).action === cur && onDone) { const f = onDone; onDone = undefined; f(); } });
  const applyScale = () => { if (cur) cur.setEffectiveTimeScale(base * k); };
  const api: Animator = {
    current: '',
    get speed() { return k; },
    has: (name) => !!find(name, false),
    setSpeed(v) { k = Math.max(0, v); applyScale(); },
    play(name, fadeS = 0.15, opts = {}) {
      const r = find(name, true); if (!r) return false;
      api.current = name;
      if (r.action === cur && !opts.restart) { base = r.scale; applyScale(); return true; }
      const next = r.action, prev = cur;
      next.reset();
      next.setLoop(opts.once ? THREE.LoopOnce : THREE.LoopRepeat, opts.once ? 1 : Infinity); next.clampWhenFinished = !!opts.once;
      // stessa fase del ciclo passando tra clip periodiche (walk ↔ run senza scatti dei piedi)
      if (prev && !opts.once && !curOnce && prev.getClip().duration > 0) next.time = ((prev.time % prev.getClip().duration) / prev.getClip().duration) * next.getClip().duration;
      next.setEffectiveWeight(1).play();
      if (prev && prev !== next) next.crossFadeFrom(prev, fadeS, false); else next.fadeIn(fadeS);
      cur = next; curOnce = !!opts.once; base = r.scale; onDone = opts.onDone; applyScale();
      return true;
    },
    update: (dt) => mixer.update(dt),
  };
  return api;
}
