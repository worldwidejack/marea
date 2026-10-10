// M2 · armature e armi a vista (#190), in Node puro (nessun browser): ogni armatura e veste del catalogo si veste (una SkinnedMesh sola, pesata sulle ossa,
// in colori di palette), l'arma sta sulla schiena solo fuori dal dungeon, la faretra compare con arco e frecce, e togliere tutto toglie tutto.
// Il modello vero (chr_base) non serve: un rig sintetico con gli stessi nomi di osso e le stesse posizioni a riposo.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { pathToFileURL } from 'node:url';
export const timeout = 60000;

const OSSA = { Hips: [0, 0.86, 0], Spine: [0, 0.98, 0], Head: [0, 1.29, 0], 'UpperArm.L': [-0.2, 1.24, 0], 'UpperArm.R': [0.2, 1.24, 0], 'LowerArm.L': [-0.215, 0.965, 0], 'LowerArm.R': [0.215, 0.965, 0],
  'UpperLeg.L': [-0.09, 0.85, 0], 'UpperLeg.R': [0.09, 0.85, 0], 'LowerLeg.L': [-0.09, 0.46, 0], 'LowerLeg.R': [0.09, 0.46, 0] };

export default async function (ctx) {
  globalThis.location = { search: '?test=1' }; try { globalThis.localStorage ??= { getItem: () => null, setItem() {} }; } catch { /* ok */ }
  const src = (p) => import(pathToFileURL(path.join(ctx.ROOT, p)).href);
  const { creaVestito } = await src('apps/client/src/rpg/vestito.ts');
  const { ITEMS } = await src('packages/sim/src/rpg/items.ts');
  const { indossaValida, indossaDa, stessoIndossa } = await src('packages/sim/src/rpg/indossa.ts');

  /** Rig sintetico: ossa piatte nella radice (nomi sanitizzati come fa three col glTF), a riposo nelle posizioni di chr_base. */
  const rig = () => {
    const root = new THREE.Group(), rest = new Map();
    for (const [n, p] of Object.entries(OSSA)) { const b = new THREE.Bone(); b.name = THREE.PropertyBinding.sanitizeNodeName(n); b.position.set(...p); root.add(b); }
    root.updateMatrixWorld(true);
    root.traverse((b) => { if (b.isBone) rest.set(b.name, b.matrixWorld.clone()); });
    const loader = { manifest: { models: {} }, has: () => false, load: async () => { throw new Error('nessun modello'); }, texture: async () => new THREE.Texture(), extend: async () => {} };
    return { root, vestito: creaVestito({ loader, root, rest }) };
  };
  const palette = new Set([...fs.readFileSync(path.join(ctx.ROOT, 'docs/ART_BIBLE.md'), 'utf8').matchAll(/`(#[0-9A-F]{6})`/g)].map((m) => m[1]));

  await ctx.test('ogni armatura e veste del catalogo si veste: una mesh pesata sulle ossa, pochi triangoli', async () => {
    const { root, vestito } = rig();
    const corpi = ITEMS.filter((i) => i.kind === 'armatura' || i.kind === 'veste');
    ctx.assert(corpi.length >= 14, 'armature e vesti nel catalogo: ' + corpi.length);
    for (const it of corpi) {
      await vestito.set({ corpo: it.id }, true);
      const sk = root.getObjectByName('indossa');
      ctx.assert(sk && sk.isSkinnedMesh, `${it.id}: manca la mesh`);
      const tri = vestito.stato().tri;
      ctx.assert(tri >= 60 && tri <= 800, `${it.id}: ${tri} triangoli (attesi 60-800)`);
      ctx.assert(sk.skeleton.bones.length === 10, `${it.id}: ossa ${sk.skeleton.bones.length}`);
      const w = sk.geometry.getAttribute('skinWeight'), si = sk.geometry.getAttribute('skinIndex');
      for (let i = 0; i < w.count; i++) ctx.assert(w.getX(i) === 1 && si.getX(i) < 10, `${it.id}: peso/osso del vertice ${i}`);
      ctx.assert(sk.geometry.getAttribute('color'), `${it.id}: niente colori di vertice`);
    }
  });

  await ctx.test('i colori dell’equipaggiamento sono tutti della palette (ART_BIBLE §2)', async () => {
    const txt = fs.readFileSync(path.join(ctx.ROOT, 'apps/client/src/rpg/vestito.ts'), 'utf8');
    const fuori = [...new Set([...txt.matchAll(/'(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1].toUpperCase()))].filter((c) => !palette.has(c));
    ctx.assert(fuori.length === 0, 'colori fuori palette: ' + fuori.join(' '));
  });

  await ctx.test('togliere l’armatura toglie la mesh; senza modello l’arma non si appende e non si rompe niente', async () => {
    const { root, vestito } = rig();
    await vestito.set({ corpo: 'armatura_ferro', arma: 'katana_ferro' }, true);
    ctx.assert(root.getObjectByName('indossa'), 'armatura vestita');
    ctx.assert(vestito.stato().corpo === 'armatura_ferro', 'stato corpo');
    await vestito.set(undefined, true);
    ctx.assert(!root.getObjectByName('indossa'), 'mesh ancora lì');
    ctx.assert(vestito.stato().corpo === null && vestito.stato().tri === 0 && vestito.materiali().length === 1, 'stato non azzerato');
    await vestito.set({ corpo: 'id_che_non_esiste' }, true); // id sconosciuto (da rete): ignorato
    ctx.assert(!root.getObjectByName('indossa'), 'un id sconosciuto ha vestito qualcosa');
  });

  await ctx.test('faretra: solo con arco + frecce, anche con l’arma in mano (dungeon)', async () => {
    const { root, vestito } = rig();
    await vestito.set({ corpo: 'armatura_legno', arma: 'arco_ferro', frecce: 'frecce_ferro' }, false);
    ctx.assert(vestito.stato().faretra, 'faretra con arco e frecce, arma in mano');
    const triConFaretra = vestito.stato().tri;
    await vestito.set({ corpo: 'armatura_legno', arma: 'katana_ferro', frecce: 'frecce_ferro' }, false);
    ctx.assert(!vestito.stato().faretra && vestito.stato().tri < triConFaretra, 'niente faretra con la katana');
    await vestito.set({ arma: 'arco_ferro', frecce: 'frecce_ferro' }, false);
    ctx.assert(vestito.stato().faretra && root.getObjectByName('indossa'), 'faretra anche senza armatura');
    ctx.assert(vestito.stato().arma === null, 'nel dungeon l’arma non è sulla schiena');
  });

  await ctx.test('arma sulla schiena fuori dal dungeon: finisce nella stessa mesh (zero draw call in più) e se ne va quando la impugni', async () => {
    const { root, vestito } = rig();
    await vestito.set({ corpo: 'armatura_ferro' }, true);
    const senza = vestito.stato().tri;
    for (const arma of ['katana_ferro', 'spadone_argento', 'lancia_bronzo', 'martello_ferro', 'ascia_oro', 'nunchaku_vetro', 'arco_legno', 'unico_fendiflutti']) {
      await vestito.set({ corpo: 'armatura_ferro', arma }, true);
      ctx.assert(vestito.stato().arma === arma && vestito.stato().tri > senza, `${arma}: non appesa (tri ${vestito.stato().tri} contro ${senza})`);
      ctx.assert(root.children.filter((c) => c.isMesh).length === 1 && vestito.materiali().length === 1, `${arma}: più di una mesh`);
      const g = root.getObjectByName('indossa').geometry, pos = g.getAttribute('position'), min = new THREE.Vector3(), v = new THREE.Vector3();
      let alto = -Infinity, basso = Infinity;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); alto = Math.max(alto, v.y); basso = Math.min(basso, v.y); }
      ctx.assert(basso > 0.1 && alto < 2.6, `${arma}: fuori misura (y da ${basso.toFixed(2)} a ${alto.toFixed(2)})`);
      void min;
    }
    await vestito.set({ corpo: 'armatura_ferro', arma: 'katana_ferro' }, false);
    ctx.assert(vestito.stato().arma === null && vestito.stato().tri === senza, 'impugnata: dovrebbe sparire dalla schiena');
  });

  await ctx.test('indossaValida: solo id del catalogo nello slot giusto (viene dalla rete)', () => {
    ctx.assert(JSON.stringify(indossaValida({ corpo: 'armatura_ferro', arma: 'arco_legno', frecce: 'frecce_legno' })) === '{"corpo":"armatura_ferro","arma":"arco_legno","frecce":"frecce_legno"}', 'forma completa');
    ctx.assert(indossaValida({ corpo: 'katana_ferro' }) === undefined, 'una katana non è un’armatura');
    ctx.assert(indossaValida({ arma: 'armatura_ferro' }) === undefined, 'un’armatura non è un’arma');
    ctx.assert(indossaValida({ corpo: 'x'.repeat(100) }) === undefined && indossaValida(null) === undefined && indossaValida('boh') === undefined && indossaValida({}) === undefined, 'valori strani');
    ctx.assert(indossaValida({ corpo: 'veste_apprendista' })?.corpo === 'veste_apprendista', 'le vesti vanno nel corpo');
    ctx.assert(indossaDa({ corpo: 'armatura_legno', arma: 'katana_legno', anello1: 'anello_vita', pozione: 'pozione_vita' })?.anello1 === undefined, 'solo corpo, arma, frecce');
    ctx.assert(stessoIndossa(indossaDa({ corpo: 'armatura_legno' }), { corpo: 'armatura_legno' }) && !stessoIndossa(indossaDa({ corpo: 'armatura_legno' }), undefined), 'stessoIndossa');
  });
}
