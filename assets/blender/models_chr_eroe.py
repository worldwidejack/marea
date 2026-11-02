# MAREA — il protagonista (Riccardo, 2 nov 2026): `chr_base` rifatto da capo sul concept assets/concept/avatar/eroe_concept.jpg
# (reference di Riccardo: eroe_reference.jpg). Ragazzo a ~4 teste, capelli castani a punte, cicatrice sulla fronte, tunica con scollo a V e
# maniche risvoltate, cintura col borsello, pantaloni scuri, stivali. Costruito con le primitive di gente_kit (colori nei vertici), niente AI 3D.
# Stesso contratto di prima (CONTRACTS §9): scheletro coi nomi di sempre, clip idle walk run sit row, materiali tinti dal client
# (mat_pelle, mat_capelli, mat_vestito: vertici grigi che il client moltiplica per il colore scelto; mat_avatar: colori veri), cappelli
# cappello_<id>. Le punte alte dei capelli stanno nel nodo `ciuffi` (mat_capelli), che il client spegne sotto un cappello; tunica e cintura
# nel nodo `tunica`, che il client spegne sotto un vestito del Mercante (sotto c'è il corpo con busto e braccia di pelle).
# Le ossa del corpo e quelle del manichino (models_chr_ai, il corpo su cui si cuciono vestiti e cappelli) escono nel manifest (`corpo`):
# armature, vestiti e cappelli fatti per il manichino si portano sul corpo nuovo osso per osso (eroe_adatta.py, client rpg/adatta.ts).
import math
import bpy
from mathutils import Matrix, Vector
import gente_kit, models_chr, models_chr_ai
from gente_kit import Fig, TORSO, NECK, ARM, LEG
import eroe_viso

# ossa a riposo (gioco: x destra, y su, −Z davanti), braccia appena aperte; totale 1,58 m capelli compresi, testa ~0,40 m = 4 teste
OSSA = gente_kit.bones_for(hip=0.60, chest=0.97, neck=0.99, top=1.48, sh=(0.165, 0.93), elbow=0.745, wrist=0.575, leg_x=0.085, knee=0.33,
                           ankle=0.08, foot=0.12, arm_out=0.06)
TESTA = (0.0, 1.18, 0.0)        # centro del cranio
CRANIO = (0.185, 0.19, 0.175)   # raggi del cranio (mento a ~1,01)
CALOTTA = ((0.0, 1.22, 0.026), 0.198)  # capelli: centro e raggio della calotta
# tinte: i grigi dei materiali tinti fanno luci e ombre (bianco = il colore scelto pieno)
G = {'luce': '#FFFFFF', 'base': '#D9D9D9', 'ombra': '#A6A6A6', 'scuro': '#808080'}
COL = {'pantaloni': '#5A3A1E', 'pant_ombra': '#4A4340', 'stivale': '#7F7568', 'risvolto': '#B9AFA3', 'suola': '#4A4340',
       'cuoio': '#8E5A2B', 'cuoio_scuro': '#5A3A1E', 'fibbia': '#B9AFA3', 'fibbia_buco': '#4A4340'}


def _ss(v, a, b):
    t = min(1.0, max(0.0, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- testa
def cranio(pelle):
    """Testa a faccette (10 lati, 7 fasce: una fascia intera per gli occhi), mascella che si stringe verso il mento."""
    def deform(p):
        x, y, z = p
        t = max(0.0, -y / CRANIO[1])                   # 0 a metà testa, 1 al mento
        x *= 1 - 0.2 * t * t * t                       # mascella larga: il mento non lascia scoperto il collo
        z *= (1 - 0.12 * t * t) if z < 0 else (1 - 0.45 * t)
        if z > 0:
            z *= 0.94                                   # nuca appena piatta
        return (x, y, z)
    i0 = len(pelle.F)
    pelle.ell(TESTA, CRANIO, G['luce'], 'Head', n=10, m=7, deform=deform, sq=2.2)
    faccia = range(i0, len(pelle.F))
    for k in (-1, 1):  # orecchie
        pelle.ell((k * 0.178, TESTA[1] - 0.008, 0.012), (0.024, 0.046, 0.034), G['base'], 'Head', n=6, m=3)
    # naso: piramide piccola (a pixel grossi è un'ombra di un pixel)
    eroe_viso.punta(pelle, (0.0, TESTA[1] - 0.048, -0.166), (0.0, -0.35, -1.0), 0.024, 0.018, G['luce'], 'Head', lati=3)
    return faccia  # facce del cranio: ci si appoggiano occhi, bocca e cicatrice


def calotta(capelli, ciuffi):
    """Calotta che lascia scoperta la fronte (attaccatura più alta davanti, giù fino alla nuca dietro) + punte grosse."""
    c, r = CALOTTA

    def attaccatura(x, z):
        """Quota dell'attaccatura attorno alla testa: fronte scoperta, sopra le orecchie, giù fino alla nuca."""
        az = abs(math.degrees(math.atan2(x, -z)))       # 0 davanti, 90 ai lati, 180 dietro
        lati = _ss(az, 35, 58)
        dietro = _ss(az, 105, 140)
        t = TESTA[1]
        return (t + 0.112) * (1 - lati) + (t + 0.048) * lati * (1 - dietro) + (t - 0.15) * dietro

    def deform(p):
        x, y, z = p
        yy = c[1] + y
        lim = attaccatura(x, z)
        if yy < lim:  # sotto l'attaccatura: il punto sale sulla sfera fino all'attaccatura
            yy = lim
            rr = math.sqrt(max(0.0, r * r - (yy - c[1]) ** 2))
            h = math.hypot(x, z) or 1.0
            x, z = x / h * rr, z / h * rr
        return (x, yy - c[1], z)
    capelli.ell(c, (r, r, r), G['ombra'], 'Head', n=12, m=7, deform=deform, cut=(-0.8, 1.0))
    eroe_viso.ciocche(capelli, ciuffi, c, r)


# ---------------------------------------------------------------- busto e braccia
PROF_TUNICA = [(0.178, 0.50), (0.168, 0.57), (0.152, 0.64), (0.146, 0.70), (0.158, 0.78), (0.168, 0.86), (0.168, 0.915), (0.14, 0.965),
               (0.075, 1.0)]
SPALLE = lambda p: (p[0] * (1 + 0.16 * _ss(p[1], 0.80, 0.93)), p[1], p[2])


def busto(pelle):
    """Sotto la tunica: busto e braccia di pelle (si vedono quando un vestito del Mercante prende il posto della tunica)."""
    prof = [(0.0, 0.56), (0.128, 0.58), (0.132, 0.66), (0.128, 0.72), (0.14, 0.82), (0.148, 0.9), (0.122, 0.955), (0.06, 0.99)]
    pelle.lathe(prof, G['base'], TORSO, n=10, sz=0.72, sq=2.3, deform=SPALLE)
    for s, k in (('L', -1), ('R', 1)):
        sh, el = OSSA[f'UpperArm.{s}'][0], OSSA[f'UpperArm.{s}'][1]
        wr = OSSA[f'LowerArm.{s}'][1]
        pelle.tube([(sh[0] - k * 0.02, sh[1] - 0.04, 0.0), el], [0.05, 0.046], G['luce'], ARM(s), n=6, caps=(None, None))
        # avambraccio e mano a manopola col pollice
        h = (wr[0] + k * 0.006, wr[1] - 0.038, wr[2] - 0.006)
        pelle.tube([el, wr], [0.045, 0.039], G['luce'], ARM(s), n=6, caps=(None, None))
        pelle.ell(h, (0.044, 0.056, 0.048), G['luce'], f'LowerArm.{s}', n=6, m=4, sq=2.4)
        pelle.ell((h[0] - k * 0.02, h[1] + 0.012, h[2] - 0.036), (0.017, 0.03, 0.017), G['base'], f'LowerArm.{s}', n=5, m=3)


def tunica(vestito):
    """La tunica (nodo `tunica`, si toglie sotto i vestiti del Mercante): scollo a V, maniche risvoltate."""
    col = lambda q: G['ombra'] if q[1] < 0.53 else G['base']   # orlo un tono più scuro
    vestito.lathe(PROF_TUNICA, col, TORSO, n=10, sz=0.72, sq=2.3, deform=SPALLE)
    eroe_viso.scollo(vestito, G)
    for s, k in (('L', -1), ('R', 1)):
        sh, el = OSSA[f'UpperArm.{s}'][0], OSSA[f'UpperArm.{s}'][1]
        a = (sh[0] - k * 0.01, sh[1] - 0.005, 0.0)
        vestito.tube([a, el], [(0.07, 0.066), (0.064, 0.06)], G['base'], ARM(s), n=6, caps=('flat', None))
        # risvolto della manica (un tono più chiaro: la stoffa rovesciata)
        e2 = (el[0] + k * 0.002, el[1] - 0.012, el[2])
        vestito.tube([(el[0], el[1] + 0.03, el[2]), e2], [0.077, 0.077], G['luce'], ARM(s), n=6, caps=('flat', 'flat'))


def cintura(av):
    r, sz = 0.146 + 0.013, (0.146 * 0.72 + 0.013) / (0.146 + 0.013)
    av.lathe([(r, 0.672), (r, 0.716)], COL['cuoio'], TORSO, n=10, sz=sz, sq=2.3)
    zf = -(0.146 * 0.72 + 0.013)
    av.box((0.0, 0.694, zf - 0.004), (0.05, 0.042, 0.012), COL['fibbia'], 'Hips')
    av.box((0.0, 0.694, zf - 0.009), (0.026, 0.02, 0.004), COL['fibbia_buco'], 'Hips')
    # borsello sul fianco sinistro (x < 0), girato verso il davanti
    av.box((-0.138, 0.662, -0.062), (0.052, 0.066, 0.044), COL['cuoio'], 'Hips', r=(0, -35, 0))
    av.box((-0.141, 0.682, -0.066), (0.058, 0.03, 0.05), COL['cuoio_scuro'], 'Hips', r=(0, -35, 0))
    av.box((-0.156, 0.676, -0.088), (0.012, 0.012, 0.008), COL['fibbia'], 'Hips', r=(0, -35, 0))


# ---------------------------------------------------------------- gambe
def gambe(av):
    for s, k in (('L', -1), ('R', 1)):
        x = k * 0.085
        av.tube([(x, 0.64, 0.0), (x, 0.47, -0.004), (x, 0.33, -0.008), (x, 0.21, 0.0)], [(0.09, 0.084), 0.08, 0.07, 0.066],
                lambda q: COL['pant_ombra'] if q[1] < 0.36 and q[1] > 0.3 else COL['pantaloni'], LEG(s), n=6, caps=('flat', None))
        b = [f'LowerLeg.{s}', f'Foot.{s}']
        av.lathe([(0.068, 0.03), (0.07, 0.09), (0.066, 0.15), (0.069, 0.205)], COL['stivale'], b, n=6, c=(x, 0.0, 0.004), sz=1.05)
        av.lathe([(0.083, 0.185), (0.087, 0.25)], COL['risvolto'], f'LowerLeg.{s}', n=6, c=(x, 0.0, 0.004), sz=1.05)
        av.ell((x, 0.052, -0.075), (0.066, 0.048, 0.1), COL['stivale'], f'Foot.{s}', n=6, m=4, sq=2.6, cut=(-0.55, 1.0))
        av.box((x, 0.014, -0.045), (0.132, 0.028, 0.235), COL['suola'], f'Foot.{s}')


# ---------------------------------------------------------------- insieme
def _unisci(obs, nome):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = nome
    return ob


def corpo():
    """Il corpo a riposo: `chr_base` (pelle, capelli, vestito, avatar), `tunica` (vestito, avatar: tunica e cintura) e `ciuffi`
    (le punte alte dei capelli). Ritorna (corpo, tunica, ciuffi)."""
    figs = {n: Fig(n, OSSA) for n in ('pelle', 'capelli', 'avatar')}
    tun = {n: Fig(n, OSSA) for n in ('vestito', 'cintura')}
    ciuffi = Fig('ciuffi', OSSA)
    faccia = cranio(figs['pelle'])
    figs['pelle'].tube([(0.0, 0.95, 0.008), (0.0, 1.04, 0.012)], [0.056, 0.056], G['base'], NECK, n=6, caps=(None, None))
    calotta(figs['capelli'], ciuffi)
    eroe_viso.viso(figs, faccia, TESTA, CRANIO)
    busto(figs['pelle'])
    gambe(figs['avatar'])
    tunica(tun['vestito'])
    cintura(tun['cintura'])
    body = _unisci([f.build() for f in figs.values()], 'chr_base')
    mats = {m.name.split('.')[0]: m for m in body.data.materials}
    tu = _unisci([f.build() for f in tun.values()], 'tunica')
    for i, m in enumerate(tu.data.materials):  # la cintura ha i colori veri: stesso materiale del corpo (mat_avatar)
        if m.name.startswith('mat_cintura'):
            tu.data.materials[i] = mats['mat_avatar']
    ci = ciuffi.build()
    ci.data.materials[0] = mats['mat_capelli']
    return body, tu, ci


def manichino():
    """Le ossa a riposo del corpo su cui si cuciono vestiti e cappelli (models_chr_ai, braccia giù): servono per portarli su questo."""
    rig = models_chr_ai._rig([])
    ossa = {b: (tuple(round(v, 4) for v in h), tuple(round(v, 4) for v in t), p) for b, (h, t, p) in models_chr.BONES.items()}
    bpy.data.objects.remove(rig, do_unlink=True)
    return ossa


# cappelli di sempre (models_chr.hat_piece, misurati sul manichino): spostati e ingranditi sulla testa nuova, sopra la calotta
CAP_DA, CAP_A, CAP_K = Vector((0.0, 1.47, 0.0)), Vector((0.0, 1.27, 0.026)), 1.22


def cappello(h):
    ob = models_chr.hat_piece(h).build()
    to_b = lambda v: Vector((v[0], -v[2], v[1]))
    m = Matrix.Translation(to_b(CAP_A)) @ Matrix.Scale(CAP_K, 4) @ Matrix.Translation(-to_b(CAP_DA))
    ob.data.transform(m)
    return ob


DEFAULT_LOOK = {'pelle': '#EFC29B', 'capelli': 0, 'coloreCapelli': '#8E5A2B', 'vestito': '#4E9A46', 'cappello': 'nessuno'}
VARIANTS = [
    {'nome': 'A', 'pelle': '#EFC29B', 'capelli': 0, 'coloreCapelli': '#8E5A2B', 'vestito': '#4E9A46', 'cappello': 'nessuno'},
    {'nome': 'B', 'pelle': '#8C5636', 'capelli': 0, 'coloreCapelli': '#2E1E14', 'vestito': '#E8433F', 'cappello': 'nessuno'},
    {'nome': 'C', 'pelle': '#FBE2C8', 'capelli': 0, 'coloreCapelli': '#F4E3C1', 'vestito': '#3FB9C9', 'cappello': 'paglia'},
]
CATALOG = [{'nome': h, 'pelle': '#D9A070', 'capelli': 0, 'coloreCapelli': '#5A3A1E', 'vestito': '#8FC35B', 'cappello': h} for h in models_chr.HATS]


def look(objs, lk):
    vis = models_chr.apply_look(objs, lk)
    for ob in objs:
        if ob.name == 'ciuffi':
            ob.hide_render = ob.hide_viewport = lk.get('cappello', 'nessuno') != 'nessuno'
    return [o for o in vis if not o.hide_render]


def chr_base():
    ossa_m = manichino()
    body, tu, ci = corpo()
    hats = [cappello(h) for h in models_chr.HATS]
    rig = gente_kit.build_rig('chr_base', OSSA, [body, tu, ci] + hats)
    durate = gente_kit.make_clips(rig, OSSA, {'passo': 30, 'braccia': 26, 'molla': 0.8, 'walk_n': 14, 'run_n': 12, 'aperte': 9})
    tri = lambda ob: sum(len(p.vertices) - 2 for p in ob.data.polygons)
    return [rig, body, tu, ci] + hats, {
        'clips': list(durate), 'durate': durate,
        'preview': {'walk': 3, 'run': 3, 'sit': 0, 'row': 10},
        'tri_pezzi': {ob.name: tri(ob) for ob in [body, tu, ci] + hats},
        'corpo': {'ossa': {b: [h, t] for b, (h, t, _p) in OSSA.items()}, 'manichino': {b: [h, t] for b, (h, t, _p) in ossa_m.items()}},
        'look_fn': look, 'look': DEFAULT_LOOK, 'variants': VARIANTS, 'catalog': CATALOG,
    }


MODELS = {'chr_base': chr_base}
