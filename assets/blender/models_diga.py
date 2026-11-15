# La Diga dei Disertori (Riccardo, 15 ott 2026, #354): l'ingresso nella Gola del Dente sull'Isola della Tempesta, il kit del relitto della
# «Stella del Mattino», la Ruota di Sentina, il pilone dell'arena, il ponte mobile e i nemici (la Guardia della Paratia, il Fuciliere
# d'Acquafonda, l'Albatros di Pece, il Capitano Vaelen). Scritto sul PC di Riccardo senza Blender: MAI ESEGUITO. Il Claude di Jack lo lancia con:
#   npm run assets prop_ingresso_diga dng_diga_pavimento dng_diga_muro dng_diga_muro_basso dng_diga_colonna dng_diga_ruota dng_diga_pilone dng_diga_ponte
# poi lo sistema se qualcosa non torna, conta i triangoli e guarda il foglio dei contatti (tests/out/rpg_contact.png).
# I nomi sono quelli che cerca il codice: prop_ingresso_<stile> (game/ingressi.ts), dng_diga_pavimento/muro/muro_basso e dng_diga_colonna
# (il cannone sull'affusto: rpg/dungeon_scene.ts), dng_diga_ruota (solo il piedistallo: la ruota d'ottone che gira la mette il client),
# dng_diga_pilone (la bitta intera: il moncone fracassato lo mette il client) e dng_diga_ponte (rpg/diga_fx.ts: il tavolato 6 × 4 m con la
# cerniera a x = 0, che si allunga verso −X), e il campo `model` di enemies.json.
# Finché i modelli mancano dal manifest il gioco usa i segnaposto in codice di apps/client/src/rpg/diga.ts (nemici, kit, ruota, pilone,
# ponte, rottami) e apps/client/src/game/ingressi_forme.ts (ingresso, `prua`): le forme qui sotto li ricalcano, così l'aspetto non cambia di
# colpo. La Guardia ha DUE oggetti: il corpo (`nem_guardiano`) e il portello (`portello`, lo scudo che il client nasconde quando va in
# frantumi): il nodo deve chiamarsi proprio così. I rottami, la schiuma della risacca, il mare oltre la murata, le corsie e gli scudi
# restano in codice: niente modello.
# Le parti che brillano (l'oblò dello scafandro, gli occhi, la lanterna azzurra, la vela del Capitano) usano `mat_emissivo`.
# Convenzioni come models_mausoleo.py: x destra, y su, davanti −Z, 1 unità = 1 m, pivot a terra al centro; dng_* moduli ≤ 60 triangoli
# (pavimento da 0 a −0,3, muri da 0 a 2,4, bassi 0,6), colonna, ruota, pilone e ponte 50-200; nem_* ≤ 600 (il Capitano, boss, ≤ 1.200);
# solo colori della palette e i campioni piatti `p_<colore>` dell'atlas. Triangoli NON contati (qui niente Python): li conta il Claude di Jack.
import math
from lib import Mesh, Xf

EM = 'mat_emissivo'


def _obj(*ms, **info):
    out = [m.build() for m in ms]
    return (out, info) if info else out


def _quad(m, pts, reg, mat=None):
    m.poly(pts, reg, mat)


def _anello(m, c, r, t, reg, n=8, asse='y'):
    """Anello (toro grezzo a sezione quadra) attorno a c: asse 'y' = steso a terra, 'z' = in piedi verso −Z."""
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        p = lambda a, rr: (c[0] + math.cos(a) * rr, c[1], c[2] + math.sin(a) * rr) if asse == 'y' else (c[0] + math.cos(a) * rr, c[1] + math.sin(a) * rr, c[2])  # noqa: E731
        _quad(m, [p(a0, r - t), p(a1, r - t), p(a1, r + t), p(a0, r + t)], reg)


# ------------------------------------------------------------------ manifest principale: ingresso
def prop_ingresso_diga():
    """La prua della «Stella del Mattino» incastrata di traverso tra due pareti di roccia nera (≈ 5 × 4 m): le due fiancate a V che si
    chiudono sulla ruota di prua (verso −Z), fasciame a bande col catrame, lo squarcio nero alla base (la bocca), il bompresso spezzato, la
    polena senza volto che stringe la culla e, appesa, la lanterna azzurra (≤ 200 triangoli)."""
    m = Mesh('prop_ingresso_diga')
    m.push(Xf(t=(-2.7, 0, 0.6), r=(0, 14, 5))); m.cbox(0, 0, 1.4, 3.2, 0, 4.0, 'p_roccia', skip=('bottom',)); m.pop()   # la roccia a sinistra
    m.push(Xf(t=(2.7, 0, 0.7), r=(0, -11, -3))); m.cbox(0, 0, 1.5, 3.0, 0, 4.6, 'p_nero_caldo', skip=('bottom',)); m.pop()  # e a destra
    m.push(Xf(r=(0, 17, 3)))                                                                          # di traverso nella gola
    for lato in (-1, 1):
        m.push(Xf(t=(0.9 * lato, 0, 0.6), r=(0, 24 * lato, 0)))
        for k, (y0, y1, reg) in enumerate(((0, 1.0, 'p_legno_scuro'), (1.0, 2.0, 'p_legno'), (2.0, 3.0, 'p_legno_scuro'), (3.0, 3.6, 'p_legno'))):
            m.cbox(0, 0, 0.32, 4.5 - k * 0.3, y0, y1, reg, skip=('bottom',))
        m.cbox(0, 0.2, 0.4, 3.8, 3.6, 3.75, 'p_legno_chiaro', skip=('bottom',))                       # la falchetta
        m.pop()
    m.push(Xf(t=(0, 0, -1.5), r=(-9, 0, 0))); m.cbox(0, 0, 0.36, 0.36, 0, 4.3, 'p_legno_scuro', skip=('bottom',)); m.pop()  # ruota di prua
    m.pop()
    m.push(Xf(t=(-0.35, 0, -1.25), r=(0, 17, 0))); m.box(-0.65, 0, -0.12, 0.65, 1.8, 0.12, 'p_nero_caldo', skip=('bottom',)); m.pop()  # lo squarcio
    m.push(Xf(t=(0.55, 4.0, -2.2), r=(-60, 17, 0))); m.prism(6, 0.14, 0.11, -1.2, 1.2, 'p_legno', top='p_legno_chiaro'); m.pop()  # bompresso spezzato
    m.push(Xf(t=(0.3, 2.95, -1.95), r=(-29, 17, 0))); m.prism(6, 0.28, 0.2, -0.6, 0.6, 'p_legno_chiaro', top='p_legno_chiaro'); m.pop()  # la polena
    m.cbox(0.38, -2.2, 0.32, 0.3, 3.43, 3.77, 'p_legno_chiaro')                                         # la testa senza volto
    m.push(Xf(t=(0.28, 2.69, -2.3), r=(0, 17, 0))); m.cbox(0, 0, 0.5, 0.3, 0, 0.22, 'p_legno', top='p_sabbia'); m.pop()  # la culla
    m.prism(4, 0.02, 0.02, 2.7, 3.5, 'p_roccia', cx=0.75, cz=-2.7)                                    # la catenella
    m.cbox(0.75, -2.7, 0.32, 0.32, 2.22, 2.3, 'p_roccia'); m.cbox(0.75, -2.7, 0.32, 0.32, 2.64, 2.72, 'p_roccia')  # il telaio della lanterna
    m.cbox(0.75, -2.7, 0.26, 0.26, 2.3, 2.64, 'p_acqua_bassa', mat=EM)                                 # la lanterna azzurra
    return _obj(m, footprint=[6, 6])


# ------------------------------------------------------------------ kit del dungeon (≤ 60 tri i moduli)
def dng_diga_pavimento():
    """Tavolato 2×2 a y = 0 (bordo che scende a −0,3): quattro tavole col catrame nelle commessure, tutte nello stesso verso (lungo X)."""
    m = Mesh('dng_diga_pavimento')
    m.box(-1, -0.3, -1, 1, 0, 1, 'p_legno_scuro', top='p_legno', skip=('bottom',))
    y = 0.004
    for z in (-0.5, 0, 0.5):
        _quad(m, [(-1, y, z + 0.025), (1, y, z + 0.025), (1, y, z - 0.025), (-1, y, z - 0.025)], 'p_nero_caldo')
    _quad(m, [(0.3, y * 2, 0.5), (0.36, y * 2, 0.5), (0.36, y * 2, 0), (0.3, y * 2, 0)], 'p_ombra_calda')  # la testa di una tavola
    return _obj(m)


def _murata(m, H):
    m.box(-1, 0, -1, 1, H, 1, 'p_legno', top='p_legno_scuro', skip=('bottom',))
    if H > 1:  # fasciame col catrame, un'ordinata, la linea dell'acqua coi cirripedi
        for y in (0.9, 1.5, 2.1):
            m.box(-1.01, y, -1.01, 1.01, y + 0.05, 1.01, 'p_nero_caldo', skip=('bottom', 'top'))
        m.box(-1.02, 0.25, -1.02, 1.02, 0.32, 1.02, 'p_acqua_profonda', skip=('bottom', 'top'))
        m.box(-1.015, 0, -1.015, 1.015, 0.25, 1.015, 'p_ombra_calda', skip=('bottom', 'top'))


def dng_diga_muro():
    m = Mesh('dng_diga_muro')
    _murata(m, 2.4)
    return _obj(m)


def dng_diga_muro_basso():
    m = Mesh('dng_diga_muro_basso')
    _murata(m, 0.6)
    return _obj(m)


def dng_diga_colonna():
    """Le colonne della Diga: un cannone di ferro sull'affusto di legno, la bocca verso −Z, le quattro ruote, la braca e due palle a terra."""
    m = Mesh('dng_diga_colonna')
    m.cbox(0, 0.1, 1.1, 1.5, 0.22, 0.58, 'p_legno_scuro', top='p_legno')                               # l'affusto
    for x in (-0.62, 0.62):
        for z in (-0.4, 0.55):
            m.push(Xf(t=(x, 0.24, z), r=(0, 0, 90))); m.prism(8, 0.24, 0.24, -0.07, 0.07, 'p_legno', top='p_legno', bottom='p_legno'); m.pop()
    m.push(Xf(t=(0, 0.95, -0.25), r=(90, 0, 0))); m.prism(8, 0.24, 0.32, -0.9, 0.9, 'p_roccia', top='p_nero_caldo', bottom='p_roccia'); m.pop()  # la canna
    m.push(Xf(t=(0, 0.95, 0.15), r=(90, 0, 0))); m.prism(8, 0.27, 0.27, -0.05, 0.05, 'p_pietra_scura'); m.pop()
    m.prism(4, 0.14, 0.14, 0, 0.28, 'p_nero_caldo', top='p_nero_caldo', cx=-0.35, cz=0.75)            # le palle
    return _obj(m)


def dng_diga_ruota():
    """Il piedistallo della Ruota di Sentina: base di legno, colonna, il collare d'ottone, il tubo della paratia e la targa (la ruota a otto
    razze che gira la mette il client, a 1,45 m davanti a −Z)."""
    m = Mesh('dng_diga_ruota')
    m.prism(8, 0.55, 0.45, 0, 0.2, 'p_legno_scuro', top='p_legno_scuro')
    m.cbox(0, 0, 0.3, 0.3, 0.2, 1.22, 'p_legno')
    m.cbox(0, 0, 0.42, 0.42, 1.17, 1.27, 'p_arancio')
    m.push(Xf(t=(0.28, 0.25, 0), r=(0, 0, 90))); m.prism(6, 0.2, 0.2, -0.25, 0.25, 'p_arancio', top='p_arancio'); m.pop()
    m.cbox(0, -0.17, 0.42, 0.05, 0.49, 0.75, 'p_giallo')
    return _obj(m)


def dng_diga_pilone():
    """Il pilone del Ponte di Comando: bitta di legno grossa (≈ 1,4 m di diametro, 2,35 m) con due bande di ferro, la testa larga e la gomena
    avvolta col capo che pende (il moncone fracassato lo mette il client)."""
    m = Mesh('dng_diga_pilone')
    m.prism(8, 0.7, 0.62, 0, 2.1, 'p_legno_scuro')
    for y in (0.3, 1.7):
        m.prism(8, 0.66, 0.66, y, y + 0.12, 'p_roccia')
    m.prism(8, 0.62, 0.7, 2.05, 2.35, 'p_legno', top='p_legno')
    for y in (1.0, 1.15, 1.3):
        m.prism(10, 0.74, 0.74, y - 0.05, y + 0.05, 'p_sabbia')
    m.push(Xf(t=(0.66, 0.6, 0.2), r=(0, 0, 17))); m.cbox(0, 0, 0.12, 0.12, -0.35, 0.35, 'p_sabbia'); m.pop()
    return _obj(m)


def dng_diga_ponte():
    """Il ponte mobile: tavolato 6 × 4 m con la cerniera a x = 0 e le tavole verso −X (il client lo tiene alzato in verticale e lo abbassa
    sulla falla quando giri la sua ruota), tre traverse e la cerniera di ferro."""
    m = Mesh('dng_diga_ponte')
    for k in range(8):
        z0 = -2 + k * 0.5
        m.box(-6, 0, z0 + 0.03, 0, 0.12, z0 + 0.47, 'p_legno_chiaro' if k % 2 else 'p_legno', skip=('bottom',))
    for x in (0.4, 3.0, 5.6):
        m.box(-x - 0.09, 0.12, -2, -x + 0.09, 0.2, 2, 'p_legno_scuro', skip=('bottom',))
    m.push(Xf(t=(-0.05, 0.1, 0), r=(90, 0, 0))); m.prism(6, 0.08, 0.08, -2, 2, 'p_roccia', top='p_roccia', bottom='p_roccia'); m.pop()
    return _obj(m)


# ------------------------------------------------------------------ nemici (statici, il client li anima)
MODELS_MAIN = [prop_ingresso_diga]
MODELS_RPG = [dng_diga_pavimento, dng_diga_muro, dng_diga_muro_basso, dng_diga_colonna, dng_diga_ruota, dng_diga_pilone, dng_diga_ponte]
MODELS = {f.__name__: f for f in MODELS_MAIN + MODELS_RPG}
