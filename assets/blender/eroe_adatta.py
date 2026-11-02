# MAREA — porta vestiti e cappelli del Mercante dal manichino (models_chr_ai, su cui abiti_kit li cuce) al protagonista (models_chr_eroe).
# Ogni osso ha la sua trasformazione «vecchio → nuovo»: stessa posizione lungo l'osso (accorciato o allungato come quello nuovo) e stessa
# distanza dall'osso, ingrandita di SPESSORE (il protagonista ha braccia e gambe più grosse); la testa invece si sposta e si ingrandisce tutta
# insieme come i cappelli di chr_base (CAP_*). Un vertice si muove con la media pesata delle trasformazioni delle sue ossa, poi si spinge
# fuori dalla pelle nuova dove ci finirebbe dentro (calotta dei capelli compresa). Alla fine il pezzo passa sullo scheletro del protagonista.
# Le stesse trasformazioni le fa il client per le armature in scatole (apps/client/src/rpg/adatta.ts, con SPESSORE più grossi: lì niente
# spinta fuori dalla pelle): i due file vanno tenuti insieme.
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
import gente_kit, models_chr_eroe as eroe
from lib import to_blender

SPESSORE = {'Hips': 1.0, 'Spine': 1.0, 'UpperArm': 1.5, 'LowerArm': 1.25, 'UpperLeg': 1.35, 'LowerLeg': 1.3, 'Foot': 1.15}
STOFFA = 0.022  # quanto resta fuori dalla pelle un vertice spinto fuori (le facce larghe del corpo non devono bucare la stoffa)
# testa: quote del manichino → quote del protagonista sotto il centro dei cappelli (collo, mento); sopra vale CAP_* di chr_base
QUOTE_TESTA = ((1.2, 0.93), (1.3, 0.975), (1.38, 1.0), (1.44, 1.04), (1.47, 1.27))


def _gioco(v):
    return Vector((v[0], v[2], -v[1]))


def _telaio(h, t):
    """Telaio di un osso (coordinate di gioco): Y lungo l'osso, X il più vicino possibile a +x del mondo, origine in testa all'osso."""
    h, t = Vector(h), Vector(t)
    y = (t - h).normalized()
    ref = Vector((1, 0, 0)) if abs(y.x) < 0.9 else Vector((0, 0, 1))
    x = (ref - y * ref.dot(y)).normalized()
    z = x.cross(y)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = h
    return m


def matrici(vecchie, nuove):
    """{osso: Matrix 4×4} in coordinate di gioco, dal corpo del manichino a quello del protagonista."""
    out = {}
    for b, (h1, t1) in nuove.items():
        if b == 'Head':
            out[b] = _testa
            continue
        h0, t0 = vecchie[b]
        k = SPESSORE[b.split('.')[0]]
        lung = (Vector(t1) - Vector(h1)).length / max(1e-6, (Vector(t0) - Vector(h0)).length)
        m = _telaio(h1, t1) @ Matrix.Diagonal((k, lung, k, 1.0)) @ _telaio(h0, t0).inverted()
        out[b] = lambda p, m=m: m @ p
    return out


def _testa(p):
    """La testa del manichino su quella del protagonista: sopra il centro dei cappelli si sposta e si ingrandisce come i cappelli di chr_base;
    sotto, collo e mento si schiacciano (il protagonista ha la testa sulle spalle) e l'ingrandimento sfuma verso quello del busto."""
    if p.y >= eroe.CAP_DA.y:
        return eroe.CAP_A + (p - eroe.CAP_DA) * eroe.CAP_K
    Q = QUOTE_TESTA
    if p.y <= Q[0][0]:
        y = Q[0][1] + (p.y - Q[0][0]) * 0.6
    else:
        i = next(i for i in range(len(Q) - 1) if p.y <= Q[i + 1][0])
        (a0, b0), (a1, b1) = Q[i], Q[i + 1]
        y = b0 + (b1 - b0) * (p.y - a0) / (a1 - a0)
    t = max(0.0, min(1.0, (p.y - Q[1][0]) / (eroe.CAP_DA.y - Q[1][0])))
    k = 1.0 + (eroe.CAP_K - 1.0) * t
    return Vector((eroe.CAP_A.x * t + p.x * k, y, eroe.CAP_A.z * t + p.z * k))


def _pelle_nuova(body):
    """BVH della pelle del protagonista a riposo senza ciocche (i cappelli ci stanno sopra) e senza tunica (sotto un vestito non c'è)."""
    me = body.data
    V = [_gioco(v.co) for v in me.vertices]
    capelli = next(i for i, m in enumerate(me.materials) if m.name.startswith('mat_capelli'))
    F = [tuple(p.vertices) for p in me.polygons if p.material_index != capelli]
    return BVHTree.FromPolygons(V, F)


def adatta(pezzi, rig_vecchio):
    """Sposta i vertici dei pezzi sul protagonista e li lega al suo scheletro. Ritorna il rig nuovo (chr_base_rig)."""
    ossa = {b: (h, t) for b, (h, t, _p) in eroe.OSSA.items()}
    vecchie = {}
    for b in rig_vecchio.data.bones:
        vecchie[b.name] = (_gioco(b.head_local), _gioco(b.tail_local))
    M = matrici(vecchie, ossa)
    body, tunica, ciuffi = eroe.corpo()
    bvh = _pelle_nuova(body)
    cc, cr = Vector(eroe.CALOTTA[0]), eroe.CALOTTA[1]
    for ob in pezzi:
        if ob.type != 'MESH':
            continue
        nomi = {g.index: g.name for g in ob.vertex_groups}
        for v in ob.data.vertices:
            p = _gioco(v.co)
            ws = [(nomi[g.group], g.weight) for g in v.groups if g.weight > 1e-4 and nomi[g.group] in M]
            s = sum(w for _b, w in ws) or 1.0
            q = sum((M[b](p) * (w / s) for b, w in ws), Vector()) if ws else p
            loc, nor, _i, _d = bvh.find_nearest(q)
            if loc is not None and (q - loc).dot(nor) < STOFFA:
                q = loc + nor * STOFFA
            if any(b == 'Head' for b, _w in ws) and (q - cc).length < cr + STOFFA * 0.5:
                q = cc + (q - cc).normalized() * (cr + STOFFA * 0.5)
            v.co = to_blender(tuple(q))
    for o in (body, tunica, ciuffi):
        bpy.data.objects.remove(o, do_unlink=True)
    rig_vecchio.name = 'manichino_rig'
    rig = gente_kit.build_rig('chr_base', eroe.OSSA, [])
    for ob in pezzi:
        if ob.type != 'MESH':
            continue
        ob.parent = rig
        for m in ob.modifiers:
            if m.type == 'ARMATURE':
                m.object = rig
    return rig
