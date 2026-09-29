// WP2 · percorso "modello glTF" senza avere chr_base: scena sintetica con SkinnedMesh, materiali mat_*, clip idle/walk/run/sit.
// Prova, in Node puro: ricollegamento delle ossa dopo clone(true), look per nome materiale (senza sporcare l'originale),
// crossfade e velocità del clip, alias run→walk. Nessun browser.
import * as THREE from 'three';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
export const timeout = 60000;

function makeTemplate() {
  const root = new THREE.Group(); root.name = 'Armature';
  const hips = new THREE.Bone(); hips.name = 'hips'; const spine = new THREE.Bone(); spine.name = 'spine'; spine.position.y = 0.5; hips.add(spine);
  root.add(hips);
  const geo = new THREE.BoxGeometry(0.4, 1.6, 0.3, 1, 4, 1); geo.translate(0, 0.8, 0);
  const n = geo.getAttribute('position').count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { si[i * 4] = geo.getAttribute('position').getY(i) > 0.8 ? 1 : 0; sw[i * 4] = 1; }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const mk = (name) => new THREE.MeshStandardMaterial({ name, color: 0xffffff });
  const mesh = new THREE.SkinnedMesh(geo, [mk('mat_pelle'), mk('mat_vestito.001'), mk('mat_capelli'), mk('mat_cappello'), mk('mat_ferro'), mk('mat_extra')]);
  mesh.add(hips); mesh.bind(new THREE.Skeleton([hips, spine]));
  root.add(mesh);
  for (const nm of ['capelli_0', 'capelli_1', 'cappello_paglia', 'cappello_berretto']) { const g = new THREE.Group(); g.name = nm; root.add(g); }
  const constant = (name, y) => new THREE.AnimationClip(name, 1, [new THREE.VectorKeyframeTrack('hips.position', [0, 1], [0, y, 0, 0, y, 0])]);
  const clips = [constant('Armature|idle', 0), constant('Armature|walk', 1), constant('Armature|run', 2), constant('Armature|sit', 3),
    new THREE.AnimationClip('lin', 1, [new THREE.VectorKeyframeTrack('spine.position', [0, 1], [0, 0.5, 0, 1, 0.5, 0])])];
  return { root, clips };
}

export default async function (ctx) {
  globalThis.location = { search: '?test=1' }; try { globalThis.localStorage ??= { getItem: () => null, setItem() {} }; } catch { /* ok */ }
  const src = (p) => import(pathToFileURL(path.join(ctx.ROOT, 'apps/client/src', p)).href);
  const { createAvatar } = await src('game/avatar.ts');
  const { createAnimator } = await src('render/anim.ts');
  const { root: template, clips } = makeTemplate();
  const loader = { manifest: { models: {} }, has: (n) => n === 'chr_base', load: async () => ({ scene: template.clone(true), clips }), texture: async () => new THREE.Texture() };
  const look = { pelle: 3, capelli: 1, coloreCapelli: 4, vestito: 2, cappello: 1 };
  const av = await createAvatar({ loader, look, x: 5, z: 5 });
  const bones = (root) => { const b = []; root.traverse((n) => { if (n.isBone) b.push(n); }); return b; };
  const skinned = (root) => { let s = null; root.traverse((n) => { if (n.isSkinnedMesh) s = n; }); return s; };
  const map = { at: () => 'g', worldToCell: () => ({ cx: 0, cz: 0 }), walkable: () => true, navigable: () => true, isDock: () => false };

  await ctx.test('modello: usa chr_base e le ossa dello skin sono quelle del clone', async () => {
    ctx.assert(av.usesModel, 'usesModel false');
    const sm = skinned(av.object); const mine = new Set(bones(av.object));
    ctx.assert(sm && sm.skeleton.bones.every((b) => mine.has(b)), 'skeleton legato alle ossa dell’originale');
    ctx.assert(sm.skeleton.bones.every((b) => !bones(template).includes(b)), 'ossa condivise col template');
  });
  await ctx.test('look per nome materiale, template intatto', async () => {
    const sm = skinned(av.object); const by = (n) => sm.material.find((m) => m.name.startsWith(n));
    const hex = (m) => '#' + m.color.getHexString().toUpperCase();
    ctx.assert(hex(by('mat_pelle')) === '#B8784C', 'pelle ' + hex(by('mat_pelle')));
    ctx.assert(hex(by('mat_vestito')) === '#F2A33A', 'vestito ' + hex(by('mat_vestito')));
    ctx.assert(hex(by('mat_capelli')) === '#E8433F', 'capelli ' + hex(by('mat_capelli')));
    ctx.assert(hex(by('mat_ferro')) === '#FFFFFF', 'materiale non mat_* toccato');
    ctx.assert(skinned(template).material.every((m) => m.color.getHexString() === 'ffffff'), 'template sporcato');
    const vis = (n) => av.object.getObjectByName(n).visible;
    ctx.assert(!vis('capelli_0') && vis('capelli_1'), 'taglio capelli'); ctx.assert(vis('cappello_paglia') && !vis('cappello_berretto'), 'cappello');
    av.setLook({ ...look, pelle: 0, capelli: 0, cappello: 2 });
    ctx.assert(hex(by('mat_pelle')) === '#FBE2C8' && vis('capelli_0') && !vis('capelli_1') && vis('cappello_berretto'), 'setLook non applicato');
  });
  await ctx.test('animazione: idle → walk → run seguono lo stato e muovono le ossa del clone', async () => {
    const hips = av.object.getObjectByName('hips'), y0 = hips.position.y;
    for (let i = 0; i < 30; i++) { av.step({ mx: 0, my: 0, a: false, b: false }, map); av.update(1, 1 / 60); }
    ctx.assert(Math.abs(hips.position.y - 0) < 1e-3, 'idle y=' + hips.position.y);
    for (let i = 0; i < 90; i++) { av.step({ mx: -0.5, my: -0.5, a: false, b: false }, map); av.update(1, 1 / 60); }
    ctx.assert(av.state.anim === 'walk' && Math.abs(hips.position.y - 1) < 0.02, `walk: anim=${av.state.anim} y=${hips.position.y}`);
    for (let i = 0; i < 90; i++) { av.step({ mx: -1, my: -1, a: false, b: false }, map); av.update(1, 1 / 60); }
    ctx.assert(av.state.anim === 'run' && Math.abs(hips.position.y - 2) < 0.02, `run: anim=${av.state.anim} y=${hips.position.y}`);
    ctx.assert(bones(template).every((b) => b.position.y === 0 || b.name === 'spine'), 'ossa del template mosse');
    ctx.assert(y0 !== hips.position.y, 'nessun movimento');
  });
  await ctx.test('seduto/rema: attachTo mette l’avatar nel genitore, sit/row dai clip', async () => {
    const boat = new THREE.Group(); const scene = new THREE.Group(); scene.add(av.object);
    av.attachTo(boat, { x: 0, y: 0.36, z: 0.55 }); ctx.assert(av.object.parent === boat && av.attached, 'non attaccato');
    ctx.assert(Math.abs(av.object.position.y - (0.36 - 0.37)) < 1e-6 && av.object.position.z === 0.55, 'posizione seduta ' + av.object.position.toArray());
    for (let i = 0; i < 60; i++) av.update(1, 1 / 60);
    ctx.assert(Math.abs(av.object.getObjectByName('hips').position.y - 3) < 0.02, 'sit non attivo');
    av.attachTo(null); ctx.assert(av.object.parent === scene && !av.attached, 'non tornato nella scena');
  });
  await ctx.test('animatore: crossfade 0,15 s, velocità proporzionale, alias, once', async () => {
    const { root, clips: cl } = makeTemplate(); const a = createAnimator(root, cl); const hips = root.getObjectByName('hips'), spine = root.getObjectByName('spine');
    ctx.assert(a.play('walk') && a.has('run') && !a.has('remata'), 'has/play'); a.update(1);
    ctx.assert(Math.abs(hips.position.y - 1) < 1e-3, 'walk pieno ' + hips.position.y);
    a.play('run', 0.15); a.update(0.075); ctx.assert(hips.position.y > 1.2 && hips.position.y < 1.8, 'a metà del fade: ' + hips.position.y);
    a.update(0.2); ctx.assert(Math.abs(hips.position.y - 2) < 1e-3, 'run pieno ' + hips.position.y);
    a.play('lin', 0.001); a.update(0.01); a.setSpeed(2); const x0 = spine.position.x; a.update(0.2);
    ctx.assert(Math.abs(spine.position.x - x0 - 0.4) < 0.02, 'velocità x2: Δx=' + (spine.position.x - x0));
    ctx.assert(a.play('remata') === false, 'clip inesistente deve tornare false');
    const b = createAnimator(root, cl.filter((c) => !c.name.endsWith('run'))); ctx.assert(b.play('run') && b.current === 'run', 'alias run→walk');
    const c2 = createAnimator(root, cl); let done = false; c2.play('sit', 0.01, { once: true, onDone: () => (done = true) }); c2.update(1.5); ctx.assert(done, 'onDone di once');
  });
}
