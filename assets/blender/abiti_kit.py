# MAREA — kit dei vestiti e dei cappelli del Mercante (`abt_<id>`, `cap_<id>`, avatar.json `abiti` / `cappelli`).
# Un pezzo si indossa SOPRA il chr_base: è una SkinnedMesh sullo stesso scheletro (stesse ossa, stessa posa a riposo, braccia giù), che il
# client lega alle ossa dell'avatar (game/abiti.ts). Il corpo sotto non si cambia: il client nasconde i triangoli del corpo coperti dal pezzo.
# Come si cuce un vestito:
#   - `Corpo` importa il chr_base vero (models_chr_ai: modello AI, ossa, braccia giù) e ne tiene le zone (busto, braccia, gambe, testa);
#   - gli anelli «su misura» (`anello`) nascono lanciando raggi orizzontali dal centro della zona contro la sua pelle, più uno scarto
#     (stoffa aderente ~1,5 cm, felpa larga di più, cerata a campana): così maglie, pantaloni e maniche seguono la forma del corpo;
#   - i pesi delle ossa vengono dalla pelle più vicina della stessa zona (il vestito si piega come il corpo sotto: niente pelle che buca);
#   - sopra si cuciono i dettagli con le primitive di gente_kit.Fig (tubi, torniti, ellissoidi, scatole), colori nei vertici.
# Materiali: `mat_abito` (colori nei vertici), `mat_luce` (strisce neon e lucine: il client li disegna senza ombre, accesi), `mat_vetro`
# (rete dell'apicoltore, bolla del cosmonauta: semitrasparente, non nasconde il corpo).
# Coordinate «di gioco» come gente_kit: x destra, y su, −Z davanti; angoli `a` in gradi: 0 davanti, 90 a destra (+x), 180 dietro.
import math
import bpy
from mathutils import Vector, kdtree
from mathutils.bvhtree import BVHTree
import models_chr_ai
from gente_kit import Fig, lin
from lib import to_blender

ZONE = {
    'busto': ('Hips', 'Spine'), 'testa': ('Head',),
    'braccio.L': ('UpperArm.L', 'LowerArm.L'), 'braccio.R': ('UpperArm.R', 'LowerArm.R'),
    'gamba.L': ('UpperLeg.L', 'LowerLeg.L', 'Foot.L'), 'gamba.R': ('UpperLeg.R', 'LowerLeg.R', 'Foot.R'),
}
GIU = (0.0, -1.0, 0.0)


def gioco(v):
    return (v[0], v[2], -v[1])


def dir_a(a):
    r = math.radians(a)
    return (math.sin(r), 0.0, -math.cos(r))


class Corpo:
    """Il chr_base a riposo: pelle per zone (BVH in coordinate di gioco), centri delle sezioni, pesi delle ossa per vertice."""

    def __init__(self):
        self.ob, _ = models_chr_ai._corpo()
        self.rig = models_chr_ai._rig([self.ob])
        bpy.context.view_layer.update()
        me = self.ob.data
        names = {g.index: g.name for g in self.ob.vertex_groups}
        self.V = [gioco(v.co) for v in me.vertices]
        self.W = []
        zona_v = []
        for v in me.vertices:
            w = {names[g.group]: g.weight for g in v.groups if g.weight > 0.001}
            self.W.append(w)
            top = max(w.items(), key=lambda kv: kv[1])[0] if w else 'Spine'
            zona_v.append(next(z for z, bs in ZONE.items() if top in bs))
        self.zona_v = zona_v
        self.F = {z: [] for z in ZONE}
        for p in me.polygons:
            zs = [zona_v[i] for i in p.vertices]
            z = max(set(zs), key=zs.count)
            self.F[z].append(tuple(p.vertices))
        self.bvh = {z: BVHTree.FromPolygons(self.V, fs) for z, fs in self.F.items()}
        for zz in (('busto', 'testa'), ('busto', 'gamba.L', 'gamba.R'), ('busto', 'braccio.L', 'braccio.R')):
            self.F[zz] = [f for z in zz for f in self.F[z]]
            self.bvh[zz] = BVHTree.FromPolygons(self.V, self.F[zz])
        self.kd = {}
        for z in ZONE:
            idx = [i for i, zz in enumerate(zona_v) if zz == z]
            t = kdtree.KDTree(len(idx))
            for i in idx:
                t.insert(self.V[i], i)
            t.balance()
            self.kd[z] = t
        self._centri = {}

    # ---------------------------------------------------------------- misure
    def centro(self, zona, y):
        """Centro (x, z) della sezione orizzontale della zona a quota y (bordi dei triangoli che tagliano il piano)."""
        k = (zona, round(y, 3))
        if k in self._centri:
            return self._centri[k]
        xs, zs = [], []
        for f in self.F[zona]:
            for a, b in zip(f, f[1:] + f[:1]):
                pa, pb = self.V[a], self.V[b]
                if (pa[1] - y) * (pb[1] - y) < 0:
                    t = (y - pa[1]) / (pb[1] - pa[1])
                    xs.append(pa[0] + (pb[0] - pa[0]) * t); zs.append(pa[2] + (pb[2] - pa[2]) * t)
        c = ((min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2) if xs else None
        self._centri[k] = c
        return c

    def sezione(self, zona, y):
        """(xmin, xmax, zmin, zmax) della sezione orizzontale della zona a quota y (None se non la taglia)."""
        xs, zs = [], []
        for f in self.F[zona]:
            for a, b in zip(f, f[1:] + f[:1]):
                pa, pb = self.V[a], self.V[b]
                if (pa[1] - y) * (pb[1] - y) < 0:
                    t = (y - pa[1]) / (pb[1] - pa[1])
                    xs.append(pa[0] + (pb[0] - pa[0]) * t); zs.append(pa[2] + (pb[2] - pa[2]) * t)
        return (min(xs), max(xs), min(zs), max(zs)) if xs else None

    def raggio(self, zona, y, a, c=None):
        """Distanza dal centro alla pelle della zona, a quota y, verso l'angolo a (None se il raggio non trova pelle)."""
        # dal di fuori verso il centro: la prima pelle che si incontra è quella esterna (fra le cosce, sotto le ascelle il raggio dal centro
        # partirebbe già dentro una piega e darebbe un anello minuscolo)
        c = c or self.centro(zona, y)
        if c is None:
            return None
        d = Vector(dir_a(a))
        o = Vector((c[0], y, c[1])) + d * 0.6
        hit = self.bvh[zona].ray_cast(o, -d, 0.6)
        return 0.6 - hit[3] if hit[0] is not None else None

    def anello(self, zona, y, n=12, off=0.015, c=None, a0=0.0, sx=1.0, sz=1.0, rmin=0.02):
        """Anello su misura: n punti sulla pelle della zona a quota y, spinti in fuori di `off` (numero o funzione dell'angolo).
        sx/sz allargano (o stringono) l'anello attorno al centro. Dove il raggio non trova pelle usa la media dei vicini."""
        c = c or self.centro(zona, y)
        rs = []
        for k in range(n):
            a = a0 + 360.0 * k / n
            rs.append(self.raggio(zona, y, a, c))
        ok = [r for r in rs if r is not None]
        media = sum(ok) / len(ok) if ok else 0.05
        for k in range(n):
            if rs[k] is None:
                vic = [rs[(k + d) % n] for d in (-1, 1, -2, 2) if rs[(k + d) % n] is not None]
                rs[k] = sum(vic) / len(vic) if vic else media
        out = []
        for k in range(n):
            a = a0 + 360.0 * k / n
            o = off(a) if callable(off) else off
            r = max(rmin, rs[k] + o)
            d = dir_a(a)
            out.append((c[0] + d[0] * r * sx, y, c[1] + d[2] * r * sz))
        return out

    def punto(self, zona, y, a, off=0.0, c=None):
        """Punto sulla pelle della zona (quota y, angolo a) spinto in fuori di off: per cucire bottoni, tasche, toppe."""
        c = c or self.centro(zona, y)
        r = self.raggio(zona, y, a, c) or 0.05
        d = dir_a(a)
        return (c[0] + d[0] * (r + off), y, c[1] + d[2] * (r + off))

    # ---------------------------------------------------------------- pesi
    def pesi(self, zone, k=4):
        """Funzione peso per Fig: la media pesata dei pesi dei k vertici di pelle più vicini, cercati solo nelle zone date."""
        zone = (zone,) if isinstance(zone, str) else tuple(x for z in zone for x in ((z,) if isinstance(z, str) else z))

        def w(p):
            cand = []
            for z in zone:
                cand += self.kd[z].find_n(p, k)
            cand.sort(key=lambda t: t[2])
            acc = {}
            for _co, i, d in cand[:k]:
                f = 1.0 / (d + 0.01) ** 2
                for b, v in self.W[i].items():
                    acc[b] = acc.get(b, 0.0) + v * f
            s = sum(acc.values()) or 1.0
            out = sorted(((b, v / s) for b, v in acc.items()), key=lambda kv: -kv[1])[:4]
            out = [(b, v) for b, v in out if v > 0.03]
            s = sum(v for _b, v in out) or 1.0
            return {b: v / s for b, v in out}
        return w


class Pezzo(Fig):
    """Un pezzo da indossare: Fig con i loft di anelli su misura."""

    def loft(self, rings, col, b, top=False, bottom=False, cap_pt=None):
        """Unisce anelli (stessa n, dal basso in alto o dall'alto in basso: conta l'ordine) in un tubo. top/bottom chiudono il primo/
        l'ultimo anello con un ventaglio verso il suo centro (o verso cap_pt)."""
        n = len(rings[0])
        pts = [p for r in rings for p in r]
        faces = []
        for i in range(len(rings) - 1):
            A, B = i * n, (i + 1) * n
            faces += [(A + k, A + (k + 1) % n, B + (k + 1) % n, B + k) for k in range(n)]
        extra = []
        for flag, ri, rev in ((bottom, 0, True), (top, len(rings) - 1, False)):
            if not flag:
                continue
            r = rings[ri]
            c = cap_pt if cap_pt else tuple(sum(p[j] for p in r) / n for j in range(3))
            ci = len(pts) + len(extra); extra.append(c)
            A = ri * n
            faces += [((A + (k + 1) % n, A + k, ci) if rev else (A + k, A + (k + 1) % n, ci)) for k in range(n)]
        pts += extra
        i0 = self._verts(pts, b)
        self._faces(faces, i0, col, pts)
        return self


# ---------------------------------------------------------------- colori (palette ART_BIBLE più qualche stoffa)
C = {
    'bianco': '#F4F0E6', 'panna': '#F4E3C1', 'sabbia': '#E2B97F', 'cammello': '#C98A4B', 'cuoio': '#8E5A2B', 'cuoio_scuro': '#5A3A1E',
    'nero': '#23201F', 'roccia': '#4A4340', 'grigio': '#7F7568', 'pietra': '#B9AFA3', 'perla': '#E8E1D6',
    'rosso': '#E8433F', 'corallo': '#F2795B', 'bordeaux': '#8E2A3A', 'arancio': '#F2A33A', 'giallo': '#F5D547', 'oro': '#F2C14E',
    'ottone': '#D9A441', 'bronzo': '#B07A3A', 'erba': '#8FC35B', 'erba_chiara': '#D9E872', 'erba_scura': '#4E9A46', 'bosco': '#2C6B3F',
    'salvia': '#8AAE8C', 'militare': '#5E6B3A', 'acqua_bassa': '#7FE3E0', 'acqua': '#3FB9C9', 'mare': '#2478A8', 'abisso': '#163F73',
    'navy': '#22385E', 'denim': '#3C6FB0', 'denim_chiaro': '#8FB4E0', 'celeste': '#9CC4E8', 'viola': '#A64DFF', 'viola_scuro': '#3A2A5C',
    'rosa': '#F49AB2', 'rosa_chiaro': '#FFD6E5', 'fucsia': '#E0457B', 'petrolio': '#1E4A50', 'terracotta': '#C9634A', 'mattone': '#B5532E',
    'lana': '#EDE3CF', 'argento': '#C9CDD2', 'argento_scuro': '#8C939C', 'carta': '#F7F1E6',
    'neon_rosa': '#FF3DA6', 'neon_ciano': '#3DF5FF', 'neon_verde': '#B6FF3D', 'neon_ambra': '#FFB03D', 'neon_viola': '#8A5CFF', 'neon_rosso': '#FF5C3D',
}


def righe(c1, c2, passo, asse=1, fase=0.0):
    """Colore a righe: alterna c1/c2 ogni `passo` metri lungo l'asse (0 = x: righe verticali, 1 = y: orizzontali)."""
    return lambda p: c1 if int(math.floor((p[asse] + fase) / passo)) % 2 == 0 else c2


def righe_ang(c1, c2, n, cx=0.0, cz=0.0):
    """Righe verticali attorno a un asse: n spicchi alternati (pigiama, tendone)."""
    def f(p):
        a = math.degrees(math.atan2(p[0] - cx, -(p[2] - cz))) % 360
        return c1 if int(a / (360 / n)) % 2 == 0 else c2
    return f


# ---------------------------------------------------------------- uscita
def costruisci(corpo, pezzi):
    """Fig → oggetti Blender legati allo scheletro del chr_base. pezzi = [(Pezzo, 'abito' | 'luce' | 'vetro')]. Ritorna [rig, mesh...]."""
    out = [corpo.rig]
    for f, kind in pezzi:
        if not f.F:
            continue
        ob = f.build()
        ob.data.materials[0].name = 'mat_' + kind
        if kind == 'vetro':
            m = ob.data.materials[0]
            bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            bsdf.inputs['Alpha'].default_value = 0.35
            try:
                m.surface_render_method = 'BLENDED'
            except Exception:
                pass
        if kind == 'luce':
            m = ob.data.materials[0]
            bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            vc = next(n for n in m.node_tree.nodes if n.type == 'VERTEX_COLOR')
            m.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Emission Color'])
            bsdf.inputs['Emission Strength'].default_value = 1.5
        if kind == 'nascondi':  # non si vede: dice solo al client quale pelle togliere (la gamba sotto la gamba di legno)
            ob.hide_render = True
        ob.parent = corpo.rig
        mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = corpo.rig
        out.append(ob)
    return out


def nascondi_coperti(corpo, pezzi, dist=0.12):
    """Come il client (game/abiti_copre.ts): toglie dal corpo i triangoli coperti. Un triangolo è coperto se i raggi dai suoi vertici e dal
    centro, lungo la sua normale, incontrano dal di DENTRO (faccia girata verso il corpo) un pezzo non di vetro entro `dist`. Per le anteprime."""
    import bmesh
    V, F = [], []
    for ob in pezzi:
        if ob.type != 'MESH' or ob.data.materials[0].name.startswith('mat_vetro'):
            continue
        i0 = len(V)
        V += [gioco(v.co) for v in ob.data.vertices]
        F += [tuple(i0 + i for i in p.vertices) for p in ob.data.polygons]
    if not F:
        return 0
    bvh = BVHTree.FromPolygons(V, F)
    bm = bmesh.new(); bm.from_mesh(corpo.ob.data)
    via = []
    for f in bm.faces:
        P = [Vector(gioco(v.co)) for v in f.verts]
        n = Vector(gioco(f.normal))
        cen = sum(P, Vector()) / len(P)
        ok = True
        for p in P + [cen]:
            loc, nor, _i, d = bvh.ray_cast(p + n * 0.002, n, dist)
            if loc is None or nor.dot(n) <= 0:
                ok = False
                break
        if ok:
            via.append(f)
    bmesh.ops.delete(bm, geom=via, context='FACES')
    bm.to_mesh(corpo.ob.data); bm.free()
    return len(via)


def tri(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)
