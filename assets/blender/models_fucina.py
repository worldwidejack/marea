# Fucina a Pressione (Epopea della Regata, dungeon 3 — Riccardo, 9 ott 2026): ingresso sull'arco nord dell'anello della Laguna, kit del
# dungeon e i nemici del Collettivo Rottamautomi. Scritto sul PC di Riccardo senza Blender, poi eseguito e rifinito l'11 ott 2026 sul fisso. Si lancia con:
#   npm run assets prop_ingresso_fucina dng_fucina_pavimento dng_fucina_muro dng_fucina_muro_basso dng_fucina_colonna dng_fucina_leva
# poi lo sistema se qualcosa non torna e guarda il foglio dei contatti (tests/out/rpg_contact.png).
# I nomi sono quelli che cerca il codice: prop_ingresso_<stile> (game/ingressi.ts), dng_fucina_pavimento/muro/muro_basso e
# dng_fucina_colonna (la pressa a vapore al posto delle colonne, rpg/dungeon_scene.ts), dng_fucina_leva (la cassa della chiusa,
# rpg/fucina.ts) e il campo `model` di enemies.json. Finché i modelli mancano dal manifest il gioco usa i segnaposto in codice di
# apps/client/src/rpg/fucina.ts (nemici, kit, leva) e apps/client/src/game/ingressi_forme.ts (ingresso): le forme qui sotto li ricalcano,
# così l'aspetto non cambia di colpo. Della leva il modello è solo la cassa: il braccio col pomo che si abbassa lo aggiunge sempre il
# client. Lava, cascate, fuoco a terra e vapore restano effetti in codice: niente modello.
# Le parti accese (fuoco della fornace, braci, la Scintilla) usano `mat_emissivo`: il client le spegne quando il Mastro Forgiatore è
# spento (dungeon_actors.ts cerca «emissiv» nel nome del materiale).
# Convenzioni come models_drenaggio.py: x destra, y su, davanti −Z, 1 unità = 1 m, pivot a terra al centro; dng_* moduli ≤ 60 triangoli
# (pavimento da 0 a −0,3, muri da 0 a 2,4, bassi 0,6), pressa e leva 50-200; nem_* ≤ 600 (il Mastro Forgiatore, boss, ≤ 1.200); solo
# colori della palette e regioni dell'atlas che esistono già (`roccia` e i campioni piatti `p_<colore>`). I mattoni refrattari dei muri
# (`mattoni_fucina`) e le lastre di basalto del pavimento (`basalto_fucina`) sono regioni aggiunte in atlas.py (zona libera a y 384).
import math
from lib import Mesh, Xf

PAV, MURO, CIMA, EM = 'basalto_fucina', 'mattoni_fucina', 'p_nero_caldo', 'mat_emissivo'  # regioni aggiunte in atlas.py (11 ott 2026)


def _obj(m, **info):
    return ([m.build()], info) if info else [m.build()]


def _disco(m, c, r, spessore, reg, n=10, mat=None):
    """Disco verticale (asse lungo Z) centrato in c: anelli nel piano XY."""
    ring = lambda z: [(c[0] + math.cos(2 * math.pi * i / n) * r, c[1] + math.sin(2 * math.pi * i / n) * r, z) for i in range(n)]  # noqa: E731
    a, b = ring(c[2] - spessore / 2), ring(c[2] + spessore / 2)
    for i in range(n):
        j = (i + 1) % n
        m.poly([a[i], a[j], b[j], b[i]], reg, mat)
    m.poly(list(reversed(a)), reg, mat)
    m.poly(list(b), reg, mat)


def _sfera(m, c, r, reg, n=6, mat=None):
    """Palla sfaccettata (come IcosahedronGeometry del segnaposto): cinque anelli da polo a polo."""
    k = math.sqrt(3) / 2
    m.loft([m.ring(n, 0.0001, c[1] - r, cx=c[0], cz=c[2]), m.ring(n, r * k, c[1] - r / 2, cx=c[0], cz=c[2]), m.ring(n, r, c[1], cx=c[0], cz=c[2]),
            m.ring(n, r * k, c[1] + r / 2, cx=c[0], cz=c[2]), m.ring(n, 0.0001, c[1] + r, cx=c[0], cz=c[2])], reg, mat=mat)


# ------------------------------------------------------------------ manifest principale: ingresso
def prop_ingresso_fucina():
    """Altoforno di mattoni refrattari (3,2 × 2,6 m) con la bocca ad arco accesa verso −Z, fascia e tubi d'ottone, camino a gradini con la
    brace in cima, un'incudine davanti: la Fucina a Pressione sull'arco nord della Laguna (≤ 200 triangoli)."""
    m = Mesh('prop_ingresso_fucina')
    m.box(-1.6, 0, -1.0, 1.6, 2.4, 1.6, MURO, top=CIMA, skip=('bottom',))
    m.box(-1.7, 2.4, -1.1, 1.7, 2.6, 1.7, 'p_nero_caldo', skip=('bottom',))
    m.box(-1.65, 0.62, -1.05, 1.65, 0.78, 1.65, 'p_arancio', skip=('bottom', 'top'))               # fascia d'ottone
    m.loft([m.ring(6, 1.25, 2.6, cz=0.5), m.ring(6, 0.9, 3.6, cz=0.5), m.ring(6, 0.8, 3.6, cz=0.5), m.ring(6, 0.55, 4.7, cz=0.5)], MURO)  # camino
    m.prism(6, 0.6, 0.6, 4.7, 4.85, 'p_rosso', top='p_arancio', cz=0.5, mat=EM)                   # brace in cima
    m.box(-0.85, 0.1, -1.06, 0.85, 1.6, -0.94, 'p_nero_caldo', skip=('back', 'bottom'))            # la bocca
    m.box(-0.65, 0.2, -1.09, 0.65, 1.1, -1.03, 'p_arancio', skip=('back',), mat=EM)                # il fuoco
    m.box(-0.4, 0.28, -1.115, 0.4, 0.73, -1.045, 'p_giallo', skip=('back',), mat=EM)
    m.cbox(0, -1.02, 2.0, 0.3, 1.61, 1.83, 'p_roccia')                                             # architrave
    m.prism(5, 0.16, 0.16, 0, 2.6, 'p_arancio', top='p_arancio', cx=-1.75, cz=-0.2)                # tubi d'ottone
    m.prism(5, 0.16, 0.16, 0, 1.9, 'p_arancio', top='p_arancio', cx=1.75, cz=-0.2)
    m.cbox(1.25, -1.55, 0.7, 0.4, 0.18, 0.53, 'p_nero_caldo')                                      # incudine
    m.cbox(1.25, -1.55, 0.3, 0.3, 0, 0.27, 'p_roccia', skip=('bottom',))
    return _obj(m, footprint=[4, 4])


# ------------------------------------------------------------------ kit del dungeon (≤ 60 tri i moduli)
def dng_fucina_pavimento():
    """Lastra di basalto 2×2 a y = 0 (bordo che scende a −0,3) con tre braci cadute."""
    m = Mesh('dng_fucina_pavimento')
    m.box(-1, -0.3, -1, 1, 0, 1, 'p_roccia', top=PAV, skip=('bottom',))
    for x, z in ((-0.6, -0.4), (0.5, 0.3), (-0.1, 0.7)):
        m.box(x, 0, z, x + 0.06, 0.01, z + 0.06, 'p_arancio', skip=('bottom',))
    return _obj(m)


def _muro(m, H):
    m.box(-1, 0, -1, 1, H, 1, MURO, top=CIMA, skip=('bottom',))
    if H > 1:  # tubo d'ottone tutto attorno e la fuliggine in alto
        m.box(-1.03, 1.0, -1.03, 1.03, 1.12, 1.03, 'p_arancio', skip=('bottom', 'top'))
        m.box(-1.01, H - 0.2, -1.01, 1.01, H, 1.01, 'p_nero_caldo', skip=('bottom', 'top'))


def dng_fucina_muro():
    m = Mesh('dng_fucina_muro')
    _muro(m, 2.4)
    return _obj(m)


def dng_fucina_muro_basso():
    m = Mesh('dng_fucina_muro_basso')
    _muro(m, 0.6)
    return _obj(m)


def dng_fucina_colonna():
    """Pressa a vapore (al posto delle colonne, 1,5 m di lato): basamento, incudine con la lamiera rovente, due colonnine, cilindro d'ottone,
    traversa e stantuffo."""
    m = Mesh('dng_fucina_colonna')
    m.cbox(0, 0, 1.5, 1.5, 0, 0.35, 'p_roccia', skip=('bottom',))
    m.cbox(0, 0, 1.2, 1.2, 0.35, 0.9, 'p_nero_caldo', skip=('bottom',))
    m.cbox(0, 0, 1.25, 1.25, 0.9, 1.0, 'p_pietra_scura', skip=('bottom',))
    for cx, cz in ((-0.45, -0.45), (0.45, 0.45)):
        m.prism(6, 0.13, 0.13, 1.0, 2.3, 'p_pietra_scura', cx=cx, cz=cz)
    m.prism(8, 0.38, 0.38, 1.6, 2.3, 'p_arancio', bottom='p_arancio')
    m.prism(8, 0.42, 0.42, 1.58, 1.66, 'p_giallo')
    m.cbox(0, 0, 1.3, 1.3, 2.29, 2.51, 'p_roccia')
    m.prism(6, 0.12, 0.12, 1.0, 1.6, 'p_pietra')
    m.cbox(0, 0, 0.5, 0.5, 1.0, 1.06, 'p_rosso', skip=('bottom',), mat=EM)                         # la lamiera rovente
    return _obj(m)


def dng_fucina_leva():
    """Cassa della chiusa: cassa di legno scuro col bordo d'ottone e la targa, il perno della leva (il braccio lo mette il client) e il tubo
    dell'acqua che sale al soffitto."""
    m = Mesh('dng_fucina_leva')
    m.cbox(0, 0, 0.9, 0.6, 0, 0.9, 'p_legno_scuro', skip=('bottom',))
    m.cbox(0, 0, 0.95, 0.65, 0.86, 0.94, 'p_arancio', skip=('bottom',))
    m.box(-0.3, 0.35, -0.34, 0.3, 0.65, -0.3, 'p_giallo', skip=('back',))                          # targa
    m.prism(6, 0.06, 0.06, 0, 2.6, 'p_acqua_profonda', top='p_acqua_profonda', cx=0.32, cz=0.22)
    m.push(Xf(t=(0, 0.95, -0.05), r=(0, 0, 90)))                                                   # perno, asse lungo x
    m.prism(8, 0.16, 0.16, -0.1, 0.1, 'p_pietra_scura', top='p_pietra_scura', bottom='p_pietra_scura')
    m.pop()
    return _obj(m)


# ------------------------------------------------------------------ nemici (statici, il client li anima)
MODELS_MAIN = [prop_ingresso_fucina]
MODELS_RPG = [dng_fucina_pavimento, dng_fucina_muro, dng_fucina_muro_basso, dng_fucina_colonna, dng_fucina_leva]
MODELS = {f.__name__: f for f in MODELS_MAIN + MODELS_RPG}
