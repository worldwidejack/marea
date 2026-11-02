// Pose nello spazio del modello, ricondotte agli assi reali del rig. Nessuna mesh/draw call aggiunta.
// Anticipazione, appoggio, contro-rotazione, ritardi e assestamento: i 12 principi sul protagonista.
import * as THREE from 'three';

type Pose = { angles: Record<string, [number, number, number]>; hips: [number, number, number] };
const tau = Math.PI * 2;
const smooth = (a: number, b: number, t: number) => { const p = Math.max(0, Math.min(1, (t - a) / (b - a))); return p * p * (3 - 2 * p); };
const pulse = (a: number, b: number, c: number, d: number, t: number) => smooth(a, b, t) * (1 - smooth(c, d, t));

function idle(t: number): Pose {
  const breath = Math.sin(t * tau / 3), shift = Math.sin(t * tau / 12);
  const look = 0.32 * pulse(3.3, 4.1, 4.8, 5.7, t) - 0.24 * pulse(8, 8.9, 9.4, 10.4, t);
  return { hips: [0.014 * shift, 0.004 * breath, 0], angles: {
    Hips: [0, 0.018 * shift, 0.018 * shift], Spine: [-0.016 * breath, -0.03 * shift, -0.024 * shift],
    Head: [0.025 * Math.sin(t * tau / 3 - 0.4), look, 0.018 * shift],
    'UpperArm.L': [0.025 * breath, 0, -0.045], 'UpperArm.R': [-0.015 * breath, 0, 0.065],
    'LowerArm.L': [0.1 + 0.02 * breath, 0, 0], 'LowerArm.R': [0.16 - 0.02 * breath, 0, 0],
    'UpperLeg.L': [0.015, 0, -0.018 * shift], 'UpperLeg.R': [-0.015, 0, -0.018 * shift],
  } };
}

function gait(t: number, run: boolean): Pose {
  const phase = t * tau, s = Math.cos(phase), bounce = Math.cos(phase * 2);
  const p: Pose = { hips: [0.014 * Math.sin(phase), (run ? 0.035 : 0.016) * (1 - bounce), 0], angles: {
    Hips: [run ? -0.1 : -0.025, 0.065 * s, 0.035 * Math.sin(phase)],
    Spine: [run ? -0.09 : -0.025, -0.13 * s, -0.03 * Math.sin(phase)],
    Head: [run ? 0.11 : 0.025, 0.04 * s, 0.018 * Math.sin(phase - 0.4)],
  } };
  for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
    const swing = s * sign, lift = Math.max(0, Math.sin(phase) * sign);
    p.angles['UpperLeg.' + side] = [(run ? 0.85 : 0.58) * swing, 0, sign * -0.018];
    p.angles['LowerLeg.' + side] = [-(0.06 + (run ? 1.2 : 0.65) * lift), 0, 0];
    p.angles['Foot.' + side] = [0.06 + 0.22 * lift - 0.12 * swing, 0, 0];
    p.angles['UpperArm.' + side] = [-(run ? 0.62 : 0.36) * Math.cos(phase - 0.15) * sign, 0, sign * -0.045];
    p.angles['LowerArm.' + side] = [(run ? 0.85 : 0.16) + 0.12 * Math.sin(phase - 0.35) * sign, 0, 0];
  }
  return p;
}

function roll(t: number): Pose {
  const tuck = pulse(0, 0.15, 0.7, 1, t), spin = smooth(0.12, 0.8, t);
  return { hips: [0, -0.1 * tuck + 0.04 * Math.sin(Math.PI * spin), 0], angles: {
    Hips: [-tau * spin, 0, 0], Spine: [-0.65 * tuck, 0.1 * tuck, 0], Head: [-0.35 * tuck, 0, 0],
    'UpperLeg.L': [1.45 * tuck, 0, -0.12 * tuck], 'UpperLeg.R': [1.2 * tuck, 0, 0.12 * tuck],
    'LowerLeg.L': [-1.9 * tuck, 0, 0], 'LowerLeg.R': [-1.75 * tuck, 0, 0],
    'UpperArm.L': [1.1 * tuck, 0, 0.15 * tuck], 'UpperArm.R': [1.0 * tuck, 0, -0.15 * tuck],
    'LowerArm.L': [1.35 * tuck, 0, 0], 'LowerArm.R': [1.4 * tuck, 0, 0],
  } };
}

export function heroClips(root: THREE.Object3D, original: THREE.AnimationClip[]): THREE.AnimationClip[] {
  if (!root.getObjectByName('Hips')) return original;
  root.updateMatrixWorld(true);
  const names = ['Hips', 'Spine', 'Head', ...['UpperArm', 'LowerArm', 'UpperLeg', 'LowerLeg', 'Foot'].flatMap((n) => [n + '.L', n + '.R'])];
  const bones = names.flatMap((name) => {
    const b = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
    if (!b?.parent) return [];
    const parent = b.parent.getWorldQuaternion(new THREE.Quaternion());
    const basis = parent.clone().invert().multiply(root.getWorldQuaternion(new THREE.Quaternion()));
    return [{ name, b, rest: b.quaternion.clone(), pos: b.position.clone(), basis, inv: basis.clone().invert(), parentScale: b.parent.getWorldScale(new THREE.Vector3()) }];
  });
  const specs: [string, number, (t: number) => Pose][] = [['idle', 12, idle], ['walk', 0.72, (t) => gait(t / 0.72, false)], ['run', 0.52, (t) => gait(t / 0.52, true)], ['roll', 0.6, (t) => roll(t / 0.6)]];
  const clips = specs.map(([name, duration, sample]) => {
    const n = Math.ceil(duration * 40), times = Array.from({ length: n + 1 }, (_, i) => i * duration / n);
    const poses = times.map(sample), tracks: THREE.KeyframeTrack[] = [];
    for (const b of bones) {
      const rotations: number[] = [], positions: number[] = [];
      for (const p of poses) {
        const a = p.angles[b.name] ?? [0, 0, 0];
        const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(...a, 'YXZ'));
        rotations.push(...b.basis.clone().multiply(delta).multiply(b.inv).multiply(b.rest).toArray());
        if (b.name === 'Hips') positions.push(...new THREE.Vector3(...p.hips).applyQuaternion(b.basis).divide(b.parentScale).add(b.pos).toArray());
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(b.b.name + '.quaternion', times, rotations));
      if (positions.length) tracks.push(new THREE.VectorKeyframeTrack(b.b.name + '.position', times, positions));
    }
    return new THREE.AnimationClip(name, duration, tracks);
  });
  return [...original.filter((c) => !specs.some(([n]) => c.name.toLowerCase() === n)), ...clips];
}
