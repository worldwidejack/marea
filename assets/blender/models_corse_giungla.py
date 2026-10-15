# Isola delle Corse, kit della zona Giungla e templi (docs/CORSE.md A9, #228). Concept: assets/concept/corse/corse_08_giungla_miniera.jpg.
# Quello che il kit dell'hub (models_corse_hub.py: alberi della giungla, palme, cespugli, rocce, rovine, la porta) non ha già:
# - il tempio con la galleria passante (la bocca di pietra da cui passa il tunnel della Miniera, occhi di fuoco, torce dentro);
# - la cascata (acqua a strisce, schiuma, rocce ai lati); l'ingresso di legno della miniera con le lanterne; la torcia su palo; la felce.
# Tutto sull'atlas, colori della palette, pivot a terra al centro, davanti −Z. Finiscono in manifest_corse.json (cs_g_*).
import math
from lib import Mesh, beam, face
from models_corse_hub import _torcia, ciuffo, griglia, muro, tornio

EM = 'mat_emissivo'
S, TOP = 'cs_h_tempio', 'muschio'


def _obj(m):
    return [m.build()]


def _liana(m, x, y, z, lung, s=-1):
    """Liana che pende dal bordo (faccia verso −Z se s = −1) con una foglia a metà."""
    face(m, [(x - 0.12, y, z), (x + 0.12, y, z), (x + 0.2, y - lung, z), (x + 0.02, y - lung, z)], 'p_erba_scura', (0, 0, s))
    face(m, [(x + 0.1, y - lung * 0.5, z + s * 0.01), (x + 0.42, y - lung * 0.5 + 0.12, z + s * 0.01), (x + 0.14, y - lung * 0.5 - 0.22, z + s * 0.01)], 'p_erba', (0, 0, s))


def cs_g_tempio_galleria():
    """Tempio della Miniera (14 × 16 m, 12 m): la faccia di pietra con la bocca che è una galleria passante (larga 5,2 m, alta 4,4),
    occhi di fuoco, gradoni col muschio, liane; dentro buio con le torce. Il tunnel passa lungo Z, da −Z (la faccia) a +Z."""
    m = Mesh('cs_g_tempio_galleria')
    X0, Z0, H0, BX, BH = 7.0, 8.0, 6.5, 2.6, 4.4
    # gradone 0: davanti e dietro con la bocca, i fianchi pieni
    for z, nz in ((-Z0, -1), (Z0, 1)):
        a, b = ((-BX, -X0), (X0, BX)) if nz < 0 else ((-X0, -BX), (BX, X0))
        for x0, x1 in (a, b):
            griglia(m, (x0, 0, z), (x1, 0, z), (x1, H0, z), (x0, H0, z), S, (0, 0, nz))
        griglia(m, (BX * -nz, BH, z), (BX * nz, BH, z), (BX * nz, H0, z), (BX * -nz, H0, z), 'cs_h_glifi' if nz < 0 else S, (0, 0, nz))
    for x, nx in ((-X0, -1), (X0, 1)):
        griglia(m, (x, 0, Z0 * nx), (x, 0, -Z0 * nx), (x, H0, -Z0 * nx), (x, H0, Z0 * nx), S, (nx, 0, 0))
    griglia(m, (-X0, H0, -Z0), (X0, H0, -Z0), (X0, H0, Z0), (-X0, H0, Z0), TOP, (0, 1, 0))
    # la galleria: pareti di roccia, volta, e il buio al centro (due fasce nere dove la luce non arriva)
    for x, nx in ((-BX, 1), (BX, -1)):
        griglia(m, (x, 0, -Z0), (x, 0, Z0), (x, BH, Z0), (x, BH, -Z0), 'p_roccia', (nx, 0, 0), passo=4.0)
        face(m, [(x + nx * 0.01, 0.6, -3), (x + nx * 0.01, 0.6, 3), (x + nx * 0.01, BH, 3), (x + nx * 0.01, BH, -3)], 'p_nero_caldo', (nx, 0, 0))
    griglia(m, (-BX, BH, Z0), (BX, BH, Z0), (BX, BH, -Z0), (-BX, BH, -Z0), 'p_ombra_calda', (0, -1, 0), passo=4.0)
    # le torce nella galleria, sulle pareti
    for z, s in ((-3.0, -1), (3.0, 1)):  # una per parete, sfalsate
        m.box(s * BX - (0.3 if s > 0 else 0), 2.2, z - 0.25, s * BX + (0.3 if s < 0 else 0), 2.5, z + 0.25, 'p_roccia', skip=())
        _torcia(m, s * (BX - 0.35), 2.5, z, 0.7)
    # la faccia: labbro coi denti, naso, occhi di fuoco, sopracciglia arrabbiate
    m.box(-BX - 0.6, BH, -Z0 - 0.7, BX + 0.6, BH + 0.7, -Z0, S, top=TOP, skip=('back',))
    for k in range(5):
        x = -BX + 0.5 + k * (2 * BX - 1.0) / 4
        m.box(x - 0.3, BH - 0.55, -Z0 - 0.45, x + 0.3, BH, -Z0 - 0.05, 'p_pietra_chiara', skip=('top', 'back'))
    m.box(-0.7, BH + 0.7, -Z0 - 1.0, 0.7, 6.3, -Z0, S, top=TOP, skip=('back',))
    for s in (-1, 1):
        ex0, ex1 = sorted((s * 1.0, s * 3.4))
        m.box(ex0 - 0.25, 5.05, -Z0 - 0.4, ex1 + 0.25, 5.2, -Z0, 'p_roccia', skip=('back',))
        face(m, [(ex0, 5.2, -Z0 - 0.05), (ex1, 5.2, -Z0 - 0.05), (ex1, 6.3, -Z0 - 0.05), (ex0, 6.3, -Z0 - 0.05)], 'em_fuoco', (0, 0, -1), mat=EM)
        bi, be = (s * 0.8, 6.35), (s * 3.9, 6.95)
        A, B = (bi[0], bi[1], -Z0 - 0.7), (be[0], be[1], -Z0 - 0.7)
        C, D = (be[0], be[1] + 0.6, -Z0 - 0.7), (bi[0], bi[1] + 0.6, -Z0 - 0.7)
        face(m, [A, B, C, D], S, (0, 0, -1))
        face(m, [D, C, (C[0], C[1], -Z0), (D[0], D[1], -Z0)], TOP, (0, 1, 0))
    # sopra la galleria dietro: l'arco di pietra
    m.box(-BX - 0.5, BH, Z0, BX + 0.5, BH + 0.6, Z0 + 0.5, S, top=TOP, skip=('front',))
    # due gradoni e il sacrario
    for x, z, y0, y1 in ((5.2, 6.0, H0, 9.2), (3.4, 4.0, 9.2, 11.4)):
        muro(m, -x, y0, -z, x, y1, z, S, top=TOP)
        for xx in (-x + 0.8, x - 1.2):
            _liana(m, xx, y1, -z - 0.02, 2.0)
    for xx, lung in ((-X0 + 0.7, 2.6), (-4.2, 1.6), (4.8, 2.2), (X0 - 0.9, 3.0)):
        _liana(m, xx, H0, -Z0 - 0.02, lung)
        _liana(m, -xx, H0, Z0 + 0.02, lung * 0.8, 1)
    for s in (-1, 1):
        _torcia(m, s * 2.0, 11.4, -2.0, 1.0)
    for (x, y, z, r) in ((-5.6, H0, -6.4, 1.0), (5.9, H0, -5.2, 0.8), (-4.0, 9.2, -4.6, 0.7), (4.4, 9.2, 4.0, 0.9), (6.2, H0, 6.8, 1.1)):
        ciuffo(m, x, y, z, r, 'p_erba_scura', ry=r * 0.6)
    return _obj(m)


def cs_g_cascata():
    """Cascata (6 m di larghezza, 12 m di caduta): un velo d'acqua a strisce verticali chiare e scure, la schiuma in basso, rocce
    muschiate ai lati e in cima. Davanti −Z (la si guarda dalla pista)."""
    m = Mesh('cs_g_cascata')
    W, H, n = 3.0, 12.0, 8
    for i in range(n):
        x0, x1 = -W + 2 * W * i / n, -W + 2 * W * (i + 1) / n
        reg = ('p_acqua_bassa', 'p_acqua', 'p_pietra_chiara', 'p_acqua')[i % 4]
        k = 0.25 * ((i * 7) % 3)  # il bordo di sotto un po' frastagliato
        face(m, [(x0, k, -0.2), (x1, k, -0.2), (x1, H, 0), (x0, H, 0)], reg, (0, 0.05, -1))
    for i in range(5):  # schiuma
        ciuffo(m, -W + 0.6 + i * (2 * W - 1.2) / 4, 0.3, -0.6, 0.9 + 0.2 * (i % 2), 'p_pietra_chiara', ry=0.55)
    for s in (-1, 1):  # le rocce ai lati e in cima
        m.box(s * W - (1.6 if s < 0 else -0.0), 0, -0.8, s * W + (1.6 if s > 0 else 0.0), H + 0.6, 1.2, 'p_roccia', top=TOP, skip=('bottom',))
        ciuffo(m, s * (W + 0.8), H + 0.6, 0.2, 1.1, 'p_erba_scura', ry=0.7)
    m.box(-W, H, 0.05, W, H + 0.5, 1.2, 'p_roccia', top=TOP, skip=('bottom', 'front'))
    return _obj(m)


def cs_g_ingresso():
    """Ingresso della miniera (12 m tra i pali, 6 m): due tronchi, la trave con le lanterne, le assi incrociate in cima e il cartello
    giallo e nero. La strada ci passa sotto lungo Z."""
    m = Mesh('cs_g_ingresso')
    L, H = 6.0, 5.6
    for s in (-1, 1):
        beam(m, (s * L, 0, 0), (s * L, H + 0.6, 0), 0.6, 0.6, 'p_legno', end='p_legno_scuro', n=6)
        beam(m, (s * L, 0, -0.9), (s * (L - 1.6), H, 0), 0.3, 0.3, 'p_legno_scuro', n=4)  # il puntone
        tornio(m, [(H - 0.9, 0), (H - 0.9, 0.22), (H - 0.35, 0.22), (H - 0.35, 0)], [('em_fuoco', EM), ('em_fuoco', EM), ('em_fuoco', EM)], n=6, cx=s * (L - 0.9), cz=-0.45)
        beam(m, (s * (L - 0.9), H - 0.3, -0.45), (s * (L - 0.9), H + 0.1, -0.45), 0.06, 0.06, 'p_nero_caldo')
    beam(m, (-L - 0.6, H, 0), (L + 0.6, H, 0), 0.7, 0.7, 'p_legno', end='p_legno_scuro', n=4)
    for s in (-1, 1):
        beam(m, (s * -3.5, H + 0.3, -0.2), (s * 3.5, H + 2.1, -0.2), 0.3, 0.25, 'p_legno_chiaro')
    # il cartello a strisce gialle e nere
    for i in range(6):
        x0 = -1.8 + i * 0.6
        face(m, [(x0, H + 0.5, -0.45), (x0 + 0.6, H + 0.5, -0.45), (x0 + 0.6, H + 1.4, -0.45), (x0, H + 1.4, -0.45)], 'p_giallo' if i % 2 else 'p_nero_caldo', (0, 0, -1))
    return _obj(m)


def cs_g_torcia():
    """Torcia della giungla su un palo di legno legato (2,4 m)."""
    m = Mesh('cs_g_torcia')
    beam(m, (0, 0, 0), (0, 1.9, 0), 0.18, 0.18, 'p_legno_scuro', end='p_legno', n=6)
    beam(m, (0, 1.2, 0), (0, 1.35, 0), 0.24, 0.24, 'p_erba_scura', n=6)
    _torcia(m, 0, 1.9, 0, 0.9)
    return _obj(m)


def cs_g_felce():
    """Felce (1,6 m): foglie lunghe e piegate a ventaglio, due verdi."""
    m = Mesh('cs_g_felce')
    for i in range(7):
        a = 2 * math.pi * i / 7 + 0.3
        c, s = math.cos(a), math.sin(a)
        reg = 'p_erba' if i % 2 else 'p_erba_scura'
        p0, p1, p2 = (c * 0.1, 0.1, s * 0.1), (c * 0.9, 1.0, s * 0.9), (c * 1.7, 0.4, s * 1.7)
        w = (-s * 0.25, 0, c * 0.25)
        face(m, [(p0[0] - w[0], p0[1], p0[2] - w[2]), (p0[0] + w[0], p0[1], p0[2] + w[2]), (p1[0] + w[0], p1[1], p1[2] + w[2]), (p1[0] - w[0], p1[1], p1[2] - w[2])], reg, (0, 1, 0))
        face(m, [(p1[0] - w[0], p1[1], p1[2] - w[2]), (p1[0] + w[0], p1[1], p1[2] + w[2]), p2], reg, (0, 1, 0))
        face(m, [(p0[0] + w[0], p0[1], p0[2] + w[2]), (p0[0] - w[0], p0[1], p0[2] - w[2]), (p1[0] - w[0], p1[1], p1[2] - w[2]), (p1[0] + w[0], p1[1], p1[2] + w[2])], reg, (0, -1, 0))
    return _obj(m)


MODELS = {f.__name__: f for f in (cs_g_tempio_galleria, cs_g_cascata, cs_g_ingresso, cs_g_torcia, cs_g_felce)}
