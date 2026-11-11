# Kit dei nemici snodati (issue 723): una SkinnedMesh sola per nemico (1-2 draw call), ossa rigide (ogni faccia segue un osso solo).
# Il client (apps/client/src/rpg/nemici_rig.ts) cerca le ossa per nome e le mette in posa ogni fotogramma secondo lo stato della sim:
# niente clip nel glb. Coordinate di gioco come lib: x destra, y su, −Z davanti, piedi a y = 0; il lato _dx è x > 0 (la destra di chi
# guarda verso −Z), _sx è x < 0. Ogni osso punta in su (la coda serve solo a Blender): il client ruota negli assi del modello.
# Nomi (vedi nemici_rig.ts): bipede radice, bacino, busto, testa, braccio_*, avambraccio_*, coscia_*, stinco_*; quadrupede corpo, collo,
# testa, mascella, coda, coda2, zampa_as/ad/ps/pd con piede_*; ragno corpo, addome, zanne, zampa_1..8 con punta_1..8 (1-4 a sinistra).
import math
from contextlib import contextmanager
import bpy
from lib import Mesh, to_blender
from models_rpg import tube, blob, cone_dir, quad2, slab, xf, face

EM = 'mat_emissivo'


class Rig:
    """Mesh con le ossa: `with r.osso('braccio_dx', (x, y, z)):` quello che si costruisce dentro segue l'osso (testa nel punto dato);
    l'osso nuovo è figlio di quello attivo fuori dal blocco."""

    def __init__(self, name):
        self.name = name
        self.m = Mesh(name)
        self.bones = {'radice': ((0, 0, 0), None)}
        self.m.bone = 'radice'

    @contextmanager
    def osso(self, nome, testa=None, padre=None):
        if nome not in self.bones:
            self.bones[nome] = (testa or (0, 0, 0), padre or self.m.bone)
        prima = self.m.bone
        self.m.bone = nome
        try:
            yield self.m
        finally:
            self.m.bone = prima

    def build(self, *extra):
        ob = self.m.build()
        arm = bpy.data.armatures.new(self.name + '_rig')
        rig = bpy.data.objects.new(self.name + '_rig', arm)
        bpy.context.scene.collection.objects.link(rig)
        bpy.context.view_layer.update()
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        for nome, (h, padre) in self.bones.items():
            eb = arm.edit_bones.new(nome)
            eb.head = to_blender(h)
            eb.tail = to_blender((h[0], h[1] + 0.1, h[2]))
            eb.roll = 0.0
            if padre:
                eb.parent = arm.edit_bones[padre]
                eb.use_connect = False
        bpy.ops.object.mode_set(mode='OBJECT')
        obs = [ob] + [e.build() if isinstance(e, Mesh) else e for e in extra]
        for mo in obs:
            if not mo.vertex_groups:
                mo.vertex_groups.new(name='radice').add(list(range(len(mo.data.vertices))), 1.0, 'REPLACE')
            mo.parent = rig
            mod = mo.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
        return [rig] + obs


# ------------------------------------------------------------------ pezzi
def arto(m, a, b, ra, rb, region, n=6, cap0=None, cap1=None, **o):
    tube(m, [a, b], [ra, rb], n, region, cap0=cap0 or region, cap1=cap1 or region, **o)


def arto3(m, a, b, c, rs, region, n=6, **o):
    tube(m, [a, b, c], rs, n, region, cap0=region, cap1=region, **o)


def anelli(m, rings, side, top=None, bottom=None, **o):
    m.loft(rings, side, top=top, bottom=bottom, **o)


def R(m, rx, y, rz, cx=0.0, cz=0.0, n=8):
    return m.ring(n, rx, y, rz=rz, a0=math.pi / n, cx=cx, cz=cz)


def occhi(m, cx, y, z, dx, region='em_neon_rosso', w=0.03, h=0.02, n=(0, 0.1, -1)):
    for sx in (-1, 1):
        x = cx + sx * dx
        face(m, [(x - w, y - h, z), (x + w, y - h, z), (x + w, y + h, z), (x - w, y + h, z)], region, n, mat=EM)


# ------------------------------------------------------------------ bipede
class Corpo:
    """Misure del bipede (in m) ricavate dall'altezza H e dalla larghezza k; tutte modificabili prima di `bipede`."""

    def __init__(self, H=1.8, k=1.0, gambe=1.0):
        self.H = H
        self.anca = 0.5 * H * gambe
        self.ginocchio = 0.27 * H * gambe
        self.caviglia = 0.05 * H
        self.vita = self.anca + 0.07 * H
        self.spalla = 0.79 * H
        self.collo = 0.835 * H
        self.gomito = 0.62 * H
        self.polso = 0.47 * H
        self.sx = 0.125 * H * k          # spalla
        self.hx = 0.055 * H * k          # anca
        self.r_coscia, self.r_stinco = 0.05 * H * k, 0.035 * H * k
        self.r_braccio, self.r_avambraccio = 0.035 * H * k, 0.028 * H * k
        self.petto = (0.12 * H * k, 0.075 * H * k)
        self.fianchi = (0.085 * H * k, 0.065 * H * k)
        self.mano = 1.0
        self.spalliera = None            # callback (r, c, spalla, lato) dentro l'osso del braccio
        self.gonna = None                # callback (r, c, lato) dentro l'osso della coscia (falde che seguono la gamba)


def bipede(r, c, gamba='pantaloni', scarpa='scarpe', bacino='cintura', busto='cuoio', braccio=None, mano='pelle', avambraccio=None,
           testa=None, mano_dx=None, mano_sx=None, sul_busto=None, sul_bacino=None, piede=True, n=6):
    """Bipede in piedi, braccia lungo i fianchi un filo aperte. Callback (r, c, punto) per testa, mani (al polso) e vestiti extra:
    girano con l'osso giusto attivo."""
    m = r.m
    H = c.H
    with r.osso('bacino', (0, c.anca, 0)):
        if bacino: anelli(m, [R(m, c.fianchi[0] * 0.95, c.anca - 0.04 * H, c.fianchi[1] * 0.95), R(m, c.fianchi[0], c.anca + 0.02 * H, c.fianchi[1]),
                   R(m, c.fianchi[0] * 0.98, c.vita, c.fianchi[1] * 0.98)], bacino, bottom=gamba)
        if sul_bacino:
            sul_bacino(r, c)
        for sx, lato in ((-1, 'sx'), (1, 'dx')):
            x = sx * c.hx
            with r.osso('coscia_' + lato, (x, c.anca, 0)):
                if c.gonna:
                    c.gonna(r, c, sx)
                arto(m, (x, c.anca + 0.02 * H, 0), (x, c.ginocchio, -0.005 * H), c.r_coscia, c.r_coscia * 0.8, gamba, n=n)
                with r.osso('stinco_' + lato, (x, c.ginocchio, 0)):
                    arto(m, (x, c.ginocchio + 0.01 * H, -0.005 * H), (x, c.caviglia + 0.01 * H, 0), c.r_coscia * 0.78, c.r_stinco, gamba, n=n)
                    if piede:
                        m.box(x - 0.035 * H, 0, -0.085 * H, x + 0.035 * H, c.caviglia + 0.02 * H, 0.035 * H, scarpa, skip=('bottom',))
        with r.osso('busto', (0, c.vita, 0)):
            px, pz = c.petto
            if busto: anelli(m, [R(m, c.fianchi[0] * 0.97, c.vita - 0.01 * H, c.fianchi[1] * 0.97), R(m, px * 0.92, c.vita + 0.08 * H, pz),
                       R(m, px, c.spalla - 0.05 * H, pz * 1.05, cz=-0.005 * H), R(m, px * 0.9, c.spalla, pz * 0.9),
                       R(m, 0.04 * H, c.collo, 0.035 * H)], busto, top=mano)
            if sul_busto:
                sul_busto(r, c)
            for sx, lato in ((-1, 'sx'), (1, 'dx')):
                xs = sx * c.sx
                with r.osso('braccio_' + lato, (xs, c.spalla - 0.015 * H, 0)):
                    ge = (xs + sx * 0.012 * H, c.gomito, 0.005 * H)
                    if c.spalliera:
                        c.spalliera(r, c, (xs, c.spalla, 0), sx)
                    arto(m, (xs, c.spalla, 0), ge, c.r_braccio, c.r_braccio * 0.85, braccio or busto, n=n)
                    with r.osso('avambraccio_' + lato, ge):
                        po = (xs + sx * 0.02 * H, c.polso, -0.02 * H)
                        arto(m, ge, po, c.r_braccio * 0.85, c.r_avambraccio, avambraccio or braccio or busto, n=n)
                        hw = c.r_avambraccio * 1.2 * c.mano
                        if hw > 0:
                            m.box(po[0] - hw, po[1] - 0.06 * H * c.mano, po[2] - hw, po[0] + hw, po[1] + 0.005 * H, po[2] + hw, mano)
                        cb = mano_dx if sx > 0 else mano_sx
                        if cb:
                            cb(r, c, (po[0], po[1] - 0.03 * H, po[2]))
            with r.osso('testa', (0, c.collo, 0)):
                if testa:
                    testa(r, c, (0, c.collo, 0))


def testa_tonda(m, c, base, region, rx=None, ry=None, top=None, cz=0.0, uv=None, bbox=None):
    """Testa a 8 lati da `base` (collo) in su: 6 anelli."""
    H = c.H
    rx = rx or 0.06 * H
    ry = ry or 0.075 * H
    x, y0, z = base[0], base[1], base[2] + cz
    hs = [(0.45, -0.0), (0.85, 0.25), (1.0, 0.5), (1.0, 0.75), (0.85, 0.95), (0.5, 1.12)]
    rings = [R(m, rx * s, y0 + ry * 2 * f * 0.5 + 0.01 * H, rx * s * 1.05, cx=x, cz=z) for s, f in hs]
    o = {}
    if uv:
        o = dict(uv=uv, bbox=bbox, alt=region)
    m.loft(rings, region, top=top or region, **o)
    return (x, y0 + ry * 0.9, z)
