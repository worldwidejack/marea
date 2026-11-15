# Nemici del Santuario del Capo Ardente (Isola Vulcano), snodati (issue 723; prima solo forme in codice in rpg/ceneri.ts).
#   npm run assets nem_lanciatore_lava nem_colosso nem_sciamano nem_fatuo nem_mite nem_korok
# Basalto nero con le crepe di brace (mat_emissivo arancio/giallo).
import math
from nemici_kit import Rig, Corpo, bipede, arto, anelli, R, tube, blob, cone_dir, quad2, slab, xf, face, EM
from models_rpg import band
from models_ceneri import _quad

BASALTO, BRACE = 'p_pietra_scura', 'p_arancio'


def _crepa(m, pts, reg=BRACE):
    for a, b in zip(pts, pts[1:]):
        tube(m, [a, b], [0.018, 0.018], 3, reg, mat=EM)


def nem_lanciatore_lava():
    """Lanciatore di Lava: snello, di basalto nero con le crepe arancio che brillano, il perizoma di fibra, il lanternino che gli brilla sul
    capo; il globo di lava in mano, che lancia a braccio teso."""
    r = Rig('nem_lanciatore_lava')
    c = Corpo(1.9, k=1.05)

    def busto(r, c):
        m = r.m
        _crepa(m, [(-0.12, 1.0, -0.17), (-0.05, 1.15, -0.18), (-0.1, 1.3, -0.19)])
        _crepa(m, [(0.1, 1.05, -0.17), (0.16, 1.25, -0.18)])
        band(m, (0, 0, 0), 0.24, 0.18, 1.0, 1.04, BRACE, n=8, both=False, mat=EM)

    def bacino(r, c):
        m = r.m
        for k in range(6):
            a = 2 * math.pi * k / 6 + 0.3
            quad2(m, [(math.cos(a) * 0.19, 0.98, math.sin(a) * 0.15), (math.cos(a + 0.6) * 0.19, 0.98, math.sin(a + 0.6) * 0.15),
                      (math.cos(a + 0.5) * 0.24, 0.72, math.sin(a + 0.5) * 0.19), (math.cos(a + 0.1) * 0.24, 0.72, math.sin(a + 0.1) * 0.19)], 'p_legno', (math.cos(a), 0, math.sin(a)))

    def testa(r, c, base):
        m = r.m
        m.cbox(0, 0, 0.3, 0.3, 1.6, 1.9, BASALTO)
        m.cbox(0, -0.155, 0.22, 0.02, 1.74, 1.78, BRACE, mat=EM)
        m.prism(5, 0.03, 0.03, 1.9, 2.15, 'p_legno_scuro')
        m.cbox(0, 0, 0.18, 0.18, 2.15, 2.38, 'p_giallo', top='p_legno_scuro', mat=EM)

    def globo(r, c, p):
        blob(r.m, (p[0], p[1] - 0.12, p[2] - 0.05), 0.15, 0.15, 0.15, BRACE, n=6, k=3, mat=EM)
        blob(r.m, (p[0], p[1] - 0.1, p[2] - 0.12), 0.08, 0.08, 0.08, 'p_giallo', n=4, k=2, mat=EM)

    bipede(r, c, gamba=BASALTO, scarpa=BASALTO, bacino=BASALTO, busto=BASALTO, braccio=BASALTO, mano=BASALTO,
           testa=testa, mano_dx=globo, sul_busto=busto, sul_bacino=bacino, n=6)
    return r.build()


def nem_colosso():
    """Guerriero Colossale: gigante di pietra a torso nudo con le cicatrici incandescenti, spalle enormi coi rostri di roccia, la testa
    piccola incassata, la clava di roccia fusa con la punta che arde (lungo l'avambraccio destro)."""
    r = Rig('nem_colosso')
    c = Corpo(3.1, k=1.5, gambe=0.8)
    c.spalla, c.collo = 2.38, 2.42
    c.r_coscia, c.r_stinco, c.r_braccio, c.r_avambraccio, c.mano = 0.25, 0.22, 0.24, 0.21, 1.0

    def busto(r, c):
        m = r.m
        anelli(m, [R(m, 0.5, c.vita, 0.36), R(m, 0.72, 1.85, 0.46), R(m, 0.8, 2.25, 0.46), R(m, 0.45, 2.45, 0.32)], 'p_pietra', top='p_pietra')
        _crepa(m, [(-0.45, 2.05, -0.44), (-0.1, 1.95, -0.47), (0.35, 2.1, -0.44)])
        _crepa(m, [(0.15, 1.95, -0.47), (0.2, 1.55, -0.42), (0.1, 1.3, -0.37)])
        _crepa(m, [(-0.3, 1.5, -0.4), (-0.15, 1.35, -0.37)])

    def spalliera(r, c, p, sx):
        m = r.m
        blob(m, (p[0], p[1], 0), 0.32, 0.3, 0.32, BASALTO, n=6, k=3, jit=0.2, seed=2)
        for k in range(2):
            cone_dir(m, (p[0] + sx * 0.05, p[1] + 0.2, -0.1 + 0.2 * k), (p[0] + sx * 0.25, p[1] + 0.6, -0.15 + 0.3 * k), 0.1, 4, 'p_nero_caldo')

    def testa(r, c, base):
        m = r.m
        m.cbox(0, -0.08, 0.5, 0.5, 2.4, 2.85, BASALTO)
        m.cbox(0, -0.335, 0.34, 0.02, 2.62, 2.67, BRACE, mat=EM)
        m.cbox(0, -0.25, 0.56, 0.16, 2.7, 2.78, 'p_nero_caldo')

    def clava(r, c, p):
        m = r.m
        x, y, z = p
        tube(m, [(x, y + 0.2, z), (x, y - 1.0, z - 0.05), (x, y - 1.7, z - 0.1)], [0.12, 0.2, 0.32], 6, 'p_nero_caldo')
        blob(m, (x, y - 1.75, z - 0.1), 0.3, 0.25, 0.3, BRACE, n=6, k=3, jit=0.2, seed=4, mat=EM)
        for k in range(3):
            a = 2 * math.pi * k / 3
            cone_dir(m, (x + math.cos(a) * 0.25, y - 1.55, z - 0.1 + math.sin(a) * 0.25), (x + math.cos(a) * 0.45, y - 1.5, z - 0.1 + math.sin(a) * 0.45), 0.07, 3, 'p_nero_caldo')

    c.spalliera = spalliera
    bipede(r, c, gamba=BASALTO, scarpa=BASALTO, bacino='p_legno_scuro', busto=None, braccio=BASALTO, mano=BASALTO,
           testa=testa, mano_dx=clava, sul_busto=busto, n=6)
    return r.build()


def nem_sciamano():
    """Sciamano del Fumo: figura di fumo e braci senza gambe che fluttua (la coda di fumo ondeggia), le braccia lunghe e fumose, la lanterna
    solida al posto della testa: brilla gialla, il punto debole."""
    r = Rig('nem_sciamano')
    m = r.m
    with r.osso('corpo', (0, 1.0, 0)):
        anelli(m, [R(m, 0.32, 0.85, 0.28, n=6), R(m, 0.38, 1.2, 0.3, n=6), R(m, 0.3, 1.5, 0.24, n=6), R(m, 0.12, 1.62, 0.1, n=6)], 'p_pietra', top='p_pietra')
        for k in range(5):
            a = 2 * math.pi * k / 5
            blob(m, (math.cos(a) * 0.3, 1.2 + 0.1 * (k % 2), math.sin(a) * 0.25), 0.04, 0.04, 0.04, BRACE, n=4, k=2, mat=EM)
        with r.osso('coda', (0, 0.9, 0)):
            m.loft([R(m, 0.1, 0.1, 0.1, n=6), R(m, 0.32, 0.5, 0.28, n=6), R(m, 0.34, 0.9, 0.29, n=6)], 'p_nero_caldo')
            with r.osso('coda2', (0, 0.4, 0)):
                for k in range(3):
                    a = 2 * math.pi * k / 3
                    cone_dir(m, (math.cos(a) * 0.15, 0.4, math.sin(a) * 0.15), (math.cos(a) * 0.3, 0.05, math.sin(a) * 0.3 + 0.2), 0.08, 4, 'p_pietra')
        with r.osso('testa', (0, 1.62, 0)):
            m.prism(4, 0.04, 0.04, 1.6, 1.68, 'p_nero_caldo')
            m.cbox(0, 0, 0.34, 0.34, 1.68, 1.72, 'p_nero_caldo')
            m.cbox(0, 0, 0.28, 0.28, 1.72, 2.02, 'p_giallo', mat=EM)
            for x in (-0.15, 0.15):
                for z in (-0.15, 0.15):
                    m.cbox(x, z, 0.04, 0.04, 1.72, 2.02, 'p_nero_caldo')
            m.cone(4, 0.24, 2.02, 2.2, 'p_nero_caldo', bottom='p_nero_caldo')
            m.prism(4, 0.02, 0.02, 2.2, 2.32, 'p_nero_caldo')
        for lato, sx in (('sx', -1), ('dx', 1)):
            with r.osso('braccio_' + lato, (sx * 0.3, 1.48, 0)):
                tube(m, [(sx * 0.3, 1.48, 0), (sx * 0.42, 1.15, -0.05)], [0.1, 0.08], 5, 'p_pietra')
                with r.osso('avambraccio_' + lato, (sx * 0.42, 1.15, -0.05)):
                    tube(m, [(sx * 0.42, 1.15, -0.05), (sx * 0.45, 0.85, -0.1)], [0.08, 0.06], 5, 'p_nero_caldo')
                    blob(m, (sx * 0.45, 0.8, -0.12), 0.07, 0.07, 0.07, BRACE, n=4, k=2, mat=EM)
    return r.build()


def nem_fatuo():
    """Fuoco fatuo: una fiammella che galleggia, il cuore giallo, due occhietti scuri, le lingue di fiamma che sfarfallano sopra."""
    r = Rig('nem_fatuo')
    m = r.m
    with r.osso('corpo', (0, 0.6, 0)):
        blob(m, (0, 0.6, 0), 0.2, 0.2, 0.2, BRACE, n=6, k=3, mat=EM)
        blob(m, (0, 0.6, -0.06), 0.12, 0.12, 0.12, 'p_giallo', n=5, k=2, mat=EM)
        for sx in (-1, 1):
            m.cbox(sx * 0.06, -0.19, 0.04, 0.02, 0.62, 0.68, 'p_nero_caldo')
        with r.osso('fiamma', (0, 0.75, 0)):
            for k, (x, z, h) in enumerate(((0, 0, 0.4), (0.08, 0.05, 0.25), (-0.08, 0.04, 0.28))):
                cone_dir(m, (x, 0.72, z), (x * 1.5, 0.72 + h, z + 0.08), 0.1 - 0.02 * k, 4, BRACE if k else 'p_rosso', mat=EM)
        for lato, sx in (('sx', -1), ('dx', 1)):
            with r.osso('braccio_' + lato, (sx * 0.18, 0.6, 0)):
                cone_dir(m, (sx * 0.17, 0.6, 0), (sx * 0.32, 0.5, -0.05), 0.05, 3, BRACE, mat=EM)
    return r.build()


def nem_mite():
    """Mite di lava: elementale piccolo e tozzo, una palla di basalto con le crepe di brace, la bocca che arde, gambette corte e due braccini."""
    r = Rig('nem_mite')
    c = Corpo(0.95, k=1.6, gambe=0.55)
    c.vita, c.spalla, c.collo, c.gomito, c.polso = 0.32, 0.6, 0.66, 0.45, 0.32
    c.sx, c.r_braccio, c.r_avambraccio, c.mano = 0.33, 0.06, 0.05, 0.0

    def busto(r, c):
        m = r.m
        blob(m, (0, 0.5, 0), 0.36, 0.32, 0.32, BASALTO, n=7, k=4, jit=0.15, seed=3)
        _crepa(m, [(-0.2, 0.62, -0.28), (-0.05, 0.55, -0.31), (0.12, 0.66, -0.28)])
        m.box(-0.14, 0.42, -0.32, 0.14, 0.47, -0.3, BRACE, skip=('back',), mat=EM)
        blob(m, (0, 0.85, 0.05), 0.12, 0.1, 0.12, BASALTO, n=5, k=2, jit=0.2, seed=6)
        for sx in (-1, 1):
            m.box(sx * 0.1 - 0.035, 0.6, -0.315, sx * 0.1 + 0.035, 0.64, -0.3, 'p_giallo', skip=('back',), mat=EM)

    def pugno(r, c, p):
        blob(r.m, (p[0], p[1] - 0.04, p[2]), 0.07, 0.07, 0.07, BRACE, n=4, k=2, mat=EM)

    bipede(r, c, gamba=BASALTO, scarpa=BASALTO, bacino=None, busto=None, braccio=BASALTO, mano=BASALTO,
           mano_dx=pugno, mano_sx=pugno, sul_busto=busto, n=5)
    return r.build()


def nem_korok():
    """Korok, il Cuore di Lava (boss, ≈ 5 m): gigante di roccia fusa; gambe di basalto, il tronco con la fessura incandescente e il nucleo
    giallo (brilla quando è scoperto), spalle a blocchi con le creste, braccia lunghe coi pugni enormi, la testa con la bocca che arde e la
    corona di fiamme gialle."""
    r = Rig('nem_korok')
    c = Corpo(4.6, k=1.5, gambe=0.85)
    c.spalla, c.collo = 3.55, 3.7
    c.r_coscia, c.r_stinco, c.r_braccio, c.r_avambraccio, c.mano = 0.42, 0.38, 0.34, 0.3, 0.0

    def busto(r, c):
        m = r.m
        blob(m, (0, 2.8, 0), 1.2, 1.0, 0.72, 'p_pietra', n=8, k=4, jit=0.12, seed=5)
        m.box(-0.2, 2.25, -0.74, 0.2, 3.4, -0.66, BRACE, skip=('back',), mat=EM)
        blob(m, (0, 2.85, -0.7), 0.3, 0.3, 0.15, 'p_giallo', n=6, k=3, mat=EM)
        _crepa(m, [(-0.8, 3.1, -0.55), (-0.4, 2.8, -0.68), (-0.6, 2.4, -0.6)])
        _crepa(m, [(0.7, 3.2, -0.55), (0.45, 2.6, -0.66)])

    def spalliera(r, c, p, sx):
        m = r.m
        m.cbox(p[0], 0, 0.85, 0.85, p[1] - 0.35, p[1] + 0.45, BASALTO, top='p_nero_caldo')
        cone_dir(m, (p[0], p[1] + 0.4, 0.2), (p[0] + sx * 0.3, p[1] + 1.0, 0.5), 0.2, 4, 'p_nero_caldo')

    def testa(r, c, base):
        m = r.m
        m.cbox(0, -0.1, 0.9, 0.85, 3.65, 4.5, BASALTO)
        m.box(-0.3, 3.85, -0.53, 0.3, 3.95, -0.52, BRACE, mat=EM)
        for sx in (-1, 1):
            m.box(sx * 0.22 - 0.08, 4.15, -0.535, sx * 0.22 + 0.08, 4.23, -0.52, 'p_giallo', mat=EM)
        for k, x in enumerate((-0.32, -0.16, 0, 0.16, 0.32)):
            cone_dir(m, (x, 4.48, -0.05), (x * 1.5, 4.95 + (0.3 if k == 2 else 0.1 * (k % 2)), 0.0), 0.11, 4, 'p_giallo', mat=EM)

    def pugno(r, c, p):
        blob(r.m, (p[0], p[1] - 0.3, p[2]), 0.48, 0.45, 0.48, BASALTO, n=6, k=3, jit=0.2, seed=8)
        _crepa(r.m, [(p[0] - 0.3, p[1] - 0.3, p[2] - 0.42), (p[0] + 0.3, p[1] - 0.4, p[2] - 0.42)])

    c.spalliera = spalliera
    bipede(r, c, gamba=BASALTO, scarpa='p_nero_caldo', bacino=BASALTO, busto=None, braccio=BASALTO, mano=BASALTO,
           testa=testa, mano_dx=pugno, mano_sx=pugno, sul_busto=busto, n=6)
    return r.build()


MODELS = {f.__name__: f for f in (nem_lanciatore_lava, nem_colosso, nem_sciamano, nem_fatuo, nem_mite, nem_korok)}
MODELS_RPG = list(MODELS.values())
