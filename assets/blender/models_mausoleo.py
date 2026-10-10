# Mausoleo Cinetico (Epopea della Regata, dungeon 4 — Riccardo, 9 ott 2026): ingresso sull'arco nord-ovest dell'anello della Laguna, kit
# del dungeon, la chiave di carica, il sarcofago della Regina e i nemici (Chierico a Ingranaggi, Sentinella dell'Egida, Guardia d'Onore,
# il Custode dell'Egida). SCRITTO SUL PC DI RICCARDO SENZA BLENDER: MAI ESEGUITO. Lo lancia il Claude di Jack:
#   npm run assets prop_ingresso_mausoleo dng_mausoleo_pavimento dng_mausoleo_muro dng_mausoleo_muro_basso dng_mausoleo_colonna dng_mausoleo_leva dng_mausoleo_sarcofago nem_chierico nem_sentinella nem_guardia nem_custode_egida
# poi lo sistema se qualcosa non torna e guarda il foglio dei contatti (tests/out/rpg_contact.png).
# I nomi sono quelli che cerca il codice: prop_ingresso_<stile> (game/ingressi.ts), dng_mausoleo_pavimento/muro/muro_basso e
# dng_mausoleo_colonna (colonna di marmo con l'ingranaggio, anche il perno delle lancette: rpg/dungeon_scene.ts), dng_mausoleo_leva (la
# cassa d'orologio della chiave di carica) e dng_mausoleo_sarcofago (rpg/mausoleo_fx.ts), e il campo `model` di enemies.json.
# Finché i modelli mancano dal manifest il gioco usa i segnaposto in codice di apps/client/src/rpg/mausoleo.ts (nemici, kit, chiave,
# sarcofago) e apps/client/src/game/ingressi_forme.ts (ingresso, `tempietto`): le forme qui sotto li ricalcano, così l'aspetto non cambia
# di colpo. Della chiave il modello è solo la cassa (la farfalla che gira la mette il client), del sarcofago solo la cassa (il coperchio
# che scivola via lo mette il client). Il cancello del Santuario (gabbia di sbarre che scende), le lancette, le onde e la nebbia restano
# in codice: niente modello.
# Le parti che brillano (l'acqua della spada della Guardia, l'energia dello scudo, i tre cuori del Custode, le lampade) usano
# `mat_emissivo`.
# Convenzioni come models_drenaggio.py: x destra, y su, davanti −Z, 1 unità = 1 m, pivot a terra al centro; dng_* moduli ≤ 60 triangoli
# (pavimento da 0 a −0,3, muri da 0 a 2,4, bassi 0,6), colonna, chiave e sarcofago 50-200; nem_* ≤ 600 (il Custode, boss, ≤ 1.200); solo
# colori della palette e regioni dell'atlas che esistono già (i campioni piatti `p_<colore>`). Il marmo a scacchi del pavimento nel
# segnaposto è a pixel; qui sono quattro quadri di pietra sul marmo chiaro con le righe d'ottone: se serve, una regione `marmo_mausoleo`
# si aggiunge in atlas.py nelle zone libere, senza spostare le altre.
# Triangoli contati in Python con un bpy finto (Mesh.tris): ingresso 174, pavimento 18, muro 26, muro basso 10, colonna 190, chiave 74,
# sarcofago 56, chierico 314, sentinella 176, guardia 170, Custode 438.
import math
from lib import Mesh, Xf

EM = 'mat_emissivo'


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


def _gemma(m, c, r, reg, mat=EM):
    """Gemma a otto facce (al posto della IcosahedronGeometry piccola del segnaposto)."""
    m.prism(4, r, r, c[1] - r * 0.6, c[1] + r * 0.6, reg, top=reg, bottom=reg, cx=c[0], cz=c[2], mat=mat)


def _quad(m, pts, reg, mat=None):
    m.poly(pts, reg, mat)


# ------------------------------------------------------------------ manifest principale: ingresso
def prop_ingresso_mausoleo():
    """Tempietto di marmo bianco (3 × 2,4 m) sul gradino: porta scura verso −Z tra due colonnine d'ottone, l'orologio sopra la porta, la
    cupola con la lanterna d'acqua in cima e i due canali d'acqua ai lati (≤ 200 triangoli)."""
    m = Mesh('prop_ingresso_mausoleo')
    m.cbox(0, 0.2, 3.6, 3.0, 0, 0.3, 'p_pietra', skip=('bottom',))                                   # gradino
    m.cbox(0, 0.3, 3.0, 2.4, 0.3, 2.5, 'p_pietra_chiara', skip=('bottom',))                          # il tempietto
    m.cbox(0, 0.3, 3.3, 2.7, 2.5, 2.7, 'p_giallo', skip=('bottom',))                                 # cornice d'ottone
    m.loft([m.ring(8, 1.3, 2.7, cz=0.3), m.ring(8, 0.9, 3.4, cz=0.3)], 'p_pietra_chiara', top='p_pietra_chiara')  # cupola
    m.prism(6, 0.32, 0.32, 3.4, 3.9, 'p_giallo', top='p_giallo', cz=0.3)                             # lanterna
    _gemma(m, (0, 4.05, 0.3), 0.2, 'p_acqua_bassa')
    m.box(-0.65, 0.3, -0.98, 0.65, 1.8, -0.86, 'p_nero_caldo', skip=('back', 'bottom'))              # la porta
    for x in (-0.95, 0.95):
        m.prism(6, 0.13, 0.13, 0.3, 2.5, 'p_arancio', cx=x, cz=-1.0)                                 # colonnine
    _disco(m, (0, 2.15, -0.93), 0.42, 0.06, 'p_giallo', n=8)                                         # l'orologio
    _quad(m, [(-0.3 * math.cos(a), 2.15 + 0.3 * math.sin(a), -0.965) for a in (math.pi * k / 4 for k in range(8))], 'p_sabbia_chiara')
    _quad(m, [(-0.025, 2.15, -0.97), (0.025, 2.15, -0.97), (0.025, 2.38, -0.97), (-0.025, 2.38, -0.97)], 'p_nero_caldo')  # lancette
    _quad(m, [(0, 2.125, -0.97), (0, 2.175, -0.97), (0.18, 2.175, -0.97), (0.18, 2.125, -0.97)], 'p_nero_caldo')
    for x in (-1.75, 1.75):
        m.cbox(x, -0.6, 0.4, 1.2, 0, 0.12, 'p_pietra_scura', skip=('bottom',))                       # sponde dei canali
        _quad(m, [(x - 0.13, 0.13, -1.2), (x + 0.13, 0.13, -1.2), (x + 0.13, 0.13, 0), (x - 0.13, 0.13, 0)], 'p_acqua_bassa', EM)  # l'acqua
    return _obj(m, footprint=[4, 4])


# ------------------------------------------------------------------ kit del dungeon (≤ 60 tri i moduli)
def dng_mausoleo_pavimento():
    """Lastra di marmo chiaro 2×2 a y = 0 (bordo che scende a −0,3): due quadri di marmo grigio a scacchi e le righe d'ottone in croce."""
    m = Mesh('dng_mausoleo_pavimento')
    m.box(-1, -0.3, -1, 1, 0, 1, 'p_pietra', top='p_pietra_chiara', skip=('bottom',))
    y = 0.004
    for x0, z0 in ((-1, -1), (0, 0)):
        _quad(m, [(x0, y, z0 + 1), (x0 + 1, y, z0 + 1), (x0 + 1, y, z0), (x0, y, z0)], 'p_pietra')
    _quad(m, [(-0.03, y * 2, 1), (0.03, y * 2, 1), (0.03, y * 2, -1), (-0.03, y * 2, -1)], 'p_giallo')
    _quad(m, [(-1, y * 2, 0.03), (1, y * 2, 0.03), (1, y * 2, -0.03), (-1, y * 2, -0.03)], 'p_giallo')
    return _obj(m)


def _muro(m, H):
    m.box(-1, 0, -1, 1, H, 1, 'p_pietra_chiara', top='p_pietra', skip=('bottom',))
    if H > 1:  # fascia d'ottone e il canale dell'acqua alla base
        m.box(-1.02, 1.4, -1.02, 1.02, 1.6, 1.02, 'p_giallo', skip=('bottom', 'top'))
        m.box(-1.01, 0.62, -1.01, 1.01, 0.8, 1.01, 'p_acqua', skip=('bottom', 'top'))


def dng_mausoleo_muro():
    m = Mesh('dng_mausoleo_muro')
    _muro(m, 2.4)
    return _obj(m)


def dng_mausoleo_muro_basso():
    m = Mesh('dng_mausoleo_muro_basso')
    _muro(m, 0.6)
    return _obj(m)


def dng_mausoleo_colonna():
    """Colonna di marmo (anche il perno delle lancette): base, fusto, due anelli d'ottone, capitello e l'ingranaggio in cima coi sei denti."""
    m = Mesh('dng_mausoleo_colonna')
    m.prism(8, 0.6, 0.55, 0, 0.3, 'p_pietra', top='p_pietra')
    m.prism(8, 0.38, 0.38, 0.3, 2.2, 'p_pietra_chiara')
    for y in (0.56, 1.86):
        m.prism(8, 0.42, 0.42, y, y + 0.08, 'p_giallo')
    m.prism(8, 0.45, 0.55, 2.175, 2.425, 'p_pietra', top='p_pietra')
    m.prism(12, 0.62, 0.62, 2.42, 2.54, 'p_arancio', top='p_arancio')
    for k in range(6):
        a = k * math.pi / 3
        m.push(Xf(t=(math.cos(a) * 0.7, 0, math.sin(a) * 0.7), r=(0, -math.degrees(a), 0)))
        m.box(-0.1, 2.42, -0.11, 0.1, 2.54, 0.11, 'p_arancio', skip=('bottom', 'top'))
        m.pop()
    m.prism(6, 0.16, 0.16, 2.54, 2.68, 'p_giallo', top='p_giallo')
    return _obj(m)


def dng_mausoleo_leva():
    """Cassa d'orologio della chiave di carica: marmo col bordo d'ottone, il quadrante davanti e il perno in cima (la chiave a farfalla
    che gira la mette il client)."""
    m = Mesh('dng_mausoleo_leva')
    m.cbox(0, 0, 1.0, 0.8, 0, 0.9, 'p_pietra_chiara', skip=('bottom',))
    m.cbox(0, 0, 1.05, 0.85, 0.87, 0.97, 'p_giallo', skip=('bottom',))
    _disco(m, (0, 0.5, -0.42), 0.32, 0.05, 'p_giallo', n=8)
    _quad(m, [(-0.26 * math.cos(a), 0.5 + 0.26 * math.sin(a), -0.447) for a in (math.pi * k / 4 for k in range(8))], 'p_sabbia_chiara')
    _quad(m, [(-0.015, 0.5, -0.452), (0.015, 0.5, -0.452), (0.015, 0.68, -0.452), (-0.015, 0.68, -0.452)], 'p_nero_caldo')
    _quad(m, [(0, 0.485, -0.452), (0, 0.515, -0.452), (0.13, 0.515, -0.452), (0.13, 0.485, -0.452)], 'p_nero_caldo')
    m.prism(6, 0.1, 0.1, 0.97, 1.2, 'p_arancio', top='p_arancio')
    return _obj(m)


def dng_mausoleo_sarcofago():
    """Il sarcofago della Regina senza il coperchio (lo mette il client, scivola via quando il Custode cade): due gradini, la cassa di marmo
    col fregio d'ottone, il bordo d'acqua in cima e il sigillo a onda davanti."""
    m = Mesh('dng_mausoleo_sarcofago')
    m.cbox(0, 0, 2.0, 2.0, 0, 0.2, 'p_pietra', skip=('bottom',))
    m.cbox(0, 0, 1.6, 1.8, 0.2, 0.4, 'p_pietra_scura', skip=('bottom',))
    m.cbox(0, 0, 1.1, 1.7, 0.4, 1.0, 'p_pietra_chiara', skip=('bottom',))
    m.cbox(0, 0, 1.15, 1.75, 0.55, 0.65, 'p_giallo', skip=('bottom', 'top'))
    m.cbox(0, 0, 1.12, 1.72, 0.97, 1.03, 'p_acqua', skip=('bottom',))
    m.box(-0.2, 0.68, -0.9, 0.2, 0.88, -0.86, 'p_acqua_bassa', skip=('back',))                        # il sigillo a onda
    return _obj(m)


# ------------------------------------------------------------------ nemici (statici, il client li anima)
def nem_chierico():
    """Chierico a Ingranaggi: tonaca di marmo bianco, cintura d'ottone, testa a cupola, l'ingranaggio come aureola dietro la testa, maniche,
    bastone con la lampada d'olio accesa e l'occhio che brilla."""
    m = Mesh('nem_chierico')
    m.prism(8, 0.5, 0.22, 0, 1.1, 'p_pietra_chiara')                                                  # tonaca
    m.prism(8, 0.38, 0.38, 0.76, 0.84, 'p_giallo')                                                    # cintura
    m.prism(8, 0.27, 0.24, 1.09, 1.51, 'p_pietra', top='p_pietra')                                    # busto
    m.loft([m.ring(8, 0.22, 1.38), m.ring(8, 0.22, 1.52), m.ring(8, 0.15, 1.68), m.ring(8, 0.0001, 1.74)], 'p_giallo')  # testa a cupola
    _disco(m, (0, 1.62, 0.2), 0.44, 0.06, 'p_arancio', n=12)                                          # aureola a ingranaggio
    _disco(m, (0, 1.62, 0.17), 0.3, 0.02, 'p_pietra_scura', n=12)
    for k in range(8):
        a = k * math.pi / 4
        m.push(Xf(t=(math.cos(a) * 0.5, 1.62 + math.sin(a) * 0.5, 0.2), r=(0, 0, math.degrees(a))))
        m.box(-0.05, -0.05, -0.03, 0.05, 0.05, 0.03, 'p_arancio', skip=('front',))
        m.pop()
    for sx, rx in ((-1, 17), (1, 29)):                                                                # maniche
        m.push(Xf(t=(sx * 0.36, 1.15, -0.08), r=(rx, 0, -sx * 11)))
        m.box(-0.08, -0.275, -0.08, 0.08, 0.275, 0.08, 'p_pietra_chiara')
        m.pop()
    m.prism(5, 0.035, 0.035, 0.05, 1.85, 'p_legno_scuro', cx=0.42, cz=-0.3)                           # bastone
    m.prism(6, 0.12, 0.1, 1.84, 1.92, 'p_giallo', top='p_giallo', cx=0.42, cz=-0.3)
    _gemma(m, (0.42, 1.98, -0.3), 0.11, 'p_acqua_bassa')                                              # la lampada d'olio
    _quad(m, [(-0.12, 1.48, -0.215), (0.12, 1.48, -0.215), (0.12, 1.52, -0.215), (-0.12, 1.52, -0.215)], 'p_acqua_bassa', EM)  # l'occhio
    return _obj(m)


def nem_sentinella():
    """Sentinella dell'Egida: corazza pesante di marmo e ottone, elmo a celata che brilla, braccio destro col pugno di ferro e davanti lo
    scudo torre a energia cinetica (cornice d'ottone, pannello d'acqua che brilla)."""
    m = Mesh('nem_sentinella')
    for sx in (-1, 1):
        m.cbox(sx * 0.26, 0.05, 0.34, 0.36, 0.025, 0.875, 'p_pietra_scura')                          # gambe
        m.cbox(sx * 0.26, 0, 0.42, 0.5, 0, 0.18, 'p_roccia', skip=('bottom',))                        # piedi
    m.cbox(0, 0.05, 1.05, 0.7, 0.875, 1.825, 'p_pietra')                                              # busto
    for y in (1.0, 1.73):
        m.cbox(0, 0.05, 1.1, 0.75, y, y + 0.1, 'p_giallo', skip=('top', 'bottom'))
    m.cbox(0, 0.05, 0.42, 0.42, 1.84, 2.26, 'p_pietra_scura')                                         # elmo
    m.cbox(0, 0.05, 0.46, 0.46, 2.26, 2.34, 'p_giallo')
    _quad(m, [(-0.14, 2.045, -0.172), (0.14, 2.045, -0.172), (0.14, 2.095, -0.172), (-0.14, 2.095, -0.172)], 'p_acqua_bassa', EM)  # celata
    m.cbox(0.66, 0.05, 0.3, 0.3, 1.0, 1.7, 'p_pietra')                                                # braccio destro
    m.cbox(0.66, 0.05, 0.34, 0.34, 0.75, 1.05, 'p_roccia')                                            # pugno
    m.push(Xf(t=(-0.62, 1.4, -0.25), r=(34, 0, 0)))                                                   # braccio dello scudo
    m.box(-0.15, -0.3, -0.15, 0.15, 0.3, 0.15, 'p_pietra')
    m.pop()
    m.box(-0.725, 0.125, -0.68, 0.525, 1.975, -0.56, 'p_acqua_profonda')                              # lo scudo torre
    m.box(-0.775, 1.93, -0.7, 0.575, 2.03, -0.54, 'p_giallo')                                         # cornice
    m.box(-0.775, 0.07, -0.7, 0.575, 0.17, -0.54, 'p_giallo')
    m.box(-0.8, 0.125, -0.7, -0.7, 1.975, -0.54, 'p_giallo')
    m.box(0.5, 0.125, -0.7, 0.6, 1.975, -0.54, 'p_giallo')
    m.box(-0.55, 0.4, -0.71, 0.35, 1.7, -0.69, 'p_acqua_bassa', skip=('back',), mat=EM)              # l'energia cinetica
    return _obj(m)


def nem_guardia():
    """Guardia d'Onore: élite asimmetrica. Corazza bianca con la fascia rossa, elmo col pennacchio rosso; a sinistra la spada d'acqua
    tagliente (brilla), a destra il braccio-serbatoio d'ottone col manometro e il tubo che porta l'acqua alla spada."""
    m = Mesh('nem_guardia')
    for sx in (-1, 1):
        m.cbox(sx * 0.15, 0, 0.22, 0.24, 0.025, 0.875, 'p_pietra_chiara')                            # gambe
    m.cbox(0, 0, 0.6, 0.38, 0.9, 1.6, 'p_pietra_chiara')                                              # corazza
    m.cbox(0, 0, 0.64, 0.42, 0.9, 1.0, 'p_giallo', skip=('top', 'bottom'))
    m.push(Xf(t=(0, 1.35, 0), r=(0, 0, 29)))                                                          # fascia
    m.box(-0.33, -0.06, -0.21, 0.33, 0.06, 0.21, 'p_rosso')
    m.pop()
    m.cbox(0, 0, 0.3, 0.3, 1.64, 1.96, 'p_pietra_scura')                                              # elmo
    m.cbox(0, 0.04, 0.08, 0.34, 1.92, 2.32, 'p_rosso', skip=('bottom',))                              # pennacchio
    m.push(Xf(t=(-0.4, 1.25, -0.15), r=(34, 0, 0)))                                                   # braccio sinistro
    m.box(-0.07, -0.3, -0.07, 0.07, 0.3, 0.07, 'p_pietra_chiara')
    m.pop()
    m.cbox(-0.42, -0.42, 0.18, 0.1, 0.95, 1.05, 'p_giallo')                                           # elsa
    m.box(-0.455, 0.965, -1.675, -0.385, 1.035, -0.425, 'p_acqua_bassa', mat=EM)                      # la lama d'acqua
    m.box(-0.49, 0.985, -1.65, -0.35, 1.015, -0.45, 'p_acqua', mat=EM)
    m.prism(8, 0.2, 0.18, 0.875, 1.625, 'p_arancio', top='p_arancio', bottom='p_arancio', cx=0.46)   # braccio-serbatoio
    m.prism(6, 0.1, 0.08, 0.675, 0.925, 'p_pietra_scura', bottom='p_pietra_scura', cx=0.46, cz=-0.05)
    m.box(0.4, 1.29, -0.225, 0.52, 1.41, -0.18, 'p_giallo', skip=('back',))                           # manometro
    m.push(Xf(t=(0.1, 1.45, 0.25), r=(0, 0, 69)))                                                     # il tubo dell'acqua
    m.box(-0.04, -0.3, -0.04, 0.04, 0.3, 0.04, 'p_pietra_scura')
    m.pop()
    return _obj(m)


def nem_custode_egida():
    """Il Custode dell'Egida (boss): il guardiano della Regina, alto tre metri e mezzo. Gambe con le ginocchiere d'ottone, busto di marmo
    con la finestra dei tre cuori (acqua, vapore, moto: brillano), spallacci, elmo con la cresta e gli occhi che brillano; l'Egida (scudo
    rotondo d'ottone e acqua con l'onda) davanti a sinistra, il tridente d'ottone a destra, due pistoni sulla schiena."""
    m = Mesh('nem_custode_egida')
    for sx in (-1, 1):
        m.cbox(sx * 0.4, 0, 0.5, 0.55, 0.02, 1.22, 'p_pietra')                                       # gambe
        m.cbox(sx * 0.4, -0.3, 0.56, 0.2, 0.6, 0.9, 'p_giallo')                                       # ginocchiere
        m.cbox(sx * 0.4, -0.05, 0.6, 0.75, 0, 0.2, 'p_roccia', skip=('bottom',))                      # piedi
        m.prism(8, 0.5, 0.42, 2.475, 2.925, 'p_arancio', top='p_arancio', cx=sx * 1.05)               # spallacci
        m.prism(6, 0.13, 0.13, 1.75, 2.85, 'p_pietra', top='p_pietra', cx=sx * 0.4, cz=0.6)           # pistoni
    m.cbox(0, 0, 1.2, 0.8, 1.2, 1.6, 'p_pietra_scura')                                                # vita
    m.cbox(0, 0, 1.7, 1.0, 1.575, 2.825, 'p_pietra_chiara')                                           # busto
    for y in (1.56, 2.74):
        m.cbox(0, 0, 1.75, 1.05, y, y + 0.12, 'p_giallo', skip=('top', 'bottom'))
    m.box(-0.5, 2.0, -0.56, 0.5, 2.5, -0.48, 'p_nero_caldo', skip=('back',))                          # la finestra dei cuori
    for x, reg in ((-0.3, 'p_acqua'), (0, 'p_pietra_chiara'), (0.3, 'p_giallo')):
        _gemma(m, (x, 2.25, -0.56), 0.16, reg)                                                        # i tre cuori
    m.cbox(0, 0, 0.55, 0.55, 2.85, 3.45, 'p_pietra_scura')                                            # elmo
    m.cbox(0, 0, 0.12, 0.6, 3.45, 3.78, 'p_giallo', skip=('bottom',))                                 # cresta
    _quad(m, [(-0.2, 3.17, -0.278), (0.2, 3.17, -0.278), (0.2, 3.23, -0.278), (-0.2, 3.23, -0.278)], 'p_acqua_bassa', EM)  # occhi
    m.cbox(-1.05, -0.1, 0.4, 0.4, 1.45, 2.45, 'p_pietra')                                             # braccio sinistro
    m.push(Xf(t=(1.05, 1.95, -0.2), r=(23, 0, 0)))                                                    # braccio destro
    m.box(-0.2, -0.5, -0.2, 0.2, 0.5, 0.2, 'p_pietra')
    m.pop()
    _disco(m, (-1.25, 1.8, -0.62), 0.95, 0.16, 'p_giallo', n=12)                                       # l'Egida
    _disco(m, (-1.25, 1.8, -0.71), 0.78, 0.04, 'p_acqua_profonda', n=12)
    _disco(m, (-1.25, 1.8, -0.74), 0.45, 0.02, 'p_acqua_bassa', n=10, mat=EM)                         # l'onda sull'Egida
    m.prism(6, 0.06, 0.06, 0.1, 3.3, 'p_giallo', top='p_giallo', cx=1.15, cz=-0.55)                   # il tridente
    for x in (-0.22, 0, 0.22):
        m.cbox(1.15 + x, -0.55, 0.06, 0.06, 3.2, 3.7, 'p_pietra_chiara', skip=('bottom',))
    m.cbox(1.15, -0.55, 0.5, 0.08, 3.16, 3.24, 'p_giallo')
    return _obj(m)


MODELS_MAIN = [prop_ingresso_mausoleo]
MODELS_RPG = [dng_mausoleo_pavimento, dng_mausoleo_muro, dng_mausoleo_muro_basso, dng_mausoleo_colonna, dng_mausoleo_leva, dng_mausoleo_sarcofago,
              nem_chierico, nem_sentinella, nem_guardia, nem_custode_egida]
MODELS = {f.__name__: f for f in MODELS_MAIN + MODELS_RPG}
