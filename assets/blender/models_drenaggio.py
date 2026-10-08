# Impianto di Drenaggio (Epopea della Regata, dungeon 1 — Riccardo, 8 ott 2026): ingresso sull'anello della Laguna, kit del dungeon e i
# 4 nemici del Collettivo Rottamautomi. SCRITTO SUL PC DI RICCARDO SENZA BLENDER: non è mai stato eseguito. Lo lancia il Claude di Jack
# (`npm run assets prop_ingresso_drenaggio dng_drenaggio_pavimento dng_drenaggio_muro dng_drenaggio_muro_basso nem_tubo nem_operaio
# nem_valvola nem_capoturno`), lo sistema se qualcosa non torna e guarda il foglio dei contatti (tests/out/rpg_contact.png).
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
        m.prism(6, 0.2, 0.2, 0, h, 'p_legno', top='p_legno', cx=x, cz=-0.1)
    m.prism(6, 0.28, 0.28, 2.22, 2.38, 'p_arancio', top='p_arancio', bottom='p_arancio', cx=-1.95, cz=-0.1)
    _disco(m, (1.95, 2.1, -0.38), 0.38, 0.07, 'p_rosso')
    m.prism(6, 0.17, 0.17, 2.95, 3.95, 'p_nero_caldo', top='p_nero_caldo', cx=1.1, cz=0.95)
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
def nem_tubo():
    """Tubo-strisciante: fanghiglia di ruggine e olio motore che si trascina, un pezzo di tubo piantato dentro, due occhi gialli."""
    m = Mesh('nem_tubo')
    m.prism(8, 0.7, 0.62, 0, 0.12, 'p_nero_caldo', top='p_nero_caldo')
    m.prism(8, 0.6, 0.45, 0.1, 0.4, 'p_legno_scuro', top='p_legno_scuro', cz=0.05)
    m.prism(7, 0.45, 0.28, 0.38, 0.66, 'p_legno', top='p_legno', cz=0.08)
    m.prism(6, 0.26, 0.12, 0.64, 0.84, 'p_ombra_calda', top='p_ombra_calda', cx=0.05, cz=0.1)
    m.prism(6, 0.11, 0.11, 0.55, 1.05, 'p_pietra_scura', top='p_arancio', cx=-0.18, cz=0.42)
    for sx in (-1, 1):
        m.cbox(sx * 0.13, -0.42, 0.1, 0.06, 0.46, 0.54, 'p_giallo', mat='mat_emissivo')
    return _obj(m)


def nem_operaio():
    """Operaio Arrugginito: automa operaio col barile per torso, fasce d'ottone, visiera gialla, comignolo, chiave inglese nella destra."""
    m = Mesh('nem_operaio')
    for sx in (-1, 1):
        m.cbox(sx * 0.15, 0, 0.18, 0.22, 0, 0.75, 'p_roccia')
        m.cbox(sx * 0.15, -0.04, 0.24, 0.32, 0, 0.1, 'p_nero_caldo')
    m.prism(7, 0.28, 0.32, 0.75, 1.45, MURO, top='p_legno', bottom='p_legno')
    for y in (0.81, 1.31):
        m.prism(7, 0.335, 0.335, y, y + 0.08, 'p_arancio')
    m.cbox(0, 0, 0.36, 0.32, 1.46, 1.74, 'p_pietra_scura')
    m.cbox(0, -0.17, 0.26, 0.04, 1.59, 1.65, 'p_giallo', mat='mat_emissivo')
    m.prism(6, 0.08, 0.06, 1.35, 1.75, 'p_nero_caldo', cx=0.12, cz=0.28)
    m.cbox(-0.42, 0, 0.14, 0.14, 0.78, 1.38, 'p_legno_scuro')
    m.cbox(0.42, -0.2, 0.14, 0.14, 0.78, 1.38, 'p_legno_scuro')
    m.cbox(0.42, -0.55, 0.08, 0.5, 0.9, 0.98, 'p_pietra')  # chiave inglese tesa in avanti
    m.cbox(0.42, -0.82, 0.24, 0.12, 0.84, 1.04, 'p_pietra')
    return _obj(m)


def nem_valvola():
    """Valvola-SparaVapore: torretta fissa sul tubo, volantino rosso, ugello d'ottone verso −Z, manometro."""
    m = Mesh('nem_valvola')
    m.prism(8, 0.5, 0.45, 0, 0.18, 'p_pietra_scura', top='p_pietra_scura')
    m.prism(8, 0.2, 0.2, 0.18, 1.25, MURO, top='p_legno')
    m.prism(8, 0.27, 0.27, 1.0, 1.1, 'p_arancio', top='p_arancio', bottom='p_arancio')
    m.cbox(0, -0.36, 0.22, 0.5, 0.94, 1.16, 'p_arancio')  # ugello
    m.cbox(0, -0.62, 0.1, 0.04, 1.0, 1.1, 'p_nero_caldo')
    m.prism(8, 0.3, 0.3, 1.35, 1.4, 'p_rosso', top='p_rosso', bottom='p_rosso')
    m.cbox(0.23, -0.05, 0.05, 0.26, 0.67, 0.93, 'p_sabbia_chiara')
    return _obj(m)


def nem_capoturno():
    """Il Capoturno: grosso automa logoro, caschetto giallo, fornace nel petto, martello pneumatico gigante nella destra (boss)."""
    m = Mesh('nem_capoturno')
    for sx in (-1, 1):
        m.cbox(sx * 0.3, 0, 0.34, 0.34, 0, 0.95, 'p_roccia')
        m.prism(6, 0.11, 0.09, 1.75, 2.25, 'p_nero_caldo', cx=sx * 0.32, cz=0.32)
    m.cbox(0, 0, 1.1, 0.75, 0.93, 1.88, MURO, top='p_legno')
    for y in (0.94, 1.74):
        m.cbox(0, 0, 1.16, 0.8, y, y + 0.12, 'p_arancio')
    m.cbox(0, -0.39, 0.5, 0.06, 1.2, 1.56, 'p_nero_caldo')
    m.cbox(0, -0.41, 0.42, 0.04, 1.27, 1.45, 'p_arancio', mat='mat_emissivo')  # fornace accesa
    m.cbox(0, -0.05, 0.46, 0.42, 1.88, 2.24, 'p_pietra_scura')
    m.cbox(0, -0.28, 0.34, 0.05, 2.05, 2.11, 'p_rosso', mat='mat_emissivo')
    m.prism(8, 0.36, 0.32, 2.24, 2.4, 'p_giallo', top='p_giallo', cz=-0.05)
    m.cbox(-0.72, 0, 0.3, 0.3, 0.92, 1.78, 'p_legno_scuro')
    m.cbox(0.72, -0.3, 0.3, 0.3, 1.05, 1.85, 'p_legno_scuro')
    m.cbox(0.72, -0.85, 0.16, 1.2, 1.1, 1.26, 'p_pietra_scura')  # asta del martello in avanti
    m.cbox(0.72, -1.5, 0.62, 0.5, 0.6, 1.1, 'p_roccia')         # testa
    m.cbox(0.72, -1.1, 0.26, 0.26, 1.06, 1.32, 'p_arancio')      # pistone
    return _obj(m)


MODELS_MAIN = [prop_ingresso_drenaggio]
MODELS_RPG = [dng_drenaggio_pavimento, dng_drenaggio_muro, dng_drenaggio_muro_basso, nem_tubo, nem_operaio, nem_valvola, nem_capoturno]
MODELS = {f.__name__: f for f in MODELS_MAIN + MODELS_RPG}
