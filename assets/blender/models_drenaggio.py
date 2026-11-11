# Impianto di Drenaggio (Epopea della Regata, dungeon 1 — Riccardo, 8 ott 2026): ingresso sull'anello della Laguna, kit del dungeon e i
# 4 nemici del Collettivo Rottamautomi. SCRITTO SUL PC DI RICCARDO SENZA BLENDER: non è mai stato eseguito. Lo lancia il Claude di Jack
# (`npm run assets prop_ingresso_drenaggio dng_drenaggio_pavimento dng_drenaggio_muro dng_drenaggio_muro_basso
#`), lo sistema se qualcosa non torna e guarda il foglio dei contatti (tests/out/rpg_contact.png).
# Finché i modelli mancano dal manifest il gioco usa i segnaposto in codice di apps/client/src/rpg/drenaggio.ts (nemici e kit) e
# apps/client/src/game/ingressi_forme.ts (ingresso): le forme qui sotto li ricalcano, così l'aspetto non cambia di colpo.
# Convenzioni come models_rpg.py: x destra, y su, davanti −Z, 1 unità = 1 m, pivot a terra al centro; dng_* moduli ≤ 60 triangoli
# (pavimento da 0 a −0,3, muri da 0 a 2,4, bassi 0,6); nem_* ≤ 600 (il Capoturno, boss, ≤ 1.200); solo colori della palette.
# Regioni dell'atlas: quelle che esistono già (`ferro_rotto` per la lamiera arrugginita, i campioni piatti `p_<colore>`); se servono
# texture apposta (grata di scolo, lamiera chiodata col tubo d'ottone) si aggiungono in atlas.py nelle zone libere, senza spostare le altre.
import math
from lib import Mesh

MURO, CIMA = 'ferro_rotto', 'p_roccia'


def _obj(m, **info):
    return ([m.build()], info) if info else [m.build()]


# ------------------------------------------------------------------ manifest principale: ingresso
def prop_ingresso_drenaggio():
    """Casotto di lamiera chiodata (3,4 × 2 m) con un portellone tondo d'ottone verso −Z, due tubi che entrano nel terreno, valvola rossa
    e comignolo: l'imbocco delle pompe sotto la Laguna."""
    m = Mesh('prop_ingresso_drenaggio')
    m.box(-1.7, 0, -0.6, 1.7, 2.7, 1.4, MURO, top=CIMA, skip=('bottom',))
    m.box(-1.85, 2.7, -0.75, 1.85, 3.0, 1.55, 'p_roccia', skip=('bottom',))
    m.box(-1.75, 0.46, -0.65, 1.75, 0.64, 1.45, 'p_legno', skip=('bottom', 'top'))  # fascia di ruggine
    # portellone: anello d'ottone e bocca scura, dischi coricati verso −Z
    _disco(m, (0, 1.3, -0.62), 1.05, 0.22, 'p_arancio')
    _disco(m, (0, 1.3, -0.74), 0.82, 0.04, 'p_nero_caldo')
    for x, h in ((-1.95, 3.1), (1.95, 2.4)):
        m.prism(5, 0.2, 0.2, 0, h, 'p_legno', top='p_legno', cx=x, cz=-0.1)
    m.prism(6, 0.28, 0.28, 2.22, 2.38, 'p_arancio', top='p_arancio', bottom='p_arancio', cx=-1.95, cz=-0.1)
    _disco(m, (1.95, 2.1, -0.38), 0.38, 0.07, 'p_rosso')
    m.prism(5, 0.17, 0.17, 2.95, 3.95, 'p_nero_caldo', top='p_nero_caldo', cx=1.1, cz=0.95)
    return _obj(m, footprint=[4, 4])


def _disco(m, c, r, spessore, reg, n=10):
    """Disco verticale (asse lungo Z) centrato in c: anelli nel piano XY."""
    ring = lambda z: [(c[0] + math.cos(2 * math.pi * i / n) * r, c[1] + math.sin(2 * math.pi * i / n) * r, z) for i in range(n)]  # noqa: E731
    a, b = ring(c[2] - spessore / 2), ring(c[2] + spessore / 2)
    for i in range(n):
        j = (i + 1) % n
        m.poly([a[i], a[j], b[j], b[i]], reg)
    m.poly(list(reversed(a)), reg)
    m.poly(list(b), reg)


# ------------------------------------------------------------------ kit del dungeon (≤ 60 tri)
def dng_drenaggio_pavimento():
    """Lastra di ferro 2×2 a y = 0 con la grata di scolo (bordo che scende a −0,3)."""
    m = Mesh('dng_drenaggio_pavimento')
    m.box(-1, -0.3, -1, 1, 0, 1, 'p_roccia', top='p_pietra_scura', skip=('bottom',))
    m.box(0.15, 0, 0.15, 0.85, 0.01, 0.85, 'p_nero_caldo', skip=('bottom',))  # grata
    for k in range(3):
        z = 0.27 + 0.2 * k
        m.box(0.15, 0.01, z, 0.85, 0.02, z + 0.06, 'p_pietra_scura', skip=('bottom',))
    return _obj(m)


def _muro(m, H):
    m.box(-1, 0, -1, 1, H, 1, MURO, top=CIMA, skip=('bottom',))
    if H > 1:  # tubo d'ottone tutto attorno e riga dell'acqua di una volta
        m.box(-1.06, H - 0.75, -1.06, 1.06, H - 0.6, 1.06, 'p_arancio', skip=('bottom', 'top'))
        m.box(-1.02, H - 1.32, -1.02, 1.02, H - 1.26, 1.02, 'p_acqua_profonda', skip=('bottom', 'top'))


def dng_drenaggio_muro():
    m = Mesh('dng_drenaggio_muro')
    _muro(m, 2.4)
    return _obj(m)


def dng_drenaggio_muro_basso():
    m = Mesh('dng_drenaggio_muro_basso')
    _muro(m, 0.6)
    return _obj(m)


# ------------------------------------------------------------------ nemici (statici, il client li anima)
MODELS_MAIN = [prop_ingresso_drenaggio]
MODELS_RPG = [dng_drenaggio_pavimento, dng_drenaggio_muro, dng_drenaggio_muro_basso]
MODELS = {f.__name__: f for f in MODELS_MAIN + MODELS_RPG}
