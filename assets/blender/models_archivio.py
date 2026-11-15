# Archivio Navigazionale (Epopea della Regata, dungeon 2 — Riccardo, 9 ott 2026): ingresso sull'arco est dell'anello della Laguna, kit
# del dungeon e i nemici del Collettivo Rottamautomi. Scritto sul PC di Riccardo senza Blender, poi eseguito il 11 ott 2026 sul fisso. Si lancia con:
#   npm run assets prop_ingresso_archivio dng_archivio_pavimento dng_archivio_muro dng_archivio_muro_basso
# poi lo sistema se qualcosa non torna e guarda il foglio dei contatti (tests/out/rpg_contact.png).
# I nomi sono quelli che cerca il codice: prop_ingresso_<stile> (game/ingressi.ts), dng_archivio_pavimento/muro/muro_basso
# (rpg/dungeon_scene.ts) e il campo `model` di enemies.json. Finché i modelli mancano dal manifest il gioco usa i segnaposto in codice di
# apps/client/src/rpg/archivio.ts (nemici e kit) e apps/client/src/game/ingressi_forme.ts (ingresso): le forme qui sotto li ricalcano, così
# l'aspetto non cambia di colpo. Scaffali (le colonne) e rastrelliere a grata restano in codice (archivio.ts): niente modello.
# L'Astrolabio è solo il nucleo: i suoi tre anelli li aggiunge sempre il client (girano a scatti e si staccano a metà vita).
# Chi vola (Aerostato, Astrolabio, anelli) ha il pivot a terra come gli altri: lo alza il client (dungeon_actors.ts).
# Convenzioni come models_drenaggio.py: x destra, y su, davanti −Z, 1 unità = 1 m, pivot a terra al centro; dng_* moduli ≤ 60 triangoli
# (pavimento da 0 a −0,3, muri da 0 a 2,4, bassi 0,6); nem_* ≤ 600 (l'Astrolabio, boss, ≤ 1.200); solo colori della palette e regioni
# dell'atlas che esistono già (`tavole`, `tavole_scure`, `carta` e i campioni piatti `p_<colore>`).
import math
from lib import Mesh, Xf

PAV, MURO, CIMA = 'tavole', 'tavole_scure', 'p_legno_scuro'


def _obj(m, **info):
    return ([m.build()], info) if info else [m.build()]


def _disco(m, c, r, spessore, reg, n=10):
    """Disco verticale (asse lungo Z) centrato in c: anelli nel piano XY."""
    ring = lambda z: [(c[0] + math.cos(2 * math.pi * i / n) * r, c[1] + math.sin(2 * math.pi * i / n) * r, z) for i in range(n)]  # noqa: E731
    a, b = ring(c[2] - spessore / 2), ring(c[2] + spessore / 2)
    for i in range(n):
        j = (i + 1) % n
        m.poly([a[i], a[j], b[j], b[i]], reg)
    m.poly(list(reversed(a)), reg)
    m.poly(list(b), reg)


def _anello(m, r, t, reg, n=12):
    """Anello (toro a sezione quadrata) nel piano XZ centrato nell'origine: usare m.push(Xf(...)) per metterlo e inclinarlo."""
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        p = lambda a, dr, dy: ((r + dr) * math.cos(a), dy, (r + dr) * math.sin(a))  # noqa: E731
        for (dr0, dy0), (dr1, dy1) in (((-t, -t), (t, -t)), ((t, -t), (t, t)), ((t, t), (-t, t)), ((-t, t), (-t, -t))):
            m.poly([p(a0, dr0, dy0), p(a1, dr0, dy0), p(a1, dr1, dy1), p(a0, dr1, dy1)], reg)


# ------------------------------------------------------------------ manifest principale: ingresso
def prop_ingresso_archivio():
    """Osservatorio di pietra (3,2 × 2,6 m) con la cupola d'ottone, il portone tondo con la rosa dei venti verso −Z, la banderuola in
    cima, due rotoli di carte davanti: l'Archivio Navigazionale sotto l'arco est della Laguna (≤ 200 triangoli)."""
    m = Mesh('prop_ingresso_archivio')
    m.box(-1.6, 0, -1.0, 1.6, 2.6, 1.6, 'p_pietra_scura', top='p_roccia', skip=('bottom',))
    m.box(-1.75, 2.6, -1.15, 1.75, 2.85, 1.75, 'p_legno_scuro', skip=('bottom',))
    m.loft([m.ring(6, 1.25, 2.85, cz=0.3), m.ring(6, 1.1, 3.4, cz=0.3), m.ring(6, 0.7, 3.85, cz=0.3)], 'p_arancio', top='p_arancio')  # cupola
    m.prism(5, 0.06, 0.06, 3.85, 5.2, 'p_nero_caldo', cz=0.3)                    # asta della banderuola
    m.box(-0.4, 4.92, 0.26, 0.5, 4.98, 0.34, 'p_giallo', skip=('bottom',))       # banderuola
    m.push(Xf(t=(0.6, 4.95, 0.3), r=(0, 0, -90)))                               # punta della banderuola, verso +x
    m.cone(4, 0.14, -0.15, 0.15, 'p_giallo', bottom='p_giallo')
    m.pop()
    _disco(m, (0, 1.2, -1.0), 1.0, 0.2, 'p_legno_scuro', n=8)                    # portone tondo
    _disco(m, (0, 1.2, -1.04), 0.82, 0.06, 'p_nero_caldo', n=8)
    m.box(-0.75, 1.16, -1.17, 0.75, 1.24, -1.11, 'p_giallo', skip=('back',))      # rosa dei venti
    m.box(-0.04, 0.45, -1.17, 0.04, 1.95, -1.11, 'p_giallo', skip=('back',))
    for x, r, l in ((-1.25, 0.16, 1.1), (1.3, 0.14, 0.9)):                       # rotoli di carte
        m.push(Xf(t=(x, r, -1.15), r=(0, 0, 90)))
        m.prism(5, r, r, -l / 2, l / 2, 'p_sabbia_chiara', top='carta', bottom='carta')
        m.pop()
    return _obj(m, footprint=[4, 4])


# ------------------------------------------------------------------ kit del dungeon (≤ 60 tri)
def dng_archivio_pavimento():
    """Tavolato 2×2 a y = 0 (bordo che scende a −0,3) con quattro chiodi d'ottone."""
    m = Mesh('dng_archivio_pavimento')
    m.box(-1, -0.3, -1, 1, 0, 1, 'p_legno_scuro', top=PAV, skip=('bottom',))
    for x, z in ((-0.8, -0.8), (0.7, -0.3), (-0.3, 0.2), (0.3, 0.7)):
        m.box(x, 0, z, x + 0.06, 0.01, z + 0.06, 'p_arancio', skip=('bottom',))
    return _obj(m)


def _muro(m, H):
    m.box(-1, 0, -1, 1, H, 1, MURO, top=CIMA, skip=('bottom',))
    if H > 1:  # cornice d'ottone in alto e una fila di rotoli di carta (visti di testa) tutto attorno
        m.box(-1.04, H - 0.14, -1.04, 1.04, H - 0.08, 1.04, 'p_arancio', skip=('bottom', 'top'))
        m.box(-1.03, 1.0, -1.03, 1.03, 1.3, 1.03, 'carta', skip=('bottom', 'top'))


def dng_archivio_muro():
    m = Mesh('dng_archivio_muro')
    _muro(m, 2.4)
    return _obj(m)


def dng_archivio_muro_basso():
    m = Mesh('dng_archivio_muro_basso')
    _muro(m, 0.6)
    return _obj(m)


# ------------------------------------------------------------------ nemici (statici, il client li anima e alza chi vola)
MODELS_MAIN = [prop_ingresso_archivio]
MODELS_RPG = [dng_archivio_pavimento, dng_archivio_muro, dng_archivio_muro_basso]
MODELS = {f.__name__: f for f in MODELS_MAIN + MODELS_RPG}
